import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAGE_BUCKET = "question-images";
const QUESTION_CHUNK = 100;
const OPTION_CHUNK = 400;

function mimeToExt(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  return "png";
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const LABELS = ["A", "B", "C", "D"] as const;
const labelToField: Record<string, string> = {
  A: "alternativa_a", B: "alternativa_b", C: "alternativa_c", D: "alternativa_d",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { simulado_id, questions, images, image_urls } = await req.json();
    if (!simulado_id || !Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "simulado_id and questions array required" }), { status: 400, headers: corsHeaders });
    }

    const urlMap: Record<number, { enunciado_url?: string; enunciado2_url?: string; comentario_url?: string }> = image_urls || {};
    // Legacy fallback: base64 payload (mantido por compat; o fluxo novo sobe imagens direto pro Storage).
    const imageMap: Record<number, {
      enunciado?: { data: string; mime: string };
      comentario?: { data: string; mime: string };
    }> = images || {};

    // ── 1) Resolve URLs de imagem por questão (url_map preferido; base64 legado faz upload) ──
    const prepared: Array<{ qNum: number; q: any; row: Record<string, unknown> }> = [];
    for (const q of questions) {
      const qNum = Number(q.numero);
      let imageUrl: string | null = q.image_url || null;
      let imageUrl2: string | null = q.image_url_2 || null;
      let explanationImageUrl: string | null = null;

      const urls = urlMap[qNum];
      if (urls?.enunciado_url) imageUrl = urls.enunciado_url;
      if (urls?.enunciado2_url) imageUrl2 = urls.enunciado2_url;
      if (urls?.comentario_url) explanationImageUrl = urls.comentario_url;

      const qImages = imageMap[qNum];
      if (qImages?.enunciado) {
        try {
          const ext = mimeToExt(qImages.enunciado.mime);
          const storagePath = `${simulado_id}/${qNum}_enunciado.${ext}`;
          const bytes = Uint8Array.from(atob(qImages.enunciado.data), (c) => c.charCodeAt(0));
          const { error } = await adminClient.storage.from(IMAGE_BUCKET).upload(storagePath, bytes, { contentType: qImages.enunciado.mime, upsert: true });
          if (!error) imageUrl = adminClient.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
          else console.error("Enunciado image upload error:", error);
        } catch (e) { console.error("enunciado img", e); }
      }
      if (qImages?.comentario) {
        try {
          const ext = mimeToExt(qImages.comentario.mime);
          const storagePath = `${simulado_id}/${qNum}_comentario.${ext}`;
          const bytes = Uint8Array.from(atob(qImages.comentario.data), (c) => c.charCodeAt(0));
          const { error } = await adminClient.storage.from(IMAGE_BUCKET).upload(storagePath, bytes, { contentType: qImages.comentario.mime, upsert: true });
          if (!error) explanationImageUrl = adminClient.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
          else console.error("Comentario image upload error:", error);
        } catch (e) { console.error("comentario img", e); }
      }

      prepared.push({
        qNum,
        q,
        row: {
          simulado_id,
          question_number: qNum,
          text: q.texto || "",
          area: q.area || "",
          theme: q.tema || "",
          difficulty: q.dificuldade || "medium",
          explanation: q.explicacao || null,
          image_url: imageUrl,
          image_url_2: imageUrl2,
          explanation_image_url: explanationImageUrl,
        },
      });
    }

    // ── 2) Insere questões em LOTE (chunked), com fallback por linha se um lote falhar ──
    const qNumToId = new Map<number, string>();
    for (const part of chunk(prepared, QUESTION_CHUNK)) {
      const { data, error } = await adminClient
        .from("questions")
        .insert(part.map((p) => p.row))
        .select("id, question_number");
      if (!error && data) {
        for (const d of data) qNumToId.set(Number(d.question_number), d.id as string);
      } else {
        console.error("Batch question insert failed, fallback per-row:", error);
        for (const p of part) {
          const { data: one, error: e1 } = await adminClient
            .from("questions").insert(p.row).select("id, question_number").single();
          if (e1 || !one) { console.error("Question insert error:", p.qNum, e1); continue; }
          qNumToId.set(Number(one.question_number), one.id as string);
        }
      }
    }

    // ── 3) Monta e insere opções em LOTE (chunked), com fallback por linha ──
    const optionRows: Array<Record<string, unknown>> = [];
    for (const p of prepared) {
      const qid = qNumToId.get(p.qNum);
      if (!qid) continue;
      const correta = (p.q.correta || "").toUpperCase();
      for (const label of LABELS) {
        optionRows.push({
          question_id: qid,
          label,
          text: p.q[labelToField[label]] || "",
          is_correct: correta === label,
        });
      }
    }
    for (const part of chunk(optionRows, OPTION_CHUNK)) {
      const { error } = await adminClient.from("question_options").insert(part);
      if (error) {
        console.error("Batch options insert failed, fallback per-row:", error);
        for (const opt of part) {
          const { error: e2 } = await adminClient.from("question_options").insert(opt);
          if (e2) console.error("Option insert error:", e2);
        }
      }
    }

    const inserted = qNumToId.size;

    await adminClient.from("simulados").update({ questions_count: inserted }).eq("id", simulado_id);

    return new Response(JSON.stringify({ inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

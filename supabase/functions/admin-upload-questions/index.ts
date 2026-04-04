import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAGE_BUCKET = "question-images";

function mimeToExt(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  return "png";
}

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

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { simulado_id, questions, images } = await req.json();
    if (!simulado_id || !Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "simulado_id and questions array required" }), { status: 400, headers: corsHeaders });
    }

    const labelMap: Record<string, string> = {
      A: "alternativa_a",
      B: "alternativa_b",
      C: "alternativa_c",
      D: "alternativa_d",
    };

    // Type for images payload
    const imageMap: Record<number, {
      enunciado?: { data: string; mime: string };
      comentario?: { data: string; mime: string };
    }> = images || {};

    let inserted = 0;

    for (const q of questions) {
      const qNum = Number(q.numero);

      // Upload images to Storage if present
      let imageUrl: string | null = q.image_url || null;
      let explanationImageUrl: string | null = null;

      const qImages = imageMap[qNum];

      if (qImages?.enunciado) {
        try {
          const ext = mimeToExt(qImages.enunciado.mime);
          const storagePath = `${simulado_id}/${qNum}_enunciado.${ext}`;
          const imageBytes = Uint8Array.from(atob(qImages.enunciado.data), c => c.charCodeAt(0));

          const { error: uploadErr } = await adminClient.storage
            .from(IMAGE_BUCKET)
            .upload(storagePath, imageBytes, {
              contentType: qImages.enunciado.mime,
              upsert: true,
            });

          if (uploadErr) {
            console.error("Enunciado image upload error:", uploadErr);
          } else {
            const { data: urlData } = adminClient.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
            imageUrl = urlData.publicUrl;
          }
        } catch (imgErr) {
          console.error("Error processing enunciado image:", imgErr);
        }
      }

      if (qImages?.comentario) {
        try {
          const ext = mimeToExt(qImages.comentario.mime);
          const storagePath = `${simulado_id}/${qNum}_comentario.${ext}`;
          const imageBytes = Uint8Array.from(atob(qImages.comentario.data), c => c.charCodeAt(0));

          const { error: uploadErr } = await adminClient.storage
            .from(IMAGE_BUCKET)
            .upload(storagePath, imageBytes, {
              contentType: qImages.comentario.mime,
              upsert: true,
            });

          if (uploadErr) {
            console.error("Comentario image upload error:", uploadErr);
          } else {
            const { data: urlData } = adminClient.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
            explanationImageUrl = urlData.publicUrl;
          }
        } catch (imgErr) {
          console.error("Error processing comentario image:", imgErr);
        }
      }

      const { data: question, error: qErr } = await adminClient
        .from("questions")
        .insert({
          simulado_id,
          question_number: qNum,
          text: q.texto || "",
          area: q.area || "",
          theme: q.tema || "",
          difficulty: q.dificuldade || "medium",
          explanation: q.explicacao || null,
          image_url: imageUrl,
          explanation_image_url: explanationImageUrl,
        })
        .select("id")
        .single();

      if (qErr) {
        console.error("Question insert error:", qErr);
        continue;
      }

      const options = Object.keys(labelMap).map((label) => ({
        question_id: question.id,
        label,
        text: q[labelMap[label]] || "",
        is_correct: q.correta?.toUpperCase() === label,
      }));

      const { error: optErr } = await adminClient.from("question_options").insert(options);
      if (optErr) {
        console.error("Options insert error:", optErr);
        continue;
      }

      inserted++;
    }

    await adminClient
      .from("simulados")
      .update({ questions_count: inserted })
      .eq("id", simulado_id);

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

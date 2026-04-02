import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { simulado_id, questions } = await req.json();
    if (!simulado_id || !Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "simulado_id and questions array required" }), { status: 400, headers: corsHeaders });
    }

    const labelMap: Record<string, string> = {
      A: "alternativa_a",
      B: "alternativa_b",
      C: "alternativa_c",
      D: "alternativa_d",
    };

    let inserted = 0;

    for (const q of questions) {
      const { data: question, error: qErr } = await adminClient
        .from("questions")
        .insert({
          simulado_id,
          question_number: Number(q.numero),
          text: q.texto || "",
          area: q.area || "",
          theme: q.tema || "",
          difficulty: q.dificuldade || "medium",
          explanation: q.explicacao || null,
          image_url: q.image_url || null,
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

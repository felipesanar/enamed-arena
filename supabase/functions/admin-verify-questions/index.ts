import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildContents, parseFindings, filterFindings, RESPONSE_SCHEMA, type Finding, type QInput } from './verifyHelpers.ts';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Quantas questões verificar em paralelo dentro de um lote. Cada questão vira
// UMA chamada independente ao Gemini (evita contaminação cruzada entre questões).
const PER_QUESTION_CONCURRENCY = 3;

async function verifyOneQuestion(apiKey: string, q: QInput): Promise<Finding[]> {
  const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: buildContents([q]) }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    console.error('[admin-verify-questions] Gemini error', q.question_number, r.status, txt);
    return [];
  }

  const data = await r.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  // Garante que o número da questão é o correto, independente do que o modelo devolver.
  const parsed = parseFindings(rawJson).map((f) => ({ ...f, question_number: q.question_number }));
  // Filtro determinístico: remove os falsos positivos estruturais.
  const kept = filterFindings(parsed, q);
  if (parsed.length !== kept.length) {
    console.log(
      `[admin-verify-questions] Q${q.question_number}: IA=${parsed.length} achados, pós-filtro=${kept.length} ` +
      `(descartados: ${parsed.filter((p) => !kept.includes(p)).map((p) => p.check_type).join(', ')})`,
    );
  }
  return kept;
}

async function runWithConcurrency(questions: QInput[], apiKey: string): Promise<Finding[]> {
  const results: Finding[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < questions.length) {
      const q = questions[cursor++];
      if (!q) return;
      try {
        results.push(...await verifyOneQuestion(apiKey, q));
      } catch (err) {
        console.error('[admin-verify-questions] question failed', q.question_number, err);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PER_QUESTION_CONCURRENCY, questions.length || 1) }, worker),
  );
  return results;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
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

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada', findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { questions } = (await req.json()) as { questions: QInput[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const findings = await runWithConcurrency(questions, apiKey);

    return new Response(JSON.stringify({ findings }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-verify-questions] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown', findings: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

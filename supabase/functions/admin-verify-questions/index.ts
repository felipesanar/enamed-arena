import { buildContents, parseFindings, RESPONSE_SCHEMA, type QInput } from './verifyHelpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
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

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: buildContents(questions) }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[admin-verify-questions] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini erro ${r.status}`, findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    const findings = parseFindings(rawJson);

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

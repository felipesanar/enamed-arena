const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface QuestionInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
  has_image: boolean;
  has_image_2: boolean;
  has_explanation_image: boolean;
}

interface Finding {
  question_number: number;
  check_type: 'missing_image';
  slot: 'enunciado' | 'enunciado2' | 'comentario';
  severity: 'error' | 'warning';
  evidence: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada', findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { questions } = (await req.json()) as { questions: QuestionInput[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lines = questions.map((q) =>
      `Q${q.question_number} | tem_imagem_enunciado=${q.has_image} tem_imagem2=${q.has_image_2} tem_imagem_comentario=${q.has_explanation_image}\n` +
      `ENUNCIADO: ${q.enunciado_text}\n` +
      (q.comentario_text ? `COMENTARIO: ${q.comentario_text}\n` : '')
    ).join('\n---\n');

    const prompt = `Você é um revisor de banco de questões médicas. Para cada questão abaixo, detecte se o TEXTO faz referência a uma figura/imagem (ex.: "observe a radiografia", "imagem a seguir", "figuras A e B", "o ECG mostra", "eletrocardiograma abaixo", "ausculte", "exame de imagem", "fundoscopia") MAS o slot de imagem correspondente está VAZIO (false).

Regras:
- slot "enunciado": referência a figura no enunciado e has_image=false.
- slot "enunciado2": o enunciado cita DUAS ou mais figuras (ex.: "figuras A e B", "imagens 1 e 2") e has_image_2=false.
- slot "comentario": o COMENTARIO referencia figura e has_explanation_image=false.
- severity "error" quando a referência é inequívoca; "warning" quando é possível mas ambígua.
- Se a referência existe e o slot correspondente já tem imagem (true), NÃO reporte.
- "evidence" = trecho curto do texto que motivou o achado.

Retorne JSON com "findings". Sem texto fora do JSON.

QUESTÕES:
${lines}`;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        findings: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              question_number: { type: 'INTEGER' },
              check_type: { type: 'STRING' },
              slot: { type: 'STRING' },
              severity: { type: 'STRING' },
              evidence: { type: 'STRING' },
            },
            required: ['question_number', 'check_type', 'slot', 'severity', 'evidence'],
          },
        },
      },
      required: ['findings'],
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema,
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
    let findings: Finding[] = [];
    try {
      const parsed = JSON.parse(rawJson);
      findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    } catch (e) {
      console.error('[admin-verify-questions] parse error', e, rawJson.slice(0, 300));
    }

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

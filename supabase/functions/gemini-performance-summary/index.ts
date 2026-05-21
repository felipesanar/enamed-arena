import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface AreaPerf { area: string; total: number; correct: number; score: number }
interface SubPerf { specialty: string; subTopic: string; total: number; correct: number; score: number }
interface RequestBody {
  studentName?: string;
  simuladoTitle?: string;
  overall?: { totalQuestions: number; totalCorrect: number; totalAnswered: number; percentageScore: number };
  byArea?: AreaPerf[];
  bySubspecialty?: SubPerf[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RequestBody;
    const { studentName = 'Aluno', simuladoTitle = 'simulado', overall, byArea = [], bySubspecialty = [] } = body;

    if (!overall) {
      return new Response(JSON.stringify({ error: 'overall é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const areasTxt = byArea
      .slice()
      .sort((a, b) => a.score - b.score)
      .map((a) => `- ${a.area}: ${a.correct}/${a.total} (${a.score}%)`)
      .join('\n');

    const subsSorted = bySubspecialty.slice().sort((a, b) => a.score - b.score);
    const weakest = subsSorted.slice(0, 5).map((s) => `- ${s.specialty} › ${s.subTopic}: ${s.correct}/${s.total} (${s.score}%)`).join('\n');
    const strongest = subsSorted.slice(-3).reverse().map((s) => `- ${s.specialty} › ${s.subTopic}: ${s.correct}/${s.total} (${s.score}%)`).join('\n');

    const prompt = `Você é um tutor sênior para residência médica (ENAMED). Analise o desempenho de ${studentName} no ${simuladoTitle} e gere um resumo conciso, direto e acionável, em português brasileiro, formato Markdown.

## Dados

Resultado geral: ${overall.totalCorrect}/${overall.totalQuestions} acertos (${overall.percentageScore}%), respondidas: ${overall.totalAnswered}.

Por área:
${areasTxt || '(sem dados)'}

Subespecialidades mais fracas:
${weakest || '(sem dados)'}

Subespecialidades mais fortes:
${strongest || '(sem dados)'}

## Formato de saída (use exatamente estas seções, sem H1)

### 📊 Panorama
(2-3 frases interpretando o resultado geral.)

### 🎯 Pontos fortes
(bullets curtos sobre as áreas/subespecialidades de melhor desempenho.)

### ⚠️ Prioridades de estudo
(bullets ordenados das 3-5 subespecialidades mais críticas, com justificativa numérica.)

### 🗺️ Plano de ação para 2 semanas
(checklist concreto: tópicos a revisar, quantidade de questões/dia, recursos sugeridos.)

Não invente números fora dos dados fornecidos. Seja específico e empático, sem clichês.`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[gemini-performance-summary] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini API erro ${r.status}`, detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const markdown =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    return new Response(JSON.stringify({ markdown }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gemini-performance-summary] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
/**
 * Chat de dúvidas com o Prof. Sanor sobre uma questão específica do
 * caderno de erros. Stateless: o frontend mantém o histórico em memória
 * e manda no payload a cada turno. Sem persistência por enquanto.
 *
 * Limites pragmáticos:
 *   - máx 8 turnos no histórico (descartar mais antigos no cliente)
 *   - pergunta do usuário até ~600 caracteres
 *   - resposta da IA até ~250 palavras
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OptionPayload {
  label: string;
  text: string;
  isCorrect?: boolean;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  studentName?: string;
  questionStem: string;
  options: OptionPayload[];
  correctLabel?: string | null;
  userLabel?: string | null;
  area?: string | null;
  theme?: string | null;
  reason?: string | null;
  learningNote?: string | null;
  aiReviewMd?: string | null;
  history: ChatTurn[];
  question: string;
}

function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.[ \t]+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
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
    const {
      studentName = 'Aluno',
      questionStem,
      options = [],
      correctLabel,
      userLabel,
      area,
      theme,
      reason,
      learningNote,
      aiReviewMd,
      history = [],
      question,
    } = body;

    if (!questionStem || options.length === 0) {
      return new Response(JSON.stringify({ error: 'questionStem e options são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'question é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (studentName || 'Aluno').trim().split(/\s+/)[0];
    const trimmedQuestion = question.trim().slice(0, 600);
    const trimmedHistory = history.slice(-8);

    const optionsTxt = options
      .map((o) => {
        const tags: string[] = [];
        if (correctLabel && o.label === correctLabel) tags.push('GABARITO');
        if (userLabel && o.label === userLabel) tags.push('MARCADA');
        const suffix = tags.length ? ` [${tags.join(', ')}]` : '';
        return `(${o.label}) ${o.text}${suffix}`;
      })
      .join('\n');

    const contextLine = [area, theme].filter(Boolean).join(' > ') || 'área não informada';
    const noteLine = learningNote?.trim() ? `Anotação do aluno: "${learningNote.trim()}"` : '';
    const reviewLine = aiReviewMd?.trim()
      ? `Você já enviou esta análise prévia (resumida abaixo, NÃO repita):\n${aiReviewMd.trim()}`
      : '';
    const reasonLine = reason ? `Motivo de ter salvado: ${reason}` : '';
    const correctLine = correctLabel ? `Gabarito: (${correctLabel})` : '';
    const userLine = userLabel ? `${firstName} marcou: (${userLabel})` : `${firstName} não marcou.`;

    const systemPrompt = `# QUEM VOCÊ É

Você é o **Prof. Sanor**, mentor pessoal de ${firstName} pro ENAMED. Está num chat seguindo uma análise que você já entregou de uma questão do caderno de erros. ${firstName} quer tirar uma dúvida específica.

**Tom:** profissional, próximo, direto. Como R3 de Clínica explicando ao lado.

**Propósito:** responder com precisão a dúvida feita, ancorada na questão específica. Sem rodeios.

🚫 **TRAVESSÃO PROIBIDO (— ou –). Use ponto, vírgula, "que", "porque", "e".**

# CONTEXTO DA QUESTÃO

Área: ${contextLine}
${reasonLine}
${noteLine}

## Enunciado
${questionStem}

## Alternativas
${optionsTxt}

${correctLine}
${userLine}

${reviewLine}

# COMO RESPONDER

✅ Máximo **120 palavras**, parágrafo único ou bullets curtos.
✅ Ancore a resposta na questão específica.
✅ Cite alternativa por label (A, B…) quando for o caso.
✅ Use markdown leve (negrito em palavras-chave, no máximo 2 trechos).

🚫 BANIDO:
- Saudações, despedidas, meta-comentários ("ótima pergunta", "vamos lá").
- Repetir a análise já enviada palavra por palavra.
- Recusar respostas em pretexto de "não sou médico de verdade". Você é o Prof. Sanor.
- Inventar dados clínicos não presentes na questão; quando não tiver certeza, diga.
- TRAVESSÃO em qualquer lugar.

# COMECE

Responda direto à dúvida de ${firstName} sem chamar o nome dele.`;

    // Constrói o histórico para Gemini: system instruction + turns + nova pergunta.
    const geminiContents = [
      ...trimmedHistory.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: t.content }],
      })),
      { role: 'user', parts: [{ text: trimmedQuestion }] },
    ];

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 700,
            topP: 0.9,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[gemini-error-notebook-chat] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini API erro ${r.status}`, detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const raw =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    const reply = stripEmDashes(raw).trim();

    if (!reply) {
      return new Response(JSON.stringify({ error: 'Resposta vazia da IA' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gemini-error-notebook-chat] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

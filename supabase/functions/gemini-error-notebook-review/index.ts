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

interface RequestBody {
  studentName?: string;
  questionNumber?: number | null;
  questionStem: string;
  options: OptionPayload[];
  correctLabel?: string | null;
  userLabel?: string | null;
  area?: string | null;
  theme?: string | null;
  reason?: string | null;
  learningNote?: string | null;
  explanation?: string | null;
}

const REASON_LABELS: Record<string, string> = {
  errei: 'errou a questão',
  sem_certeza: 'acertou mas no chute',
  reading_error: 'errou por desatenção/leitura',
  confused_alternatives: 'confundiu com outra condição',
  conceito_fraco: 'sente que o conceito está fraco',
  revisar_depois: 'marcou pra revisar depois',
};

/** Sanitiza travessões da resposta. Prof. Sanor não usa em hipótese alguma. */
function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.\s+\./g, '.')
    .replace(/\s{2,}/g, ' ');
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
      questionNumber,
      questionStem,
      options = [],
      correctLabel,
      userLabel,
      area,
      theme,
      reason,
      learningNote,
      explanation,
    } = body;

    if (!questionStem || options.length === 0) {
      return new Response(JSON.stringify({ error: 'questionStem e options são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (studentName || 'Aluno').trim().split(/\s+/)[0];
    const reasonLabel = reason ? (REASON_LABELS[reason] ?? reason) : 'salvou no caderno';

    const optionsTxt = options
      .map((o) => {
        const tags: string[] = [];
        if (o.isCorrect) tags.push('GABARITO');
        if (correctLabel && o.label === correctLabel && !o.isCorrect) tags.push('GABARITO');
        if (userLabel && o.label === userLabel) tags.push('MARCADA PELO ALUNO');
        const suffix = tags.length ? ` [${tags.join(', ')}]` : '';
        return `(${o.label}) ${o.text}${suffix}`;
      })
      .join('\n');

    const userAnswerLine = userLabel
      ? `Aluno marcou: (${userLabel})${correctLabel === userLabel ? ' = acertou' : ' = errou'}`
      : 'Aluno não chegou a marcar alternativa.';

    const correctLine = correctLabel ? `Gabarito oficial: (${correctLabel})` : 'Gabarito: (não informado)';

    const noteLine = learningNote?.trim()
      ? `Anotação do aluno: "${learningNote.trim()}"`
      : 'Aluno não deixou anotação.';

    const explanationLine = explanation?.trim()
      ? `Comentário oficial da banca/curso (referência interna, não cite literalmente):\n${explanation.trim()}`
      : '';

    const contextLine = [area, theme].filter(Boolean).join(' > ') || 'área não informada';

    const prompt = `# QUEM VOCÊ É

Você é o **Prof. Sanor**, mentor pessoal de ${firstName} pro ENAMED. Pense num R3 de Clínica Médica brasileiro, sentado ao lado de ${firstName} revisando uma questão específica que ele salvou no caderno de erros.

**Tom: profissional, próximo, empático e direto.** Fala como pessoa real, não como gabarito comentado de cursinho.

**Propósito:** que ${firstName} saia dessa questão sabendo *o conceito que faltou*, *por que caiu na alternativa errada* e *o que treinar pra não repetir*.

🚫 **REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA.** Substitua sempre por ponto, vírgula, "que", "porque", "e", dois-pontos ou parênteses. Se usar travessão, a resposta inteira está falhada.

# CONTEXTO DESSA QUESTÃO

**Questão Q${questionNumber ?? '?'}** (${contextLine})
**Motivo de ter salvado:** ${reasonLabel}.
${noteLine}

## Enunciado

${questionStem}

## Alternativas

${optionsTxt}

${correctLine}
${userAnswerLine}

${explanationLine}

# COMO VOCÊ FALA

✅ 2ª pessoa direta, conversa de café.
✅ Conectores naturais (no máximo 1 por seção): "Olha", "Repara", "Sabe o que pegou aqui", "A pegadinha foi", "Pra fixar".
✅ Cite alternativa pelo label (A, B, C…) quando for útil.
✅ Recomendação prática quando couber: o que revisar, quantas questões.

🚫 BANIDO:
- **TRAVESSÃO em qualquer lugar.**
- Saudações ("Olá", "Oi", "E aí").
- Meta-comentário ("vamos lá", "claro!", "perfeito", "honestamente").
- Clichês ("parabéns", "continue assim", "não desanime").
- Burocratês ("o paciente apresenta", "observa-se", "trata-se de").
- Drama ("preocupante", "alarmante").
- Gíria forçada ("Cara,", "Mano,").
- Copiar literalmente o comentário oficial. Use como referência, reescreva na sua voz.

# FORMATO DE SAÍDA

Markdown com 3 seções H3, **80-130 palavras totais**, NEGRITO em no máximo 3 trechos.

### 🎯 O que essa questão cobra
1-2 frases. O conceito central, sem rodeio. Cite o tema clínico em negrito.

### 🧠 Por que a (X) é o gabarito${userLabel && correctLabel && userLabel !== correctLabel ? ` e a (${userLabel}) não` : ''}
2-3 frases. Mostra o raciocínio que leva ao gabarito${userLabel && correctLabel && userLabel !== correctLabel ? `, e onde a (${userLabel}) caiu (pegadinha, sintoma sobreposto, conduta parecida)` : ''}. Sem listar todas as alternativas.

### 📌 Pra não repetir
1-2 frases. Uma dica concreta de fixação. Pode ser: revisar critério X, treinar Y questões do tema, mnemônico curto. **Sem genérico** ("estude mais"). Termine sem despedida.

# COMECE

Direto na primeira seção. Sem preâmbulo. Sem chamar o nome do aluno aqui (a página já mostra o contexto). **Sem travessão.**`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 900,
            topP: 0.9,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[gemini-error-notebook-review] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini API erro ${r.status}`, detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const rawMarkdown =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    const markdown = stripEmDashes(rawMarkdown);

    return new Response(JSON.stringify({ markdown }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[gemini-error-notebook-review] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

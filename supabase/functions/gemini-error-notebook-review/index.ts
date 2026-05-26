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

Você vai retornar **JSON** com três campos: \`markdown\`, \`practice\` e \`optionRationales\`.

## Campo "markdown"

Markdown com 3 seções H3, **80-130 palavras totais**, NEGRITO em no máximo 3 trechos.

### 🎯 O que essa questão cobra
1-2 frases. O conceito central, sem rodeio. Cite o tema clínico em negrito.

### 🧠 Por que a (X) é o gabarito${userLabel && correctLabel && userLabel !== correctLabel ? ` e a (${userLabel}) não` : ''}
2-3 frases. Mostra o raciocínio que leva ao gabarito${userLabel && correctLabel && userLabel !== correctLabel ? `, e onde a (${userLabel}) caiu (pegadinha, sintoma sobreposto, conduta parecida)` : ''}. Sem listar todas as alternativas.

### 📌 Pra não repetir
1-2 frases. Uma dica concreta de fixação. Pode ser: revisar critério X, treinar Y questões do tema, mnemônico curto. **Sem genérico** ("estude mais"). Termine sem despedida.

## Campo "practice"

Objeto com sugestão concreta de prática:
- **topic**: nome curto do subtópico clínico específico pra treinar (ex.: "PrEP/PEP", "Sepse neonatal", "Bloqueios atrioventriculares"). Não repetir o tema genérico se houver subtópico mais preciso.
- **area**: a grande área (use exatamente "${area ?? ''}" se informada).
- **theme**: o tema (use exatamente "${theme ?? ''}" se informado).
- **suggestedCount**: número inteiro entre 3 e 10 de questões sugeridas. Default 5.

## Campo "optionRationales"

Objeto com chaves = labels das alternativas **incorretas** (não inclua o gabarito), valores = explicação curtíssima (uma frase, no máximo 18 palavras) de por que aquela alternativa está errada. Cobrir TODAS as alternativas incorretas listadas.

# REGRAS DE FORMATO JSON

- Saída **deve ser JSON válido**, sem markdown wrapping, sem comentários.
- Strings dentro do JSON também seguem a regra do travessão (**proibido**).
- O conteúdo do campo \`markdown\` é uma string com markdown dentro.

# COMECE

Retorne o JSON. Sem preâmbulo. Sem chamar o nome do aluno (a página já mostra o contexto). **Sem travessão em lugar nenhum.**`;

    const incorrectLabels = options
      .filter((o) => {
        if (correctLabel) return o.label !== correctLabel;
        return !o.isCorrect;
      })
      .map((o) => o.label);

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        markdown: { type: 'STRING' },
        practice: {
          type: 'OBJECT',
          properties: {
            topic: { type: 'STRING' },
            area: { type: 'STRING' },
            theme: { type: 'STRING' },
            suggestedCount: { type: 'INTEGER' },
          },
          required: ['topic', 'suggestedCount'],
        },
        optionRationales: {
          type: 'OBJECT',
          // Gemini não aceita additionalProperties em responseSchema; deixamos livre.
          properties: Object.fromEntries(
            incorrectLabels.map((label) => [label, { type: 'STRING' }]),
          ),
        },
      },
      required: ['markdown'],
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 1400,
            topP: 0.9,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema,
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
    const rawJson =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    let parsed: {
      markdown?: string;
      practice?: { topic?: string; area?: string; theme?: string; suggestedCount?: number };
      optionRationales?: Record<string, string>;
    } = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch (parseErr) {
      console.error('[gemini-error-notebook-review] JSON parse error', parseErr, rawJson.slice(0, 500));
      // Fallback: trata o texto inteiro como markdown.
      parsed = { markdown: rawJson };
    }

    const markdown = stripEmDashes(parsed.markdown ?? '');

    const practice = parsed.practice
      ? {
          topic: stripEmDashes(parsed.practice.topic ?? '').trim() || null,
          area: parsed.practice.area?.trim() || area || null,
          theme: parsed.practice.theme?.trim() || theme || null,
          suggestedCount: Math.min(10, Math.max(3, Math.round(parsed.practice.suggestedCount ?? 5))),
        }
      : null;

    const optionRationales: Record<string, string> | null = parsed.optionRationales
      ? Object.fromEntries(
          Object.entries(parsed.optionRationales)
            .filter(([k, v]) => typeof v === 'string' && incorrectLabels.includes(k))
            .map(([k, v]) => [k, stripEmDashes(v as string).trim()]),
        )
      : null;

    return new Response(
      JSON.stringify({
        markdown,
        practice,
        optionRationales: optionRationales && Object.keys(optionRationales).length > 0 ? optionRationales : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[gemini-error-notebook-review] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

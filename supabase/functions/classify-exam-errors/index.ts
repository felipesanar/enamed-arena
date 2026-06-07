const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Canonical DbReason values (source of truth: src/lib/errorNotebookReasons.ts)
// 'did_not_understand' is legacy — the AI never returns it.
type DbReason =
  | 'did_not_know'
  | 'did_not_remember'
  | 'reading_error'
  | 'confused_alternatives'
  | 'guessed_correctly';

const VALID_REASONS = new Set<string>([
  'did_not_know',
  'did_not_remember',
  'reading_error',
  'confused_alternatives',
  'guessed_correctly',
]);

interface ClassifyQuestionInput {
  questionId: string;
  questionNumber: number;
  questionStem: string;            // truncated to 600 chars by client
  options: {
    label: string;
    text: string;
  }[];
  correctOptionLabel: string;
  userOptionLabel: string | null;
  isCorrect: boolean;
  confidence: 'baixa' | 'media' | 'alta' | null;
  area: string;
  theme: string;
  explanation: string | null;      // truncated to 400 chars by client
}

interface ClassifyExamErrorsRequest {
  attemptId: string;
  questions: ClassifyQuestionInput[];
}

interface QuestionClassification {
  questionId: string;
  suggestedReason: DbReason;
  rationale: string;               // 1 sentence, max 20 words, no em-dashes
  aiCertainty: 'alta' | 'baixa';
}

interface ClassifyExamErrorsResponse {
  classifications: QuestionClassification[];
  partial: boolean;
}

/** Sanitizes em-dashes. Prof. Sanor never uses them. */
function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.[ \t]+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * Removes opening compliments / greetings / meta-comments that may escape the prompt.
 * Runs in a loop to cover stacked patterns.
 */
function stripOpeningCompliments(text: string): string {
  const patterns: RegExp[] = [
    /^\s*(?:essa\s+(?:é|e)\s+(?:uma|a)?\s*)?(?:excelente|ótima|otima|boa|interessante|pertinente|muito\s+boa|grande)\s+pergunta[\s!.,:;…]+/i,
    /^\s*pergunta\s+(?:excelente|ótima|otima|boa|interessante|pertinente)[\s!.,:;…]+/i,
    /^\s*(?:claro|perfeito|com\s+certeza|certamente|sem\s+dúvida|sem\s+duvida|honestamente|na\s+verdade|vamos\s+lá|vamos\s+la|deixa\s+eu\s+(?:te\s+)?explicar)[\s!.,:;…]+/i,
    /^\s*(?:olá|ola|oi|opa|e\s+aí|e\s+ai|fala)[\s!.,:;…]+/i,
  ];
  let out = text;
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const re of patterns) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  if (out.length > 0 && /^[a-záéíóúâêôãõç]/.test(out)) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

/** Builds the text block for a single question in the batch prompt. */
function buildQuestionBlock(q: ClassifyQuestionInput, idx: number): string {
  const optionsTxt = q.options
    .map((o) => {
      const tags: string[] = [];
      if (o.label === q.correctOptionLabel) tags.push('GABARITO');
      if (q.userOptionLabel && o.label === q.userOptionLabel && o.label !== q.correctOptionLabel)
        tags.push('MARCADA PELO ALUNO');
      const suffix = tags.length ? ` [${tags.join(', ')}]` : '';
      return `  (${o.label}) ${o.text}${suffix}`;
    })
    .join('\n');

  const resultLine = q.isCorrect ? 'Resultado: ACERTOU' : 'Resultado: ERROU';
  const userLine = q.userOptionLabel
    ? `Alternativa marcada: (${q.userOptionLabel})`
    : 'Alternativa marcada: em branco';
  const confidenceLine =
    q.confidence ? `Confiança declarada pelo aluno: ${q.confidence}` : 'Confiança declarada pelo aluno: não informada';
  const explanationLine = q.explanation?.trim()
    ? `Explicação oficial (referência interna): ${q.explanation.trim()}`
    : '';

  return `--- Questão ${idx + 1} (id: ${q.questionId}) ---
Área: ${q.area} | Tema: ${q.theme}
Q${q.questionNumber}: ${q.questionStem}

Alternativas:
${optionsTxt}

${resultLine}
${userLine}
${confidenceLine}
${explanationLine}`.trim();
}

/** Builds the full prompt for a batch of questions. */
function buildBatchPrompt(questions: ClassifyQuestionInput[]): string {
  const blocks = questions.map((q, i) => buildQuestionBlock(q, i)).join('\n\n');

  return `# QUEM VOCÊ É

Você é o **Prof. Sanor**, especialista em ensino médico para residência. Analise cada questão abaixo e classifique o motivo mais provável do comportamento do aluno.

🚫 **REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA.** Substitua sempre por ponto, vírgula, dois-pontos ou parênteses.

🚫 **NUNCA retorne o valor "did_not_understand"** — esse valor é legado e não deve aparecer nas classificações.

🚫 **Sem elogios, saudações, burocratês, clichês ou meta-comentários.** Comece direto pela análise.

# CRITÉRIOS DE CLASSIFICAÇÃO

Use exatamente um dos valores do enum abaixo para cada questão:

- **did_not_know**: aluno errou e não há sinal de que o conteúdo foi visto antes (resposta muito distante do gabarito, área especializada sem pista de confusão com alternativa plausível).
- **did_not_remember**: errou alternativa plausível mas incorreta no mesmo tema (confusão de detalhe, não de conceito central, ex: dose errada, critério equivocado dentro do mesmo diagnóstico).
- **reading_error**: errou questão simples onde a alternativa correta e a errada diferem por uma palavra-chave óbvia no enunciado ("EXCETO", "mais comum", doses específicas, negação).
- **confused_alternatives**: errou entre duas alternativas do mesmo espectro diagnóstico ou terapêutico (ex: dois betabloqueadores, dois diuréticos, dois diagnósticos sindrômicos, dois antibióticos da mesma classe).
- **guessed_correctly**: acertou com confiança declarada "baixa", ou acertou questão objetivamente difícil sem padrão de conhecimento aparente.

Para aiCertainty: use "alta" se a classificação for clara e inequívoca; use "baixa" se houver ambiguidade entre dois motivos plausíveis.

O rationale deve ser uma frase objetiva, máximo 20 palavras, sem travessão.

# QUESTÕES PARA CLASSIFICAR

${blocks}

# FORMATO DE SAÍDA

Retorne JSON com a chave "classifications" contendo um array com uma entrada por questão, na mesma ordem recebida. Cada entrada deve ter:
- questionId (string — copie exatamente o id fornecido)
- suggestedReason (string — exatamente um dos 5 valores do enum acima)
- rationale (string — 1 frase, máx 20 palavras, sem travessão)
- aiCertainty (string — "alta" ou "baixa")

Sem preâmbulo. Sem texto fora do JSON.`;
}

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    classifications: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          questionId: { type: 'STRING' },
          suggestedReason: { type: 'STRING' },
          rationale: { type: 'STRING' },
          aiCertainty: { type: 'STRING' },
        },
        required: ['questionId', 'suggestedReason', 'rationale', 'aiCertainty'],
      },
    },
  },
  required: ['classifications'],
};

/**
 * Calls Gemini for a batch of up to 15 questions.
 * Returns raw parsed JSON or throws on timeout / non-2xx.
 */
async function classifyBatch(
  questions: ClassifyQuestionInput[],
  apiKey: string,
): Promise<{ classifications: QuestionClassification[] }> {
  const prompt = buildBatchPrompt(questions);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let r: Response;
  try {
    r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
      },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!r.ok) {
    const txt = await r.text();
    console.error('[classify-exam-errors] Gemini error', r.status, txt.slice(0, 500));
    const err = new Error(`Gemini API error ${r.status}`);
    (err as Error & { status: number }).status = r.status;
    throw err;
  }

  const data = await r.json();
  const rawJson =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

  let parsed: { classifications?: unknown[] } = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    // Try to extract JSON object from the text using regex
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        console.error('[classify-exam-errors] JSON parse failed even with regex', rawJson.slice(0, 300));
      }
    }
  }

  const rawClassifications = Array.isArray(parsed?.classifications) ? parsed.classifications : [];

  // Sanitize and validate each classification
  const classifications: QuestionClassification[] = rawClassifications
    .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object')
    .map((c) => {
      const reason = (c.suggestedReason as string) ?? '';
      const certainty = (c.aiCertainty as string) ?? '';
      return {
        questionId: String(c.questionId ?? ''),
        suggestedReason: VALID_REASONS.has(reason) ? (reason as DbReason) : 'did_not_know',
        rationale: stripOpeningCompliments(stripEmDashes(String(c.rationale ?? ''))).slice(0, 200),
        aiCertainty: certainty === 'alta' ? 'alta' : 'baixa',
      };
    })
    .filter((c) => c.questionId !== '');

  return { classifications };
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

    // Auth is validated automatically by Supabase gateway (JWT required).
    // We do not pass any PII to Gemini — no user name, no user ID.

    let body: ClassifyExamErrorsRequest;
    try {
      body = (await req.json()) as ClassifyExamErrorsRequest;
    } catch {
      return new Response(JSON.stringify({ error: 'Request body inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { attemptId, questions } = body;

    if (!attemptId || !Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'attemptId e questions[] são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const BATCH_SIZE = 15;

    // Split into batches of 15 (spec §4.2)
    const batches: ClassifyQuestionInput[][] = [];
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      batches.push(questions.slice(i, i + BATCH_SIZE));
    }

    const allClassifications: QuestionClassification[] = [];
    let partial = false;

    for (const batch of batches) {
      try {
        const result = await classifyBatch(batch, apiKey);
        allClassifications.push(...result.classifications);

        // If the batch returned fewer classifications than questions sent, mark partial
        if (result.classifications.length < batch.length) {
          partial = true;
        }
      } catch (err) {
        console.error('[classify-exam-errors] batch failed', err);
        partial = true;

        // Rate limit from Gemini — propagate 429 so the client can display fallback
        const status = (err as Error & { status?: number }).status;
        if (status === 429) {
          return new Response(
            JSON.stringify({ error: 'Limite de requisições atingido', partial: true }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // AbortError = timeout — break and return what we have
        if (err instanceof Error && err.name === 'AbortError') {
          console.error('[classify-exam-errors] Gemini timeout (25s)');
          break;
        }

        // For any other error in a mid-sequence batch, stop and return partial
        break;
      }
    }

    const response: ClassifyExamErrorsResponse = {
      classifications: allClassifications,
      partial,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[classify-exam-errors] unhandled error', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'unknown',
        partial: true,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

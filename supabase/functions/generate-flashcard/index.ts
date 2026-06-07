import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OptionPayload {
  label: string;
  text: string;
}

interface GenerateFlashcardRequest {
  questionStem: string;
  options?: OptionPayload[];
  correctOptionLabel?: string | null;
  area?: string | null;
  theme?: string | null;
  /** Cached Prof. San micro-analysis markdown (ai_review_md from error_notebook). */
  aiReviewMd?: string | null;
  /** Student's personal learning note (learning_text from error_notebook). */
  learningNote?: string | null;
}

interface FlashcardOutput {
  front_md: string;               // <= 500 chars, active-recall question
  back_md: string;                // <= 1200 chars, concise answer + retention pearl
  suggestion_rationale?: string;  // why this framing was chosen
}

/** Sanitizes em-dashes from any text. Prof. Sanor never uses them. */
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
    /^\s*(?:essa\s+(?:é|e)\s+(?:uma|a)?\s*)?(?:excelente|ótima|otima|boa|interessante|pertinente|muito\s+boa|grande)\s+(?:pergunta|questão|questao)[\s!.,:;…]+/i,
    /^\s*(?:questão|questao|pergunta)\s+(?:excelente|ótima|otima|boa|interessante|pertinente)[\s!.,:;…]+/i,
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

/** Truncates a string to maxLen chars, appending ellipsis if truncated. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // ── Auth check ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Supabase env vars não configuradas' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── API key ──────────────────────────────────────────────────────────────
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse + validate input ───────────────────────────────────────────────
    const body = (await req.json()) as GenerateFlashcardRequest;
    const {
      questionStem,
      options = [],
      correctOptionLabel,
      area,
      theme,
      aiReviewMd,
      learningNote,
    } = body;

    if (!questionStem?.trim()) {
      return new Response(JSON.stringify({ error: 'questionStem é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Build prompt context blocks ──────────────────────────────────────────
    const contextLine = [area, theme].filter(Boolean).join(' > ') || 'área não informada';

    const optionsTxt = options.length > 0
      ? options
          .map((o) => {
            const isCorrect = correctOptionLabel && o.label === correctOptionLabel;
            const suffix = isCorrect ? ' [GABARITO]' : '';
            return `(${o.label}) ${o.text}${suffix}`;
          })
          .join('\n')
      : null;

    const correctLine = correctOptionLabel
      ? `Gabarito: (${correctOptionLabel})`
      : null;

    // Truncate longer context to keep prompt manageable
    const stemForPrompt = truncate(questionStem.trim(), 800);
    const reviewBlock = aiReviewMd?.trim()
      ? `\n## Análise prévia do Prof. Sanor sobre esta questão\n${truncate(aiReviewMd.trim(), 600)}`
      : '';
    const noteBlock = learningNote?.trim()
      ? `\nAnotação pessoal do aluno: "${truncate(learningNote.trim(), 200)}"`
      : '';

    const prompt = `# QUEM VOCÊ É

Você é o **Prof. Sanor**, criando um flashcard de **active recall** para que o aluno fixe o conceito central desta questão do caderno de erros.

**Objetivo do flashcard:** o aluno vai ver a FRENTE, pensar a resposta de cabeça, e só então virar o card para conferir.

🚫 **REGRA ABSOLUTA: NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA.** Substitua sempre por ponto, vírgula, "que", "porque", "e", dois-pontos ou parênteses.
🚫 Sem elogios, sem saudações, sem meta-comentários, sem clichês.
🚫 Sem copiar o enunciado inteiro na frente.
🚫 Sem linguagem de gabarito comentado de cursinho.

# CONTEXTO DA QUESTÃO

**Área/Tema:** ${contextLine}
${correctLine ? correctLine + '\n' : ''}
## Enunciado
${stemForPrompt}
${optionsTxt ? '\n## Alternativas\n' + optionsTxt : ''}${reviewBlock}${noteBlock}

# REGRAS DO FLASHCARD

## FRENTE (front_md) — até 500 caracteres

- Deve ser uma **pergunta objetiva de active recall**, não uma cópia do enunciado.
- Foque no **conceito que a questão cobra** (critério diagnóstico, conduta, diferencial, dose, mecanismo), não no cenário clínico específico.
- Use linguagem direta, sem rodeios. Pode incluir um dado-âncora do caso quando for essencial para o recall (ex.: "paciente pós-IAM em uso de betabloqueador").
- Exemplo de bom front_md: "Qual o tratamento de primeira linha da IC com FE reduzida em paciente já em betabloqueador otimizado?"
- Exemplo de front_md RUIM: "No caso do paciente de 65 anos com dispneia aos pequenos esforços e fração de ejeção de 35%, com piora apesar de…" (copiou o enunciado).

## VERSO (back_md) — até 1200 caracteres

- Comece diretamente com a **resposta concisa** (1-3 frases), sem rodeios.
- Inclua **1 pérola de fixação** marcada com "**Pérola:**" — uma regra mnemônica, âncora clínica ou fato concreto que gruda o conceito. Exemplos: "Pérola: IECA + betabloqueador + espironolactona = trio obrigatório na IC com FE < 40% (SBC 2021, Classe I)." ou "Pérola: CURB-65 >= 2 = internação. Confusão + Ureia > 50 + FR >= 30 + PA < 90/60 + idade >= 65."
- Se houver diferencial relevante (o que pegou o aluno), adicione em 1 frase.
- Markdown simples: negrito para termos-chave, listas quando houver 3+ itens paralelos.
- Tom: Prof. Sanor, PT-BR, direto, sem travessão, sem elogio, sem despedida.

## suggestion_rationale — 1 frase opcional

Por que você enquadrou a frente dessa forma (ex.: "Questão cobra o critério de internação do CURB-65, ponto frequente de confusão com PORT/PSI").

# FORMATO DE SAÍDA

JSON válido com três campos: \`front_md\`, \`back_md\`, \`suggestion_rationale\`.
Sem markdown wrapping. Sem comentários. Strings seguem a regra do travessão (proibido).

Retorne o JSON. Sem preâmbulo.`;

    // ── Gemini request with 25s timeout ─────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        front_md: { type: 'STRING' },
        back_md: { type: 'STRING' },
        suggestion_rationale: { type: 'STRING' },
      },
      required: ['front_md', 'back_md'],
    };

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 900,
              topP: 0.9,
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
        },
      );
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      console.error('[generate-flashcard] Gemini fetch error', isTimeout ? 'timeout' : fetchErr);
      return new Response(
        JSON.stringify({ error: isTimeout ? 'Tempo limite da IA excedido (25s)' : 'Erro ao conectar com a IA' }),
        {
          status: isTimeout ? 504 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    clearTimeout(timeoutId);

    // Propagate 429 (rate limit) directly to the client
    if (geminiResponse.status === 429) {
      const txt = await geminiResponse.text();
      console.warn('[generate-flashcard] Gemini 429 rate limit', txt.slice(0, 200));
      return new Response(
        JSON.stringify({ error: 'Limite de requisições da IA atingido. Tente novamente em alguns segundos.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '10' },
        },
      );
    }

    if (!geminiResponse.ok) {
      const txt = await geminiResponse.text();
      console.error('[generate-flashcard] Gemini error', geminiResponse.status, txt.slice(0, 300));
      return new Response(
        JSON.stringify({ error: `Gemini API erro ${geminiResponse.status}`, detail: txt.slice(0, 200) }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // ── Parse Gemini response ─────────────────────────────────────────────────
    const data = await geminiResponse.json();
    const rawJson =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';

    let parsed: { front_md?: string; back_md?: string; suggestion_rationale?: string } = {};
    try {
      parsed = JSON.parse(rawJson);
    } catch (parseErr) {
      console.error('[generate-flashcard] JSON parse error', parseErr, rawJson.slice(0, 300));
      return new Response(
        JSON.stringify({ error: 'Resposta da IA em formato inválido. Tente novamente.' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!parsed.front_md || !parsed.back_md) {
      console.error('[generate-flashcard] Missing required fields', Object.keys(parsed));
      return new Response(
        JSON.stringify({ error: 'IA não retornou frente/verso válidos. Tente novamente.' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // ── Sanitize + enforce character limits ──────────────────────────────────
    const frontMd = truncate(
      stripOpeningCompliments(stripEmDashes(parsed.front_md.trim())),
      500,
    );
    const backMd = truncate(
      stripEmDashes(parsed.back_md.trim()),
      1200,
    );
    const suggestionRationale = parsed.suggestion_rationale?.trim()
      ? stripEmDashes(parsed.suggestion_rationale.trim())
      : undefined;

    const output: FlashcardOutput = {
      front_md: frontMd,
      back_md: backMd,
      ...(suggestionRationale ? { suggestion_rationale: suggestionRationale } : {}),
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-flashcard] Unexpected error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildRefMap,
  mapParsedCards,
  parseCardsLenient,
  questionRef,
  truncate,
  type SourceRef,
} from './cardMapping.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_TOPIC_COUNT = 15;
const MAX_QUESTIONS = 20;

interface OptionPayload { label: string; text: string }

interface BatchQuestion {
  sourceRef?: SourceRef;
  questionStem: string;
  options?: OptionPayload[];
  correctOptionLabel?: string | null;
  area?: string | null;
  theme?: string | null;
  aiReviewMd?: string | null;
  learningNote?: string | null;
}

interface BatchRequest {
  mode: 'topic' | 'questions' | 'text';
  count?: number;
  area?: string | null;
  theme?: string | null;
  rawText?: string;
  questions?: BatchQuestion[];
}

function clampCount(n: number | undefined, max: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 10;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

const RULES_BLOCK = `# REGRAS DE CADA FLASHCARD

🚫 NÃO USE TRAVESSÃO (— ou –) EM HIPÓTESE NENHUMA. Use ponto, vírgula, "que", "porque", "e", dois-pontos ou parênteses.
🚫 Sem elogios, sem saudações, sem meta-comentários.
🚫 Não copie o enunciado inteiro na frente.

## FRENTE (front_md) — até 500 caracteres
- Pergunta objetiva de active recall focada no CONCEITO (critério, conduta, diferencial, dose, mecanismo).
- Linguagem direta. Pode incluir uma âncora clínica essencial.

## VERSO (back_md) — até 1200 caracteres
- Comece pela resposta concisa (1-3 frases).
- Inclua 1 "**Pérola:**" de fixação (mnemônico, âncora ou fato concreto).
- Markdown simples; negrito em termos-chave. Tom Prof. Sanor, PT-BR, sem travessão.`;

function buildTopicPrompt(area: string | null | undefined, theme: string | null | undefined, count: number): string {
  const ctx = [area, theme].filter(Boolean).join(' > ') || 'tema livre';
  return `# QUEM VOCÊ É
Você é o **Prof. Sanor**. Gere **${count} flashcards** de active recall distintos sobre o tema abaixo, cobrindo os pontos mais cobrados em provas de residência. Não repita o mesmo conceito.

**Tema:** ${ctx}

${RULES_BLOCK}

# FORMATO DE SAÍDA
Array JSON com exatamente ${count} objetos, cada um com os campos \`front_md\` e \`back_md\`. Sem texto fora do JSON.`;
}

function buildTextPrompt(rawText: string, count: number): string {
  return `# QUEM VOCÊ É
Você é o **Prof. Sanor**. A partir do material de estudo abaixo, gere até **${count} flashcards** de active recall cobrindo os conceitos mais importantes. Um conceito por card, sem repetir.

# MATERIAL
${truncate(rawText.trim(), 4000)}

${RULES_BLOCK}

# FORMATO DE SAÍDA
Array JSON com no máximo ${count} objetos, cada um com \`front_md\` e \`back_md\`. Sem texto fora do JSON.`;
}

function buildQuestionsPrompt(questions: BatchQuestion[]): string {
  const blocks = questions
    .map((q, i) => {
      const ctx = [q.area, q.theme].filter(Boolean).join(' > ') || 'área não informada';
      const opts = (q.options ?? [])
        .map((o) => `(${o.label}) ${o.text}${q.correctOptionLabel && o.label === q.correctOptionLabel ? ' [GABARITO]' : ''}`)
        .join('\n');
      const review = q.aiReviewMd?.trim() ? `\nAnálise prévia: ${truncate(q.aiReviewMd.trim(), 400)}` : '';
      const note = q.learningNote?.trim() ? `\nNota do aluno: "${truncate(q.learningNote.trim(), 200)}"` : '';
      return `### Questão ref=${questionRef(i)} (${ctx})
Enunciado: ${truncate(q.questionStem.trim(), 500)}${opts ? '\nAlternativas:\n' + opts : ''}${review}${note}`;
    })
    .join('\n\n');

  return `# QUEM VOCÊ É
Você é o **Prof. Sanor**. Para CADA questão abaixo, gere **exatamente 1 flashcard** de active recall que fixe o conceito central daquela questão. Devolva o \`ref\` EXATO da questão correspondente (ex.: "q0", "q1"), copiado do título de cada questão.

# QUESTÕES
${blocks}

${RULES_BLOCK}

# FORMATO DE SAÍDA
Array JSON com um objeto por questão, cada um com \`ref\` (o identificador da questão, ex.: "q0"), \`front_md\` e \`back_md\`. Um card por questão. O \`ref\` é obrigatório e deve casar exatamente com o da questão. Sem texto fora do JSON.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header ausente' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Supabase env vars não configuradas' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as BatchRequest;
    const mode = body.mode;

    let prompt: string;
    let questionsForMap: BatchQuestion[] = [];

    if (mode === 'topic') {
      const count = clampCount(body.count, MAX_TOPIC_COUNT);
      if (!body.area?.trim() && !body.theme?.trim()) {
        return new Response(JSON.stringify({ error: 'Informe área ou tema' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      prompt = buildTopicPrompt(body.area, body.theme, count);
    } else if (mode === 'text') {
      const count = clampCount(body.count, MAX_TOPIC_COUNT);
      if (!body.rawText?.trim()) {
        return new Response(JSON.stringify({ error: 'rawText é obrigatório no modo text' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      prompt = buildTextPrompt(body.rawText, count);
    } else if (mode === 'questions') {
      questionsForMap = (body.questions ?? []).filter((q) => q.questionStem?.trim()).slice(0, MAX_QUESTIONS);
      if (questionsForMap.length === 0) {
        return new Response(JSON.stringify({ error: 'Nenhuma questão válida fornecida' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      prompt = buildQuestionsPrompt(questionsForMap);
    } else {
      return new Response(JSON.stringify({ error: 'mode inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No modo `questions` o `ref` é OBRIGATÓRIO: é o que liga o card à questão de
    // origem. Sem ele no schema, a IA pode omiti-lo e gerar cards órfãos.
    const responseSchema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          ...(mode === 'questions' ? { ref: { type: 'STRING' } } : {}),
          front_md: { type: 'STRING' },
          back_md: { type: 'STRING' },
        },
        required: mode === 'questions' ? ['ref', 'front_md', 'back_md'] : ['front_md', 'back_md'],
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

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
              temperature: 0.6,
              // Headroom para lotes grandes (até 20 questões × ~1700 chars).
              // Se ainda assim estourar, o parse tolerante recupera os cards
              // completos e a resposta sai marcada como `partial`.
              maxOutputTokens: 16384,
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
      console.error('[generate-flashcards-batch] Gemini fetch error', isTimeout ? 'timeout' : fetchErr);
      return new Response(
        JSON.stringify({ error: isTimeout ? 'Tempo limite da IA excedido (25s). Tente um lote menor.' : 'Erro ao conectar com a IA' }),
        { status: isTimeout ? 504 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    clearTimeout(timeoutId);

    if (geminiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Limite de requisições da IA atingido. Tente novamente em alguns segundos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '10' } },
      );
    }
    if (!geminiResponse.ok) {
      const txt = await geminiResponse.text();
      console.error('[generate-flashcards-batch] Gemini error', geminiResponse.status, txt.slice(0, 300));
      return new Response(
        JSON.stringify({ error: `Gemini API erro ${geminiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await geminiResponse.json();
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const rawJson = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    // Lote grande pode estourar `maxOutputTokens` (finishReason MAX_TOKENS) e
    // devolver JSON truncado. O parse tolerante recupera os objetos completos já
    // presentes em vez de perder o lote inteiro num `JSON.parse` que estoura.
    const { cards: parsed, partial: parseTruncated } = parseCardsLenient(rawJson);
    const truncated = finishReason === 'MAX_TOKENS' || parseTruncated;
    if (truncated) {
      console.warn(
        `[generate-flashcards-batch] resposta truncada (finishReason=${finishReason}); ${parsed.length} card(s) recuperado(s)`,
      );
    }

    // Resolve o vínculo card -> questão por token estável (`ref`), validando
    // existência. Vínculo perdido não derruba o card, mas é logado.
    const refMap = buildRefMap(questionsForMap);
    const { cards, unlinked, orphanRefs } = mapParsedCards(parsed, mode, refMap);
    if (mode === 'questions' && unlinked > 0) {
      console.warn(
        `[generate-flashcards-batch] ${unlinked}/${cards.length} card(s) sem vínculo de origem`,
        'refs órfãs:', orphanRefs.slice(0, 10),
      );
    }

    if (cards.length === 0) {
      // Truncou já no 1º card: nada a recuperar. Devolve erro acionável (reduza
      // o lote) em vez de um 502 genérico de "formato inválido".
      const message = truncated
        ? 'O lote ficou grande demais para a IA e nada pôde ser recuperado. Reduza a quantidade e tente de novo.'
        : 'A IA não retornou flashcards válidos. Tente novamente.';
      return new Response(
        JSON.stringify({ error: message, truncated }),
        { status: truncated ? 422 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // `partial` avisa o cliente que parte do lote foi perdida no truncamento, para
    // exibir um aviso ("lote parcial") em vez de dar tudo por certo.
    return new Response(JSON.stringify({ cards, partial: truncated }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-flashcards-batch] Unexpected error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

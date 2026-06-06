# Criar flashcards em lote com Prof. San — Fase 1 (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir gerar vários flashcards de uma vez com o Prof. San, a partir de um tema/área ou de questões do Caderno de Erros, salvando direto num deck.

**Architecture:** Uma Edge Function de lote (`generate-flashcards-batch`) com 3 primitivas (`topic`, `questions`, `text`) — Fase 1 usa `topic` e `questions`. A UI é um wizard (`BulkGenerateModal`) com pickers de fonte que normalizam o input para um `BatchGenerateInput` (helpers puros em `src/lib/bulkFlashcards.ts`). O lote é salvo via insert multi-linha (`createFlashcardsBulk`) seguindo o padrão de insert direto já usado em `createFlashcard`. A curadoria acontece na revisão, com uma ação "Remover / não gostei".

**Tech Stack:** React 18 + TS, TanStack Query, shadcn/ui, Framer Motion, Supabase (Edge Functions Deno + Postgres RLS), Gemini 2.5 Flash, Vitest.

**Worktree:** `C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/busy-swirles-62271e` (branch `claude/busy-swirles-62271e`). Todos os caminhos abaixo são relativos a este worktree.

---

## Estrutura de arquivos

**Criar:**
- `src/lib/bulkFlashcards.ts` — tipos (`BatchMode`, `BatchQuestionInput`, `BatchGenerateInput`, `GeneratedCard`) + helpers puros (caps, nome de deck sugerido, mapeamento cards→payloads, normalização de entradas do caderno).
- `src/lib/bulkFlashcards.test.ts` — testes unitários dos helpers.
- `supabase/functions/generate-flashcards-batch/index.ts` — Edge Function de lote.
- `src/components/caderno/flashcards/BulkGenerateModal.tsx` — wizard orquestrador.
- `src/components/caderno/flashcards/bulk/TopicSourceForm.tsx` — fonte "Tema/área".
- `src/components/caderno/flashcards/bulk/CadernoSourcePicker.tsx` — fonte "Caderno de erros".
- `src/components/caderno/flashcards/bulk/DeckTargetSelect.tsx` — escolher/criar deck de destino.

**Modificar:**
- `src/services/simuladosApi.ts` — adicionar `generateFlashcardsBatch` e `createFlashcardsBulk`.
- `src/pages/CadernoFlashcardsPage.tsx` — botão "Gerar em lote" + montar `BulkGenerateModal` + invalidar queries no sucesso.
- `src/components/caderno/flashcards/FlashcardReviewSession.tsx` — ação "Remover / não gostei".

---

## Task 1: Helpers puros + tipos (`src/lib/bulkFlashcards.ts`)

**Files:**
- Create: `src/lib/bulkFlashcards.ts`
- Test: `src/lib/bulkFlashcards.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/bulkFlashcards.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  clampCount,
  MAX_TOPIC_COUNT,
  MAX_QUESTIONS,
  suggestDeckName,
  mapGeneratedCardsToPayloads,
  buildCadernoQuestionsInput,
  type GeneratedCard,
} from './bulkFlashcards';

describe('clampCount', () => {
  it('mantém valores dentro do range', () => {
    expect(clampCount(10, MAX_TOPIC_COUNT)).toBe(10);
  });
  it('clampa abaixo de 1 para 1', () => {
    expect(clampCount(0, MAX_TOPIC_COUNT)).toBe(1);
    expect(clampCount(-5, MAX_TOPIC_COUNT)).toBe(1);
  });
  it('clampa acima do máximo', () => {
    expect(clampCount(99, MAX_TOPIC_COUNT)).toBe(MAX_TOPIC_COUNT);
    expect(clampCount(99, MAX_QUESTIONS)).toBe(MAX_QUESTIONS);
  });
  it('trata NaN/undefined como 1', () => {
    expect(clampCount(NaN, MAX_TOPIC_COUNT)).toBe(1);
    expect(clampCount(undefined as unknown as number, MAX_TOPIC_COUNT)).toBe(1);
  });
});

describe('suggestDeckName', () => {
  it('usa o tema no modo topic', () => {
    expect(suggestDeckName({ mode: 'topic', area: 'Cardiologia', theme: 'Insuficiência Cardíaca', count: 10 }))
      .toBe('Insuficiência Cardíaca');
  });
  it('cai para a área quando não há tema', () => {
    expect(suggestDeckName({ mode: 'topic', area: 'Cardiologia', count: 10 }))
      .toBe('Cardiologia');
  });
  it('nomeia o lote do caderno pela área quando uniforme', () => {
    expect(suggestDeckName({
      mode: 'questions',
      questions: [
        { sourceRef: { entryId: 'a' }, questionStem: 'x', area: 'Pediatria' },
        { sourceRef: { entryId: 'b' }, questionStem: 'y', area: 'Pediatria' },
      ],
    })).toBe('Pediatria — erros');
  });
  it('usa rótulo genérico para caderno com áreas mistas', () => {
    expect(suggestDeckName({
      mode: 'questions',
      questions: [
        { sourceRef: { entryId: 'a' }, questionStem: 'x', area: 'Pediatria' },
        { sourceRef: { entryId: 'b' }, questionStem: 'y', area: 'Cardiologia' },
      ],
    })).toBe('Caderno de erros');
  });
  it('tem fallback final', () => {
    expect(suggestDeckName({ mode: 'topic', count: 10 })).toBe('Flashcards');
  });
});

describe('mapGeneratedCardsToPayloads', () => {
  const cards: GeneratedCard[] = [
    { front_md: 'P1', back_md: 'R1', sourceRef: { entryId: 'e1', questionId: 'q1' } },
    { front_md: 'P2', back_md: 'R2' },
  ];
  it('mapeia front/back e deck_id', () => {
    const out = mapGeneratedCardsToPayloads(cards, 'deck-9');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ deck_id: 'deck-9', front_md: 'P1', back_md: 'R1' });
  });
  it('propaga sourceRef para entry_id/question_id', () => {
    const out = mapGeneratedCardsToPayloads(cards, 'deck-9');
    expect(out[0].entry_id).toBe('e1');
    expect(out[0].question_id).toBe('q1');
    expect(out[1].entry_id).toBeNull();
    expect(out[1].question_id).toBeNull();
  });
  it('descarta cards sem frente e sem verso', () => {
    const out = mapGeneratedCardsToPayloads(
      [{ front_md: '  ', back_md: '' }, { front_md: 'ok', back_md: 'ok' }],
      'd',
    );
    expect(out).toHaveLength(1);
  });
});

describe('buildCadernoQuestionsInput', () => {
  const rows = [
    { id: 'e1', question_id: 'q1', question_text: 'Enunciado 1', area: 'Cardio', theme: 'IC', ai_review_md: 'rev1', learning_text: 'nota1' },
    { id: 'e2', question_id: null, question_text: 'Enunciado 2', area: null, theme: null, ai_review_md: null, learning_text: null },
    { id: 'e3', question_id: 'q3', question_text: '', area: 'X', theme: 'Y', ai_review_md: null, learning_text: null },
  ];
  it('inclui só as entradas selecionadas com enunciado não-vazio', () => {
    const input = buildCadernoQuestionsInput(rows, new Set(['e1', 'e2', 'e3']));
    // e3 tem enunciado vazio → descartado
    expect(input.mode).toBe('questions');
    expect(input.questions).toHaveLength(2);
    expect(input.questions!.map((q) => q.sourceRef.entryId)).toEqual(['e1', 'e2']);
  });
  it('mapeia contexto e sourceRef corretamente', () => {
    const input = buildCadernoQuestionsInput(rows, new Set(['e1']));
    expect(input.questions![0]).toMatchObject({
      sourceRef: { entryId: 'e1', questionId: 'q1' },
      questionStem: 'Enunciado 1',
      area: 'Cardio',
      theme: 'IC',
      aiReviewMd: 'rev1',
      learningNote: 'nota1',
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -- src/lib/bulkFlashcards.test.ts`
Expected: FAIL — "Failed to resolve import './bulkFlashcards'" / funções indefinidas.

- [ ] **Step 3: Implementar os helpers**

Create `src/lib/bulkFlashcards.ts`:

```typescript
/**
 * Helpers puros para a geração de flashcards em lote com o Prof. San.
 *
 * Mantém toda a lógica testável (caps, nome de deck, mapeamento) fora dos
 * componentes React e do service, que apenas orquestram I/O.
 *
 * Contrato de I/O com a Edge Function `generate-flashcards-batch`:
 * entrada = BatchGenerateInput, saída = { cards: GeneratedCard[] }.
 */

import type { CreateFlashcardPayload } from '@/types/caderno';

/** Modos de geração suportados pela Edge Function de lote. */
export type BatchMode = 'topic' | 'questions' | 'text';

/** Caps para caber numa única chamada Gemini (~25s). */
export const MAX_TOPIC_COUNT = 15;
export const MAX_QUESTIONS = 20;
export const DEFAULT_COUNT = 10;

/** Uma questão-fonte para o modo `questions` (1 card por questão). */
export interface BatchQuestionInput {
  sourceRef: { entryId?: string; questionId?: string };
  questionStem: string;
  options?: { label: string; text: string }[];
  correctOptionLabel?: string | null;
  area?: string | null;
  theme?: string | null;
  aiReviewMd?: string | null;
  learningNote?: string | null;
}

/** Payload normalizado enviado à Edge Function. */
export interface BatchGenerateInput {
  mode: BatchMode;
  count?: number;
  area?: string | null;
  theme?: string | null;
  rawText?: string;
  questions?: BatchQuestionInput[];
}

/** Card gerado pela IA (eco do sourceRef no modo `questions`). */
export interface GeneratedCard {
  front_md: string;
  back_md: string;
  sourceRef?: { entryId?: string; questionId?: string };
}

/** Linha crua de error_notebook usada pelo picker do Caderno. */
export interface CadernoRow {
  id: string;
  question_id: string | null;
  question_text: string | null;
  area: string | null;
  theme: string | null;
  ai_review_md?: string | null;
  learning_text?: string | null;
}

/** Clampa `n` em [1, max]. NaN/undefined viram 1. */
export function clampCount(n: number, max: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 1;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

/** Nome de deck sugerido a partir do input do lote. */
export function suggestDeckName(input: BatchGenerateInput): string {
  if (input.mode === 'topic') {
    return (input.theme?.trim() || input.area?.trim() || 'Flashcards');
  }
  if (input.mode === 'text') {
    return 'Resumo';
  }
  // questions: usa a área se for uniforme, senão rótulo genérico.
  const areas = new Set(
    (input.questions ?? [])
      .map((q) => q.area?.trim())
      .filter((a): a is string => !!a),
  );
  if (areas.size === 1) {
    return `${[...areas][0]} — erros`;
  }
  return 'Caderno de erros';
}

/** Converte cards gerados em payloads de insert, descartando vazios. */
export function mapGeneratedCardsToPayloads(
  cards: GeneratedCard[],
  deckId: string,
): CreateFlashcardPayload[] {
  return cards
    .filter((c) => (c.front_md?.trim() || c.back_md?.trim()))
    .map((c) => ({
      deck_id: deckId,
      front_md: c.front_md ?? '',
      back_md: c.back_md ?? '',
      entry_id: c.sourceRef?.entryId ?? null,
      question_id: c.sourceRef?.questionId ?? null,
    }));
}

/** Normaliza linhas selecionadas do caderno num BatchGenerateInput modo `questions`. */
export function buildCadernoQuestionsInput(
  rows: CadernoRow[],
  selectedIds: Set<string>,
): BatchGenerateInput {
  const questions: BatchQuestionInput[] = rows
    .filter((r) => selectedIds.has(r.id))
    .filter((r) => !!r.question_text?.trim())
    .map((r) => ({
      sourceRef: { entryId: r.id, questionId: r.question_id ?? undefined },
      questionStem: r.question_text!.trim(),
      area: r.area,
      theme: r.theme,
      aiReviewMd: r.ai_review_md ?? null,
      learningNote: r.learning_text ?? null,
    }));
  return { mode: 'questions', questions };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -- src/lib/bulkFlashcards.test.ts`
Expected: PASS (todos os describes verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bulkFlashcards.ts src/lib/bulkFlashcards.test.ts
git commit -m "feat(flashcards): helpers puros de geração em lote + testes"
```

---

## Task 2: Edge Function `generate-flashcards-batch`

**Files:**
- Create: `supabase/functions/generate-flashcards-batch/index.ts`

Clone adaptado de `supabase/functions/generate-flashcard/index.ts`: mesma auth, mesma sanitização (`stripEmDashes`, `stripOpeningCompliments`, `truncate`), mesmo modelo `gemini-2.5-flash`. Diferenças: aceita `mode`, retorna `{ cards: [...] }`, `responseSchema` é ARRAY, `maxOutputTokens` maior.

- [ ] **Step 1: Criar a Edge Function**

Create `supabase/functions/generate-flashcards-batch/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_TOPIC_COUNT = 15;
const MAX_QUESTIONS = 20;

interface OptionPayload { label: string; text: string }
interface SourceRef { entryId?: string; questionId?: string }

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

interface GeneratedCard { front_md: string; back_md: string; sourceRef?: SourceRef }

/** Sanitizes em-dashes from any text. Prof. Sanor never uses them. */
function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, '. ')
    .replace(/[—–]/g, ',')
    .replace(/\.[ \t]+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
}

function stripOpeningCompliments(text: string): string {
  const patterns: RegExp[] = [
    /^\s*(?:essa\s+(?:é|e)\s+(?:uma|a)?\s*)?(?:excelente|ótima|otima|boa|interessante|pertinente|muito\s+boa|grande)\s+(?:pergunta|questão|questao)[\s!.,:;…]+/i,
    /^\s*(?:claro|perfeito|com\s+certeza|certamente|sem\s+dúvida|sem\s+duvida|vamos\s+lá|vamos\s+la)[\s!.,:;…]+/i,
    /^\s*(?:olá|ola|oi|opa|e\s+aí|e\s+ai|fala)[\s!.,:;…]+/i,
  ];
  let out = text;
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const re of patterns) {
      const next = out.replace(re, '');
      if (next !== out) { out = next; changed = true; }
    }
    if (!changed) break;
  }
  if (out.length > 0 && /^[a-záéíóúâêôãõç]/.test(out)) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
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
      return `### Questão index=${i} (${ctx})
Enunciado: ${truncate(q.questionStem.trim(), 500)}${opts ? '\nAlternativas:\n' + opts : ''}${review}${note}`;
    })
    .join('\n\n');

  return `# QUEM VOCÊ É
Você é o **Prof. Sanor**. Para CADA questão abaixo, gere **exatamente 1 flashcard** de active recall que fixe o conceito central daquela questão. Mantenha a ordem e devolva o \`index\` correspondente.

# QUESTÕES
${blocks}

${RULES_BLOCK}

# FORMATO DE SAÍDA
Array JSON com um objeto por questão, cada um com \`index\` (número da questão), \`front_md\` e \`back_md\`. Um card por questão, na ordem. Sem texto fora do JSON.`;
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

    // ── Build prompt + schema per mode ──
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

    const responseSchema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          index: { type: 'INTEGER' },
          front_md: { type: 'STRING' },
          back_md: { type: 'STRING' },
        },
        required: ['front_md', 'back_md'],
      },
    };

    // ── Gemini request with 25s timeout ──
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
              maxOutputTokens: 8192,
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
    const rawJson = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    let parsed: Array<{ index?: number; front_md?: string; back_md?: string }> = [];
    try {
      const p = JSON.parse(rawJson);
      parsed = Array.isArray(p) ? p : [];
    } catch (parseErr) {
      console.error('[generate-flashcards-batch] JSON parse error', parseErr, rawJson.slice(0, 300));
      return new Response(
        JSON.stringify({ error: 'Resposta da IA em formato inválido. Tente novamente.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Sanitize + map ──
    const cards: GeneratedCard[] = parsed
      .filter((c) => c.front_md && c.back_md)
      .map((c) => {
        const card: GeneratedCard = {
          front_md: truncate(stripOpeningCompliments(stripEmDashes(String(c.front_md).trim())), 500),
          back_md: truncate(stripEmDashes(String(c.back_md).trim()), 1200),
        };
        if (mode === 'questions' && typeof c.index === 'number') {
          const src = questionsForMap[c.index]?.sourceRef;
          if (src) card.sourceRef = src;
        }
        return card;
      });

    if (cards.length === 0) {
      return new Response(
        JSON.stringify({ error: 'A IA não retornou flashcards válidos. Tente novamente.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ cards }), {
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
```

- [ ] **Step 2: Verificar lint/sintaxe (sem deploy ainda)**

Run: `npx deno check supabase/functions/generate-flashcards-batch/index.ts`
Expected: sem erros de tipo. (Se `deno` não estiver instalado, pular — a verificação real acontece no deploy/Task 7. Confirme que o arquivo segue a mesma forma de `generate-flashcard/index.ts`.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-flashcards-batch/index.ts
git commit -m "feat(flashcards): edge function generate-flashcards-batch (topic/questions/text)"
```

---

## Task 3: Métodos de serviço (`generateFlashcardsBatch` + `createFlashcardsBulk`)

**Files:**
- Modify: `src/services/simuladosApi.ts` (inserir logo após `generateFlashcard`, que termina em ~`:1224`)

- [ ] **Step 1: Garantir os imports de tipo no topo do arquivo**

No bloco de imports de tipos do caderno em `src/services/simuladosApi.ts` (onde `CreateFlashcardPayload`, `Flashcard` etc. já são importados de `@/types/caderno`), adicionar o import dos tipos do lote. Localize a linha que importa de `@/lib/bulkFlashcards` (provavelmente inexistente) e adicione:

```typescript
import type { BatchGenerateInput, GeneratedCard } from '@/lib/bulkFlashcards';
```

(Coloque junto aos demais imports `import type { ... } from '...'` no topo do arquivo.)

- [ ] **Step 2: Adicionar os dois métodos após `generateFlashcard`**

Logo após o fechamento do método `generateFlashcard` (a linha `},` que segue `return { front_md: ..., back_md: ... };`), inserir:

```typescript
  /**
   * Gera vários flashcards de uma vez via edge function `generate-flashcards-batch`.
   * Repassa o payload normalizado (BatchGenerateInput) e devolve os cards gerados.
   */
  async generateFlashcardsBatch(
    input: BatchGenerateInput,
  ): Promise<{ cards: GeneratedCard[] }> {
    logger.log('[SimuladosApi] Generating flashcards batch, mode:', input.mode);
    const { data, error } = await supabase.functions.invoke('generate-flashcards-batch', {
      body: input,
    });

    if (error) {
      logger.error('[SimuladosApi] Error generating flashcards batch:', error);
      throw error;
    }

    const result = (data as any) ?? {};
    return { cards: (result.cards as GeneratedCard[]) ?? [] };
  },

  /**
   * Cria vários flashcards de uma vez com um único insert multi-linha.
   * Segue o padrão de `createFlashcard` (RLS restringe ao dono; user_id da sessão).
   */
  async createFlashcardsBulk(
    payloads: CreateFlashcardPayload[],
  ): Promise<Flashcard[]> {
    if (payloads.length === 0) return [];
    logger.log('[SimuladosApi] Bulk-creating', payloads.length, 'flashcards');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('[SimuladosApi] createFlashcardsBulk: user not authenticated');

    const rows = payloads.map(({ front_image_url, back_image_url, ...rest }) => ({
      ...rest,
      user_id: userId,
      front_image_path: front_image_url ?? null,
      back_image_path: back_image_url ?? null,
    }));

    const { data, error } = await (supabase.from('flashcards') as any)
      .insert(rows)
      .select();

    if (error) {
      logger.error('[SimuladosApi] Error bulk-creating flashcards:', error);
      throw error;
    }

    return (data || []).map(mapFlashcardRow);
  },
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem novos erros relacionados a `simuladosApi.ts` / `bulkFlashcards`.

- [ ] **Step 4: Commit**

```bash
git add src/services/simuladosApi.ts
git commit -m "feat(flashcards): generateFlashcardsBatch + createFlashcardsBulk no service"
```

---

## Task 4: Componentes do wizard (`BulkGenerateModal` + pickers + deck target)

**Files:**
- Create: `src/components/caderno/flashcards/bulk/DeckTargetSelect.tsx`
- Create: `src/components/caderno/flashcards/bulk/TopicSourceForm.tsx`
- Create: `src/components/caderno/flashcards/bulk/CadernoSourcePicker.tsx`
- Create: `src/components/caderno/flashcards/BulkGenerateModal.tsx`

### 4a. DeckTargetSelect

- [ ] **Step 1: Criar `DeckTargetSelect.tsx`**

```tsx
/**
 * DeckTargetSelect — escolhe um deck existente OU cria um novo (nome pré-preenchido).
 * Reporta a escolha via onChange: { deckId } para existente ou { newName } para novo.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Deck } from '@/types/caderno';

export interface DeckTarget {
  deckId: string | null;
  newName: string | null;
}

interface DeckTargetSelectProps {
  decks: Deck[];
  suggestedName: string;
  value: DeckTarget;
  onChange: (t: DeckTarget) => void;
}

export function DeckTargetSelect({ decks, suggestedName, value, onChange }: DeckTargetSelectProps) {
  const [mode, setMode] = useState<'existing' | 'new'>(decks.length > 0 ? 'existing' : 'new');

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
        Salvar em
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={decks.length === 0}
          onClick={() => { setMode('existing'); onChange({ deckId: decks[0]?.id ?? null, newName: null }); }}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-40',
            mode === 'existing'
              ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]'
              : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Deck existente
        </button>
        <button
          type="button"
          onClick={() => { setMode('new'); onChange({ deckId: null, newName: suggestedName }); }}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            mode === 'new'
              ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]'
              : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Novo deck
        </button>
      </div>

      {mode === 'existing' ? (
        <select
          aria-label="Deck de destino"
          value={value.deckId ?? decks[0]?.id ?? ''}
          onChange={(e) => onChange({ deckId: e.target.value, newName: null })}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        >
          {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      ) : (
        <input
          type="text"
          aria-label="Nome do novo deck"
          value={value.newName ?? ''}
          maxLength={60}
          placeholder="Nome do deck…"
          onChange={(e) => onChange({ deckId: null, newName: e.target.value })}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        />
      )}
    </div>
  );
}
```

### 4b. TopicSourceForm

- [ ] **Step 2: Criar `TopicSourceForm.tsx`**

```tsx
/**
 * TopicSourceForm — fonte "Tema/área": área + tema (texto livre) + quantidade.
 * Reporta um BatchGenerateInput modo 'topic' (ou null se inválido) via onChange.
 */
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_COUNT, MAX_TOPIC_COUNT, clampCount, type BatchGenerateInput } from '@/lib/bulkFlashcards';

const COUNT_OPTIONS = [5, 10, 15];

interface TopicSourceFormProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function TopicSourceForm({ onChange }: TopicSourceFormProps) {
  const [area, setArea] = useState('');
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState<number>(DEFAULT_COUNT);

  useEffect(() => {
    const valid = !!(area.trim() || theme.trim());
    onChange(valid
      ? { mode: 'topic', area: area.trim() || null, theme: theme.trim() || null, count: clampCount(count, MAX_TOPIC_COUNT) }
      : null);
  }, [area, theme, count, onChange]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="bulk-area" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Área</label>
          <input
            id="bulk-area" type="text" value={area} onChange={(e) => setArea(e.target.value)}
            placeholder="Ex: Cardiologia"
            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="bulk-theme" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Tema</label>
          <input
            id="bulk-theme" type="text" value={theme} onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex: Insuficiência Cardíaca"
            className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Quantidade</span>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n} type="button" onClick={() => setCount(n)}
              className={cn(
                'flex-1 rounded-[var(--c-radius-control)] border py-2 text-[13px] font-bold transition-colors',
                count === n
                  ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]'
                  : 'border-[var(--c-border)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)]',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4c. CadernoSourcePicker

- [ ] **Step 3: Criar `CadernoSourcePicker.tsx`**

```tsx
/**
 * CadernoSourcePicker — fonte "Caderno de erros": lista entradas com checkbox.
 * Carrega via simuladosApi.getErrorNotebook e normaliza a seleção num
 * BatchGenerateInput modo 'questions' (1 card por questão) via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { useUser } from '@/contexts/UserContext';
import {
  buildCadernoQuestionsInput, MAX_QUESTIONS,
  type BatchGenerateInput, type CadernoRow,
} from '@/lib/bulkFlashcards';

interface CadernoSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function CadernoSourcePicker({ onChange }: CadernoSourcePickerProps) {
  const { profile } = useUser();
  const userId = profile?.id;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['caderno', 'entries', 'bulk-picker', userId],
    queryFn: () => simuladosApi.getErrorNotebook(userId!),
    enabled: !!userId,
  });

  const entries = rows as CadernoRow[];

  useEffect(() => {
    if (selected.size === 0) { onChange(null); return; }
    onChange(buildCadernoQuestionsInput(entries, selected));
  }, [selected, entries, onChange]);

  const atCap = selected.size >= MAX_QUESTIONS;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_QUESTIONS) next.add(id);
      return next;
    });
  };

  const visible = useMemo(() => entries.filter((e) => e.question_text?.trim()), [entries]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if (visible.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Nenhuma questão no seu Caderno de Erros ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
          Selecione as questões
        </span>
        <span className={cn('text-[11px] font-semibold', atCap ? 'text-amber-600' : 'text-[var(--c-muted)]')}>
          {selected.size}/{MAX_QUESTIONS}
        </span>
      </div>

      <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
        {visible.map((e) => {
          const checked = selected.has(e.id);
          const disabled = !checked && atCap;
          return (
            <button
              key={e.id} type="button" disabled={disabled} onClick={() => toggle(e.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)]' : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)]',
              )}
            >
              <span className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)] text-white' : 'border-[var(--c-muted-2)]',
              )}>
                {checked && <span className="text-[10px] leading-none">✓</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-[var(--c-ink)] line-clamp-2">
                  {e.question_text}
                </span>
                {(e.area || e.theme) && (
                  <span className="mt-0.5 block text-[11px] text-[var(--c-muted)]">
                    {[e.area, e.theme].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### 4d. BulkGenerateModal (orquestrador)

- [ ] **Step 4: Criar `BulkGenerateModal.tsx`**

```tsx
/**
 * BulkGenerateModal — wizard de geração de flashcards em lote com o Prof. San.
 *
 * Passos: 1) escolher fonte → 2) configurar → 3) destino + gerar.
 * Salva o lote direto no deck (sem preview do verso) e fecha; a curadoria
 * acontece na revisão. Reaproveita AdaptiveModal e ProfSanorAvatar.
 *
 * Fase 1: fontes 'topic' (Tema/área) e 'questions' (Caderno de erros).
 */
import { useState, useCallback } from 'react';
import { Sparkles, Loader2, BookOpen, Layers, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { Button } from '@/components/ui/button';
import { AdaptiveModal } from '@/components/caderno/ui';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import {
  suggestDeckName, mapGeneratedCardsToPayloads,
  type BatchGenerateInput,
} from '@/lib/bulkFlashcards';
import type { Deck } from '@/types/caderno';
import { TopicSourceForm } from './bulk/TopicSourceForm';
import { CadernoSourcePicker } from './bulk/CadernoSourcePicker';
import { DeckTargetSelect, type DeckTarget } from './bulk/DeckTargetSelect';

type SourceKey = 'topic' | 'caderno';

interface SourceTile { key: SourceKey; label: string; description: string; icon: React.ReactNode }

const SOURCES: SourceTile[] = [
  { key: 'topic', label: 'Tema / área', description: 'O Prof. San cria cards sobre um assunto', icon: <Layers className="h-5 w-5" aria-hidden /> },
  { key: 'caderno', label: 'Caderno de erros', description: 'Vira suas questões erradas em cards', icon: <BookOpen className="h-5 w-5" aria-hidden /> },
];

export interface BulkGenerateModalProps {
  decks: Deck[];
  defaultDeckId?: string | null;
  /** Chamado após salvar o lote, com o deckId de destino, para invalidar queries. */
  onDone: (deckId: string) => void;
  onClose: () => void;
}

export function BulkGenerateModal({ decks, onDone, onClose }: BulkGenerateModalProps) {
  const [step, setStep] = useState<'source' | 'config'>('source');
  const [source, setSource] = useState<SourceKey | null>(null);
  const [input, setInput] = useState<BatchGenerateInput | null>(null);
  const [target, setTarget] = useState<DeckTarget>({ deckId: decks[0]?.id ?? null, newName: null });
  const [generating, setGenerating] = useState(false);

  const suggestedName = input ? suggestDeckName(input) : 'Flashcards';

  const handlePickSource = (key: SourceKey) => {
    setSource(key);
    setInput(null);
    setStep('config');
  };

  const handleBack = () => { setStep('source'); setSource(null); setInput(null); };

  const resolveDeckId = useCallback(async (): Promise<string | null> => {
    if (target.deckId) return target.deckId;
    const name = (target.newName ?? suggestedName).trim() || suggestedName;
    const deck = await simuladosApi.createDeck(name);
    return deck.id;
  }, [target, suggestedName]);

  const handleGenerate = useCallback(async () => {
    if (!input) return;
    setGenerating(true);
    try {
      const { cards } = await simuladosApi.generateFlashcardsBatch(input);
      if (cards.length === 0) {
        toast({ title: 'A IA não retornou cards', description: 'Tente novamente ou ajuste a fonte.', variant: 'destructive' });
        return;
      }
      const deckId = await resolveDeckId();
      if (!deckId) {
        toast({ title: 'Selecione um deck de destino', variant: 'destructive' });
        return;
      }
      const payloads = mapGeneratedCardsToPayloads(cards, deckId);
      const created = await simuladosApi.createFlashcardsBulk(payloads);
      trackEvent('caderno_flashcards_bulk_generated', {
        mode: input.mode, count: created.length, deck_id: deckId,
      } as any);
      const deckName = decks.find((d) => d.id === deckId)?.name ?? (target.newName ?? suggestedName);
      toast({ title: `${created.length} flashcards criados`, description: `Salvos em "${deckName}".` });
      onDone(deckId);
    } catch (err) {
      logger.error('[BulkGenerateModal] generate error:', err);
      toast({ title: 'Não foi possível gerar os flashcards', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [input, resolveDeckId, decks, target, suggestedName, onDone]);

  const deckChosen = !!target.deckId || !!(target.newName ?? suggestedName).trim();
  const canGenerate = !!input && deckChosen && !generating;

  return (
    <AdaptiveModal
      open
      onOpenChange={(open) => { if (!open && !generating) onClose(); }}
      title="Gerar flashcards em lote"
      size="lg"
      footer={
        step === 'config' ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={generating} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Voltar
            </Button>
            <Button
              type="button" disabled={!canGenerate} onClick={handleGenerate}
              className="min-w-[160px] gap-2 bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)] hover:opacity-90"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              {generating ? 'Gerando…' : 'Gerar e salvar'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5 py-2">
        {step === 'source' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <button
                key={s.key} type="button" onClick={() => handlePickSource(s.key)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-2xl border border-[var(--c-border)] p-4 text-left transition-all',
                  'hover:border-[var(--c-wine-400)] hover:bg-[var(--c-wine-50)] hover:shadow-[var(--c-shadow-sm)]',
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--c-wine-500)]/10 text-[var(--c-wine-500)]">
                  {s.icon}
                </span>
                <span className="text-[14px] font-bold text-[var(--c-ink)]">{s.label}</span>
                <span className="text-[12px] text-[var(--c-muted)]">{s.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Faixa Prof. San */}
            <div className={cn(
              'flex items-center gap-3 rounded-2xl border border-amber-400/30 p-3',
              'bg-gradient-to-br from-amber-50 via-[var(--c-surface)] to-[var(--c-surface)]',
              'dark:from-amber-500/[0.1] dark:via-[var(--c-surface)] dark:to-[var(--c-surface)]',
            )}>
              <span className="block shrink-0 overflow-hidden rounded-full ring-2 ring-amber-300/50">
                <ProfSanorAvatar size={40} animated={generating} />
              </span>
              <p className="text-[12px] text-[var(--c-muted)]">
                {generating
                  ? 'O Prof. San está montando seus flashcards…'
                  : 'Configure a fonte e o Prof. San gera os cards de uma vez.'}
              </p>
            </div>

            {source === 'topic' && <TopicSourceForm onChange={setInput} />}
            {source === 'caderno' && <CadernoSourcePicker onChange={setInput} />}

            <div className="border-t border-[var(--c-border)] pt-4">
              <DeckTargetSelect
                decks={decks}
                suggestedName={suggestedName}
                value={target}
                onChange={setTarget}
              />
            </div>
          </>
        )}
      </div>
    </AdaptiveModal>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros nos novos componentes.

- [ ] **Step 6: Commit**

```bash
git add src/components/caderno/flashcards/bulk/ src/components/caderno/flashcards/BulkGenerateModal.tsx
git commit -m "feat(flashcards): wizard BulkGenerateModal + pickers (tema/área, caderno) + deck target"
```

---

## Task 5: Entry point na página (`CadernoFlashcardsPage`)

**Files:**
- Modify: `src/pages/CadernoFlashcardsPage.tsx`

- [ ] **Step 1: Importar o modal**

Após a linha `import { FlashcardReviewSession } from '@/components/caderno/flashcards/FlashcardReviewSession';` (~`:60`), adicionar:

```tsx
import { BulkGenerateModal } from '@/components/caderno/flashcards/BulkGenerateModal';
```

- [ ] **Step 2: Adicionar estado do modal**

No componente `FlashcardsContent`, junto aos outros `useState` (~`:264-268`), adicionar:

```tsx
  const [bulkOpen, setBulkOpen] = useState(false);
```

- [ ] **Step 3: Handler de conclusão do lote**

Logo após `handleEditorSave` (~`:329`), adicionar:

```tsx
  const handleBulkDone = useCallback(
    (deckId: string) => {
      setBulkOpen(false);
      setSelectedDeckId(deckId);
      qc.invalidateQueries({ queryKey: QUERY_DECKS });
      qc.invalidateQueries({ queryKey: queryFlashcards(deckId) });
      qc.invalidateQueries({ queryKey: queryFlashcards(null) });
      qc.invalidateQueries({ queryKey: QUERY_DUE });
    },
    [qc],
  );
```

- [ ] **Step 4: Botão "Gerar em lote" no header**

No `PageHeaderPremium`, trocar a prop `primaryAction` (atualmente só o botão "Novo flashcard", ~`:448-463`) por um grupo com os dois botões:

```tsx
            primaryAction={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkOpen(true)}
                  className={cn(
                    'gap-1.5 border-amber-400/40 text-amber-600',
                    'hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10',
                  )}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Gerar em lote
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditor()}
                  disabled={!selectedDeckId && decks.length > 0}
                  title={!selectedDeckId ? 'Selecione um deck para adicionar um flashcard' : undefined}
                  className={cn(
                    'gap-1.5 border-[var(--c-wine-500)]/25 text-[var(--c-wine-600)]',
                    'hover:border-[var(--c-wine-400)] hover:bg-[var(--c-wine-50)]',
                  )}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Novo flashcard
                </Button>
              </div>
            }
```

(`Sparkles` já está importado de `lucide-react` no topo do arquivo, ~`:34`.)

- [ ] **Step 5: Montar o modal**

Logo após o bloco `{editorOpen && (<FlashcardEditor .../>)}` (~`:554-561`), antes do `</>` final do return de `FlashcardsContent`, adicionar:

```tsx
      {bulkOpen && (
        <BulkGenerateModal
          decks={decks}
          defaultDeckId={selectedDeckId}
          onDone={handleBulkDone}
          onClose={() => setBulkOpen(false)}
        />
      )}
```

- [ ] **Step 6: Verificar build/tipos e rodar dev**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/pages/CadernoFlashcardsPage.tsx
git commit -m "feat(flashcards): botão Gerar em lote + monta BulkGenerateModal na página"
```

---

## Task 6: Ação "Remover / não gostei" na revisão (`FlashcardReviewSession`)

**Files:**
- Modify: `src/components/caderno/flashcards/FlashcardReviewSession.tsx`

- [ ] **Step 1: Importar ícone Trash2**

Na lista de imports de `lucide-react` (~`:14-22`), adicionar `Trash2`:

```tsx
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
  RotateCcw,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
```

- [ ] **Step 2: Estado de removidos**

Junto aos outros `useState` do componente (~`:226-233`), adicionar:

```tsx
  const [removedCount, setRemovedCount] = useState(0);
```

- [ ] **Step 3: Handler de remoção**

Logo após o `handleGrade` (após a linha `handleGradeRef.current = handleGrade;`, ~`:296`), adicionar:

```tsx
  const handleRemove = useCallback(async () => {
    if (grading || !currentCard) return;
    setGrading(true);
    try {
      await simuladosApi.softDeleteFlashcard(currentCard.id);
      trackEvent('caderno_flashcard_disliked', { flashcard_id: currentCard.id } as any);
    } catch (err) {
      logger.error('[FlashcardReviewSession] Error removing card:', err);
      toast({ title: 'Não foi possível remover', variant: 'destructive' });
      setGrading(false);
      return;
    }
    toast({ title: 'Card removido' });
    setRemovedCount((n) => n + 1);
    const next = currentIndex + 1;
    if (next >= cards.length) {
      setDone(true);
    } else {
      setFlipDir('back');
      setCurrentIndex(next);
      setRevealed(false);
    }
    setGrading(false);
  }, [currentCard, currentIndex, cards.length, grading]);
```

- [ ] **Step 4: Botão "Não gostei · remover" abaixo do card**

Logo após o fechamento do bloco do card com flip 3D (a `</div>` que fecha o `<div style={{ perspective: '1400px' }}>`, ~`:454`), adicionar:

```tsx
      {/* Curadoria: remover card que o aluno não gostou */}
      <div className="flex justify-center">
        <button
          type="button"
          disabled={grading}
          onClick={handleRemove}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] px-3 py-1.5',
            'text-[11.5px] font-semibold text-[var(--c-muted)] transition-colors',
            'hover:bg-destructive/10 hover:text-destructive',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          aria-label="Não gostei deste card, remover da coleção"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Não gostei · remover
        </button>
      </div>
```

- [ ] **Step 5: Mostrar removidos no resumo (opcional, leve)**

No `SessionSummary`, a chamada está em ~`:298-299`. Atualizar para passar `removedCount` e exibi-lo. Primeiro, estender a interface `SessionSummaryProps` (~`:147-151`):

```tsx
interface SessionSummaryProps {
  total: number;
  results: Record<FlashcardReviewOutcome, number>;
  removedCount: number;
  onFinish: () => void;
}
```

Atualizar a assinatura da função (~`:153`):

```tsx
function SessionSummary({ total, results, removedCount, onFinish }: SessionSummaryProps) {
```

Logo após o parágrafo `mastered > 0 && (...)` (~`:198-203`), adicionar:

```tsx
      {removedCount > 0 && (
        <p className="text-[12px] text-[var(--c-muted)]">
          {removedCount} {removedCount === 1 ? 'card removido' : 'cards removidos'} nesta sessão.
        </p>
      )}
```

E atualizar a chamada de `SessionSummary` (~`:298-299`):

```tsx
  if (done) {
    return <SessionSummary total={cards.length} results={results} removedCount={removedCount} onFinish={onFinish} />;
  }
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/caderno/flashcards/FlashcardReviewSession.tsx
git commit -m "feat(flashcards): ação remover/não gostei na sessão de revisão"
```

---

## Task 7: Deploy da função + verificação ponta-a-ponta

**Files:** nenhum (verificação)

- [ ] **Step 1: Lint + testes + typecheck**

Run: `npm run lint`
Run: `npm run test`
Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tudo verde; os testes de `bulkFlashcards.test.ts` passam.

- [ ] **Step 2: Deploy da Edge Function**

A função usa os secrets já existentes (`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) — os mesmos de `generate-flashcard`. Fazer deploy via MCP Supabase (`deploy_edge_function`) ou CLI:

Run: `npx supabase functions deploy generate-flashcards-batch`
Expected: deploy bem-sucedido. Confirmar com `npx supabase functions list` que `generate-flashcards-batch` aparece.

- [ ] **Step 3: Verificação manual no app**

Run: `npm run dev` (porta 8080), logar como usuário PRO, ir em `/caderno/flashcards`.

Verificar:
1. Botão "Gerar em lote" aparece no header.
2. Modo **Tema/área**: preencher "Cardiologia / Insuficiência Cardíaca", quantidade 5, deck novo → "Gerar e salvar" cria 5 cards e o toast confirma; os cards aparecem no deck.
3. Modo **Caderno de erros**: selecionar 2-3 questões → gera 1 card por questão; conferir que `entry_id` foi gravado (cards aparecem no deck escolhido).
4. Iniciar revisão → o botão "Não gostei · remover" some o card atual e avança; ao terminar, o resumo mostra "X cards removidos"; o card removido não volta na lista.
5. Erro: desligar a internet / forçar 429 e confirmar que o modal mostra toast de erro e permanece aberto.

- [ ] **Step 4: Atualizar o índice de specs/plans se houver, e finalizar**

Confirmar que o spec (`docs/superpowers/specs/2026-06-06-bulk-flashcards-prof-san-design.md`) e este plano estão commitados. Seguir para a skill `finishing-a-development-branch` para decidir merge/PR.

---

## Self-Review (cobertura do spec)

- ✅ Motor Abordagem A (1 edge function de lote, 1 round-trip) → Task 2.
- ✅ 3 primitivas; Fase 1 expõe `topic` e `questions` (a `text` já existe na função, picker fica pra Fase 2) → Task 2 + Task 4.
- ✅ Service `generateFlashcardsBatch` + `createFlashcardsBulk` (insert multi-linha, mapeia sourceRef→entry_id/question_id) → Task 3 + Task 1 (mapeamento testado).
- ✅ Wizard `BulkGenerateModal` (fonte → configurar → destino → gerar), AdaptiveModal + ProfSanorAvatar → Task 4.
- ✅ Salvar direto, sem preview do verso → Task 4 (não há etapa de preview).
- ✅ Deck escolher/criar com nome sugerido → Task 4 (DeckTargetSelect + suggestDeckName).
- ✅ Quantidade 5/10/15 default 10 (topic); 1 card por questão (questions) → Task 4 + Task 2.
- ✅ Caps (topic ≤15, questions ≤20) → Task 1 (consts) + Task 2 (clamp/slice) + Task 4 (UI 5/10/15 e contador X/20).
- ✅ Curadoria "Remover / não gostei" na revisão → Task 6.
- ✅ Gate PRO herdado (sem novo gate) → nada a fazer (página já gated).
- ✅ Analytics `caderno_flashcards_bulk_generated` + `caderno_flashcard_disliked` → Task 4 + Task 6.
- ✅ Erros espelham generate-flashcard (401/429/502/504), modal permanece aberto → Task 2 + Task 4.
- ✅ Logging via `logger`, toasts via `use-toast` → todas as tasks.
- ✅ Testes unitários dos helpers puros → Task 1.

**Nota de fidelidade:** os steps de Edge Function e componentes React não usam TDD estrito (difícil unitar Deno/UI neste setup); a verificação é manual (Task 7). Os helpers puros (onde mora a lógica de mapeamento/normalização) têm testes reais em Task 1.

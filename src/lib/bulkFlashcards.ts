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
import type { Question } from '@/types';

/** Modos de geração suportados pela Edge Function de lote. */
export type BatchMode = 'topic' | 'questions' | 'text';

/** Caps para caber numa única chamada Gemini (~25s). */
export const MAX_TOPIC_COUNT = 15;
/**
 * Teto de questões selecionáveis num lote `questions`. O lote é fatiado em
 * chamadas de `QUESTIONS_CHUNK_SIZE` (ver chunkBatchInput), então o limite não
 * é mais a janela de 25s de uma única chamada — é só um teto de UX para manter o
 * job e a pilha de revisão gerenciáveis.
 */
export const MAX_QUESTIONS = 60;
export const DEFAULT_COUNT = 10;

/**
 * Questões por chamada Gemini no modo `questions`. Mantém cada chamada bem abaixo
 * do abort de 25s da Edge Function (a causa dos antigos 504): ~6 cards geram em
 * ~8-10s com folga. Lotes maiores são fatiados e gerados em paralelo no cliente.
 */
export const QUESTIONS_CHUNK_SIZE = 6;

/**
 * Chamadas Gemini simultâneas ao gerar um lote fatiado. Conservador de propósito:
 * a API key do Gemini é compartilhada por todos os usuários, então rajadas largas
 * disparariam rate-limit (429). 2 equilibra velocidade e folga de quota.
 */
export const BULK_CONCURRENCY = 2;

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

/** Item de origem para buildQuestionsInput. */
export interface QuestionSourceItem {
  q: Question;
  area?: string | null;
  theme?: string | null;
  entryId?: string;
}

/** Converte uma Question carregada num BatchQuestionInput (resolve o label do gabarito). */
export function mapQuestionToBatchInput(
  q: Question,
  opts: { area?: string | null; theme?: string | null; entryId?: string } = {},
): BatchQuestionInput {
  const correctOptionLabel = q.options.find((o) => o.id === q.correctOptionId)?.label ?? null;
  return {
    sourceRef: { questionId: q.id, ...(opts.entryId ? { entryId: opts.entryId } : {}) },
    questionStem: q.text,
    options: q.options.map((o) => ({ label: o.label, text: o.text })),
    correctOptionLabel,
    area: opts.area ?? q.area ?? null,
    theme: opts.theme ?? q.theme ?? null,
    aiReviewMd: null,
    learningNote: null,
  };
}

/** Monta um BatchGenerateInput modo `questions` a partir de questões carregadas. */
export function buildQuestionsInput(items: QuestionSourceItem[]): BatchGenerateInput {
  return {
    mode: 'questions',
    questions: items.map((it) => mapQuestionToBatchInput(it.q, { area: it.area, theme: it.theme, entryId: it.entryId })),
  };
}

/**
 * Fatia um lote em chamadas menores para a Edge Function. Só o modo `questions`
 * é fatiado (1 card por questão, divisível); `topic`/`text` viram uma chamada só.
 * Cada chunk preserva a ordem das questões originais.
 */
export function chunkBatchInput(
  input: BatchGenerateInput,
  chunkSize: number = QUESTIONS_CHUNK_SIZE,
): BatchGenerateInput[] {
  const qs = input.questions;
  if (input.mode !== 'questions' || !qs || qs.length <= chunkSize) return [input];
  const chunks: BatchGenerateInput[] = [];
  for (let i = 0; i < qs.length; i += chunkSize) {
    chunks.push({ mode: 'questions', questions: qs.slice(i, i + chunkSize) });
  }
  return chunks;
}

/**
 * Roda `worker` sobre `items` com no máximo `limit` tarefas simultâneas (workers
 * fazem "work-stealing" de uma fila compartilhada). Aguarda todas terminarem.
 * O worker é responsável por engolir os próprios erros — uma rejeição aqui aborta
 * o lote inteiro via Promise.all.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  };
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, run));
}

/** Monta um BatchGenerateInput modo `topic` (count clampado em [1, MAX_TOPIC_COUNT]). */
export function buildTopicInput(
  area: string | null | undefined,
  theme: string | null | undefined,
  count: number,
): BatchGenerateInput {
  return {
    mode: 'topic',
    area: area?.trim() || null,
    theme: theme?.trim() || null,
    count: clampCount(count, MAX_TOPIC_COUNT),
  };
}

/** Linha crua de error_notebook para o ranqueamento de pontos fracos. */
export interface ErrorNotebookWeakRow {
  id: string;
  area: string | null;
  theme: string | null;
  reason: string;
  created_at: string;
  mastered_at?: string | null;
  srs_lapses?: number | null;
  srs_reps?: number | null;
  srs_due_at?: string | null;
}

/** Mapeia linhas de error_notebook para o shape WeakAreaEntry de weakAreas.ts. */
export function mapErrorRowsToWeakEntries(rows: ErrorNotebookWeakRow[]) {
  return rows.map((r) => ({
    id: r.id,
    area: r.area,
    theme: r.theme,
    reason: r.reason,
    addedAt: r.created_at,
    masteredAt: r.mastered_at ?? null,
    srsLapses: r.srs_lapses ?? null,
    srsReps: r.srs_reps ?? null,
    srsDueAt: r.srs_due_at ?? null,
  }));
}

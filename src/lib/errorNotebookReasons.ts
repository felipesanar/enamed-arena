/**
 * Caderno de Erros — single source of truth for reason labels, colors, and DB enum mapping.
 * DB uses English enum keys; UI uses local (Portuguese) keys for form state.
 */

/** Supabase error_notebook.reason enum values */
export type DbReason =
  | 'did_not_know'
  | 'did_not_remember'
  | 'reading_error'
  | 'confused_alternatives'
  | 'did_not_understand' // legacy — kept for backward compat with existing entries
  | 'guessed_correctly';

/** Local form keys (used in AddToNotebookModal) */
export type LocalReason =
  | 'nao_sei'
  | 'nao_lembrei'
  | 'leitura'
  | 'diferencial'
  | 'acertei_sem_certeza';

export interface ReasonMeta {
  badge: string;  // Short tag label (Lacuna, Memória, etc.)
  label: string;
  hint: string;
  strategy: string;
  colorBase: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
}

/** Full metadata per DB reason (including legacy did_not_understand) */
export const DB_REASON_META: Record<DbReason, ReasonMeta> = {
  did_not_know: {
    badge: 'Lacuna',
    label: 'Não sei o conceito',
    hint: 'Nunca vi ou não domino esse assunto.',
    strategy: 'Assista aula do tema no SanarFlix',
    colorBase: '#f43f5e',
    colorBg: '#fff1f2',
    colorBorder: '#fecdd3',
    colorText: '#be123c',
  },
  did_not_remember: {
    badge: 'Memória',
    label: 'Sabia, mas esqueci',
    hint: 'Já estudei, mas não lembrei na hora.',
    strategy: 'Construa Flashcards no app.',
    colorBase: '#8b5cf6',
    colorBg: '#f5f3ff',
    colorBorder: '#ddd6fe',
    colorText: '#6d28d9',
  },
  reading_error: {
    badge: 'Atenção',
    label: 'Desatenção',
    hint: 'Li rápido, não vi o detalhe decisivo (ex: "sem febre", "EXCETO").',
    strategy: 'Garanta um ambiente de foco e preparação no momento do simulado.',
    colorBase: '#f59e0b',
    colorBg: '#fffbeb',
    colorBorder: '#fde68a',
    colorText: '#854d0e',
  },
  confused_alternatives: {
    badge: 'Diferencial',
    label: 'Confundi com outra condição',
    hint: 'Sabia aproximadamente, mas errei na discriminação entre condições similares.',
    strategy: 'Estude comparando as condições lado a lado.',
    colorBase: '#3b82f6',
    colorBg: '#eff6ff',
    colorBorder: '#bfdbfe',
    colorText: '#1d4ed8',
  },
  did_not_understand: {
    badge: 'Entend.',
    label: 'Não entendi a questão',
    hint: 'Tive dificuldade com o enunciado.',
    strategy: 'Reler com atenção e identificar o que não ficou claro.',
    colorBase: '#6b7280',
    colorBg: '#f9fafb',
    colorBorder: '#e5e7eb',
    colorText: '#374151',
  },
  guessed_correctly: {
    badge: 'Chute',
    label: 'Acertei sem certeza',
    hint: 'Acertei por eliminação — sem entender o raciocínio completo.',
    strategy: 'Trate como lacuna: estude para confirmar o porquê.',
    colorBase: '#eab308',
    colorBg: '#fefce8',
    colorBorder: '#fde047',
    colorText: '#854d0e',
  },
};

export function getReasonLabel(reason: string): string {
  return DB_REASON_META[reason as DbReason]?.label ?? reason;
}

export function getReasonMeta(reason: string): ReasonMeta {
  return DB_REASON_META[reason as DbReason] ?? DB_REASON_META.did_not_understand;
}

/** Local reason metadata for AddToNotebookModal */
export const LOCAL_REASON_META: Record<
  LocalReason,
  ReasonMeta & { dbKey: DbReason; forWrongAnswer: boolean }
> = {
  nao_sei: { ...DB_REASON_META.did_not_know, dbKey: 'did_not_know', forWrongAnswer: true },
  nao_lembrei: { ...DB_REASON_META.did_not_remember, dbKey: 'did_not_remember', forWrongAnswer: true },
  leitura: { ...DB_REASON_META.reading_error, dbKey: 'reading_error', forWrongAnswer: true },
  diferencial: { ...DB_REASON_META.confused_alternatives, dbKey: 'confused_alternatives', forWrongAnswer: true },
  acertei_sem_certeza: { ...DB_REASON_META.guessed_correctly, dbKey: 'guessed_correctly', forWrongAnswer: false },
};

/** Map local reason (form) → DB reason (API) */
export const LOCAL_TO_DB_REASON: Record<LocalReason, DbReason> = {
  nao_sei: 'did_not_know',
  nao_lembrei: 'did_not_remember',
  leitura: 'reading_error',
  diferencial: 'confused_alternatives',
  acertei_sem_certeza: 'guessed_correctly',
};

// Kept for backward compat
export const LOCAL_REASON_LABELS: Record<LocalReason, string> = {
  nao_sei: DB_REASON_META.did_not_know.label,
  nao_lembrei: DB_REASON_META.did_not_remember.label,
  leitura: DB_REASON_META.reading_error.label,
  diferencial: DB_REASON_META.confused_alternatives.label,
  acertei_sem_certeza: DB_REASON_META.guessed_correctly.label,
};

export const DB_REASON_LABELS: Record<DbReason, string> = {
  did_not_know: DB_REASON_META.did_not_know.label,
  did_not_remember: DB_REASON_META.did_not_remember.label,
  reading_error: DB_REASON_META.reading_error.label,
  confused_alternatives: DB_REASON_META.confused_alternatives.label,
  did_not_understand: DB_REASON_META.did_not_understand.label,
  guessed_correctly: DB_REASON_META.guessed_correctly.label,
};

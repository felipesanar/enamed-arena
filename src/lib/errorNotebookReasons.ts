/**
 * Caderno de Erros — single source of truth for reason labels and DB enum mapping.
 * DB uses English enum keys; UI uses local (Portuguese) keys for form state.
 */

/** Supabase error_notebook.reason enum */
export type DbReason = 'did_not_know' | 'did_not_remember' | 'did_not_understand' | 'guessed_correctly';

/** Local form keys (used in AddToNotebookModal) */
export type LocalReason = 'nao_sei' | 'nao_lembrei' | 'nao_entendi' | 'acertei_sem_certeza';

/** Display label for each DB reason (used in CadernoErrosPage list) */
export const DB_REASON_LABELS: Record<DbReason, string> = {
  did_not_know: 'Não sei o conteúdo',
  did_not_remember: 'Não lembrei na hora',
  did_not_understand: 'Não entendi a questão',
  guessed_correctly: 'Acertei sem certeza',
};

/** Display label for each local reason (used in AddToNotebookModal buttons) */
export const LOCAL_REASON_LABELS: Record<LocalReason, string> = {
  nao_sei: 'Não sei o conteúdo',
  nao_lembrei: 'Não lembrei na hora',
  nao_entendi: 'Não entendi a questão',
  acertei_sem_certeza: 'Acertei sem certeza',
};

/** Map local reason (form) → DB reason (API) */
export const LOCAL_TO_DB_REASON: Record<LocalReason, DbReason> = {
  nao_sei: 'did_not_know',
  nao_lembrei: 'did_not_remember',
  nao_entendi: 'did_not_understand',
  acertei_sem_certeza: 'guessed_correctly',
};

export function getReasonLabel(reason: string): string {
  return DB_REASON_LABELS[reason as DbReason] ?? reason;
}

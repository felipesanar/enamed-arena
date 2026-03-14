/**
 * Caderno de Erros — Error Notebook storage and helpers.
 * Exclusive feature for PRO: ENAMED users.
 * Prepared for future Supabase migration.
 */

export type ErrorReason = 'nao_sei' | 'nao_lembrei' | 'nao_entendi' | 'acertei_sem_certeza';

export const ERROR_REASON_LABELS: Record<ErrorReason, string> = {
  nao_sei: 'Não sei o conteúdo',
  nao_lembrei: 'Não lembrei na hora',
  nao_entendi: 'Não entendi a questão',
  acertei_sem_certeza: 'Acertei sem certeza',
};

export interface ErrorNotebookEntry {
  id: string;
  questionId: string;
  simuladoId: string;
  simuladoTitle: string;
  area: string;
  theme: string;
  questionNumber: number;
  questionText: string;
  reason: ErrorReason;
  learningNote: string;
  wasCorrect: boolean;
  addedAt: string; // ISO
}

const STORAGE_KEY = 'enamed_error_notebook';

export function loadNotebook(): ErrorNotebookEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotebook(entries: ErrorNotebookEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('[ErrorNotebook] Save failed:', e);
  }
}

export function addToNotebook(entry: Omit<ErrorNotebookEntry, 'id' | 'addedAt'>): ErrorNotebookEntry {
  const entries = loadNotebook();
  // Prevent duplicates
  const existing = entries.find(e => e.questionId === entry.questionId && e.simuladoId === entry.simuladoId);
  if (existing) {
    // Update existing
    const updated = entries.map(e =>
      e.id === existing.id
        ? { ...e, ...entry, addedAt: e.addedAt }
        : e
    );
    saveNotebook(updated);
    return updated.find(e => e.id === existing.id)!;
  }

  const newEntry: ErrorNotebookEntry = {
    ...entry,
    id: `nb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    addedAt: new Date().toISOString(),
  };
  entries.push(newEntry);
  saveNotebook(entries);
  console.log('[ErrorNotebook] Added entry:', newEntry.id);
  return newEntry;
}

export function removeFromNotebook(entryId: string) {
  const entries = loadNotebook().filter(e => e.id !== entryId);
  saveNotebook(entries);
  console.log('[ErrorNotebook] Removed entry:', entryId);
}

export function isInNotebook(questionId: string, simuladoId: string): boolean {
  return loadNotebook().some(e => e.questionId === questionId && e.simuladoId === simuladoId);
}

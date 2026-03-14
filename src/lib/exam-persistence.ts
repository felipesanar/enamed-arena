import type { ExamAttempt } from '@/types/exam';

const STORAGE_PREFIX = 'sanarflix_attempt_';

function getKey(simuladoId: string): string {
  return `${STORAGE_PREFIX}${simuladoId}`;
}

export function saveAttempt(attempt: ExamAttempt): void {
  try {
    const data = { ...attempt, lastSavedAt: new Date().toISOString() };
    localStorage.setItem(getKey(attempt.simuladoId), JSON.stringify(data));
    console.log('[ExamPersistence] Saved attempt for', attempt.simuladoId);
  } catch (e) {
    console.error('[ExamPersistence] Failed to save:', e);
  }
}

export function loadAttempt(simuladoId: string): ExamAttempt | null {
  try {
    const raw = localStorage.getItem(getKey(simuladoId));
    if (!raw) return null;
    const attempt = JSON.parse(raw) as ExamAttempt;
    console.log('[ExamPersistence] Loaded attempt for', simuladoId, 'status:', attempt.status);
    return attempt;
  } catch {
    return null;
  }
}

export function clearAttempt(simuladoId: string): void {
  localStorage.removeItem(getKey(simuladoId));
}

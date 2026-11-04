import type { ActiveOfflineAttempt } from '@/services/offlineApi';

const PREFIX = 'enamed_offline_attempt:v2:';
const part = encodeURIComponent;
const prefixFor = (userId: string) => `${PREFIX}${part(userId)}:`;
const keyFor = (userId: string, simuladoId: string, attemptId: string) =>
  `${prefixFor(userId)}${part(simuladoId)}:${part(attemptId)}`;

export function isPendingOfflineAttempt(value: unknown): value is ActiveOfflineAttempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as ActiveOfflineAttempt;
  return [a.id, a.simulado_id, a.started_at, a.effective_deadline].every(v => typeof v === 'string' && v.length > 0)
    && typeof a.simulado_slug === 'string' && a.status === 'offline_pending'
    && Number.isFinite(Date.parse(a.started_at)) && Number.isFinite(Date.parse(a.effective_deadline))
    && Date.parse(a.effective_deadline) >= Date.parse(a.started_at);
}

export function readOfflineAttempts(userId: string, simuladoId?: string): ActiveOfflineAttempt[] {
  if (!userId) return [];
  try {
    const result: ActiveOfflineAttempt[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefixFor(userId))) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (entry?.userId !== userId || !isPendingOfflineAttempt(entry.attempt)) continue;
        const a = entry.attempt;
        if (key !== keyFor(userId, a.simulado_id, a.id) || (simuladoId && a.simulado_id !== simuladoId)) continue;
        result.push(a);
      } catch { /* An invalid entry must not hide other valid entries. */ }
    }
    return result.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  } catch { return []; }
}

export function saveOfflineAttempt(userId: string, attempt: ActiveOfflineAttempt): boolean {
  if (!userId || !isPendingOfflineAttempt(attempt)) return false;
  try {
    const key = keyFor(userId, attempt.simulado_id, attempt.id);
    localStorage.setItem(key, JSON.stringify({ userId, attempt }));
    window.dispatchEvent(new StorageEvent('storage', { key }));
    return true;
  } catch { return false; }
}

export function removeOfflineAttempt(userId: string, simuladoId: string, attemptId: string): void {
  if (!userId) return;
  try {
    const key = keyFor(userId, simuladoId, attemptId);
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent('storage', { key }));
  } catch { /* Storage may be unavailable. The server remains authoritative. */ }
}

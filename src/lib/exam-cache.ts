import type { ExamState } from '@/types/exam';

export interface ExamCacheIdentity { userId: string; attemptId: string; simuladoId: string }
export interface ExamCache extends ExamCacheIdentity {
  version: 1;
  state: ExamState;
  dirtyQuestionIds: string[];
}
const part = encodeURIComponent;
export const examCacheKey = (id: ExamCacheIdentity) =>
  `enamed_exam_v1:${part(id.userId)}:${part(id.attemptId)}:${part(id.simuladoId)}`;
const pointerKey = (userId: string, simuladoId: string) => `enamed_exam_active_v1:${part(userId)}:${part(simuladoId)}`;
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const count = (v: unknown) => Number.isInteger(v) && Number(v) >= 0;
export function isExamState(v: unknown): v is ExamState {
  if (!record(v) || typeof v.simuladoId !== 'string' || !record(v.answers) ||
    !count(v.currentQuestionIndex) || !count(v.tabExitCount) || !count(v.fullscreenExitCount) ||
    !date(v.startedAt) || !date(v.effectiveDeadline) || !date(v.lastSavedAt) ||
    !['not_started', 'in_progress', 'submitted', 'expired'].includes(v.status)) return false;
  return Object.entries(v.answers).every(([id, a]) => record(a) && a.questionId === id &&
    (a.selectedOption === null || typeof a.selectedOption === 'string') &&
    typeof a.markedForReview === 'boolean' && typeof a.highConfidence === 'boolean' &&
    Array.isArray(a.eliminatedAlternatives) && a.eliminatedAlternatives.every((x: unknown) => typeof x === 'string') &&
    (a.clientUpdatedAt == null || date(a.clientUpdatedAt)) &&
    (a.answeredAt == null || date(a.answeredAt)) &&
    (a.confidence == null || ['baixa', 'media', 'alta'].includes(a.confidence)));
}
export function readExamCache(identity: ExamCacheIdentity): ExamCache | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(examCacheKey(identity)) ?? 'null');
    if (!record(value) || value.version !== 1 || value.userId !== identity.userId ||
      value.attemptId !== identity.attemptId || value.simuladoId !== identity.simuladoId ||
      !isExamState(value.state) || value.state.simuladoId !== identity.simuladoId ||
      !Array.isArray(value.dirtyQuestionIds) || !value.dirtyQuestionIds.every((id: unknown) => typeof id === 'string')) return null;
    return value as ExamCache;
  } catch { return null; }
}
export function readActiveExamCache(userId: string, simuladoId: string): ExamCache | null {
  try {
    const attemptId = localStorage.getItem(pointerKey(userId, simuladoId));
    return attemptId ? readExamCache({ userId, simuladoId, attemptId }) : null;
  } catch { return null; }
}
export function writeExamCache(identity: ExamCacheIdentity, state: ExamState, dirtyQuestionIds: string[]) {
  if (!identity.userId || !identity.attemptId || !isExamState(state) || state.simuladoId !== identity.simuladoId) return;
  try {
    localStorage.setItem(examCacheKey(identity), JSON.stringify({ version: 1, userId: identity.userId,
      attemptId: identity.attemptId, simuladoId: identity.simuladoId, state, dirtyQuestionIds }));
    localStorage.setItem(pointerKey(identity.userId, identity.simuladoId), identity.attemptId);
  } catch { /* Storage can be disabled or full; the server remains authoritative. */ }
}
export function removeExamCache(identity: ExamCacheIdentity) {
  try { localStorage.removeItem(examCacheKey(identity)); } catch { /* Best effort. */ }
}

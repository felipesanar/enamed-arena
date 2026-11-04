export interface AnswerDraftScope {
  userId: string;
  simuladoId: string;
  attemptId: string;
  caderno: string;
}
const keyFor = (s: AnswerDraftScope) => `enamed_offline_draft:v1:${[s.userId, s.simuladoId, s.attemptId, s.caderno].map(encodeURIComponent).join(':')}`;
export function readAnswerDraft(scope: AnswerDraftScope, grid: Array<{ id: string; options: Array<{ id: string }> }>): Record<string, string> {
  if (!scope.userId || !scope.attemptId) return {};
  try {
    const data = JSON.parse(localStorage.getItem(keyFor(scope)) ?? 'null');
    if (!data || data.version !== 1 || !data.answers || typeof data.answers !== 'object') return {};
    return Object.fromEntries(grid.flatMap(q => {
      const option = data.answers[q.id];
      return typeof option === 'string' && q.options.some(o => o.id === option) ? [[q.id, option]] : [];
    }));
  } catch { return {}; }
}
export function saveAnswerDraft(scope: AnswerDraftScope, answers: Record<string, string>): boolean {
  if (!scope.userId || !scope.attemptId) return false;
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify({ version: 1, answers }));
    return true;
  } catch { return false; }
}
export function removeAnswerDraft(scope: AnswerDraftScope): void {
  try { localStorage.removeItem(keyFor(scope)); } catch { /* Do not block confirmed submission. */ }
}

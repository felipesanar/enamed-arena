import { beforeEach, expect, it, vi } from 'vitest';
import { readExamCache, writeExamCache, examCacheKey } from '@/lib/exam-cache';
import type { ExamState } from '@/types/exam';

const identity = { userId: 'u', attemptId: 'a', simuladoId: 's' };
const state: ExamState = { simuladoId: 's', answers: {}, currentQuestionIndex: 0,
  tabExitCount: 0, fullscreenExitCount: 0, status: 'in_progress',
  startedAt: '2026-01-01T00:00:00Z', effectiveDeadline: '2026-01-01T01:00:00Z', lastSavedAt: '2026-01-01T00:01:00Z' };
beforeEach(() => localStorage.clear());
it('round trips a validated identity and dirty snapshot, never another account/attempt', () => {
  writeExamCache(identity, state, ['q']);
  expect(readExamCache(identity)).toMatchObject({ ...identity, state, dirtyQuestionIds: ['q'] });
  expect(readExamCache({ ...identity, userId: 'other' })).toBeNull();
  expect(readExamCache({ ...identity, attemptId: 'other' })).toBeNull();
});
it('rejects corrupted and arbitrary payloads without deleting legacy data', () => {
  localStorage.setItem('enamed_exam_s', JSON.stringify(state));
  for (const payload of ['{', '{}', JSON.stringify({ version: 1, ...identity, state: { ...state, answers: { q: {} } }, dirtyQuestionIds: [] })]) {
    localStorage.setItem(examCacheKey(identity), payload);
    expect(readExamCache(identity)).toBeNull();
  }
  expect(localStorage.getItem('enamed_exam_s')).not.toBeNull();
});
it('survives blocked storage', () => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(readExamCache(identity)).toBeNull();
  expect(() => writeExamCache(identity, state, [])).not.toThrow();
  read.mockRestore(); write.mockRestore();
});
it('preserves finite versions and rejects corrupted answer versions', () => {
  const answer = { questionId: 'q', selectedOption: null, markedForReview: false,
    highConfidence: false, eliminatedAlternatives: [], confidence: null, clientUpdatedAt: '2026-01-01T00:01:00.001Z' };
  writeExamCache(identity, { ...state, answers: { q: answer } }, ['q']);
  expect(readExamCache(identity)?.state.answers.q.clientUpdatedAt).toBe(answer.clientUpdatedAt);
  const payload = JSON.parse(localStorage.getItem(examCacheKey(identity))!);
  payload.state.answers.q.clientUpdatedAt = 'infinity';
  localStorage.setItem(examCacheKey(identity), JSON.stringify(payload));
  expect(readExamCache(identity)).toBeNull();
});

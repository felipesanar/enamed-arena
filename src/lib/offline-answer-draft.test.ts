import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAnswerDraft, saveAnswerDraft, removeAnswerDraft } from './offline-answer-draft';
const scope = { userId: 'u1', attemptId: 'a1', simuladoId: 's1', caderno: 'natural' };
const grid = [{ id: 'q1', number: 1, options: [{ id: 'o1', label: 'A' }] }];
describe('offline answer draft', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it('restores only exact identity and filters foreign question/option IDs', () => {
    saveAnswerDraft(scope, { q1: 'o1', other: 'o1' });
    expect(readAnswerDraft(scope, grid)).toEqual({ q1: 'o1' });
    for (const different of [{ userId: 'u2' }, { attemptId: 'a2' }, { simuladoId: 's2' }, { caderno: 'blue' }]) {
      expect(readAnswerDraft({ ...scope, ...different }, grid)).toEqual({});
    }
    expect(readAnswerDraft(scope, [{ ...grid[0], options: [{ id: 'new' }] }])).toEqual({});
    removeAnswerDraft({ ...scope, userId: 'u2' });
    expect(readAnswerDraft(scope, grid)).toEqual({ q1: 'o1' });
  });
  it('reports blocked persistence without losing in-memory responsibility', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(saveAnswerDraft(scope, { q1: 'o1' })).toBe(false);
  });
});

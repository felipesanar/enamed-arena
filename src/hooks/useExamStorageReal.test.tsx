import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamState } from '@/types/exam';
const { api } = vi.hoisted(() => ({ api: {
  submitAttempt: vi.fn(), getAttempt: vi.fn(), getAnswers: vi.fn(),
    updateAttempt: vi.fn(), bulkUpsertAnswers: vi.fn(), enqueueAttemptReprocessing: vi.fn(), createAttempt: vi.fn(),
} }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: api }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { useExamStorageReal } from '@/hooks/useExamStorageReal';

const state: ExamState = { simuladoId: 'sim', status: 'in_progress', currentQuestionIndex: 0,
  answers: { blank: { questionId: 'blank', selectedOption: null, markedForReview: true, highConfidence: false, eliminatedAlternatives: [], confidence: null } },
  tabExitCount: 0, fullscreenExitCount: 0, startedAt: new Date().toISOString(),
  effectiveDeadline: new Date(Date.now() - 60_000).toISOString(), lastSavedAt: '' };

describe('finalization storage', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear();
    api.submitAttempt.mockResolvedValue({ score_percentage: 10 });
    api.getAnswers.mockResolvedValue([]);
    api.updateAttempt.mockResolvedValue(undefined);
    api.bulkUpsertAnswers.mockResolvedValue(undefined);
  });
  it.each([true, false])('resumes an expired tab without rewriting answers (auto=%s)', async (auto) => {
    const { result } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    await act(async () => { await result.current.submitAttempt(state, auto); });
    expect(api.updateAttempt).not.toHaveBeenCalled();
    expect(api.bulkUpsertAnswers).not.toHaveBeenCalled();
    expect(api.getAnswers).not.toHaveBeenCalled();
    expect(api.submitAttempt).toHaveBeenCalledWith('attempt', auto);
  });
  it('flushes only dirty answers during automatic submission within grace', async () => {
    const { result } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    result.current.markAnswerDirty('blank');
    await act(async () => { await result.current.submitAttempt({ ...state, effectiveDeadline: new Date().toISOString() }, true); });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledTimes(1);
    expect(api.getAnswers).not.toHaveBeenCalled();
    expect(api.submitAttempt).toHaveBeenCalledWith('attempt', true);
  });
  it('does not report success for a missing result', async () => {
    api.submitAttempt.mockResolvedValue(null);
    const { result } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    await expect(result.current.submitAttempt(state, true)).rejects.toThrow();
    expect(localStorage.getItem('enamed_exam_sim')).toBeNull();
  });
  it('preserves session errors even when enqueue also fails', async () => {
    vi.useFakeTimers();
    const error = { code: 'PGRST301', message: 'JWT expired' };
    api.submitAttempt.mockRejectedValue(error);
    api.enqueueAttemptReprocessing.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    const pending = result.current.submitAttempt(state, true);
    const assertion = expect(pending).rejects.toBe(error);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await assertion;
    expect(localStorage.getItem('enamed_exam_sim')).toBeNull();
  });
  it('never queues an incomplete early manual submission for automatic processing', async () => {
    vi.useFakeTimers();
    api.getAnswers.mockResolvedValue([{ question_id: 'blank' }]);
    api.submitAttempt.mockRejectedValue(new Error('Cannot submit: 90 question(s) unanswered'));
    const { result } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    const assertion = expect(result.current.submitAttempt({ ...state,
      effectiveDeadline: new Date(Date.now()+60_000).toISOString() })).rejects.toThrow('unanswered');
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await assertion;
    expect(api.enqueueAttemptReprocessing).not.toHaveBeenCalled();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('storage attempt identity', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.resetAllMocks(); localStorage.clear();
    api.submitAttempt.mockResolvedValue({ score_percentage: 10 });
    api.updateAttempt.mockResolvedValue(undefined);
    api.bulkUpsertAnswers.mockResolvedValue(undefined);
    api.getAnswers.mockResolvedValue([{ question_id: 'a' }]);
  });
  afterEach(() => vi.useRealTimers());

  function setup() {
    const answer = (questionId: string) => ({ questionId, selectedOption: `option-${questionId}`,
      markedForReview: false, highConfidence: false, eliminatedAlternatives: [], confidence: null });
    const a: ExamState = { ...state, simuladoId: 'A', effectiveDeadline: new Date(Date.now()+60_000).toISOString(),
      answers: { a: answer('a') } };
    const b: ExamState = { ...a, simuladoId: 'B', answers: { b: answer('b') } };
    const hook = renderHook(({ simuladoId }) => useExamStorageReal(simuladoId), { initialProps: { simuladoId: 'A' } });
    hook.result.current.attemptId.current = 'attempt-A';
    hook.result.current.markAnswerDirty('a');
    const switchToB = () => {
      hook.rerender({ simuladoId: 'B' });
      hook.result.current.attemptId.current = 'attempt-B';
      hook.result.current.markAnswerDirty('b');
    };
    const expectOnlyA = () => {
      for (const method of [api.updateAttempt, api.bulkUpsertAnswers, api.getAnswers, api.submitAttempt, api.enqueueAttemptReprocessing]) {
        for (const [id] of method.mock.calls) expect(id).toBe('attempt-A');
      }
    };
    const expectBStillDirty = async () => {
      api.bulkUpsertAnswers.mockResolvedValue(undefined);
      api.submitAttempt.mockResolvedValue({ score_percentage: 10 });
      const previousWrites = api.bulkUpsertAnswers.mock.calls.length;
      await act(async () => { await hook.result.current.submitAttempt(b, true); });
      expect(api.bulkUpsertAnswers.mock.calls.slice(previousWrites)).toEqual([['attempt-B', b.answers]]);
    };
    return { ...hook, a, b, switchToB, expectOnlyA, expectBStillDirty };
  }

  it.each(['metadata', 'flush'] as const)('pins submit A across navigation during %s and preserves dirty B', async (stage) => {
    const pending = deferred<void>();
    if (stage === 'metadata') api.updateAttempt.mockReturnValueOnce(pending.promise);
    else api.bulkUpsertAnswers.mockReturnValueOnce(pending.promise);
    const { result, a, switchToB, expectOnlyA, expectBStillDirty } = setup();
    let submission!: Promise<unknown>;
    await act(async () => { submission = result.current.submitAttempt(a, stage === 'metadata'); });
    switchToB();
    await act(async () => { pending.resolve(); await submission; });
    expectOnlyA();
    expect(api.bulkUpsertAnswers.mock.calls[0]).toEqual(['attempt-A', a.answers]);
    expect(api.submitAttempt).toHaveBeenCalledExactlyOnceWith('attempt-A', stage === 'metadata');
    await expectBStillDirty();
  });

  it('pins all finalize retries and failure enqueue to A after its ref changes', async () => {
    const pending = deferred<never>();
    const error = new Error('Failed to fetch');
    api.submitAttempt.mockReturnValueOnce(pending.promise).mockRejectedValue(error);
    const { result, a, switchToB, expectOnlyA, expectBStillDirty } = setup();
    let submission!: Promise<unknown>;
    await act(async () => { submission = result.current.submitAttempt(a, true); });
    const assertion = expect(submission).rejects.toBe(error);
    switchToB();
    await act(async () => { pending.reject(error); await vi.advanceTimersByTimeAsync(2000); await assertion; });
    expectOnlyA();
    expect(api.submitAttempt).toHaveBeenCalledTimes(3);
    expect(api.enqueueAttemptReprocessing).toHaveBeenCalledWith('attempt-A', expect.any(String));
    await expectBStillDirty();
  });

  it('does not restore failed A dirty IDs into B after a debounced sync retry', async () => {
    const pending = deferred<void>();
    const error = new Error('Write failed');
    api.bulkUpsertAnswers.mockReturnValueOnce(pending.promise).mockRejectedValue(error);
    const { result, a, b, switchToB, expectOnlyA } = setup();
    act(() => result.current.saveStateDebounced(a));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    switchToB();
    // If A restores its dirty id, a later B state containing that id exposes the leak.
    b.answers.a = { ...a.answers.a, selectedOption: 'must-not-sync' };
    await act(async () => { pending.reject(error); await vi.advanceTimersByTimeAsync(2000); });
    expectOnlyA();
    expect(api.bulkUpsertAnswers).toHaveBeenCalledTimes(3);
    // Only B's explicitly dirty answer should be written, not A's restored id.
    api.bulkUpsertAnswers.mockResolvedValue(undefined);
    const before = api.bulkUpsertAnswers.mock.calls.length;
    await act(async () => { await result.current.submitAttempt(b, true); });
    expect(api.bulkUpsertAnswers.mock.calls.slice(before)).toEqual([['attempt-B', { b: b.answers.b }]]);
  });

  it('snapshots answers before metadata awaits, including nested elimination lists', async () => {
    const pending = deferred<void>();
    api.updateAttempt.mockReturnValueOnce(pending.promise);
    const { result, a } = setup();
    let submission!: Promise<unknown>;
    await act(async () => { submission = result.current.submitAttempt(a, true); });
    a.answers.a.selectedOption = 'later-selection';
    a.answers.a.eliminatedAlternatives.push('later-elimination');
    await act(async () => { pending.resolve(); await submission; });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt-A', {
      a: expect.objectContaining({ selectedOption: 'option-a', eliminatedAlternatives: [] }),
    });
  });

  it('rejects a final state from a different simulado before any DB write', async () => {
    const { result, a, switchToB } = setup();
    const previous = result.current;
    switchToB();
    await expect(result.current.submitAttempt(a, true)).rejects.toThrow(/simulado/i);
    await expect(result.current.flushPendingState(a)).rejects.toThrow(/simulado/i);
    await expect(result.current.ensureAllAnswersPersisted(a)).rejects.toThrow(/simulado/i);
    await expect(previous.submitAttempt(a, true)).rejects.toThrow(/simulado/i);
    await expect(previous.flushPendingState(a)).rejects.toThrow(/simulado/i);
    await expect(previous.ensureAllAnswersPersisted(a)).rejects.toThrow(/simulado/i);
    expect(() => previous.saveStateDebounced(a)).toThrow(/simulado/i);
    expect(api.updateAttempt).not.toHaveBeenCalled();
    expect(api.bulkUpsertAnswers).not.toHaveBeenCalled();
    expect(api.submitAttempt).not.toHaveBeenCalled();
  });

  it('pins metadata and answer-read retries to A while B has a pending debounce', async () => {
    const metadata = deferred<void>();
    const answerRead = deferred<{ question_id: string }[]>();
    api.updateAttempt.mockReturnValueOnce(metadata.promise);
    api.getAnswers.mockReturnValueOnce(answerRead.promise).mockResolvedValue([{ question_id: 'a' }]);
    const { result, a, b, switchToB } = setup();
    let submission!: Promise<unknown>;
    await act(async () => { submission = result.current.submitAttempt(a); });
    switchToB();
    act(() => result.current.saveStateDebounced(b));
    expect(result.current.isSaving).toBe(true);
    await act(async () => { metadata.reject(new Error('metadata retry')); await vi.advanceTimersByTimeAsync(350); });
    expect(api.updateAttempt.mock.calls.map(([id]) => id)).toEqual(['attempt-A', 'attempt-A']);
    await act(async () => {
      answerRead.reject(new Error('read retry'));
      await vi.advanceTimersByTimeAsync(350);
      await submission;
    });
    expect(api.getAnswers.mock.calls.map(([id]) => id)).toEqual(['attempt-A', 'attempt-A']);
    expect(api.submitAttempt).toHaveBeenCalledExactlyOnceWith('attempt-A', false);
    expect(result.current.isSaving).toBe(true);
    expect(JSON.parse(localStorage.getItem('enamed_exam_B')!).status).toBe('in_progress');
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(api.bulkUpsertAnswers).toHaveBeenLastCalledWith('attempt-B', b.answers);
    expect(result.current.isSaving).toBe(false);
  });

  it.each([true, false])('keeps newer edits dirty while A sync/flush succeeds (auto=%s)', async (auto) => {
    const metadata = deferred<void>();
    api.updateAttempt.mockReturnValueOnce(metadata.promise);
    const { result, a } = setup();
    let submission!: Promise<unknown>;
    await act(async () => { submission = result.current.submitAttempt(a, auto); });
    const newer: ExamState = { ...a, answers: { a: { ...a.answers.a, selectedOption: 'newer' } } };
    result.current.markAnswerDirty('a');
    await act(async () => { metadata.resolve(); await submission; });
    const before = api.bulkUpsertAnswers.mock.calls.length;
    await act(async () => { await result.current.submitAttempt(newer, true); });
    expect(api.bulkUpsertAnswers.mock.calls.slice(before)).toEqual([['attempt-A', newer.answers]]);
  });

  it('does not let a late A load replace the B attempt ref or dirty batch', async () => {
    const oldLoad = deferred<{ id: string; simulado_id: string }>();
    api.getAttempt.mockReturnValueOnce(oldLoad.promise).mockResolvedValue({ id: 'attempt-B', simulado_id: 'B', status: 'in_progress' });
    api.getAnswers.mockResolvedValue([]);
    const { result, b, switchToB, expectBStillDirty } = setup();
    let loadingA!: ReturnType<typeof result.current.loadState>;
    await act(async () => { loadingA = result.current.loadState(); });
    switchToB();
    await act(async () => { await result.current.loadState(); });
    result.current.markAnswerDirty('b');
    act(() => result.current.saveStateDebounced(b));
    await act(async () => { oldLoad.resolve({ id: 'attempt-A', simulado_id: 'A' }); await loadingA; });
    expect(result.current.attemptId.current).toBe('attempt-B');
    expect(result.current.isSaving).toBe(true);
    expect(localStorage.getItem('enamed_exam_A')).toBeNull();
    await expectBStillDirty();
  });

  it('keeps the operation id when only the attempt ref changes within a simulado', async () => {
    const metadata = deferred<void>();
    api.updateAttempt.mockReturnValueOnce(metadata.promise);
    const { result, a, expectOnlyA } = setup();
    let submission!: Promise<unknown>;
    await act(async () => { submission = result.current.submitAttempt(a, true); });
    result.current.attemptId.current = 'replacement-attempt';
    result.current.markAnswerDirty('a');
    await act(async () => { metadata.resolve(); await submission; });
    expectOnlyA();
    expect(localStorage.getItem('enamed_exam_A')).toBeNull();
    const newer: ExamState = { ...a, answers: { a: { ...a.answers.a, selectedOption: 'replacement' } } };
    await act(async () => { await result.current.submitAttempt(newer, true); });
    expect(api.bulkUpsertAnswers).toHaveBeenLastCalledWith('replacement-attempt', newer.answers);
  });

  it('does not let a late A initialization replace the B attempt ref or cache', async () => {
    const creation = deferred<{ id: string; effective_deadline: string; started_at: string }>();
    api.createAttempt.mockReturnValueOnce(creation.promise);
    const { result, a, switchToB, expectBStillDirty } = setup();
    let initialization!: ReturnType<typeof result.current.initializeState>;
    await act(async () => { initialization = result.current.initializeState(1, 60, a.effectiveDeadline!); });
    switchToB();
    await act(async () => {
      creation.resolve({ id: 'created-A', effective_deadline: a.effectiveDeadline!, started_at: a.startedAt! });
      await initialization;
    });
    expect(result.current.attemptId.current).toBe('attempt-B');
    expect(localStorage.getItem('enamed_exam_A')).toBeNull();
    await expectBStillDirty();
  });
});

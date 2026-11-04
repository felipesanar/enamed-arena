import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamState } from '@/types/exam';
import { readExamCache, writeExamCache } from '@/lib/exam-cache';
const { auth, api } = vi.hoisted(() => ({ auth: { user: { id: 'user' } }, api: {
  submitAttempt: vi.fn(), getAttempt: vi.fn(), getAnswers: vi.fn(),
    updateAttempt: vi.fn(), bulkUpsertAnswers: vi.fn(), enqueueAttemptReprocessing: vi.fn(), createAttempt: vi.fn(),
} }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: api }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/services/serverClockApi', () => ({ serverClockApi: { getServerTime: vi.fn() } }));
import { useExamStorageReal } from '@/hooks/useExamStorageReal';
import { useServerClock } from '@/hooks/useServerClock';
import { serverClockApi } from '@/services/serverClockApi';

const state: ExamState = { simuladoId: 'sim', status: 'in_progress', currentQuestionIndex: 0,
  answers: { blank: { questionId: 'blank', selectedOption: null, markedForReview: true, highConfidence: false, eliminatedAlternatives: [], confidence: null } },
  tabExitCount: 0, fullscreenExitCount: 0, startedAt: new Date().toISOString(),
  effectiveDeadline: new Date(Date.now() - 60_000).toISOString(), lastSavedAt: '' };

describe('finalization storage', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear();
    auth.user = { id: 'user' };
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

describe('storage uses the shared server clock', () => {
  const server = Date.parse('2026-01-01T00:00:00Z');
  const identity = { userId: 'user', attemptId: 'attempt', simuladoId: 'sim' };
  beforeEach(() => {
    vi.useFakeTimers(); vi.resetAllMocks(); localStorage.clear(); auth.user = { id: 'user' };
    vi.mocked(serverClockApi.getServerTime).mockResolvedValue(server);
    api.updateAttempt.mockResolvedValue(undefined);
    api.bulkUpsertAnswers.mockResolvedValue(undefined);
    api.getAnswers.mockResolvedValue([{ question_id: 'blank' }]);
    api.submitAttempt.mockResolvedValue({ score_percentage: 10 });
  });
  afterEach(() => vi.useRealTimers());
  const current = (deadline = server + 60000): ExamState => ({ ...state,
    startedAt: new Date(server - 60000).toISOString(), effectiveDeadline: new Date(deadline).toISOString(),
    lastSavedAt: new Date(server - 1000).toISOString(),
    answers: { blank: { ...state.answers.blank, selectedOption: 'pending-option' } } });
  const setup = () => renderHook(() => {
    const clock = useServerClock('user:sim');
    return { clock, storage: useExamStorageReal('sim', clock) };
  });

  it.each([-31536000000, 31536000000])('flushes before manual and automatic submit with OS skew %s', async skew => {
    vi.setSystemTime(server + skew);
    const { result } = setup();
    await act(async () => {});
    result.current.storage.attemptId.current = 'attempt';
    result.current.storage.markAnswerDirty('blank');
    act(() => result.current.storage.saveStateDebounced(current()));
    const cached = readExamCache(identity);
    await act(async () => { await result.current.storage.submitAttempt(current(), false); });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt', current().answers);
    expect(cached?.state.lastSavedAt).toBe(new Date(server).toISOString());
    expect(api.submitAttempt).toHaveBeenCalledWith('attempt', false);
    api.bulkUpsertAnswers.mockClear();
    // OS changes again after synchronization must not affect grace decisions.
    vi.setSystemTime(server - skew);
    result.current.storage.markAnswerDirty('blank');
    await act(async () => { await result.current.storage.submitAttempt(current(server), true); });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt', current().answers);
    expect(api.submitAttempt).toHaveBeenLastCalledWith('attempt', true);
  });

  it.each([-31536000000, 31536000000])('recovers dirty cache after reload with OS skew %s', async skew => {
    vi.setSystemTime(server + skew);
    const hook = setup();
    await act(async () => {});
    hook.result.current.storage.attemptId.current = 'attempt';
    hook.result.current.storage.markAnswerDirty('blank');
    act(() => hook.result.current.storage.saveStateDebounced(current()));
    // Simulate page termination before the request receives an ACK.
    api.updateAttempt.mockReturnValue(new Promise(() => {}));
    hook.unmount();
    api.updateAttempt.mockResolvedValue(undefined);
    api.getAttempt.mockResolvedValue({ id: 'attempt', simulado_id: 'sim', status: 'in_progress',
      current_question_index: 0, tab_exit_count: 0, fullscreen_exit_count: 0,
      started_at: current().startedAt, effective_deadline: current().effectiveDeadline,
      last_saved_at: new Date(server - 500).toISOString() });
    api.getAnswers.mockResolvedValue([]);
    const resumed = setup();
    await act(async () => {});
    await act(async () => {
      expect((await resumed.result.current.storage.loadState()).state?.answers).toEqual(current().answers);
    });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt', current().answers);
  });

  it('does not auto-submit/enqueue with an initially untrusted clock, and retains dirty intent', async () => {
    vi.setSystemTime(server + 31536000000);
    vi.mocked(serverClockApi.getServerTime).mockRejectedValue(new Error('offline'));
    const { result } = setup();
    await act(async () => {});
    result.current.storage.attemptId.current = 'attempt';
    result.current.storage.markAnswerDirty('blank');
    act(() => result.current.storage.saveStateDebounced(current()));
    expect(readExamCache(identity)?.state.lastSavedAt).toBe(current().lastSavedAt);
    await expect(result.current.storage.submitAttempt(current(), true)).rejects.toThrow(/CLOCK_UNAVAILABLE/);
    expect(api.submitAttempt).not.toHaveBeenCalled();
    expect(api.enqueueAttemptReprocessing).not.toHaveBeenCalled();
    expect(readExamCache(identity)?.dirtyQuestionIds).toEqual(['blank']);
  });
});

describe('storage attempt identity', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.resetAllMocks(); localStorage.clear();
    auth.user = { id: 'user' };
    api.submitAttempt.mockResolvedValue({ score_percentage: 10 });
    api.updateAttempt.mockResolvedValue(undefined);
    api.bulkUpsertAnswers.mockResolvedValue(undefined);
    api.getAnswers.mockResolvedValue([{ question_id: 'a' }]);
  });
  afterEach(() => vi.useRealTimers());

  it('flushes memory even when localStorage is unavailable', async () => {
    const { result } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    result.current.markAnswerDirty('blank');
    act(() => result.current.saveStateDebounced(state));
    await act(async () => { await result.current.flushPendingState(); });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt', state.answers);
    read.mockRestore(); write.mockRestore();
  });

  it.each([false, true])('never revives a submitted attempt from dirty cache (answer read fails=%s)', async fail => {
    const cached = { ...state, lastSavedAt: '2099-01-01T00:00:00Z' };
    const identity = { userId: 'user', attemptId: 'attempt', simuladoId: 'sim' };
    writeExamCache(identity, cached, ['blank']);
    api.getAttempt.mockResolvedValue({ id: 'attempt', simulado_id: 'sim', status: 'submitted',
      current_question_index: 0, tab_exit_count: 0, fullscreen_exit_count: 0,
      started_at: state.startedAt, effective_deadline: state.effectiveDeadline, last_saved_at: state.startedAt });
    if (fail) api.getAnswers.mockRejectedValue(new Error('offline'));
    else api.getAnswers.mockResolvedValue([]);
    const { result } = renderHook(() => useExamStorageReal('sim'));
    await act(async () => { expect((await result.current.loadState()).state?.status).toBe('submitted'); });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(api.bulkUpsertAnswers).not.toHaveBeenCalled();
  });

  it('isolates cache and captured cleanup writes across accounts on the same exam', async () => {
    const pending = deferred<void>();
    api.updateAttempt.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'old-attempt';
    result.current.markAnswerDirty('blank');
    act(() => result.current.saveStateDebounced(state));
    const old = result.current;
    auth.user = { id: 'new-user' };
    rerender();
    expect(result.current.loadLocalState()).toBeNull();
    expect(() => old.saveStateDebounced(state)).toThrow();
    result.current.attemptId.current = 'new-attempt';
    const newer = { ...state, answers: { blank: { ...state.answers.blank, selectedOption: 'new' } } };
    result.current.markAnswerDirty('blank');
    act(() => result.current.saveStateDebounced(newer));
    await act(async () => { pending.resolve(); });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('old-attempt', state.answers);
    expect(readExamCache({ userId: 'new-user', attemptId: 'new-attempt', simuladoId: 'sim' })?.dirtyQuestionIds).toEqual(['blank']);
    expect(result.current.getPersistenceSnapshot()?.userId).toBe('new-user');
  });

  it.each(['online', 'hidden', 'unmount'])('flushes the captured latest snapshot on %s', async (event) => {
    const { result, unmount } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    result.current.markAnswerDirty('blank');
    act(() => result.current.saveStateDebounced(state));
    await act(async () => {
      if (event === 'unmount') unmount();
      else if (event === 'online') window.dispatchEvent(new Event('online'));
      else {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt', state.answers);
    vi.restoreAllMocks();
  });

  it('merges a newer dirty cache with DB and persists it on reconnect', async () => {
    const cached = { ...state, lastSavedAt: '2026-01-02T00:00:00Z' };
    writeExamCache({ userId: 'user', attemptId: 'attempt', simuladoId: 'sim' }, cached, ['blank']);
    api.getAttempt.mockResolvedValue({ id: 'attempt', simulado_id: 'sim', status: 'in_progress',
      current_question_index: 0, tab_exit_count: 0, fullscreen_exit_count: 0,
      started_at: state.startedAt, effective_deadline: state.effectiveDeadline, last_saved_at: '2026-01-01T00:00:00Z' });
    api.getAnswers.mockResolvedValue([]);
    const { result } = renderHook(() => useExamStorageReal('sim'));
    await act(async () => { expect((await result.current.loadState()).state?.answers).toEqual(state.answers); });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt', state.answers);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(api.bulkUpsertAnswers).toHaveBeenCalledWith('attempt', state.answers);
    expect(readExamCache({ userId: 'user', attemptId: 'attempt', simuladoId: 'sim' })?.dirtyQuestionIds).toEqual([]);
  });

  it('keeps dirty revisions in cache until the matching ACK, not an older request', async () => {
    const pending = deferred<void>();
    api.bulkUpsertAnswers.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useExamStorageReal('sim'));
    result.current.attemptId.current = 'attempt';
    result.current.markAnswerDirty('blank');
    act(() => result.current.saveStateDebounced(state));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    const identity = { userId: 'user', attemptId: 'attempt', simuladoId: 'sim' };
    expect(readExamCache(identity)?.dirtyQuestionIds).toEqual(['blank']);
    const newer = { ...state, answers: { blank: { ...state.answers.blank, selectedOption: 'new' } } };
    result.current.markAnswerDirty('blank');
    act(() => result.current.saveStateDebounced(newer));
    await act(async () => { pending.resolve(); });
    expect(readExamCache(identity)?.dirtyQuestionIds).toEqual(['blank']);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(api.bulkUpsertAnswers).toHaveBeenLastCalledWith('attempt', newer.answers);
    expect(readExamCache(identity)?.dirtyQuestionIds).toEqual([]);
  });

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
    expect(readExamCache({ userId: 'user', attemptId: 'attempt-B', simuladoId: 'B' })?.state.status).toBe('in_progress');
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

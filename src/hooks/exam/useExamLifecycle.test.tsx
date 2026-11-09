import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamState } from '@/types/exam';
import type { ServerClock } from '@/hooks/useServerClock';
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { useExamLifecycle } from '@/hooks/exam/useExamLifecycle';

describe('trusted clock correction during time-up grace', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());
  function setup(remainingMs = 0) {
    const epoch = Date.now();
    let offset = 0;
    let owned = true;
    const now = () => epoch + performance.now() + offset;
    const initial: ExamState = { simuladoId: 'sim', status: 'in_progress', currentQuestionIndex: 0, answers: {},
      tabExitCount: 0, fullscreenExitCount: 0, startedAt: new Date(epoch).toISOString(),
      effectiveDeadline: new Date(epoch + remainingMs).toISOString(), lastSavedAt: '' };
    const storage = { loadState: vi.fn(() => new Promise<never>(() => {})), initializeState: vi.fn(),
      submitAttempt: vi.fn().mockResolvedValue({ score_percentage: 0, is_within_window: true }),
      setResultNotification: vi.fn(), attemptId: { current: 'attempt' } };
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(({ state }) => useExamLifecycle({
      simulado: { id: 'sim', status: 'in_progress', estimatedDurationMinutes: 1, executionWindowEnd: null },
      state, setState: vi.fn(), storage, questions: [{ id: 'q' }] as any, questionIds: ['q'], id: 'sim',
      navigate: vi.fn(), loadingSimulado: false, isOnboardingComplete: true, setShowSubmitModal: vi.fn(),
      clock: { now, status: 'synced', ready: true }, canWrite: () => owned,
    }), { wrapper, initialProps: { state: initial } });
    return { ...hook, storage, initial, correct: (value: number) => { offset = value; },
      own: (value: boolean) => { owned = value; } };
  }

  it('cancels the old grace, unlocks and rearms only at the corrected real deadline', async () => {
    const h = setup();
    expect(h.result.current.interactionLocked).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    h.correct(-5500);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(h.result.current.timeRemaining).toBe(4);
    expect(h.result.current.interactionLocked).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(h.storage.submitAttempt).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(h.result.current.interactionLocked).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(h.storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(h.initial, true);
  });

  it('uses milliseconds for an initial deadline only 500ms away and for direct automatic submission', async () => {
    const h = setup(500);
    expect(h.result.current.timeRemaining).toBe(0);
    expect(h.result.current.interactionLocked).toBe(false);
    await act(async () => { await h.result.current.finalize(true); });
    expect(h.storage.submitAttempt).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(h.result.current.interactionLocked).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(h.storage.submitAttempt).toHaveBeenCalledTimes(1);
  });

  it('rechecks a sub-second correction at the timeout even when displayed remaining stays zero', async () => {
    const h = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(1900); });
    h.correct(-2400);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(h.result.current.timeRemaining).toBe(0);
    expect(h.storage.submitAttempt).not.toHaveBeenCalled();
    expect(h.result.current.interactionLocked).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(h.storage.submitAttempt).toHaveBeenCalledTimes(1);
  });

  it('uses live ownership and the latest answer snapshot when grace is rearmed', async () => {
    const h = setup();
    const updated: ExamState = { ...h.initial, answers: { q: { questionId: 'q', selectedOption: 'opt',
      markedForReview: false, highConfidence: false, eliminatedAlternatives: [], confidence: null } } };
    h.rerender({ state: updated });
    h.own(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(h.storage.submitAttempt).not.toHaveBeenCalled();
    h.own(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(h.storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(updated, true);
  });

  it('does not submit an attempt whose live state changed during grace', async () => {
    const h = setup();
    h.rerender({ state: { ...h.initial, status: 'submitted' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(h.storage.submitAttempt).not.toHaveBeenCalled();
  });

  it('does not cancel or rearm a submission that already started', async () => {
    const h = setup();
    let resolve!: (value: { score_percentage: number; is_within_window: boolean }) => void;
    h.storage.submitAttempt.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(h.result.current.submitting).toBe(true);
    h.correct(-10000);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(h.result.current.timeRemaining).toBe(7);
    expect(h.result.current.interactionLocked).toBe(true);
    await act(async () => { resolve({ score_percentage: 0, is_within_window: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(h.storage.submitAttempt).toHaveBeenCalledTimes(1);
  });

  it('treats a non-boolean argument (e.g. a click event) as a manual submission before the deadline', async () => {
    const h = setup(5000);
    const clickEvent = { type: 'click' } as unknown as boolean;
    await act(async () => { await h.result.current.finalize(clickEvent); });
    expect(h.storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(h.initial, false);
  });

  it.each([
    { code: 'P0001', message: 'UNANSWERED_QUESTIONS' },
    { code: '22023', message: 'Invalid argument' },
    { code: '42501', message: 'Permission denied' },
  ])('allows one automatic submission after a known manual rejection ($code)', async error => {
    const h = setup(5000);
    h.storage.submitAttempt.mockRejectedValueOnce(error);
    await act(async () => { await h.result.current.finalize(false); });
    expect(h.storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(h.initial, false);
    expect(h.initial.status).toBe('in_progress');
    expect(h.result.current.hasFinalized.current).toBe(false);
    expect(h.result.current.submitting).toBe(false);
    expect(h.result.current.interactionLocked).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(h.storage.submitAttempt).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
    expect(h.storage.submitAttempt).toHaveBeenCalledTimes(2);
    expect(h.storage.submitAttempt).toHaveBeenNthCalledWith(2, h.initial, true);
  });

  it.each([new Error('Failed to fetch'), { code: 'XX000', message: 'Internal error' }, null])(
    'does not auto-repeat a manual submission with an uncertain outcome (%j)', async error => {
      const h = setup(5000);
      if (error) h.storage.submitAttempt.mockRejectedValueOnce(error);
      else h.storage.submitAttempt.mockResolvedValueOnce(null);
      await act(async () => { await h.result.current.finalize(false); });
      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(h.storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(h.initial, false);
    },
  );

  it('does not erase an earlier uncertain manual outcome after a known rejection on explicit retry', async () => {
    const h = setup(5000);
    h.storage.submitAttempt.mockRejectedValueOnce(new Error('Failed to fetch'));
    await act(async () => { await h.result.current.finalize(false); });
    h.storage.submitAttempt.mockRejectedValueOnce({ code: 'P0001', message: 'UNANSWERED_QUESTIONS' });
    await act(async () => { await h.result.current.finalize(false); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(h.storage.submitAttempt).toHaveBeenCalledTimes(2);
    expect(h.storage.submitAttempt.mock.calls.every(([, auto]) => auto === false)).toBe(true);
  });

  it('does not rearm an automatic submission even after a known rejection', async () => {
    const h = setup();
    h.storage.submitAttempt.mockRejectedValueOnce({ code: 'P0001', message: 'UNANSWERED_QUESTIONS' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    h.correct(-10000);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(h.storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(h.initial, true);
  });
});

it.each([false, true])('reconciles fallback zero only after trusted time and ownership (past=%s)', async past => {
  vi.useFakeTimers(); vi.clearAllMocks();
  const initial: ExamState = { simuladoId: 'sim', status: 'in_progress', currentQuestionIndex: 0, answers: {},
    tabExitCount: 0, fullscreenExitCount: 0, startedAt: new Date().toISOString(),
    effectiveDeadline: new Date(Date.now() + 10000).toISOString(), lastSavedAt: '' };
  const storage = { loadState: vi.fn(() => new Promise<never>(() => {})), initializeState: vi.fn(),
    submitAttempt: vi.fn().mockResolvedValue({ score_percentage: 0, is_within_window: true }),
    setResultNotification: vi.fn(), attemptId: { current: 'attempt' } };
  const epoch = Date.now();
  let offset = 0; let owned = true;
  const now = () => epoch + performance.now() + offset;
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender, unmount } = renderHook(({ status }: { status: ServerClock['status'] }) => useExamLifecycle({
    simulado: { id: 'sim', status: 'in_progress', estimatedDurationMinutes: 1, executionWindowEnd: null },
    state: initial, setState: vi.fn(), storage, questions: [{ id: 'q' }] as any, questionIds: ['q'], id: 'sim',
    navigate: vi.fn(), loadingSimulado: false, isOnboardingComplete: true, setShowSubmitModal: vi.fn(),
    clock: { now, status, ready: status !== 'pending' }, canWrite: () => owned,
  }), { wrapper, initialProps: { status: 'pending' } });
  expect(result.current.interactionLocked).toBe(true);
  rerender({ status: 'fallback' });
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.timeRemaining).toBe(9);
  act(() => vi.advanceTimersByTime(11000));
  expect(result.current.timeRemaining).toBe(0);
  expect(result.current.interactionLocked).toBe(false);
  expect(storage.submitAttempt).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Tempo esgotado!' }));
  owned = false;
  offset = past ? 0 : -10000;
  rerender({ status: 'synced' });
  expect(result.current.timeRemaining).toBe(past ? 0 : 8);
  act(() => vi.advanceTimersByTime(1000));
  expect(storage.submitAttempt).not.toHaveBeenCalled();
  owned = true;
  await act(async () => { await vi.advanceTimersByTimeAsync(past ? 4000 : 12000); });
  expect(storage.submitAttempt).toHaveBeenCalledTimes(1);
  expect(toast.mock.calls.filter(([value]) => value.title === 'Tempo esgotado!')).toHaveLength(1);
  unmount(); client.clear(); vi.useRealTimers();
});

describe('lifecycle result release copy', () => {
  it.each([
    ['2027-02-10T01:00:00Z', '09/02/2027, 22:00'],
    [undefined, 'liberação dos resultados'],
  ])('uses the current exam release date in Brasilia: %s', async (resultsReleaseAt, expected) => {
    vi.clearAllMocks();
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const storage = { loadState: vi.fn().mockResolvedValue({ state: null, notifyResultEmail: false }),
      initializeState: vi.fn().mockRejectedValue(new Error('PRESENCIAL_ATTEMPT_EXISTS')),
      submitAttempt: vi.fn(), setResultNotification: vi.fn(), attemptId: { current: null } };
    const simulado = { id: 'sim', status: 'available' as const, estimatedDurationMinutes: 300,
      executionWindowEnd: null, resultsReleaseAt };
    renderHook(() => useExamLifecycle({ simulado, storage, questions: [{ id: 'q' }] as any, questionIds: ['q'],
      id: 'sim', navigate: vi.fn(), loadingSimulado: false, isOnboardingComplete: true,
      state: null, setState: vi.fn(), setShowSubmitModal: vi.fn() }), { wrapper });
    await act(async () => {});
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining(expected) }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('07/09') }));
  });
});

describe('lifecycle time-up', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());
  function setup() {
    const initial: ExamState = { simuladoId: 'sim', status: 'in_progress', currentQuestionIndex: 0, answers: {},
      tabExitCount: 0, fullscreenExitCount: 0, startedAt: new Date().toISOString(),
      effectiveDeadline: new Date(Date.now() - 60_000).toISOString(), lastSavedAt: '' };
    const storage = { loadState: vi.fn().mockResolvedValue({ state: initial, notifyResultEmail: false }),
      initializeState: vi.fn(), submitAttempt: vi.fn(), setResultNotification: vi.fn(), attemptId: { current: 'attempt' }, userId: 'u1' };
    const simulado = { id: 'sim', status: 'in_progress' as const, estimatedDurationMinutes: 1, executionWindowEnd: initial.effectiveDeadline,
      resultsReleaseAt: '2099-02-10T01:00:00Z' };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(() => {
      const [state, setState] = useState(initial);
      return { state, ...useExamLifecycle({ simulado, questions: [{ id: 'q' }] as any, questionIds: ['q'], storage,
        id: 'sim', navigate: vi.fn(), loadingSimulado: false, isOnboardingComplete: true,
        state, setState, setShowSubmitModal: vi.fn() }) };
    }, { wrapper });
    return { ...hook, storage, client };
  }
  it('only marks the submitting account caches stale after confirmed success, without reprocessing', async () => {
    const { result, storage, client } = setup();
    const mine = ['user-performance', 'u1', 'e1']; const other = ['user-performance', 'u2', 'e1'];
    client.setQueryData(mine, {}); client.setQueryData(other, {});
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    storage.submitAttempt.mockRejectedValueOnce(new Error('Failed to fetch'));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(invalidate).not.toHaveBeenCalled();
    storage.submitAttempt.mockResolvedValue({ score_percentage: 10, is_within_window: true });
    await act(async () => { await result.current.finalize(true); });
    expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ refetchType: 'none' }));
    await act(async () => { await result.current.finalize(true); });
    expect(storage.submitAttempt).toHaveBeenCalledTimes(2);
    client.clear();
  });
  it('locks immediately, sends true after delay and only announces confirmed success', async () => {
    const { result, storage } = setup();
    expect(result.current.interactionLocked).toBe(true);
    expect(storage.submitAttempt).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('foi finalizado') }));
    storage.submitAttempt.mockResolvedValue({ score_percentage: 10, is_within_window: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(storage.submitAttempt).toHaveBeenCalledWith(expect.objectContaining({ answers: {} }), true);
    expect(result.current.state.status).toBe('submitted');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Simulado finalizado',
      description: expect.stringContaining('09/02/2099, 22:00 (horário de Brasília)') }));
  });
  it('stays locked after failure and allows retry without false success', async () => {
    const { result, storage } = setup();
    storage.submitAttempt.mockRejectedValue({ message: 'Failed to fetch' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.interactionLocked).toBe(true);
    expect(result.current.state.status).toBe('in_progress');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('conexão') }));
    expect(result.current.hasFinalized.current).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao finalizar', duration: Infinity }));
    expect(toast.mock.calls.find(([value]) => value.title === 'Erro ao finalizar')?.[0]).not.toHaveProperty('action');
    storage.submitAttempt.mockResolvedValue({ score_percentage: 10, is_within_window: true });
    await act(async () => { await result.current.finalize(true); });
    expect(storage.submitAttempt).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe('submitted');
  });
  it('rejects a null result instead of marking submitted', async () => {
    const { result, storage } = setup();
    storage.submitAttempt.mockResolvedValue(null);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.state.status).toBe('in_progress');
    expect(result.current.hasFinalized.current).toBe(false);
  });
});

describe('lifecycle identity changes', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());
  function setup() {
    const a: ExamState = { simuladoId: 'a', status: 'in_progress', currentQuestionIndex: 0, answers: {},
      tabExitCount: 0, fullscreenExitCount: 0, startedAt: new Date().toISOString(),
      effectiveDeadline: new Date(Date.now()-1000).toISOString(), lastSavedAt: '' };
    const b: ExamState = { ...a, simuladoId: 'b', effectiveDeadline: new Date(Date.now()+5000).toISOString() };
    const setState = vi.fn();
    const navigate = vi.fn();
    const storage = { loadState: vi.fn(() => new Promise<never>(() => {})), initializeState: vi.fn(),
      submitAttempt: vi.fn().mockResolvedValue({ score_percentage: 10, is_within_window: true }),
      setResultNotification: vi.fn(), attemptId: { current: 'attempt-a' } };
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(({ state, simuladoId }) => useExamLifecycle({
      simulado: { id: simuladoId, status: 'in_progress', estimatedDurationMinutes: 1, executionWindowEnd: null },
      state, setState, storage, questions: [{ id: 'q' }] as any, questionIds: ['q'], id: simuladoId,
      navigate, loadingSimulado: false, isOnboardingComplete: true, setShowSubmitModal: vi.fn(),
    }), { initialProps: { state: a, simuladoId: 'a' }, wrapper });
    return { ...hook, storage, a, b, setState, navigate };
  }
  it('does not redirect the new session after an old initialization fails', async () => {
    const { rerender, storage, b, navigate } = setup();
    let reject!: (reason: unknown) => void;
    storage.loadState.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    rerender({ state: b, simuladoId: 'b' });
    rerender({ state: { ...b, simuladoId: 'c' }, simuladoId: 'c' });
    await act(async () => { reject(new Error('old failure')); });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('does not update the new session from an old notification request', async () => {
    const { result, rerender, storage, b } = setup();
    let resolve!: () => void;
    storage.setResultNotification.mockReturnValueOnce(new Promise<void>(r => { resolve = r; }));
    let request!: Promise<void>;
    act(() => { request = result.current.setNotifyResultByEmail(true); });
    rerender({ state: b, simuladoId: 'b' });
    await act(async () => { resolve(); await request; });
    expect(result.current.notifyResultByEmail).toBe(false);
    expect(result.current.notificationSaving).toBe(false);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Notificação ativada' }));
  });
  it('cancels the old timeout while B loads, unlocks B, and auto-submits B once', async () => {
    const { result, rerender, storage, a, b } = setup();
    expect(result.current.interactionLocked).toBe(true);
    // Navigation can render the new simulado while the previous state is still loaded.
    rerender({ state: a, simuladoId: 'b' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(storage.submitAttempt).not.toHaveBeenCalled();
    storage.attemptId.current = 'attempt-b';
    rerender({ state: b, simuladoId: 'b' });
    expect(result.current.interactionLocked).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.interactionLocked).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(b, true);
    rerender({ state: { ...b }, simuladoId: 'b' });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(storage.submitAttempt).toHaveBeenCalledTimes(1);
  });
  it('resets finalization refs when replacing the attempt within the same simulado', async () => {
    const { result, rerender, storage, a, b } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.hasFinalized.current).toBe(true);
    storage.attemptId.current = 'attempt-a2';
    const next = { ...b, simuladoId: a.simuladoId };
    rerender({ state: next, simuladoId: a.simuladoId });
    expect(result.current.interactionLocked).toBe(false);
    expect(result.current.hasFinalized.current).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(storage.submitAttempt).toHaveBeenCalledTimes(2);
    expect(storage.submitAttempt).toHaveBeenLastCalledWith(next, true);
  });
  it('ignores an in-flight result after navigation', async () => {
    const { result, rerender, storage, b, setState } = setup();
    let resolve!: (result: { score_percentage: number; is_within_window: boolean }) => void;
    storage.submitAttempt.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.submitting).toBe(true);
    storage.attemptId.current = 'attempt-b';
    rerender({ state: b, simuladoId: 'b' });
    await act(async () => { resolve({ score_percentage: 10, is_within_window: true }); });
    expect(setState).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
    expect(result.current.interactionLocked).toBe(false);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Simulado finalizado' }));
  });
  it('rearms when the loaded attempt id changes without changing its deadline', async () => {
    const { rerender, storage, a } = setup();
    // loadState can populate the attempt ref after the first expired-state render.
    storage.attemptId.current = 'loaded-attempt';
    rerender({ state: { ...a }, simuladoId: 'a' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(storage.submitAttempt).toHaveBeenCalledExactlyOnceWith(a, true);
  });
  it('ignores an in-flight failure after navigation', async () => {
    const { result, rerender, storage, b, setState } = setup();
    let reject!: (error: Error) => void;
    storage.submitAttempt.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    storage.attemptId.current = 'attempt-b';
    rerender({ state: b, simuladoId: 'b' });
    await act(async () => { reject(new Error('Failed to fetch')); });
    expect(storage.submitAttempt).toHaveBeenCalledTimes(1);
    expect(setState).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
    expect(result.current.interactionLocked).toBe(false);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao finalizar' }));
  });
});

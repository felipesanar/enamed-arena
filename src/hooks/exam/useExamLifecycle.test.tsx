import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamState } from '@/types/exam';
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { useExamLifecycle } from '@/hooks/exam/useExamLifecycle';

describe('lifecycle time-up', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());
  function setup() {
    const initial: ExamState = { simuladoId: 'sim', status: 'in_progress', currentQuestionIndex: 0, answers: {},
      tabExitCount: 0, fullscreenExitCount: 0, startedAt: new Date().toISOString(),
      effectiveDeadline: new Date(Date.now() - 60_000).toISOString(), lastSavedAt: '' };
    const storage = { loadState: vi.fn().mockResolvedValue({ state: initial, notifyResultEmail: false }),
      initializeState: vi.fn(), submitAttempt: vi.fn(), setResultNotification: vi.fn(), attemptId: { current: 'attempt' } };
    const simulado = { id: 'sim', status: 'in_progress' as const, estimatedDurationMinutes: 1, executionWindowEnd: initial.effectiveDeadline };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(() => {
      const [state, setState] = useState(initial);
      return { state, ...useExamLifecycle({ simulado, questions: [{ id: 'q' }] as any, questionIds: ['q'], storage,
        id: 'sim', navigate: vi.fn(), loadingSimulado: false, isOnboardingComplete: true,
        state, setState, setShowSubmitModal: vi.fn() }) };
    }, { wrapper });
    return { ...hook, storage };
  }
  it('locks immediately, sends true after delay and only announces confirmed success', async () => {
    const { result, storage } = setup();
    expect(result.current.interactionLocked).toBe(true);
    expect(storage.submitAttempt).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('foi finalizado') }));
    storage.submitAttempt.mockResolvedValue({ score_percentage: 10, is_within_window: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(storage.submitAttempt).toHaveBeenCalledWith(expect.objectContaining({ answers: {} }), true);
    expect(result.current.state.status).toBe('submitted');
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
    const storage = { loadState: vi.fn(() => new Promise<never>(() => {})), initializeState: vi.fn(),
      submitAttempt: vi.fn().mockResolvedValue({ score_percentage: 10, is_within_window: true }),
      setResultNotification: vi.fn(), attemptId: { current: 'attempt-a' } };
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(({ state, simuladoId }) => useExamLifecycle({
      simulado: { id: simuladoId, status: 'in_progress', estimatedDurationMinutes: 1, executionWindowEnd: null },
      state, setState, storage, questions: [{ id: 'q' }] as any, questionIds: ['q'], id: simuladoId,
      navigate: vi.fn(), loadingSimulado: false, isOnboardingComplete: true, setShowSubmitModal: vi.fn(),
    }), { initialProps: { state: a, simuladoId: 'a' }, wrapper });
    return { ...hook, storage, a, b, setState };
  }
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

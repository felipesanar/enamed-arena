import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, assert, expect, it, vi } from 'vitest';
const { storage, shortcuts, simulado, questions } = vi.hoisted(() => ({
  storage: { loadState: vi.fn(), initializeState: vi.fn(), submitAttempt: vi.fn(), setResultNotification: vi.fn(),
    saveStateDebounced: vi.fn(), markAnswerDirty: vi.fn(), attemptId: { current: 'attempt' } },
  shortcuts: vi.fn(), simulado: { id: 'sim', status: 'in_progress', estimatedDurationMinutes: 1, executionWindowEnd: null },
  questions: [{ id: 'q', options: [{ id: 'a' }] }],
}));
const lease = vi.hoisted(() => ({ blocked: false, status: 'owned' as const, canWrite: () => !lease.blocked, takeover: vi.fn() }));
const runtime = vi.hoisted(() => ({ mode: 'v1' as 'v1' | 'legacy' | 'pending' | 'error', revision: 'initial', retry: vi.fn() }));
vi.mock('@/hooks/useExamRuntimeCapabilities', () => ({ useExamRuntimeCapabilities: () => runtime }));
// Clock regressions isolate ownership; the real two-tab election is covered in useExamTabLease.test.tsx.
vi.mock('@/hooks/useExamTabLease', () => ({ useExamTabLease: () => lease }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'sim' }), useNavigate: () => vi.fn() }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ isOnboardingComplete: true }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/hooks/useSimuladoDetail', () => ({ useSimuladoDetail: () => ({ simulado, questions, loading: false }) }));
vi.mock('@/hooks/useExamStorageReal', () => ({ useExamStorageReal: vi.fn(() => storage) }));
vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: shortcuts }));
vi.mock('@/hooks/exam/useExamIntegrity', () => ({ useExamIntegrity: vi.fn(() => ({})) }));
vi.mock('@/hooks/exam/useExamBeacon', () => ({ useExamBeacon: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/services/serverClockApi', () => ({ serverClockApi: { getServerTime: vi.fn(async () => Date.now()) } }));
import { serverClockApi } from '@/services/serverClockApi';
import { useExamFlow } from '@/hooks/useExamFlow';
import { useExamIntegrity } from '@/hooks/exam/useExamIntegrity';
import { useExamStorageReal } from '@/hooks/useExamStorageReal';
afterEach(() => { vi.useRealTimers(); runtime.mode = 'v1'; runtime.revision = 'initial'; });
it('ticks legacy fallback through zero without submission or local expiry despite OS jumps', async () => {
  vi.useFakeTimers(); vi.clearAllMocks(); runtime.mode = 'legacy';
  vi.mocked(serverClockApi.getServerTime).mockRejectedValueOnce(new Error('PGRST202'));
  const initial = { simuladoId: 'sim', status: 'in_progress', answers: { q: { selectedOption: 'a' } },
    currentQuestionIndex: 0, effectiveDeadline: new Date(Date.now() + 10000).toISOString(),
    startedAt: new Date().toISOString(), tabExitCount: 0, fullscreenExitCount: 0 };
  storage.loadState.mockResolvedValue({ state: initial, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => {});
  expect(result.current.timeRemaining).toBe(10);
  vi.setSystemTime(Date.now() + 86400000);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.timeRemaining).toBe(9);
  vi.setSystemTime(Date.now() - 172800000);
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(result.current.timeRemaining).toBe(0);
  expect(result.current.clockTrusted).toBe(false);
  expect(result.current.interactionLocked).toBe(false);
  expect(result.current.state).toEqual(initial);
  expect(result.current.isCompleted).toBe(false);
  expect(storage.submitAttempt).not.toHaveBeenCalled();
  expect(storage.saveStateDebounced).not.toHaveBeenCalled();
});

it('retries clock RPC with capabilities and keeps v1 blocked until sync and reconciliation', async () => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.mocked(serverClockApi.getServerTime).mockRejectedValueOnce(new Error('500'));
  const initial = { simuladoId: 'sim', status: 'in_progress', answers: {}, currentQuestionIndex: 0,
    effectiveDeadline: new Date(Date.now() + 60000).toISOString(), startedAt: new Date().toISOString(),
    tabExitCount: 0, fullscreenExitCount: 0 };
  storage.loadState.mockResolvedValue({ state: initial, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender } = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => {});
  expect(result.current.preparation.status).toBe('error');
  const retry = result.current.preparation.retry;
  let resolve!: (n: number) => void;
  vi.mocked(serverClockApi.getServerTime).mockReturnValueOnce(new Promise<number>(r => { resolve = r; }));
  act(() => { result.current.preparation.retry(); });
  expect(serverClockApi.getServerTime).toHaveBeenCalledTimes(2);
  expect(runtime.retry).toHaveBeenCalledOnce();
  expect(result.current.preparation.status).toBe('preparing');
  expect(result.current.preparation.retry).toBe(retry);
  expect(result.current.interactionLocked).toBe(true);
  expect(vi.mocked(useExamStorageReal).mock.calls.at(-1)?.[2]?.()).toBe(false);
  act(() => result.current.handleSelectOption('a'));
  expect(storage.saveStateDebounced).not.toHaveBeenCalled();
  await act(async () => { resolve(Date.now()); });
  expect(result.current.preparation.status).toBe('preparing');
  let reconcile!: (value: { state: typeof initial; notifyResultEmail: boolean }) => void;
  storage.loadState.mockReturnValueOnce(new Promise(r => { reconcile = r; }));
  runtime.revision = 'retried';
  rerender();
  expect(result.current.interactionLocked).toBe(true);
  expect(vi.mocked(useExamStorageReal).mock.calls.at(-1)?.[2]?.()).toBe(false);
  await act(async () => { reconcile({ state: initial, notifyResultEmail: false }); });
  await act(async () => {});
  expect(result.current.preparation.status).toBe('ready');
  expect(result.current.interactionLocked).toBe(false);
  expect(vi.mocked(useExamStorageReal).mock.calls.at(-1)?.[2]?.()).toBe(true);
});

it('denies the storage write guard globally while legacy clock is pending, then allows declared fallback', async () => {
  vi.useFakeTimers(); vi.clearAllMocks(); runtime.mode = 'legacy';
  let reject!: (reason: Error) => void;
  vi.mocked(serverClockApi.getServerTime).mockReturnValueOnce(new Promise<number>((_resolve, fail) => { reject = fail; }));
  storage.loadState.mockResolvedValue({ state: { simuladoId: 'sim', status: 'in_progress', answers: {},
    currentQuestionIndex: 0, effectiveDeadline: new Date(Date.now() + 60000).toISOString(),
    startedAt: new Date().toISOString(), tabExitCount: 0, fullscreenExitCount: 0 }, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => {});
  const canWrite = vi.mocked(useExamStorageReal).mock.calls.at(-1)?.[2];
  expect(canWrite?.()).toBe(false);
  expect(result.current.preparation.status).toBe('preparing');
  await act(async () => { reject(new Error('PGRST202')); });
  expect(canWrite?.()).toBe(true);
  expect(result.current.preparation.status).toBe('ready');
});
it('blocks every mutation and manual/automatic submission without tab ownership', async () => {
  vi.useFakeTimers(); vi.clearAllMocks();
  lease.blocked = true;
  storage.loadState.mockResolvedValue({ state: { simuladoId: 'sim', status: 'in_progress', answers: {},
    currentQuestionIndex: 0, effectiveDeadline: new Date(Date.now() - 1000).toISOString(),
    startedAt: new Date().toISOString(), tabExitCount: 0, fullscreenExitCount: 0 }, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const h = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  act(() => { h.result.current.handleSelectOption('a'); h.result.current.toggleReview(); });
  await act(async () => { await h.result.current.finalize(); await h.result.current.finalize(true); });
  expect(storage.submitAttempt).not.toHaveBeenCalled();
  expect(storage.saveStateDebounced).not.toHaveBeenCalled();
  expect(shortcuts).toHaveBeenLastCalledWith(expect.anything(), { enabled: false });
  h.unmount(); lease.blocked = false;
});
it('does not expire or submit a blank exam from an ahead OS clock when initial sync fails', async () => {
  vi.useFakeTimers(); vi.clearAllMocks();
  const server = Date.parse('2026-01-01T00:00:00Z');
  vi.setSystemTime(server + 31536000000);
  vi.mocked(serverClockApi.getServerTime).mockRejectedValueOnce(new Error('offline'));
  storage.loadState.mockResolvedValue({ state: { simuladoId: 'sim', status: 'in_progress', answers: {},
    currentQuestionIndex: 0, effectiveDeadline: new Date(server + 60000).toISOString(),
    startedAt: new Date(server).toISOString(), tabExitCount: 0, fullscreenExitCount: 0 }, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(storage.submitAttempt).not.toHaveBeenCalled();
  expect(result.current.state?.status).toBe('in_progress');
  expect(useExamIntegrity).toHaveBeenLastCalledWith(expect.objectContaining({ now: expect.any(Function) }));
  expect(result.current.interactionLocked).toBe(true);
  expect(result.current.preparation.status).toBe('error');
  act(() => result.current.handleSelectOption('a'));
  expect(result.current.state?.answers.q).toBeUndefined();
  expect(storage.saveStateDebounced).not.toHaveBeenCalled();
});
it.each([-3600000, 3600000])('permits confirmed legacy editing without clock RPC and never fabricates a version (%s)', async skew => {
  vi.useFakeTimers(); vi.clearAllMocks(); runtime.mode = 'legacy';
  const server = Date.parse('2026-01-01T00:00:00Z');
  vi.setSystemTime(server + skew);
  vi.mocked(serverClockApi.getServerTime).mockRejectedValueOnce(new Error('PGRST202'));
  storage.loadState.mockResolvedValue({ state: { simuladoId: 'sim', status: 'in_progress', answers: {},
    currentQuestionIndex: 0, effectiveDeadline: new Date(server + 60000).toISOString(),
    startedAt: new Date(server).toISOString(), tabExitCount: 0, fullscreenExitCount: 0 }, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const h = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => {});
  expect(h.result.current.preparation.status).toBe('ready');
  expect(h.result.current.interactionLocked).toBe(false);
  act(() => h.result.current.handleSelectOption('a'));
  expect(h.result.current.state?.answers.q).toMatchObject({ selectedOption: 'a', clientUpdatedAt: null });
  expect(storage.saveStateDebounced).toHaveBeenCalled();
  expect(storage.submitAttempt).not.toHaveBeenCalled();
});
it.each(['pending', 'error'] as const)('blocks edits and automatic submission while probe is %s', async mode => {
  vi.useFakeTimers(); vi.clearAllMocks(); runtime.mode = mode;
  storage.loadState.mockResolvedValue({ state: { simuladoId: 'sim', status: 'in_progress', answers: {},
    currentQuestionIndex: 0, effectiveDeadline: new Date(Date.now() - 1000).toISOString(),
    startedAt: new Date().toISOString(), tabExitCount: 0, fullscreenExitCount: 0 }, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const h = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(h.result.current.preparation.status).toBe(mode === 'error' ? 'error' : 'preparing');
  act(() => h.result.current.handleSelectOption('a'));
  await act(async () => { await h.result.current.finalize(true); });
  expect(storage.saveStateDebounced).not.toHaveBeenCalled();
  expect(storage.submitAttempt).not.toHaveBeenCalled();
});
it.each([-3600000, 3600000])('uses server time for interaction locks despite OS skew/change (%s)', async (skew) => {
  vi.useFakeTimers(); vi.clearAllMocks();
  const server = Date.parse('2026-01-01T00:00:00Z');
  vi.setSystemTime(server + skew);
  vi.mocked(serverClockApi.getServerTime).mockResolvedValueOnce(server);
  storage.loadState.mockResolvedValue({ state: { simuladoId: 'sim', status: 'in_progress', answers: {},
    currentQuestionIndex: 0, effectiveDeadline: new Date(server + 3000).toISOString(),
    startedAt: new Date(server).toISOString(), tabExitCount: 0, fullscreenExitCount: 0 }, notifyResultEmail: false });
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => {});
  expect(result.current.interactionLocked).toBe(false);
  act(() => result.current.handleSelectOption('a'));
  expect(result.current.state?.answers.q?.selectedOption).toBe('a');
  expect(Math.abs(Date.parse(result.current.state!.answers.q.clientUpdatedAt!) - server)).toBeLessThan(2000);
  expect(Date.parse(result.current.state!.answers.q.clientUpdatedAt!)).toBeLessThanOrEqual(server + 120000);
  expect(storage.submitAttempt).not.toHaveBeenCalled();
  vi.setSystemTime(server + 86400000);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.timeRemaining).toBe(2);
  expect(result.current.interactionLocked).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(result.current.interactionLocked).toBe(true);
});
it('rejects every answer mutation and shortcut as time expires, including after failure', async () => {
  vi.useFakeTimers(); vi.clearAllMocks();
  storage.loadState.mockResolvedValue({ state: { simuladoId: 'sim', status: 'in_progress', answers: {},
    currentQuestionIndex: 0, effectiveDeadline: new Date(Date.now() + 3000).toISOString(),
    startedAt: new Date().toISOString(), tabExitCount: 0, fullscreenExitCount: 0 }, notifyResultEmail: false });
  storage.submitAttempt.mockRejectedValue(new Error('Failed to fetch'));
  const client = new QueryClient();
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useExamFlow(), { wrapper });
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(result.current.interactionLocked).toBe(true);
  const tryMutations = () => {
    result.current.handleSelectOption('a'); result.current.handleEliminateOption('a');
    result.current.handleSetConfidence('alta'); result.current.toggleReview(); result.current.toggleHighConfidence();
    result.current.handleNavigate(1);
  };
  act(tryMutations);
  const expiredState = result.current.state;
  assert(expiredState !== null, 'The loaded attempt must remain available after expiry');
  expect(expiredState.answers).toEqual({});
  expect(storage.saveStateDebounced).not.toHaveBeenCalled();
  expect(storage.markAnswerDirty).not.toHaveBeenCalled();
  expect(shortcuts).toHaveBeenLastCalledWith(expect.anything(), { enabled: false });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  act(tryMutations);
  const failedState = result.current.state;
  assert(failedState !== null, 'A failed submission must preserve the loaded attempt');
  expect(failedState.answers).toEqual({});
  expect(storage.markAnswerDirty).not.toHaveBeenCalled();
  expect(result.current.submitting).toBe(false);
});

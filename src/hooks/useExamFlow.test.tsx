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
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'sim' }), useNavigate: () => vi.fn() }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ isOnboardingComplete: true }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/hooks/useSimuladoDetail', () => ({ useSimuladoDetail: () => ({ simulado, questions, loading: false }) }));
vi.mock('@/hooks/useExamStorageReal', () => ({ useExamStorageReal: () => storage }));
vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: shortcuts }));
vi.mock('@/hooks/exam/useExamIntegrity', () => ({ useExamIntegrity: vi.fn(() => ({})) }));
vi.mock('@/hooks/exam/useExamBeacon', () => ({ useExamBeacon: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/services/serverClockApi', () => ({ serverClockApi: { getServerTime: vi.fn(async () => Date.now()) } }));
import { serverClockApi } from '@/services/serverClockApi';
import { useExamFlow } from '@/hooks/useExamFlow';
import { useExamIntegrity } from '@/hooks/exam/useExamIntegrity';
afterEach(() => vi.useRealTimers());
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
  expect(result.current.interactionLocked).toBe(false);
  act(() => result.current.handleSelectOption('a'));
  expect(result.current.state?.answers.q?.selectedOption).toBe('a');
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

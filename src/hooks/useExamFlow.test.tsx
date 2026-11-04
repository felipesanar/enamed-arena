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
vi.mock('@/hooks/useSimuladoDetail', () => ({ useSimuladoDetail: () => ({ simulado, questions, loading: false }) }));
vi.mock('@/hooks/useExamStorageReal', () => ({ useExamStorageReal: () => storage }));
vi.mock('@/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: shortcuts }));
vi.mock('@/hooks/exam/useExamIntegrity', () => ({ useExamIntegrity: () => ({}) }));
vi.mock('@/hooks/exam/useExamBeacon', () => ({ useExamBeacon: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import { useExamFlow } from '@/hooks/useExamFlow';
afterEach(() => vi.useRealTimers());
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

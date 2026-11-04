import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useState } from 'react';
import { useExamLifecycle } from '@/hooks/exam/useExamLifecycle';
import type { ExamState } from '@/types/exam';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-a' } as { id: string } | null, authLoading: false, flag: false,
  getSimulado: vi.fn(), getQuestions: vi.fn(), getAttempt: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, loading: mocks.authLoading }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: mocks }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

const config = {
  id: '70aa430e-1cf8-4564-96e5-c080fdbb7abd', slug: 'edicao-real-simulado-1', title: 'Prova',
  sequenceNumber: 1, executionWindowStart: '2020-01-01T00:00:00Z',
  executionWindowEnd: '2020-01-02T00:00:00Z', resultsReleaseAt: '2099-01-01T00:00:00Z',
  editionId: 'edition-real', editionCode: '2027.2', editionLabel: 'ENAMED 2027.2',
};
const trainingAttempt = {
  simulado_id: config.id, status: 'in_progress', started_at: '2020-01-03T00:00:00Z',
  effective_deadline: '2099-01-01T00:00:00Z', is_within_window: false,
};

function setup(routeRef = config.id, includeCorrectAnswers = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...renderHook(() => useSimuladoDetail(routeRef, includeCorrectAnswers), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  }) };
}

describe('useSimuladoDetail direct edition and attempt integration', () => {
  beforeEach(() => {
    mocks.user = { id: 'user-a' }; mocks.authLoading = false; mocks.flag = false;
    mocks.getSimulado.mockReset().mockImplementation(async (_ref, flag) => flag ? config : {
      ...config, editionId: undefined, editionCode: undefined, editionLabel: undefined,
    });
    mocks.getQuestions.mockReset().mockResolvedValue([]);
    mocks.getAttempt.mockReset().mockImplementation(async (_id, _user, type) => type === 'offline' ? null : trainingAttempt);
  });

  it.each([config.id, config.slug])('loads metadata directly for %s and transports the server deadline', async routeRef => {
    mocks.flag = true;
    const { result } = setup(routeRef);
    await waitFor(() => expect(result.current.simulado).not.toBeNull());
    expect(mocks.getSimulado).toHaveBeenCalledWith(routeRef, true);
    expect(mocks.getQuestions).toHaveBeenCalledWith(config.id, false);
    expect(mocks.getAttempt).toHaveBeenCalledWith(config.id, 'user-a', ['online', 'presencial']);
    expect(result.current.simulado).toMatchObject({
      id: config.id, editionId: config.editionId, editionCode: '2027.2', editionLabel: 'ENAMED 2027.2',
      status: 'in_progress', userState: { effectiveDeadline: trainingAttempt.effective_deadline, isWithinWindow: false },
    });
  });

  it('isolates metadata by flag and account without enabling correction reads', async () => {
    const { result, rerender, client } = setup();
    await waitFor(() => expect(result.current.simulado).not.toBeNull());
    expect(mocks.getSimulado).toHaveBeenLastCalledWith(config.id, false);
    expect(result.current.simulado?.editionCode).toBeUndefined();
    mocks.flag = true; rerender();
    await waitFor(() => expect(result.current.simulado?.editionCode).toBe('2027.2'));
    mocks.flag = false; rerender();
    expect(result.current.simulado?.editionCode).toBeUndefined();
    mocks.user = { id: 'user-b' }; rerender();
    await waitFor(() => expect(mocks.getAttempt).toHaveBeenCalledWith(config.id, 'user-b', ['online', 'presencial']));
    expect(client.getQueryCache().getAll().map(query => query.queryKey)).toEqual([
      ['simulado', config.id, 'user-a', false, false],
      ['simulado', config.id, 'user-a', false, true],
      ['simulado', config.id, 'user-b', false, false],
    ]);
    expect(mocks.getQuestions.mock.calls.every(([, corrections]) => corrections === false)).toBe(true);
  });

  it('keeps explicit correction requests in a separate cache and delegates the F0 gate to the API', async () => {
    mocks.flag = true;
    const { result, client } = setup(config.slug, true);
    await waitFor(() => expect(result.current.simulado).not.toBeNull());
    expect(mocks.getQuestions).toHaveBeenCalledWith(config.id, true);
    expect(client.getQueryCache().getAll()[0].queryKey).toEqual(['simulado', config.slug, 'user-a', true, true]);
  });

  it.each([undefined, 'invalid', '2020-01-03T00:00:00Z'])('does not extend an invalid or expired deadline: %s', async deadline => {
    mocks.getAttempt.mockImplementation(async (_id, _user, type) => type === 'offline' ? null : {
      ...trainingAttempt, effective_deadline: deadline,
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.simulado?.status).toBe('available_late'));
    expect(result.current.simulado?.userState?.effectiveDeadline).toBe(deadline);
  });

  it('does not extend an official attempt after the window', async () => {
    mocks.getAttempt.mockImplementation(async (_id, _user, type) => type === 'offline' ? null : {
      ...trainingAttempt, is_within_window: true,
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.simulado?.status).toBe('available_late'));
    expect(result.current.simulado?.userState?.isWithinWindow).toBe(true);
  });

  it('does not fetch while auth is loading and hides cached data on logout', async () => {
    mocks.authLoading = true;
    const { result, rerender } = setup();
    expect(mocks.getSimulado).not.toHaveBeenCalled();
    mocks.authLoading = false; rerender();
    await waitFor(() => expect(result.current.simulado).not.toBeNull());
    const calls = mocks.getSimulado.mock.calls.length;
    mocks.user = null; rerender();
    expect(result.current.simulado).toBeNull();
    expect(result.current.questions).toEqual([]);
    expect(mocks.getSimulado).toHaveBeenCalledTimes(calls);
  });

  it('integrates direct slug loading with the existing timer using the persisted deadline and shared server clock', async () => {
    mocks.flag = true;
    const serverNow = Date.parse('2098-12-01T10:00:00Z');
    const deadline = new Date(serverNow + 60_000).toISOString();
    mocks.getAttempt.mockImplementation(async (_id, _user, type) => type === 'offline' ? null : {
      ...trainingAttempt, effective_deadline: deadline,
    });
    mocks.getQuestions.mockResolvedValue([{ id: 'q', options: [] }]);
    const initial: ExamState = {
      simuladoId: config.id, status: 'in_progress', currentQuestionIndex: 0, answers: {},
      effectiveDeadline: deadline, startedAt: new Date(serverNow - 60_000).toISOString(),
      tabExitCount: 0, fullscreenExitCount: 0, lastSavedAt: '',
    };
    const storage = {
      loadState: vi.fn().mockResolvedValue({ state: initial, notifyResultEmail: false }),
      initializeState: vi.fn(), submitAttempt: vi.fn(), setResultNotification: vi.fn(),
      userId: 'user-a', attemptId: { current: 'attempt-real' },
    };
    const clock = { ready: true, status: 'synced' as const, now: () => serverNow };
    const navigate = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => {
      const detail = useSimuladoDetail(config.slug);
      const [state, setState] = useState<ExamState | null>(null);
      const [, setShowSubmitModal] = useState(false);
      return { detail, state, ...useExamLifecycle({
        simulado: detail.simulado, questions: detail.questions, questionIds: ['q'],
        storage, clock, id: config.slug, navigate, loadingSimulado: detail.loading,
        isOnboardingComplete: true, state, setState, setShowSubmitModal,
      }) };
    }, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await waitFor(() => expect(result.current.timeRemaining).toBe(60));
    expect(result.current.detail.simulado?.editionCode).toBe('2027.2');
    expect(result.current.detail.simulado?.userState?.effectiveDeadline).toBe(deadline);
    expect(result.current.state?.effectiveDeadline).toBe(deadline);
    expect(result.current.interactionLocked).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.initializeState).not.toHaveBeenCalled();
    expect(storage.submitAttempt).not.toHaveBeenCalled();
  });
});

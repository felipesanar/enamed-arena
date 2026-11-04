import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExamResult } from './useExamResult';
const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as { id: string } | null, loading: false },
  config: vi.fn(), attempt: vi.fn(), answers: vi.fn(), results: vi.fn(), access: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.access } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: {
  getSimulado: mocks.config, getAttempt: mocks.attempt, getAnswers: mocks.answers, getAttemptQuestionResults: mocks.results,
} }));
const clients: QueryClient[] = [];
function setup(id = 'slug') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper, ...renderHook(({ route }) => useExamResult(route), { wrapper, initialProps: { route: id } }) };
}
beforeEach(() => {
  mocks.auth.user = { id: 'u1' };
  mocks.access.mockReset().mockResolvedValue({ data: { capabilities: [] }, error: null });
  mocks.config.mockReset().mockResolvedValue({ id: 'uuid', resultsReleaseAt: '2020-01-01T00:00:00Z' });
  mocks.attempt.mockReset().mockImplementation(async (_s, _u, mode) => mode === 'offline' ? null : {
    id: 'a1', simulado_id: 'uuid', status: 'submitted', score_percentage: 60, finished_at: '2020-01-01',
  });
  mocks.answers.mockReset().mockResolvedValue([]);
  mocks.results.mockReset().mockResolvedValue([{ question_id: 'q', is_correct: true }]);
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.useRealTimers(); vi.restoreAllMocks(); });
describe('useExamResult', () => {
  it('resolves slug to canonical UUID, caches five minutes and ignores token refresh', async () => {
    const first = setup();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.attemptQuestionResults.q).toMatchObject({ is_correct: true });
    expect(mocks.attempt).toHaveBeenCalledWith('uuid', 'u1', ['online', 'presencial']);
    mocks.auth.user = { id: 'u1' }; first.rerender({ route: 'slug' });
    expect(mocks.config).toHaveBeenCalledTimes(1);
    expect(mocks.access).toHaveBeenCalledTimes(1);
    first.unmount();
    const next = renderHook(() => useExamResult('slug'), { wrapper: first.wrapper });
    expect(next.result.current.attemptId).toBe('a1'); expect(mocks.results).toHaveBeenCalledTimes(1);
  });
  it('logout/account changes synchronously hide cached data and late responses', async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.auth.user = { id: 'u2' }; mocks.config.mockReturnValue(new Promise(() => {})); rerender({ route: 'slug' });
    expect(result.current.attempt).toBeNull(); expect(result.current.attemptQuestionResults).toEqual({});
    mocks.auth.user = null; rerender({ route: 'slug' });
    expect(result.current.examState).toBeNull(); expect(result.current.loading).toBe(false);
  });
  it('does not query AQR or expose cached scores before release; refreshes at release', async () => {
    const release = Date.now() + 60_000;
    mocks.config.mockResolvedValue({ id: 'uuid', resultsReleaseAt: new Date(release).toISOString() });
    const { result, unmount, wrapper } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.results).not.toHaveBeenCalled();
    expect(result.current.attempt?.score_percentage).toBeNull();
    unmount();
    vi.spyOn(Date, 'now').mockReturnValue(release + 1);
    const next = renderHook(() => useExamResult('slug'), { wrapper });
    await waitFor(() => expect(next.result.current.attemptQuestionResults.q).toBeDefined());
    expect(mocks.config).toHaveBeenCalledTimes(2);
  });
  it('surfaces failures and public refetch retries', async () => {
    mocks.config.mockRejectedValueOnce(new Error('offline'));
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe('offline'));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
  it('preserves server-authorized results.view preview without extending it to another account', async () => {
    mocks.access.mockResolvedValue({ data: { capabilities: ['results.view'] }, error: null });
    mocks.config.mockResolvedValue({ id: 'uuid', resultsReleaseAt: '2099-01-01T00:00:00Z' });
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.attemptQuestionResults.q).toBeDefined();
    expect(mocks.access).toHaveBeenCalledWith('admin_get_access');
    mocks.auth.user = { id: 'u2' }; mocks.access.mockReturnValue(new Promise(() => {})); rerender({ route: 'slug' });
    expect(result.current.attemptQuestionResults).toEqual({}); expect(result.current.attempt).toBeNull();
  });
  it('surfaces access errors and retries permission without exposing early results', async () => {
    mocks.access.mockResolvedValueOnce({ data: null, error: new Error('access offline') });
    mocks.config.mockResolvedValue({ id: 'uuid', resultsReleaseAt: '2099-01-01T00:00:00Z' });
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe('access offline'));
    expect(result.current.attemptQuestionResults).toEqual({});
    expect(mocks.results).not.toHaveBeenCalled();
    mocks.access.mockResolvedValue({ data: { capabilities: ['results.view'] }, error: null });
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.attemptQuestionResults.q).toBeDefined());
    expect(result.current.error).toBeNull();
  });
});

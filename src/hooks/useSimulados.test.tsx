import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulados } from '@/hooks/useSimulados';

const mocks = vi.hoisted(() => ({ user: { id: 'a' } as { id: string } | null, flag: false,
  list: vi.fn(), attempts: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { listSimulados: mocks.list, getUserAttempts: mocks.attempts } }));

describe('useSimulados edition and account isolation', () => {
  beforeEach(() => {
    mocks.user = { id: 'a' }; mocks.flag = false;
    mocks.list.mockReset().mockResolvedValue([{ id: 's', slug: 'slug', executionWindowStart: '2020-01-01T00:00:00Z',
      executionWindowEnd: '2020-01-02T00:00:00Z', resultsReleaseAt: '2020-01-03T00:00:00Z' }]);
    mocks.attempts.mockReset().mockResolvedValue([]);
  });
  function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return { client, ...renderHook(() => useSimulados(), { wrapper: ({ children }) =>
      <QueryClientProvider client={client}>{children}</QueryClientProvider> }) };
  }
  it('keys caches by flag and account, reads metadata opt-in, and preserves slug lookup', async () => {
    const { result, rerender, client } = setup();
    await waitFor(() => expect(result.current.simulados).toHaveLength(1));
    expect(mocks.list).toHaveBeenLastCalledWith(false);
    expect(result.current.getSimuladoById('slug')?.id).toBe('s');
    mocks.flag = true; rerender();
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith(true));
    mocks.user = { id: 'b' }; rerender();
    await waitFor(() => expect(mocks.attempts).toHaveBeenCalledWith('b', ['online', 'presencial']));
    expect(client.getQueryCache().getAll().map(q => q.queryKey)).toEqual([
      ['simulados', 'a', false], ['simulados', 'a', true], ['simulados', 'b', true],
    ]);
  });
  it('maps deadline and training eligibility, without querying when logged out', async () => {
    mocks.attempts.mockImplementation(async (_id, type) => type === 'offline' ? [] : [{
      simulado_id: 's', status: 'in_progress', started_at: '2020-01-03T00:00:00Z',
      effective_deadline: '2099-01-01T00:00:00Z', is_within_window: false,
    }]);
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.simulados[0]?.status).toBe('in_progress'));
    expect(result.current.simulados[0].userState).toMatchObject({ effectiveDeadline: '2099-01-01T00:00:00Z', isWithinWindow: false });
    const calls = mocks.list.mock.calls.length;
    act(() => { mocks.user = null; }); rerender();
    expect(result.current.simulados).toEqual([]);
    expect(mocks.list).toHaveBeenCalledTimes(calls);
  });
});

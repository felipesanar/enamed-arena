import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUserPerformance } from './useUserPerformance';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as { id: string } | null, loading: false },
  flag: true, edition: 'e1' as string | null,
  summary: vi.fn(), history: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => ({ userEdition: mocks.edition ? { id: mocks.edition } : null }) }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getUserPerformanceSummary: mocks.summary, getUserPerformanceHistory: mocks.history } }));
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => {
  mocks.auth.user = { id: 'u1' }; mocks.flag = true; mocks.edition = 'e1';
  mocks.summary.mockReset().mockResolvedValue({ avg_score: 0, total_attempts: 1 });
  mocks.history.mockReset().mockResolvedValue([]);
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.useRealTimers(); });
describe('useUserPerformance cache and isolation', () => {
  it('scopes RPCs, preserves zero, reuses fresh cache across mounts/token refresh and refetches after six minutes', async () => {
    const { wrapper, client } = setup();
    const first = renderHook(() => useUserPerformance(), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(mocks.summary).toHaveBeenCalledWith('u1', 'e1');
    expect(mocks.history).toHaveBeenCalledWith('u1', null, 'e1');
    expect(first.result.current.summary?.avg_score).toBe(0);
    mocks.auth.user = { id: 'u1' }; first.rerender();
    first.unmount();
    const second = renderHook(() => useUserPerformance(), { wrapper });
    expect(second.result.current.summary?.avg_score).toBe(0);
    expect(mocks.summary).toHaveBeenCalledTimes(1);
    second.unmount();
    const query = client.getQueryCache().getAll()[0];
    client.setQueryData(query.queryKey, query.state.data, { updatedAt: Date.now() - 360_000 });
    renderHook(() => useUserPerformance(), { wrapper });
    await waitFor(() => expect(mocks.summary).toHaveBeenCalledTimes(2));
  });
  it('edition pending is neutral, flag false uses only legacy calls', async () => {
    mocks.edition = null;
    const { wrapper } = setup();
    const { result, rerender } = renderHook(() => useUserPerformance(), { wrapper });
    expect(result.current.summary).toBeNull(); expect(mocks.summary).not.toHaveBeenCalled();
    mocks.flag = false; rerender();
    await waitFor(() => expect(mocks.summary).toHaveBeenCalledWith('u1'));
    expect(mocks.history).toHaveBeenCalledWith('u1', 12);
  });
  it('late requests, target changes and logout cannot expose another scope', async () => {
    let resolve!: (value: unknown) => void;
    mocks.summary.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { wrapper } = setup();
    const { result, rerender } = renderHook(() => useUserPerformance(), { wrapper });
    mocks.auth.user = { id: 'u2' }; mocks.edition = 'e2'; rerender();
    expect(result.current.summary).toBeNull();
    await waitFor(() => expect(mocks.summary).toHaveBeenCalledWith('u2', 'e2'));
    await act(async () => { resolve({ avg_score: 99 }); });
    await waitFor(() => expect(result.current.summary?.avg_score).toBe(0));
    mocks.auth.user = null; rerender();
    expect(result.current.summary).toBeNull(); expect(result.current.history).toEqual([]);
  });
  it('exposes errors and retry', async () => {
    mocks.summary.mockRejectedValueOnce(new Error('offline'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useUserPerformance(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('offline'));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});

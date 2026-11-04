import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRanking } from './useRanking';
import type { RankingQueryOptions } from '@/types/ranking';
const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null, flag: true, edition: 'e1' as string | null,
  list: vi.fn(), ranking: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ onboarding: null }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => ({ userEdition: mocks.edition ? { id: mocks.edition } : null }) }));
vi.mock('@/services/rankingApi', async importOriginal => ({ ...await importOriginal<object>(),
  fetchSimuladosWithResults: mocks.list, fetchRankingForSimulado: mocks.ranking,
}));
const clients: QueryClient[] = [];
function setup(options?: RankingQueryOptions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper, ...renderHook(() => useRanking(options), { wrapper }) };
}
beforeEach(() => {
  sessionStorage.clear(); mocks.user = { id: 'u1' }; mocks.flag = true; mocks.edition = 'e1';
  mocks.list.mockReset().mockResolvedValue([
    { id: 's1', title: 'S1', sequence_number: 1, editionId: 'e1', resultsReleaseAt: '2027-01-01' },
    { id: 's2', title: 'S2', sequence_number: 2, editionId: 'e1', resultsReleaseAt: '2027-02-01' },
    { id: 'old', title: '2026', sequence_number: 8, editionId: 'old', resultsReleaseAt: '2026-12-01' },
  ]);
  mocks.ranking.mockReset().mockResolvedValue([]);
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; });
describe('useRanking selection/cache', () => {
  it('defaults to latest released in edition, not S1/legacy storage', async () => {
    sessionStorage.setItem('enamed_ui_ranking:simuladoId', '"old"');
    const { result } = setup();
    await waitFor(() => expect(result.current.selectedSimuladoId).toBe('s2'));
    expect(mocks.list).toHaveBeenCalledWith(true);
    expect(mocks.ranking).toHaveBeenCalledWith('s2');
  });
  it('valid explicit history selection survives remount; home never overwrites it', async () => {
    const first = setup();
    await waitFor(() => expect(first.result.current.selectedSimuladoId).toBe('s2'));
    act(() => first.result.current.setSelectedSimuladoId('old'));
    expect(first.result.current.selectedSimuladoId).toBe('old');
    first.unmount();
    const home = setup({ selection: 'latest-in-edition', editionId: 'e1' });
    await waitFor(() => expect(home.result.current.selectedSimuladoId).toBe('s2'));
    act(() => home.result.current.setSelectedSimuladoId('s1'));
    home.unmount();
    const again = setup();
    await waitFor(() => expect(again.result.current.selectedSimuladoId).toBe('old'));
  });
  it('invalid explicit selection is ignored and account/logout clears visible rows immediately', async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.selectedSimuladoId).toBe('s2'));
    act(() => result.current.setSelectedSimuladoId('missing'));
    expect(result.current.selectedSimuladoId).toBe('s2');
    act(() => result.current.setSelectedSimuladoId('s1'));
    mocks.user = { id: 'u2' }; rerender();
    expect(result.current.allParticipants).toEqual([]);
    await waitFor(() => expect(result.current.selectedSimuladoId).toBe('s2'));
    mocks.user = null; rerender();
    expect(result.current.selectedSimuladoId).toBeNull(); expect(result.current.simuladosWithResults).toEqual([]);
  });
  it('no target never requests global ranking; flag false keeps legacy reads', async () => {
    mocks.edition = null;
    const { result, rerender } = setup();
    expect(result.current.selectedSimuladoId).toBeNull(); expect(mocks.list).not.toHaveBeenCalled();
    mocks.flag = false; rerender();
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith());
    await waitFor(() => expect(result.current.selectedSimuladoId).toBe('s1'));
  });
});

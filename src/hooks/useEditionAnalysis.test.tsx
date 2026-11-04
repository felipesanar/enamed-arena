import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mocks = vi.hoisted(() => ({ enabled: true, userId: 'owner' as string | null, history: vi.fn(), ranking: vi.fn(), cutoffs: vi.fn(), editions: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.userId ? { id: mocks.userId } : null, loading: false }) }));
vi.mock('@/services/editionAnalysisApi', () => ({ editionAnalysisApi: { getMyPercentileHistory: mocks.history, getEditionRanking: mocks.ranking, getCutoffHistory: mocks.cutoffs, getEditions: mocks.editions } }));
import { usePercentileHistory, useEditionRanking, useCutoffHistory } from './useEditionAnalysis';
function wrapper() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => { vi.clearAllMocks(); mocks.enabled = true; mocks.userId = 'owner'; mocks.history.mockResolvedValue({ items: [] }); mocks.ranking.mockResolvedValue({ status: 'unconfigured', edition_id: 'ed', policy: null }); });
describe('edition analysis query scope', () => {
  it('does not perform new analysis reads with the feature off', async () => {
    mocks.enabled = false;
    const { result } = renderHook(() => { const a = usePercentileHistory(); const b = useEditionRanking('ed', 0); const c = useCutoffHistory({ institutionId: 'i', specialtyId: 's' }); return [a.data,b.data,c.data]; }, { wrapper: wrapper() });
    expect(result.current).toEqual([undefined,undefined,undefined]);
    expect(mocks.history).not.toHaveBeenCalled(); expect(mocks.ranking).not.toHaveBeenCalled(); expect(mocks.cutoffs).not.toHaveBeenCalled();
  });
  it('clears cached personal history immediately on logout', async () => {
    const { result, rerender } = renderHook(() => usePercentileHistory(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toEqual({ items: [] }));
    mocks.userId = null; rerender();
    expect(result.current.data).toBeUndefined(); expect(mocks.history).toHaveBeenCalledExactlyOnceWith('owner');
  });
  it('does not reuse an old edition page while the next scope is unresolved', async () => {
    const { result, rerender } = renderHook(({ edition }) => useEditionRanking(edition, 0), { initialProps: { edition: 'ed' }, wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.edition_id).toBe('ed'));
    mocks.ranking.mockReturnValue(new Promise(() => {})); rerender({ edition: 'other' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(mocks.ranking).toHaveBeenLastCalledWith('owner', 'other', 0));
  });
});

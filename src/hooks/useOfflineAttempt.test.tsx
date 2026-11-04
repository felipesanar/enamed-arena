import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOfflineAttempt } from './useOfflineAttempt';
import { saveOfflineAttempt, readOfflineAttempts } from '@/lib/offline-attempt-cache';
import { offlineApi } from '@/services/offlineApi';
let userId: string | null = 'u1';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: userId ? { id: userId } : null }) }));
vi.mock('@/services/offlineApi', () => ({ offlineApi: { getActiveOfflineAttempt: vi.fn() } }));
const attempt = { id: 'a1', simulado_id: 's1', simulado_slug: 'slug', started_at: '2026-01-01T00:00:00Z', effective_deadline: '2026-01-01T05:00:00Z', status: 'offline_pending' };
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
let client: QueryClient;
describe('offline attempt ownership and confirmation', () => {
  beforeEach(() => { userId = 'u1'; localStorage.clear(); vi.resetAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); });
  it('preserves local pending on error, but removes it on confirmed null', async () => {
    saveOfflineAttempt('u1', attempt);
    vi.mocked(offlineApi.getActiveOfflineAttempt).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useOfflineAttempt('s1'), { wrapper });
    await waitFor(() => expect(result.current.queryError).toBe(true));
    expect(result.current.activeAttempt?.id).toBe('a1');
    expect(result.current.isConfirmed).toBe(false);
    vi.mocked(offlineApi.getActiveOfflineAttempt).mockResolvedValue(null);
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.activeAttempt).toBeNull());
    expect(readOfflineAttempts('u1')).toEqual([]);
  });
  it('immediately changes scope and ignores an old async result and old clear callback', async () => {
    let resolve!: (v: typeof attempt) => void;
    vi.mocked(offlineApi.getActiveOfflineAttempt).mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue(null);
    saveOfflineAttempt('u1', attempt);
    const { result, rerender } = renderHook(() => useOfflineAttempt('s1'), { wrapper });
    const oldClear = result.current.clearAttempt;
    userId = 'u2'; rerender();
    expect(result.current.activeAttempt).toBeNull();
    await act(async () => { resolve(attempt); });
    act(() => oldClear());
    expect(readOfflineAttempts('u2')).toEqual([]);
    expect(readOfflineAttempts('u1')).toEqual([attempt]);
    userId = null; rerender();
    expect(result.current.activeAttempt).toBeNull();
  });
  it('unmount does not erase pending cache', async () => {
    saveOfflineAttempt('u1', attempt);
    vi.mocked(offlineApi.getActiveOfflineAttempt).mockRejectedValue(new Error('network'));
    const { result, unmount } = renderHook(() => useOfflineAttempt('s1'), { wrapper });
    await waitFor(() => expect(result.current.queryError).toBe(true));
    unmount();
    expect(readOfflineAttempts('u1')).toEqual([attempt]);
  });
  it('a delayed empty read cannot erase an attempt created after the query began', async () => {
    let resolve!: (value: null) => void;
    vi.mocked(offlineApi.getActiveOfflineAttempt).mockImplementation(() => new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useOfflineAttempt('s1'), { wrapper });
    act(() => { saveOfflineAttempt('u1', attempt); });
    await act(async () => { resolve(null); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(readOfflineAttempts('u1')).toEqual([attempt]);
  });
});

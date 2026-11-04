import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useComparativeData } from './useComparativeData';
const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null, flag: true, edition: 'e1' as string | null, admin: false,
  simulados: [] as any[], areas: vi.fn(), behavior: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock('@/admin/hooks/useAdminAuth', () => ({ useAdminAuth: () => ({ isAdmin: mocks.admin }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => ({ userEdition: mocks.edition ? { id: mocks.edition } : null }) }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ simulados: mocks.simulados, loading: false }) }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getUserAreaScoresBySimulado: mocks.areas, getUserAttemptBehaviorStats: mocks.behavior } }));
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper, ...renderHook(() => useComparativeData(), { wrapper }) };
}
beforeEach(() => {
  mocks.user = { id: 'u1' }; mocks.flag = true; mocks.edition = 'e1'; mocks.admin = false;
  mocks.simulados = [
    { id: 'current', editionId: 'e1', sequenceNumber: 1, title: 'Atual', status: 'completed', userState: { finished: true, score: 0, isWithinWindow: true } },
    { id: 'old', editionId: 'old', sequenceNumber: 2, status: 'completed', userState: { finished: true, score: 90, isWithinWindow: true } },
    { id: 'training', editionId: 'e1', sequenceNumber: 3, status: 'completed', userState: { finished: true, score: 100, isWithinWindow: false } },
  ];
  mocks.areas.mockReset().mockResolvedValue([{ simulado_id: 'old', area: 'CM', score_percentage: 90 },
    { simulado_id: 'current', area: 'CM', score_percentage: 0 }]);
  mocks.behavior.mockReset().mockResolvedValue([]);
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; });
describe('comparative edition scope', () => {
  it('filters before insights, excludes training, preserves zero, and uses actual RPC signatures', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.areas).toHaveBeenCalledWith('u1');
    expect(mocks.behavior).toHaveBeenCalledWith('u1', 'e1');
    expect(result.current.entries.map(e => e.simuladoId)).toEqual(['current']);
    expect(result.current.entries[0].areaScores).toEqual({ CM: 0 });
    expect(result.current.allSlots.map(e => e.simuladoId)).toEqual(['current', 'training']);
  });
  it('pending target never fetches global data, logout hides all entries/slots', async () => {
    mocks.edition = null;
    const { result, rerender } = setup();
    expect(mocks.areas).not.toHaveBeenCalled(); expect(result.current.entries).toEqual([]);
    mocks.edition = 'e1'; rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.user = null; rerender();
    expect(result.current.entries).toEqual([]); expect(result.current.allSlots).toEqual([]);
  });
  it('legacy queries and admin preview keep their previous permissions, fresh remount does not fetch extras', async () => {
    mocks.flag = false; mocks.admin = true;
    mocks.simulados[0].status = 'closed_waiting';
    const first = setup();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(mocks.behavior).toHaveBeenCalledWith('u1');
    expect(first.result.current.entries).toHaveLength(3);
    first.unmount(); renderHook(() => useComparativeData(), { wrapper: first.wrapper });
    expect(mocks.areas).toHaveBeenCalledTimes(1);
  });
});

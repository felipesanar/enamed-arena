import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useComparativeData } from './useComparativeData';
import type { UserAreaScoreRow } from '@/services/simuladosApi';
const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null, flag: true, edition: 'e1' as string | null, admin: false,
  simulados: [] as any[], areas: vi.fn(), behavior: vi.fn(), history: vi.fn(), rpc: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock('@/admin/hooks/useAdminAuth', () => ({ useAdminAuth: () => ({ isAdmin: mocks.admin }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => ({ userEdition: mocks.edition ? { id: mocks.edition } : null }) }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ simulados: mocks.simulados, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getUserAreaScoresBySimulado: mocks.areas,
  getUserAttemptBehaviorStats: mocks.behavior, getAreaScoreHistory: mocks.history } }));
const point = (attempt_id: string, score: number, questions_correct: number, questions_total = 30) => ({
  attempt_id, finished_at: '2027-01-01T12:00:00Z', score, questions_total, questions_correct,
});
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
  mocks.history.mockReset().mockResolvedValue({ by_area: { CM: [point('eligible', 0, 0)] }, global: [] });
  mocks.behavior.mockReset().mockResolvedValue([{ attempt_id: 'eligible', simulado_id: 'current', total_questions: 30, total_correct: 0 }]);
  mocks.rpc.mockReset();
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; });
describe('comparative edition scope', () => {
  it('filters before insights, excludes training, preserves zero, and uses actual RPC signatures', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.history).toHaveBeenCalledWith('u1', 'e1');
    expect(mocks.areas).not.toHaveBeenCalled();
    expect(mocks.behavior).toHaveBeenCalledWith('u1', 'e1');
    expect(result.current.entries.map(e => e.simuladoId)).toEqual(['current']);
    expect(result.current.entries[0].areaScores).toEqual({ CM: 0 });
    expect(result.current.allSlots.map(e => e.simuladoId)).toEqual(['current', 'training']);
  });
  it.each([null, '', ' '])('pending target %s never fetches global data, logout hides all entries/slots', async edition => {
    mocks.edition = edition;
    const { result, rerender } = setup();
    expect(mocks.areas).not.toHaveBeenCalled(); expect(mocks.history).not.toHaveBeenCalled();
    expect(mocks.behavior).not.toHaveBeenCalled(); expect(result.current.entries).toEqual([]);
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
    expect(mocks.areas).toHaveBeenCalledWith('u1');
    expect(mocks.history).not.toHaveBeenCalled();
    expect(first.result.current.entries).toHaveLength(3);
    first.unmount(); renderHook(() => useComparativeData(), { wrapper: first.wrapper });
    expect(mocks.areas).toHaveBeenCalledTimes(1);
  });
  it('uses only the SQL-selected attempt, never the same-exam training score or a tied modality', async () => {
    mocks.areas.mockResolvedValue([{ simulado_id: 'current', area: 'CM', score_percentage: 60 }]);
    mocks.history.mockResolvedValue({ by_area: { CM: [point('training-attempt', 1, 30),
      point('tied-other-modality', 0.8, 24), point('eligible', 0.2, 6), point('unknown', 1, 30), point('old-attempt', 0.9, 27)] }, global: [] });
    mocks.behavior.mockResolvedValue([
      { attempt_id: 'eligible', simulado_id: 'current', total_questions: 30, total_correct: 6 },
      { attempt_id: 'old-attempt', simulado_id: 'old', total_questions: 30, total_correct: 27 },
    ]);
    const { result, client } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries[0].areaScores).toEqual({ CM: 20 });
    expect(result.current.entries[0]).toMatchObject({ totalCorrect: 6, totalQuestions: 30 });
    const cached = client.getQueryData<{ areas: UserAreaScoreRow[] }>(client.getQueryCache().getAll()[0].queryKey);
    expect(cached?.areas).toEqual([{ simulado_id: 'current', area: 'CM', total: 30, correct: 6, score_percentage: 20 }]);
    expect(mocks.areas).not.toHaveBeenCalled();
  });
  it('discards malformed/mismatched area points rather than inventing zeros or counts', async () => {
    mocks.history.mockResolvedValue({ by_area: {
      CM: [point('eligible', 0, 0)],
      unknown: [point('missing', 0.2, 6)],
      nan: [point('eligible', NaN, 6)], infinite: [point('eligible', Infinity, 6)],
      range: [point('eligible', 1.2, 6)], negative: [point('eligible', -0.1, 6)],
      counts: [point('eligible', 0.2, 31)], empty: [point('eligible', 0, 0, 0)],
      fractional: [point('eligible', 0.2, 6.5)],
      badDate: [{ ...point('eligible', 0.2, 6), finished_at: 'invalid' }],
      strings: [{ ...point('eligible', 0.2, 6), questions_total: '30' }],
      missing: [{ attempt_id: 'eligible', score: 0.2 }], invalidArea: null,
    }, global: [] });
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries[0].areaScores).toEqual({ CM: 0 });
  });
  it('does not choose between ambiguous behavior attempts for the same exam', async () => {
    mocks.behavior.mockResolvedValue([{ attempt_id: 'eligible', simulado_id: 'current' },
      { attempt_id: 'other', simulado_id: 'current' }]);
    mocks.history.mockResolvedValue({ by_area: { CM: [point('eligible', 0.2, 6), point('other', 1, 30)] }, global: [] });
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries[0].areaScores).toEqual({});
  });
  it('surfaces scoped history failures and retries both RPCs through public refetch', async () => {
    mocks.history.mockRejectedValueOnce(new Error('history offline'));
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe('history offline'));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.entries[0].areaScores).toEqual({ CM: 0 });
    expect(mocks.history).toHaveBeenCalledTimes(2);
    expect(mocks.behavior).toHaveBeenCalledTimes(2);
  });
});

describe('area history service wire contract', () => {
  it('preserves the legacy JSON and arguments, adding only an explicit edition', async () => {
    const { simuladosApi } = await vi.importActual<typeof import('@/services/simuladosApi')>('@/services/simuladosApi');
    const wire = { by_area: { CM: [point('eligible', 0.2, 6)] }, global: [{ attempt_id: 'eligible', finished_at: '2027-01-01T12:00:00Z', score_global: 0.2 }] };
    mocks.rpc.mockResolvedValue({ data: wire, error: null });
    expect(await simuladosApi.getAreaScoreHistory('u1')).toBe(wire);
    expect(mocks.rpc).toHaveBeenLastCalledWith('get_area_score_history', { p_user_id: 'u1' });
    expect(await simuladosApi.getAreaScoreHistory('u1', 'e1')).toBe(wire);
    expect(mocks.rpc).toHaveBeenLastCalledWith('get_area_score_history', { p_user_id: 'u1', p_edition_id: 'e1' });
  });
});

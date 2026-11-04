import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRanking } from './useRanking';
import type { RankingQueryOptions } from '@/types/ranking';
import type { RankingRow } from '@/services/rankingApi';
const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null, flag: true, edition: 'e1' as string | null,
  list: vi.fn(), ranking: vi.fn(),
  specialty: 'CM', institutions: ['A'], status: 'closed',
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ onboarding: {
  userId: mocks.user?.id, specialty: mocks.specialty, targetInstitutions: mocks.institutions,
  specialtyId: 'current-specialty-id', targetInstitutionIds: ['current-institution-id'],
} }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => ({ userEdition: mocks.edition ? { id: mocks.edition } : null,
  data: [{ id: 'e1', status: mocks.status }, { id: 'old', status: 'archived' }],
}) }));
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
  mocks.specialty = 'CM'; mocks.institutions = ['A']; mocks.status = 'closed';
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
    expect(mocks.list).toHaveBeenCalledWith(true, 'u1');
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

function row(id: string, specialty: string | null, institutions: string[] | null, segment = 'standard'): RankingRow {
  return { user_id: id, simulado_id: 's2', especialidade: specialty, instituicoes_alvo: institutions,
    full_name: id, segment, posicao: 1, total_candidatos: 4, nota_final: 80,
    total_correct: 80, total_answered: 100, finished_at: '2026-01-01' } as RankingRow;
}

describe('useRanking comparison snapshots', () => {
  beforeEach(() => {
    mocks.ranking.mockResolvedValue([
      row('u1', 'CM', ['A', 'B']), row('cm1', 'CM', ['Z', 'B']),
      row('cm2', 'CM', ['A']), row('go', 'GO', ['A']),
    ]);
  });
  it.each(['closed', 'archived'])('keeps the %s cohort after current preferences change, but not cutoff targets', async status => {
    mocks.status = status;
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.allParticipants).toHaveLength(4));
    act(() => result.current.setRankingComparison({ bySpecialty: true, byInstitution: true }));
    expect(result.current.filteredParticipants.map(p => p.userId)).toEqual(['u1', 'cm1', 'cm2']);
    mocks.specialty = 'GO'; mocks.institutions = ['New']; rerender();
    expect(result.current.filteredParticipants.map(p => p.userId)).toEqual(['u1', 'cm1', 'cm2']);
    expect(result.current.comparisonContext).toMatchObject({ specialty: 'CM', institutions: ['A', 'B'], historical: true });
    expect(result.current.userSpecialty).toBe('GO'); expect(result.current.userInstitutions).toEqual(['New']);
    expect(result.current.userSpecialtyId).toBe('current-specialty-id');
    expect(result.current.userInstitutionIds).toEqual(['current-institution-id']);
  });
  it('active edition follows current preferences while legacy needs no catalog', async () => {
    mocks.status = 'active';
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.allParticipants).toHaveLength(4));
    act(() => result.current.setRankingComparison({ bySpecialty: true, byInstitution: false }));
    expect(result.current.filteredParticipants.map(p => p.userId)).toEqual(['u1', 'cm1', 'cm2']);
    mocks.specialty = 'GO'; rerender();
    expect(result.current.filteredParticipants.map(p => p.userId)).toEqual(['u1', 'go']);
    mocks.flag = false; rerender();
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith());
    expect(result.current.comparisonContext).toMatchObject({ specialty: 'GO', historical: false });
  });
  it('missing photo gives an effective national selection without changing the persisted preference', async () => {
    mocks.ranking.mockImplementation(async (id: string) => id === 'old'
      ? [row('u1', null, null), row('go', 'GO', ['A'])]
      : [row('u1', 'CM', ['A']), row('cm1', 'CM', ['A']), row('go', 'GO', ['A'])]);
    const { result } = setup();
    await waitFor(() => expect(result.current.allParticipants).toHaveLength(3));
    act(() => result.current.setRankingComparison({ bySpecialty: true, byInstitution: true }));
    act(() => result.current.setSelectedSimuladoId('old'));
    await waitFor(() => expect(result.current.allParticipants).toHaveLength(2));
    expect(result.current.error).toBeNull();
    expect(result.current.rankingComparison).toEqual({ bySpecialty: false, byInstitution: false });
    expect(result.current.comparisonContext).toMatchObject({ specialty: '', institutions: [], historical: true,
      notice: 'Preferências históricas não registradas; comparação geral disponível' });
    expect(result.current.filteredParticipants).toHaveLength(2);
    act(() => result.current.setSelectedSimuladoId('s2'));
    await waitFor(() => expect(result.current.rankingComparison.bySpecialty).toBe(true));
    expect(result.current.rankingComparison.byInstitution).toBe(true);
  });
  it('does not borrow another participant photo when the caller is absent', async () => {
    mocks.ranking.mockResolvedValue([row('other', 'CM', ['A'])]);
    const { result } = setup();
    await waitFor(() => expect(result.current.allParticipants).toHaveLength(1));
    expect(result.current.comparisonContext).toMatchObject({ specialty: '', institutions: [], historical: true });
  });
  it('does not expose late old-account snapshots after account change or logout', async () => {
    let finish!: (rows: RankingRow[]) => void;
    mocks.ranking.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue([]);
    const { result, rerender } = setup();
    await waitFor(() => expect(mocks.ranking).toHaveBeenCalled());
    mocks.user = { id: 'u2' }; rerender();
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(true, 'u2'));
    await act(async () => finish([row('u1', 'CM', ['Secret'])]));
    expect(result.current.allParticipants).toEqual([]);
    expect(result.current.comparisonContext.institutions).toEqual([]);
    mocks.user = null; rerender();
    expect(result.current.comparisonContext.specialty).toBe('');
    expect(result.current.comparisonContext.institutions).toEqual([]);
  });
  it('anonymous mount reads nothing and refetch retains the existing query/cache lifecycle', async () => {
    mocks.user = null;
    const { result, rerender } = setup();
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.ranking).not.toHaveBeenCalled();
    expect(result.current.allParticipants).toEqual([]);
    mocks.user = { id: 'u1' }; rerender();
    await waitFor(() => expect(result.current.allParticipants).toHaveLength(4));
    expect(mocks.list).toHaveBeenCalledTimes(1); expect(mocks.ranking).toHaveBeenCalledTimes(1);
    rerender();
    expect(mocks.list).toHaveBeenCalledTimes(1); expect(mocks.ranking).toHaveBeenCalledTimes(1);
    act(() => result.current.refetch());
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.ranking).toHaveBeenCalledTimes(2);
  });
});

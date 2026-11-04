import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CutoffScopeContext, type CutoffScope } from '@/hooks/useCutoffContext';
import { buildTableRows, RankingView } from './RankingView';
import type { RankingParticipant, RankingStats } from '@/services/rankingApi';
import { RANKING_COMPARISON_DEFAULT } from '@/services/rankingApi';

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
const cutoffMocks = vi.hoisted(() => ({ flag: false, scores: vi.fn().mockResolvedValue([]), legacy: vi.fn().mockResolvedValue([]) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer' }, loading: false }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => cutoffMocks.flag }));
vi.mock('@/services/cutoffApi', () => ({ cutoffApi: { getScores: cutoffMocks.scores } }));
vi.mock('@/services/rankingApi', async importOriginal => ({ ...await importOriginal<object>(), fetchCutoffScores: cutoffMocks.legacy }));
vi.mock('./CutoffScoreModal', () => ({
  CutoffScoreModal: (): null => null,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeParticipant(
  position: number,
  isCurrentUser = false,
): RankingParticipant {
  return {
    position,
    userId: `user-${position}`,
    name: isCurrentUser ? 'Eu' : `Candidato ${position}`,
    score: 100 - position,
    specialty: 'Pediatria',
    institution: 'UFBA',
    segment: 'standard',
    isCurrentUser,
  };
}

const defaultStats: RankingStats = { totalCandidatos: 20, notaMedia: 60, notaCorte: 85 };

const clients: QueryClient[] = [];
afterEach(() => { clients.forEach(client => client.clear()); clients.length = 0; cutoffMocks.flag = false; vi.clearAllMocks(); cutoffMocks.scores.mockResolvedValue([]); });
function renderView(overrides: Partial<Parameters<typeof RankingView>[0]> = {}, scope: CutoffScope = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); clients.push(client);
  client.setQueryData(['app-config', 'viewer', 'editions_ui'], cutoffMocks.flag);
  const props: Parameters<typeof RankingView>[0] = {
    loading: false,
    simuladosWithResults: [{ id: 's1', title: 'Simulado #1', sequence_number: 1 }],
    selectedSimuladoId: 's1',
    setSelectedSimuladoId: vi.fn(),
    filteredParticipants: Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1)),
    currentUser: undefined as RankingParticipant | undefined,
    stats: defaultStats,
    rankingComparison: RANKING_COMPARISON_DEFAULT,
    setRankingComparison: vi.fn(),
    segmentFilter: 'all' as const,
    setSegmentFilter: vi.fn(),
    userSpecialty: '',
    userInstitutions: [],
    userSpecialtyId: null,
    userInstitutionIds: [],
    allowedSegments: ['all' as const],
    trackSource: 'page' as const,
    participantDisplay: 'public' as const,
    ...overrides,
  };
  const tree = (nextProps = props, nextScope = scope) => <QueryClientProvider client={client}><MemoryRouter>
    <CutoffScopeContext.Provider value={nextScope}><RankingView {...nextProps} /></CutoffScopeContext.Provider>
  </MemoryRouter></QueryClientProvider>;
  const view = render(tree());
  return { ...view, rerenderView: (nextProps: Partial<typeof props>, nextScope: CutoffScope) => view.rerender(tree({ ...props, ...nextProps }, nextScope)) };
}

// ── buildTableRows ─────────────────────────────────────────────────────────────
describe('buildTableRows', () => {
  it('returns all participants when no currentUser', () => {
    const participants = Array.from({ length: 15 }, (_, i) => makeParticipant(i + 1));
    const result = buildTableRows(participants, undefined);
    expect(result).toHaveLength(15);
  });

  it('returns all participants when currentUser is in top 10', () => {
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 5));
    const result = buildTableRows(participants, participants[5]);
    expect(result).toHaveLength(20);
  });

  it('shows no separator when user is at position 11 (adjacent to top 10)', () => {
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 10));
    const result = buildTableRows(participants, participants[10]);
    const separators = result.filter((r) => 'type' in r);
    expect(separators).toHaveLength(0);
    // top10 (10) + vicinity positions 11,12,13 (3) = 13
    expect(result).toHaveLength(13);
  });

  it('shows separator when user is at position 17 (gap = 4 > 3)', () => {
    const participants = Array.from({ length: 30 }, (_, i) => makeParticipant(i + 1, i === 16));
    const result = buildTableRows(participants, participants[16]);
    const separators = result.filter((r): r is { type: 'separator'; from: number; to: number } =>
      'type' in r && (r as any).type === 'separator',
    );
    expect(separators).toHaveLength(1);
    // separator from 11 to vicinityStart-1 = 15-1 = 14
    expect(separators[0]).toEqual({ type: 'separator', from: 11, to: 14 });
    // top10 (10) + separator (1) + vicinity positions 15,16,17,18,19 (5) = 16
    expect(result).toHaveLength(16);
  });

  it('shows no separator when user is at position 16 (gap = 3, not > 3)', () => {
    const participants = Array.from({ length: 25 }, (_, i) => makeParticipant(i + 1, i === 15));
    const result = buildTableRows(participants, participants[15]);
    const separators = result.filter((r) => 'type' in r);
    expect(separators).toHaveLength(0);
  });
});

// ── RankingView component ──────────────────────────────────────────────────────
describe('RankingView', () => {
  it('shows empty state when no participants and no currentUser', () => {
    renderView({ filteredParticipants: [], currentUser: undefined });
    expect(screen.getByText('Sem participantes')).toBeTruthy();
  });

  it('shows aspirational hero when currentUser is undefined', () => {
    renderView({ currentUser: undefined });
    expect(screen.getByText('Você ainda não está no ranking')).toBeTruthy();
  });

  it('shows hero standing (posição/frase) from fallback when currentUser exists', () => {
    const user = makeParticipant(5, true);
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 4));
    // sem heroStanding → fallback: position 5 de 20 → supera 15 candidatos
    renderView({ currentUser: user, filteredParticipants: participants });
    expect(screen.getByText('Você supera 15 candidatos')).toBeTruthy();
  });

  it('uses explicit heroStanding (global) over the filtered fallback', () => {
    const user = makeParticipant(5, true);
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 4));
    renderView({
      currentUser: user,
      filteredParticipants: participants,
      heroStanding: { position: 1, total: 100, percentil: 1, score: 99 },
    });
    // global: position 1 de 100 → supera 99 (não o fallback de 15)
    expect(screen.getByText('Você supera 99 candidatos')).toBeTruthy();
  });

  it('shows informational cutoff references without predicting approval or comparable scales', async () => {
    renderView({
      userSpecialty: 'Pediatria',
      userInstitutions: ['Hospital X'],
      userSpecialtyId: 'spec-1',
      userInstitutionIds: ['inst-1'],
    });
    // card visível direto (sem collapse)
    expect(await screen.findByRole('region', { name: 'Referências de corte' })).toBeInTheDocument();
    expect(screen.getByText(/Referência indisponível/)).toBeInTheDocument();
    expect(screen.getByText(/Fonte indisponível/)).toBeInTheDocument();
    expect(screen.getByText(/Escalas podem diferir; não indica chance de aprovação/)).toBeInTheDocument();
    expect(screen.queryByText('Você passaria?')).not.toBeInTheDocument();
    expect(screen.queryByText('Sua nota vs. notas de corte')).not.toBeInTheDocument();
    // cutoffs mock vazio → instituição listada como indisponível
    expect(screen.getByText('Hospital X')).toBeTruthy();
    expect(screen.getByText('corte indisponível')).toBeTruthy();
  });

  it('hides cutoff section entirely when showApprovalPanel is false (admin)', () => {
    renderView({ showApprovalPanel: false });
    expect(screen.queryByRole('region', { name: 'Referências de corte' })).toBeNull();
  });

  it('uses frozen comparison labels but current cutoff target IDs through the real selected-edition provider', async () => {
    cutoffMocks.flag = true;
    cutoffMocks.scores.mockResolvedValue([{ institution_id: 'current-inst-id', institution_name: 'Atual',
      specialty_name: 'GO', practice_scenario: 'A', cutoff_score_general: 720, cutoff_score_quota: null,
      reference_edition_id: 'historical-edition', reference_label: 'Corte histórico', source: 'Fonte oficial' }]);
    const { rerenderView } = renderView({
      userSpecialty: 'GO', userInstitutions: ['Atual'], userSpecialtyId: 'current-spec-id', userInstitutionIds: ['current-inst-id'],
      comparisonContext: { specialty: 'CM', institutions: ['Histórica A', 'Histórica B'], historical: true },
      rankingComparison: { bySpecialty: true, byInstitution: true }, currentUser: makeParticipant(3, true),
    }, { editionsUi: true, referenceEditionId: 'historical-edition', cutoffContext: {
      has_target_cutoff: true, reason: 'matched', specialty: 'GO', target_institutions: ['Atual'],
      matches: [{ reference_edition_id: 'historical-edition', reference_label: 'Corte histórico', source: 'Fonte oficial',
        user_institution: 'Atual', matched_institution: 'Atual', practice_scenario: 'A', specialty: 'GO', cutoff_general: 720, cutoff_quota: null }],
      unmatched_institutions: [], stats: { count: 1 }, reference_edition_id: 'historical-edition',
    } });
    await waitFor(() => expect(cutoffMocks.scores).toHaveBeenCalledWith('current-spec-id', ['current-inst-id'], 'historical-edition'));
    expect(cutoffMocks.legacy).not.toHaveBeenCalled();
    expect(await screen.findByText('corte 720')).toBeInTheDocument();
    expect(screen.getByText('Corte histórico · Fonte oficial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtrar por especialidade: CM' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Filtrar também por instituição: Histórica A, Histórica B/ })).toBeInTheDocument();
    expect(screen.queryByText(/acima|faltam|720%|Você passaria|Sua nota vs/)).not.toBeInTheDocument();
    // Changing the selected reference to unknown must not reuse the cached historical cut.
    rerenderView({}, { editionsUi: true, referenceEditionId: null, cutoffContext: null });
    expect(screen.queryByText('corte 720')).not.toBeInTheDocument();
    expect(screen.queryByText('Corte histórico · Fonte oficial')).not.toBeInTheDocument();
    expect(screen.getByText(/Referência indisponível/)).toBeInTheDocument();
    expect(screen.getByText(/Fonte indisponível/)).toBeInTheDocument();
    expect(cutoffMocks.scores).toHaveBeenCalledTimes(1);
    expect(cutoffMocks.legacy).not.toHaveBeenCalled();
  });

  it('keeps the missing-photo notice and national control visible even when no participant row exists', () => {
    renderView({ filteredParticipants: [], currentUser: undefined,
      comparisonContext: { specialty: '', institutions: [], historical: true,
        notice: 'Preferências históricas não registradas; comparação geral disponível' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Preferências históricas não registradas; comparação geral disponível');
    expect(screen.getByRole('button', { name: 'Todos os candidatos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('unknown reference never queries global cuts; missing snapshot shows coherent national scope', () => {
    cutoffMocks.flag = true;
    const setter = vi.fn();
    renderView({ userSpecialty: 'GO', userInstitutions: ['Atual'], userSpecialtyId: 'current-spec-id', userInstitutionIds: ['current-inst-id'],
      comparisonContext: { specialty: '', institutions: [], historical: true,
        notice: 'Preferências históricas não registradas; comparação geral disponível' },
      rankingComparison: { bySpecialty: false, byInstitution: false }, setRankingComparison: setter,
    }, { editionsUi: true, referenceEditionId: null });
    expect(cutoffMocks.scores).not.toHaveBeenCalled(); expect(cutoffMocks.legacy).not.toHaveBeenCalled();
    expect(screen.getByText('Preferências históricas não registradas; comparação geral disponível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos os candidatos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Filtrar por especialidade/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/complete.*cadastro/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Todos os candidatos' }));
    expect(setter).toHaveBeenCalledWith({ bySpecialty: false, byInstitution: false });
    expect(screen.queryByText(/corte 50|corte 60|TRI|720/)).not.toBeInTheDocument();
  });

  it('shows low confidence banner when fewer than 30 participants', () => {
    renderView({ filteredParticipants: Array.from({ length: 15 }, (_, i) => makeParticipant(i + 1)) });
    expect(screen.getByText('Poucos candidatos nesse recorte')).toBeTruthy();
  });

  it('does not show low confidence banner when 30 or more participants', () => {
    renderView({
      filteredParticipants: Array.from({ length: 30 }, (_, i) => makeParticipant(i + 1)),
    });
    expect(screen.queryByText('Poucos candidatos nesse recorte')).toBeNull();
  });
});

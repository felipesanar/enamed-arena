import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCutoffScope, type CutoffScope } from '@/hooks/useCutoffContext';
import RankingPage from './RankingPage';
import type { ComponentProps, PropsWithChildren } from 'react';
import type { RankingView } from '@/components/ranking/RankingView';

const state = vi.hoisted(() => ({ flag: true, selected: 'old', viewProps: null as ComponentProps<typeof RankingView> | null,
  scope: null as CutoffScope | null, context: vi.fn().mockResolvedValue(null), setSelected: vi.fn() }));
vi.mock('@/services/cutoffApi', () => ({ cutoffApi: { getUserContext: state.context } }));
vi.mock('@/components/premium/PageTransition', () => ({ PageTransition: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/contexts/UserContext', () => ({ useSegment: () => 'standard', useUser: () => ({ onboarding: {}, profile: { segment: 'standard' } }) }));
vi.mock('@/hooks/useRanking', () => ({ useRanking: () => ({ simuladosWithResults: [
  { id: 'old', title: 'Histórica', sequence_number: 1 }, { id: 'new', title: 'Atual', sequence_number: 1 },
], selectedSimuladoId: state.selected, setSelectedSimuladoId: state.setSelected, loading: false, error: null, allParticipants: [],
  comparisonContext: { specialty: 'CM', institutions: ['Histórica'], historical: true },
  userSpecialty: 'GO', userInstitutions: ['Atual'], userSpecialtyId: 'current-spec-id', userInstitutionIds: ['current-inst-id'],
}) }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ editionsUi: state.flag, simulados: [
  { id: 'old', editionId: 'e-old', editionCode: '2026' }, { id: 'new', editionId: 'e-new', editionCode: '2027.1' },
] }) }));
vi.mock('@/hooks/useRankingEvolution', () => ({ useRankingEvolution: () => ({ data: null }) }));
vi.mock('@/components/presencial/PresencialEntryCard', () => ({ PresencialEntryCard: () => null }));
vi.mock('@/components/ranking/RankingView', () => ({ RankingView: (props: ComponentProps<typeof RankingView>) => {
  state.viewProps = props; state.scope = useCutoffScope(); return <div>Ranking</div>;
} }));

const clients: QueryClient[] = [];
afterEach(() => { clients.forEach(client => client.clear()); clients.length = 0; state.context.mockClear(); });
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); clients.push(client);
  client.setQueryData(['app-config', 'user', 'editions_ui'], state.flag);
  const tree = () => <QueryClientProvider client={client}><MemoryRouter><RankingPage /></MemoryRouter></QueryClientProvider>;
  const view = render(tree());
  return { ...view, rerenderPage: () => view.rerender(tree()) };
}

describe('RankingPage metadata bridge', () => {
  it('enriches options by exam ID and follows the selected edition without changing selection', async () => {
    state.flag = true; state.selected = 'old'; state.setSelected.mockClear();
    const { rerenderPage } = renderPage();
    expect(screen.getByText('ENAMED 2026')).toBeInTheDocument();
    expect(state.viewProps?.simuladosWithResults).toEqual([
      expect.objectContaining({ id: 'old', editionCode: '2026' }), expect.objectContaining({ id: 'new', editionCode: '2027.1' }),
    ]);
    expect(state.viewProps?.comparisonContext).toMatchObject({ specialty: 'CM', institutions: ['Histórica'], historical: true });
    expect(state.viewProps).toMatchObject({ userSpecialty: 'GO', userInstitutions: ['Atual'], userSpecialtyId: 'current-spec-id', userInstitutionIds: ['current-inst-id'] });
    expect(state.scope?.referenceEditionId).toBe('e-old');
    await waitFor(() => expect(state.context).toHaveBeenCalledWith('user', 'e-old'));
    state.selected = 'new'; rerenderPage();
    expect(screen.getByText('ENAMED 2027.1')).toBeInTheDocument();
    expect(state.setSelected).not.toHaveBeenCalled();
    expect(state.scope?.referenceEditionId).toBe('e-new');
    await waitFor(() => expect(state.context).toHaveBeenCalledWith('user', 'e-new'));
  });
  it('does not enrich metadata when editions_ui is false', () => {
    state.flag = false;
    renderPage();
    expect(screen.getByText('ENAMED')).toBeInTheDocument();
    expect(state.viewProps?.simuladosWithResults).toEqual([
      { id: 'old', title: 'Histórica', sequence_number: 1 }, { id: 'new', title: 'Atual', sequence_number: 1 },
    ]);
    expect(state.context).not.toHaveBeenCalled();
  });
});

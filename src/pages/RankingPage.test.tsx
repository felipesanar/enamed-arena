import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RankingPage from './RankingPage';
import type { ComponentProps, PropsWithChildren } from 'react';
import type { RankingView } from '@/components/ranking/RankingView';

const state = vi.hoisted(() => ({ flag: true, selected: 'old', viewProps: null as ComponentProps<typeof RankingView> | null,
  setSelected: vi.fn() }));
vi.mock('@/components/premium/PageTransition', () => ({ PageTransition: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/contexts/UserContext', () => ({ useSegment: () => 'standard', useUser: () => ({ onboarding: {}, profile: { segment: 'standard' } }) }));
vi.mock('@/hooks/useRanking', () => ({ useRanking: () => ({ simuladosWithResults: [
  { id: 'old', title: 'Histórica', sequence_number: 1 }, { id: 'new', title: 'Atual', sequence_number: 1 },
], selectedSimuladoId: state.selected, setSelectedSimuladoId: state.setSelected, loading: false, error: null, allParticipants: [] }) }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ editionsUi: state.flag, simulados: [
  { id: 'old', editionId: 'e-old', editionCode: '2026' }, { id: 'new', editionId: 'e-new', editionCode: '2027.1' },
] }) }));
vi.mock('@/hooks/useRankingEvolution', () => ({ useRankingEvolution: () => ({ data: null }) }));
vi.mock('@/components/presencial/PresencialEntryCard', () => ({ PresencialEntryCard: () => null }));
vi.mock('@/components/ranking/RankingView', () => ({ RankingView: (props: ComponentProps<typeof RankingView>) => { state.viewProps = props; return <div>Ranking</div>; } }));

describe('RankingPage metadata bridge', () => {
  it('enriches options by exam ID and follows the selected edition without changing selection', () => {
    state.flag = true; state.selected = 'old'; state.setSelected.mockClear();
    const { rerender } = render(<MemoryRouter><RankingPage /></MemoryRouter>);
    expect(screen.getByText('ENAMED 2026')).toBeInTheDocument();
    expect(state.viewProps?.simuladosWithResults).toEqual([
      expect.objectContaining({ id: 'old', editionCode: '2026' }), expect.objectContaining({ id: 'new', editionCode: '2027.1' }),
    ]);
    state.selected = 'new'; rerender(<MemoryRouter><RankingPage /></MemoryRouter>);
    expect(screen.getByText('ENAMED 2027.1')).toBeInTheDocument();
    expect(state.setSelected).not.toHaveBeenCalled();
  });
  it('does not enrich metadata when editions_ui is false', () => {
    state.flag = false;
    render(<MemoryRouter><RankingPage /></MemoryRouter>);
    expect(screen.getByText('ENAMED')).toBeInTheDocument();
    expect(state.viewProps?.simuladosWithResults).toEqual([
      { id: 'old', title: 'Histórica', sequence_number: 1 }, { id: 'new', title: 'Atual', sequence_number: 1 },
    ]);
  });
});

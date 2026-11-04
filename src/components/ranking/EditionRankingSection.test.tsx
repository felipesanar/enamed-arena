import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ ranking: vi.fn(), editions: [{ id: 'ed', label: 'Edição teste', code: '2027.2' }, { id: 'other', label: 'Outra edição', code: '2027.1' }] }));
vi.mock('@/hooks/useEditionAnalysis', () => ({ useAnalysisEditions: () => ({ data: mocks.editions, isPending: false, isError: false }), useEditionRanking: mocks.ranking }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
import { EditionRankingSection } from './EditionRankingSection';
beforeEach(() => { vi.clearAllMocks(); mocks.ranking.mockReturnValue({ data: { status: 'unconfigured', edition_id: 'ed', policy: null, population: 0, items: [] }, isPending: false, isError: false }); });
describe('edition ranking', () => {
  it('does not invent a participation policy for unconfigured or disabled editions', () => {
    render(<EditionRankingSection initialEditionId="ed" />);
    expect(screen.getByText('Ranking da edição ainda não configurado')).toBeInTheDocument();
    expect(screen.queryByText(/3 melhores/)).not.toBeInTheDocument();
  });
  it('masks other identities and displays actual counted participation within one edition', () => {
    mocks.ranking.mockReturnValue({ data: { status: 'ready', edition_id: 'ed', policy: { best_n: 3, minimum_simulados: 2 }, offered_simulados: 4, population: 1501, limit: 50, offset: 0,
      items: [{ user_id: 'other', display_name: 'PRIVATE FULL NAME', position: 1, average_score: 84.5, used_simulados: 2, completed_simulados: 2 }, { user_id: 'owner', display_name: 'PRIVATE OWNER', position: 2, average_score: 80, used_simulados: 3, completed_simulados: 4 }], metadata: { tie_break: 'server', warning: 'within edition' } }, isPending: false, isError: false });
    render(<EditionRankingSection initialEditionId="ed" />);
    expect(screen.getByText('Candidato #1')).toBeInTheDocument(); expect(screen.getByText('Você')).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument(); expect(screen.getByText('2 de até 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' })); expect(mocks.ranking).toHaveBeenLastCalledWith('ed', 50);
    fireEvent.change(screen.getByLabelText('Edição'), { target: { value: 'other' } }); expect(mocks.ranking).toHaveBeenLastCalledWith('other', 0);
  });
});

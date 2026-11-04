import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('@/hooks/useEditionAnalysis', () => ({ useCutoffHistory: mocks.history }));
import { CutoffHistorySection } from './CutoffHistorySection';
beforeEach(() => { vi.clearAllMocks(); mocks.history.mockReturnValue({ data: undefined, isPending: false, isError: false }); });
describe('cutoff reference history', () => {
  it('keeps absent canonical IDs unavailable without falling back to a target or a name', () => {
    render(<CutoffHistorySection reference={null} />);
    expect(screen.getByText('Histórico indisponível para esta referência')).toBeInTheDocument();
    expect(mocks.history).toHaveBeenCalledWith(null);
  });
  it('keeps process/source/period rows separate and never draws a trend from incompatible references', () => {
    const base = { id: 'a', institution_id: 'i', specialty_id: 's', practice_scenario: '', reference_edition_id: 'ed', reference_edition_code: '2027.1', reference_edition_label: 'Edição referência', reference_label: 'Processo A', year: 2027, term: 1, value_general: 720, value_quota: null, vagas: null, trend_comparable: false };
    mocks.history.mockReturnValue({ data: { items: [{ ...base, source: 'Fonte A' }, { ...base, id: 'b', source: 'Fonte B', value_general: 76 }], legacy_unknown_count: 2, trend_comparable: false }, isPending: false, isError: false });
    render(<CutoffHistorySection reference={{ institutionId: 'i', specialtyId: 's', practiceScenario: '' }} />);
    expect(screen.getByText('Fonte: Fonte A')).toBeInTheDocument(); expect(screen.getByText('Fonte: Fonte B')).toBeInTheDocument();
    expect(screen.getByText(/não são comparáveis/)).toBeInTheDocument(); expect(screen.getByText('Origem não confirmada')).toBeInTheDocument();
    expect(screen.queryByText(/subiu|tendência de alta/i)).not.toBeInTheDocument(); expect(document.querySelector('svg')).toBeNull();
  });
});

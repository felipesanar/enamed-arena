import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const state = vi.hoisted(() => ({ flag: false, history: vi.fn(), comparative: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.flag }));
vi.mock('@/hooks/useComparativeData', () => ({ useComparativeData: () => { state.comparative(); return { entries: [], allSlots: [], loading: false }; } }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ simulados: [], editionsUi: state.flag }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { segment: 'pro' }, onboarding: null }) }));
vi.mock('@/components/comparativo/PercentileHistorySection', () => ({ PercentileHistorySection: () => { state.history(); return <p>Histórico pessoal por percentil</p>; } }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
import ComparativoPage from './ComparativoPage';
beforeEach(() => { state.flag = false; vi.clearAllMocks(); });
describe('comparative edition integration', () => {
  it('keeps the legacy view and performs no new history read with the flag off', () => {
    render(<MemoryRouter><ComparativoPage /></MemoryRouter>);
    expect(screen.getByText('Dados insuficientes para comparar')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Histórico por percentil' })).not.toBeInTheDocument();
    expect(state.history).not.toHaveBeenCalled();
  });
  it('makes personal percentile history available even with fewer than two current-edition results', () => {
    state.flag = true; render(<MemoryRouter><ComparativoPage /></MemoryRouter>);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Histórico por percentil' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Histórico pessoal por percentil')).toBeInTheDocument();
    expect(screen.queryByText('Dados insuficientes para comparar')).not.toBeInTheDocument();
  });
});

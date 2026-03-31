import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SimuladoCard } from './SimuladoCard';
import type { SimuladoWithStatus } from '@/types';

const baseSimulado: SimuladoWithStatus = {
  id: 'sim-1',
  title: 'Simulado ENAMED 26/03',
  sequenceNumber: 3,
  executionWindowStart: '2026-03-26T00:00:00Z',
  executionWindowEnd: '2026-03-28T00:00:00Z',
  resultsReleaseAt: '2026-03-29T00:00:00Z',
  status: 'available',
  questionsCount: 100,
  durationMinutes: 240,
  themeTags: [],
  userState: undefined,
};

function renderCard(props: Partial<React.ComponentProps<typeof SimuladoCard>> = {}) {
  return render(
    <MemoryRouter>
      <SimuladoCard simulado={baseSimulado} isLocked={false} {...props} />
    </MemoryRouter>
  );
}

describe('SimuladoCard', () => {
  it('renders CTA link when not locked', () => {
    renderCard({ isLocked: false });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/simulados/sim-1');
  });

  it('renders locked state with PRO badge and disabled CTA', () => {
    const { container } = renderCard({ isLocked: true });
    expect(screen.getByText('🔒 PRO')).toBeInTheDocument();
    expect(screen.getByText('🔒 Disponível apenas para Aluno PRO')).toBeInTheDocument();
    expect(container.querySelector('a[href]')).toBeNull();
  });

  it('renders worstArea badge when provided', () => {
    renderCard({ isLocked: false, worstArea: 'Clínica Médica' });
    expect(screen.getByText('Foco: Clínica Médica')).toBeInTheDocument();
  });

  it('does not render worstArea badge when null', () => {
    renderCard({ isLocked: false, worstArea: null });
    expect(screen.queryByText(/Foco:/)).toBeNull();
  });
});

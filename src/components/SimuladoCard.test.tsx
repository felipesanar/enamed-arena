import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SimuladoCard } from './SimuladoCard';
import type { SimuladoWithStatus } from '@/types';

const baseSimulado: SimuladoWithStatus = {
  id: 'sim-1',
  slug: 'sim-1',
  title: 'Simulado ENAMED 26/03',
  description: 'Desc',
  sequenceNumber: 3,
  executionWindowStart: '2026-03-26T00:00:00Z',
  executionWindowEnd: '2026-03-28T00:00:00Z',
  resultsReleaseAt: '2026-03-29T00:00:00Z',
  status: 'available',
  questionsCount: 100,
  estimatedDuration: '4h',
  estimatedDurationMinutes: 240,
  themeTags: [],
  userState: undefined,
};

function renderCard(overrides: Partial<SimuladoWithStatus> = {}) {
  const simulado: SimuladoWithStatus = { ...baseSimulado, ...overrides };
  return render(
    <MemoryRouter>
      <SimuladoCard simulado={simulado} />
    </MemoryRouter>
  );
}

describe('SimuladoCard', () => {
  it.each(['in_progress', 'available_late', 'available'] as const)('arquivado inacabado nao oferece iniciar/retomar (%s)', status => {
    renderCard({ dbStatus: 'archived', status, userState: {
      simuladoId: 'sim-1', started: true, finished: false, isWithinWindow: false,
    } });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulado arquivado' })).toBeDisabled();
  });
  it('resultado arquivado finalizado continua acessivel ao dono', () => {
    renderCard({ dbStatus: 'archived', status: 'completed', userState: {
      simuladoId: 'sim-1', started: true, finished: true, score: 70,
    } });
    expect(screen.getByRole('link', { name: 'Ver Resultado' })).toHaveAttribute('href', '/simulados/sim-1');
  });
  it('labels the actual edition and resumable training', () => {
    renderCard({ editionCode: '2027.1', status: 'in_progress', userState: {
      simuladoId: 'sim-1', started: true, finished: false, isWithinWindow: false,
    } });
    expect(screen.getByText('2027.1 · Simulado 3')).toBeInTheDocument();
    expect(screen.getByText('Treino')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveTextContent('Continuar Simulado');
  });
  it('renders CTA link when available', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/simulados/sim-1');
    expect(link).toHaveTextContent('Iniciar Simulado');
  });

  it('shows value copy and ranking tag when available_late', () => {
    renderCard({ status: 'available_late' });
    expect(
      screen.getByText(/Mesmo simulado completo — referência para sua preparação/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Não conta no ranking nacional')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('Iniciar Simulado');
  });
});

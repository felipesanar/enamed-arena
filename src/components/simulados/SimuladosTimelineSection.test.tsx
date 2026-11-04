import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SimuladosTimelineSection } from '@/components/simulados/SimuladosTimelineSection';
import type { SimuladoWithStatus } from '@/types';

const sim = { id: 'new', slug: 'new-slug', title: 'Atual', sequenceNumber: 1, editionId: 'e-new', editionCode: '2027.1',
  executionWindowStart: '2027-01-01T12:00:00Z', executionWindowEnd: '2027-01-02T12:00:00Z',
  resultsReleaseAt: '2027-01-03T12:00:00Z', status: 'available_late' } as SimuladoWithStatus;

describe('SimuladosTimelineSection editions', () => {
  it('puts current first and history in a native keyboard-accessible disclosure', () => {
    const { container } = render(<MemoryRouter><SimuladosTimelineSection editionsUi currentEditionId="e-new" reduced items={[
      { ...sim, id: 'old', slug: 'old-slug', title: 'Histórico', editionId: 'e-old', editionCode: '2026' }, sim,
    ]} /></MemoryRouter>);
    expect(screen.getByText('2027.1 · Simulado 1')).toBeVisible();
    const disclosure = container.querySelector('details')!;
    expect(disclosure).not.toHaveAttribute('open');
    expect(disclosure.querySelector('summary')).toHaveTextContent('ENAMED 2026 · Treino');
    expect(disclosure.querySelector('summary')?.tagName).toBe('SUMMARY');
    fireEvent.click(disclosure.querySelector('summary')!);
    expect(screen.getByText('2026 · Simulado 1')).toBeInTheDocument();
  });
  it('keeps the ungrouped layout when the flag is off', () => {
    const { container } = render(<MemoryRouter><SimuladosTimelineSection items={[sim]} reduced /></MemoryRouter>);
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByText('Histórico e próximos')).toBeVisible();
  });
  it('never presents an expired attempt as resumable', () => {
    render(<MemoryRouter><SimuladosTimelineSection items={[{ ...sim, userState: {
      simuladoId: sim.id, started: true, finished: false, isWithinWindow: false, effectiveDeadline: '2020-01-01T12:00:00Z',
    } }]} reduced /></MemoryRouter>);
    expect(screen.queryByText('Continuar')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fazer como treino/ })).toHaveAttribute('href', '/simulados/new-slug/start');
  });
});

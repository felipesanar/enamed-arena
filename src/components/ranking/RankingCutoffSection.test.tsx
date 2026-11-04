import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RankingCutoffSection } from '@/components/ranking/RankingCutoffSection';

describe('cutoff panel provenance', () => {
  it('never claims approval from legacy cuts with unknown reference/source/scale', () => {
    render(<MemoryRouter><RankingCutoffSection state="ready" userScore={80} onOpenCutoffTable={() => {}} entries={[{ institutionId: 'x', institutionName: 'Hospital X', cutoffGeneral: 60, status: 'pass', gap: 20 } as never]} /></MemoryRouter>);
    expect(screen.getByText(/Referência indisponível/)).toBeInTheDocument();
    expect(screen.getByText(/Fonte indisponível/)).toBeInTheDocument();
    expect(screen.queryByText('1 de 1')).not.toBeInTheDocument();
    expect(screen.queryByText('+20 acima')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Referências de corte' })).toBeInTheDocument();
  });
  it('no-profile copy offers references, not score comparison or approval', () => {
    render(<MemoryRouter><RankingCutoffSection state="no_profile" entries={[]} userScore={null} onOpenCutoffTable={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Referências de corte')).toBeInTheDocument();
    expect(screen.getByText('Defina sua especialidade e instituições-alvo para consultar referências de corte.')).toBeInTheDocument();
    expect(screen.queryByText(/Você passaria|comparar sua nota/)).not.toBeInTheDocument();
  });
});

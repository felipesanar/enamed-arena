import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RankingHero } from './RankingHero';

describe('RankingHero edition badge', () => {
  it('follows the selected exam metadata, not a target edition', () => {
    const { rerender } = render(<MemoryRouter><RankingHero standing={null} notaMedia={0} evolution={null}
      simuladoTitle="Simulado 1" simulado={{ editionCode: '2026' }} /></MemoryRouter>);
    expect(screen.getByText('Ranking ENAMED 2026 · Simulado 1')).toBeInTheDocument();
    rerender(<MemoryRouter><RankingHero standing={null} notaMedia={0} evolution={null}
      simuladoTitle="Simulado 1" simulado={{ editionCode: '2027.1' }} /></MemoryRouter>);
    expect(screen.getByText('Ranking ENAMED 2027.1 · Simulado 1')).toBeInTheDocument();
    rerender(<MemoryRouter><RankingHero standing={null} notaMedia={0} evolution={null} /></MemoryRouter>);
    expect(screen.getByText('Ranking ENAMED')).toBeInTheDocument();
  });
});

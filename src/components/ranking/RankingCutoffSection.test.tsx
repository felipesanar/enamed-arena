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
  });
});

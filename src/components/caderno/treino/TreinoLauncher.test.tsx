import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TreinoLauncher } from '@/components/caderno/treino/TreinoLauncher';
import type { RankedWeakArea } from '@/lib/weakAreas';
const area: RankedWeakArea = { area: 'Clínica', theme: 'Cardio', pending: 15, total: 15, totalLapses: 0, score: 15, topReason: 'did_not_know', entryIds: [] };
describe('drill edition URL', () => {
  afterEach(cleanup);
  it.each([true, false])('preserves drill/count/timed and only adds edition when flag %s', enabled => {
    render(<MemoryRouter><TreinoLauncher area={area} timed onTimedChange={vi.fn()} onLaunch={vi.fn()} editionId="edition-b" editionsEnabled={enabled} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /Começar revisão do caderno/ });
    const url = new URL(link.getAttribute('href')!, 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ mode: 'drill', area: 'Clínica', theme: 'Cardio', count: '10', timed: '1', ...(enabled ? { edition: 'edition-b' } : {}) });
  });
});

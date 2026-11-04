import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ query: { data: undefined as unknown, isPending: false, isError: false, refetch: vi.fn() } }));
vi.mock('@/hooks/useEditionAnalysis', () => ({ usePercentileHistory: () => mocks.query }));
import { PercentileHistorySection } from './PercentileHistorySection';
const item = { simulado_id: 's1', edition_id: 'ed1', code: '2027.1', label: 'Edição A', sequence: 1, date: '2026-01-01T12:00:00Z', position: 5, population: 25, top_percentile: 20, metadata: { small_sample: true } };
beforeEach(() => { mocks.query = { data: undefined, isPending: false, isError: false, refetch: vi.fn() }; });
describe('percentile history semantics', () => {
  it('groups editions without connecting raw scores and keeps sample size/positions accessible', () => {
    mocks.query.data = { items: [item, { ...item, simulado_id: 's2', edition_id: 'ed2', code: '2027.2', label: 'Edição B', population: 100, top_percentile: 5, metadata: { small_sample: false } }] };
    render(<PercentileHistorySection />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Top 20%')).toBeInTheDocument();
    expect(screen.getByText(/Amostra pequena/)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'População' })).toBeInTheDocument();
  });
  it('does not turn a missing percentile into zero or a plotted point', () => {
    mocks.query.data = { items: [{ ...item, top_percentile: null }] };
    render(<PercentileHistorySection />);
    expect(screen.getByText('Percentil indisponível')).toBeInTheDocument();
    expect(screen.queryByText('Top 0%')).not.toBeInTheDocument();
    expect(document.querySelector('circle')).toBeNull();
  });
});

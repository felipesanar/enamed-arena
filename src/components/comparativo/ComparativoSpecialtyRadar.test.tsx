import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComparativoSpecialtyRadar } from './ComparativoSpecialtyRadar';
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';
import type { PropsWithChildren } from 'react';

const chart = vi.hoisted(() => ({ data: [] as Array<Record<string, number | string>> }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  RadarChart: ({ children, data }: PropsWithChildren<{ data: typeof chart.data }>) => { chart.data = data; return <div>{children}</div>; },
  Radar: ({ dataKey, name }: { dataKey: string; name: string }) => <span data-testid="series" data-key={dataKey}>{name}</span>,
  PolarGrid: () => null, PolarAngleAxis: () => null, PolarRadiusAxis: () => null, Legend: () => null, Tooltip: () => null,
}));

describe('comparative radar series identity', () => {
  it('preserves two Simulado 1 series and uses separate human-readable edition labels', () => {
    const entries = [
      { simuladoId: 'old-id', sequenceNumber: 1, editionCode: '2026', title: 'Antiga', areaScores: { Cirurgia: 30 } },
      { simuladoId: 'new-id', sequenceNumber: 1, editionCode: '2027.1', title: 'Atual', areaScores: { Cirurgia: 80 } },
    ] as unknown as ComparativeEntryRich[];
    render(<ComparativoSpecialtyRadar entries={entries} />);
    expect(screen.getAllByTestId('series').map(el => el.getAttribute('data-key'))).toEqual(['old-id', 'new-id']);
    expect(chart.data).toEqual([{ area: 'Cirurgia', 'old-id': 30, 'new-id': 80 }]);
    expect(screen.getAllByTestId('series').map(el => el.textContent)).toEqual(['2026 · Simulado 1 · Antiga', '2027.1 · Simulado 1 · Atual']);
    expect(screen.getByLabelText('2026 · Simulado 1: 30%')).toBeInTheDocument();
    expect(screen.getByLabelText('2027.1 · Simulado 1: 80%')).toBeInTheDocument();
  });
});

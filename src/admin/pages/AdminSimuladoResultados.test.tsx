import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext';
const mocks = vi.hoisted(() => ({ enabled: true, context: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled }));
vi.mock('@/admin/services/adminReprocessApi', () => ({ adminReprocessApi: { context: mocks.context } }));
vi.mock('@/admin/hooks/useAdminSimuladosAnalytics', () => ({
  useAdminSimuladoDetailStats: () => ({ data: { title: 'Simulado teste', sequence_number: 1, participants: 0, completion_rate: 0, avg_score: 0, abandonment_rate: 0, median_time_minutes: 0, p90_time_minutes: 0 } }),
  useAdminSimuladoQuestionStats: () => ({ data: [] }),
}));
vi.mock('@/admin/hooks/useSimuladoResultsRoster', () => ({ useSimuladoResultsRoster: () => ({ rows: [], totalRows: 0 }) }));
vi.mock('@/admin/services/adminApi', () => ({ adminApi: { getScoreDistribution: async () => [], getPerformanceByArea: async () => [], getSimuladoResultsRoster: async () => [] } }));
vi.mock('@/admin/components/ui/AdminTrendChart', () => ({ AdminTrendChart: () => null }));
vi.mock('@/admin/components/AdminAttemptSummaryDialog', () => ({ AdminAttemptSummaryDialog: () => null }));
import AdminSimuladoResultados from './AdminSimuladoResultados';
function mount(capabilities: string[]) {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/admin/simulados/s/resultados']}><AdminAccessProvider roles={[]} capabilities={capabilities}><Routes><Route path="/admin/simulados/:id/resultados" element={<AdminSimuladoResultados />} /></Routes></AdminAccessProvider></MemoryRouter></QueryClientProvider>);
}
describe('contextual reprocess integration', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.enabled = true; mocks.context.mockResolvedValue({ title: 'Simulado teste', edition: { label: 'Edição teste' }, execution_window_end: '2020-01-01' }); });
  it('leaves the legacy results reader without a new contextual request', () => {
    mount(['results.view']);
    expect(screen.getByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprocessar resultados' })).not.toBeInTheDocument();
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it('uses the route simulado for authorized reprocessing', async () => {
    mount(['results.view', 'content.manage', 'attempts.manage']);
    fireEvent.click(screen.getByRole('button', { name: 'Reprocessar resultados' }));
    await screen.findByText('Simulado teste · Edição teste');
    expect(mocks.context).toHaveBeenCalledExactlyOnceWith('s');
  });
});

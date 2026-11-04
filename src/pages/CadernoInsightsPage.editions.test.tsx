import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('@/services/notebookApi', () => ({ notebookApi: { getPatternInsights: vi.fn(), getAreaScoreHistory: vi.fn(), getConfidenceCalibration: vi.fn() } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getPatternInsights: vi.fn(), getAreaScoreHistory: vi.fn(), getConfidenceCalibration: vi.fn() } }));
vi.mock('@/components/caderno/insights/RoiPanel', () => ({ RoiPanel: () => <div>Edition score chart</div> }));
vi.mock('@/components/caderno/insights/CalibrationPanel', () => ({ CalibrationPanel: () => <div>Confidence panel</div> }));
import { notebookApi } from '@/services/notebookApi';
import { simuladosApi } from '@/services/simuladosApi';
import { InsightsContent } from '@/pages/CadernoInsightsPage';

function mount(editionId: string | null, editionsEnabled = true) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <InsightsContent userId="owner" userName="Demo" editionsEnabled={editionsEnabled} editionId={editionId} />
  </QueryClientProvider>);
}
describe('score evolution scope', () => {
  beforeEach(() => {
    cleanup(); vi.resetAllMocks();
    vi.mocked(notebookApi.getPatternInsights).mockResolvedValue({ insights: [], generated_at: '2026-01-01', has_sufficient_data: true, editionId: null, editionLabel: null });
    vi.mocked(notebookApi.getConfidenceCalibration).mockResolvedValue({ buckets: [], overall: { total_answered_with_confidence: 0, alta_but_wrong: 0, baixa_but_correct: 0 } });
    vi.mocked(notebookApi.getAreaScoreHistory).mockResolvedValue([]);
  });
  it('keeps cumulative causes/confidence but never fetches or renders mixed score history', async () => {
    mount(null);
    await screen.findByText(/Selecione uma edição para ver a evolução/);
    await screen.findByText('Confidence panel');
    expect(notebookApi.getPatternInsights).toHaveBeenCalledWith(null);
    expect(notebookApi.getConfidenceCalibration).toHaveBeenCalledWith(null);
    expect(notebookApi.getAreaScoreHistory).not.toHaveBeenCalled();
    expect(screen.queryByText('Edition score chart')).not.toBeInTheDocument();
  });
  it('requests score history only within the selected edition', async () => {
    mount('edition-b');
    await screen.findByText('Edition score chart');
    expect(notebookApi.getAreaScoreHistory).toHaveBeenCalledWith('edition-b');
    expect(notebookApi.getPatternInsights).toHaveBeenCalledWith('edition-b');
  });
  it('preserves legacy queries with the flag disabled', async () => {
    vi.mocked(simuladosApi.getPatternInsights).mockResolvedValue({ insights: [], generated_at: '2026-01-01', has_sufficient_data: true });
    mount('ignored', false);
    await waitFor(() => expect(simuladosApi.getAreaScoreHistory).toHaveBeenCalledWith('owner'));
    expect(notebookApi.getAreaScoreHistory).not.toHaveBeenCalled();
    expect(notebookApi.getPatternInsights).not.toHaveBeenCalled();
  });
});

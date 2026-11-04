import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext';
const mocks = vi.hoisted(() => ({ enabled: true, context: vi.fn(), reprocess: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled }));
vi.mock('@/admin/services/adminReprocessApi', async original => ({ ...await original<object>(), adminReprocessApi: mocks }));
import { ReprocessSimuladoDialog } from './ReprocessSimuladoDialog';
function mount(capabilities = ['content.manage', 'attempts.manage'], client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}><AdminAccessProvider roles={[]} capabilities={capabilities}><ReprocessSimuladoDialog simuladoId="s" /></AdminAccessProvider></QueryClientProvider>);
}
describe('reprocess dialog (mock RPC)', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled = true;
    mocks.context.mockResolvedValue({ id: 's', title: 'Prova teste', execution_window_end: '2020-01-01', edition: { label: 'Edição teste' } });
    mocks.reprocess.mockResolvedValue({ operation_id: 'op', attempts_processed: 12, scores_changed: 3, entries_reconciled: 4, idempotent: false });
  });
  it.each([{ capabilities: [] }, { capabilities: ['content.manage'] }, { capabilities: ['attempts.manage'] }])('does not expose action or query for $capabilities', ({ capabilities }) => {
    mount(capabilities); expect(screen.queryByRole('button')).not.toBeInTheDocument(); expect(mocks.context).not.toHaveBeenCalled();
  });
  it('does not query with flag off', () => { mocks.enabled = false; mount(); expect(mocks.context).not.toHaveBeenCalled(); });
  it('requires reason, prevents duplicate submission and shows only aggregate report', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Reprocessar resultados' }));
    await screen.findByText('Prova teste · Edição teste');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprocessamento' }));
    expect(screen.getByLabelText('Motivo')).toHaveFocus(); expect(mocks.reprocess).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Correção revisada' } });
    const confirm = screen.getByRole('button', { name: 'Confirmar reprocessamento' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByText(/12 tentativas processadas/);
    expect(mocks.reprocess).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps reason and dialog on lock failure', async () => {
    mocks.reprocess.mockRejectedValue({ code: '55P03' });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Reprocessar resultados' }));
    await screen.findByText('Prova teste · Edição teste');
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Motivo mantido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprocessamento' }));
    await screen.findByText(/Prova ocupada/);
    expect(screen.getByLabelText('Motivo')).toHaveValue('Motivo mantido');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Motivo')).toHaveFocus());
  });
  it('starts focused on reason, returns focus on Escape, and focuses report after success', async () => {
    mount();
    const trigger = screen.getByRole('button', { name: 'Reprocessar resultados' });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByLabelText('Motivo')).toHaveFocus());
    fireEvent.keyDown(screen.getByLabelText('Motivo'), { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    await screen.findByText('Prova teste · Edição teste');
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Correção revisada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprocessamento' }));
    await waitFor(() => expect(screen.getByText('Reprocessamento concluído').parentElement).toHaveFocus());
  });
  it('refreshes only active admin results of the current simulado and marks other affected prefixes stale', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const current: QueryKey[] = ['simulado-detail-stats', 'simulado-question-stats', 'score-distribution', 'performance-by-area', 'simulado-results-aggregate'].map(name => ['admin', name, 's']);
    current.push(['admin', 'simulado-results-roster', { simuladoId: 's' }]);
    const other = [['admin', 'simulado-detail-stats', 'other'], ['admin', 'simulado-results-roster', { simuladoId: 'other' }], ...['user-performance', 'ranking-simulados', 'ranking', 'comparative', 'exam-result', 'exam-result-access', 'simulados', 'simulado', 'notebook-page', 'notebook-counts', 'notebook-due-count', 'caderno-pattern-insights', 'caderno-area-score-history', 'caderno-confidence-calibration'].map(prefix => [prefix, 'another-student'])];
    const keys = [...current, ...other];
    const fetches = keys.map(() => vi.fn().mockResolvedValue('updated'));
    const unsubscribes = keys.map((queryKey, index) => {
      client.setQueryData(queryKey, 'old');
      return new QueryObserver(client, { queryKey, queryFn: fetches[index], staleTime: Infinity }).subscribe(() => {});
    });
    try {
      mount(undefined, client); fireEvent.click(screen.getByRole('button', { name: 'Reprocessar resultados' }));
      await screen.findByText('Prova teste · Edição teste');
      fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Correção revisada' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprocessamento' }));
      await screen.findByText(/12 tentativas processadas/);
      await waitFor(() => current.forEach((key, index) => expect(fetches[index]).toHaveBeenCalledTimes(1)));
      other.forEach((key, index) => {
        expect(fetches[current.length + index]).not.toHaveBeenCalled();
        expect(client.getQueryState(key)?.isInvalidated).toBe(true);
      });
    } finally { unsubscribes.forEach(unsubscribe => unsubscribe()); client.clear(); }
  });
  it('blocks an open execution window', async () => {
    mocks.context.mockResolvedValue({ title: 'Prova aberta', execution_window_end: '2099-01-01', edition: { label: 'Edição' } });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Reprocessar resultados' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar reprocessamento' })).toBeDisabled());
    await screen.findByText(/janela de execução ainda está aberta/);
  });
});

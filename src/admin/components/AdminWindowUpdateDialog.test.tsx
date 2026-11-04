import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminWindowUpdateDialog } from '@/admin/components/AdminWindowUpdateDialog';
import { adminApi } from '@/admin/services/adminApi';
import { invalidateAdminExamQueries } from '@/lib/exam-query-cache';
vi.mock('@/admin/services/adminApi');
vi.mock('@/lib/exam-query-cache', () => ({ invalidateAdminExamQueries: vi.fn() }));
const window = { execution_window_start: '2027-01-01T11:00:00Z', execution_window_end: '2027-01-02T11:00:00Z', results_release_at: '2027-01-03T11:00:00Z' };
const preview = { simulado_id: 's', current_window_hash: 'hash', old_window: window, new_window: window, attempts_examined: 3, old_eligible: 1, new_eligible: 2, eligibility_changed: 1 };
const success = vi.fn();
function mount() { render(<QueryClientProvider client={new QueryClient()}><AdminWindowUpdateDialog simuladoId="s" window={window} onSuccess={success} /></QueryClientProvider>); fireEvent.click(screen.getByRole('button', { name: 'Alterar janela com conferência' })); }
async function ready() { fireEvent.click(screen.getByRole('button', { name: 'Conferir impacto' })); await screen.findByText(/3 tentativas conferidas/); fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Correção de horário' } }); }
describe('safe window dialog', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(adminApi.previewSimuladoWindow).mockResolvedValue(preview); vi.mocked(adminApi.updateSimuladoWindow).mockResolvedValue({ ...preview, operation_id: 'op' }); });
  it('requires preview, validates reason and invalidates preview after date edits', async () => {
    mount(); expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeDisabled();
    await ready();
    fireEvent.change(screen.getByLabelText(/Nova abertura/), { target: { value: '2027-01-01T09:00' } });
    expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeDisabled();
  });
  it('confirms once and invalidates caches only after success', async () => {
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(() => expect(success).toHaveBeenCalledWith(window));
    expect(invalidateAdminExamQueries).toHaveBeenCalledTimes(1);
  });
  it('shows actual mutation counts rather than the earlier preview', async () => {
    vi.mocked(adminApi.updateSimuladoWindow).mockResolvedValue({ ...preview, operation_id: 'op', attempts_examined: 4, eligibility_changed: 2 });
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('4 tentativas conferidas; 2 participações mudaram de elegibilidade.'));
    expect(screen.getByRole('status')).not.toHaveTextContent('3 tentativas conferidas');
  });
  it.each([{ code: '40001', message: 'STALE_WINDOW_HASH' }, { code: '55P03' }])('requires explicit reconfirmation after %j', async failure => {
    vi.mocked(adminApi.updateSimuladoWindow).mockRejectedValue(failure);
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await screen.findByRole('alert'); expect(adminApi.previewSimuladoWindow).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeDisabled();
    expect(invalidateAdminExamQueries).not.toHaveBeenCalled();
  });
  it('keeps uncertain mutation blocked across close/reopen and a new read', async () => {
    vi.mocked(adminApi.updateSimuladoWindow).mockRejectedValue(new TypeError('Failed to fetch'));
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Resultado incerto'));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao formulário' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alterar janela com conferência' }));
    await ready(); expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeDisabled();
    expect(adminApi.updateSimuladoWindow).toHaveBeenCalledTimes(1);
  });
  it.each([{ code: 'P0003' }, { status: 403 }])('treats permission denial as definitive and human: %j', async failure => {
    vi.mocked(adminApi.updateSimuladoWindow).mockRejectedValue(failure);
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Alteração recusada'));
    expect(screen.queryByText(/Resultado incerto/)).not.toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
  });
  it('malformed success remains uncertain after explicit read and preview', async () => {
    vi.mocked(adminApi.updateSimuladoWindow).mockRejectedValue(new Error('Contagens de janela inválidas.'));
    vi.mocked(adminApi.getSimulado).mockResolvedValue({ ...window } as never);
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Resultado incerto'));
    fireEvent.click(screen.getByRole('button', { name: 'Ler janela atual' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Janela atual lida'));
    await ready();
    expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeDisabled();
    expect(adminApi.updateSimuladoWindow).toHaveBeenCalledTimes(1);
    expect(invalidateAdminExamQueries).not.toHaveBeenCalled();
  });
  it('singleflight blocks duplicate confirmation and Escape during a pending write', async () => {
    let resolve!: (value: any) => void;
    vi.mocked(adminApi.updateSimuladoWindow).mockReturnValue(new Promise(done => { resolve = done; }));
    mount(); await ready(); const button = screen.getByRole('button', { name: 'Confirmar alteração' });
    fireEvent.click(button); fireEvent.click(button); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(adminApi.updateSimuladoWindow).toHaveBeenCalledTimes(1);
    resolve({ ...preview, operation_id: 'op' });
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  });
});

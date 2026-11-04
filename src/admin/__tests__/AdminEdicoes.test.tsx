import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext';
const flag = vi.hoisted(() => ({ value: true }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => flag.value }));
vi.mock('@/admin/services/adminEditionsApi', () => ({ adminEditionsApi: { list: vi.fn(), blueprints: vi.fn(), upsert: vi.fn() } }));
import { adminEditionsApi } from '@/admin/services/adminEditionsApi';
import AdminEdicoes from '@/admin/pages/AdminEdicoes';

function mount(capabilities = ['content.manage']) {
  return render(<MemoryRouter><AdminAccessProvider roles={[]} capabilities={capabilities}><AdminEdicoes /></AdminAccessProvider></MemoryRouter>);
}
describe('AdminEdicoes', () => {
  beforeEach(() => {
    vi.clearAllMocks(); flag.value = true;
    vi.mocked(adminEditionsApi.list).mockResolvedValue([]);
    vi.mocked(adminEditionsApi.blueprints).mockResolvedValue([{ id: 'b', code: 'matrix', label: 'Matriz real', weights_provisional: true }]);
    vi.mocked(adminEditionsApi.upsert).mockResolvedValue('e');
  });
  it('does not query new objects with the flag off', () => {
    flag.value = false; mount();
    expect(adminEditionsApi.list).not.toHaveBeenCalled();
    expect(adminEditionsApi.blueprints).not.toHaveBeenCalled();
  });
  it('does not query without capability', () => {
    mount([]);
    expect(screen.getByText('Sem acesso a esta área')).toBeInTheDocument();
    expect(adminEditionsApi.list).not.toHaveBeenCalled();
  });
  it('offers retry after load failure', async () => {
    vi.mocked(adminEditionsApi.list).mockRejectedValueOnce(new Error('offline'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhuma edição cadastrada')).toBeInTheDocument();
  });
  it('edits 2026 without turning official dates into UTC instants', async () => {
    vi.mocked(adminEditionsApi.list).mockResolvedValue([{ id: 'e26', code: '2026', year: 2026, term: null, label: 'ENAMED 2026', status: 'closed',
      exam_date: '2026-09-13', exam_date_confirmed: true, official_results_at: '2026-12-04', blueprint_id: 'b', cutoff_reference_label: null,
      format: { questions: 100, options: 4, duration_minutes: 300, scoring: 'tri', proficient_min: 60 }, created_at: '', updated_at: '' }]);
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Editar 2026' }));
    expect(screen.getByLabelText('Data da prova')).toHaveValue('2026-09-13');
    expect(screen.getByLabelText('Data confirmada')).toBeChecked();
    fireEvent.change(screen.getByLabelText('Rótulo'), { target: { value: 'ENAMED 2026 revisto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
    await waitFor(() => expect(adminEditionsApi.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'e26', year: 2026, term: null, exam_date: '2026-09-13', official_results_at: '2026-12-04', exam_date_confirmed: true })));
  });
  it('keeps form values after failure and saves unknown dates without inventing references', async () => {
    vi.mocked(adminEditionsApi.upsert).mockRejectedValueOnce(new Error('offline'));
    mount(); await screen.findByText('Nenhuma edição cadastrada');
    fireEvent.click(screen.getByRole('button', { name: 'Nova edição' }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: '2027.1' } });
    fireEvent.change(screen.getByLabelText('Rótulo'), { target: { value: 'ENAMED 2027.1' } });
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2027' } });
    fireEvent.change(screen.getByLabelText('Termo'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Matriz'), { target: { value: 'b' } });
    expect(screen.getByLabelText('Data confirmada')).toBeDisabled();
    expect(screen.getByLabelText('Status').querySelectorAll('option')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
    expect(screen.getByLabelText('Código')).toHaveValue('2027.1');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
    await waitFor(() => expect(adminEditionsApi.upsert).toHaveBeenCalledTimes(2));
    expect(vi.mocked(adminEditionsApi.upsert).mock.calls[1][0]).toMatchObject({ exam_date: null, exam_date_confirmed: false, official_results_at: null, cutoff_reference_label: null, blueprint_id: 'b' });
    expect(await screen.findByRole('status')).toHaveTextContent('Edição salva');
  });
});

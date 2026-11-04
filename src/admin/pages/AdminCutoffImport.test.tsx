import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext';
const mocks = vi.hoisted(() => ({ enabled: true, catalog: vi.fn(), existing: vi.fn(), import: vi.fn(), list: vi.fn(), parse: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled }));
vi.mock('@/admin/services/adminCutoffApi', () => ({ adminCutoffApi: mocks }));
vi.mock('@/admin/services/adminEditionsApi', () => ({ adminEditionsApi: { list: mocks.list } }));
vi.mock('@/admin/lib/cutoffImport', async importOriginal => ({ ...await importOriginal<object>(), parseCutoffFile: mocks.parse }));
import AdminCutoffImport from './AdminCutoffImport';

function mount(capabilities = ['content.manage']) {
  return render(<MemoryRouter><AdminAccessProvider roles={[]} capabilities={capabilities}><AdminCutoffImport /></AdminAccessProvider></MemoryRouter>);
}
async function prepare() {
  await screen.findByRole('option', { name: 'Edição teste' });
  fireEvent.change(screen.getByLabelText('Edição de referência'), { target: { value: 'e' } });
  fireEvent.change(screen.getByLabelText('Fonte declarada'), { target: { value: 'Fonte teste' } });
  fireEvent.change(screen.getByLabelText('Arquivo CSV ou XLSX'), { target: { files: [new File([''], 'cortes.csv')] } });
  await screen.findByText('cortes.csv · 1 registro(s)');
  fireEvent.click(screen.getByRole('button', { name: 'Conferir lote' }));
}
describe('cutoff import UI (mock services)', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled = true;
    mocks.catalog.mockResolvedValue({ institutions: [{ id: 'i', name: 'Hospital' }], specialties: [{ id: 's', name: 'Clínica' }] });
    mocks.list.mockResolvedValue([{ id: 'e', label: 'Edição teste', cutoff_reference_label: 'Referência teste' }]);
    mocks.existing.mockResolvedValue(new Set());
    mocks.parse.mockResolvedValue([{ instituicao: 'Hospital', especialidade: 'Clínica', ampla: '720' }]);
    mocks.import.mockResolvedValue({ ok: true, imported: 1, errors: [] });
  });
  it('does not load catalogs without capability or flag', () => {
    const view = mount([]); expect(mocks.catalog).not.toHaveBeenCalled(); view.unmount();
    mocks.enabled = false; mount(); expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it('confirms canonical rows once and requires a changed batch after success', async () => {
    mount(); await prepare();
    const confirm = await screen.findByRole('button', { name: 'Confirmar importação do lote' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByText('1 registro(s) importado(s).');
    expect(mocks.import).toHaveBeenCalledTimes(1);
    expect(mocks.import).toHaveBeenCalledWith('e', 'Fonte teste', [expect.objectContaining({ institution_id: 'i', cutoff_score_general: 720 })]);
    expect(screen.getByRole('button', { name: 'Conferir lote' })).toBeDisabled();
  });
  it('keeps the file and requires fresh database preflight after uncertain response', async () => {
    mocks.import.mockRejectedValue(new TypeError('network'));
    mount(); await prepare();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar importação do lote' }));
    await screen.findByText(/Resultado incerto/);
    expect(screen.queryByRole('button', { name: 'Confirmar importação do lote' })).not.toBeInTheDocument();
    expect(screen.getByText('cortes.csv · 1 registro(s)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir lote' }));
    await waitFor(() => expect(mocks.existing).toHaveBeenCalledTimes(2));
    expect(mocks.import).toHaveBeenCalledTimes(1);
  });
  it('blocks a batch that committed before an uncertain response, after refreshing database keys', async () => {
    mocks.import.mockRejectedValue(new TypeError('timeout'));
    mount(); await prepare();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar importação do lote' }));
    await screen.findByText(/Resultado incerto/);
    mocks.existing.mockResolvedValue(new Set([JSON.stringify(['i', 's', ''])]));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir lote' }));
    await screen.findByText(/Esta referência já existe no banco/);
    expect(mocks.existing).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Confirmar importação do lote' })).not.toBeInTheDocument();
    expect(mocks.import).toHaveBeenCalledTimes(1);
  });
  it('keeps source and file on a server row error with zero imported', async () => {
    mocks.import.mockResolvedValue({ ok: false, imported: 0, errors: [{ row: 1, field: 'practice_scenario', message: 'Reference key already exists' }] });
    mount(); await prepare();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar importação do lote' }));
    await screen.findByText(/0 registros importados/);
    expect(screen.getByLabelText('Fonte declarada')).toHaveValue('Fonte teste');
    expect(screen.getByText('cortes.csv · 1 registro(s)')).toBeInTheDocument();
    expect(screen.getByText(/Referência já cadastrada/)).toBeInTheDocument();
  });
  it('blocks the entire invalid batch and invalidates preview when context changes', async () => {
    mocks.parse.mockResolvedValue([{ instituicao: 'Desconhecido', especialidade: 'Clínica', ampla: '720' }]);
    mount(); await prepare();
    await screen.findByText(/Correspondência não encontrada/);
    expect(mocks.import).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirmar importação do lote' })).not.toBeInTheDocument();
  });
});

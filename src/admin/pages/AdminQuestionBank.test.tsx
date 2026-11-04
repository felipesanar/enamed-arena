import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext';
const mocks = vi.hoisted(() => ({ flag: true, userId: 'staff' as string | null, list: vi.fn(), versions: vi.fn(), analysis: vi.fn(), drafts: vi.fn(), reuse: vi.fn(), editions: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag,
  useAppConfigState: () => ({ enabled: mocks.flag, isPending: false }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.userId ? { id: mocks.userId } : null, loading: false }) }));
vi.mock('@/services/questionBankApi', () => ({ questionBankApi: { list: mocks.list, listVersions: mocks.versions, getAnalysis: mocks.analysis, getDrafts: mocks.drafts, reuseVersion: mocks.reuse } }));
vi.mock('@/services/editionAnalysisApi', () => ({ editionAnalysisApi: { getEditions: mocks.editions } }));
import AdminQuestionBank from './AdminQuestionBank';
const row = { bank_id: 'bank', title: 'Questão de ECG', latest_version_id: 'v2', latest_version_number: 2, latest_state: 'published', usage_count: 3, observed_at: '2026-01-01' };
const payload = { question: { text: '<script>alert(1)</script>Enunciado', area: 'CM', theme: 'Cardio' }, options: [{ label: 'A', text: 'ECG', is_correct: true }, { label: 'B', text: 'TC', is_correct: false }], format: { questions: 100, options: 2 } };
export const versions = [{ id: 'v2', bank_id: 'bank', version_number: 2, state: 'published', provenance: 'observed', observed_at: '2026-01-02', payload }, { id: 'v1', bank_id: 'bank', version_number: 1, state: 'published', provenance: 'legacy_snapshot', observed_at: '2026-01-01', payload: { ...payload, question: { ...payload.question, text: 'Versão anterior' } } }];
function mount(capabilities = ['content.manage']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><AdminAccessProvider roles={[]} capabilities={capabilities}><AdminQuestionBank /></AdminAccessProvider></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); mocks.flag = true; mocks.userId = 'staff'; mocks.list.mockResolvedValue({ items: [row], total: 1501, limit: 50, offset: 0 }); mocks.versions.mockResolvedValue(versions); mocks.analysis.mockResolvedValue([]); mocks.drafts.mockResolvedValue([]); mocks.editions.mockResolvedValue([]); });
describe('administrative question bank permissions and scope', () => {
  it('does not dereference a stale selection or query while logged out', () => { mocks.userId = null; mount(); expect(screen.getByText('Faça login para consultar o banco de questões.')).toBeInTheDocument(); expect(mocks.list).not.toHaveBeenCalled(); });
  it('makes no bank reads under the disabled flag', () => { mocks.flag = false; mount(); expect(mocks.list).not.toHaveBeenCalled(); });
  it('makes no bank reads without content permission', () => { mount([]); expect(screen.getByText('Sem acesso a esta área')).toBeInTheDocument(); expect(mocks.list).not.toHaveBeenCalled(); });
  it('browses and reuses as content editor without querying privileged item analysis', async () => {
    mount(); await screen.findByText('Questão de ECG');
    expect(mocks.analysis).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Ver versões/ }));
    fireEvent.change(await screen.findByLabelText('Versão observada'), { target: { value: 'v1' } });
    await screen.findByText('Foto do legado');
    fireEvent.change(screen.getByLabelText('Versão observada'), { target: { value: 'v2' } });
    expect(mocks.versions).toHaveBeenCalledWith('staff', 'bank', 0);
    expect(screen.getByText(/Análise indisponível para sua permissão/)).toBeInTheDocument();
    expect(mocks.analysis).not.toHaveBeenCalled(); expect(mocks.editions).not.toHaveBeenCalled();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reusar versão 2 em rascunho' })).toBeEnabled();
  });
  it('paginates and applies only an explicit enunciado search', async () => {
    mount(); await screen.findByText('Questão de ECG');
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('staff', { search: '', offset: 50 }));
    fireEvent.change(screen.getByLabelText('Buscar pelo enunciado'), { target: { value: ' ECG ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('staff', { search: 'ECG', offset: 0 }));
  });
  it('queries item analysis only for the selected identity and allowed edition filter', async () => {
    mount(['content.manage','intel.view']); await screen.findByText('Questão de ECG'); expect(mocks.analysis).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Ver versões/ }));
    await waitFor(() => expect(mocks.analysis).toHaveBeenCalledWith('staff', 'bank', null));
  });
});

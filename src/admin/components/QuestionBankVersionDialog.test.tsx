import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminAccessProvider } from '@/admin/contexts/AdminAccessContext';
const mocks = vi.hoisted(() => ({ versions: vi.fn(), analysis: vi.fn(), drafts: vi.fn(), reuse: vi.fn(), close: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => true }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff' }, loading: false }) }));
vi.mock('@/hooks/useEditionAnalysis', () => ({ useAnalysisEditions: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('@/services/questionBankApi', () => ({ questionBankApi: { listVersions: mocks.versions, getAnalysis: mocks.analysis, getDrafts: mocks.drafts, reuseVersion: mocks.reuse } }));
import { QuestionBankVersionDialog } from './QuestionBankVersionDialog';
const payload = { question: { text: 'Enunciado', area: 'CM', theme: 'Tema' }, options: [{ label: 'A', text: 'A', is_correct: true }], format: { questions: 100 } };
const version = { id: 'v2', bank_id: 'bank', version_number: 2, state: 'published', provenance: 'observed', observed_at: '2026-01-02', payload };
function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) { return render(<QueryClientProvider client={client}><MemoryRouter><AdminAccessProvider roles={[]} capabilities={['content.manage']}><QuestionBankVersionDialog bank={{ bank_id: 'bank', title: 'Questão selecionada' }} open onOpenChange={mocks.close} /></AdminAccessProvider></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); mocks.versions.mockResolvedValue([version]); mocks.drafts.mockResolvedValue([{ id: 'draft', title: 'Rascunho autorizado', sequence_number: 3, edition_id: 'ed', status: 'draft', attempts_count: 0 }]); });
describe('explicit bank version reuse', () => {
  it('confirms server-created identity links and invalidates the destination without refreshing unrelated admin data', async () => {
    mocks.reuse.mockResolvedValue({ question_id: 'new-question', bank_id: 'bank', version_id: 'v2', usage_id: 'new-usage', simulado_id: 'draft', edition_id: 'ed', question_number: 8 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const relevant = [['question-bank','staff','',0],['admin','questions','draft']];
    const untouched = ['admin','user-detail','unrelated'];
    relevant.forEach(key => client.setQueryData(key, {})); client.setQueryData(untouched,{});
    mount(client); fireEvent.click(await screen.findByRole('button', { name: 'Reusar versão 2 em rascunho' }));
    await screen.findByRole('option', { name: /Rascunho autorizado/ });
    fireEvent.change(screen.getByLabelText('Simulado de destino'), { target: { value: 'draft' } });
    fireEvent.change(screen.getByLabelText('Número da questão'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao rascunho' }));
    expect(await screen.findByText('Questão 8 adicionada ao rascunho.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conferir o simulado de destino' })).toHaveAttribute('href','/admin/simulados/draft/questoes/editar');
    relevant.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(client.getQueryState(untouched)?.isInvalidated).toBe(false);
  });
  it('keeps incomplete versions readable but disables reuse', async () => {
    mocks.versions.mockResolvedValue([{ ...version, state: 'incomplete' }]); mount();
    expect(await screen.findByRole('button', { name: 'Reusar versão 2 em rascunho' })).toBeDisabled(); expect(mocks.drafts).not.toHaveBeenCalled();
  });
  it('sends selected version and draft only once and offers manual refresh after a lock', async () => {
    mocks.reuse.mockRejectedValue({ code: '55P03' }); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Reusar versão 2 em rascunho' }));
    await screen.findByRole('option', { name: /Rascunho autorizado/ });
    fireEvent.change(screen.getByLabelText('Simulado de destino'), { target: { value: 'draft' } });
    fireEvent.change(screen.getByLabelText('Número da questão'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao rascunho' }));
    await screen.findByText(/Atualize os rascunhos e tente novamente/);
    expect(mocks.reuse).toHaveBeenCalledExactlyOnceWith('staff', { p_version_id: 'v2', p_simulado_id: 'draft', p_question_number: 8 });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar rascunhos' }));
    await waitFor(() => expect(mocks.drafts).toHaveBeenCalledTimes(2)); expect(mocks.reuse).toHaveBeenCalledTimes(1);
  });
  it('does not permit an uncertain acknowledgement to be blindly retried', async () => {
    mocks.reuse.mockRejectedValue(new Error('network')); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Reusar versão 2 em rascunho' }));
    await screen.findByRole('option', { name: /Rascunho autorizado/ });
    fireEvent.change(screen.getByLabelText('Simulado de destino'), { target: { value: 'draft' } });
    fireEvent.change(screen.getByLabelText('Número da questão'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ao rascunho' }));
    await screen.findByText(/Não foi possível confirmar a cópia/);
    expect(screen.getByRole('button', { name: 'Adicionar ao rascunho' })).toBeDisabled(); expect(mocks.reuse).toHaveBeenCalledTimes(1);
  });
});

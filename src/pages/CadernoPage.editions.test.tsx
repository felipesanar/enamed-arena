import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
vi.mock('@/services/notebookApi', () => ({ notebookApi: { listPage: vi.fn(), getCounts: vi.fn(), getForExport: vi.fn() } }));
vi.mock('@/services/editionsApi', () => ({ editionsApi: { getExamEditions: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { segment: 'pro' } }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => true }));
vi.mock('@/components/caderno/CadernoExportMenu', () => ({ CadernoExportMenu: () => <span>Exportar PDF</span> }));
import { notebookApi } from '@/services/notebookApi';
import { editionsApi } from '@/services/editionsApi';
import { NotebookEditionContent } from '@/pages/CadernoPage';

const counts = { total: 1500, mastered: 20, due: 1477, by_area: [{ area: 'Clínica', total: 1500, mastered: 20, due: 1477 }] };
function mount(url = '/caderno') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><TooltipProvider><MemoryRouter initialEntries={[url]}><NotebookEditionContent userId="owner" /></MemoryRouter></TooltipProvider></QueryClientProvider>);
}
describe('edition notebook real paging', () => {
  beforeEach(() => {
    cleanup(); vi.resetAllMocks();
    vi.mocked(editionsApi.getExamEditions).mockResolvedValue([{ id: 'edition-b', code: 'DEMO B', label: 'DEMO B' }] as never);
    vi.mocked(notebookApi.getCounts).mockResolvedValue(counts);
    vi.mocked(notebookApi.listPage).mockImplementation(async (_f, p = {}) => ({ counts, total: 1500, offset: p.offset ?? 0, limit: 50,
      items: Array.from({ length: 50 }, (_, i) => ({ id: `e-${(p.offset ?? 0) + i}`, user_id: 'owner', theme: `Entrada ${(p.offset ?? 0) + i}`, reason: 'did_not_know', created_at: '2026-01-01' })),
    }) as never);
  });
  it('shows 1500 total, next 51–100 and resets filters/selection before requesting the new scope', async () => {
    mount();
    await screen.findByText('1–50 de 1500 entradas');
    fireEvent.click(screen.getByText('Próxima'));
    await screen.findByText('51–100 de 1500 entradas');
    fireEvent.change(screen.getByLabelText('Edição do caderno'), { target: { value: 'edition-b' } });
    await waitFor(() => expect(notebookApi.listPage).toHaveBeenLastCalledWith(expect.objectContaining({ editionId: 'edition-b' }), { offset: 0, limit: 50 }, { editionsEnabled: true }));
    await screen.findByText('1–50 de 1500 entradas');
    fireEvent.change(screen.getByLabelText('Causa do erro'), { target: { value: 'reading_error' } });
    await waitFor(() => expect(notebookApi.listPage).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'reading_error' }), { offset: 0, limit: 50 }, { editionsEnabled: true }));
  }, 20000);
  it('does not fetch cumulative data when an edition URL is unknown', async () => {
    mount('/caderno?edition=unknown&mode=due');
    expect(await screen.findByRole('alert')).toHaveTextContent('Edição não disponível');
    expect(notebookApi.listPage).not.toHaveBeenCalled();
    expect(notebookApi.getCounts).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Limpar edição'));
    await screen.findByText('1–50 de 1500 entradas');
  });
  it('debounces search without stealing input focus or losing typed text', async () => {
    mount();
    await screen.findByText('1–50 de 1500 entradas');
    const input = screen.getByLabelText('Buscar no caderno');
    input.focus();
    const calls = vi.mocked(notebookApi.listPage).mock.calls.length;
    fireEvent.change(input, { target: { value: 'cardio' } });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('cardio');
    expect(notebookApi.listPage).toHaveBeenCalledTimes(calls);
    await waitFor(() => expect(notebookApi.listPage).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'cardio' }), expect.anything(), expect.anything()));
    expect(input).toHaveFocus();
  });
  it('preserves blocked SRS metadata in real cards for outcome and four lapses', async () => {
    vi.mocked(notebookApi.listPage).mockResolvedValue({ total: 2, offset: 0, limit: 50, counts: { total: 2, mastered: 0, due: 0, by_area: [] },
      items: [
        { id: 'blocked', user_id: 'owner', theme: 'Bloqueada por outcome', reason: 'did_not_know', created_at: '2026-01-01', last_review_outcome: 'leech_blocked', srs_lapses: 0, srs_reps: 3, srs_interval: 2, mastered_at: null },
        { id: 'lapses', user_id: 'owner', theme: 'Bloqueada por lapses', reason: 'did_not_know', created_at: '2026-01-01', last_review_outcome: null, srs_lapses: 4, srs_reps: 5, srs_interval: 3, mastered_at: null },
      ],
    } as never);
    mount();
    await screen.findByText('Bloqueada por outcome', { exact: false });
    expect(screen.getAllByLabelText('Questão travada: muitos erros nas revisões')).toHaveLength(2);
    expect(screen.getAllByText('Travada')).toHaveLength(2);
  });
  it('shows catalog failure with retry, not a global fallback', async () => {
    vi.mocked(editionsApi.getExamEditions).mockRejectedValue(new Error('catalog failed'));
    mount('/caderno?edition=edition-b');
    await screen.findByText(/Não foi possível carregar as edições/);
    expect(notebookApi.listPage).not.toHaveBeenCalled();
  });
  it('retries list errors and does not present a count of zero as success', async () => {
    vi.mocked(notebookApi.listPage).mockRejectedValueOnce(new Error('offline'));
    mount(); await screen.findByText('Não foi possível carregar o caderno');
    fireEvent.click(screen.getByText('Tentar novamente'));
    await screen.findByText('1–50 de 1500 entradas');
  });
});

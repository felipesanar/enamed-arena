import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render as renderUi, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EnamedCountdownCard } from './EnamedCountdownCard';
import CadernoRetaFinalPage from '@/pages/CadernoRetaFinalPage';

const clients: QueryClient[] = [];
// These date/countdown regressions exercise the legacy plan under an explicit
// disabled feature. Edition labels and date changes remain real test inputs.
function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['app-config', 'user', 'editions_ui'], false);
  clients.push(client);
  return renderUi(ui, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}

const state = vi.hoisted(() => ({
  nextEdition: null as null | { label: string; exam_date: string | null },
  isPending: false, isError: false,
}));
const notebook = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => state }));
vi.mock('@/hooks/useCadernoRoutes', () => ({ useCadernoRoutes: () => ({ v2: true, retaFinal: '/caderno/reta-final' }) }));
vi.mock('@/contexts/UserContext', () => ({ useHasAccess: () => true, useUser: () => ({ profile: { segment: 'pro' } }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebook: notebook } }));
vi.mock('@/components/caderno/retafinal/RetaFinalHero', () => ({
  RetaFinalHero: ({ daysUntil }: { daysUntil: number }) => <div>Plano: {daysUntil} dias</div>,
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.useRealTimers(); vi.clearAllMocks(); state.isPending = false; state.isError = false; });
const show = () => render(<MemoryRouter><EnamedCountdownCard /></MemoryRouter>);
describe('EnamedCountdownCard', () => {
  it('some durante carregamento, erro ou sem data', () => {
    state.nextEdition = null;
    const view = show();
    expect(screen.queryByRole('link')).toBeNull();
    state.nextEdition = { label: 'ENAMED 2027.1', exam_date: null };
    view.rerender(<MemoryRouter><EnamedCountdownCard /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('mostra nome da edicao e É hoje na virada UTC/SP', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2027-01-02T02:00:00Z'));
    state.nextEdition = { label: 'ENAMED 2027.1', exam_date: '2027-01-01' };
    show();
    expect(screen.getByRole('link').textContent).toContain('É hoje');
    expect(screen.getByRole('link').textContent).toContain('ENAMED 2027.1');
    expect(screen.queryByText(/Faltam 0/)).toBeNull();
  });
  it('reage a data cadastrada sem deploy e respeita janela de 90 dias', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-28T12:00:00-03:00'));
    state.nextEdition = { label: 'ENAMED 2027.1', exam_date: null };
    const view = show();
    state.nextEdition = { ...state.nextEdition, exam_date: '2027-01-01' };
    view.rerender(<MemoryRouter><EnamedCountdownCard /></MemoryRouter>);
    expect(screen.getByRole('link').textContent).toContain('Faltam 34 dias');
    state.nextEdition = { ...state.nextEdition, exam_date: '2027-12-01' };
    view.rerender(<MemoryRouter><EnamedCountdownCard /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('Reta Final por edicao', () => {
  it('ignora resposta antiga depois que a data da edicao muda', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-28T12:00:00-03:00'));
    let resolveOld: (entries: unknown[]) => void;
    notebook.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    notebook.mockResolvedValueOnce([{ id: 'entry', area: null, theme: null }]);
    state.nextEdition = { label: 'ENAMED 2027.1', exam_date: '2027-01-01' };
    const view = render(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    expect(notebook).toHaveBeenCalledTimes(1);

    state.nextEdition = { ...state.nextEdition, exam_date: '2027-01-02' };
    view.rerender(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Plano: 35 dias')).toBeInTheDocument());

    await act(async () => { resolveOld([]); });
    expect(screen.getByText('Plano: 35 dias')).toBeInTheDocument();
    expect(screen.queryByText('Seu caderno está vazio')).toBeNull();
    expect(screen.queryByText('Plano: 34 dias')).toBeNull();
  });
  it('carregamento nao monta plano nem informa prova passada', () => {
    state.nextEdition = null;
    state.isPending = true;
    render(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    expect(screen.queryByText(/já aconteceu|Data a confirmar/)).toBeNull();
    expect(notebook).not.toHaveBeenCalled();
  });
  it('dia zero mostra É hoje e nao monta plano de zero dias', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-02T02:00:00Z'));
    state.nextEdition = { label: 'ENAMED 2027.1', exam_date: '2027-01-01' };
    render(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    expect(screen.getByText('ENAMED 2027.1: É hoje')).toBeInTheDocument();
    expect(notebook).not.toHaveBeenCalled();
  });
  it('sem data nao monta plano nem chama a prova de passada', () => {
    state.nextEdition = { label: 'ENAMED 2027.1', exam_date: null };
    render(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    expect(screen.getByText('Data oficial do ENAMED 2027.1 ainda não divulgada pelo Inep')).toBeInTheDocument();
    expect(screen.queryByText(/já aconteceu/)).toBeNull();
    expect(notebook).not.toHaveBeenCalled();
  });
  it('erro fica neutro e nao consulta o caderno', () => {
    state.nextEdition = null;
    state.isError = true;
    render(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    expect(screen.getByText(/Não foi possível consultar a data oficial/)).toBeInTheDocument();
    expect(notebook).not.toHaveBeenCalled();
  });
  it('data cadastrada monta o plano ate a nova data sem recarregar a pagina', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-28T12:00:00-03:00'));
    const examDate = '2027-01-01';
    state.nextEdition = { label: 'ENAMED 2027.1', exam_date: null };
    notebook.mockResolvedValue([{ id: 'entry', area: null, theme: null }]);
    const view = render(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    state.nextEdition = { ...state.nextEdition, exam_date: examDate };
    view.rerender(<MemoryRouter><CadernoRetaFinalPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Plano: 34 dias')).toBeInTheDocument());
    expect(notebook).toHaveBeenCalledWith('user');
    expect(screen.queryByText(/já aconteceu/)).toBeNull();
  });
});

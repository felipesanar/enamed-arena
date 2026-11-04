import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { EditionStudyContext } from '@/types/edition-calendar';
import CadernoRetaFinalPage from '@/pages/CadernoRetaFinalPage';

const mocks = vi.hoisted(() => ({ enabled: true, user: { id: 'u1' } as { id: string } | null,
  profile: { id: 'u1', segment: 'pro' }, context: null as EditionStudyContext | null,
  loading: false, error: false, allRows: vi.fn(), legacy: vi.fn(), legacyEditions: vi.fn(), retry: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: mocks.profile }) }));
vi.mock('@/hooks/useEditionStudyContext', () => ({ useEditionStudyContext: () => ({ context: mocks.context, loading: mocks.loading, error: mocks.error, refetch: mocks.retry }) }));
vi.mock('@/services/notebookApi', () => ({ notebookApi: { getAllRows: mocks.allRows } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebook: mocks.legacy } }));
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => { mocks.legacyEditions(); return { nextEdition: { label: 'Global next', exam_date: '2099-01-01' }, isPending: false, isError: false }; } }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
const context = (): EditionStudyContext => ({ edition: { id: 'target', code: '2027.2', label: 'ENAMED alvo 2027.2', year: 2027, term: 2,
  status: 'planned', exam_date: '2099-01-01', exam_date_confirmed: true, official_results_at: null, blueprint_id: 'b', format: {}, created_at: '', updated_at: '' },
  date: '2099-01-01', daysUntil: 100, format: { questions: 120, options: 5, duration_minutes: 300, scoring: 'raw' },
  matrixStatus: 'provisional', areaWeights: [{ code: 'ped', label: 'Pediatria', aliases: [], weight: 1 }] });
const row = (id: string, extra = {}) => ({ id, user_id: 'u1', area: 'Pediatria', theme: `Tema ${id}`, reason: 'content_gap',
  srs_due_at: null, srs_reps: 0, srs_lapses: 0, mastered_at: null, resolved_at: null, last_review_outcome: null, ...extra });
function tree(client: QueryClient) { return <QueryClientProvider client={client}><MemoryRouter><CadernoRetaFinalPage /></MemoryRouter></QueryClientProvider>; }
function mount() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return { ...render(tree(client)), client }; }
beforeEach(() => { vi.clearAllMocks(); mocks.enabled = true; mocks.user = { id: 'u1' }; mocks.profile = { id: 'u1', segment: 'pro' };
  mocks.context = context(); mocks.loading = false; mocks.error = false; mocks.allRows.mockResolvedValue([row('q1')]); mocks.legacy.mockResolvedValue([]); });
afterEach(cleanup);
describe('edition Reta Final', () => {
  it('uses target rather than next global and accumulated authorized notebook with exact review IDs', async () => {
    mount(); expect(await screen.findByText(/Revisões acumuladas do caderno · prioridades de ENAMED alvo 2027.2/)).toBeInTheDocument();
    expect(mocks.allRows).toHaveBeenCalledWith({ editionId: null }, { editionsEnabled: true });
    expect(mocks.legacy).not.toHaveBeenCalled(); expect(mocks.legacyEditions).not.toHaveBeenCalled();
    expect(screen.getByText(/Pesos provisórios/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisar hoje' })).toHaveAttribute('href', '/caderno/revisao?entry=q1');
    expect(screen.getByRole('link', { name: /Revisar Tema q1/ })).toHaveAttribute('href', '/caderno/revisao?entry=q1');
    expect(screen.queryByText('35%')).toBeNull();
  });
  it('considers all 1500 entries and excludes mastered/resolved and blocked reviews', async () => {
    mocks.allRows.mockResolvedValue([...Array.from({ length: 1500 }, (_, i) => row(`q${i}`)), row('resolved', { resolved_at: '2026-01-01' }),
      row('mastered', { mastered_at: '2026-01-01' }), row('blocked', { last_review_outcome: 'leech_blocked' }), row('lesson', { last_review_outcome: 'awaiting_lesson' })]);
    mount(); expect(await screen.findByText('1500 questões ativas · 2 dominadas ou resolvidas')).toBeInTheDocument();
    expect(screen.queryByText('Tema blocked')).toBeNull(); expect(screen.queryByText('Tema resolved')).toBeNull();
  });
  it('no date, today, passed and no target never query the notebook or invent a countdown', () => {
    const cases = [{ date: null, daysUntil: null }, { daysUntil: 0 }, { daysUntil: -1 }, { edition: null, date: null, daysUntil: null }];
    for (const value of cases) { mocks.context = { ...context(), ...value }; mount(); expect(mocks.allRows).not.toHaveBeenCalled(); expect(screen.getByRole('link', { name: 'Ir para o Caderno' })).toBeInTheDocument(); cleanup(); }
  });
  it('unknown matrix and invalid format remain explicitly neutral, never official legacy weights', async () => {
    mocks.context = { ...context(), format: null, matrixStatus: 'unavailable', areaWeights: [] }; mount();
    expect(await screen.findByText(/Matriz indisponível/)).toBeInTheDocument(); expect(screen.getByText(/Formato indisponível/)).toBeInTheDocument();
    expect(screen.queryByText(/Peso no ENAMED/)).toBeNull();
  });
  it('hides prior plan synchronously on target loading, logout and flag changes; stale request cannot leak', async () => {
    let finish!: (value: unknown) => void;
    mocks.allRows.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = mount(); await waitFor(() => expect(mocks.allRows).toHaveBeenCalledTimes(1));
    mocks.context = { ...context(), edition: { ...context().edition!, id: 'new', label: 'Novo alvo' } }; mocks.loading = true; view.rerender(tree(view.client));
    finish([row('old')]); await waitFor(() => expect(screen.queryByText('Tema old')).toBeNull());
    expect(screen.queryByText(/prioridades de ENAMED alvo/)).toBeNull();
    mocks.user = null; view.rerender(tree(view.client)); expect(screen.queryByRole('link', { name: 'Revisar hoje' })).toBeNull();
  });
  it('flag off uses legacy notebook and does not call the new adapter', async () => {
    mocks.enabled = false; mount(); await waitFor(() => expect(mocks.legacy).toHaveBeenCalledWith('u1'));
    expect(mocks.allRows).not.toHaveBeenCalled(); expect(mocks.legacyEditions).toHaveBeenCalled();
  });
  it('error supports retry and wrong-owner rows are never shown', async () => {
    mocks.allRows.mockResolvedValue([row('foreign', { user_id: 'other' })]); mount();
    expect(await screen.findByText('Não foi possível carregar o plano.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(screen.queryByText('Tema foreign')).toBeNull();
  });
  it('switching a loaded plan to another target or the legacy flag never renders the old questions', async () => {
    const view = mount(); await screen.findByRole('link', { name: 'Revisar Tema q1' });
    mocks.context = { ...context(), edition: { ...context().edition!, id: 'second', label: 'Segundo alvo' } };
    mocks.allRows.mockImplementationOnce(() => new Promise(() => {})); view.rerender(tree(view.client));
    expect(screen.queryByRole('link', { name: 'Revisar Tema q1' })).toBeNull();
    mocks.enabled = false; view.rerender(tree(view.client));
    expect(screen.queryByText(/prioridades de/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Revisar Tema q1' })).toBeNull();
  });
  it('empty notebook and completed notebook are distinct, with no false empty claim', async () => {
    mocks.allRows.mockResolvedValue([]); mount(); expect(await screen.findByText('Seu caderno está vazio')).toBeInTheDocument(); cleanup();
    mocks.allRows.mockResolvedValue([row('mastered', { mastered_at: '2026-01-01' })]); mount();
    expect(await screen.findByText('Você está em dia!')).toBeInTheDocument(); expect(screen.queryByText('Seu caderno está vazio')).toBeNull();
  });
});

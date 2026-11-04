import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ExamEdition } from '@/types/edition';
import EditionCalendarPage from '@/pages/EditionCalendarPage';

const mocks = vi.hoisted(() => ({ enabled: true, flagPending: false, target: 'later', pending: false, error: false,
  editions: [] as ExamEdition[], sims: [] as unknown[], useEditions: vi.fn(), useSims: vi.fn(), retry: vi.fn(), admin: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.enabled,
  useAppConfigState: () => ({ enabled: mocks.enabled, isPending: mocks.flagPending }) }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: (...args: unknown[]) => { mocks.useEditions(...args); return {
  data: mocks.editions, userEdition: mocks.editions.find(e => e.id === mocks.target), isPending: mocks.pending,
  isError: mocks.error, isSuccess: !mocks.pending && !mocks.error, refetch: mocks.retry }; } }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => { mocks.useSims(); return { simulados: mocks.sims, loading: false, error: null, refetch: mocks.retry }; } }));
vi.mock('@/admin/components/EditionsUiGate', () => ({ EditionsUiGate: () => { mocks.admin(); throw new Error('admin gate forbidden'); } }));
const edition = (id: string): ExamEdition => ({ id, code: id, label: `ENAMED ${id}`, year: 2027, term: 1,
  status: 'planned', exam_date: null, exam_date_confirmed: false, official_results_at: null, format: {}, created_at: '', updated_at: '' });
function calendarRoute() { return <MemoryRouter initialEntries={['/calendario']}><Routes>
  <Route path="/calendario" element={<EditionCalendarPage />} /><Route path="/simulados" element={<p>Destino simulados</p>} />
</Routes></MemoryRouter>; }
function mount() { return render(calendarRoute()); }
beforeEach(() => { vi.clearAllMocks(); mocks.enabled = true; mocks.flagPending = false; mocks.pending = false; mocks.error = false; mocks.target = 'later';
  mocks.editions = [edition('next'), edition('later')]; mocks.sims = [{ id: 's1', editionId: 'later', title: 'Simulado alvo', dbStatus: 'published',
    executionWindowStart: '2027-05-01T12:00:00Z', executionWindowEnd: '2027-05-02T12:00:00Z', resultsReleaseAt: '2027-05-03T12:00:00Z' }]; });
afterEach(cleanup);
describe('EditionCalendarPage student access', () => {
  it('keeps a direct link while the flag loads, without mounting calendar data hooks', () => {
    mocks.enabled = false; mocks.flagPending = true;
    const view = mount();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    expect(screen.queryByText('Destino simulados')).not.toBeInTheDocument();
    expect(mocks.useEditions).not.toHaveBeenCalled();
    expect(mocks.useSims).not.toHaveBeenCalled();
    mocks.flagPending = false; mocks.enabled = true;
    view.rerender(calendarRoute());
    expect(screen.getByRole('heading', { name: 'Calendário de simulados' })).toBeInTheDocument();
    expect(screen.queryByText('Destino simulados')).not.toBeInTheDocument();
  });
  it('redirects only after a pending flag resolves disabled', () => {
    mocks.enabled = false; mocks.flagPending = true;
    const view = mount();
    expect(screen.queryByText('Destino simulados')).not.toBeInTheDocument();
    mocks.flagPending = false; view.rerender(calendarRoute());
    expect(screen.getByText('Destino simulados')).toBeInTheDocument();
    expect(mocks.useEditions).not.toHaveBeenCalled();
    expect(mocks.useSims).not.toHaveBeenCalled();
  });
  it('flag off redirects before mounting data hooks and never consults admin capability', () => {
    mocks.enabled = false; mount(); expect(screen.getByText('Destino simulados')).toBeInTheDocument();
    expect(mocks.useEditions).not.toHaveBeenCalled(); expect(mocks.useSims).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('ordinary student sees target edition, known windows and pending official date', () => {
    mount(); expect(screen.getByRole('combobox', { name: 'Edição consultada' })).toHaveValue('later');
    expect(screen.getByRole('heading', { name: 'Simulado alvo' })).toBeInTheDocument();
    expect(screen.getByText(/Data oficial a confirmar/)).toBeInTheDocument();
    expect(screen.getByText(/01\/05\/2027, 09:00/)).toBeInTheDocument(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('browsing another edition never changes target and preserves selection on refetch', () => {
    const view = mount(); fireEvent.change(screen.getByRole('combobox'), { target: { value: 'next' } });
    expect(screen.queryByRole('heading', { name: 'Simulado alvo' })).not.toBeInTheDocument();
    mocks.editions = [...mocks.editions]; view.rerender(<MemoryRouter initialEntries={['/calendario']}><Routes><Route path="/calendario" element={<EditionCalendarPage />} /><Route path="/simulados" element={<p>Destino simulados</p>} /></Routes></MemoryRouter>);
    expect(screen.getByRole('combobox')).toHaveValue('next'); expect(mocks.target).toBe('later');
  });
  it('offers retry on actual errors and loading is not empty', () => {
    mocks.error = true; mount(); fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); expect(mocks.retry).toHaveBeenCalled();
    cleanup(); mocks.error = false; mocks.pending = true; mount(); expect(screen.getByRole('status')).toHaveTextContent('Carregando');
  });
  it('exports only authorized public metadata through real ICS helpers and revokes the Blob URL', async () => {
    const create = vi.fn((_blob: Blob) => 'blob:test'), revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mocks.sims.push({ ...(mocks.sims[0] as object), id: 'draft', title: 'Secret draft', dbStatus: 'draft' });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Exportar calendário' }));
    const blob = create.mock.calls[0][0] as Blob;
    const text = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(text).toContain('SUMMARY:Simulado alvo'); expect(text).not.toContain('Secret draft');
    expect(text).not.toContain('official-exam'); expect(revoke).toHaveBeenCalledWith('blob:test'); expect(click).toHaveBeenCalled(); click.mockRestore();
  });
  it('confirmed DATE displays the original calendar day and Google uses DATE, not local midnight', () => {
    mocks.editions[1] = { ...edition('later'), exam_date: '2027-06-01', exam_date_confirmed: true }; mount();
    expect(screen.getByText('01/06/2027 · Dia inteiro')).toBeInTheDocument();
    const official = screen.getByRole('link', { name: 'Google Agenda: Prova later' });
    expect(new URL(official.getAttribute('href')!).searchParams.get('dates')).toBe('20270601/20270602');
  });
  it('invalid configuration is explicit and never invents results', () => {
    (mocks.sims[0] as Record<string, unknown>).resultsReleaseAt = 'bad'; mount();
    expect(screen.getByRole('alert')).toHaveTextContent('configuração');
    expect(screen.queryByRole('heading', { name: 'Resultados: Simulado alvo' })).not.toBeInTheDocument();
  });
  it('a malformed confirmed official date is a configuration error, never an official event', () => {
    mocks.editions[1] = { ...edition('later'), exam_date: '2027-02-30', exam_date_confirmed: true }; mount();
    expect(screen.getByRole('alert')).toHaveTextContent('data oficial');
    expect(screen.queryByRole('heading', { name: 'Prova later' })).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { NotebookRow } from '@/types/notebook-pagination';
import type { RankedWeakArea } from '@/lib/weakAreas';
const state = vi.hoisted(() => ({ enabled: true, userId: 'owner' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { segment: 'pro' } }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.enabled }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('@/services/editionsApi', () => ({ editionsApi: { getExamEditions: vi.fn() } }));
vi.mock('@/services/notebookApi', () => ({ notebookApi: { getAllRows: vi.fn() } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebook: vi.fn() } }));
vi.mock('@/components/caderno/treino/WeakAreaPicker', () => ({ WeakAreaPicker: ({ areas, onSelectArea }: { areas: RankedWeakArea[]; onSelectArea: (area: RankedWeakArea) => void }) => <div>{areas.map(a => <button key={a.area} onClick={() => onSelectArea(a)}>{a.area}: {a.total}</button>)}</div> }));
import CadernoTreinoPage from '@/pages/CadernoTreinoPage';
import { notebookApi } from '@/services/notebookApi';
import { editionsApi } from '@/services/editionsApi';
import { simuladosApi } from '@/services/simuladosApi';
const rows = (length: number, area = 'Clínica') => Array.from({ length }, (_, i) => ({ id: `e-${i}`, user_id: state.userId, area, theme: null, reason: 'did_not_know', created_at: '2026-01-01', mastered_at: null, edition_id: area === 'Clínica' ? 'edition-b' : null } as NotebookRow));
function LocationControls() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output aria-label="route">{location.pathname + location.search}</output><button onClick={() => navigate('/caderno/treino?edition=edition-b')}>Select B</button></>;
}
function mount(url = '/caderno/treino') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}><LocationControls /><CadernoTreinoPage /></MemoryRouter></QueryClientProvider>);
}
describe('training dataset edition boundary', () => {
  beforeEach(() => {
    cleanup(); vi.resetAllMocks(); state.enabled = true; state.userId = 'owner';
    vi.mocked(editionsApi.getExamEditions).mockResolvedValue([{ id: 'edition-b', label: 'DEMO B', code: 'B' }] as never);
    vi.mocked(notebookApi.getAllRows).mockResolvedValue(rows(1500));
    vi.mocked(simuladosApi.getErrorNotebook).mockResolvedValue(rows(3, 'Legado'));
  });
  it('loads all 1500 cumulative rows, without the legacy 1000 cap', async () => {
    mount(); await screen.findByText('Clínica: 1500');
    expect(notebookApi.getAllRows).toHaveBeenCalledWith({ editionId: null }, { editionsEnabled: true });
    expect(simuladosApi.getErrorNotebook).not.toHaveBeenCalled();
  });
  it('uses only explicit edition data and preserves edition in launch and back', async () => {
    vi.mocked(notebookApi.getAllRows).mockImplementation(async filters => filters?.editionId === 'edition-b' ? rows(12) : [...rows(12), ...rows(3, 'Manual')]);
    mount('/caderno/treino?edition=edition-b');
    fireEvent.click(await screen.findByText('Clínica: 12'));
    expect(screen.queryByText(/Manual:/)).toBeNull();
    const link = screen.getByRole('link', { name: /Começar revisão do caderno/ });
    const params = new URL(link.getAttribute('href')!, 'http://localhost').searchParams;
    expect(params.get('edition')).toBe('edition-b'); expect(params.get('mode')).toBe('drill'); expect(params.get('count')).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(screen.getByLabelText('route')).toHaveTextContent('/caderno?edition=edition-b');
  });
  it('ignores URL/catalog/new APIs entirely when flag is off', async () => {
    state.enabled = false; mount('/caderno/treino?edition=invalid');
    await screen.findByText('Legado: 3');
    expect(editionsApi.getExamEditions).not.toHaveBeenCalled(); expect(notebookApi.getAllRows).not.toHaveBeenCalled();
    expect(simuladosApi.getErrorNotebook).toHaveBeenCalledWith('owner');
  });
  it.each(['invalid', 'catalog'])('never falls back to cumulative data for %s edition', async kind => {
    if (kind === 'catalog') vi.mocked(editionsApi.getExamEditions).mockRejectedValue(new Error('offline'));
    mount('/caderno/treino?edition=invalid');
    await screen.findByText('Não foi possível carregar o Caderno');
    expect(notebookApi.getAllRows).not.toHaveBeenCalled(); expect(simuladosApi.getErrorNotebook).not.toHaveBeenCalled();
  });
  it('clears selected area and rejects the previous dataset after scope changes', async () => {
    mount(); fireEvent.click(await screen.findByText('Clínica: 1500'));
    expect(screen.getByRole('link', { name: /Começar revisão do caderno/ })).toBeTruthy();
    vi.mocked(notebookApi.getAllRows).mockResolvedValue(rows(6, 'Cirurgia'));
    fireEvent.click(screen.getByText('Select B'));
    await screen.findByText('Cirurgia: 6');
    expect(screen.queryByRole('link', { name: /Começar revisão do caderno/ })).toBeNull();
  });
  it('does not expose rows returned for a different identity', async () => {
    vi.mocked(notebookApi.getAllRows).mockResolvedValue(rows(3).map(row => ({ ...row, user_id: 'other' })));
    mount(); await screen.findByText('Não foi possível carregar o Caderno');
    expect(screen.queryByText('Clínica: 3')).toBeNull();
  });
});

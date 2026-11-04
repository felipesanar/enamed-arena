import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, vi } from 'vitest';
import { HomePagePremium } from './HomePagePremium';
const data = vi.hoisted(() => ({
  flag: true, edition: { id: 'e', label: 'ENAMED 2027.1' } as { id: string; label: string } | null,
  sims: [] as any[], summary: null as any, history: [] as any[], error: null as string | null,
  retry: vi.fn(), ranking: vi.fn(), hero: vi.fn(), banner: vi.fn(),
  catalogError: null as string | null, catalogRetry: vi.fn(),
}));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => data.flag }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => ({ userEdition: data.edition }) }));
vi.mock('@/hooks/useComparativeData', () => ({ useComparativeData: () => ({ entries: [] }) }));

vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { id: 'account-a', segment: 'pro', name: 'Pessoa' }, isOnboardingComplete: true }), useHasAccess: () => false }));
vi.mock('@/hooks/useCadernoRoutes', () => ({ useCadernoRoutes: () => ({ v2: false, base: '/caderno' }) }));
vi.mock('@/hooks/useNotebookDueCount', () => ({ useNotebookDueCount: () => ({}) }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ simulados: data.sims, loading: false, error: data.catalogError, refetch: data.catalogRetry }) }));
vi.mock('@/hooks/useUserPerformance', () => ({ useUserPerformance: () => ({ summary: data.summary, history: data.history, error: data.error, refetch: data.retry, loading: false }) }));
vi.mock('@/hooks/useRanking', () => ({ useRanking: (options: unknown) => { data.ranking(options); return { currentUser: { position: 2, score: 60 }, stats: { totalCandidatos: 100 }, loading: false,
  simuladosWithResults: [{ editionId: 'e' }], userSpecialty: '', userInstitutions: [] }; } }));
vi.mock('@/hooks/useSimuladoDetail', () => ({ useSimuladoDetail: () => ({ questions: [] }) }));
vi.mock('@/hooks/useExamResult', () => ({ useExamResult: () => ({ examState: null }) }));
vi.mock('./HomeHeroSection', () => ({ HomeHeroSection: (props: unknown) => { data.hero(props); return <h1>Olá, Pessoa</h1>; } }));
vi.mock('./NextSimuladoBanner', () => ({ NextSimuladoBanner: (props: unknown) => { data.banner(props); return <span>Calendário em breve</span>; } }));
vi.mock('./EnamedCountdownCard', () => ({ EnamedCountdownCard: () => null }));
vi.mock('./CadernoInsightTeaserCard', () => ({ CadernoInsightTeaserCard: () => null }));
vi.mock('@/components/UpgradeBanner', () => ({ UpgradeBanner: () => null }));
vi.mock('@/components/editions/EditionTargetPrompt', () => ({ EditionTargetPrompt: () => <section aria-label="Prompt de edição">Escolher edição</section> }));
beforeEach(() => { data.flag = true; data.edition = { id: 'e', label: 'ENAMED 2027.1' }; data.sims = []; data.summary = null; data.history = []; data.error = null;
  data.catalogError = null; data.catalogRetry.mockClear(); data.banner.mockClear();
  data.retry.mockClear(); data.ranking.mockClear(); data.hero.mockClear(); });

it('uses actual participant percentile (score 60, position 2 of 100 = Top 2), never a fictional next tier', () => {
  data.summary = { avg_score: 0, total_attempts: 1 }; data.history = [{ score_percentage: 60, finished_at: '2027-01-01' }];
  render(<MemoryRouter><HomePagePremium /></MemoryRouter>);
  expect(screen.getByText('Top 2%')).toBeInTheDocument();
  expect(screen.queryByText('Top 40%')).not.toBeInTheDocument();
  expect(screen.queryByText(/Próximo nível/)).not.toBeInTheDocument();
  expect(data.ranking).toHaveBeenCalledWith({ selection: 'latest-in-edition', editionId: 'e' });
  expect(screen.getByText('Sua média: 0%')).toBeInTheDocument();
});

it('never falls back to completed 2026/training stats and keeps missing target neutral', () => {
  data.sims = [{ editionId: 'old', status: 'completed', userState: { score: 90, finished: true } },
    { editionId: 'e', status: 'completed', userState: { score: 80, finished: true, isWithinWindow: false } }];
  data.edition = null;
  render(<MemoryRouter><HomePagePremium /></MemoryRouter>);
  expect(data.hero.mock.lastCall?.[0].heroState.scenario).not.toBe('results_ready');
  expect(screen.queryByText('Sua média: 85%')).not.toBeInTheDocument();
});

it('exposes retry rather than presenting fictitious performance on error', () => {
  data.error = 'offline';
  render(<MemoryRouter><HomePagePremium /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent(/desempenho/i);
  fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
  expect(data.retry).toHaveBeenCalledTimes(1);
});

it('mounts exactly one prompt without replacing the existing hero', () => {
  render(<MemoryRouter><HomePagePremium /></MemoryRouter>);
  expect(screen.getAllByRole('region', { name: 'Prompt de edição' })).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Olá, Pessoa' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Olá, Pessoa' })).not.toHaveFocus();
});

it.each([false, true])('shows catalog failure with its own retry and preserves valid KPIs (editions_ui=%s)', flag => {
  data.flag = flag; data.catalogError = 'network unavailable';
  data.summary = { avg_score: 60, total_attempts: 1 };
  data.history = [{ score_percentage: 60, finished_at: '2027-01-01' }];
  const { rerender } = render(<MemoryRouter><HomePagePremium /></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar seus simulados.');
  expect(screen.queryByText('Calendário em breve')).not.toBeInTheDocument();
  expect(screen.queryByText(/Nenhum simulado futuro/)).not.toBeInTheDocument();
  expect(data.hero).not.toHaveBeenCalled();
  expect(data.banner).not.toHaveBeenCalled();
  expect(screen.getByText('Top 2%')).toBeInTheDocument();
  expect(screen.getByText('Sua média: 60%')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente os simulados' }));
  expect(data.catalogRetry).toHaveBeenCalledOnce();
  expect(data.retry).not.toHaveBeenCalled();
  data.catalogError = null;
  rerender(<MemoryRouter><HomePagePremium /></MemoryRouter>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('Calendário em breve')).toBeInTheDocument();
  expect(data.hero).toHaveBeenCalled();
  expect(data.ranking).toHaveBeenLastCalledWith({ selection: 'latest-in-edition', editionId: flag ? 'e' : undefined });
});

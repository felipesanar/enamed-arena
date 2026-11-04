import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { HomePagePremium } from './HomePagePremium';

vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { id: 'account-a', segment: 'pro', name: 'Pessoa' }, isOnboardingComplete: true }), useHasAccess: () => false }));
vi.mock('@/hooks/useCadernoRoutes', () => ({ useCadernoRoutes: () => ({ v2: false, base: '/caderno' }) }));
vi.mock('@/hooks/useNotebookDueCount', () => ({ useNotebookDueCount: () => ({}) }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ simulados: [], loading: false }) }));
vi.mock('@/hooks/useUserPerformance', () => ({ useUserPerformance: () => ({ summary: null, history: [], loading: false }) }));
vi.mock('@/hooks/useRanking', () => ({ useRanking: () => ({ currentUser: null, stats: null, loading: false, simuladosWithResults: [], userSpecialty: '', userInstitutions: [] }) }));
vi.mock('@/hooks/useSimuladoDetail', () => ({ useSimuladoDetail: () => ({ questions: [] }) }));
vi.mock('@/hooks/useExamResult', () => ({ useExamResult: () => ({ examState: null }) }));
vi.mock('./HomeHeroSection', () => ({ HomeHeroSection: () => <h1>Olá, Pessoa</h1> }));
vi.mock('./NextSimuladoBanner', () => ({ NextSimuladoBanner: () => null }));
vi.mock('./EnamedCountdownCard', () => ({ EnamedCountdownCard: () => null }));
vi.mock('./CadernoInsightTeaserCard', () => ({ CadernoInsightTeaserCard: () => null }));
vi.mock('@/components/UpgradeBanner', () => ({ UpgradeBanner: () => null }));
vi.mock('@/components/editions/EditionTargetPrompt', () => ({ EditionTargetPrompt: () => <section aria-label="Prompt de edição">Escolher edição</section> }));

it('mounts exactly one prompt without replacing the existing hero', () => {
  render(<MemoryRouter><HomePagePremium /></MemoryRouter>);
  expect(screen.getAllByRole('region', { name: 'Prompt de edição' })).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Olá, Pessoa' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Olá, Pessoa' })).not.toHaveFocus();
});

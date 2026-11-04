import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SimuladosPage from './SimuladosPage';
import type { SimuladoWithStatus } from '@/types';
import type { PropsWithChildren } from 'react';

const data = vi.hoisted(() => ({ flag: true, edition: { id: 'e-new', label: 'ENAMED 2027.1' } as { id: string; label: string } | null,
  sims: [] as SimuladoWithStatus[], editionHook: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => data.flag }));
vi.mock('@/hooks/useUserEdition', () => ({ useUserEdition: () => { data.editionHook(); return { userEdition: data.edition }; } }));
vi.mock('@/hooks/useSimulados', () => ({ useSimulados: () => ({ simulados: data.sims, loading: false, editionsUi: data.flag }) }));
vi.mock('@/hooks/useOfflineAttempt', () => ({ useOfflineAttempt: () => ({ activeAttempt: null }) }));
vi.mock('@/components/simulados/ComoFuncionaTutorial', () => ({ COMO_FUNCIONA_MODAL_OPEN_EVENT: 'tutorial', ComoFuncionaSimuladosTrigger: () => null }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ isOnboardingComplete: true }) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/components/simulados/OfflineModeSimpleDialog', () => ({ OfflineModeSimpleDialog: () => null }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => true, motion: new Proxy({}, {
  get: () => ({ children }: PropsWithChildren) => <div>{children}</div>,
}) }));

describe('SimuladosPage edition isolation', () => {
  const current: SimuladoWithStatus = { id: 'new', slug: 'new', title: 'Atual', description: '', sequenceNumber: 1, editionId: 'e-new', editionCode: '2027.1',
    status: 'available', questionsCount: 80, estimatedDuration: '4h', estimatedDurationMinutes: 240,
    executionWindowStart: '2027-01-01T12:00:00Z', executionWindowEnd: '2027-01-02T12:00:00Z', resultsReleaseAt: '2027-01-03T12:00:00Z',
    themeTags: [] };
  function open() { return render(<MemoryRouter><SimuladosPage /></MemoryRouter>); }
  it('uses only the student edition for the hero and collapses older editions', () => {
    data.flag = true; data.edition = { id: 'e-new', label: 'ENAMED 2027.1' };
    data.sims = [{ ...current, id: 'old', slug: 'old', title: 'Histórica', editionId: 'e-old', editionCode: '2026' }, current];
    const { container } = open();
    expect(screen.getByRole('heading', { name: 'Atual' })).toBeInTheDocument();
    expect(screen.getAllByText('2027.1 · Simulado 1')).toHaveLength(2);
    expect(container.querySelector('details')).not.toHaveAttribute('open');
    expect(container.querySelector('summary')).toHaveTextContent('ENAMED 2026 · Treino');
  });
  it('shows a neutral empty main state and keeps history when no edition resolves', () => {
    data.flag = true; data.edition = null; data.sims = [current];
    const { container } = open();
    expect(screen.queryByRole('heading', { name: 'Atual' })).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum simulado disponível nesta edição/)).toBeInTheDocument();
    expect(container.querySelector('summary')).toHaveTextContent('ENAMED 2027.1 · Treino');
    expect(screen.getByText('ENAMED')).toBeInTheDocument();
  });
  it('does not resolve editions or add disclosure controls when the flag is off', () => {
    data.flag = false; data.editionHook.mockClear(); data.sims = [{ ...current, status: 'available_late' }];
    const { container } = open();
    expect(data.editionHook).not.toHaveBeenCalled();
    expect(container.querySelector('details')).toBeNull();
    expect(screen.getByText('Histórico e próximos')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingHowItWorks } from './LandingHowItWorks';
import type { PropsWithChildren } from 'react';
const mocks = vi.hoisted(() => ({ user: null as { id: string } | null, flag: true, from: vi.fn(), list: vi.fn(), editions: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => mocks.flag }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { listSimulados: mocks.list } }));
vi.mock('@/services/editionsApi', () => ({ editionsApi: { getExamEditions: mocks.editions } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => true, motion: new Proxy({}, {
  get: (_target, tag: string) => ({ children }: PropsWithChildren) => tag === 'article' ? <article>{children}</article> : <div>{children}</div>,
}) }));

describe('landing edition calendar', () => {
  it('does not query an anonymous catalog or invent dates when unavailable', () => {
    mocks.user = null; mocks.flag = true; vi.clearAllMocks();
    render(<LandingHowItWorks />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver calendário de execução' }));
    expect(screen.getByText('Calendário indisponível no momento. Consulte os simulados na área do aluno.')).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.editions).not.toHaveBeenCalled();
  });
  it('only shows the active/next edition, never historical exams', async () => {
    mocks.user = { id: 'user' }; mocks.flag = true;
    mocks.editions.mockResolvedValue([{ id: 'current', code: '2027.1', status: 'active', exam_date: null, year: 2027, term: 1 }]);
    mocks.list.mockResolvedValue([
      { id: 'old', title: 'Histórica', editionId: 'old-edition', editionCode: '2026', sequenceNumber: 1, executionWindowStart: '2026-01-01', executionWindowEnd: '2026-01-02' },
      { id: 'new', title: 'Atual', editionId: 'current', editionCode: '2027.1', sequenceNumber: 1, executionWindowStart: '2027-01-01', executionWindowEnd: '2027-01-02' },
    ]);
    render(<LandingHowItWorks />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver calendário de execução' }));
    await waitFor(() => expect(screen.getByText('2027.1 · Simulado 1 · Atual')).toBeInTheDocument());
    expect(screen.queryByText(/Histórica/)).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(true);
  });

  it('uses the old select with editions_ui false and never calls the edition catalog', async () => {
    mocks.user = { id: 'legacy' }; mocks.flag = false; vi.clearAllMocks();
    const query = { select: vi.fn(() => query), in: vi.fn(() => query), order: vi.fn(async () => ({ data: [], error: null })) };
    mocks.from.mockReturnValue(query);
    render(<LandingHowItWorks />);
    await waitFor(() => expect(query.select).toHaveBeenCalledWith('id, title, sequence_number, execution_window_start, execution_window_end'));
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.editions).not.toHaveBeenCalled();
  });
});

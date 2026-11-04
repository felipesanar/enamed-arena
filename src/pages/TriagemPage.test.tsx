import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { simuladosApi } from '@/services/simuladosApi';
import { supabase } from '@/integrations/supabase/client';
import TriagemPage from '@/pages/TriagemPage';

const { user } = vi.hoisted(() => ({ user: { id: 'u1' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { segment: 'pro' } }), useHasAccess: () => true }));
vi.mock('@/hooks/useSimuladoDetail', () => ({ useSimuladoDetail: () => ({ simulado: { id: 'sim1', title: 'Exam' }, loading: false }) }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: {
  getAttempt: vi.fn(), getAttemptQuestionResults: vi.fn(), getAnswers: vi.fn(), getQuestions: vi.fn(), getErrorNotebook: vi.fn(),
} }));
vi.mock('@/components/triagem/TriageItemCard', () => ({ TriageItemCard: () => <div data-testid="candidate">Candidate</div> }));
vi.mock('@/components/triagem/TriageSummaryBar', () => ({ TriageSummaryBar: () => null }));
vi.mock('@/components/caderno/ui', () => ({ CadernoSkeleton: () => null, CadernoEmptyState: () => <div>Empty triage</div>, PageHeaderPremium: () => null }));

function renderPage() {
  return render(<MemoryRouter initialEntries={['/simulados/sim1/triagem']}>
    <Routes><Route path="/simulados/:id/triagem" element={<TriagemPage />} /></Routes>
  </MemoryRouter>);
}
describe('triage released question source', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(simuladosApi.getAttempt).mockResolvedValue({ id: 'attempt1', status: 'submitted' } as never);
    vi.mocked(simuladosApi.getAttemptQuestionResults).mockResolvedValue([
      { question_id: 'q1', selected_option_id: 'o2', correct_option_id: 'o1', is_correct: false, was_answered: true },
    ]);
    vi.mocked(simuladosApi.getAnswers).mockResolvedValue([]);
    vi.mocked(simuladosApi.getErrorNotebook).mockResolvedValue([]);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { classifications: [] }, error: null } as never);
  });
  it('requests gated correction and keeps the released comment for classification', async () => {
    vi.mocked(simuladosApi.getQuestions).mockResolvedValue([{ id: 'q1', number: 1, text: 'Question', area: 'CM', theme: 'Theme',
      correctOptionId: 'o1', explanation: 'Released comment', options: [
        { id: 'o1', label: 'A', text: 'Correct' }, { id: 'o2', label: 'B', text: 'Wrong' },
      ] }]);
    renderPage();
    expect(await screen.findByTestId('candidate')).toBeInTheDocument();
    expect(simuladosApi.getQuestions).toHaveBeenCalledWith('sim1', true);
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledWith('classify-exam-errors', {
      body: { attemptId: 'attempt1', questions: [expect.objectContaining({ explanation: 'Released comment', correctOptionLabel: 'A' })] },
    }));
  });
  it('does not classify a question when the correction source returns no released rows', async () => {
    vi.mocked(simuladosApi.getQuestions).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Empty triage')).toBeInTheDocument();
    expect(screen.queryByTestId('candidate')).not.toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});

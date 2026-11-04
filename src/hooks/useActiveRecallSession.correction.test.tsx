import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Question } from '@/types';

const mocks = vi.hoisted(() => ({ list: vi.fn(), review: vi.fn(), record: vi.fn(), schedule: vi.fn(), invoke: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => false }));
vi.mock('@/hooks/useNotebookEditionFilter', () => ({ useNotebookEditionFilter: () => ({ ready: false, editionId: null, invalid: false, catalog: { isError: false } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebook: mocks.list, getErrorNotebookEntryForReview: mocks.review,
  recordReviewAttempt: mocks.record, scheduleNextReview: mocks.schedule, saveErrorNotebookAiReview: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { useActiveRecallSession } from './useActiveRecallSession';

const question: Question = { id: 'q', number: 1, text: 'Question', area: 'CM', theme: 'Theme',
  options: [{ id: 'a', label: 'A', text: 'A' }, { id: 'b', label: 'B', text: 'B' }], correctOptionId: '', explanationUnavailable: true };
const payload = (q = question) => ({ question: q, userSelectedOptionId: 'a', aiReviewMd: null, aiPractice: null, aiOptionRationales: null, chatCount: 0 });
function mount() {
  const client = new QueryClient();
  return renderHook(() => useActiveRecallSession('owner', 'Aluno'), { wrapper: ({ children }) =>
    <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider> });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([{ id: 'entry', user_id: 'owner', question_id: 'q', simulado_id: 's', reason: 'reading_error', created_at: '2026-01-01' }]);
  mocks.review.mockResolvedValue(payload());
  mocks.record.mockResolvedValue(undefined);
  mocks.schedule.mockResolvedValue({ srsDueAt: '2027-01-01', srsInterval: 1, srsReps: 0, srsEase: 2.5, mastered: false, isLeech: false });
  mocks.invoke.mockResolvedValue({ data: { markdown: 'analysis' }, error: null });
});
describe('recall without a released answer key', () => {
  it('does not record a wrong answer, schedule SRS or invoke AI when correction is unknown', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.reviewData?.question).toBeTruthy());
    act(() => result.current.selectOption('a'));
    act(() => result.current.setConfidence('alta'));
    await act(async () => { await result.current.submitSelfGrade('errei'); await result.current.generateAiReview(true); });
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.correctionUnavailable).toBe(true);
    expect(result.current.phase).toBe('answering');
  });
  it('retries correction without changing the queue or writing learning state', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.reviewData?.question).toBeTruthy());
    mocks.review.mockResolvedValue(payload({ ...question, correctOptionId: 'b' }));
    act(() => result.current.retryCorrection());
    await waitFor(() => expect(result.current.reviewData?.question?.correctOptionId).toBe('b'));
    expect(result.current.correctionUnavailable).toBe(false);
    expect(mocks.review).toHaveBeenCalledTimes(2);
    expect(result.current.currentEntry?.id).toBe('entry');
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});

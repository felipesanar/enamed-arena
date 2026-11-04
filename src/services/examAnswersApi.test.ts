import { describe, expect, it, vi } from 'vitest';
const { upsert, select } = vi.hoisted(() => ({ upsert: vi.fn(), select: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ upsert }) } }));
import { AnswerWriteMismatchError, answerRows, examAnswersApi } from './examAnswersApi';

describe('versioned answer transport', () => {
  it('preserves mutation versions across retries and beacon payloads', async () => {
    const answers = { q: { questionId: 'q', selectedOption: 'a', markedForReview: false,
      highConfidence: false, eliminatedAlternatives: [], confidence: null,
      clientUpdatedAt: '2026-11-04T00:00:00.000Z', answeredAt: '2026-11-04T00:00:00.000Z' } };
    upsert.mockImplementation(rows => { select.mockResolvedValue({ data: rows, error: null }); return { select }; });
    await examAnswersApi.bulkUpsertAnswers('attempt', answers, 'v1');
    await examAnswersApi.bulkUpsertAnswers('attempt', answers, 'v1');
    expect(upsert.mock.calls[0]).toEqual(upsert.mock.calls[1]);
    expect(upsert.mock.calls[0][0]).toEqual(answerRows('attempt', answers, 'v1'));
    expect(answerRows('attempt', answers, 'v1')[0]).toMatchObject({ client_updated_at: answers.q.clientUpdatedAt, answered_at: answers.q.clientUpdatedAt });
  });
  it('keeps legacy selection time separate from mutation time and clears blank answers', () => {
    const answer = { questionId: 'q', selectedOption: 'a', markedForReview: false,
      highConfidence: false, eliminatedAlternatives: [], confidence: null, clientUpdatedAt: null,
      answeredAt: '2020-01-01T00:00:00Z' };
    expect(answerRows('a', { q: answer }, 'v1')[0].answered_at).toBe(answer.answeredAt);
    expect(answerRows('a', { q: { ...answer, clientUpdatedAt: '2026-11-04T00:00:00Z' } }, 'v1')[0].answered_at).toBe(answer.answeredAt);
    expect(answerRows('a', { q: { ...answer, selectedOption: null, answeredAt: null } }, 'v1')[0].answered_at).toBeNull();
  });
  const legacy = { q: { questionId: 'q', selectedOption: 'a', answeredAt: '2020-01-01T00:00:00Z',
    clientUpdatedAt: '2030-01-01T00:00:00Z', markedForReview: false, highConfidence: false, eliminatedAlternatives: [], confidence: null } };
  it('omits the new column from payload and select on confirmed legacy', async () => {
    upsert.mockImplementation(rows => { select.mockResolvedValue({ data: rows, error: null }); return { select }; });
    await examAnswersApi.bulkUpsertAnswers('a', legacy, 'legacy');
    expect(upsert.mock.calls.at(-1)![0][0]).not.toHaveProperty('client_updated_at');
    expect(select.mock.calls.at(-1)![0]).not.toContain('client_updated_at');
  });
  it.each([
    { data: [] },
    { data: [{ question_id: 'q', selected_option_id: 'other' }] },
  ])('rejects ignored or mismatching legacy writes during rollout (%j)', async ({ data }) => {
    upsert.mockReturnValue({ select }); select.mockResolvedValue({ data, error: null });
    await expect(examAnswersApi.bulkUpsertAnswers('a', legacy, 'legacy')).rejects.toBeInstanceOf(AnswerWriteMismatchError);
  });
});

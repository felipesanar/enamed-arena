import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
import { supabase } from '@/integrations/supabase/client';
import { simuladosApi } from '@/services/simuladosApi';

const row = {
  id: 'q1', simulado_id: 'sim1', question_number: 1, text: 'Question', area: 'Area', theme: 'Theme',
  difficulty: null, image_url: null, image_url_2: null,
  explanation: 'LEAK', explanation_image_url: 'https://x.supabase.co/leak.png',
  question_options: [{ id: 'o1', question_id: 'q1', label: 'A', text: 'Answer', is_correct: true }],
};
function query(data = [row]) {
  const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockResolvedValue({ data, error: null });
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}
describe('question release boundary', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); });
  it('requests only public columns and strips restricted fields in exam mode', async () => {
    const builder = query();
    const [question] = await simuladosApi.getQuestions('sim1');
    const select = builder.select.mock.calls[0][0];
    expect(select).not.toMatch(/\*|explanation|is_correct/);
    expect(select).toContain('question_options(id, question_id, label, text)');
    expect(question).not.toHaveProperty('explanation');
    expect(question).not.toHaveProperty('explanationImageUrl');
    expect(question.correctOptionId).toBe('');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('merges only the authorized RPC correction, never raw table correction', async () => {
    query();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ question_id: 'q1', explanation: 'Released',
      explanation_image_url: 'https://x.supabase.co/released.png', correct_option_id: 'o1' }], error: null } as never);
    const [question] = await simuladosApi.getQuestions('sim1', true);
    expect(supabase.rpc).toHaveBeenCalledWith('get_question_explanations', { p_simulado_id: 'sim1' });
    expect(question.explanation).toBe('Released');
    expect(question.explanationImageUrl).toBe('https://x.supabase.co/released.png');
    expect(question.correctOptionId).toBe('o1');
  });
  it('does not expose a review question when the RPC denies release', async () => {
    query();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    expect(await simuladosApi.getQuestions('sim1', true)).toEqual([]);
  });
  it('propagates RPC failure without a direct-select fallback', async () => {
    const builder = query();
    const error = { message: 'denied' };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
    await expect(simuladosApi.getQuestions('sim1', true)).rejects.toEqual(error);
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.select.mock.calls[0][0]).not.toMatch(/\*|explanation|is_correct/);
  });
  it('returns zero questions when RLS hides an upcoming exam', async () => {
    query([]);
    expect(await simuladosApi.getQuestions('upcoming')).toEqual([]);
  });
  it('preserves released comments and answer keys in notebook exports', async () => {
    vi.spyOn(simuladosApi, 'getErrorNotebook').mockResolvedValue([
      { id: 'entry1', simulado_id: 'sim1', question_id: 'q1', reason: 'did_not_know' },
    ] as never);
    query();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ question_id: 'q1', explanation: 'Released',
      explanation_image_url: null, correct_option_id: 'o1' }], error: null } as never);
    const [entry] = await simuladosApi.getErrorNotebookForExport('u1');
    expect(entry.explanation).toBe('Released');
    expect(entry.correct_label).toBe('A');
    expect(entry.options).toEqual([{ label: 'A', text: 'Answer', isCorrect: true }]);
  });
});

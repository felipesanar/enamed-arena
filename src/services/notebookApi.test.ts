import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>>() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: rpcMock, auth: { getUser: vi.fn() }, functions: { invoke: vi.fn() } } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebook: vi.fn(), getQuestions: vi.fn() } }));
import { supabase } from '@/integrations/supabase/client';
import { simuladosApi } from '@/services/simuladosApi';
import { notebookApi } from '@/services/notebookApi';
import type { NotebookRow } from '@/types/notebook-pagination';

const enabled = { editionsEnabled: true };
const row = (n: number, extra = {}): NotebookRow => ({
  id: `entry-${n}`, user_id: 'owner', created_at: '2026-01-01', reason: 'did_not_know',
  simulado_id: 'sim-a', question_id: 'q1', area: 'Clínica', theme: 'Tema',
  edition_id: n < 750 ? 'edition-a' : 'edition-b', edition_code: 'DEMO', edition_label: 'Demonstração',
  mastered_at: null, resolved_at: null, srs_due_at: null, next_review_at: null,
  last_review_outcome: null, question_text: 'Texto salvo', ...extra,
} as NotebookRow);
const counts = (total: number) => ({ total, mastered: 0, due: total, by_area: [{ area: 'Clínica', total, mastered: 0, due: total }] });
const page = (items: NotebookRow[], total = items.length, offset = 0, limit = 50) => ({ items, total, offset, limit, counts: counts(total) });
function respond(data: unknown) { vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never); }

describe('notebookApi filtered pagination', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'owner' } }, error: null } as never);
    vi.mocked(simuladosApi.getQuestions).mockResolvedValue([]);
  });
  it('sends canonical filters, trims literal search and never accepts a caller user id', async () => {
    respond(page([row(1)], 51, 50));
    const result = await notebookApi.listPage({ editionId: 'edition-a', reason: 'did_not_know', area: 'Clínica', search: '  50%_  ', state: 'pending' }, { offset: 50 }, enabled);
    expect(result.total).toBe(51);
    expect(supabase.rpc).toHaveBeenCalledWith('list_error_notebook_filtered_page', {
      p_edition_id: 'edition-a', p_reason: 'did_not_know', p_area: 'Clínica', p_search: '50%_', p_state: 'pending', p_limit: 50, p_offset: 50,
    });
  });
  it('uses filtered counts without deriving total from page length', async () => {
    respond(counts(1500));
    expect((await notebookApi.getCounts({ editionId: 'edition-b' }, enabled)).total).toBe(1500);
    expect(supabase.rpc).toHaveBeenCalledWith('get_error_notebook_filtered_counts', expect.objectContaining({ p_edition_id: 'edition-b', p_state: 'all' }));
  });
  it('requests insights and calibration with explicit cumulative or edition scope', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { editionId: null, editionLabel: null, insights: [], generated_at: '2026-01-01', has_sufficient_data: false }, error: null });
    await notebookApi.getPatternInsights(null);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('caderno-pattern-insights', { body: { editionId: null } });
    respond({ buckets: [], overall: {} });
    await notebookApi.getConfidenceCalibration('edition-b');
    expect(rpcMock).toHaveBeenCalledWith('get_confidence_calibration', { p_user_id: 'owner', p_edition_id: 'edition-b' });
  });
  it('requires an explicit edition for score history', async () => {
    await expect(notebookApi.getAreaScoreHistory('')).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
    respond([]);
    await notebookApi.getAreaScoreHistory('edition-b');
    expect(rpcMock).toHaveBeenCalledWith('get_area_score_history', { p_user_id: 'owner', p_edition_id: 'edition-b' });
  });
  it('rejects a pattern response belonging to a different edition', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { editionId: 'edition-a', insights: [] }, error: null });
    await expect(notebookApi.getPatternInsights('edition-b')).rejects.toThrow();
  });
  it('exports 1500 rows in bounded pages of 100 with unchanged filters and one enrichment per exam', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => row(i, { edition_id: 'edition-b' }));
    rpcMock.mockImplementation(async (_name, args) => {
      const offset = args.p_offset as number;
      return { data: page(rows.slice(offset, offset + 100), 1500, offset, 100), error: null } as never;
    });
    vi.mocked(simuladosApi.getQuestions).mockResolvedValue([{
      id: 'q1', number: 2, text: 'Liberado', options: [{ id: 'o1', label: 'A', text: 'Opção' }], correctOptionId: 'o1', explanation: 'Explicação liberada',
    }] as never);
    const result = await notebookApi.getForExport({ editionId: 'edition-b', search: 'Tema' }, enabled);
    expect(result).toHaveLength(1500);
    expect(supabase.rpc).toHaveBeenCalledTimes(15);
    for (const [, args] of vi.mocked(supabase.rpc).mock.calls) expect(args).toMatchObject({ p_edition_id: 'edition-b', p_search: 'Tema', p_limit: 100 });
    expect(simuladosApi.getQuestions).toHaveBeenCalledExactlyOnceWith('sim-a', true);
    expect(result[0]).toMatchObject({ edition_id: 'edition-b', correct_label: 'A', explanation: 'Explicação liberada' });
  });
  it.each(['empty', 'repeated', 'offset', 'total', 'limit', 'edition', 'short', 'counts'])('rejects %s pages rather than partial export or loops', async (kind) => {
    rpcMock.mockImplementation(async (_name, args) => {
      const offset = args.p_offset as number;
      let items = Array.from({ length: 100 }, (_, i) => row(offset + i, { edition_id: 'edition-a' }));
      if (offset && kind === 'empty') items = [];
      if (offset && kind === 'repeated') items = Array.from({ length: 100 }, (_, i) => row(i));
      if (kind === 'short') items = items.slice(0, 50);
      if (kind === 'edition') items[0].edition_id = 'edition-b';
      const data = page(items, offset && kind === 'total' ? 201 : 200, kind === 'offset' ? 99 : offset, kind === 'limit' ? 50 : 100);
      if (kind === 'counts') data.counts.total = 999;
      return { data, error: null } as never;
    });
    await expect(notebookApi.getForExport({ editionId: 'edition-a' }, enabled)).rejects.toThrow();
    expect(simuladosApi.getQuestions).not.toHaveBeenCalled();
    expect(vi.mocked(supabase.rpc).mock.calls.length).toBeLessThanOrEqual(2);
  });
  it('propagates RPC errors, including a later export page', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: page(Array.from({ length: 100 }, (_, i) => row(i)), 101, 0, 100), error: null } as never)
      .mockResolvedValueOnce({ data: null, error: new Error('denied') } as never);
    await expect(notebookApi.getForExport({}, enabled)).rejects.toThrow('denied');
  });
  it('does not use cached answers or invented explanation if the release gate returns no question', async () => {
    respond(page([row(1, { ai_review_md: 'cached answer', ai_option_rationales: { A: 'SECRET' } })], 1, 0, 100));
    expect((await notebookApi.getForExport({}, enabled))[0]).toMatchObject({ options: [], correct_label: null, explanation: null, ai_review_md: null });
  });
  it('keeps unavailable correction neutral and does not reuse a cached analysis', async () => {
    respond(page([row(1, { ai_review_md: 'cached correction' })], 1, 0, 100));
    vi.mocked(simuladosApi.getQuestions).mockResolvedValue([{ id: 'q1', number: 2, text: 'Core question',
      options: [{ id: 'a', label: 'A', text: 'Option A' }], correctOptionId: '', explanationUnavailable: true }] as never);
    const [entry] = await notebookApi.getForExport({}, enabled);
    expect(entry).toMatchObject({ correct_label: null, correction_unavailable: true, ai_review_md: null, explanation: null });
    expect(entry.options[0].isCorrect).toBeNull();
  });
  it('fails export safely when enrichment fails', async () => {
    respond(page([row(1)], 1, 0, 100));
    vi.mocked(simuladosApi.getQuestions).mockRejectedValue(new Error('release denied'));
    await expect(notebookApi.getForExport({}, enabled)).rejects.toThrow('release denied');
  });
  it('preserves manual entries without inventing an edition', async () => {
    respond(page([row(1, { simulado_id: null, question_id: null, edition_id: null, edition_code: null, edition_label: null })], 1, 0, 100));
    const [entry] = await notebookApi.getForExport({}, enabled);
    expect(entry.edition_label).toBeNull();
    expect(entry.question_text).toBe('Texto salvo');
    expect(simuladosApi.getQuestions).not.toHaveBeenCalled();
  });
  it('defaults flag off and delegates to legacy with current user; supports local filters/counts', async () => {
    vi.mocked(simuladosApi.getErrorNotebook).mockResolvedValue([
      row(1, { resolved_at: '2026-01-02' }), row(2, { last_review_outcome: 'leech_blocked' }), row(3, { area: 'Cirurgia' }),
    ]);
    const result = await notebookApi.listPage({ area: 'Clínica', state: 'pending' });
    expect(simuladosApi.getErrorNotebook).toHaveBeenCalledWith('owner');
    expect(result).toMatchObject({ total: 1, counts: { total: 1, mastered: 0, due: 0 } });
    expect(result.items[0].edition_id).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
    await expect(notebookApi.listPage({ editionId: 'edition-a' })).rejects.toThrow();
  });
  it.each([{}, enabled])('rejects missing auth without calling RPC or legacy (%j)', async (options) => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as never);
    await expect(notebookApi.listPage({}, {}, options)).rejects.toThrow();
    await expect(notebookApi.getCounts({}, options)).rejects.toThrow();
    await expect(notebookApi.getForExport({}, options)).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(simuladosApi.getErrorNotebook).not.toHaveBeenCalled();
  });
  it.each([{ limit: 0 }, { limit: 101 }, { offset: -1 }, { limit: 1.5 }])('rejects invalid page %j', async (pagination) => {
    await expect(notebookApi.listPage({}, pagination, enabled)).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it.each([{ search: 'x'.repeat(201) }, { state: 'other' }, { reason: 'nao_sei' }])('rejects invalid filters %j', async (filters) => {
    await expect(notebookApi.listPage(filters as never, {}, enabled)).rejects.toThrow();
  });
  it('rejects rows from a different account even with matching edition and totals', async () => {
    respond(page([row(1, { user_id: 'other' })]));
    await expect(notebookApi.listPage({}, {}, enabled)).rejects.toThrow();
    vi.mocked(simuladosApi.getErrorNotebook).mockResolvedValue([row(1, { user_id: 'other' })]);
    await expect(notebookApi.listPage()).rejects.toThrow();
  });
  it('rejects an identity change while counts with no owner IDs are in flight', async () => {
    rpcMock.mockImplementation(async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'other' } }, error: null } as never);
      return { data: counts(1), error: null } as never;
    });
    await expect(notebookApi.getCounts({}, enabled)).rejects.toThrow();
  });
  it('rejects account changes during page two and never enriches mixed exports', async () => {
    rpcMock.mockImplementation(async (_name, args) => {
      const offset = args.p_offset as number;
      if (offset) vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'other' } }, error: null } as never);
      return { data: page(Array.from({ length: 100 }, (_, i) => row(offset + i)), 200, offset, 100), error: null } as never;
    });
    await expect(notebookApi.getForExport({}, enabled)).rejects.toThrow();
    expect(simuladosApi.getQuestions).not.toHaveBeenCalled();
  });
  it('checks identity again after enrichment, before delivering any PDF data', async () => {
    respond(page([row(1)], 1, 0, 100));
    vi.mocked(simuladosApi.getQuestions).mockImplementation(async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as never);
      return [];
    });
    await expect(notebookApi.getForExport({}, enabled)).rejects.toThrow();
  });
  it('walks all raw rows for recall without reading corrections', async () => {
    respond(page([row(1)], 1, 0, 100));
    expect(await notebookApi.getAllRows({}, enabled)).toHaveLength(1);
    expect(simuladosApi.getQuestions).not.toHaveBeenCalled();
  });
});

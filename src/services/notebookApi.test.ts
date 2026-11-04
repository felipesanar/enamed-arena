import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), auth: { getUser: vi.fn() } } }));
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
  it('exports 1500 rows in bounded pages of 100 with unchanged filters and one enrichment per exam', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => row(i, { edition_id: 'edition-b' }));
    vi.mocked(supabase.rpc).mockImplementation(async (_name, args: Record<string, unknown>) => {
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
    vi.mocked(supabase.rpc).mockImplementation(async (_name, args: Record<string, unknown>) => {
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
});

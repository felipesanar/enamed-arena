import { supabase } from '@/integrations/supabase/client';
import { simuladosApi } from '@/services/simuladosApi';
import { DB_REASON_META } from '@/lib/errorNotebookReasons';
import type { Json } from '@/integrations/supabase/types';
import type { Question } from '@/types';
import type {
  NotebookCounts, NotebookExportEntry, NotebookFilters, NotebookOptions,
  NotebookPage, NotebookPagination, NotebookRow,
} from '@/types/notebook-pagination';

// Additive RPCs are deliberately not generated into the shared Supabase types.
const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: Json; error: unknown }>;

function normalize(filters: NotebookFilters) {
  const search = filters.search?.trim() || null;
  const state = filters.state ?? 'all';
  if ((search && [...search].length > 200) || !['all', 'pending', 'mastered'].includes(state)
    || (filters.reason != null && !Object.hasOwn(DB_REASON_META, filters.reason))) {
    throw new Error('Invalid notebook filters');
  }
  return { p_edition_id: filters.editionId ?? null, p_reason: filters.reason ?? null,
    p_area: filters.area ?? null, p_search: search, p_state: state };
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Authenticated notebook account required');
  return data.user.id;
}

function validateCounts(value: unknown): NotebookCounts {
  const c = value as NotebookCounts;
  if (!c || ![c.total, c.mastered, c.due].every(n => Number.isSafeInteger(n) && n >= 0)
    || c.mastered + c.due > c.total || !Array.isArray(c.by_area)
    || c.by_area.some(a => !a || !(a.area === null || typeof a.area === 'string')
      || ![a.total, a.mastered, a.due].every(n => Number.isSafeInteger(n) && n >= 0)
      || a.mastered + a.due > a.total)
    || ['total', 'mastered', 'due'].some(key => c.by_area.reduce((sum, a) => sum + a[key], 0) !== c[key])) {
    throw new Error('Invalid notebook counts');
  }
  return c;
}

async function legacyRows(userId: string, filters: NotebookFilters): Promise<NotebookRow[]> {
  if (filters.editionId != null) throw new Error('Edition filtering is disabled');
  const args = normalize(filters);
  return (await simuladosApi.getErrorNotebook(userId))
    .filter(row => {
      const mastered = !!(row.mastered_at || row.resolved_at);
      return (!args.p_reason || row.reason === args.p_reason)
        && (args.p_area === null || row.area === args.p_area)
        && (args.p_state === 'all' || (args.p_state === 'mastered' ? mastered : !mastered))
        && (!args.p_search || [row.theme, row.question_text, row.learning_text, row.simulado_title]
          .some(text => text?.toLowerCase().includes(args.p_search.toLowerCase())));
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .map(row => ({ ...row, edition_id: null, edition_code: null, edition_label: null }));
}

function legacyCounts(rows: NotebookRow[]): NotebookCounts {
  const c: NotebookCounts = { total: rows.length, mastered: 0, due: 0, by_area: [] };
  const now = Date.now();
  for (const row of rows) {
    const mastered = Number(!!(row.mastered_at || row.resolved_at));
    const due = Number(!mastered && !['leech_blocked', 'awaiting_lesson'].includes(row.last_review_outcome)
      && Date.parse(row.srs_due_at ?? row.next_review_at ?? row.created_at) <= now);
    let area = c.by_area.find(a => a.area === row.area);
    if (!area) { area = { area: row.area ?? null, total: 0, mastered: 0, due: 0 }; c.by_area.push(area); }
    area.total++; area.mastered += mastered; area.due += due;
    c.mastered += mastered; c.due += due;
  }
  c.by_area.sort((a, b) => a.area === null ? 1 : b.area === null ? -1 : a.area.localeCompare(b.area));
  return c;
}

async function readPage(filters: NotebookFilters, pagination: NotebookPagination, options: NotebookOptions, userId: string): Promise<NotebookPage> {
  const args = normalize(filters);
  const limit = pagination.limit ?? 50;
  const offset = pagination.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Invalid notebook pagination');
  }
  if (!options.editionsEnabled) {
    const rows = await legacyRows(userId, filters);
    return { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset, counts: legacyCounts(rows) };
  }
  const { data, error } = await rpc('list_error_notebook_filtered_page', { ...args, p_limit: limit, p_offset: offset });
  if (error) throw error;
  const page = data as unknown as NotebookPage;
  if (!page || page.limit !== limit || page.offset !== offset || !Number.isSafeInteger(page.total) || page.total < 0
    || !Array.isArray(page.items) || page.items.length !== Math.min(limit, Math.max(0, page.total - offset))
    || page.items.some(row => !row || typeof row.id !== 'string' || !row.id
      || (args.p_edition_id !== null && row.edition_id !== args.p_edition_id))) {
    throw new Error('Inconsistent notebook page; retry the request');
  }
  if (validateCounts(page.counts).total !== page.total) throw new Error('Notebook counts do not match the page');
  return page;
}

export const notebookApi = {
  async listPage(filters: NotebookFilters = {}, pagination: NotebookPagination = {}, options: NotebookOptions = {}): Promise<NotebookPage> {
    return readPage(filters, pagination, options, await currentUser());
  },

  async getCounts(filters: NotebookFilters = {}, options: NotebookOptions = {}): Promise<NotebookCounts> {
    const userId = await currentUser();
    const args = normalize(filters);
    if (!options.editionsEnabled) return legacyCounts(await legacyRows(userId, filters));
    const { data, error } = await rpc('get_error_notebook_filtered_counts', args);
    if (error) throw error;
    return validateCounts(data);
  },

  async getForExport(filters: NotebookFilters = {}, options: NotebookOptions = {}): Promise<NotebookExportEntry[]> {
    const userId = await currentUser();
    // Freeze filter values for the entire export, even if the caller edits its object.
    const snapshot = { ...filters };
    normalize(snapshot);
    const rows: NotebookRow[] = [];
    if (!options.editionsEnabled) {
      rows.push(...await legacyRows(userId, snapshot));
    } else {
      const ids = new Set<string>();
      let total: number | undefined;
      do {
        const page = await readPage(snapshot, { limit: 100, offset: rows.length }, options, userId);
        if (total !== undefined && page.total !== total) throw new Error('Notebook changed during export; retry');
        total = page.total;
        for (const row of page.items) {
          if (ids.has(row.id)) throw new Error('Repeated notebook page; retry export');
          ids.add(row.id); rows.push(row);
        }
      } while (rows.length < total);
    }
    const questions = new Map<string, Question[]>();
    // Sequential bounded enrichment, always using existing server release gates.
    for (const sid of new Set(rows.map(row => row.simulado_id).filter(Boolean))) {
      questions.set(sid, await simuladosApi.getQuestions(sid, true));
    }
    return rows.map(row => {
      const question = questions.get(row.simulado_id)?.find(q => q.id === row.question_id);
      const options = (question?.options ?? []).map(o => ({ label: o.label, text: o.text, isCorrect: o.id === question.correctOptionId }));
      return {
        id: row.id, area: row.area ?? null, theme: row.theme ?? null,
        question_number: row.question_number ?? question?.number ?? null,
        question_text: question?.text ?? row.question_text ?? null, reason: row.reason,
        learning_text: row.learning_text ?? null, simulado_title: row.simulado_title ?? null,
        // No cached correction fallback when the live release gate hides a question.
        ai_review_md: question ? row.ai_review_md ?? null : null,
        created_at: row.created_at, options, correct_label: options.find(o => o.isCorrect)?.label ?? null,
        explanation: question?.explanation ?? null,
        edition_id: row.edition_id, edition_code: row.edition_code, edition_label: row.edition_label,
      };
    });
  },
};

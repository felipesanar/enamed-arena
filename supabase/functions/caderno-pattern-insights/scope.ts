import { record, SummaryError } from '../_shared/aiEditionContext.ts';

type ReadResult = { data: unknown; error: unknown };
export interface PatternClient {
  auth: { getUser(token?: string): PromiseLike<{ data: { user: { id: string; role?: string } | null }; error: unknown }> };
  from(table: string): {
    select(columns: string): { eq(column: string, value: unknown): {
      single(): PromiseLike<ReadResult>; maybeSingle(): PromiseLike<ReadResult>;
    } };
    upsert(row: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: unknown }>;
  };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<ReadResult>;
}
export interface PatternData {
  total_entries: number;
  total_mastered: number;
  area_cause_dist: { area: string | null; reason: string | null; cnt: number; mastered_cnt: number }[];
  overconf: { area: string | null; high_conf_wrong: number; high_conf_total: number }[];
  roi_data: { area: string; first_mastered_at: string; score_before: number | null; score_after: number | null }[];
  recurring_confusion_candidates: { area: string | null; theme: string; cnt: number }[];
  question_samples: { area: string | null; theme: string | null; question_text: string; reason: string | null }[];
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function badData(): never { throw new SummaryError(502, 'Dados do caderno indisponíveis ou inválidos.'); }
function count(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) badData(); return v; }
function text(v: unknown): string { if (typeof v !== 'string') badData(); return v; }
function nullableText(v: unknown): string | null { return v === null ? null : text(v); }
function score(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) badData();
  return v;
}
export function parsePatternData(value: unknown): PatternData {
  const d = record(value); if (!d) badData();
  const rows = <T>(key: string, parse: (row: Record<string, unknown>) => T): T[] => {
    const values = d[key];
    if (values === null) return [];
    if (!Array.isArray(values)) badData();
    return values.map(value => { const r = record(value); if (!r) badData(); return parse(r); });
  };
  const result: PatternData = {
    total_entries: count(d.total_entries), total_mastered: count(d.total_mastered),
    area_cause_dist: rows('area_cause_dist', r => {
      const cnt = count(r.cnt), mastered = count(r.mastered_cnt); if (mastered > cnt) badData();
      return { area: nullableText(r.area), reason: nullableText(r.reason), cnt, mastered_cnt: mastered };
    }),
    overconf: rows('overconf', r => {
      const wrong = count(r.high_conf_wrong), total = count(r.high_conf_total); if (wrong > total) badData();
      return { area: nullableText(r.area), high_conf_wrong: wrong, high_conf_total: total };
    }),
    roi_data: rows('roi_data', r => {
      const date = text(r.first_mastered_at); if (!Number.isFinite(Date.parse(date))) badData();
      return { area: text(r.area), first_mastered_at: date, score_before: score(r.score_before), score_after: score(r.score_after) };
    }),
    recurring_confusion_candidates: rows('recurring_confusion_candidates', r => ({ area: nullableText(r.area), theme: text(r.theme), cnt: count(r.cnt) })),
    question_samples: rows('question_samples', r => ({ area: nullableText(r.area), theme: nullableText(r.theme), question_text: text(r.question_text), reason: nullableText(r.reason) })),
  };
  if (result.total_mastered > result.total_entries) badData();
  return result;
}

export async function loadPatternScope(client: PatternClient, body: Record<string, unknown>, token?: string) {
  let user: { id: string; role?: string } | null;
  try {
    const auth = await client.auth.getUser(token);
    user = auth.error ? null : auth.data.user;
  } catch { throw new SummaryError(401, 'Não autenticado.'); }
  if (!user?.id || user.role === 'service_role' || user.role === 'anon') throw new SummaryError(401, 'Não autenticado.');
  const { data: profile, error: profileError } = await client.from('profiles').select('segment').eq('id', user.id).single();
  if (profileError) throw new SummaryError(503, 'Perfil temporariamente indisponível.');
  if (record(profile)?.segment !== 'pro') throw new SummaryError(403, 'Recurso exclusivo para alunos PRO.');
  const rawId = body.editionId;
  if (rawId != null && !uuid(rawId)) throw new SummaryError(400, 'Edição inválida.');
  const editionId = typeof rawId === 'string' ? rawId.toLowerCase() : null;
  let editionLabel = 'Todas as edições';
  let format: Record<string, unknown> | null = null;
  if (editionId) {
    const { data, error } = await client.rpc('get_exam_editions');
    if (error) throw new SummaryError(503, 'Catálogo temporariamente indisponível.');
    if (!Array.isArray(data) || data.some(item => !record(item) || !uuid(item.id) || typeof item.label !== 'string' || !item.label.trim())) {
      throw new SummaryError(502, 'Catálogo inválido.');
    }
    const edition = data.find(item => item.id.toLowerCase() === editionId);
    if (!edition) throw new SummaryError(400, 'Edição inválida.');
    editionLabel = edition.label;
    const f = record(edition.format);
    // Only official numeric format fields enter the prompt, never arbitrary catalog objects.
    if (f && ['questions', 'options', 'duration_minutes'].every(k => Number.isInteger(f[k]) && Number(f[k]) > 0)
      && ['raw', 'tri'].includes(String(f.scoring))) {
      format = { questions: f.questions, options: f.options, duration_minutes: f.duration_minutes, scoring: f.scoring };
    }
  }
  const { data, error } = await client.rpc('get_caderno_pattern_data', { p_user_id: user.id, p_edition_id: editionId });
  if (error) throw new SummaryError(503, 'Dados do caderno temporariamente indisponíveis.');
  return { userId: user.id, editionId, editionLabel, format, data: parsePatternData(data) };
}

export async function patternFingerprint(value: unknown): Promise<string> {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    const object = record(v);
    return object ? Object.fromEntries(Object.keys(object).sort().map(k => [k, canonical(object[k])])) : v;
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(value))));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function cacheMatches(value: unknown, editionId: string | null, hash: string, now = Date.now()): boolean {
  const row = record(value), payload = record(row?.payload);
  const age = now - (typeof row?.generated_at === 'string' ? Date.parse(row.generated_at) : NaN);
  return !!payload && payload.cache_version === 2 && payload.versionContext === 'notebook-pattern-edition-v2'
    && payload.editionId === editionId && payload.editionScope === editionId && payload.dataHash === hash && payload.patternHash === hash
    && Number.isFinite(age) && age >= 0 && age < 86400000;
}

export function safeCta(value: unknown, editionId: string | null): { label: string; href: string } | null {
  const c = record(value);
  if (!c || typeof c.href !== 'string' || typeof c.label !== 'string' || !c.label.trim()) return null;
  const href = c.href;
  if (!href.startsWith('/') || href.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(href) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(href)) return null;
  try {
    const url = new URL(href, 'https://internal.invalid');
    if (url.origin !== 'https://internal.invalid') return null;
    if (url.pathname === '/caderno' || url.pathname.startsWith('/caderno/')) {
      url.searchParams.delete('edition'); url.searchParams.delete('editionId');
      if (editionId) url.searchParams.set('edition', editionId);
    }
    return { label: c.label, href: url.pathname + url.search + url.hash };
  } catch { return null; }
}
export function scopeInsights<T extends { type: string; cta?: unknown }>(insights: T[], editionId: string | null) {
  return insights.filter(item => editionId !== null || item.type !== 'roi').map(item => ({ ...item, cta: safeCta(item.cta, editionId) }));
}

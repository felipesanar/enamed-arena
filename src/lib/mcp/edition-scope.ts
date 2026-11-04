import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Minimal server-side catalog schema; does not import UI modules into the MCP bundle.
const catalogSchema = z.array(z.object({
  id: z.uuid(), code: z.string(), label: z.string(), year: z.number().int(), term: z.number().nullable(),
  status: z.enum(['planned', 'preparing', 'active', 'closed', 'archived']), exam_date: z.string().nullable(),
}));

export async function resolvePerformanceEdition(client: SupabaseClient, userId: string, explicit?: string, now = new Date()) {
  if (explicit !== undefined && !z.uuid().safeParse(explicit).success) throw new Error('Invalid edition');
  const { data, error } = await client.from('exam_editions').select('id, code, label, year, term, status, exam_date');
  if (error) throw new Error('Catalog unavailable');
  const catalog = catalogSchema.parse(data ?? []).sort((a, b) => a.year - b.year || (a.term ?? 0) - (b.term ?? 0)
    || a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
  if (explicit !== undefined) {
    const edition = catalog.find(e => e.id === explicit);
    if (!edition) throw new Error('Unknown edition');
    return edition;
  }
  if (!catalog.length) return null;
  const { data: profile, error: profileError } = await client.from('onboarding_profiles')
    .select('target_edition_id, expected_graduation_term').eq('user_id', userId).maybeSingle();
  if (profileError) throw new Error('Target unavailable');
  const target = catalog.find(e => e.id === profile?.target_edition_id);
  if (target) return target;
  const graduation = catalog.find(e => e.code === profile?.expected_graduation_term);
  if (graduation) return graduation;
  const eligible = catalog.filter(e => !['closed', 'archived'].includes(e.status));
  // Compare calendar days in the same timezone as resolveUserEdition. Never invent an exam date.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const dated = eligible.filter(e => e.exam_date && /^\d{4}-\d{2}-\d{2}$/.test(e.exam_date)
    && Number.isFinite(Date.parse(e.exam_date)) && e.exam_date >= today)
    .sort((a, b) => a.exam_date!.localeCompare(b.exam_date!) || catalog.indexOf(a) - catalog.indexOf(b));
  return dated[0] ?? eligible.find(e => e.exam_date === null && ['preparing', 'active'].includes(e.status))
    ?? eligible.find(e => e.exam_date === null && e.status === 'planned') ?? null;
}

import { supabase } from '@/integrations/supabase/client';
import { cutoffKey } from '@/admin/lib/cutoffImport';
import type { CanonicalCutoffName, CutoffCatalog, CutoffImportResult, CutoffImportRow } from '@/types/admin-operations';

async function allRows<T>(table: string, columns: string, reference?: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from(table as never).select(columns);
    if (reference) query = query.eq('reference_edition_id' as never, reference);
    const { data, error } = await query.order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data as unknown as T[]));
    if (data.length < 1000) return rows;
  }
}

export const adminCutoffApi = {
  async catalog(): Promise<CutoffCatalog> {
    const institutions = await allRows<CanonicalCutoffName>('enamed_institutions', 'id,name');
    const specialties = await allRows<CanonicalCutoffName>('enamed_specialties', 'id,name');
    return { institutions, specialties };
  },
  async existing(reference: string): Promise<Set<string>> {
    const scores = await allRows<Pick<CutoffImportRow, 'institution_id' | 'specialty_id' | 'practice_scenario'>>('enamed_cutoff_scores', 'id,institution_id,specialty_id,practice_scenario', reference);
    const programs = await allRows<{ institution_id: string; specialty_id: string; cenario_pratica: string }>('enamed_programs', 'id,institution_id,specialty_id,cenario_pratica', reference);
    return new Set([...scores.map(r => cutoffKey(r.institution_id, r.specialty_id, r.practice_scenario ?? '')), ...programs.map(r => cutoffKey(r.institution_id, r.specialty_id, r.cenario_pratica ?? ''))]);
  },
  async import(reference: string, source: string, rows: CutoffImportRow[]): Promise<CutoffImportResult> {
    // New RPCs are not in the generated schema yet; keep the cast at this boundary.
    const { data, error } = await supabase.rpc('admin_import_cutoffs' as never, { p_reference_edition_id: reference, p_source: source.trim(), p_rows: rows } as never);
    if (error) throw error;
    const result = data as unknown as CutoffImportResult;
    if (!result || typeof result.ok !== 'boolean' || !Array.isArray(result.errors) || !Number.isInteger(result.imported)) throw new Error('Unknown import response');
    return result;
  },
};

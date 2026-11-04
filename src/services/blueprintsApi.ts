import { supabase } from '@/integrations/supabase/client';
import { validateExamFormat } from '@/lib/edition-format';
import { adaptEditionBlueprint } from '@/lib/enamedBlueprint';
import type { ExamArea, ExamBlueprint } from '@/types/edition';

interface ReadChain {
  select(columns: string): ReadChain;
  eq(column: string, value: string): ReadChain;
  single(): PromiseLike<{ data: unknown; error: unknown }>;
  order(column: string): PromiseLike<{ data: unknown; error: unknown }>;
}
// Narrow expand boundary, until generated types contain the edition model.
const client = supabase as unknown as { from(table: 'simulados' | 'exam_editions' | 'exam_blueprints' | 'exam_areas'): ReadChain };
const record = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Matriz da edição indisponível.');
  return data as Record<string, unknown>;
};

export const blueprintsApi = {
  async getForSimulado(simuladoId: string) {
    const sim = await client.from('simulados').select('edition_id').eq('id', simuladoId).single();
    if (sim.error) throw sim.error;
    const editionId = record(sim.data).edition_id;
    if (typeof editionId !== 'string') throw new Error('Simulado sem edição.');
    const edition = await client.from('exam_editions').select('id,code,blueprint_id,format').eq('id', editionId).single();
    if (edition.error) throw edition.error;
    const e = record(edition.data);
    const format = validateExamFormat(e.format);
    if (!format.valid || format.value.options < 2 || format.value.options > 26 || typeof e.blueprint_id !== 'string') throw new Error('Formato ou matriz da edição indisponível.');
    const blueprint = await client.from('exam_blueprints').select('id,code,label,weights_provisional').eq('id', e.blueprint_id).single();
    if (blueprint.error) throw blueprint.error;
    const b = record(blueprint.data);
    if (b.id !== e.blueprint_id || typeof b.code !== 'string' || typeof b.label !== 'string' || typeof b.weights_provisional !== 'boolean') throw new Error('Matriz inválida.');
    const areas = await client.from('exam_areas').select('id,blueprint_id,code,label,aliases,weight,sort_order').eq('blueprint_id', e.blueprint_id).order('sort_order');
    if (areas.error) throw areas.error;
    if (!Array.isArray(areas.data) || areas.data.length === 0) throw new Error('Matriz sem áreas configuradas.');
    for (const raw of areas.data) {
      const a = record(raw);
      if (typeof a.id !== 'string' || a.blueprint_id !== b.id || typeof a.code !== 'string' || typeof a.label !== 'string' || !Array.isArray(a.aliases) || a.aliases.some(x => typeof x !== 'string') || typeof a.weight !== 'number' || !Number.isFinite(a.weight) || a.weight <= 0 || a.weight > 1 || !Number.isInteger(a.sort_order)) throw new Error('Área da matriz inválida.');
    }
    return { editionId, editionCode: String(e.code), format: format.value, blueprint: adaptEditionBlueprint(b as unknown as ExamBlueprint, areas.data as ExamArea[]) };
  },
};

import { supabase } from '@/integrations/supabase/client';
import type { EditionDraft, CloneSimuladoInput } from '@/types/edition-admin';
import type { ExamEdition, ExamBlueprint } from '@/types/edition';

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as unknown as T;
}

export const adminEditionsApi = {
  async nextSequence(editionId: string): Promise<number> {
    const { data, error } = await supabase.from('simulados').select('sequence_number').eq('edition_id' as never, editionId).order('sequence_number', { ascending: false }).limit(1);
    if (error) throw error;
    return (data[0]?.sequence_number ?? 0) + 1;
  },
  list: () => rpc<ExamEdition[]>('get_exam_editions', {}),
  async blueprints(): Promise<ExamBlueprint[]> {
    const { data, error } = await supabase.from('exam_blueprints' as never).select('id,code,label,weights_provisional').order('label');
    if (error) throw error;
    return data as unknown as ExamBlueprint[];
  },
  upsert: (edition: EditionDraft) => rpc<string>('admin_upsert_edition', { p_edition: edition }),
  clone: (input: CloneSimuladoInput) => rpc<string>('admin_clone_simulado', {
    p_source: input.sourceSimuladoId, p_edition_id: input.editionId,
    p_window_start: input.windowStart, p_window_end: input.windowEnd,
    p_results_release_at: input.resultsReleaseAt, p_copy_questions: input.copyQuestions,
  }),
  publish: (id: string) => rpc<void>('admin_publish_simulado', { p_simulado_id: id }),
};

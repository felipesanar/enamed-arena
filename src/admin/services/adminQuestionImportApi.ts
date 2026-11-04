import { supabase } from '@/integrations/supabase/client';
import type { QuestionImportRow, QuestionImportResult } from '@/types/question-import';

export const adminQuestionImportApi = {
  async importQuestions(simuladoId: string, rows: QuestionImportRow[], images: Record<number, unknown> = {}): Promise<QuestionImportResult> {
    const { data, error } = await supabase.functions.invoke('admin-upload-questions', { body: { simulado_id: simuladoId, rows, images } });
    if (error) throw error;
    if (!data || typeof data.ok !== 'boolean' || !Number.isInteger(data.imported) || !Array.isArray(data.errors) || (data.ok === false && data.imported !== 0)) throw new Error('Resposta inesperada do servidor ao importar.');
    return data;
  },
};

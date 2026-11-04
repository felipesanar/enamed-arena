import { supabase } from '@/integrations/supabase/client';
import type { ExamEdition } from '@/types/edition';

// Temporary, RPC-specific boundary until generated Supabase types include Phase 0.
const client = supabase as unknown as {
  rpc(name: 'get_exam_editions'): PromiseLike<{ data: unknown; error: unknown }>;
};

export const editionsApi = {
  async getExamEditions(): Promise<ExamEdition[]> {
    const { data, error } = await client.rpc('get_exam_editions');
    if (error) throw error;
    if (data === null) return [];
    if (!Array.isArray(data)) throw new Error('Invalid exam editions response');
    // RPC owns the row schema. JSON format stays opaque (including legacy {}).
    // Consumers requiring format must call validateExamFormat before using it.
    return data as ExamEdition[];
  },
};

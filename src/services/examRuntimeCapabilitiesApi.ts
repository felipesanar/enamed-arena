import { supabase } from '@/integrations/supabase/client';
import type { ExamRuntimeCapabilities } from '@/types/exam-runtime';

export const examRuntimeCapabilitiesApi = {
  async get(): Promise<ExamRuntimeCapabilities | null> {
    // This RPC is additive and intentionally absent on legacy deployments.
    // A local cast avoids editing generated types before the DB rollout.
    const { data, error, status } = await supabase.rpc('get_exam_runtime_capabilities' as never);
    if (error) {
      // PGRST202 can originate from another RPC or an internal call. Only the
      // schema-cache miss for this exact signature proves the probe is absent.
      if (error.code === 'PGRST202' && (status === undefined || status === 404) &&
        /^Could not find the function public\.get_exam_runtime_capabilities(?:\(\)| without parameters) in the schema cache\.?$/.test(error.message ?? '')) return null;
      throw error;
    }
    const value = data as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (value as Record<string, unknown>).version !== 1 ||
      !['answer_freshness_v1', 'safe_auto_finalize', 'question_explanations', 'attempt_counts',
        'server_clock', 'exam_editions'].every(flag => typeof (value as Record<string, unknown>)[flag] === 'boolean')) {
      throw new Error('Invalid exam runtime capabilities');
    }
    return value as ExamRuntimeCapabilities;
  },
};

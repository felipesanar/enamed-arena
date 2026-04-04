/**
 * Offline exam mode API service.
 * All timing-sensitive operations go through SECURITY DEFINER RPCs —
 * the client never sets is_within_window directly.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineAttemptCreated {
  attempt_id: string;
  started_at: string;
  exam_duration_seconds: number;
  simulado_slug: string;
}

export interface OfflineAttemptSubmitResult {
  attempt_id: string;
  is_within_window: boolean;
}

export interface ActiveOfflineAttempt {
  id: string;
  simulado_id: string;
  simulado_slug: string;
  started_at: string;
  effective_deadline: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, params?: Record<string, unknown>) =>
  (supabase.rpc as any)(name, params) as ReturnType<typeof supabase.rpc>;

// ─── API ──────────────────────────────────────────────────────────────────────

export const offlineApi = {
  /**
   * Creates an offline attempt (status='offline_pending').
   * Server sets started_at. Idempotent: returns existing attempt if one exists.
   */
  async createOfflineAttempt(simuladoId: string): Promise<OfflineAttemptCreated> {
    logger.log('[OfflineApi] Creating offline attempt for simulado:', simuladoId);
    const { data, error } = await rpc('create_offline_attempt_guarded', {
      p_simulado_id: simuladoId,
    });
    if (error) {
      logger.error('[OfflineApi] Error creating offline attempt:', error);
      throw error;
    }
    return data as unknown as OfflineAttemptCreated;
  },

  /**
   * Triggers PDF generation via Edge Function and returns a signed download URL.
   * The Edge Function caches the PDF in Storage after the first generation.
   */
  async getSignedPdfUrl(simuladoId: string, force = false): Promise<string> {
    logger.log('[OfflineApi] Requesting signed PDF URL for simulado:', simuladoId);
    const { data, error } = await supabase.functions.invoke('generate-exam-pdf', {
      body: { simulado_id: simuladoId, force },
    });
    if (error) {
      logger.error('[OfflineApi] Error generating PDF:', error);
      throw error;
    }
    const url = (data as { url?: string })?.url;
    if (!url) throw new Error('PDF URL not returned from edge function');
    return url;
  },

  /**
   * Submits offline answers. Server validates timing, sets is_within_window,
   * and finalizes the attempt (calculates score).
   */
  async submitOfflineAnswers(
    attemptId: string,
    answers: Array<{ question_id: string; selected_option_id: string | null }>,
  ): Promise<OfflineAttemptSubmitResult> {
    logger.log('[OfflineApi] Submitting offline answers for attempt:', attemptId);
    const { data, error } = await rpc('submit_offline_answers_guarded', {
      p_attempt_id: attemptId,
      p_answers: answers,
    });
    if (error) {
      logger.error('[OfflineApi] Error submitting offline answers:', error);
      throw error;
    }
    return data as unknown as OfflineAttemptSubmitResult;
  },

  /**
   * Fetches the active offline_pending attempt for the current user, joined with simulado slug.
   */
  async getActiveOfflineAttempt(userId: string): Promise<ActiveOfflineAttempt | null> {
    const { data, error } = await supabase
      .from('attempts')
      .select(`
        id,
        simulado_id,
        started_at,
        effective_deadline,
        status,
        simulados ( slug )
      `)
      .eq('user_id', userId)
      .eq('status', 'offline_pending' as any)
      .maybeSingle();

    if (error) {
      logger.error('[OfflineApi] Error fetching active offline attempt:', error);
      // Return null instead of throwing to maintain offline resilience
      // React Query will still retry, but we won't break the UI
      return null;
    }

    if (!data) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    return {
      id:                 row.id as string,
      simulado_id:        row.simulado_id as string,
      simulado_slug:      (row.simulados as { slug: string } | null)?.slug ?? '',
      started_at:         row.started_at as string,
      effective_deadline: row.effective_deadline as string,
      status:             row.status as string,
    };
  },
};

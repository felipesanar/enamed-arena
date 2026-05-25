/**
 * Simulados API service — real Supabase queries.
 */

import { supabase } from '@/integrations/supabase/client';
import { isUuidString } from '@/lib/simulado-id';
import { logger } from '@/lib/logger';
import type { SimuladoConfig, Question } from '@/types';
import type { ExamAnswer } from '@/types/exam';
import type { TablesInsert } from '@/integrations/supabase/types';

// ─── Types for DB rows ───
export interface SimuladoRow {
  id: string;
  title: string;
  slug: string;
  sequence_number: number;
  description: string;
  questions_count: number;
  duration_minutes: number;
  execution_window_start: string;
  execution_window_end: string;
  results_release_at: string;
  theme_tags: string[];
  status: string;
}

export interface QuestionRow {
  id: string;
  simulado_id: string;
  question_number: number;
  text: string;
  area: string;
  theme: string;
  difficulty: string | null;
  image_url: string | null;
  explanation_image_url: string | null;
  explanation: string | null;
}

export interface QuestionOptionRow {
  id: string;
  question_id: string;
  label: string;
  text: string;
  is_correct?: boolean;
}

export interface AttemptRow {
  id: string;
  simulado_id: string;
  user_id: string;
  status: string;
  current_question_index: number;
  started_at: string;
  effective_deadline: string;
  last_saved_at: string;
  finished_at: string | null;
  tab_exit_count: number;
  fullscreen_exit_count: number;
  score_percentage: number | null;
  total_correct: number | null;
  total_answered: number | null;
  notify_result_email?: boolean;
  /** Definido pelo backend na finalização; false quando a prova não entra no ranking nacional. */
  is_within_window?: boolean;
}

export interface AnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  marked_for_review: boolean;
  high_confidence: boolean;
  eliminated_options: string[];
  answered_at: string | null;
}

export interface FinalizedAttemptResult {
  score_percentage: number;
  total_correct: number;
  total_answered: number;
  total_questions: number;
  /**
   * Set by the finalize RPC based on whether the attempt finished within the
   * official execution window. When false, the attempt does NOT enter ranking
   * (treino mode). Reading this from the same RPC payload (vs. issuing a
   * follow-up SELECT against `attempts`) eliminates a read-after-write race
   * with replicas and saves a round-trip.
   */
  is_within_window: boolean;
}

export interface UserPerformanceSummaryRow {
  user_id: string;
  total_attempts: number;
  avg_score: number;
  best_score: number;
  last_score: number;
  last_simulado_id: string | null;
  last_finished_at: string | null;
}

export interface UserPerformanceHistoryRow {
  attempt_id: string;
  simulado_id: string;
  score_percentage: number;
  total_correct: number;
  total_answered: number;
  total_questions: number;
  finished_at: string;
}

export interface UserAreaScoreRow {
  simulado_id: string;
  area: string;
  total: number;
  correct: number;
  score_percentage: number;
}

export interface UserAttemptBehaviorRow {
  attempt_id: string;
  simulado_id: string;
  total_questions: number;
  total_answered: number;
  total_correct: number;
  total_marked_for_review: number;
  total_high_confidence: number;
  high_confidence_correct: number;
  high_confidence_wrong: number;
  tab_exit_count: number;
  fullscreen_exit_count: number;
  duration_seconds: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface AttemptQuestionResultRow {
  question_id: string;
  selected_option_id: string | null;
  correct_option_id: string | null;
  is_correct: boolean;
  was_answered: boolean;
}

// ─── Converters ───

// Question images are stored as URLs in the DB. Even though the CSP already
// restricts img-src to https:, validating at the API boundary gives us:
//  (a) defense-in-depth — bad URL never reaches the renderer;
//  (b) a single auditable list of allowed hosts;
//  (c) we transparently drop tracking-pixel hosts that an attacker (or an
//      admin with hacked machine) might try to slip into the questions table.
const ALLOWED_IMAGE_HOST_PATTERNS: ReadonlyArray<RegExp> = [
  /^([a-z0-9-]+\.)*supabase\.co$/i,        // storage public URLs
  /^([a-z0-9-]+\.)*supabase\.in$/i,
  /^([a-z0-9-]+\.)*sanar\.com\.br$/i,
  /^([a-z0-9-]+\.)*sanaflix\.com$/i,
  /^([a-z0-9-]+\.)*lovable\.app$/i,
  /^([a-z0-9-]+\.)*lovableproject\.com$/i,
];

function isAllowedImageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOST_PATTERNS.some((rx) => rx.test(url.hostname));
  } catch {
    return false;
  }
}

/** Returns the URL only if it passes the allowlist; otherwise null. */
function safeImageUrl(value: string | null | undefined): string | null {
  return isAllowedImageUrl(value) ? (value as string) : null;
}

function rowToSimuladoConfig(row: SimuladoRow): SimuladoConfig {
    return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    sequenceNumber: row.sequence_number,
    description: row.description,
    questionsCount: row.questions_count,
    estimatedDuration: `${Math.round(row.duration_minutes / 60)}h`,
    estimatedDurationMinutes: row.duration_minutes,
    executionWindowStart: row.execution_window_start,
    executionWindowEnd: row.execution_window_end,
    resultsReleaseAt: row.results_release_at,
    themeTags: row.theme_tags || [],
    dbStatus: row.status as SimuladoConfig['dbStatus'],
  };
}

function rowsToQuestion(qRow: QuestionRow, optionRows: QuestionOptionRow[], includeCorrectAnswers = false): Question {
  const qOptions = optionRows
    .filter(o => o.question_id === qRow.id)
    .sort((a, b) => a.label.localeCompare(b.label));

  const correctOption = includeCorrectAnswers ? qOptions.find(o => o.is_correct) : undefined;

  return {
    id: qRow.id,
    number: qRow.question_number,
    text: qRow.text,
    area: qRow.area,
    theme: qRow.theme,
    difficulty: qRow.difficulty ?? null,
    imageUrl: safeImageUrl(qRow.image_url),
    explanationImageUrl: safeImageUrl(qRow.explanation_image_url),
    options: qOptions.map(o => ({ id: o.id, label: o.label, text: o.text })),
    correctOptionId: correctOption?.id ?? '',
    explanation: qRow.explanation || undefined,
  };
}

// ─── RPC helper ───
// Custom RPCs not present in the auto-generated Supabase types require a cast.
// Centralise it here so individual call-sites stay clean.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, params?: Record<string, unknown>) =>
  (supabase.rpc as any)(name, params) as ReturnType<typeof supabase.rpc>;

// ─── API ───

export const simuladosApi = {
  async listSimulados(): Promise<SimuladoConfig[]> {
    logger.log('[SimuladosApi] Fetching simulados');
    const { data, error } = await supabase
      .from('simulados')
      .select('*')
      .in('status', ['published', 'test'])
      .order('sequence_number', { ascending: false });

    if (error) {
      logger.error('[SimuladosApi] Error fetching simulados:', error);
      throw error;
    }

    return (data || []).map(rowToSimuladoConfig);
  },

  /** Aceita UUID (`id`) ou `slug` na URL (ex.: `/simulados/simulado-2-.../start`). */
  async getSimulado(idOrSlug: string): Promise<SimuladoConfig | null> {
    const ref = idOrSlug.trim();
    if (!ref) return null;

    const base = supabase.from('simulados').select('*');
    const { data, error } = isUuidString(ref)
      ? await base.eq('id', ref).maybeSingle()
      : await base.eq('slug', ref).maybeSingle();

    if (error) {
      logger.error('[SimuladosApi] Error fetching simulado:', error);
      throw error;
    }

    return data ? rowToSimuladoConfig(data as SimuladoRow) : null;
  },

  async getQuestions(simuladoId: string, includeCorrectAnswers = false): Promise<Question[]> {
    // PostgREST embed: one round-trip instead of two (questions then options).
    // Note: is_correct is only requested when includeCorrectAnswers is true —
    // RLS on question_options still gates access; this just avoids sending
    // the flag over the wire when not needed.
    const optionsSelect = includeCorrectAnswers
      ? 'id, question_id, label, text, is_correct'
      : 'id, question_id, label, text';

    const { data, error } = await supabase
      .from('questions')
      .select(`*, question_options(${optionsSelect})`)
      .eq('simulado_id', simuladoId)
      .order('question_number', { ascending: true })
      .limit(300);

    if (error) {
      logger.error('[SimuladosApi] Error fetching questions:', error);
      throw error;
    }

    const rows = (data || []) as Array<QuestionRow & { question_options: QuestionOptionRow[] }>;
    if (rows.length === 0) return [];

    return rows.map((row) => {
      const { question_options, ...qRow } = row;
      return rowsToQuestion(qRow, question_options ?? [], includeCorrectAnswers);
    });
  },

  async getAttempt(simuladoId: string, userId: string, attemptType: 'online' | 'offline' = 'online'): Promise<AttemptRow | null> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId)
      .eq('attempt_type', attemptType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('[SimuladosApi] Error fetching attempt:', error);
      throw error;
    }

    return data as AttemptRow | null;
  },

  async getUserAttempts(
    userId: string,
    attemptType: 'online' | 'offline' = 'online',
    limit = 200,
  ): Promise<AttemptRow[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('attempt_type', attemptType)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AttemptRow[];
  },

  async createAttempt(
    simuladoId: string,
    _userId: string,
    _effectiveDeadline: string,
  ): Promise<AttemptRow> {
    logger.log('[SimuladosApi] Creating guarded attempt for simulado');
    const { data, error } = await rpc('create_attempt_guarded', {
      p_simulado_id: simuladoId,
    });

    if (error) throw error;
    return data as unknown as AttemptRow;
  },

  async updateAttempt(
    attemptId: string,
    updates: {
      status?: 'in_progress' | 'submitted' | 'expired';
      current_question_index?: number;
      finished_at?: string;
      tab_exit_count?: number;
      fullscreen_exit_count?: number;
      score_percentage?: number;
      total_correct?: number;
      total_answered?: number;
    },
  ): Promise<void> {
    const isProgressOnlyUpdate =
      updates.current_question_index !== undefined ||
      updates.tab_exit_count !== undefined ||
      updates.fullscreen_exit_count !== undefined;

    if (isProgressOnlyUpdate) {
      const { error } = await rpc('update_attempt_progress_guarded', {
        p_attempt_id: attemptId,
        p_current_question_index: updates.current_question_index ?? 0,
        p_tab_exit_count: updates.tab_exit_count ?? 0,
        p_fullscreen_exit_count: updates.fullscreen_exit_count ?? 0,
      });

      if (error) {
        logger.error('[SimuladosApi] Guarded progress update failed:', error);
        throw error;
      }
      return;
    }

    // Anything that touches score/status/finished_at MUST go through the
    // finalize RPC. Direct client-side updates to `attempts` are rejected by
    // the `prevent_direct_attempts_update` trigger and violate the data
    // contract in CLAUDE.md.
    throw new Error(
      '[SimuladosApi] updateAttempt: non-progress updates are not allowed. ' +
      'Use finalize_attempt_with_results via simuladosApi.submitAttempt for score/status changes.',
    );
  },

  async upsertAnswer(
    attemptId: string,
    questionId: string,
    answer: {
      selectedOptionId: string | null;
      markedForReview: boolean;
      highConfidence: boolean;
      eliminatedOptions: string[];
    },
  ): Promise<void> {
    const { error } = await supabase
      .from('answers')
      .upsert(
        {
          attempt_id: attemptId,
          question_id: questionId,
          selected_option_id: answer.selectedOptionId,
          marked_for_review: answer.markedForReview,
          high_confidence: answer.highConfidence,
          eliminated_options: answer.eliminatedOptions,
          answered_at: answer.selectedOptionId ? new Date().toISOString() : null,
        },
        { onConflict: 'attempt_id,question_id' },
      );

    if (error) {
      logger.error('[SimuladosApi] Error upserting answer:', error);
      throw error;
    }
  },

  async bulkUpsertAnswers(
    attemptId: string,
    answers: Record<string, ExamAnswer>,
  ): Promise<void> {
    const rows = Object.entries(answers).map(([questionId, ans]) => ({
      attempt_id: attemptId,
      question_id: questionId,
      selected_option_id: ans.selectedOption,
      marked_for_review: ans.markedForReview,
      high_confidence: ans.highConfidence,
      eliminated_options: ans.eliminatedAlternatives || [],
      answered_at: ans.selectedOption ? new Date().toISOString() : null,
    }));

    if (rows.length === 0) return;

    const { error } = await supabase
      .from('answers')
      .upsert(rows, { onConflict: 'attempt_id,question_id' });

    if (error) {
      logger.error('[SimuladosApi] Error bulk upserting answers:', error);
      throw error;
    }
  },

  async getAnswers(attemptId: string): Promise<AnswerRow[]> {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('attempt_id', attemptId);

    if (error) throw error;
    return (data || []) as AnswerRow[];
  },

  async submitAttempt(attemptId: string): Promise<FinalizedAttemptResult> {
    logger.log('[SimuladosApi] Submitting attempt with guarded server-side processing');
    const { data, error } = await supabase.rpc('finalize_attempt_with_results', {
      p_attempt_id: attemptId,
    });

    if (error) {
      logger.error('[SimuladosApi] Error finalizing attempt:', error);
      throw error;
    }

    const rows = data as unknown as FinalizedAttemptResult[];
    const row = rows?.[0] ?? null;
    if (!row) {
      throw new Error('Finalizacao do simulado nao retornou resultado.');
    }
    return row;
  },

  async setAttemptResultNotification(attemptId: string, enabled: boolean): Promise<void> {
    const { error } = await rpc('set_attempt_result_notification', {
      p_attempt_id: attemptId,
      p_enabled: enabled,
    });
    if (error) {
      logger.error('[SimuladosApi] Error setting attempt result notification:', error);
      throw error;
    }
  },

  async enqueueAttemptReprocessing(attemptId: string, reason?: string): Promise<void> {
    const { error } = await rpc('enqueue_attempt_reprocessing', {
      p_attempt_id: attemptId,
      p_reason: reason ?? null,
    });
    if (error) {
      logger.error('[SimuladosApi] Error enqueuing attempt reprocessing:', error);
      throw error;
    }
  },

  async getAttemptQuestionResults(attemptId: string): Promise<AttemptQuestionResultRow[]> {
    const { data, error } = await rpc('get_attempt_question_results', {
      p_attempt_id: attemptId,
    });
    if (error) {
      logger.error('[SimuladosApi] Error fetching attempt question results:', error);
      throw error;
    }
    return (data || []) as AttemptQuestionResultRow[];
  },

  async getUserPerformanceSummary(userId: string): Promise<UserPerformanceSummaryRow | null> {
    const { data, error } = await supabase.rpc('get_user_performance_summary', {
      p_user_id: userId,
    });
    if (error) {
      logger.error('[SimuladosApi] Error fetching user performance summary:', error);
      throw error;
    }
    return (data?.[0] ?? null) as UserPerformanceSummaryRow | null;
  },

  async getUserPerformanceHistory(userId: string, limit = 20): Promise<UserPerformanceHistoryRow[]> {
    const { data, error } = await supabase.rpc('get_user_performance_history', {
      p_user_id: userId,
      p_limit: limit,
    });
    if (error) {
      logger.error('[SimuladosApi] Error fetching user performance history:', error);
      throw error;
    }
    return (data || []) as UserPerformanceHistoryRow[];
  },

  async getUserAreaScoresBySimulado(userId: string): Promise<UserAreaScoreRow[]> {
    const { data, error } = await supabase.rpc('get_user_area_scores_by_simulado', {
      p_user_id: userId,
    });
    if (error) {
      logger.error('[SimuladosApi] Error fetching user area scores:', error);
      throw error;
    }
    return (data || []) as UserAreaScoreRow[];
  },

  async getUserAttemptBehaviorStats(userId: string): Promise<UserAttemptBehaviorRow[]> {
    const { data, error } = await supabase.rpc('get_user_attempt_behavior_stats', {
      p_user_id: userId,
    });
    if (error) {
      logger.error('[SimuladosApi] Error fetching attempt behavior stats:', error);
      throw error;
    }
    return (data || []) as UserAttemptBehaviorRow[];
  },

  // ─── Error Notebook ───

  async addToErrorNotebook(entry: {
    userId: string;
    simuladoId: string | null;
    questionId: string | null;
    area: string | null;
    theme: string | null;
    reason:
      | 'did_not_know'
      | 'did_not_remember'
      | 'reading_error'
      | 'confused_alternatives'
      | 'did_not_understand'
      | 'guessed_correctly';
    learningText: string | null;
    wasCorrect: boolean;
    questionNumber?: number;
    questionText?: string;
    simuladoTitle?: string;
  }): Promise<void> {
    const row: TablesInsert<'error_notebook'> = {
      user_id: entry.userId,
      simulado_id: entry.simuladoId,
      question_id: entry.questionId,
      area: entry.area,
      theme: entry.theme,
      reason: entry.reason as TablesInsert<'error_notebook'>['reason'],
      learning_text: entry.learningText,
      was_correct: entry.wasCorrect,
      question_number: entry.questionNumber ?? null,
      question_text: entry.questionText ?? null,
      simulado_title: entry.simuladoTitle ?? null,
    };

    const { error } = await supabase
      .from('error_notebook')
      .insert([row]);

    if (error) throw error;
  },

  async getErrorNotebook(userId: string) {
    const { data, error } = await supabase
      .from('error_notebook')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async deleteErrorNotebookEntry(entryId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('error_notebook')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async toggleResolvedEntry(entryId: string, userId: string, resolved: boolean): Promise<void> {
    const { error } = await supabase
      .from('error_notebook')
      .update({ resolved_at: resolved ? new Date().toISOString() : null } as any)
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Carrega uma entrada do caderno com todo o contexto necessário pro modo de
   * revisão guiada: enunciado da questão, alternativas, gabarito, alternativa
   * marcada pelo aluno (do último attempt no simulado correspondente) e o
   * markdown da análise IA cacheada (se existir).
   */
  async getErrorNotebookEntryForReview(entryId: string, userId: string) {
    const { data: entry, error: entryErr } = await supabase
      .from('error_notebook')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('*, ai_review_md, ai_review_generated_at' as any)
      .eq('id', entryId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (entryErr) throw entryErr;
    if (!entry) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entryAny = entry as any;
    const questionId = entryAny.question_id as string | null;
    const simuladoId = entryAny.simulado_id as string | null;

    let question: Question | null = null;
    if (questionId && simuladoId) {
      // Reaproveita o caminho proven da CorrecaoPage: busca todas as questões
      // do simulado e filtra a desejada. Mais bytes que um targeted SELECT,
      // mas evita peculiaridades de RLS/embed pra fetch single-row.
      try {
        const all = await simuladosApi.getQuestions(simuladoId, true);
        question = all.find((q) => q.id === questionId) ?? null;
      } catch (qErr) {
        logger.error('[SimuladosApi] Error fetching review question:', qErr);
      }
    }

    // Procura a resposta do aluno no último attempt dele nesse simulado.
    let userSelectedOptionId: string | null = null;
    if (questionId && simuladoId) {
      const { data: attemptRows } = await supabase
        .from('attempts')
        .select('id, finished_at')
        .eq('user_id', userId)
        .eq('simulado_id', simuladoId)
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(1);

      const attemptId = attemptRows?.[0]?.id;
      if (attemptId) {
        const { data: aqr } = await supabase
          .from('attempt_question_results')
          .select('selected_option_id')
          .eq('attempt_id', attemptId)
          .eq('question_id', questionId)
          .maybeSingle();
        userSelectedOptionId = aqr?.selected_option_id ?? null;
      }
    }

    return {
      entry: entryAny,
      question,
      userSelectedOptionId,
      aiReviewMd: (entryAny.ai_review_md as string | null) ?? null,
      aiReviewGeneratedAt: (entryAny.ai_review_generated_at as string | null) ?? null,
    };
  },

  async saveErrorNotebookAiReview(entryId: string, userId: string, markdown: string): Promise<void> {
    const { error } = await supabase
      .from('error_notebook')
      .update({
        ai_review_md: markdown,
        ai_review_generated_at: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) throw error;
  },
};

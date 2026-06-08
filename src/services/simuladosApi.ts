/**
 * Simulados API service — real Supabase queries.
 */

import { supabase } from '@/integrations/supabase/client';
import { isUuidString } from '@/lib/simulado-id';
import { logger } from '@/lib/logger';
import type { SimuladoConfig, Question } from '@/types';
import type { ExamAnswer } from '@/types/exam';
import type { TablesInsert } from '@/integrations/supabase/types';
import type {
  Confidence,
  ReviewOutcome,
  SrsState,
  BulkAddEntry,
  BulkAddResult,
  RecordReviewAttemptParams,
  Insight,
  Deck,
  Flashcard,
  CreateFlashcardPayload,
  UpdateFlashcardPayload,
  FlashcardReviewOutcome,
  UserNote,
  CreateNotePayload,
  UpdateNotePayload,
  QuestionFavorite,
  AddFavoritePayload,
  ConfidenceCalibration,
} from '@/types/caderno';
import type { BatchGenerateInput, GeneratedCard } from '@/lib/bulkFlashcards';
import type { CadernoExportEntry } from '@/lib/cadernoExport';

// ─── Notification preferences (Caderno reminders — plano 08 §3.1) ───
export interface NotificationPreferences {
  caderno_daily_review: boolean;
  caderno_streak: boolean;
  caderno_reta_final: boolean;
  caderno_post_triage: boolean;
}

// Default = tudo opt-in, espelhando os defaults da tabela
// `notification_preferences`. Usado como fallback gracioso quando a
// tabela/RPC ainda não está deployada.
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  caderno_daily_review: true,
  caderno_streak: true,
  caderno_reta_final: true,
  caderno_post_triage: true,
};

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

// ─── Flashcard column mapping ───
// A tabela `flashcards` usa colunas `front_image_path` / `back_image_path`
// (text), enquanto o domínio/UI usa `front_image_url` / `back_image_url`.
// Como o upload guarda uma signed URL, a string é a mesma — só o nome difere.
// Estes helpers traduzem nos dois sentidos (leitura ↔ escrita).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFlashcardRow(row: any): Flashcard {
  if (!row) return row;
  const { front_image_path, back_image_path, ...rest } = row;
  return {
    ...rest,
    front_image_url: front_image_path ?? null,
    back_image_url: back_image_path ?? null,
  } as Flashcard;
}

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
      /** Optional confidence level captured via the in-exam confidence selector (spec 04). */
      confidence?: Confidence | null;
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
          confidence: answer.confidence ?? null,
          answered_at: answer.selectedOptionId ? new Date().toISOString() : null,
        } as any,
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
      // confidence is an optional field added in spec 04 (caderno v2).
      // Falls back to null when not captured (optional seletor in exam UI).
      confidence: (ans as any).confidence ?? null,
      answered_at: ans.selectedOption ? new Date().toISOString() : null,
    }));

    if (rows.length === 0) return;

    const { error } = await supabase
      .from('answers')
      .upsert(rows as any, { onConflict: 'attempt_id,question_id' });

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

  /**
   * Carrega o caderno de erros já enriquecido para exportação em PDF:
   * cada entrada ganha o enunciado completo, as alternativas, o gabarito e a
   * explicação oficial da questão (buscados de `questions`/`question_options`).
   *
   * Faz UM fetch de questões por simulado distinto (cacheado em memória),
   * evitando N round-trips. Entradas sem questão vinculada caem no
   * `question_text` salvo na própria entrada.
   */
  async getErrorNotebookForExport(userId: string): Promise<CadernoExportEntry[]> {
    const rows = await simuladosApi.getErrorNotebook(userId);
    if (rows.length === 0) return [];

    // Busca as questões de cada simulado distinto uma única vez.
    const simuladoIds = Array.from(
      new Set(
        rows
          .map((r: any) => r.simulado_id as string | null)
          .filter((id): id is string => !!id),
      ),
    );

    const questionsBySimulado = new Map<string, Question[]>();
    await Promise.all(
      simuladoIds.map(async (sid) => {
        try {
          const qs = await simuladosApi.getQuestions(sid, true);
          questionsBySimulado.set(sid, qs);
        } catch (err) {
          logger.error('[SimuladosApi] Export: erro ao buscar questões do simulado', sid, err);
        }
      }),
    );

    return rows.map((row: any): CadernoExportEntry => {
      const sid = row.simulado_id as string | null;
      const qid = row.question_id as string | null;
      const question =
        sid && qid
          ? questionsBySimulado.get(sid)?.find((q) => q.id === qid) ?? null
          : null;

      const options = (question?.options ?? []).map((o) => ({
        label: o.label,
        text: o.text,
        isCorrect: o.id === question?.correctOptionId,
      }));
      const correctLabel = options.find((o) => o.isCorrect)?.label ?? null;

      return {
        id: row.id,
        area: row.area ?? null,
        theme: row.theme ?? null,
        question_number: row.question_number ?? question?.number ?? null,
        question_text: question?.text ?? row.question_text ?? null,
        reason: row.reason,
        learning_text: row.learning_text ?? null,
        simulado_title: row.simulado_title ?? null,
        ai_review_md: row.ai_review_md ?? null,
        created_at: row.created_at,
        options,
        correct_label: correctLabel,
        explanation: question?.explanation ?? null,
      };
    });
  },

  /**
   * Snooze persistido: marca a entrada pra reaparecer só daqui a N dias.
   * Implementado via RPC SECURITY DEFINER (snooze_error_notebook_entry) que
   * valida o ownership e clampa days em [1, 30]. Retorna o timestamp.
   */
  async snoozeErrorNotebookEntry(entryId: string, days: number): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('snooze_error_notebook_entry', {
      p_entry_id: entryId,
      p_days: days,
    });
    if (error) throw error;
    return data as string;
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
      aiPractice: (entryAny.ai_practice as AiPractice | null) ?? null,
      aiOptionRationales: (entryAny.ai_option_rationales as Record<string, string> | null) ?? null,
      chatCount: ((entryAny.chat_count as number | null) ?? 0) as number,
    };
  },

  async saveErrorNotebookAiReview(
    entryId: string,
    userId: string,
    payload: {
      markdown: string;
      practice?: AiPractice | null;
      optionRationales?: Record<string, string> | null;
    },
  ): Promise<void> {
    const { error } = await supabase
      .from('error_notebook')
      .update({
        ai_review_md: payload.markdown,
        ai_review_generated_at: new Date().toISOString(),
        ai_practice: payload.practice ?? null,
        ai_option_rationales: payload.optionRationales ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // ─── Caderno de Erros v2 — SRS + bulk add ───

  /**
   * Schedules the next SRS review for an error notebook entry after the student
   * self-grades their re-resolution attempt.
   *
   * Calls `schedule_next_review_guarded(p_entry_id, p_outcome, p_confidence)`.
   * The RPC runs the full SM-2-lite algorithm server-side and returns the updated
   * SRS state. Never compute SRS on the client.
   */
  async scheduleNextReview(
    entryId: string,
    outcome: ReviewOutcome,
    confidence: Confidence,
  ): Promise<SrsState> {
    logger.log('[SimuladosApi] Scheduling next review for entry', entryId);
    const { data, error } = await rpc('schedule_next_review_guarded', {
      p_entry_id: entryId,
      p_outcome: outcome,
      p_confidence: confidence,
    });

    if (error) {
      logger.error('[SimuladosApi] Error scheduling next review:', error);
      throw error;
    }

    // RPC returns a jsonb row; cast to the canonical shape.
    const row = data as any;
    return {
      srsDueAt: row.srs_due_at as string,
      srsInterval: row.srs_interval as number,
      srsReps: row.srs_reps as number,
      srsEase: row.srs_ease as number,
      mastered: !!(row.mastered ?? row.mastered_at),
      isLeech: !!(row.is_leech),
    };
  },

  /**
   * Records a review attempt in `review_attempts` for a given error notebook entry.
   *
   * Calls `record_review_attempt_guarded(p_entry_id, p_selected_option_id,
   * p_was_correct, p_confidence, p_self_grade)`.
   * Returns the UUID of the newly created review attempt row.
   *
   * Note: prefer calling `scheduleNextReview` after this to update SRS state,
   * or use the combined flow in the review UI that calls both in sequence.
   */
  async recordReviewAttempt(params: RecordReviewAttemptParams): Promise<string> {
    logger.log('[SimuladosApi] Recording review attempt for entry', params.entryId);
    const { data, error } = await rpc('record_review_attempt_guarded', {
      p_entry_id: params.entryId,
      p_selected_option_id: params.selectedOptionId ?? null,
      p_was_correct: params.wasCorrect,
      p_confidence: params.confidence,
      p_self_grade: params.selfGrade,
    });

    if (error) {
      logger.error('[SimuladosApi] Error recording review attempt:', error);
      throw error;
    }

    return data as string;
  },

  /**
   * Adds multiple questions to the error notebook in a single RPC call.
   *
   * Calls `add_to_notebook_bulk_guarded(p_entries jsonb)`.
   * Idempotent by (user_id, question_id): existing non-deleted entries are
   * counted as `skipped`; soft-deleted entries are resurrected (counted as `added`).
   * Limit: 100 entries per call (enforced server-side).
   */
  async addToNotebookBulk(entries: BulkAddEntry[]): Promise<BulkAddResult> {
    logger.log('[SimuladosApi] Bulk adding', entries.length, 'entries to notebook');
    const { data, error } = await rpc('add_to_notebook_bulk_guarded', {
      p_entries: entries,
    });

    if (error) {
      logger.error('[SimuladosApi] Error bulk adding to notebook:', error);
      throw error;
    }

    const result = (data as any) ?? { added: 0, skipped: 0, entry_ids: [] };
    return {
      added: (result.added as number) ?? 0,
      skipped: (result.skipped as number) ?? 0,
      entryIds: (result.entry_ids as string[]) ?? [],
    };
  },

  /**
   * Resets a leech entry so it re-enters the SRS cycle with the most conservative
   * parameters (interval=1, ease=1.3, reps=0). The accumulated `srs_lapses` count
   * is preserved as historical data.
   *
   * Calls `reset_leech_guarded(p_entry_id)`.
   */
  async resetLeech(entryId: string): Promise<void> {
    logger.log('[SimuladosApi] Resetting leech for entry', entryId);
    const { error } = await rpc('reset_leech_guarded', {
      p_entry_id: entryId,
    });

    if (error) {
      logger.error('[SimuladosApi] Error resetting leech:', error);
      throw error;
    }
  },

  // ─── Caderno de Erros v2 — Phase 2: Insights ───

  /**
   * Fetches pattern insights from the `caderno-pattern-insights` edge function.
   * The edge function aggregates data via `get_caderno_pattern_data`, calls Gemini,
   * and caches the result in `caderno_pattern_insights_cache` for 24 h.
   *
   * Callers should check `caderno_pattern_insights_cache` directly before calling
   * this to honour the TTL (see spec 06 §A.3 for the caching strategy).
   *
   * Returns the array of insights plus metadata (`generated_at`, `has_sufficient_data`).
   */
  async getPatternInsights(): Promise<{
    insights: Insight[];
    generated_at: string;
    has_sufficient_data: boolean;
  }> {
    logger.log('[SimuladosApi] Fetching pattern insights from edge function');
    const { data, error } = await supabase.functions.invoke('caderno-pattern-insights');

    if (error) {
      logger.error('[SimuladosApi] Error fetching pattern insights:', error);
      throw error;
    }

    const result = (data as any) ?? {};
    return {
      insights: (result.insights as Insight[]) ?? [],
      generated_at: (result.generated_at as string) ?? new Date().toISOString(),
      has_sufficient_data: !!(result.has_sufficient_data),
    };
  },

  /**
   * Returns historical score per area for the ROI panel.
   *
   * Calls `get_area_score_history(p_user_id uuid) → jsonb`.
   */
  async getAreaScoreHistory(userId: string): Promise<unknown> {
    logger.log('[SimuladosApi] Fetching area score history for user', userId);
    const { data, error } = await rpc('get_area_score_history', {
      p_user_id: userId,
    });

    if (error) {
      logger.error('[SimuladosApi] Error fetching area score history:', error);
      throw error;
    }

    return data;
  },

  /**
   * Returns confidence calibration data for the current user.
   *
   * Calls `get_confidence_calibration(p_user_id uuid) → jsonb`.
   * The RPC is cast via `as any` because it is not yet present in the
   * auto-generated Supabase types.
   */
  async getConfidenceCalibration(): Promise<ConfidenceCalibration> {
    logger.log('[SimuladosApi] Fetching confidence calibration');

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      logger.error('[SimuladosApi] getConfidenceCalibration: unauthenticated', authError);
      throw authError ?? new Error('Usuário não autenticado');
    }

    const { data, error } = await rpc('get_confidence_calibration', {
      p_user_id: authData.user.id,
    });

    if (error) {
      logger.error('[SimuladosApi] Error fetching confidence calibration:', error);
      throw error;
    }

    const result = (data as any) ?? {};
    return {
      buckets: (result.buckets as ConfidenceCalibration['buckets']) ?? [],
      overall: (result.overall as ConfidenceCalibration['overall']) ?? {
        total_answered_with_confidence: 0,
        alta_but_wrong: 0,
        baixa_but_correct: 0,
      },
    };
  },

  // ─── Caderno de Erros v2 — Phase 2: Flashcards ───

  /**
   * Lists all non-deleted decks belonging to the current user.
   * Direct SELECT on `decks` — RLS restricts to owner.
   */
  async listDecks(): Promise<Deck[]> {
    logger.log('[SimuladosApi] Listing flashcard decks');
    const { data, error } = await (supabase.from('decks') as any)
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[SimuladosApi] Error listing decks:', error);
      throw error;
    }

    return (data || []) as Deck[];
  },

  /**
   * Creates a new flashcard deck with the given name.
   * Direct INSERT on `decks` — RLS restricts to owner.
   */
  async createDeck(name: string): Promise<Deck> {
    logger.log('[SimuladosApi] Creating deck:', name);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('[SimuladosApi] createDeck: user not authenticated');
    const { data, error } = await (supabase.from('decks') as any)
      .insert([{ name, user_id: userId }])
      .select()
      .single();

    if (error) {
      logger.error('[SimuladosApi] Error creating deck:', error);
      throw error;
    }

    return data as Deck;
  },

  /**
   * Lists all non-deleted flashcards, optionally filtered by deck.
   * Direct SELECT on `flashcards` — RLS restricts to owner.
   *
   * @param deckId - When provided, filters cards to that deck only.
   */
  async listFlashcards(deckId?: string): Promise<Flashcard[]> {
    logger.log('[SimuladosApi] Listing flashcards', deckId ? `for deck ${deckId}` : '(all)');
    let query = (supabase.from('flashcards') as any)
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (deckId) {
      query = query.eq('deck_id', deckId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[SimuladosApi] Error listing flashcards:', error);
      throw error;
    }

    return (data || []).map(mapFlashcardRow);
  },

  /**
   * Creates a new flashcard.
   * Direct INSERT on `flashcards` — RLS restricts to owner.
   */
  async createFlashcard(payload: CreateFlashcardPayload): Promise<Flashcard> {
    logger.log('[SimuladosApi] Creating flashcard in deck', payload.deck_id);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('[SimuladosApi] createFlashcard: user not authenticated');
    const { front_image_url, back_image_url, ...rest } = payload;
    const { data, error } = await (supabase.from('flashcards') as any)
      .insert([{
        ...rest,
        user_id: userId,
        front_image_path: front_image_url ?? null,
        back_image_path: back_image_url ?? null,
      }])
      .select()
      .single();

    if (error) {
      logger.error('[SimuladosApi] Error creating flashcard:', error);
      throw error;
    }

    return mapFlashcardRow(data);
  },

  /**
   * Updates mutable fields of an existing flashcard.
   * Direct UPDATE on `flashcards` — RLS restricts to owner.
   */
  async updateFlashcard(id: string, payload: UpdateFlashcardPayload): Promise<Flashcard> {
    logger.log('[SimuladosApi] Updating flashcard', id);
    const { front_image_url, back_image_url, ...rest } = payload;
    const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
    if ('front_image_url' in payload) patch.front_image_path = front_image_url ?? null;
    if ('back_image_url' in payload) patch.back_image_path = back_image_url ?? null;
    const { data, error } = await (supabase.from('flashcards') as any)
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('[SimuladosApi] Error updating flashcard:', error);
      throw error;
    }

    return mapFlashcardRow(data);
  },

  /**
   * Soft-deletes a flashcard by setting `deleted_at`.
   * Direct UPDATE on `flashcards` — RLS restricts to owner.
   */
  async softDeleteFlashcard(id: string): Promise<void> {
    logger.log('[SimuladosApi] Soft-deleting flashcard', id);
    const { error } = await (supabase.from('flashcards') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.error('[SimuladosApi] Error soft-deleting flashcard:', error);
      throw error;
    }
  },

  /**
   * Returns all non-deleted flashcards whose `srs_due_at` is on or before
   * the end of the current day in America/Sao_Paulo ("due today").
   * Sorting: oldest due date first (highest priority).
   */
  async getDueFlashcards(): Promise<Flashcard[]> {
    // End of today in America/Sao_Paulo (UTC-3).
    // Supabase stores timestamps as UTC, so we need the UTC equivalent of
    // 23:59:59.999 BRT. BRT = UTC-3, so BRT midnight+1day = UTC 03:00 next day.
    // Trick: setUTCHours(26, 59, 59, 999) overflows into the next UTC day by
    // exactly 3 hours, giving 03:00:00 UTC of tomorrow — i.e. end of today BRT.
    const endOfDayUtc = new Date();
    endOfDayUtc.setUTCHours(26, 59, 59, 999);

    logger.log('[SimuladosApi] Fetching due flashcards');
    const { data, error } = await (supabase.from('flashcards') as any)
      .select('*')
      .is('deleted_at', null)
      .is('mastered_at', null)
      .lte('srs_due_at', endOfDayUtc.toISOString())
      .order('srs_due_at', { ascending: true });

    if (error) {
      logger.error('[SimuladosApi] Error fetching due flashcards:', error);
      throw error;
    }

    return (data || []).map(mapFlashcardRow);
  },

  /**
   * Schedules the next SRS review for a flashcard.
   *
   * Calls `schedule_flashcard_review_guarded(p_flashcard_id, p_outcome)`.
   * Returns the updated SRS state for the flashcard.
   */
  async scheduleFlashcardReview(
    flashcardId: string,
    outcome: FlashcardReviewOutcome,
  ): Promise<SrsState> {
    logger.log('[SimuladosApi] Scheduling flashcard review', flashcardId, outcome);
    const { data, error } = await rpc('schedule_flashcard_review_guarded', {
      p_flashcard_id: flashcardId,
      p_outcome: outcome,
    });

    if (error) {
      logger.error('[SimuladosApi] Error scheduling flashcard review:', error);
      throw error;
    }

    const row = (data as any) ?? {};
    return {
      srsDueAt: row.srs_due_at as string,
      srsInterval: row.srs_interval as number,
      srsReps: row.srs_reps as number,
      srsEase: row.srs_ease as number,
      mastered: !!(row.mastered),
      isLeech: !!(row.is_leech),
    };
  },

  /**
   * Calls the `generate-flashcard` edge function to generate front/back markdown
   * for a flashcard from an error notebook entry or question context.
   *
   * @param context - Free-form payload forwarded to the edge function. At minimum
   *   include `entry_id` or `question_id` so the function can load the question.
   * @returns Partial flashcard fields (`front_md`, `back_md`) generated by the AI.
   */
  async generateFlashcard(
    context: Record<string, unknown>,
  ): Promise<{ front_md: string; back_md: string }> {
    logger.log('[SimuladosApi] Generating flashcard via edge function');
    const { data, error } = await supabase.functions.invoke('generate-flashcard', {
      body: context,
    });

    if (error) {
      logger.error('[SimuladosApi] Error generating flashcard:', error);
      throw error;
    }

    const result = (data as any) ?? {};
    return {
      front_md: (result.front_md as string) ?? '',
      back_md: (result.back_md as string) ?? '',
    };
  },

  /**
   * Gera vários flashcards de uma vez via edge function `generate-flashcards-batch`.
   * Repassa o payload normalizado (BatchGenerateInput) e devolve os cards gerados.
   */
  async generateFlashcardsBatch(
    input: BatchGenerateInput,
  ): Promise<{ cards: GeneratedCard[]; partial: boolean }> {
    logger.log('[SimuladosApi] Generating flashcards batch, mode:', input.mode);
    const { data, error } = await supabase.functions.invoke('generate-flashcards-batch', {
      body: input,
    });

    if (error) {
      logger.error('[SimuladosApi] Error generating flashcards batch:', error);
      throw error;
    }

    const result = (data as any) ?? {};
    // `partial=true` quando a IA truncou o lote e só parte dos cards foi recuperada.
    return { cards: (result.cards as GeneratedCard[]) ?? [], partial: !!result.partial };
  },

  /**
   * Cria vários flashcards de uma vez com um único insert multi-linha.
   * Segue o padrão de `createFlashcard` (RLS restringe ao dono; user_id da sessão).
   */
  async createFlashcardsBulk(
    payloads: CreateFlashcardPayload[],
  ): Promise<Flashcard[]> {
    if (payloads.length === 0) return [];
    logger.log('[SimuladosApi] Bulk-creating', payloads.length, 'flashcards');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('[SimuladosApi] createFlashcardsBulk: user not authenticated');

    const rows = payloads.map(({ front_image_url, back_image_url, ...rest }) => ({
      ...rest,
      user_id: userId,
      front_image_path: front_image_url ?? null,
      back_image_path: back_image_url ?? null,
    }));

    const { data, error } = await (supabase.from('flashcards') as any)
      .insert(rows)
      .select();

    if (error) {
      logger.error('[SimuladosApi] Error bulk-creating flashcards:', error);
      throw error;
    }

    return (data || []).map(mapFlashcardRow);
  },

  /**
   * Uploads an image file to the `flashcard-images` storage bucket and returns
   * the public (or signed) URL for use in a flashcard's `front_image_url` /
   * `back_image_url` fields.
   *
   * Path convention: `<user_id>/<uuid>` (enforced by bucket RLS policy).
   *
   * @param file - The image File/Blob to upload.
   * @param side - Which face of the card this image belongs to ('front' | 'back').
   *   Included in the filename so duplicate uploads for the same card don't collide.
   * @returns The public URL for the uploaded image.
   */
  async uploadFlashcardImage(
    file: File,
    side: 'front' | 'back',
  ): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('[SimuladosApi] uploadFlashcardImage: user not authenticated');

    const ext = file.name.split('.').pop() ?? 'jpg';
    const uuid = crypto.randomUUID();
    const path = `${userId}/${side}-${uuid}.${ext}`;

    logger.log('[SimuladosApi] Uploading flashcard image to path', path);
    const { error: uploadError } = await supabase.storage
      .from('flashcard-images')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      logger.error('[SimuladosApi] Error uploading flashcard image:', uploadError);
      throw uploadError;
    }

    // Bucket is PRIVATE — getPublicUrl returns a non-functional URL.
    // Use a long-lived signed URL (1 year) instead.
    const { data: signedData, error: signedError } = await supabase.storage
      .from('flashcard-images')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (signedError || !signedData?.signedUrl) {
      logger.error('[SimuladosApi] Error creating signed URL for flashcard image:', signedError);
      throw signedError ?? new Error('[SimuladosApi] uploadFlashcardImage: failed to create signed URL');
    }

    return signedData.signedUrl;
  },

  // ─── Caderno de Erros v2 — Phase 2: Notes ───

  /**
   * Lists all non-deleted notes belonging to the current user.
   * Direct SELECT on `user_notes` — RLS restricts to owner.
   */
  async listNotes(): Promise<UserNote[]> {
    logger.log('[SimuladosApi] Listing user notes');
    const { data, error } = await (supabase.from('user_notes') as any)
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('[SimuladosApi] Error listing notes:', error);
      throw error;
    }

    return (data || []) as UserNote[];
  },

  /**
   * Creates a new note.
   * Direct INSERT on `user_notes` — RLS restricts to owner.
   */
  async createNote(payload: CreateNotePayload): Promise<UserNote> {
    logger.log('[SimuladosApi] Creating note:', payload.title);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('[SimuladosApi] createNote: user not authenticated');
    const { data, error } = await (supabase.from('user_notes') as any)
      .insert([{ ...payload, user_id: userId }])
      .select()
      .single();

    if (error) {
      logger.error('[SimuladosApi] Error creating note:', error);
      throw error;
    }

    return data as UserNote;
  },

  /**
   * Updates mutable fields of an existing note.
   * Direct UPDATE on `user_notes` — RLS restricts to owner.
   */
  async updateNote(id: string, payload: UpdateNotePayload): Promise<UserNote> {
    logger.log('[SimuladosApi] Updating note', id);
    const { data, error } = await (supabase.from('user_notes') as any)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('[SimuladosApi] Error updating note:', error);
      throw error;
    }

    return data as UserNote;
  },

  /**
   * Soft-deletes a note by setting `deleted_at`.
   * Direct UPDATE on `user_notes` — RLS restricts to owner.
   */
  async softDeleteNote(id: string): Promise<void> {
    logger.log('[SimuladosApi] Soft-deleting note', id);
    const { error } = await (supabase.from('user_notes') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.error('[SimuladosApi] Error soft-deleting note:', error);
      throw error;
    }
  },

  // ─── Caderno de Erros v2 — Phase 2: Favorites ───

  /**
   * Lists all favorited questions for the current user.
   * Direct SELECT on `question_favorites` — RLS restricts to owner.
   */
  async listFavorites(): Promise<QuestionFavorite[]> {
    logger.log('[SimuladosApi] Listing favorites');
    const { data, error } = await (supabase.from('question_favorites') as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[SimuladosApi] Error listing favorites:', error);
      throw error;
    }

    return (data || []) as QuestionFavorite[];
  },

  /**
   * Adds a question to the current user's favorites.
   * Uses upsert on (user_id, question_id) unique constraint — idempotent.
   * Direct INSERT on `question_favorites` — RLS restricts to owner.
   */
  async addFavorite(payload: AddFavoritePayload): Promise<QuestionFavorite> {
    logger.log('[SimuladosApi] Adding favorite for question', payload.question_id);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('[SimuladosApi] addFavorite: user not authenticated');
    const { data, error } = await (supabase.from('question_favorites') as any)
      .upsert([{ ...payload, user_id: userId }], { onConflict: 'user_id,question_id', ignoreDuplicates: false })
      .select()
      .single();

    if (error) {
      logger.error('[SimuladosApi] Error adding favorite:', error);
      throw error;
    }

    return data as QuestionFavorite;
  },

  /**
   * Removes a favorited question. Accepts either the favorite row `id` (UUID)
   * or the `question_id` (UUID) — the method detects which was passed by
   * checking which column to filter on.
   *
   * If `idOrQuestionId` matches the `question_id` column (i.e. the caller
   * doesn't know the favorite row id), a filter by `question_id` is used.
   * When the favorite row id is known, prefer passing it directly.
   *
   * Direct DELETE on `question_favorites` — RLS restricts to owner.
   *
   * @param idOrQuestionId - The favorite row `id` OR the `question_id` to unfavorite.
   * @param byQuestionId   - When true, treats the first argument as a `question_id`.
   *                         Defaults to false (treat as row `id`).
   */
  async removeFavorite(idOrQuestionId: string, byQuestionId = false): Promise<void> {
    logger.log('[SimuladosApi] Removing favorite', idOrQuestionId);
    const column = byQuestionId ? 'question_id' : 'id';
    const { error } = await (supabase.from('question_favorites') as any)
      .delete()
      .eq(column, idOrQuestionId);

    if (error) {
      logger.error('[SimuladosApi] Error removing favorite:', error);
      throw error;
    }
  },

  // ─── Caderno de Erros v2 — Phase 2: Lacuna (awaiting_lesson) ───

  /**
   * Clears the `awaiting_lesson` state from an error notebook entry.
   * Used when the student manually confirms "Já estudei isso" or via deep-link
   * to the lesson in Phase 2.
   *
   * Calls `clear_awaiting_lesson_guarded(p_entry_id uuid) → void`.
   */
  async clearAwaitingLesson(entryId: string): Promise<void> {
    logger.log('[SimuladosApi] Clearing awaiting_lesson for entry', entryId);
    const { error } = await rpc('clear_awaiting_lesson_guarded', {
      p_entry_id: entryId,
    });

    if (error) {
      logger.error('[SimuladosApi] Error clearing awaiting_lesson:', error);
      throw error;
    }
  },

  // ─── Notification preferences (Caderno reminders — plano 08 §3.1) ───

  /**
   * Lê as preferências de notificação do usuário atual.
   *
   * Consulta a tabela `notification_preferences` (RLS owner-only).
   * Degrada graciosamente: se a tabela ainda não estiver deployada, se não
   * houver linha, ou em qualquer erro, retorna os defaults (tudo opt-in),
   * para a UI nunca quebrar enquanto o slice de lembretes não está no ar.
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    logger.log('[SimuladosApi] Fetching notification preferences');
    try {
      const { data, error } = await supabase
        .from('notification_preferences' as any)
        .select(
          'caderno_daily_review, caderno_streak, caderno_reta_final, caderno_post_triage',
        )
        .maybeSingle();

      if (error) {
        logger.error('[SimuladosApi] Error fetching notification preferences (defaulting):', error);
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
      }

      const row = (data as Partial<NotificationPreferences> | null) ?? {};
      return {
        caderno_daily_review: row.caderno_daily_review ?? DEFAULT_NOTIFICATION_PREFERENCES.caderno_daily_review,
        caderno_streak: row.caderno_streak ?? DEFAULT_NOTIFICATION_PREFERENCES.caderno_streak,
        caderno_reta_final: row.caderno_reta_final ?? DEFAULT_NOTIFICATION_PREFERENCES.caderno_reta_final,
        caderno_post_triage: row.caderno_post_triage ?? DEFAULT_NOTIFICATION_PREFERENCES.caderno_post_triage,
      };
    } catch (err) {
      logger.error('[SimuladosApi] getNotificationPreferences failed (defaulting):', err);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
  },

  /**
   * Atualiza (parcialmente) as preferências de notificação do usuário atual.
   *
   * Chama o RPC guardado `upsert_notification_preferences(...)` — o frontend
   * nunca escreve direto na tabela (regra do projeto). Campos ausentes não são
   * alterados (o RPC trata NULL como "preservar"). Retorna o estado final
   * (mesclado com os defaults) para a UI sincronizar.
   *
   * Degrada graciosamente: se o RPC ainda não estiver deployado, loga e
   * retorna o estado otimista (defaults + prefs enviadas), sem lançar.
   */
  async updateNotificationPreferences(
    prefs: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    logger.log('[SimuladosApi] Updating notification preferences', prefs);
    const optimistic: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...prefs,
    };

    try {
      const { data, error } = await rpc('upsert_notification_preferences', {
        p_caderno_daily_review: prefs.caderno_daily_review ?? null,
        p_caderno_streak: prefs.caderno_streak ?? null,
        p_caderno_reta_final: prefs.caderno_reta_final ?? null,
        p_caderno_post_triage: prefs.caderno_post_triage ?? null,
      });

      if (error) {
        logger.error('[SimuladosApi] Error updating notification preferences (optimistic):', error);
        return optimistic;
      }

      const result = (data as Partial<NotificationPreferences>) ?? {};
      return {
        caderno_daily_review: result.caderno_daily_review ?? optimistic.caderno_daily_review,
        caderno_streak: result.caderno_streak ?? optimistic.caderno_streak,
        caderno_reta_final: result.caderno_reta_final ?? optimistic.caderno_reta_final,
        caderno_post_triage: result.caderno_post_triage ?? optimistic.caderno_post_triage,
      };
    } catch (err) {
      logger.error('[SimuladosApi] updateNotificationPreferences failed (optimistic):', err);
      return optimistic;
    }
  },
};

export interface AiPractice {
  topic: string | null;
  area: string | null;
  theme: string | null;
  suggestedCount: number;
}

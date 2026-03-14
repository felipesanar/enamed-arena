/**
 * Simulados API service — real Supabase queries.
 * Architecture based on SanarFlix Academy's simuladosApi.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SimuladoConfig, Question, QuestionOption } from '@/types';
import type { ExamState, ExamAnswer } from '@/types/exam';

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
  explanation: string | null;
}

export interface QuestionOptionRow {
  id: string;
  question_id: string;
  label: string;
  text: string;
  is_correct: boolean;
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

// ─── Converters ───

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
  };
}

function rowsToQuestion(qRow: QuestionRow, optionRows: QuestionOptionRow[]): Question {
  return {
    id: qRow.id,
    number: qRow.question_number,
    text: qRow.text,
    area: qRow.area,
    theme: qRow.theme,
    options: optionRows
      .filter(o => o.question_id === qRow.id)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(o => ({ id: o.id, label: o.label, text: o.text })),
    correctOptionId: optionRows.find(o => o.question_id === qRow.id && o.is_correct)?.id || '',
    explanation: qRow.explanation || undefined,
  };
}

// ─── API ───

export const simuladosApi = {
  /** Fetch all published simulados */
  async listSimulados(): Promise<SimuladoConfig[]> {
    console.log('[SimuladosApi] Fetching simulados');
    const { data, error } = await supabase
      .from('simulados')
      .select('*')
      .eq('status', 'published')
      .order('sequence_number', { ascending: true });

    if (error) {
      console.error('[SimuladosApi] Error fetching simulados:', error);
      throw error;
    }

    return (data || []).map(rowToSimuladoConfig);
  },

  /** Fetch a single simulado by ID */
  async getSimulado(id: string): Promise<SimuladoConfig | null> {
    const { data, error } = await supabase
      .from('simulados')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SimuladosApi] Error fetching simulado:', error);
      throw error;
    }

    return data ? rowToSimuladoConfig(data) : null;
  },

  /** Fetch questions with options for a simulado */
  async getQuestions(simuladoId: string): Promise<Question[]> {
    console.log('[SimuladosApi] Fetching questions for:', simuladoId);

    const [questionsResult, optionsResult] = await Promise.all([
      supabase
        .from('questions')
        .select('*')
        .eq('simulado_id', simuladoId)
        .order('question_number', { ascending: true }),
      supabase
        .from('question_options')
        .select('*')
        .in('question_id',
          // We need the question IDs first — use a subquery approach
          // Actually, fetch all options for this simulado's questions
          (await supabase
            .from('questions')
            .select('id')
            .eq('simulado_id', simuladoId)
          ).data?.map(q => q.id) || []
        ),
    ]);

    if (questionsResult.error) throw questionsResult.error;
    if (optionsResult.error) throw optionsResult.error;

    const questions = questionsResult.data || [];
    const options = optionsResult.data || [];

    return questions.map(q => rowsToQuestion(q as QuestionRow, options as QuestionOptionRow[]));
  },

  /** Get user's attempt for a simulado */
  async getAttempt(simuladoId: string, userId: string): Promise<AttemptRow | null> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('simulado_id', simuladoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[SimuladosApi] Error fetching attempt:', error);
      throw error;
    }

    return data as AttemptRow | null;
  },

  /** Get all user attempts (for dashboard/performance) */
  async getUserAttempts(userId: string): Promise<AttemptRow[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (error) throw error;
    return (data || []) as AttemptRow[];
  },

  /** Create a new attempt */
  async createAttempt(
    simuladoId: string,
    userId: string,
    effectiveDeadline: string,
  ): Promise<AttemptRow> {
    console.log('[SimuladosApi] Creating attempt for simulado:', simuladoId);
    const { data, error } = await supabase
      .from('attempts')
      .insert({
        simulado_id: simuladoId,
        user_id: userId,
        status: 'in_progress',
        effective_deadline: effectiveDeadline,
      })
      .select()
      .single();

    if (error) throw error;
    return data as AttemptRow;
  },

  /** Update attempt (autosave, submit, etc.) */
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
    const { error } = await supabase
      .from('attempts')
      .update({ ...updates, last_saved_at: new Date().toISOString() })
      .eq('id', attemptId);

    if (error) {
      console.error('[SimuladosApi] Error updating attempt:', error);
      throw error;
    }
  },

  /** Upsert an answer (autosave per question) */
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
      console.error('[SimuladosApi] Error upserting answer:', error);
      throw error;
    }
  },

  /** Bulk upsert answers (for batch autosave) */
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
      console.error('[SimuladosApi] Error bulk upserting answers:', error);
      throw error;
    }
  },

  /** Get all answers for an attempt */
  async getAnswers(attemptId: string): Promise<AnswerRow[]> {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('attempt_id', attemptId);

    if (error) throw error;
    return (data || []) as AnswerRow[];
  },

  /** Submit attempt (finalize) */
  async submitAttempt(
    attemptId: string,
    scorePercentage: number,
    totalCorrect: number,
    totalAnswered: number,
  ): Promise<void> {
    console.log('[SimuladosApi] Submitting attempt:', attemptId);
    await this.updateAttempt(attemptId, {
      status: 'submitted',
      finished_at: new Date().toISOString(),
      score_percentage: scorePercentage,
      total_correct: totalCorrect,
      total_answered: totalAnswered,
    });
  },

  // ─── Error Notebook ───

  async addToErrorNotebook(entry: {
    userId: string;
    simuladoId: string | null;
    questionId: string | null;
    area: string | null;
    theme: string | null;
    reason: string;
    learningText: string | null;
    wasCorrect: boolean;
  }): Promise<void> {
    const { error } = await supabase
      .from('error_notebook')
      .insert({
        user_id: entry.userId,
        simulado_id: entry.simuladoId,
        question_id: entry.questionId,
        area: entry.area,
        theme: entry.theme,
        reason: entry.reason,
        learning_text: entry.learningText,
        was_correct: entry.wasCorrect,
      });

    if (error) throw error;
  },

  async getErrorNotebook(userId: string): Promise<any[]> {
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
};

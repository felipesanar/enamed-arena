import { supabase } from '@/integrations/supabase/client';
import type {
  DashboardKpis,
  TimeseriesRow,
  FunnelStep,
  SimuladoEngagementRow,
  LiveSignals,
  UserListRow,
  UserDetail,
  UserAttemptRow,
  SimuladoDetailStats,
  SimuladoQuestionStat,
  AttemptListKpis,
  AttemptListRow,
} from '@/admin/types'

export const adminApi = {
  // ─── Dashboard KPIs ───
  async getDashboardStats() {
    const [simulados, profiles, attempts] = await Promise.all([
      supabase.from('simulados').select('id, status, execution_window_start, execution_window_end, sequence_number, title', { count: 'exact' }),
      supabase.from('profiles').select('id', { count: 'exact' }),
      supabase.from('attempts').select('id', { count: 'exact' }),
    ]);

    const now = new Date().toISOString();
    const allSimulados = simulados.data ?? [];
    const active = allSimulados.filter(s => s.execution_window_start <= now && s.execution_window_end >= now);
    const upcoming = allSimulados
      .filter(s => s.execution_window_start > now)
      .sort((a, b) => a.execution_window_start.localeCompare(b.execution_window_start));

    return {
      totalSimulados: simulados.count ?? 0,
      totalUsers: profiles.count ?? 0,
      totalAttempts: attempts.count ?? 0,
      activeSimulados: active.length,
      nextSimulado: upcoming[0] ?? null,
    };
  },

  // ─── Simulados CRUD ───
  async listSimulados() {
    const { data, error } = await supabase
      .from('simulados')
      .select('*')
      .order('sequence_number', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getSimulado(id: string) {
    const { data, error } = await supabase.from('simulados').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async createSimulado(values: {
    title: string;
    slug: string;
    sequence_number: number;
    description: string;
    duration_minutes: number;
    questions_count: number;
    execution_window_start: string;
    execution_window_end: string;
    results_release_at: string;
    theme_tags: string[];
    status: 'draft' | 'published' | 'test';
  }) {
    const { data, error } = await supabase.from('simulados').insert(values).select().single();
    if (error) throw error;
    return data;
  },

  async updateSimulado(id: string, values: Record<string, unknown>) {
    const { data, error } = await supabase.from('simulados').update(values).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSimulado(id: string) {
    const { error } = await supabase.from('simulados').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Questions ───
  async getQuestionsCount(simuladoId: string) {
    const { count, error } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('simulado_id', simuladoId);
    if (error) throw error;
    return count ?? 0;
  },

  async deleteQuestionsForSimulado(simuladoId: string) {
    // Delete options first, then questions
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('simulado_id', simuladoId);

    if (questions && questions.length > 0) {
      const qIds = questions.map(q => q.id);
      await supabase.from('question_options').delete().in('question_id', qIds);
      await supabase.from('questions').delete().eq('simulado_id', simuladoId);
    }
  },

  // ─── Analytics Dashboard ───
  async getDashboardKpis(days: number): Promise<DashboardKpis> {
    const { data, error } = await supabase.rpc('admin_dashboard_kpis', { p_days: days })
    if (error) throw error
    const row = (data as any[])?.[0]
    if (!row) throw new Error('admin_dashboard_kpis returned no rows')
    return {
      total_users: Number(row.total_users),
      new_users: Number(row.new_users),
      new_users_prev: Number(row.new_users_prev),
      exams_started: Number(row.exams_started),
      exams_started_prev: Number(row.exams_started_prev),
      completion_rate: Number(row.completion_rate),
      completion_rate_prev: Number(row.completion_rate_prev),
      avg_score: Number(row.avg_score),
      avg_score_prev: Number(row.avg_score_prev),
      activation_rate: Number(row.activation_rate),
      activation_rate_prev: Number(row.activation_rate_prev),
    }
  },

  async getEventsTimeseries(days: number): Promise<TimeseriesRow[]> {
    const { data, error } = await supabase.rpc('admin_events_timeseries', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      day: r.day as string,
      new_users: Number(r.new_users),
      exams_started: Number(r.exams_started),
      exams_completed: Number(r.exams_completed),
    }))
  },

  async getFunnelStats(days: number): Promise<FunnelStep[]> {
    const { data, error } = await supabase.rpc('admin_funnel_stats', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      step_order: Number(r.step_order),
      step_label: r.step_label as string,
      user_count: Number(r.user_count),
      conversion_from_prev: Number(r.conversion_from_prev),
    }))
  },

  async getSimuladoEngagement(limit = 10): Promise<SimuladoEngagementRow[]> {
    const { data, error } = await supabase.rpc('admin_simulado_engagement', { p_limit: limit })
    if (error) throw error
    return (data as any[]).map(r => ({
      simulado_id: r.simulado_id as string,
      sequence_number: Number(r.sequence_number),
      title: r.title as string,
      participants: Number(r.participants),
      completion_rate: Number(r.completion_rate),
      avg_score: Number(r.avg_score),
      abandonment_rate: Number(r.abandonment_rate),
    }))
  },

  async getLiveSignals(): Promise<LiveSignals> {
    const { data, error } = await supabase.rpc('admin_live_signals')
    if (error) throw error
    const row = (data as any[])?.[0]
    if (!row) throw new Error('admin_live_signals returned no rows')
    return {
      online_last_15min: Number(row.online_last_15min),
      active_exams: Number(row.active_exams),
      open_tickets: Number(row.open_tickets),
    }
  },

  // ─── Usuários ───
  async listUsers(
    search = '',
    segment = 'all',
    limit = 25,
    offset = 0
  ): Promise<UserListRow[]> {
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_search: search,
      p_segment: segment,
      p_limit: limit,
      p_offset: offset,
    })
    if (error) throw error
    return (data as any[]).map(r => ({
      user_id: r.user_id as string,
      full_name: r.full_name as string | null,
      email: r.email as string,
      avatar_url: r.avatar_url as string | null,
      segment: r.segment as 'guest' | 'standard' | 'pro',
      specialty: r.specialty as string | null,
      created_at: r.created_at as string,
      avg_score: Number(r.avg_score),
      total_attempts: Number(r.total_attempts),
      total_count: Number(r.total_count),
    }))
  },

  async getUser(userId: string): Promise<UserDetail> {
    const { data, error } = await supabase.rpc('admin_get_user', { p_user_id: userId })
    if (error) throw error
    const r = (data as any[])[0]
    return {
      user_id: r.user_id as string,
      full_name: r.full_name as string | null,
      email: r.email as string,
      avatar_url: r.avatar_url as string | null,
      segment: r.segment as 'guest' | 'standard' | 'pro',
      created_at: r.created_at as string,
      last_sign_in_at: r.last_sign_in_at as string | null,
      specialty: r.specialty as string | null,
      target_institutions: r.target_institutions as string[] | null,
      avg_score: Number(r.avg_score),
      best_score: Number(r.best_score),
      last_score: Number(r.last_score),
      total_attempts: Number(r.total_attempts),
      last_finished_at: r.last_finished_at as string | null,
      is_admin: Boolean(r.is_admin),
    }
  },

  async getUserAttempts(userId: string, limit = 10): Promise<UserAttemptRow[]> {
    const { data, error } = await supabase.rpc('admin_get_user_attempts', {
      p_user_id: userId,
      p_limit: limit,
    })
    if (error) throw error
    return (data as any[]).map(r => ({
      attempt_id: r.attempt_id as string,
      simulado_id: r.simulado_id as string,
      sequence_number: Number(r.sequence_number),
      simulado_title: r.simulado_title as string,
      created_at: r.created_at as string,
      status: r.status as string,
      score_percentage: r.score_percentage != null ? Number(r.score_percentage) : null,
      ranking_position: Number(r.ranking_position),
    }))
  },

  async setUserSegment(userId: string, segment: 'guest' | 'standard' | 'pro'): Promise<void> {
    const { error } = await supabase.rpc('admin_set_user_segment', {
      p_user_id: userId,
      p_segment: segment,
    })
    if (error) throw error
  },

  async setUserRole(userId: string, role: string, grant: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_user_role', {
      p_user_id: userId,
      p_role: role,
      p_grant: grant,
    })
    if (error) throw error
  },

  async resetUserOnboarding(userId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_reset_user_onboarding', { p_user_id: userId })
    if (error) throw error
  },

  async deleteUser(userId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not authenticated')

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      }
    )
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  },

  // ─── Simulados Analytics ───
  async getSimuladoDetailStats(simuladoId: string): Promise<SimuladoDetailStats> {
    const { data, error } = await supabase.rpc('admin_simulado_detail_stats', {
      p_simulado_id: simuladoId,
    })
    if (error) throw error
    const r = (data as any[])[0]
    return {
      simulado_id: r.simulado_id as string,
      sequence_number: Number(r.sequence_number),
      title: r.title as string,
      participants: Number(r.participants),
      completion_rate: Number(r.completion_rate),
      avg_score: Number(r.avg_score),
      abandonment_rate: Number(r.abandonment_rate),
      avg_time_minutes: Number(r.avg_time_minutes),
    }
  },

  async getSimuladoQuestionStats(simuladoId: string): Promise<SimuladoQuestionStat[]> {
    const { data, error } = await supabase.rpc('admin_simulado_question_stats', {
      p_simulado_id: simuladoId,
    })
    if (error) throw error
    return (data as any[]).map(r => ({
      question_number: Number(r.question_number),
      text: r.text as string,
      correct_rate: Number(r.correct_rate),
      discrimination_index: Number(r.discrimination_index),
      most_common_wrong_label: r.most_common_wrong_label as string | null,
      most_common_wrong_pct: r.most_common_wrong_pct != null ? Number(r.most_common_wrong_pct) : null,
    }))
  },

  // ─── Tentativas ───
  async getAttemptKpis(days: number): Promise<AttemptListKpis> {
    const { data, error } = await supabase.rpc('admin_attempts_kpis', { p_days: days })
    if (error) throw error
    const r = (data as any[])[0]
    return {
      total:       Number(r.total),
      in_progress: Number(r.in_progress),
      submitted:   Number(r.submitted),
      expired:     Number(r.expired),
    }
  },

  async listAttempts(
    search = '',
    simuladoId: string | null = null,
    status = 'all',
    days = 30,
    limit = 25,
    offset = 0,
  ): Promise<AttemptListRow[]> {
    const { data, error } = await supabase.rpc('admin_list_attempts', {
      p_search:      search,
      p_simulado_id: simuladoId ?? null,
      p_status:      status,
      p_days:        days,
      p_limit:       limit,
      p_offset:      offset,
    })
    if (error) throw error
    return (data as any[]).map(r => ({
      attempt_id:       r.attempt_id as string,
      user_id:          r.user_id as string,
      full_name:        r.full_name as string | null,
      email:            r.email as string,
      avatar_url:       r.avatar_url as string | null,
      simulado_id:      r.simulado_id as string,
      sequence_number:  Number(r.sequence_number),
      simulado_title:   r.simulado_title as string,
      created_at:       r.created_at as string,
      status:           r.status as string,
      score_percentage: r.score_percentage != null ? Number(r.score_percentage) : null,
      ranking_position: r.ranking_position != null ? Number(r.ranking_position) : null,
      total_count:      Number(r.total_count),
    }))
  },

  async cancelAttempt(attemptId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_cancel_attempt', { p_attempt_id: attemptId })
    if (error) throw error
  },

  async deleteAttempt(attemptId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_attempt', { p_attempt_id: attemptId })
    if (error) throw error
  },
};

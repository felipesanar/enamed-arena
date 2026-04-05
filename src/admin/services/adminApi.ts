import { supabase } from '@/integrations/supabase/client';
import type {
  DashboardKpis,
  TimeseriesRow,
  FunnelStep,
  SimuladoEngagementRow,
  LiveSignals,
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
};

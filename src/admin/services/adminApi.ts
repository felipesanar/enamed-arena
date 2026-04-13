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
  JourneyTimeseriesRow,
  JourneySourceRow,
  JourneyTimeToConvert,
  MarketingKpis,
  MarketingSourceRow,
  MarketingMediumRow,
  MarketingCampaignRow,
  SegmentedFunnelRow,
  FrictionPoint,
  FeatureAdoptionRow,
  TopEventRow,
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
      area: r.area as string,
      theme: r.theme as string,
      total_responses: Number(r.total_responses),
    }))
  },

  // ─── Tentativas ───
  async getAttemptKpis(days: number): Promise<AttemptListKpis> {
    const { data, error } = await supabase.rpc('admin_attempts_kpis', { p_days: days })
    if (error) throw error
    const r = (data as any[])?.[0]
    if (!r) return { total: 0, in_progress: 0, submitted: 0, expired: 0 }
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

  // ─── Analytics ───
  async getAnalyticsFunnel(days: number): Promise<FunnelStep[]> {
    const { data, error } = await supabase.rpc('admin_analytics_funnel', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      step_order:           Number(r.step_order),
      step_label:           r.step_label as string,
      user_count:           Number(r.user_count),
      conversion_from_prev: Number(r.conversion_from_prev),
    }))
  },

  async getAnalyticsTimeseries(days: number): Promise<JourneyTimeseriesRow[]> {
    const { data, error } = await supabase.rpc('admin_analytics_timeseries', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      week_start:  r.week_start as string,
      new_users:   Number(r.new_users),
      first_exams: Number(r.first_exams),
    }))
  },

  async getAnalyticsSources(days: number): Promise<JourneySourceRow[]> {
    const { data, error } = await supabase.rpc('admin_analytics_sources', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      utm_source:      r.utm_source as string,
      user_count:      Number(r.user_count),
      signup_conv_pct: Number(r.signup_conv_pct),
    }))
  },

  async getAnalyticsTimeToConvert(days: number): Promise<JourneyTimeToConvert> {
    const { data, error } = await supabase.rpc('admin_analytics_time_to_convert', { p_days: days })
    if (error) throw error
    const r = (data as any[])?.[0]
    if (!r) return { landing_to_signup_min: 0, signup_to_onboarding_min: 0, onboarding_to_first_exam_days: 0, first_to_second_exam_days: 0 }
    return {
      landing_to_signup_min:         Number(r.landing_to_signup_min),
      signup_to_onboarding_min:      Number(r.signup_to_onboarding_min),
      onboarding_to_first_exam_days: Number(r.onboarding_to_first_exam_days),
      first_to_second_exam_days:     Number(r.first_to_second_exam_days),
    }
  },

  // ─── Marketing ───
  async getMarketingKpis(days: number): Promise<MarketingKpis> {
    const { data, error } = await supabase.rpc('admin_marketing_kpis', { p_days: days })
    if (error) throw error
    const r = (data as any[])?.[0]
    if (!r) return { new_users: 0, new_users_prev: 0, landing_to_signup_pct: 0, active_campaigns: 0, organic_pct: 0 }
    return {
      new_users:             Number(r.new_users),
      new_users_prev:        Number(r.new_users_prev),
      landing_to_signup_pct: Number(r.landing_to_signup_pct),
      active_campaigns:      Number(r.active_campaigns),
      organic_pct:           Number(r.organic_pct),
    }
  },

  async getMarketingSources(days: number): Promise<MarketingSourceRow[]> {
    const { data, error } = await supabase.rpc('admin_marketing_sources', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      source:     r.source as string,
      user_count: Number(r.user_count),
      conv_rate:  Number(r.conv_rate),
    }))
  },

  async getMarketingMediums(days: number): Promise<MarketingMediumRow[]> {
    const { data, error } = await supabase.rpc('admin_marketing_mediums', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      medium:     r.medium as string,
      user_count: Number(r.user_count),
      conv_rate:  Number(r.conv_rate),
    }))
  },

  async getMarketingCampaigns(days: number): Promise<MarketingCampaignRow[]> {
    const { data, error } = await supabase.rpc('admin_marketing_campaigns', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      campaign:    r.campaign as string,
      source:      r.source as string,
      visits:      Number(r.visits),
      signups:     Number(r.signups),
      conv_rate:   Number(r.conv_rate),
      first_exams: Number(r.first_exams),
    }))
  },

  // ─── Produto ───
  async getProdutoSegmentedFunnel(days: number): Promise<SegmentedFunnelRow[]> {
    const { data, error } = await supabase.rpc('admin_produto_segmented_funnel', { p_days: days })
    if (error) throw error
    return (data as any[]).map(r => ({
      step_order:     Number(r.step_order),
      step_label:     r.step_label as string,
      guest_count:    Number(r.guest_count),
      guest_pct:      Number(r.guest_pct),
      standard_count: Number(r.standard_count),
      standard_pct:   Number(r.standard_pct),
      pro_count:      Number(r.pro_count),
      pro_pct:        Number(r.pro_pct),
    }))
  },

  async getProdutoFriction(days: number, segment = 'all'): Promise<FrictionPoint[]> {
    const { data, error } = await supabase.rpc('admin_produto_friction', { p_days: days, p_segment: segment })
    if (error) throw error
    return (data as any[]).map(r => ({
      key:          r.key as string,
      title:        r.title as string,
      event_name:   r.event_name as string,
      metric_value: Number(r.metric_value),
      metric_unit:  r.metric_unit as 'percent' | 'days' | 'minutes',
      severity:     r.severity as 'critical' | 'warning' | 'healthy',
    }))
  },

  async getProdutoFeatureAdoption(days: number, segment = 'all'): Promise<FeatureAdoptionRow[]> {
    const { data, error } = await supabase.rpc('admin_produto_feature_adoption', { p_days: days, p_segment: segment })
    if (error) throw error
    return (data as any[]).map(r => ({
      feature:      r.feature as string,
      event_name:   r.event_name as string,
      adoption_pct: Number(r.adoption_pct),
    }))
  },

  async getProdutoTopEvents(days: number, limit = 6): Promise<TopEventRow[]> {
    const { data, error } = await supabase.rpc('admin_produto_top_events', { p_days: days, p_limit: limit })
    if (error) throw error
    return (data as any[]).map(r => ({
      event_name: r.event_name as string,
      cnt:        Number(r.cnt),
    }))
  },
};

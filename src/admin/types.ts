// src/admin/types.ts

export type AdminPeriod = 7 | 30 | 90

export interface DashboardKpis {
  total_users: number
  new_users: number
  new_users_prev: number
  exams_started: number
  exams_started_prev: number
  completion_rate: number
  completion_rate_prev: number
  avg_score: number
  avg_score_prev: number
  activation_rate: number
  activation_rate_prev: number
}

export interface TimeseriesRow {
  day: string        // 'YYYY-MM-DD'
  new_users: number
  exams_started: number
  exams_completed: number
}

export interface FunnelStep {
  step_order: number
  step_label: string
  user_count: number
  conversion_from_prev: number  // 0–100, percentual
}

export interface SimuladoEngagementRow {
  simulado_id: string
  sequence_number: number
  title: string
  participants: number
  completion_rate: number   // 0–100
  avg_score: number         // 0–100
  abandonment_rate: number  // 0–100
}

export interface LiveSignals {
  online_last_15min: number
  active_exams: number
  open_tickets: number
}

export interface UserListRow {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  segment: 'guest' | 'standard' | 'pro'
  specialty: string | null
  created_at: string
  avg_score: number
  total_attempts: number
  total_count: number
}

export interface UserDetail {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  segment: 'guest' | 'standard' | 'pro'
  created_at: string
  last_sign_in_at: string | null
  specialty: string | null
  target_institutions: string[] | null
  avg_score: number
  best_score: number
  last_score: number
  total_attempts: number
  last_finished_at: string | null
  is_admin: boolean
  roles: string[]
}

export interface UserAttemptRow {
  attempt_id: string
  simulado_id: string
  sequence_number: number
  simulado_title: string
  created_at: string
  status: string
  score_percentage: number | null
  /** null for training attempts (is_within_window = false) */
  ranking_position: number | null
  is_within_window: boolean
}

export interface AttemptQuestionRow {
  question_id: string
  question_number: number
  area: string | null
  theme: string | null
  difficulty: string | null
  question_text: string
  was_answered: boolean
  is_correct: boolean
  selected_label: string | null
  selected_text: string | null
  correct_label: string | null
  correct_text: string | null
  ai_suggested_reason: string | null
  confidence: string | null
}

export interface SimuladoDetailStats {
  simulado_id: string
  sequence_number: number
  title: string
  participants: number
  completion_rate: number
  avg_score: number
  abandonment_rate: number
  avg_time_minutes: number
}

export interface SimuladoQuestionStat {
  question_number: number
  text: string
  correct_rate: number
  discrimination_index: number
  most_common_wrong_label: string | null
  most_common_wrong_pct: number | null
  area: string
  theme: string
  total_responses: number
}

export interface AttemptListKpis {
  total: number
  in_progress: number
  submitted: number
  expired: number
}

export interface AttemptListRow {
  attempt_id: string
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  simulado_id: string
  sequence_number: number
  simulado_title: string
  created_at: string
  status: string
  score_percentage: number | null
  ranking_position: number | null
  total_count: number
}

export interface JourneyTimeseriesRow {
  week_start: string
  new_users: number
  first_exams: number
}

export interface JourneySourceRow {
  utm_source: string
  user_count: number
  signup_conv_pct: number
}

export interface JourneyTimeToConvert {
  landing_to_signup_min: number
  signup_to_onboarding_min: number
  onboarding_to_first_exam_days: number
  first_to_second_exam_days: number
}

export interface MarketingKpis {
  new_users: number
  new_users_prev: number
  landing_to_signup_pct: number
  active_campaigns: number
  organic_pct: number
}

export interface MarketingSourceRow {
  source: string
  user_count: number
  conv_rate: number
}

export interface MarketingMediumRow {
  medium: string
  user_count: number
  conv_rate: number
}

export interface MarketingCampaignRow {
  campaign: string
  source: string
  visits: number
  signups: number
  conv_rate: number
  first_exams: number
}

export interface SegmentedFunnelRow {
  step_order: number
  step_label: string
  guest_count: number
  guest_pct: number
  standard_count: number
  standard_pct: number
  pro_count: number
  pro_pct: number
}

export interface FrictionPoint {
  key: string
  title: string
  event_name: string
  metric_value: number
  metric_unit: 'percent' | 'days' | 'minutes'
  severity: 'critical' | 'warning' | 'healthy'
}

export interface FeatureAdoptionRow {
  feature: string
  event_name: string
  adoption_pct: number
}

export interface TopEventRow {
  event_name: string
  cnt: number
}

export interface CadernoFunnelRow {
  metric_order: number
  metric_key: string
  metric_label: string
  event_name: string
  total_events: number
  unique_users: number
}

export interface QuickSearchResult {
  kind: 'user' | 'simulado'
  id: string
  title: string
  subtitle: string | null
}

// ─── Inteligência ───

export interface CohortRetentionRow {
  cohort_month: string
  cohort_size: number
  did_onboarding: number
  did_1_plus: number
  did_2_plus: number
  did_3_plus: number
  avg_score: number
}

export interface AreaPerformanceRow {
  area: string
  total_responses: number
  correct_responses: number
  correct_rate: number
  n_users: number
  n_questions: number
}

export interface ThemePerformanceRow {
  theme: string
  area: string
  correct_rate: number
  total_responses: number
}

export interface ScoreBucket {
  bucket_label: string
  bucket_min: number
  count: number
}

export interface ScoreEvolutionRow {
  simulado_id: string
  sequence_number: number
  title: string
  participants: number
  avg_score: number
  median_score: number
  cutoff_proxy: number
}

export interface EngagementMetrics {
  started: number
  completed: number
  abandonment_rate: number
  abandonment_rate_prev: number
  avg_minutes: number
  avg_minutes_prev: number
  median_minutes: number
  avg_tab_exits: number
  avg_fullscreen_exits: number
  high_integrity_flag_pct: number
}

export type SegmentBreakdownRow = {
  segment: string
  users: number
  participants: number
  participation_rate: number
  avg_score: number
  avg_attempts: number
}

export interface IntelInsight {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  detail: string
  metric_value: number
  metric_unit: string
  route: string
}

// ─── Gestão de Questões ───

export interface AdminQuestionOption {
  id: string
  label: string
  text: string
  is_correct: boolean
}

export interface AdminQuestionFull {
  id: string
  question_number: number
  text: string
  area: string
  theme: string
  difficulty: string
  explanation: string | null
  image_url: string | null
  explanation_image_url: string | null
  image_url_2: string | null
  options: AdminQuestionOption[]
}

// ─── Auditoria ───

export type AuditLogRow = {
  id: string
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string | null
  metadata: Record<string, unknown>
  created_at: string
  total_count: number
}

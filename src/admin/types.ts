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
}

export interface UserAttemptRow {
  attempt_id: string
  simulado_id: string
  sequence_number: number
  simulado_title: string
  created_at: string
  status: string
  score_percentage: number | null
  ranking_position: number
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

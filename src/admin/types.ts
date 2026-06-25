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
  // novos (aditivos) — provas validas (exclui treino)
  abandonment_rate: number
  abandonment_rate_prev: number
  offline_pending: number
  completion_valid_denom: number
}

export interface TimeseriesRow {
  day: string        // 'YYYY-MM-DD' (bucket em America/Sao_Paulo)
  new_users: number
  exams_started: number
  exams_completed: number
  offline_pending: number
}

export interface FunnelStep {
  step_order: number
  step_label: string
  user_count: number
  conversion_from_prev: number | null  // 0–100; null = não computável (landing→signup)
  insufficient_data?: boolean
}

export interface SimuladoEngagementRow {
  simulado_id: string
  sequence_number: number
  title: string
  participants: number        // usuarios distintos validos (dentro da janela)
  completion_rate: number     // 0-100, so validas
  avg_score: number           // 0-100, so validas
  abandonment_rate: number    // 0-100, in_progress+offline_pending na janela
  started_total: number       // volume de tentativas (INCLUI treino)
  treino_count: number
  completed_count: number
  in_progress_count: number
  offline_pending_count: number
}

export interface LiveSignals {
  online_last_15min: number
  active_exams: number
  open_tickets: number
  /** Provas reais aguardando submissao offline dentro da janela */
  offline_pending_now: number
  /** Confianca da fonte de 'online': 'low' (proxy de telemetria, sem sessao auth) */
  online_confidence: string
  /** false enquanto nao houver modulo de suporte/tickets */
  tickets_supported: boolean
}

export interface UserListRow {
  user_id: string
  full_name: string | null
  email: string
  avatar_url: string | null
  segment: 'guest' | 'standard' | 'pro'
  specialty: string | null
  created_at: string
  avg_score: number          // media de provas VALIDAS (exclui treino)
  total_attempts: number     // provas validas submetidas (= valid_attempts)
  total_count: number
  started_attempts: number   // volume total de tentativas (inclui treino + todos os status)
  training_attempts: number  // submitted fora da janela (modo treino)
  valid_attempts: number     // submitted dentro da janela
  offline_pending_count: number
  in_progress_count: number
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
  avg_score: number          // media de provas VALIDAS (exclui treino)
  best_score: number         // melhor nota em prova valida
  last_score: number         // ultima prova VALIDA
  total_attempts: number     // provas validas submetidas (= valid_attempts)
  last_finished_at: string | null  // conclusao da ultima prova valida
  is_admin: boolean
  roles: string[]
  started_attempts: number
  training_attempts: number
  valid_attempts: number
  offline_pending_count: number
  in_progress_count: number
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
  participants: number          // usuarios distintos validos
  completion_rate: number
  avg_score: number
  abandonment_rate: number      // in_progress+offline_pending na janela
  avg_time_minutes: number      // capado no deadline, exclui pos-deadline
  median_time_minutes: number
  p90_time_minutes: number
  started_total: number
  treino_count: number
  completed_count: number
  in_progress_count: number
  offline_pending_count: number
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
  total_responses_all?: number
}

export interface AttemptListKpis {
  total: number
  in_progress: number
  submitted: number
  expired: number
  offline_pending: number
  submitted_valid: number
  in_progress_valid: number
  offline_pending_valid: number
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
  /** Volume de tentativas iniciadas na semana, INCLUI treino (is_within_window=false). */
  started_attempts: number
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
  // aditivos
  landing_to_signup_n: number
  landing_to_signup_insufficient: boolean
  first_to_second_exam_days_p90: number
  first_to_second_exam_n: number
}

export interface MarketingKpis {
  new_users: number
  new_users_prev: number
  landing_to_signup_pct: number   // -1 = dados insuficientes
  active_campaigns: number
  organic_pct: number
  landing_to_signup_insufficient: boolean
  organic_low_confidence: boolean
}

export interface MarketingSourceRow {
  source: string
  user_count: number
  conv_rate: number               // participacao (soma ~100%)
  signup_conv_pct: number | null  // conversao real landing->cadastro
}

export interface MarketingMediumRow {
  medium: string
  user_count: number
  conv_rate: number               // participacao
  signup_conv_pct: number | null  // conversao real
}

export interface MarketingCampaignRow {
  campaign: string
  source: string
  visits: number
  signups: number
  conv_rate: number | null        // null quando visits=0
  first_exams: number             // apenas prova valida
  started_exams: number           // inclui treino
  insufficient_data: boolean
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
  insufficient_data?: boolean
}

export interface FrictionPoint {
  key: string
  title: string
  event_name: string
  metric_value: number
  metric_unit: 'percent' | 'days' | 'minutes'
  severity: 'critical' | 'warning' | 'healthy'
  // aditivos
  numerator?: number | null
  denominator?: number | null
  insufficient_data?: boolean
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
  /** Usuários da coorte com prova entregue offline aguardando processamento (status real, dentro da janela). */
  did_offline_pending: number
  /** Volume de tentativa: qualquer attempt iniciado, INCLUINDO treino. Não é prova válida. */
  started_any: number
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
  /** Tentativas dentro da janela (prova valida); started inclui treino. */
  started_valid: number
  /** Tentativas em offline_pending (status real, aguardando sync). */
  offline_pending: number
  /** Abandono escopado a within-window (igual a abandonment_rate; exposto p/ clareza). */
  abandonment_rate_valid: number
}

export type SegmentBreakdownRow = {
  segment: string
  users: number
  participants: number
  participation_rate: number
  avg_score: number
  avg_attempts: number
  /** Participantes que concluiram prova valida (submitted dentro da janela). */
  concluded_participants: number
  /** Participantes com prova offline pendente dentro da janela. */
  pending_participants: number
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

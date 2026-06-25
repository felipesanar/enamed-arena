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
  /** Taxa de abandono de provas válidas (0–100). */
  abandonment_rate: number
  abandonment_rate_prev: number
  /** Provas reais aguardando submissão offline. */
  offline_pending: number
  /** Denominador de provas VÁLIDAS (na janela) usado na taxa de conclusão.
   *  0 = não houve prova oficial no período → conclusão deve exibir "sem provas", não "0%". */
  completion_valid_denom: number
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
  /** 0–100, percentual de quem veio da etapa anterior.
   *  null = etapa sem rastreio possível (ex.: visitas não capturadas). */
  conversion_from_prev: number | null
  /** Etapa com base pequena demais para confiar no percentual. */
  insufficient_data?: boolean
}

export interface SimuladoEngagementRow {
  simulado_id: string
  sequence_number: number
  title: string
  participants: number
  completion_rate: number   // 0–100
  avg_score: number         // 0–100
  abandonment_rate: number  // 0–100
  /** Total de provas iniciadas (válidas + treino). */
  started_total: number
  /** Provas em modo treino (fora da janela). */
  treino_count: number
  /** Provas concluídas (válidas). */
  completed_count: number
  /** Provas em andamento. */
  in_progress_count: number
  /** Provas reais aguardando submissão offline. */
  offline_pending_count: number
}

export interface LiveSignals {
  online_last_15min: number
  active_exams: number
  open_tickets: number
  /** Provas reais aguardando submissão offline (na janela). */
  offline_pending_now: number
  /** Confiança do sinal de "online" — 'low' porque não há heartbeat/presença real. */
  online_confidence: 'low' | 'high'
  /** Há módulo de tickets? Hoje não (open_tickets é sempre 0). */
  tickets_supported: boolean
  /** Usuários distintos ativos hoje (fuso SP) — contexto para o "0" do agora. */
  active_today: number
  /** Última atividade observável (evento ou salvamento de prova). */
  last_activity_at: string | null
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
  /** Provas iniciadas (qualquer status). */
  started_attempts: number
  /** Provas em modo treino (fora da janela). */
  training_attempts: number
  /** Provas válidas (na janela, contam para ranking/score). */
  valid_attempts: number
  /** Provas reais aguardando submissão offline. */
  offline_pending_count: number
  /** Provas em andamento. */
  in_progress_count: number
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
  /** Provas iniciadas (qualquer status). */
  started_attempts: number
  /** Provas em modo treino (fora da janela). */
  training_attempts: number
  /** Provas válidas (na janela). */
  valid_attempts: number
  /** Provas reais aguardando submissão offline. */
  offline_pending_count: number
  /** Provas em andamento. */
  in_progress_count: number
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
  /** Tempo mediano (min) das provas válidas. */
  median_time_minutes: number
  /** Tempo p90 (min) das provas válidas. */
  p90_time_minutes: number
  /** Total de provas iniciadas (válidas + treino). */
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
  /** Índice de discriminação em escala 0–100 (antes 0–1). Pode ser negativo. */
  discrimination_index: number
  most_common_wrong_label: string | null
  most_common_wrong_pct: number | null
  area: string
  theme: string
  /** Respostas válidas (na janela) usadas no cálculo. */
  total_responses: number
  /** Respostas de qualquer origem (válidas + treino). */
  total_responses_all: number
}

export interface AttemptListKpis {
  total: number
  in_progress: number
  submitted: number
  expired: number
  /** Provas reais aguardando submissão offline (qualquer janela). */
  offline_pending: number
  /** Provas submetidas válidas (na janela). */
  submitted_valid: number
  /** Provas em andamento válidas (na janela). */
  in_progress_valid: number
  /** Provas offline pendentes válidas (na janela). */
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
  /** Provas iniciadas na semana (válidas + treino). */
  started_attempts: number
}

export interface JourneySourceRow {
  utm_source: string
  user_count: number
  signup_conv_pct: number
}

export interface JourneyTimeToConvert {
  /** -1 = sem dado de visita confiável (usar landing_to_signup_insufficient). */
  landing_to_signup_min: number
  signup_to_onboarding_min: number
  onboarding_to_first_exam_days: number
  first_to_second_exam_days: number
  /** Amostra de visita→cadastro; 0 → exibir "Dados insuficientes". */
  landing_to_signup_n: number
  landing_to_signup_insufficient: boolean
  /** p90 de 1ª→2ª prova (dias). */
  first_to_second_exam_days_p90: number
  /** Amostra de 1ª→2ª prova. */
  first_to_second_exam_n: number
}

export interface MarketingKpis {
  new_users: number
  new_users_prev: number
  /** -1 = dados insuficientes (usar landing_to_signup_insufficient). */
  landing_to_signup_pct: number
  active_campaigns: number
  organic_pct: number
  landing_to_signup_insufficient: boolean
  /** % orgânico com baixa confiança (origem pouco capturada). */
  organic_low_confidence: boolean
}

export interface MarketingSourceRow {
  source: string
  user_count: number
  /** Participação da origem no total de cadastros (0–100). */
  conv_rate: number
  /** Conversão real visita→cadastro (0–100); null quando não computável. */
  signup_conv_pct: number | null
}

export interface MarketingMediumRow {
  medium: string
  user_count: number
  /** Participação do meio no total de cadastros (0–100). */
  conv_rate: number
  /** Conversão real visita→cadastro (0–100); null quando não computável. */
  signup_conv_pct: number | null
}

export interface MarketingCampaignRow {
  campaign: string
  source: string
  visits: number
  signups: number
  /** Conversão visita→cadastro (0–100); null quando visits=0. */
  conv_rate: number | null
  /** Provas válidas iniciadas pelos cadastros da campanha. */
  first_exams: number
  /** Provas iniciadas (qualquer janela). */
  started_exams: number
  /** Base pequena demais para confiar na conversão. */
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
  /** Base pequena demais para confiar nos percentuais da etapa. */
  insufficient_data?: boolean
}

export interface FrictionPoint {
  key: string
  title: string
  event_name: string
  /** -1 = dados insuficientes (usar insufficient_data). */
  metric_value: number
  metric_unit: 'percent' | 'days' | 'minutes'
  severity: 'critical' | 'warning' | 'healthy'
  /** Numerador do cálculo (ex.: quem abandonou). */
  numerator: number
  /** Denominador do cálculo (ex.: base elegível). */
  denominator: number
  /** Base pequena demais para confiar na métrica. */
  insufficient_data: boolean
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
  /** Nota média da coorte (provas válidas); null quando ninguém concluiu. */
  avg_score: number | null
  /** Pessoas da coorte com prova offline pendente. */
  did_offline_pending: number
  /** Pessoas da coorte que iniciaram qualquer prova. */
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
}

export type SegmentBreakdownRow = {
  segment: string
  users: number
  participants: number
  participation_rate: number
  avg_score: number
  avg_attempts: number
  /** Participantes que concluíram prova válida. */
  concluded_participants: number
  /** Participantes com prova ainda pendente (em andamento/offline). */
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

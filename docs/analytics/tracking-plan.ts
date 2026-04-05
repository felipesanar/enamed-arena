/**
 * SanarFlix PRO: ENAMED — Analytics Tracking Plan
 *
 * Fonte da verdade para nomes de eventos e tipos de payload.
 * Importar EVENTS (e não strings literais) em todo o codebase para evitar typos.
 *
 * Gerado em: 2026-04-05
 * Baseado em: docs/analytics/event-catalog.md
 */

// ─────────────────────────────────────────────────────────────
// NOMES DE EVENTOS
// ─────────────────────────────────────────────────────────────

export const EVENTS = {
  // Funil de Conversão
  LEAD_CAPTURED:               "lead_captured",
  LANDING_PAGE_VIEWED:         "landing_page_viewed",
  LANDING_SECTION_VIEWED:      "landing_section_viewed",

  // Autenticação
  AUTH_LOGIN_ATTEMPTED:        "auth_login_attempted",
  AUTH_LOGIN_SUCCEEDED:        "auth_login_succeeded",
  AUTH_LOGIN_FAILED:           "auth_login_failed",
  AUTH_SIGNUP_ATTEMPTED:       "auth_signup_attempted",
  AUTH_PASSWORD_RESET_REQUESTED: "auth_password_reset_requested",

  // Onboarding
  ONBOARDING_STARTED:          "onboarding_started",
  ONBOARDING_STEP_VIEWED:      "onboarding_step_viewed",
  ONBOARDING_COMPLETED:        "onboarding_completed",
  ONBOARDING_EDIT_BLOCKED:     "onboarding_edit_blocked",

  // Simulados — Listagem e Detalhe
  SIMULADOS_LIST_VIEWED:       "simulados_list_viewed",
  SIMULADO_DETAIL_VIEWED:      "simulado_detail_viewed",
  SIMULADO_CHECKLIST_COMPLETED: "simulado_checklist_completed",

  // Motor de Prova
  SIMULADO_STARTED:            "simulado_started",
  SIMULADO_COMPLETED:          "simulado_completed",
  EXAM_RESUMED:                "exam_resumed",
  EXAM_ANSWER_SAVED:           "exam_answer_saved",
  EXAM_QUESTION_NAVIGATED:     "exam_question_navigated",
  EXAM_INTEGRITY_EVENT:        "exam_integrity_event",
  EXAM_AUTO_SUBMITTED:         "exam_auto_submitted",
  EXAM_SUBMIT_ATTEMPTED:       "exam_submit_attempted",
  EXAM_SUBMIT_FAILED:          "exam_submit_failed",
  EXAM_OFFLINE_DETECTED:       "exam_offline_detected",

  // Resultados e Correção
  RESULTADO_VIEWED:            "resultado_viewed",
  CORRECTION_VIEWED:           "correction_viewed",
  CORRECTION_QUESTION_VIEWED:  "correction_question_viewed",
  ERROR_ADDED_TO_NOTEBOOK:     "error_added_to_notebook",

  // Ranking
  RANKING_VIEWED:              "ranking_viewed",
  RANKING_ENGAGEMENT_TIME:     "ranking_engagement_time",
  RANKING_FILTER_CHANGED:      "ranking_filter_changed",

  // Desempenho e Comparativo
  DESEMPENHO_VIEWED:           "desempenho_viewed",
  COMPARATIVO_VIEWED:          "comparativo_viewed",
  COMPARATIVO_FILTER_APPLIED:  "comparativo_filter_applied",

  // Caderno de Erros
  CADERNO_ERROS_VIEWED:        "caderno_erros_viewed",
  CADERNO_ERROS_FILTERED:      "caderno_erros_filtered",

  // Monetização
  UPSELL_CLICKED:              "upsell_clicked",
  FEATURE_GATE_SEEN:           "feature_gate_seen",

  // Fluxo Offline
  OFFLINE_ATTEMPT_CREATED:     "offline_attempt_created",
  OFFLINE_PDF_GENERATED:       "offline_pdf_generated",
  OFFLINE_ANSWERS_SUBMITTED:   "offline_answers_submitted",
  OFFLINE_ANSWERS_SUBMIT_FAILED: "offline_answers_submit_failed",

  // Erros e Integridade
  EXAM_STORAGE_FALLBACK:       "exam_storage_fallback",
  EXAM_STORAGE_RETRY:          "exam_storage_retry",
  AUTH_PROFILE_LOAD_FAILED:    "auth_profile_load_failed",
  ERROR_BOUNDARY_TRIGGERED:    "error_boundary_triggered",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ─────────────────────────────────────────────────────────────
// TIPOS DE PAYLOAD POR EVENTO
// ─────────────────────────────────────────────────────────────

type UserSegment = "guest" | "standard" | "pro";
type SimuladoStatus =
  | "upcoming"
  | "available"
  | "available_late"
  | "in_progress"
  | "closed_waiting"
  | "results_available"
  | "completed";

export interface PayloadMap {
  // Funil de Conversão
  lead_captured: {
    source:
      | "landing_hero_primary"
      | "landing_nav_login"
      | "landing_nav_primary"
      | "landing_cta_primary"
      | "landing_cta_secondary"
      | "landing_exam_demo_create_account";
  };
  landing_page_viewed: {
    referrer: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  landing_section_viewed: {
    section_id: string;
    scroll_depth: number;
  };

  // Autenticação
  auth_login_attempted: {
    method: "password" | "magic_link" | "sso";
  };
  auth_login_succeeded: {
    method: "password" | "magic_link" | "sso";
    is_new_user: boolean;
    segment: UserSegment;
  };
  auth_login_failed: {
    method: "password" | "magic_link";
    error_code: string;
  };
  auth_signup_attempted: {
    segment: UserSegment;
  };
  auth_password_reset_requested: Record<string, never>;

  // Onboarding
  onboarding_started: {
    segment: UserSegment;
    from_sso: boolean;
  };
  onboarding_step_viewed: {
    step: 1 | 2 | 3;
    step_name: string;
  };
  onboarding_completed: {
    segment: UserSegment;
    specialty: string;
    institutions_count: number;
  };
  onboarding_edit_blocked: {
    reason: string;
    next_editable_at?: string;
  };

  // Simulados — Listagem e Detalhe
  simulados_list_viewed: {
    total_simulados: number;
    available_count: number;
    in_progress_count: number;
    completed_count: number;
    has_active_offline: boolean;
  };
  simulado_detail_viewed: {
    simulado_id: string;
    simulado_sequence: number;
    simulado_status: SimuladoStatus;
    user_started: boolean;
    checklist_required: boolean;
  };
  simulado_checklist_completed: {
    simulado_id: string;
    time_to_complete_seconds: number;
  };

  // Motor de Prova
  simulado_started: {
    simulado_id: string;
    attempt_id: string;
  };
  simulado_completed: {
    simulado_id: string;
    attempt_id: string;
    answered: number;
    total: number;
    score_percentage: number;
    duration_minutes: number;
    tab_exit_count: number;
    fullscreen_exit_count: number;
    is_within_window: boolean;
  };
  exam_resumed: {
    simulado_id: string;
    attempt_id: string;
    time_elapsed_since_start_minutes: number;
    answered_before_resume: number;
    time_remaining_seconds: number;
  };
  exam_answer_saved: {
    simulado_id: string;
    attempt_id: string;
    question_index: number;
    time_on_question_ms: number;
    is_change: boolean;
    has_eliminations: boolean;
    high_confidence: boolean;
    marked_for_review: boolean;
  };
  exam_question_navigated: {
    simulado_id: string;
    from_index: number;
    to_index: number;
    method: "next" | "prev" | "grid" | "keyboard";
  };
  exam_integrity_event: {
    simulado_id: string;
    attempt_id: string;
    event_type: "tab_exit" | "fullscreen_exit";
    count_so_far: number;
    time_remaining_seconds: number;
  };
  exam_auto_submitted: {
    simulado_id: string;
    attempt_id: string;
    answered: number;
    total: number;
    reason: "timer_expired" | "past_deadline_on_init";
  };
  exam_submit_attempted: {
    simulado_id: string;
    attempt_id: string;
    answered: number;
    total: number;
    unanswered: number;
    time_remaining_seconds: number;
  };
  exam_submit_failed: {
    simulado_id: string;
    attempt_id: string;
    error_message: string;
    retry_count: number;
  };
  exam_offline_detected: {
    simulado_id: string;
    attempt_id: string;
    time_remaining_seconds: number;
    answered_at_disconnect: number;
  };

  // Resultados e Correção
  resultado_viewed: {
    simulado_id: string;
    score_percentage: number;
    total_correct: number;
    total_questions: number;
    worst_area: string;
    best_area: string;
    segment: UserSegment;
  };
  correction_viewed: {
    simulado_id: string;
    simulado_title: string;
    segment: UserSegment;
  };
  correction_question_viewed: {
    simulado_id: string;
    question_index: number;
    was_correct: boolean;
    had_reviewed: boolean;
  };
  error_added_to_notebook: {
    simulado_id: string;
    question_id: string;
    area: string;
  };

  // Ranking
  ranking_viewed: {
    selected_simulado_id?: string;
    comparison_filter?: string;
    segment_filter?: string;
    source?: "page" | "mobile_header_bell";
  };
  ranking_engagement_time: {
    seconds: number;
  };
  ranking_filter_changed: {
    simulado_id: string;
    filter_type: "comparison" | "segment";
    old_value: string;
    new_value: string;
  };

  // Desempenho e Comparativo
  desempenho_viewed: {
    simulados_with_results: number;
    avg_score?: number;
    best_score?: number;
  };
  comparativo_viewed: {
    simulados_count: number;
    segment: UserSegment;
  };
  comparativo_filter_applied: {
    filter_type: "area" | "theme" | "difficulty";
    value: string;
  };

  // Caderno de Erros
  caderno_erros_viewed: {
    total_errors: number;
    segment: UserSegment;
  };
  caderno_erros_filtered: {
    filter_type: "search" | "area" | "theme";
    result_count: number;
  };

  // Monetização
  upsell_clicked: {
    source: "pro_gate" | "upgrade_banner" | "mobile_header_upsell";
    feature?: string;
    current_segment?: UserSegment;
    required_segment?: UserSegment;
    cta_to: string;
  };
  feature_gate_seen: {
    feature: string;
    current_segment: UserSegment;
    required_segment: UserSegment;
  };

  // Fluxo Offline
  offline_attempt_created: {
    simulado_id: string;
    attempt_id: string;
  };
  offline_pdf_generated: {
    simulado_id: string;
    forced_regeneration: boolean;
  };
  offline_answers_submitted: {
    attempt_id: string;
    simulado_id: string;
    answers_count: number;
    is_within_window: boolean;
  };
  offline_answers_submit_failed: {
    attempt_id: string;
    simulado_id: string;
    error_message: string;
  };

  // Erros e Integridade
  exam_storage_fallback: {
    simulado_id: string;
    attempt_id?: string;
    error_message: string;
    fallback_source: "localStorage";
  };
  exam_storage_retry: {
    operation: string;
    attempt_number: number;
    max_attempts: number;
    error_message: string;
  };
  auth_profile_load_failed: {
    error_message: string;
    fallback_segment: "guest";
  };
  error_boundary_triggered: {
    error_message: string;
    component_stack: string;
    route: string;
  };
}

// ─────────────────────────────────────────────────────────────
// HELPER TIPADO — uso futuro quando analytics.ts for estendido
// ─────────────────────────────────────────────────────────────

/**
 * Exemplo de uso futuro para trackEvent fortemente tipado:
 *
 * import { EVENTS, PayloadMap } from "@/docs/analytics/tracking-plan";
 * import { trackEvent } from "@/lib/analytics";
 *
 * // Antes:
 * trackEvent("simulado_completed", { simuladoId, answered, total });
 *
 * // Depois (com tipos):
 * trackEvent(EVENTS.SIMULADO_COMPLETED, {
 *   simulado_id: simuladoId,
 *   attempt_id: attemptId,
 *   answered,
 *   total,
 *   score_percentage: score,
 *   duration_minutes: Math.round(duration / 60),
 *   tab_exit_count: state.tabExitCount,
 *   fullscreen_exit_count: state.fullscreenExitCount,
 *   is_within_window: attempt.is_within_window,
 * });
 */

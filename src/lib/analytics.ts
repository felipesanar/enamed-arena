import { logger } from "@/lib/logger";

export type AnalyticsEventName =
  // Conversion funnel
  | "lead_captured"
  | "landing_page_viewed"
  | "landing_section_viewed"
  // Auth
  | "auth_login_attempted"
  | "auth_login_succeeded"
  | "auth_login_failed"
  | "auth_signup_attempted"
  | "auth_password_reset_requested"
  // Onboarding
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_completed"
  | "onboarding_edit_blocked"
  // Simulado list & detail
  | "simulados_list_viewed"
  | "simulado_detail_viewed"
  | "simulado_checklist_completed"
  // Exam engine
  | "simulado_started"
  | "simulado_completed"
  | "exam_resumed"
  | "exam_answer_saved"
  | "exam_question_navigated"
  | "exam_integrity_event"
  | "exam_auto_submitted"
  | "exam_submit_attempted"
  | "exam_submit_failed"
  | "exam_offline_detected"
  // Results & correction
  | "resultado_viewed"
  | "correction_viewed"
  | "correction_question_viewed"
  | "error_added_to_notebook"
  // Ranking
  | "ranking_viewed"
  | "ranking_engagement_time"
  | "ranking_filter_changed"
  // Performance & comparison
  | "desempenho_viewed"
  | "comparativo_viewed"
  | "comparativo_filter_applied"
  // Error notebook
  | "caderno_erros_viewed"
  | "caderno_erros_filtered"
  // Monetization
  | "upsell_clicked"
  | "feature_gate_seen"
  // Offline flow
  | "offline_attempt_created"
  | "offline_pdf_generated"
  | "offline_answers_submitted"
  | "offline_answers_submit_failed"
  | "offline_printing_consent_viewed"
  | "offline_printing_started"
  | "offline_printing_completed_early"
  | "offline_printing_expired"
  // Errors & integrity
  | "exam_storage_fallback"
  | "exam_storage_retry"
  | "auth_profile_load_failed"
  | "error_boundary_triggered";

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsEvent {
  name: AnalyticsEventName;
  payload: AnalyticsPayload;
  timestamp: string;
}

type AnalyticsHandler = (event: AnalyticsEvent) => void | Promise<void>;

const handlers: AnalyticsHandler[] = [];
let superProperties: AnalyticsPayload = {};

export function setSuperProperties(props: AnalyticsPayload) {
  superProperties = { ...superProperties, ...props };
}

export function registerAnalyticsHandler(handler: AnalyticsHandler) {
  handlers.push(handler);
}

export function trackEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  const event: AnalyticsEvent = {
    name,
    payload: { ...superProperties, ...payload },
    timestamp: new Date().toISOString(),
  };

  logger.log("[analytics]", event.name, event.payload);

  handlers.forEach((handler) => {
    Promise.resolve(handler(event)).catch((error) => {
      logger.error("[analytics] handler error", error);
    });
  });
}

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
  // Error notebook — eventos existentes
  | "caderno_erros_viewed"
  | "caderno_erros_filtered"
  | "caderno_revisao_cta_clicked"
  | "caderno_revisao_started"
  | "caderno_revisao_ai_generated"
  | "caderno_revisao_marked_resolved"
  /**
   * @deprecated Substituído por `caderno_entry_snoozed` (mais granular, inclui entry_id e days_snoozed).
   * Manter para compatibilidade reversa até migração completa.
   */
  | "caderno_revisao_snoozed"
  | "caderno_revisao_chat_opened"
  | "caderno_revisao_chat_message_sent"
  | "caderno_revisao_train_more_clicked"
  // Error notebook — Caderno v2: triagem pós-prova
  | "caderno_triage_viewed"
  | "caderno_triage_item_toggled"
  | "caderno_triage_batch_added"
  // Error notebook — Caderno v2: recall ativo (sessão de revisão)
  | "caderno_recall_answer_selected"
  | "caderno_recall_confidence_set"
  | "caderno_recall_revealed"
  | "caderno_recall_self_graded"
  // Error notebook — Caderno v2: ciclo de vida de entradas
  /** Substituto canônico de `caderno_revisao_snoozed` (spec 06 B.2 + 00-contratos-canonicos §5). */
  | "caderno_entry_snoozed"
  | "caderno_entry_mastered"
  | "caderno_entry_leech_triggered"
  // Error notebook — Caderno v2: deep-link de aula (Fase 2)
  | "caderno_lesson_accessed"
  // Error notebook — Caderno v2: fim de sessão
  | "caderno_revisao_session_ended"
  // Error notebook — Caderno v2: aba Insights
  | "caderno_insights_viewed"
  | "caderno_insight_expanded"
  | "caderno_insight_cta_clicked"
  | "caderno_insights_refreshed"
  // Error notebook — Caderno v2: painel de ROI
  | "caderno_roi_viewed"
  | "caderno_roi_area_expanded"
  // Error notebook — Caderno v2: ações em lote (EPIC-5)
  | "caderno_bulk_select_started"
  | "caderno_bulk_resolved"
  | "caderno_bulk_snoozed"
  | "caderno_bulk_deleted"
  // Error notebook — Caderno v2: quick actions no card (EPIC-5)
  | "caderno_entry_deleted"
  | "caderno_entry_resolved"
  // Error notebook — Caderno v2: Flashcards (Fase 2)
  | "caderno_flashcard_created"
  | "caderno_flashcard_ai_generated"
  | "caderno_flashcard_reviewed"
  // Error notebook — Caderno v2: Anotações (Fase 2)
  | "caderno_note_created"
  | "caderno_note_updated"
  // Error notebook — Caderno v2: Favoritos (Fase 2)
  | "caderno_favorite_added"
  | "caderno_favorite_removed"
  // Error notebook — Caderno v2: Fase 3 (War Room, Export, TTS, Treino)
  | "caderno_reta_final_viewed"
  | "caderno_export_pdf"
  | "caderno_export_anki"
  | "caderno_tts_played"
  | "caderno_treino_started"
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
  | "error_boundary_triggered"
  // PDF downloads
  | "pdf_downloaded";

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

// ---------------------------------------------------------------------------
// Caderno v2 — typed payload interfaces (spec 06 Parte B + 00-contratos-canonicos §5)
// Agentes de UI devem usar estes tipos ao chamar trackEvent para garantir
// que as propriedades obrigatórias estejam presentes.
// ---------------------------------------------------------------------------

export interface CadernoTriageViewedPayload {
  attempt_id: string;
  simulado_id: string;
  candidate_count: number;
}

export interface CadernoTriageItemToggledPayload {
  question_id: string;
  action: "accepted" | "rejected";
  reason: string;
  reason_changed: boolean;
}

export interface CadernoTriageBatchAddedPayload {
  attempt_id: string;
  added_count: number;
  rejected_count: number;
}

export interface CadernoRecallAnswerSelectedPayload {
  entry_id: string;
  was_correct: boolean;
  option_label: string;
}

export interface CadernoRecallConfidenceSetPayload {
  entry_id: string;
  confidence: "baixa" | "media" | "alta";
}

export interface CadernoRecallRevealedPayload {
  entry_id: string;
  was_correct: boolean;
}

export interface CadernoRecallSelfGradedPayload {
  entry_id: string;
  grade: "errei" | "dificil" | "bom" | "facil";
  was_correct: boolean;
  srs_next_interval_days: number;
}

/** Substitui `caderno_revisao_snoozed` (deprecado). Ver spec 06 B.2 + 00-contratos-canonicos §5. */
export interface CadernoEntrySnoozedPayload {
  entry_id: string;
  days_snoozed: number;
  reason: "manual_override";
}

export interface CadernoEntryMasteredPayload {
  entry_id: string;
  via_srs: boolean;
  srs_interval_days?: number;
  entry_age_days?: number;
}

export interface CadernoEntryLeechTriggeredPayload {
  entry_id: string;
  srs_lapses: number;
  area: string;
}

export interface CadernoLessonAccessedPayload {
  entry_id: string;
  area: string;
  lesson_url?: string;
}

export interface CadernoRevisaoSessionEndedPayload {
  session_duration_seconds: number;
  entries_reviewed: number;
  entries_mastered: number;
  entries_snoozed: number;
  top_area: string;
}

export interface CadernoInsightsViewedPayload {
  from_cache: boolean;
  cache_age_hours: number;
  insight_count: number;
  has_sufficient_data: boolean;
}

export interface CadernoInsightExpandedPayload {
  insight_id: string;
  insight_type: "weak_area" | "dominant_cause" | "recurring_confusion" | "overconfidence" | "roi";
  severity: "critical" | "attention" | "positive" | "info";
}

export interface CadernoInsightCtaClickedPayload {
  insight_id: string;
  insight_type: "weak_area" | "dominant_cause" | "recurring_confusion" | "overconfidence" | "roi";
  cta_label: string;
  cta_href: string;
}

export interface CadernoInsightsRefreshedPayload {
  previous_cache_age_hours: number;
  entry_count: number;
}

export interface CadernoRoiViewedPayload {
  areas_with_roi: number;
  best_delta_pp: number;
  has_positive_roi: boolean;
}

export interface CadernoRoiAreaExpandedPayload {
  area: string;
  mastered_count: number;
  delta_pp: number;
}

// Error notebook — Caderno v2: Flashcards (Fase 2)
export interface CadernoFlashcardCreatedPayload {
  flashcard_id: string;
  entry_id: string;
  area: string;
}

export interface CadernoFlashcardAiGeneratedPayload {
  flashcard_id: string;
  entry_id: string;
  front_generated: boolean;
  back_generated: boolean;
}

export interface CadernoFlashcardReviewedPayload {
  flashcard_id: string;
  outcome: "errei" | "dificil" | "bom" | "facil";
  mastered: boolean;
  srs_interval_days?: number;
}

// Error notebook — Caderno v2: Anotações (Fase 2)
export interface CadernoNoteCreatedPayload {
  note_id: string;
  question_id?: string;
  simulado_id?: string;
  area?: string;
}

export interface CadernoNoteUpdatedPayload {
  note_id: string;
  question_id?: string;
  area?: string;
}

// Error notebook — Caderno v2: Favoritos (Fase 2)
export interface CadernoFavoriteAddedPayload {
  question_id: string;
  simulado_id?: string;
  area: string;
}

export interface CadernoFavoriteRemovedPayload {
  question_id: string;
  area: string;
}

// Error notebook — Caderno v2: Fase 3 (War Room, Export, TTS, Treino)
export interface CadernoRetaFinalViewedPayload {
  days_until: number;
  pending_count: number;
}

export interface CadernoExportPdfPayload {
  entry_count: number;
}

export interface CadernoExportAnkiPayload {
  entry_count: number;
}

export interface CadernoTtsPlayedPayload {
  section: string;
}

export interface CadernoTreinoStartedPayload {
  area?: string;
  count: number;
}

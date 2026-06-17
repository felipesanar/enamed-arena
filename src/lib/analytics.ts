import { z } from "zod";
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
  // Error notebook — Caderno v2: Fase 4 — calibração de confiança
  | "caderno_calibration_viewed"
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
  | "caderno_flashcard_disliked"
  | "caderno_flashcards_bulk_generated"
  | "caderno_flashcard_session_started"
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
  // Error notebook — Caderno v2: integração da plataforma (plano 08)
  // Captura em toda a superfície (correção / gabarito / prova)
  | "caderno_note_quick_opened"
  | "caderno_exam_question_favorited"
  | "caderno_exam_marked_to_triage"
  // Loop de retorno (home / nav / lembretes)
  | "caderno_home_due_card_viewed"
  | "caderno_nav_due_badge_viewed"
  | "caderno_home_streak_viewed"
  | "caderno_home_countdown_viewed"
  | "caderno_home_insight_teaser_viewed"
  | "caderno_reminder_sent"
  | "caderno_reminder_opened"
  | "notification_preferences_updated"
  // CTAs de modo no header/hero do Caderno
  | "caderno_treino_cta_clicked"
  | "caderno_reta_final_cta_clicked"
  // Diagnóstico → ação (Desempenho → Caderno)
  | "desempenho_to_caderno_clicked"
  // Pós-prova
  | "caderno_post_exam_summary_viewed"
  // Lacuna / gating de aula
  | "caderno_awaiting_lesson_set"
  | "caderno_lesson_unlocked"
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

/**
 * Resolve o tipo de payload de um evento (Fase 2, passo 1 — amarração nome→payload).
 *
 * - Evento COM contrato em `EventPayloadMap`: os campos obrigatórios passam a ser
 *   exigidos em tempo de compilação. Propriedades extras de contexto continuam
 *   permitidas (payload "aberto", via `& AnalyticsPayload`).
 * - Evento SEM contrato: payload solto (`AnalyticsPayload`), 100% compatível com
 *   os call-sites existentes.
 */
export type PayloadFor<E extends AnalyticsEventName> =
  E extends keyof EventPayloadMap ? EventPayloadMap[E] & AnalyticsPayload : AnalyticsPayload;

interface AnalyticsEvent {
  name: AnalyticsEventName;
  event_id: string;
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

// ---------------------------------------------------------------------------
// Caderno v2 — schemas Zod (Fase 2, passo 2)
// Fonte única de contratos: schemas Zod definem a forma; tipos TS via z.infer.
// `.passthrough()` tolera props extras (super-props de contexto automático).
// ---------------------------------------------------------------------------

const cadernoTriageViewedSchema = z.object({
  attempt_id: z.string(),
  simulado_id: z.string(),
  candidate_count: z.number(),
}).passthrough();
export type CadernoTriageViewedPayload = z.infer<typeof cadernoTriageViewedSchema>;

const cadernoTriageItemToggledSchema = z.object({
  question_id: z.string(),
  action: z.enum(["accepted", "rejected"]),
  reason: z.string(),
  reason_changed: z.boolean(),
}).passthrough();
export type CadernoTriageItemToggledPayload = z.infer<typeof cadernoTriageItemToggledSchema>;

const cadernoTriageBatchAddedSchema = z.object({
  attempt_id: z.string(),
  added_count: z.number(),
  rejected_count: z.number(),
}).passthrough();
export type CadernoTriageBatchAddedPayload = z.infer<typeof cadernoTriageBatchAddedSchema>;

const cadernoRecallAnswerSelectedSchema = z.object({
  entry_id: z.string(),
  was_correct: z.boolean(),
  option_label: z.string(),
}).passthrough();
export type CadernoRecallAnswerSelectedPayload = z.infer<typeof cadernoRecallAnswerSelectedSchema>;

const cadernoRecallConfidenceSetSchema = z.object({
  entry_id: z.string(),
  confidence: z.enum(["baixa", "media", "alta"]),
}).passthrough();
export type CadernoRecallConfidenceSetPayload = z.infer<typeof cadernoRecallConfidenceSetSchema>;

const cadernoRecallRevealedSchema = z.object({
  entry_id: z.string(),
  was_correct: z.boolean(),
}).passthrough();
export type CadernoRecallRevealedPayload = z.infer<typeof cadernoRecallRevealedSchema>;

const cadernoRecallSelfGradedSchema = z.object({
  entry_id: z.string(),
  grade: z.enum(["errei", "dificil", "bom", "facil"]),
  was_correct: z.boolean(),
  srs_next_interval_days: z.number(),
}).passthrough();
export type CadernoRecallSelfGradedPayload = z.infer<typeof cadernoRecallSelfGradedSchema>;

const cadernoEntrySnoozedSchema = z.object({
  entry_id: z.string(),
  days_snoozed: z.number(),
  reason: z.literal("manual_override").optional(),
}).passthrough();
export type CadernoEntrySnoozedPayload = z.infer<typeof cadernoEntrySnoozedSchema>;

const cadernoEntryMasteredSchema = z.object({
  entry_id: z.string(),
  via_srs: z.boolean(),
  srs_interval_days: z.number().optional(),
  entry_age_days: z.number().optional(),
}).passthrough();
export type CadernoEntryMasteredPayload = z.infer<typeof cadernoEntryMasteredSchema>;

const cadernoEntryLeechTriggeredSchema = z.object({
  entry_id: z.string(),
  srs_lapses: z.number(),
  area: z.string(),
}).passthrough();
export type CadernoEntryLeechTriggeredPayload = z.infer<typeof cadernoEntryLeechTriggeredSchema>;

const cadernoLessonAccessedSchema = z.object({
  entry_id: z.string(),
  area: z.string().optional(),
  theme: z.string().optional(),
  reason: z.string().optional(),
  lesson_url: z.string().optional(),
}).passthrough();
export type CadernoLessonAccessedPayload = z.infer<typeof cadernoLessonAccessedSchema>;

const cadernoRevisaoSessionEndedSchema = z.object({
  session_duration_seconds: z.number(),
  entries_reviewed: z.number(),
  entries_mastered: z.number(),
  entries_snoozed: z.number(),
  top_area: z.string(),
}).passthrough();
export type CadernoRevisaoSessionEndedPayload = z.infer<typeof cadernoRevisaoSessionEndedSchema>;

const cadernoInsightsViewedSchema = z.object({
  from_cache: z.boolean(),
  cache_age_hours: z.number(),
  insight_count: z.number(),
  has_sufficient_data: z.boolean(),
}).passthrough();
export type CadernoInsightsViewedPayload = z.infer<typeof cadernoInsightsViewedSchema>;

const cadernoInsightExpandedSchema = z.object({
  insight_id: z.string(),
  insight_type: z.enum(["weak_area", "dominant_cause", "recurring_confusion", "overconfidence", "roi"]),
  severity: z.enum(["critical", "attention", "positive", "info"]),
}).passthrough();
export type CadernoInsightExpandedPayload = z.infer<typeof cadernoInsightExpandedSchema>;

const cadernoInsightCtaClickedSchema = z.object({
  insight_id: z.string(),
  insight_type: z.enum(["weak_area", "dominant_cause", "recurring_confusion", "overconfidence", "roi"]),
  cta_label: z.string(),
  cta_href: z.string(),
}).passthrough();
export type CadernoInsightCtaClickedPayload = z.infer<typeof cadernoInsightCtaClickedSchema>;

const cadernoInsightsRefreshedSchema = z.object({
  previous_cache_age_hours: z.number(),
  entry_count: z.number(),
}).passthrough();
export type CadernoInsightsRefreshedPayload = z.infer<typeof cadernoInsightsRefreshedSchema>;

const cadernoRoiViewedSchema = z.object({
  areas_with_roi: z.number(),
  best_delta_pp: z.number(),
  has_positive_roi: z.boolean(),
}).passthrough();
export type CadernoRoiViewedPayload = z.infer<typeof cadernoRoiViewedSchema>;

const cadernoRoiAreaExpandedSchema = z.object({
  area: z.string(),
  mastered_count: z.number().optional(),
  delta_pp: z.number(),
}).passthrough();
export type CadernoRoiAreaExpandedPayload = z.infer<typeof cadernoRoiAreaExpandedSchema>;

const cadernoFlashcardCreatedSchema = z.object({
  deck_id: z.string(),
  has_image: z.boolean(),
  ai_generated: z.boolean(),
}).passthrough();
export type CadernoFlashcardCreatedPayload = z.infer<typeof cadernoFlashcardCreatedSchema>;

const cadernoFlashcardAiGeneratedSchema = z.object({
  has_context: z.boolean(),
}).passthrough();
export type CadernoFlashcardAiGeneratedPayload = z.infer<typeof cadernoFlashcardAiGeneratedSchema>;

const cadernoFlashcardReviewedSchema = z.object({
  flashcard_id: z.string(),
  outcome: z.enum(["errei", "dificil", "bom", "facil"]),
  mode: z.string().optional(),
  mastered: z.boolean().optional(),
  srs_interval: z.number().optional(),
  training: z.boolean().optional(),
}).passthrough();
export type CadernoFlashcardReviewedPayload = z.infer<typeof cadernoFlashcardReviewedSchema>;

const cadernoNoteCreatedSchema = z.object({
  note_id: z.string(),
  question_id: z.string().optional(),
  simulado_id: z.string().optional(),
  area: z.string().optional(),
}).passthrough();
export type CadernoNoteCreatedPayload = z.infer<typeof cadernoNoteCreatedSchema>;

const cadernoNoteUpdatedSchema = z.object({
  note_id: z.string(),
  question_id: z.string().optional(),
  area: z.string().optional(),
}).passthrough();
export type CadernoNoteUpdatedPayload = z.infer<typeof cadernoNoteUpdatedSchema>;

const cadernoFavoriteAddedSchema = z.object({
  question_id: z.string(),
  simulado_id: z.string().optional(),
  area: z.string(),
}).passthrough();
export type CadernoFavoriteAddedPayload = z.infer<typeof cadernoFavoriteAddedSchema>;

const cadernoFavoriteRemovedSchema = z.object({
  favorite_id: z.string().optional(),
  question_id: z.string(),
  area: z.string().optional(),
}).passthrough();
export type CadernoFavoriteRemovedPayload = z.infer<typeof cadernoFavoriteRemovedSchema>;

const cadernoRetaFinalViewedSchema = z.object({
  days_until: z.number(),
  total_active: z.number(),
  overdue: z.number(),
  covered: z.number(),
  uncovered: z.number(),
  segment: z.string(),
}).passthrough();
export type CadernoRetaFinalViewedPayload = z.infer<typeof cadernoRetaFinalViewedSchema>;

const cadernoExportPdfSchema = z.object({
  entry_count: z.number(),
}).passthrough();
export type CadernoExportPdfPayload = z.infer<typeof cadernoExportPdfSchema>;

const cadernoExportAnkiSchema = z.object({
  entry_count: z.number(),
}).passthrough();
export type CadernoExportAnkiPayload = z.infer<typeof cadernoExportAnkiSchema>;

const cadernoTtsPlayedSchema = z.object({
  entry_id: z.string(),
  area: z.string().optional(),
  section: z.string().optional(),
}).passthrough();
export type CadernoTtsPlayedPayload = z.infer<typeof cadernoTtsPlayedSchema>;

const cadernoTreinoStartedSchema = z.object({
  area: z.string().optional(),
  count: z.number(),
}).passthrough();
export type CadernoTreinoStartedPayload = z.infer<typeof cadernoTreinoStartedSchema>;

const cadernoCalibrationViewedSchema = z.object({
  has_data: z.boolean(),
  total_answered_with_confidence: z.number(),
  alta_but_wrong: z.number(),
  baixa_but_correct: z.number(),
}).passthrough();
export type CadernoCalibrationViewedPayload = z.infer<typeof cadernoCalibrationViewedSchema>;

const cadernoFlashcardSessionStartedSchema = z.object({
  mode: z.enum(["due", "free", "hard", "shuffle", "reversed", "timed"]),
  count: z.number(),
}).passthrough();
export type CadernoFlashcardSessionStartedPayload = z.infer<typeof cadernoFlashcardSessionStartedSchema>;

// ---------------------------------------------------------------------------
// Mapa nome → schema para validação de runtime em trackEvent.
// Eventos ausentes = payload solto aceito (retrocompatível com 64 call-sites).
// ---------------------------------------------------------------------------
const eventSchemas = {
  caderno_triage_viewed: cadernoTriageViewedSchema,
  caderno_triage_item_toggled: cadernoTriageItemToggledSchema,
  caderno_triage_batch_added: cadernoTriageBatchAddedSchema,
  caderno_recall_answer_selected: cadernoRecallAnswerSelectedSchema,
  caderno_recall_confidence_set: cadernoRecallConfidenceSetSchema,
  caderno_recall_revealed: cadernoRecallRevealedSchema,
  caderno_recall_self_graded: cadernoRecallSelfGradedSchema,
  caderno_entry_snoozed: cadernoEntrySnoozedSchema,
  caderno_entry_mastered: cadernoEntryMasteredSchema,
  caderno_entry_leech_triggered: cadernoEntryLeechTriggeredSchema,
  caderno_lesson_accessed: cadernoLessonAccessedSchema,
  caderno_revisao_session_ended: cadernoRevisaoSessionEndedSchema,
  caderno_insights_viewed: cadernoInsightsViewedSchema,
  caderno_insight_expanded: cadernoInsightExpandedSchema,
  caderno_insight_cta_clicked: cadernoInsightCtaClickedSchema,
  caderno_insights_refreshed: cadernoInsightsRefreshedSchema,
  caderno_roi_viewed: cadernoRoiViewedSchema,
  caderno_roi_area_expanded: cadernoRoiAreaExpandedSchema,
  caderno_flashcard_created: cadernoFlashcardCreatedSchema,
  caderno_flashcard_ai_generated: cadernoFlashcardAiGeneratedSchema,
  caderno_flashcard_reviewed: cadernoFlashcardReviewedSchema,
  caderno_note_created: cadernoNoteCreatedSchema,
  caderno_note_updated: cadernoNoteUpdatedSchema,
  caderno_favorite_added: cadernoFavoriteAddedSchema,
  caderno_favorite_removed: cadernoFavoriteRemovedSchema,
  caderno_reta_final_viewed: cadernoRetaFinalViewedSchema,
  caderno_export_pdf: cadernoExportPdfSchema,
  caderno_export_anki: cadernoExportAnkiSchema,
  caderno_tts_played: cadernoTtsPlayedSchema,
  caderno_treino_started: cadernoTreinoStartedSchema,
  caderno_calibration_viewed: cadernoCalibrationViewedSchema,
  caderno_flashcard_session_started: cadernoFlashcardSessionStartedSchema,
};

// ---------------------------------------------------------------------------
// Fonte única de tipos: mapa nome → contrato de payload.
// Tipos derivados dos schemas Zod — sem duplicação manual.
// ---------------------------------------------------------------------------
export interface EventPayloadMap {
  caderno_triage_viewed: CadernoTriageViewedPayload;
  caderno_triage_item_toggled: CadernoTriageItemToggledPayload;
  caderno_triage_batch_added: CadernoTriageBatchAddedPayload;
  caderno_recall_answer_selected: CadernoRecallAnswerSelectedPayload;
  caderno_recall_confidence_set: CadernoRecallConfidenceSetPayload;
  caderno_recall_revealed: CadernoRecallRevealedPayload;
  caderno_recall_self_graded: CadernoRecallSelfGradedPayload;
  caderno_entry_snoozed: CadernoEntrySnoozedPayload;
  caderno_entry_mastered: CadernoEntryMasteredPayload;
  caderno_entry_leech_triggered: CadernoEntryLeechTriggeredPayload;
  caderno_lesson_accessed: CadernoLessonAccessedPayload;
  caderno_revisao_session_ended: CadernoRevisaoSessionEndedPayload;
  caderno_insights_viewed: CadernoInsightsViewedPayload;
  caderno_insight_expanded: CadernoInsightExpandedPayload;
  caderno_insight_cta_clicked: CadernoInsightCtaClickedPayload;
  caderno_insights_refreshed: CadernoInsightsRefreshedPayload;
  caderno_roi_viewed: CadernoRoiViewedPayload;
  caderno_roi_area_expanded: CadernoRoiAreaExpandedPayload;
  caderno_flashcard_created: CadernoFlashcardCreatedPayload;
  caderno_flashcard_ai_generated: CadernoFlashcardAiGeneratedPayload;
  caderno_flashcard_reviewed: CadernoFlashcardReviewedPayload;
  caderno_note_created: CadernoNoteCreatedPayload;
  caderno_note_updated: CadernoNoteUpdatedPayload;
  caderno_favorite_added: CadernoFavoriteAddedPayload;
  caderno_favorite_removed: CadernoFavoriteRemovedPayload;
  caderno_reta_final_viewed: CadernoRetaFinalViewedPayload;
  caderno_export_pdf: CadernoExportPdfPayload;
  caderno_export_anki: CadernoExportAnkiPayload;
  caderno_tts_played: CadernoTtsPlayedPayload;
  caderno_treino_started: CadernoTreinoStartedPayload;
  caderno_calibration_viewed: CadernoCalibrationViewedPayload;
  caderno_flashcard_session_started: CadernoFlashcardSessionStartedPayload;
}

export function trackEvent<E extends AnalyticsEventName>(
  name: E,
  payload: PayloadFor<E> = {} as PayloadFor<E>,
) {
  const schema = (eventSchemas as Partial<Record<AnalyticsEventName, z.ZodTypeAny>>)[name];
  if (schema) {
    const result = schema.safeParse(payload);
    if (!result.success) {
      logger.error(
        `[analytics] payload inválido — evento "${name}" descartado`,
        result.error.issues,
      );
      return;
    }
  }

  const event: AnalyticsEvent = {
    name,
    event_id: crypto.randomUUID(),
    payload: { ...superProperties, ...(payload as AnalyticsPayload) },
    timestamp: new Date().toISOString(),
  };

  logger.log("[analytics]", event.name, event.payload);

  handlers.forEach((handler) => {
    Promise.resolve(handler(event)).catch((error) => {
      logger.error("[analytics] handler error", error);
    });
  });
}

/** Valida um payload contra o schema do evento. Uso: ferramentas DEV/QA. */
export function validateEventPayload(
  name: string,
  payload: Record<string, unknown>,
): { ok: boolean; issues: unknown[] } {
  const schema = (eventSchemas as Record<string, z.ZodTypeAny>)[name];
  if (!schema) return { ok: true, issues: [] };
  const result = schema.safeParse(payload);
  return result.success
    ? { ok: true, issues: [] }
    : { ok: false, issues: result.error.issues };
}

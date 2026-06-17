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
 *   permitidas (payload "aberto", via `& AnalyticsPayload`) — a régua estrita
 *   (rejeitar propriedade fora do schema) entra na Fase 2, passo 2, com validação
 *   de runtime (Zod) derivada destes mesmos contratos.
 * - Evento SEM contrato: payload solto (`AnalyticsPayload`), 100% compatível com
 *   os call-sites existentes.
 */
export type PayloadFor<E extends AnalyticsEventName> =
  E extends keyof EventPayloadMap ? EventPayloadMap[E] & AnalyticsPayload : AnalyticsPayload;

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

export function trackEvent<E extends AnalyticsEventName>(
  name: E,
  payload: PayloadFor<E> = {} as PayloadFor<E>,
) {
  const event: AnalyticsEvent = {
    name,
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

/**
 * Substitui `caderno_revisao_snoozed` (deprecado). Ver spec 06 B.2 + 00-contratos-canonicos §5.
 * `reason` é opcional: alinhado à emissão real (2026-06-17) — `useActiveRecallSession` envia
 * `reason: 'manual_override'`, mas `CadernoPage` não envia. Candidato a enriquecimento (Fase 3):
 * padronizar o envio de `reason` em ambos os call-sites.
 */
export interface CadernoEntrySnoozedPayload {
  entry_id: string;
  days_snoozed: number;
  reason?: "manual_override";
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

/** Alinhado à emissão real (2026-06-17): `LessonUnlockDialog` envia entry_id + area/theme/reason (area pode ser undefined). */
export interface CadernoLessonAccessedPayload {
  entry_id: string;
  area?: string;
  theme?: string;
  reason?: string;
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

/** `mastered_count` opcional: alinhado à emissão real (2026-06-17) — `RoiPanel` só envia area + delta_pp. */
export interface CadernoRoiAreaExpandedPayload {
  area: string;
  mastered_count?: number;
  delta_pp: number;
}

// Error notebook — Caderno v2: Flashcards (Fase 2)
/**
 * Alinhado à emissão real (2026-06-17): `FlashcardEditor` envia deck_id/has_image/ai_generated.
 * O contrato antigo (flashcard_id/entry_id/area) era do design pré-deck e nunca foi emitido aqui.
 */
export interface CadernoFlashcardCreatedPayload {
  deck_id: string;
  has_image: boolean;
  ai_generated: boolean;
}

/**
 * Alinhado à emissão real (2026-06-17): `FlashcardEditor` dispara na GERAÇÃO (antes de salvar),
 * quando ainda não há flashcard_id/entry_id — só `has_context`. O contrato antigo
 * (flashcard_id/entry_id/front_generated/back_generated) era do design pré-deck e nunca foi emitido.
 * Candidato a enriquecimento (Fase 3) se quisermos medir front/back gerados.
 */
export interface CadernoFlashcardAiGeneratedPayload {
  has_context: boolean;
}

/**
 * Alinhado à emissão real (2026-06-17): dois call-sites em `FlashcardReviewSession` —
 * branch SRS envia `mastered` + `srs_interval`; branch treino envia `training` sem `mastered`.
 * (Há um 3º call-site em `CadernoFlashcardsPage` com `as any` — fora do contrato; ver Fase 3.)
 * `srs_interval` é o nome realmente emitido (não `srs_interval_days`).
 */
export interface CadernoFlashcardReviewedPayload {
  flashcard_id: string;
  outcome: "errei" | "dificil" | "bom" | "facil";
  mode?: string;
  mastered?: boolean;
  srs_interval?: number;
  training?: boolean;
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

/** `area` opcional + `favorite_id` opcional: alinhado à emissão real (2026-06-17) em 3 call-sites (área pode ser undefined em FavoriteCard). */
export interface CadernoFavoriteRemovedPayload {
  favorite_id?: string;
  question_id: string;
  area?: string;
}

// Error notebook — Caderno v2: Fase 3 (War Room, Export, TTS, Treino)
/**
 * Alinhado à emissão real (2026-06-17): `CadernoRetaFinalPage` envia o detalhamento de cobertura
 * (total_active/overdue/covered/uncovered/segment), não `pending_count`. Contrato antigo estava obsoleto.
 */
export interface CadernoRetaFinalViewedPayload {
  days_until: number;
  total_active: number;
  overdue: number;
  covered: number;
  uncovered: number;
  segment: string;
}

export interface CadernoExportPdfPayload {
  entry_count: number;
}

export interface CadernoExportAnkiPayload {
  entry_count: number;
}

/** Alinhado à emissão real (2026-06-17): `RevealPanel` envia entry_id + area. `section` mantido opcional para uso futuro. */
export interface CadernoTtsPlayedPayload {
  entry_id: string;
  area?: string;
  section?: string;
}

export interface CadernoTreinoStartedPayload {
  area?: string;
  count: number;
}

// Error notebook — Caderno v2: Fase 4 — calibração de confiança
export interface CadernoCalibrationViewedPayload {
  has_data: boolean;
  total_answered_with_confidence: number;
  alta_but_wrong: number;
  baixa_but_correct: number;
}

// ---------------------------------------------------------------------------
// Fonte única de tipos: mapa nome do evento → contrato de payload.
// `trackEvent` usa este mapa (via `PayloadFor`) para exigir os campos
// obrigatórios em tempo de compilação. Eventos ausentes daqui usam payload
// solto (`AnalyticsPayload`). Adicionar um evento ao mapa = amarrar seu contrato.
// A Fase 2, passo 2, deriva os schemas Zod a partir destes mesmos tipos.
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
}

// ─── Shared row/DB types for generate-exam-pdf ───────────────────────────────
//
// Extracted from index.ts (Task 14) so both the legacy pdf-lib renderer
// (legacyPdfLib.ts) and future callers (e.g. renderPayload.ts, Task 15/16)
// can share the same shapes without duplication.

export interface SimuladoRow {
  id: string; title: string; slug: string;
  sequence_number: number; questions_count: number; duration_minutes: number;
}
export interface QuestionRow {
  id: string; question_number: number; text: string; image_url: string | null;
}
export interface OptionRow {
  question_id: string; label: string; text: string;
}

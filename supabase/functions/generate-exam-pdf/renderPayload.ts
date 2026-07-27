/**
 * Monta o payload JSON enviado ao serviço de render (Task 6 / LaTeX+Tectonic),
 * a partir das rows já carregadas pela query existente em `buildAndUploadPdf`
 * (ver index.ts). Lógica pura, sem `Deno.*` nem imports externos, para ser
 * testável com Vitest — mesmo padrão de `generate-flashcards-batch/cardMapping.ts`.
 *
 * Contrato (verbatim das Global Constraints do plano):
 * {
 *   "simulado": { "title", "sequence_number", "questions_count", "duration_minutes" },
 *   "questions": [{ "number", "text", "image_url", "options": [{ "label", "text" }] }]
 * }
 *
 * IMPORTANTE: o texto é passado CRU (sem escapar). Escaping para LaTeX é
 * responsabilidade exclusiva do serviço de render (Task 6) — nunca deste
 * módulo, para não haver dupla-escapagem nem escaping incorreto do lado errado
 * da fronteira HTTP.
 */

export interface RenderSimulado {
  title: string;
  sequence_number: number;
  questions_count: number;
  duration_minutes: number;
}

export interface RenderOption {
  label: string;
  text: string;
}

export interface RenderQuestion {
  number: number;
  text: string;
  image_url: string | null;
  options: RenderOption[];
}

export interface RenderPayload {
  simulado: RenderSimulado;
  questions: RenderQuestion[];
}

export function buildRenderPayload(
  simuladoRow: { title: string; sequence_number: number; questions_count: number; duration_minutes: number },
  questions: Array<{ number: number; text: string; image_url: string | null; options: Array<{ label: string; text: string }> }>,
): RenderPayload {
  return {
    simulado: {
      title: simuladoRow.title,
      sequence_number: simuladoRow.sequence_number,
      questions_count: simuladoRow.questions_count,
      duration_minutes: simuladoRow.duration_minutes,
    },
    questions: questions.map((q) => ({
      number: q.number,
      text: q.text,
      image_url: q.image_url,
      options: q.options.map((o) => ({ label: o.label, text: o.text })),
    })),
  };
}

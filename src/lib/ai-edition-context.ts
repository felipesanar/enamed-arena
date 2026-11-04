import { validateExamFormat } from '@/lib/edition-format';
import type { ExamEdition } from '@/types/edition';
import type { AiEditionContext } from '@/types/ai-edition';
import type { CutoffContext } from '@/hooks/useCutoffContext';

export function resolveSeriesEditionId(ids: readonly (string | null | undefined)[]): string | null {
  if (!ids.length || ids.some(id => !id) || new Set(ids).size !== 1) return null;
  return ids[0]!;
}

/** A single DTO value cannot represent different sources, scenarios or thresholds. */
export function cutoffReferenceFromContext(context: CutoffContext | null, editionId: string): AiEditionContext['cutoffReference'] {
  if (!context?.has_target_cutoff || context.reference_edition_id !== editionId || !Array.isArray(context.matches) || !context.matches.length) return null;
  const first = context.matches[0];
  if (!first.reference_label?.trim() || !first.source?.trim() || typeof first.cutoff_general !== 'number'
    || !Number.isFinite(first.cutoff_general) || first.reference_edition_id !== editionId) return null;
  if (context.matches.some(match => match.reference_edition_id !== editionId
    || match.reference_label !== first.reference_label || match.source !== first.source
    || match.cutoff_general !== first.cutoff_general)) return null;
  return { label: first.reference_label, source: first.source, value: first.cutoff_general };
}

export function buildAiEditionContext(
  editions: readonly ExamEdition[], ids: readonly (string | null | undefined)[],
  percentile: number | null, cutoffContext: CutoffContext | null,
): AiEditionContext | null {
  const id = resolveSeriesEditionId(ids);
  const edition = editions.find(item => item.id === id);
  if (!edition?.label?.trim()) return null;
  const format = validateExamFormat(edition.format);
  if (!format.valid) return null;
  return {
    editionId: edition.id, editionLabel: edition.label, format: format.value,
    percentile: percentile !== null && Number.isInteger(percentile) && percentile >= 1 && percentile <= 99 ? percentile : null,
    cutoffReference: cutoffReferenceFromContext(cutoffContext, edition.id),
  };
}

import { describe, expect, it } from 'vitest';
import { buildAiEditionContext, cutoffReferenceFromContext, resolveSeriesEditionId } from '@/lib/ai-edition-context';
import { computePercentile } from '@/lib/ranking-percentile';
import type { ExamEdition } from '@/types/edition';
import type { CutoffContext } from '@/hooks/useCutoffContext';

const editions = [
  { id: 'historic', label: 'ENAMED 2026', format: { questions: 100, options: 4, duration_minutes: 240, scoring: 'raw' } },
  { id: 'new', label: 'ENAMED 2027', format: { questions: 120, options: 5, duration_minutes: 300, scoring: 'tri', proficient_min: 60 } },
] as unknown as ExamEdition[];

describe('AI edition context', () => {
  it('uses the exam edition including historic training, not a personal target', () => {
    expect(buildAiEditionContext(editions, ['historic'], null, null)?.format.questions).toBe(100);
    expect(buildAiEditionContext(editions, ['new'], null, null)?.format.duration_minutes).toBe(300);
  });
  it('rejects cross-edition, missing metadata and invalid formats', () => {
    expect(resolveSeriesEditionId(['historic', 'new'])).toBeNull();
    expect(resolveSeriesEditionId(['historic', undefined])).toBeNull();
    expect(buildAiEditionContext(editions, ['missing'], null, null)).toBeNull();
    expect(buildAiEditionContext([{ ...editions[0], format: {} }], ['historic'], null, null)).toBeNull();
  });
  it('keeps exactly the client Top X% or null, never derives it from score', () => {
    const percentile = computePercentile(7, 123);
    expect(buildAiEditionContext(editions, ['new'], percentile, null)?.percentile).toBe(percentile);
    expect(buildAiEditionContext(editions, ['new'], null, null)?.percentile).toBeNull();
    expect(buildAiEditionContext(editions, ['new'], 100, null)?.percentile).toBeNull();
  });
  it('does not invent a reference from a catalog proficiency threshold or legacy average', () => {
    expect(buildAiEditionContext(editions, ['new'], null, null)?.cutoffReference).toBeNull();
    expect(cutoffReferenceFromContext({ has_target_cutoff: true, stats: { avg: 60 }, matches: [] } as never, 'new')).toBeNull();
  });
  it('only accepts real homogeneous matched reference data', () => {
    const match = { reference_edition_id: 'new', reference_label: 'Processo confirmado', source: 'Edital X', cutoff_general: 78 };
    const context = { has_target_cutoff: true, reference_edition_id: 'new', reference_label: 'Processo confirmado', matches: [match] } as unknown as CutoffContext;
    expect(cutoffReferenceFromContext(context, 'new')).toEqual({ label: 'Processo confirmado', source: 'Edital X', value: 78 });
    expect(cutoffReferenceFromContext(context, 'historic')).toBeNull();
    expect(cutoffReferenceFromContext({ ...context, matches: [match, { ...match, source: 'Outro' }] } as never, 'new')).toBeNull();
    expect(cutoffReferenceFromContext({ ...context, matches: [match, { ...match, cutoff_general: 82 }] } as never, 'new')).toBeNull();
  });
});

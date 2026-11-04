import type { ExamFormat } from '@/types/edition';

/** Analysis context, never a source of scores or official proficiency. */
export interface AiEditionContext {
  editionId: string;
  editionLabel: string;
  format: ExamFormat;
  /** Top X%, computed with ranking-percentile from actual position/population. */
  percentile: number | null;
  cutoffReference: {
    label: string;
    source: string;
    value: number;
  } | null;
}

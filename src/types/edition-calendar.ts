import type { SimuladoConfig } from '@/types';
import type { ExamArea, ExamEdition, ExamFormat } from '@/types/edition';

/** Public, already authorized metadata only. Never pass notebook or attempt data. */
export type CalendarSimulado = Pick<SimuladoConfig, 'id' | 'editionId' | 'title' | 'dbStatus'
  | 'executionWindowStart' | 'executionWindowEnd' | 'resultsReleaseAt'>;
export interface EditionCalendarEvent {
  editionId: string;
  simuladoId: string | null;
  type: 'window' | 'results' | 'official-exam';
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
}
export interface EditionCalendar {
  events: EditionCalendarEvent[];
  errors: { simuladoId: string; reason: 'invalid-window' | 'invalid-results' | 'results-before-window-end' }[];
}
export type StudyAreaWeight = Pick<ExamArea, 'code' | 'label' | 'aliases' | 'weight'>;
export interface EditionStudyContext {
  edition: ExamEdition | null;
  date: string | null;
  daysUntil: number | null;
  format: ExamFormat | null;
  matrixStatus: 'available' | 'provisional' | 'unavailable';
  areaWeights: StudyAreaWeight[];
}

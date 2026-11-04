import type { EditionTargetProfile, ExamEdition } from '@/types/edition';
import type { SimuladoConfig, SimuladoUserState } from '@/types';
import { deriveSimuladoStatus } from '@/lib/simulado-helpers';
import { parseISO, isValid } from 'date-fns';
import { formatSimuladoLabel as formatLabel } from '@/lib/simulado-label';

const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Calendar dates, not elapsed 24-hour periods or browser-local midnights. */
export function getDaysUntil(date: string | null, now: Date): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(now.getTime())) return null;
  const parsed = parseISO(date);
  if (!isValid(parsed)) return null;
  const parts = calendar.formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const [year, month, day] = date.split('-').map(Number);
  const utcDay = (year: number, month: number, day: number) => {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    return date.getTime();
  };
  return (utcDay(year, month, day) - utcDay(value('year'), value('month'), value('day'))) / 86_400_000;
}

export function getNextEdition(editions: readonly ExamEdition[], now: Date): ExamEdition | null {
  const eligible = editions.filter((edition) => edition.status !== 'closed' && edition.status !== 'archived');
  const dated = eligible.filter((edition): edition is ExamEdition & { exam_date: string } => {
    if (edition.exam_date === null) return false;
    const daysUntil = getDaysUntil(edition.exam_date, now);
    return daysUntil !== null && daysUntil >= 0;
  }).sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
  return dated[0] ?? eligible.filter((edition) => !edition.exam_date && ['planned', 'preparing'].includes(edition.status))
    .sort((a, b) => a.year - b.year || (a.term ?? 0) - (b.term ?? 0)
      || (a.code ?? '').localeCompare(b.code ?? '') || a.id.localeCompare(b.id))[0] ?? null;
}

export function resolveUserEdition(
  editions: readonly ExamEdition[], profile: EditionTargetProfile | null | undefined, now: Date,
): ExamEdition | null {
  const byTerm = (a: ExamEdition, b: ExamEdition) => a.year - b.year || (a.term ?? 0) - (b.term ?? 0)
    || (a.code ?? '').localeCompare(b.code ?? '') || a.id.localeCompare(b.id);
  const ordered = [...editions].sort(byTerm);
  const target = profile?.targetEditionId && ordered.find((item) => item.id === profile.targetEditionId);
  if (target) return target;
  const graduation = profile?.expectedGraduationTerm && ordered.find((item) => item.code === profile.expectedGraduationTerm);
  if (graduation) return graduation;
  const eligible = ordered.filter((item) => !['closed', 'archived'].includes(item.status));
  const dated = eligible.filter((item): item is ExamEdition & { exam_date: string } => {
    if (item.exam_date === null) return false;
    const days = getDaysUntil(item.exam_date, now);
    return days !== null && days >= 0;
  }).sort((a, b) => a.exam_date.localeCompare(b.exam_date) || byTerm(a, b));
  return dated[0] ?? eligible.find((item) => item.exam_date === null && ['preparing', 'active'].includes(item.status))
    ?? eligible.find((item) => item.exam_date === null && item.status === 'planned') ?? null;
}

/** Uses the existing strict window/result boundaries; cached status is never authoritative. */
export function selectCurrentSimulado<T extends SimuladoConfig & { userState?: SimuladoUserState }>(
  simulados: readonly T[], edition: Pick<ExamEdition, 'id'> | null | undefined, now: Date,
): T | null {
  if (!edition || !Number.isFinite(now.getTime())) return null;
  const timestamp = (value: string | undefined) => value ? parseISO(value).getTime() : NaN;
  const candidates = simulados.filter((sim) => sim.editionId === edition.id
    && sim.dbStatus !== 'draft' && sim.dbStatus !== 'test'
    && (sim.dbStatus !== 'archived' || sim.userState?.started || sim.userState?.finished))
    .flatMap((sim) => {
      const start = timestamp(sim.executionWindowStart);
      const end = timestamp(sim.executionWindowEnd);
      const release = timestamp(sim.resultsReleaseAt);
      if (![start, end, release].every(Number.isFinite) || start >= end) return [];
      const status = deriveSimuladoStatus(sim, sim.userState, now);
      // An unfinished training attempt can also be resumed, but never before opening.
      const inProgress = sim.userState?.started && !sim.userState.finished && now.getTime() > start;
      const rank = inProgress ? 0 : status === 'available' ? 1 : status === 'upcoming' ? 2
        : status === 'closed_waiting' ? 3 : status === 'completed' ? 4 : 5;
      const attemptAt = timestamp(sim.userState?.startedAt);
      const date = rank === 0 ? -(Number.isFinite(attemptAt) ? attemptAt : start)
        : rank === 1 ? end : rank === 2 ? start : rank === 3 ? release : rank === 4 ? -release : -end;
      return [{ sim, rank, date }];
    });
  candidates.sort((a, b) => a.rank - b.rank || a.date - b.date
    || a.sim.sequenceNumber - b.sim.sequenceNumber || a.sim.id.localeCompare(b.sim.id));
  return candidates[0]?.sim ?? null;
}

export function formatSimuladoLabel(sim: Pick<SimuladoConfig, 'editionCode' | 'sequenceNumber'>): string {
  return formatLabel(sim);
}

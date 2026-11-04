import type { ExamEdition } from '@/types/edition';

const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Calendar dates, not elapsed 24-hour periods or browser-local midnights. */
export function getDaysUntil(date: string | null, now: Date): number | null {
  if (!date) return null;
  const parts = calendar.formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const [year, month, day] = date.split('-').map(Number);
  return (Date.UTC(year, month - 1, day) - Date.UTC(value('year'), value('month') - 1, value('day'))) / 86_400_000;
}

export function getNextEdition(editions: ExamEdition[], now: Date): ExamEdition | null {
  const eligible = editions.filter((edition) => edition.status !== 'closed' && edition.status !== 'archived');
  const dated = eligible.filter((edition): edition is ExamEdition & { exam_date: string } => {
    if (edition.exam_date === null) return false;
    const daysUntil = getDaysUntil(edition.exam_date, now);
    return daysUntil !== null && daysUntil >= 0;
  }).sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.code.localeCompare(b.code));
  return dated[0] ?? eligible.filter((edition) => !edition.exam_date && ['planned', 'preparing'].includes(edition.status))
    .sort((a, b) => a.year - b.year || (a.term ?? 0) - (b.term ?? 0))[0] ?? null;
}

import type { ExamEdition } from '@/types/edition';
import type { CalendarSimulado, EditionCalendar, EditionCalendarEvent } from '@/types/edition-calendar';

function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function instant(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value ?? '')
    || !validDate(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23
    || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return NaN;
  return Date.parse(value);
}

/** Pure projection, not an authorization boundary. Archive metadata stays visible. */
export function buildEditionCalendar(edition: ExamEdition | null, simulados: readonly CalendarSimulado[]): EditionCalendar {
  const result: EditionCalendar = { events: [], errors: [] };
  if (!edition?.id) return result;
  for (const sim of simulados) {
    if (!sim.id?.trim() || sim.editionId !== edition.id || (sim.dbStatus !== 'published' && sim.dbStatus !== 'archived')) continue;
    const start = instant(sim.executionWindowStart);
    const end = instant(sim.executionWindowEnd);
    if (![start, end].every(Number.isFinite) || end <= start) {
      result.errors.push({ simuladoId: sim.id, reason: 'invalid-window' });
      continue;
    }
    const common = { editionId: edition.id, simuladoId: sim.id, allDay: false };
    result.events.push({ ...common, type: 'window', title: sim.title, start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    const release = instant(sim.resultsReleaseAt);
    if (!Number.isFinite(release) || release < end) {
      result.errors.push({ simuladoId: sim.id, reason: Number.isFinite(release) ? 'results-before-window-end' : 'invalid-results' });
    } else {
      result.events.push({ ...common, type: 'results', title: `Resultados: ${sim.title}`, start: new Date(release).toISOString() });
    }
  }
  if (edition.exam_date_confirmed && validDate(edition.exam_date)) {
    const next = new Date(edition.exam_date);
    next.setUTCDate(next.getUTCDate() + 1);
    result.events.push({ editionId: edition.id, simuladoId: null, type: 'official-exam', title: `Prova ${edition.code}`,
      allDay: true, start: edition.exam_date, end: next.toISOString().slice(0, 10) });
  }
  result.events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)
    || (a.simuladoId ?? '').localeCompare(b.simuladoId ?? '') || a.type.localeCompare(b.type));
  return result;
}

// Control characters cannot create content lines; CR/LF become literal TEXT escapes.
// eslint-disable-next-line no-control-regex
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
const compact = (value: string) => value.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const details = 'Calendario da edicao. Horarios de referencia: Brasilia (America/Sao_Paulo).';

/** RFC5545 physical lines include continuation whitespace in the 75-octet limit. */
function fold(line: string): string {
  let output = '';
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const point of line) {
    const size = encoder.encode(point).length;
    if (bytes + size > 75) { output += '\r\n '; bytes = 1; }
    output += point;
    bytes += size;
  }
  return output;
}

function eventDates(event: EditionCalendarEvent): [string, string | undefined] {
  const valid = event.allDay ? validDate(event.start) && validDate(event.end ?? null)
    : Number.isFinite(instant(event.start)) && (!event.end || Number.isFinite(instant(event.end)));
  if (!valid || (event.end && Date.parse(event.end) < Date.parse(event.start))) throw new Error('Invalid calendar event date');
  return [compact(event.allDay ? event.start : new Date(event.start).toISOString()),
    event.end ? compact(event.allDay ? event.end : new Date(event.end).toISOString()) : undefined];
}

export function exportCalendarIcs(events: readonly EditionCalendarEvent[], dtstamp: Date): string {
  if (!Number.isFinite(dtstamp.getTime())) throw new Error('Invalid DTSTAMP');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sanar//Edition Calendar//PT-BR', 'CALSCALE:GREGORIAN'];
  for (const event of events) {
    const [start, end] = eventDates(event);
    const uid = [event.editionId, event.simuladoId ?? 'official', event.type].map(encodeURIComponent).join('/') + '@enamed-arena';
    const parameter = event.allDay ? ';VALUE=DATE' : '';
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${compact(dtstamp.toISOString())}`,
      `DTSTART${parameter}:${start}`, ...(end ? [`DTEND${parameter}:${end}`] : []),
      `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(details)}`, 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

/** Returns a link only; opening it must be a deliberate user action. */
export function googleCalendarUrl(event: EditionCalendarEvent): string {
  const [start, end] = eventDates(event);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.search = new URLSearchParams({ action: 'TEMPLATE', text: event.title, details, dates: `${start}/${end ?? start}` }).toString();
  return url.toString();
}

export function calendarFilename(code: string): string {
  return `calendario-${code.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.\-_]+|[.\-_]+$/g, '').slice(0, 80) || 'edicao'}.ics`;
}

import { describe, expect, it } from 'vitest';
import { buildEditionCalendar, calendarFilename, exportCalendarIcs, googleCalendarUrl } from '@/lib/edition-calendar';
import type { ExamEdition } from '@/types/edition';

const edition = { id: 'e27', code: '2027.2', label: 'ENAMED 2027.2', exam_date: '2027-12-31', exam_date_confirmed: true } as ExamEdition;
const sim = { id: 's1', editionId: 'e27', title: 'Simulado 1', dbStatus: 'published' as const,
  executionWindowStart: '2027-08-01T09:00:00-03:00', executionWindowEnd: '2027-08-03T09:00:00-03:00', resultsReleaseAt: '2027-08-04T12:00:00Z' };
const stamp = new Date('2026-11-04T12:00:00Z');

describe('edition calendar', () => {
  it('accepts exact edition IDs only, hides draft/test, preserves authorized archives and sorts timestamps', () => {
    const result = buildEditionCalendar(edition, [sim, { ...sim, id: 'old', dbStatus: 'archived' },
      { ...sim, id: 'other', editionId: 'e26' }, { ...sim, id: 'draft', dbStatus: 'draft' },
      { ...sim, id: 'test', dbStatus: 'test' }, { ...sim, id: '' }]);
    expect(result.events).toHaveLength(5);
    expect(result.events.map(e => e.type)).toEqual(['window', 'window', 'results', 'results', 'official-exam']);
    expect(result.events[0].start).toBe('2027-08-01T12:00:00.000Z');
  });
  it.each([null, '2027-02-30', '2027-01-01T12:00:00Z'])('does not invent an official event for invalid date %s', date => {
    expect(buildEditionCalendar({ ...edition, exam_date: date }, []).events).toEqual([]);
  });
  it('does not export unconfirmed dates or infer result release before window end', () => {
    const result = buildEditionCalendar({ ...edition, exam_date_confirmed: false }, [{ ...sim, resultsReleaseAt: '2027-08-02T12:00:00Z' }]);
    expect(result.events.map(e => e.type)).toEqual(['window']);
    expect(result.errors).toEqual([{ simuladoId: 's1', reason: 'results-before-window-end' }]);
  });
  it.each(['2027-08-01', 'garbage', '2027-02-30T12:00:00Z', '2027-08-01T24:00:00Z'])('rejects non-instant or invalid window %s', value => {
    const result = buildEditionCalendar(edition, [{ ...sim, executionWindowStart: value }]);
    expect(result.events.map(e => e.type)).toEqual(['official-exam']);
    expect(result.errors[0].reason).toBe('invalid-window');
  });
  it('handles absent metadata, invalid ordering and a missing release without inventing timestamps', () => {
    expect(buildEditionCalendar(null, [sim])).toEqual({ events: [], errors: [] });
    expect(buildEditionCalendar(edition, [{ ...sim, dbStatus: undefined }]).events.map(e => e.type)).toEqual(['official-exam']);
    expect(buildEditionCalendar(edition, [{ ...sim, executionWindowEnd: sim.executionWindowStart }]).errors[0].reason).toBe('invalid-window');
    const result = buildEditionCalendar(edition, [{ ...sim, resultsReleaseAt: '' }]);
    expect(result.events.map(e => e.type)).toEqual(['window', 'official-exam']);
    expect(result.errors[0].reason).toBe('invalid-results');
    expect(buildEditionCalendar(edition, [{ ...sim, resultsReleaseAt: sim.executionWindowEnd }]).errors).toEqual([]);
  });
  it('keeps date-only leap day exports independent of elapsed hours and rejects invalid export dates', () => {
    const events = buildEditionCalendar({ ...edition, exam_date: '2028-02-29' }, []).events;
    expect(exportCalendarIcs(events, stamp)).toContain('DTSTART;VALUE=DATE:20280229\r\nDTEND;VALUE=DATE:20280301');
    expect(() => exportCalendarIcs(events, new Date('invalid'))).toThrow('Invalid DTSTAMP');
    expect(() => googleCalendarUrl({ ...events[0], start: '2027-02-30' })).toThrow('Invalid calendar event date');
  });
  it('creates stable UIDs, UTC windows, date-only exclusive next-day ends, DTSTAMP and CRLF', () => {
    const events = buildEditionCalendar(edition, [sim]).events;
    const ics = exportCalendarIcs(events, stamp);
    expect(ics).toContain('DTSTAMP:20261104T120000Z\r\n');
    expect(ics).toContain('DTSTART:20270801T120000Z\r\nDTEND:20270803T120000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20271231\r\nDTEND;VALUE=DATE:20280101');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(exportCalendarIcs(events, new Date('2026-12-01Z')).match(/UID:.+/g)).toEqual(ics.match(/UID:.+/g));
  });
  it('escapes hostile public titles, folds UTF8 <=75 octets without splitting codepoints and excludes private fields', () => {
    const title = 'á😀'.repeat(60) + '\\,;\r\nBEGIN:VEVENT\rATTENDEE:evil';
    const events = buildEditionCalendar(edition, [{ ...sim, title, internalNotes: 'SECRET', user: 'PRIVATE' } as typeof sim]).events;
    const ics = exportCalendarIcs(events, stamp);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toContain('\ufffd');
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('\\\\\\,\\;\\nBEGIN:VEVENT\\nATTENDEE:evil');
    expect(unfolded.match(/^BEGIN:VEVENT$/gm)).toHaveLength(3);
    expect(ics).not.toMatch(/SECRET|PRIVATE|^ATTENDEE:/m);
  });
  it('creates per-event encoded Google URLs without fabricated end times and safe filenames', () => {
    const events = buildEditionCalendar(edition, [sim]).events;
    const url = new URL(googleCalendarUrl(events[0]));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20270801T120000Z/20270803T120000Z');
    expect(new URL(googleCalendarUrl(events[1])).searchParams.get('dates')).toBe('20270804T120000Z/20270804T120000Z');
    expect(new URL(googleCalendarUrl(events[2])).searchParams.get('dates')).toBe('20271231/20280101');
    expect(calendarFilename('../../2027\r\nBAD')).toBe('calendario-2027-BAD.ics');
  });
});

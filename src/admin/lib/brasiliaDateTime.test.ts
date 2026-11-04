import { describe, expect, it } from 'vitest';
import { brasiliaInputToISO, isoToBrasiliaInput } from './brasiliaDateTime';

describe('Brasilia date time', () => {
  it('roundtrips independently from the browser timezone', () => {
    expect(brasiliaInputToISO('2027-04-12T08:30')).toBe('2027-04-12T11:30:00.000Z');
    expect(isoToBrasiliaInput('2027-04-12T11:30:00Z')).toBe('2027-04-12T08:30');
    expect(isoToBrasiliaInput('2027-04-12T20:30:00+09:00')).toBe('2027-04-12T08:30');
  });
  it.each(['UTC', 'Asia/Tokyo', 'Pacific/Honolulu'])('ignores host timezone %s', zone => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = zone;
      expect(brasiliaInputToISO('2027-01-01T23:00')).toBe('2027-01-02T02:00:00.000Z');
      expect(isoToBrasiliaInput('2027-01-02T02:00:00Z')).toBe('2027-01-01T23:00');
    } finally {
      if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
    }
  });
  it.each(['', '2027-02-30T08:00', '2027-01-01T25:00', 'not a date'])('rejects invalid input %s', value => {
    expect(() => brasiliaInputToISO(value)).toThrow();
  });
  it('rejects nonexistent daylight-saving local times', () => {
    expect(() => brasiliaInputToISO('2018-11-04T00:30')).toThrow();
  });
});

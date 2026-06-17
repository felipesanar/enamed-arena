import { describe, it, expect } from 'vitest';
import { localInputToUtcISO, utcISOToLocalInput, formatWindowSummary } from './timezone';

describe('timezone America/Sao_Paulo (UTC-3, sem DST desde 2019)', () => {
  it('converte input local pra UTC ISO (+3h)', () => {
    expect(localInputToUtcISO('2026-06-20T14:00')).toBe('2026-06-20T17:00:00.000Z');
  });
  it('converte UTC ISO de volta pro input local (-3h)', () => {
    expect(utcISOToLocalInput('2026-06-20T17:00:00.000Z')).toBe('2026-06-20T14:00');
  });
  it('round-trip preserva o valor', () => {
    const local = '2026-12-31T23:30';
    expect(utcISOToLocalInput(localInputToUtcISO(local))).toBe(local);
  });
  it('strings vazias retornam vazio', () => {
    expect(localInputToUtcISO('')).toBe('');
    expect(utcISOToLocalInput('')).toBe('');
  });
  it('summary humano com label de Brasília', () => {
    const s = formatWindowSummary(
      '2026-06-20T17:00:00.000Z', '2026-06-20T19:00:00.000Z', '2026-06-22T12:00:00.000Z',
    );
    expect(s).toContain('horário de Brasília');
    expect(s).toContain('14:00');
    expect(s).toContain('16:00');
  });
});

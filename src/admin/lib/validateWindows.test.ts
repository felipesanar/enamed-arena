import { describe, it, expect } from 'vitest';
import { validateWindows, windowWarnings } from './validateWindows';

describe('validateWindows (erros bloqueantes)', () => {
  it('erro quando fim <= início', () => {
    expect(validateWindows('2026-06-20T17:00:00Z', '2026-06-20T17:00:00Z', '')).toMatch(/terminar/);
  });
  it('erro quando release < fim', () => {
    expect(validateWindows('2026-06-20T17:00:00Z', '2026-06-20T19:00:00Z', '2026-06-20T18:00:00Z')).toMatch(/libera/i);
  });
  it('ok quando coerente', () => {
    expect(validateWindows('2026-06-20T17:00:00Z', '2026-06-20T19:00:00Z', '2026-06-21T12:00:00Z')).toBeNull();
  });
  it('campos vazios não validam', () => {
    expect(validateWindows('', '', '')).toBeNull();
  });
});

describe('windowWarnings (avisos não-bloqueantes)', () => {
  it('avisa janela no passado', () => {
    const w = windowWarnings('2020-01-01T00:00:00Z', '2020-01-01T02:00:00Z', '', 60, '2026-06-17T00:00:00Z');
    expect(w.some((m) => /passado/i.test(m))).toBe(true);
  });
  it('avisa duração maior que a janela', () => {
    const w = windowWarnings('2026-06-20T17:00:00Z', '2026-06-20T18:00:00Z', '', 120, '2026-06-01T00:00:00Z');
    expect(w.some((m) => /duração/i.test(m))).toBe(true);
  });
  it('janela coerente no futuro com duração ok não gera aviso', () => {
    const w = windowWarnings('2026-06-20T17:00:00Z', '2026-06-20T20:00:00Z', '', 120, '2026-06-01T00:00:00Z');
    expect(w).toEqual([]);
  });
  it('campos vazios: sem avisos', () => {
    expect(windowWarnings('', '', '', 60, '2026-06-01T00:00:00Z')).toEqual([]);
  });
});

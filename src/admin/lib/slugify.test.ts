import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('gera slug de título', () => {
    expect(slugify('Simulado ENAMED 2026 — Edição 1')).toBe('simulado-enamed-2026-edicao-1');
  });
  it('remove acentos e colapsa espaços/hífens', () => {
    expect(slugify('  Avaliação   Clínica!! ')).toBe('avaliacao-clinica');
  });
  it('vazio retorna vazio', () => {
    expect(slugify('')).toBe('');
  });
});

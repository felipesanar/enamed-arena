import { describe, it, expect } from 'vitest';
import { parseFindings, buildContents } from '../../../supabase/functions/admin-verify-questions/verifyHelpers';

describe('parseFindings', () => {
  it('força source=ai e mantém checks válidos', () => {
    const raw = JSON.stringify({ findings: [
      { question_number: 3, check_type: 'image_mismatch', slot: 'enunciado', severity: 'error', evidence: 'RX x ECG' },
    ]});
    const out = parseFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('ai');
    expect(out[0].check_type).toBe('image_mismatch');
  });
  it('descarta check_type desconhecido', () => {
    const raw = JSON.stringify({ findings: [
      { question_number: 1, check_type: 'banana', severity: 'error', evidence: 'x' },
    ]});
    expect(parseFindings(raw)).toEqual([]);
  });
  it('json inválido → array vazio', () => {
    expect(parseFindings('not json')).toEqual([]);
  });
});

describe('buildContents', () => {
  it('inclui inline_data para cada imagem', () => {
    const parts = buildContents([
      { question_number: 1, enunciado_text: 'Veja a figura', comentario_text: '', images: [
        { slot: 'enunciado', mime: 'image/jpeg', base64: 'AAAA' },
      ]},
    ]);
    const flat = JSON.stringify(parts);
    expect(flat).toContain('inline_data');
    expect(flat).toContain('AAAA');
    expect(flat).toContain('Q1');
  });
});

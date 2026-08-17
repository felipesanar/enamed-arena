import { describe, it, expect } from 'vitest';
import {
  parseFindings,
  buildContents,
  filterAiFindings,
  type GFinding,
  type GQInput,
} from '../../../supabase/functions/admin-verify-gabarito/gabaritoPrompt';

const q = (over: Partial<GQInput>): GQInput => ({
  question_number: 1,
  enunciado_text: 'Enunciado da questão.',
  comentario_text: 'Comentário da questão.',
  alternativas: [
    { label: 'A', text: 'Opção A' },
    { label: 'B', text: 'Opção B' },
    { label: 'C', text: 'Opção C' },
    { label: 'D', text: 'Opção D' },
  ],
  gabarito: 'B',
  ...over,
});

const finding = (over: Partial<GFinding>): GFinding => ({
  question_number: 1,
  source: 'ai',
  check_type: 'key_semantic_mismatch',
  proposed_label: 'C',
  severity: 'warning',
  evidence: '',
  ...over,
});

describe('parseFindings', () => {
  it('mantém check_type válido e força source=ai', () => {
    const raw = JSON.stringify({
      findings: [
        { question_number: 5, check_type: 'key_semantic_mismatch', proposed_label: 'c', severity: 'error', evidence: 'a alternativa correta é a C' },
      ],
    });
    const out = parseFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('ai');
    expect(out[0].check_type).toBe('key_semantic_mismatch');
    expect(out[0].proposed_label).toBe('C');
    expect(out[0].severity).toBe('error');
  });

  it('descarta check_type fora da whitelist', () => {
    const raw = JSON.stringify({
      findings: [
        { question_number: 1, check_type: 'clinical_merit_opinion', proposed_label: 'C', severity: 'error', evidence: 'x' },
      ],
    });
    expect(parseFindings(raw)).toEqual([]);
  });

  it('json inválido retorna array vazio', () => {
    expect(parseFindings('não é json')).toEqual([]);
  });

  it('findings ausente/não-array retorna array vazio', () => {
    expect(parseFindings(JSON.stringify({}))).toEqual([]);
    expect(parseFindings(JSON.stringify({ findings: 'nope' }))).toEqual([]);
  });
});

describe('filterAiFindings', () => {
  it('descarta proposed_label que não é letra A-D', () => {
    const f = [finding({ proposed_label: 'E' })];
    expect(filterAiFindings(f, q({}))).toEqual([]);
  });

  it('descarta proposed_label vazio', () => {
    const f = [finding({ proposed_label: '' })];
    expect(filterAiFindings(f, q({}))).toEqual([]);
  });

  it('descarta proposed_label igual ao gabarito (achado autocontraditório)', () => {
    const f = [finding({ proposed_label: 'B' })];
    expect(filterAiFindings(f, q({ gabarito: 'B' }))).toEqual([]);
  });

  it('descarta proposed_label que não corresponde a nenhuma alternativa da questão', () => {
    const f = [finding({ proposed_label: 'C' })];
    const questaoComTresAlternativas = q({
      gabarito: 'B',
      alternativas: [
        { label: 'A', text: 'Opção A' },
        { label: 'B', text: 'Opção B' },
      ],
    });
    expect(filterAiFindings(f, questaoComTresAlternativas)).toEqual([]);
  });

  it('mantém achado legítimo: propõe C, gabarito é B, C existe nas alternativas', () => {
    const f = [finding({ proposed_label: 'C' })];
    const out = filterAiFindings(f, q({ gabarito: 'B' }));
    expect(out).toHaveLength(1);
    expect(out[0].proposed_label).toBe('C');
  });

  it('normaliza caixa/espaço do proposed_label e do gabarito antes de comparar', () => {
    const f = [finding({ proposed_label: ' c ' })];
    expect(filterAiFindings(f, q({ gabarito: 'c' }))).toEqual([]);
    const f2 = [finding({ proposed_label: ' c ' })];
    expect(filterAiFindings(f2, q({ gabarito: 'B' }))).toHaveLength(1);
  });
});

describe('buildContents', () => {
  it('inclui enunciado, alternativas com rótulo, gabarito e comentário no texto gerado', () => {
    const parts = buildContents(q({
      question_number: 42,
      enunciado_text: 'Paciente com dor torácica.',
      comentario_text: 'O raciocínio aponta para B.',
      gabarito: 'B',
      alternativas: [
        { label: 'A', text: 'Angina estável' },
        { label: 'B', text: 'Infarto agudo do miocárdio' },
      ],
    }));
    const flat = JSON.stringify(parts);
    expect(flat).toContain('Q42');
    expect(flat).toContain('Paciente com dor torácica.');
    expect(flat).toContain('A) Angina estável');
    expect(flat).toContain('B) Infarto agudo do miocárdio');
    expect(flat).toContain('GABARITO: B');
    expect(flat).toContain('O raciocínio aponta para B.');
  });

  it('não inclui dados de imagem (só texto)', () => {
    const parts = buildContents(q({}));
    const flat = JSON.stringify(parts);
    expect(flat).not.toContain('inline_data');
  });
});

import type { QuestionVerifyFinding } from '@/admin/services/adminApi';

export interface QuestionRow {
  numero: number;
  enunciado: string;
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  gabarito: string;
}

const norm = (s: string): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function validateQuestions(rows: QuestionRow[]): QuestionVerifyFinding[] {
  const findings: QuestionVerifyFinding[] = [];
  const numeroCount = new Map<number, number>();
  const enunciadoMap = new Map<string, number[]>();

  for (const row of rows) {
    const qn = Number.isFinite(row.numero) ? row.numero : 0;

    if (!Number.isFinite(row.numero)) {
      findings.push({
        question_number: 0, source: 'structural', check_type: 'bad_numbering',
        severity: 'error', evidence: 'Questão sem número válido na coluna "numero".',
      });
    } else {
      numeroCount.set(row.numero, (numeroCount.get(row.numero) ?? 0) + 1);
    }

    if (norm(row.enunciado) === '') {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'empty_enunciado',
        severity: 'error', evidence: 'Enunciado vazio.',
      });
    } else {
      const key = norm(row.enunciado);
      const arr = enunciadoMap.get(key) ?? [];
      arr.push(qn);
      enunciadoMap.set(key, arr);
    }

    const opts: Array<[string, string]> = [
      ['A', row.alternativaA], ['B', row.alternativaB],
      ['C', row.alternativaC], ['D', row.alternativaD],
    ];
    const emptyLetters = opts.filter(([, t]) => norm(t) === '').map(([l]) => l);
    if (emptyLetters.length > 0) {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'empty_option',
        severity: 'error', evidence: `Alternativa(s) vazia(s): ${emptyLetters.join(', ')}.`,
      });
    }

    const gab = (row.gabarito ?? '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(gab)) {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'invalid_gabarito',
        severity: 'error', evidence: `Gabarito inválido: "${row.gabarito ?? ''}". Use A, B, C ou D.`,
      });
    }

    const byText = new Map<string, string[]>();
    for (const [letter, text] of opts) {
      const t = norm(text);
      if (t === '') continue;
      const arr = byText.get(t) ?? [];
      arr.push(letter);
      byText.set(t, arr);
    }
    const dupLetters = [...byText.values()].filter((ls) => ls.length > 1).flat();
    if (dupLetters.length > 0) {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'duplicate_options',
        severity: 'warning', evidence: `Alternativas idênticas: ${dupLetters.join(', ')}.`,
      });
    }
  }

  for (const [num, count] of numeroCount) {
    if (count > 1) {
      findings.push({
        question_number: num, source: 'structural', check_type: 'bad_numbering',
        severity: 'warning', evidence: `Número de questão repetido ${count}× (numero=${num}).`,
      });
    }
  }

  for (const nums of enunciadoMap.values()) {
    if (nums.length > 1) {
      for (const n of nums) {
        const others = nums.filter((x) => x !== n);
        findings.push({
          question_number: n, source: 'structural', check_type: 'duplicate_question',
          severity: 'warning', evidence: `Enunciado idêntico ao da(s) questão(ões): ${others.join(', ')}.`,
        });
      }
    }
  }

  return findings;
}

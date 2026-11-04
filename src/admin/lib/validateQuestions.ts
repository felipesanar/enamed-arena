import type { QuestionVerifyFinding } from '@/admin/services/adminApi';
import { checkGabarito } from '@/admin/lib/gabaritoCheck';
import { logger } from '@/lib/logger';
import type { ExamArea } from '@/types/edition';
import type { QuestionImportRow, QuestionImportError } from '@/types/question-import';
import { resolveBlueprintArea } from '@/lib/enamedBlueprint';

/** CSV exported by the template, including quoted separators and line breaks. */
export function parseImportCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  const records: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\n' || char === '\r')) {
      row.push(cell); cell = '';
      if (char !== delimiter) {
        records.push(row); row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else cell += char;
  }
  if (quoted) throw new Error('CSV com aspas não fechadas.');
  if (cell || row.length) { row.push(cell); records.push(row); }
  const headers = records.shift()?.map(h => h.trim()) ?? [];
  if (!headers.length || headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('Cabeçalhos CSV vazios ou repetidos.');
  return records.filter(r => r.some(c => c.trim())).map(r => {
    if (r.length !== headers.length) throw new Error('CSV com número de colunas inconsistente.');
    return Object.fromEntries(headers.map((header, i) => [header, r[i]]));
  });
}

/** Advisory client validation; the RPC revalidates the entire batch under lock. */
export function validateImportRows(rows: QuestionImportRow[], areas: readonly ExamArea[], format: { questions: number; options: number }): QuestionImportError[] {
  const errors: QuestionImportError[] = [];
  const seen = new Set<number>();
  rows.forEach((row, index) => {
    const add = (field: string, message: string) => errors.push({ row: index + 1, question_number: row.question_number, field, message });
    if (!Number.isSafeInteger(row.question_number) || row.question_number < 1 || row.question_number > format.questions || seen.has(row.question_number)) add('question_number', 'Número inválido, repetido ou fora do formato da edição.');
    seen.add(row.question_number);
    if (!row.text?.trim()) add('text', 'Preencha o enunciado.');
    const area = resolveBlueprintArea(row.area, areas);
    if (!area || (row.area_id && row.area_id !== area.id)) add('area', 'Área desconhecida ou ambígua nesta matriz.');
    if (row.options.length !== format.options || row.options.some((o, i) => o.label !== String.fromCharCode(65 + i) || !o.text?.trim() || typeof o.is_correct !== 'boolean') || row.options.filter(o => o.is_correct).length !== 1) add('options', `Use ${format.options} alternativas preenchidas, em ordem, com exatamente uma correta.`);
  });
  if (rows.length > format.questions) errors.push({ row: 1, field: 'rows', message: 'Lote excede o limite da edição.' });
  return errors;
}

export interface QuestionRow {
  numero: number;
  enunciado: string;
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  gabarito: string;
  comentario: string;
}

const norm = (s: string): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function validateQuestions(rows: QuestionRow[]): QuestionVerifyFinding[] {
  const findings: QuestionVerifyFinding[] = [];
  const numeroCount = new Map<number, number>();
  const enunciadoMap = new Map<string, number[]>();
  let unverifiableCount = 0;

  rows.forEach((row, i) => {
    const qn = Number.isFinite(row.numero) ? row.numero : 0;

    if (!Number.isFinite(row.numero)) {
      findings.push({
        question_number: 0, source: 'structural', check_type: 'bad_numbering',
        severity: 'error', evidence: `Questão na linha ${i + 2} da planilha sem número válido (coluna "numero").`,
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

    // Cruzamento gabarito × comentário (ver docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md).
    // Erros (severity: 'error') NÃO entram aqui — quem bloqueia a linha é buildRowIssues,
    // em AdminUploadQuestions.tsx. Aqui só alimentamos o painel informativo com os warnings
    // e agregamos os "key_unverifiable" (info) numa única linha, para não afogar o painel.
    try {
      const gabaritoFindings = checkGabarito({
        questionNumber: qn,
        gabarito: row.gabarito,
        options: opts.map(([label, text]) => ({ label, text })),
        comentario: row.comentario ?? '',
      });

      for (const finding of gabaritoFindings) {
        if (finding.severity === 'error') continue;
        if (finding.checkType === 'key_unverifiable') {
          unverifiableCount += 1;
          continue;
        }
        if (finding.severity === 'warning') {
          findings.push({
            question_number: qn,
            source: 'structural',
            check_type: finding.checkType,
            severity: 'warning',
            evidence: finding.evidence ? `${finding.what} — ${finding.evidence}` : finding.what,
          });
        }
      }
    } catch (err) {
      // A validação estrutural não pode quebrar o upload inteiro por causa de uma
      // linha problemática no cruzamento gabarito × comentário.
      logger.error('[validateQuestions] Falha ao checar gabarito x comentário:', err);
    }
  });

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

  if (unverifiableCount > 0) {
    findings.push({
      question_number: 0,
      source: 'structural',
      check_type: 'key_unverifiable',
      severity: 'warning',
      evidence: `${unverifiableCount} ${unverifiableCount === 1 ? 'questão' : 'questões'} sem marcação "Alternativa X: CORRETA" no comentário — não foi possível conferir o gabarito automaticamente.`,
    });
  }

  return findings;
}

/**
 * Cruzamento gabarito × comentário — módulo PURO.
 *
 * Ver docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md
 *
 * Três gabaritos errados chegaram a produção com a mesma causa: a coluna
 * `Gabarito` da planilha (transcrita da linha "Resposta: Alternativa X" do
 * comentário) divergindo do corpo do comentário, que é o texto que o aluno lê.
 * Este módulo cruza as duas fontes e é consumido tanto pelo import (linhas da
 * planilha) quanto pelo gate de publicação (linhas do banco).
 *
 * O CONTRATO ABAIXO É CONGELADO: outros módulos já constroem contra ele.
 */

export type OptionLabel = 'A' | 'B' | 'C' | 'D';

export interface GabaritoCheckInput {
  questionNumber: number;
  /** Letra apontada como correta pela fonte (coluna Gabarito, ou is_correct no banco). */
  gabarito: string;
  options: Array<{ label: string; text: string }>;
  /** Coluna Comentário / questions.explanation. Pode conter HTML e markdown. */
  comentario: string;
}

export type GabaritoCheckType =
  /** error — comentário marca outra letra como CORRETA (S6 Q49) */
  | 'key_comment_conflict'
  /** error — linha "Resposta:" aponta outra letra */
  | 'key_answer_line_conflict'
  /** error — corpo e linha "Resposta:" discordam entre si (S5 Q35) */
  | 'comment_internal_conflict'
  /** error — mais de uma letra marcada como CORRETA */
  | 'multiple_correct_marked'
  /** warning — parágrafo do comentário casa melhor com outra alternativa (S5 Q46) */
  | 'option_letter_misalignment'
  /** info — comentário sem marcação legível; só entra agregado, nunca por questão */
  | 'key_unverifiable';

export interface GabaritoFinding {
  questionNumber: number;
  checkType: GabaritoCheckType;
  severity: 'error' | 'warning' | 'info';
  /** Letra que a evidência sugere, quando há uma. */
  proposedLabel?: OptionLabel;
  /** Texto curto em pt-BR: o que está errado. */
  what: string;
  /** Texto curto em pt-BR: como corrigir. */
  how: string;
  /** Trecho literal do comentário que sustenta o achado (≤ 200 chars). */
  evidence: string;
}

export interface GabaritoSummary {
  errors: GabaritoFinding[];
  warnings: GabaritoFinding[];
  /** Questões sem marcação verificável — exibido como uma linha, não por questão. */
  unverifiableCount: number;
  /** Números das questões com pelo menos um erro (as que o import barra). */
  blockedQuestionNumbers: number[];
}

// ---------------------------------------------------------------------------
// Helpers exportados (para teste direto)
// ---------------------------------------------------------------------------

const VALID_LABELS: OptionLabel[] = ['A', 'B', 'C', 'D'];

function isOptionLabel(value: string): value is OptionLabel {
  return (VALID_LABELS as string[]).includes(value);
}

/**
 * Remove tags HTML, decodifica entidades comuns, tira marcadores de markdown
 * e normaliza whitespace. Roda antes de qualquer regex de extração — sem
 * isso `<strong>Alternativa C:</strong> CORRETA` não casa.
 */
export function stripMarkup(input: string): string {
  if (!input) return '';
  let text = input;
  text = text.replace(/<[^>]*>/g, ' ');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  text = text.replace(/[*_]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export interface TextRange {
  start: number;
  end: number;
}

export interface CorrectMarking extends TextRange {
  label: OptionLabel;
  evidence: string;
}

const PRIMARY_MARK_SOURCE = 'alternativa\\s+([a-d])\\s*[):\\-–—]?\\s*(?:é\\s+)?(correta|incorreta)';
const VARIANT_MARK_SOURCES = [
  'alternativa\\s+correta\\s*[:\\-]?\\s*([a-d])\\b',
  'gabarito\\s*[:\\-]?\\s*(?:alternativa\\s*|letra\\s*)?([a-d])\\b',
  'resposta\\s+correta\\s*[:\\-]?\\s*(?:alternativa\\s*|letra\\s*)?([a-d])\\b',
];

function execAll(source: string, flags: string, text: string): RegExpExecArray[] {
  const re = new RegExp(source, flags);
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    matches.push(match);
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return matches;
}

/**
 * S1 — conjunto de trechos que marcam uma alternativa como CORRETA.
 * Cobre o marcador padrão (`Alternativa X: CORRETA`) e três variantes
 * (`alternativa correta:`, `gabarito:`, `resposta correta:`).
 */
export function extractCorrectMarkings(text: string): CorrectMarking[] {
  const marks: CorrectMarking[] = [];

  for (const match of execAll(PRIMARY_MARK_SOURCE, 'gi', text)) {
    if (match[2].toLowerCase() === 'correta') {
      marks.push({
        label: match[1].toUpperCase() as OptionLabel,
        start: match.index,
        end: match.index + match[0].length,
        evidence: match[0].trim().slice(0, 200),
      });
    }
  }

  for (const source of VARIANT_MARK_SOURCES) {
    for (const match of execAll(source, 'gi', text)) {
      marks.push({
        label: match[1].toUpperCase() as OptionLabel,
        start: match.index,
        end: match.index + match[0].length,
        evidence: match[0].trim().slice(0, 200),
      });
    }
  }

  marks.sort((a, b) => a.start - b.start);
  return marks;
}

function rangesOverlap(a: TextRange, b: TextRange): boolean {
  return a.start < b.end && b.start < a.end;
}

const ANSWER_LINE_SOURCE = 'resposta\\s*[:\\-]?\\s*(?:alternativa\\s*|letra\\s*)?([a-d])\\b';

export interface AnswerLineMark extends TextRange {
  label: OptionLabel;
  evidence: string;
}

/**
 * S2 — última ocorrência da linha "Resposta: (Alternativa) X", ignorando
 * qualquer trecho já consumido por `extractCorrectMarkings` (S1), senão uma
 * frase como "resposta correta: C" conflita consigo mesma.
 */
export function extractAnswerLine(text: string, excludeRanges: TextRange[] = []): AnswerLineMark | null {
  let last: AnswerLineMark | null = null;
  for (const match of execAll(ANSWER_LINE_SOURCE, 'gi', text)) {
    const range: TextRange = { start: match.index, end: match.index + match[0].length };
    const overlaps = excludeRanges.some((r) => rangesOverlap(range, r));
    if (overlaps) continue;
    last = {
      label: match[1].toUpperCase() as OptionLabel,
      start: range.start,
      end: range.end,
      evidence: match[0].trim().slice(0, 200),
    };
  }
  return last;
}

const LETTER_MARKER_SOURCE = 'alternativa\\s+([a-d])\\b';

/**
 * Fatia o comentário em segmentos por letra: de cada marcador `Alternativa X`
 * até o próximo marcador (ou o fim do texto). Usado por
 * `option_letter_misalignment` para comparar o que o comentário diz sobre
 * cada letra com o texto real das alternativas.
 */
export function segmentByLetter(text: string): Partial<Record<OptionLabel, string>> {
  const markers = execAll(LETTER_MARKER_SOURCE, 'gi', text).map((m) => ({
    label: m[1].toUpperCase() as OptionLabel,
    start: m.index,
  }));

  const segments: Partial<Record<OptionLabel, string>> = {};
  for (let i = 0; i < markers.length; i += 1) {
    const start = markers[i].start;
    const end = i + 1 < markers.length ? markers[i + 1].start : text.length;
    const segment = text.slice(start, end).trim();
    const label = markers[i].label;
    const existing = segments[label];
    if (!existing || segment.length > existing.length) {
      segments[label] = segment;
    }
  }
  return segments;
}

const STOPWORDS = new Set([
  'sobre', 'porque', 'quando', 'entao', 'portanto', 'alternativa', 'alternativas',
  'correta', 'incorreta', 'paciente', 'questao', 'apresenta', 'tambem', 'sendo',
  'assim', 'pode', 'podem', 'deve', 'devem', 'sempre', 'nunca', 'ainda', 'apenas',
  'outro', 'outra', 'entre', 'esta', 'este', 'estao', 'estava', 'foram', 'houve',
  'sido', 'muito', 'pouco', 'onde', 'qual', 'quais', 'desde', 'diante', 'sobre',
  'porem', 'contudo', 'todos', 'todas', 'nesse', 'nessa', 'neste', 'nesta',
  'descreve', 'quadro', 'trata', 'clinica', 'clinico', 'lembrado', 'comum',
  'pratica',
]);

function normalizeForTokens(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function tokenize(text: string): Set<string> {
  const words = normalizeForTokens(text).match(/[a-z]+/g) || [];
  const tokens = new Set<string>();
  for (const word of words) {
    if (word.length >= 5 && !STOPWORDS.has(word)) tokens.add(word);
  }
  return tokens;
}

/**
 * Similaridade assimétrica entre um segmento de comentário (sempre mais
 * longo) e o texto de uma alternativa: `|interseção| / |tokens da
 * alternativa|`. Jaccard simétrico penalizaria demais o segmento por ser
 * mais verboso. Alternativa sem token válido (< 5 chars, tudo stopword)
 * sempre pontua 0 — nunca NaN.
 */
export function scoreSimilarity(segment: string, optionText: string): number {
  const optionTokens = tokenize(optionText);
  if (optionTokens.size === 0) return 0;
  const segmentTokens = tokenize(segment);
  let intersection = 0;
  for (const token of optionTokens) {
    if (segmentTokens.has(token)) intersection += 1;
  }
  return intersection / optionTokens.size;
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

const MISALIGNMENT_MIN_SCORE = 0.34;
const MISALIGNMENT_MIN_MARGIN = 0.25;

function uniqueLabelsInOrder(marks: CorrectMarking[]): OptionLabel[] {
  const labels: OptionLabel[] = [];
  for (const mark of marks) {
    if (!labels.includes(mark.label)) labels.push(mark.label);
  }
  return labels;
}

export function checkGabarito(input: GabaritoCheckInput): GabaritoFinding[] {
  const findings: GabaritoFinding[] = [];
  const { questionNumber, options } = input;

  const rawGabarito = (input.gabarito || '').trim().toUpperCase();
  if (!isOptionLabel(rawGabarito)) {
    // Gabarito estruturalmente inválido já é pego pelas validações
    // estruturais existentes (buildRowIssues / validateQuestions).
    return [];
  }
  const gabarito: OptionLabel = rawGabarito;

  const cleanComment = stripMarkup(input.comentario || '');

  const s1Marks = extractCorrectMarkings(cleanComment);
  const s1Labels = uniqueLabelsInOrder(s1Marks);
  const s2 = extractAnswerLine(
    cleanComment,
    s1Marks.map((m) => ({ start: m.start, end: m.end })),
  );

  const internalConflict = s1Labels.length > 0 && s2 !== null && !s1Labels.includes(s2.label);

  if (internalConflict && s2) {
    const bodyEvidence = s1Marks[0]?.evidence ?? '';
    const evidence = `${bodyEvidence} | ${s2.evidence}`.trim().slice(0, 200);
    findings.push({
      questionNumber,
      checkType: 'comment_internal_conflict',
      severity: 'error',
      what: `O corpo do comentário marca ${s1Labels.join('/')} como CORRETA, mas a linha "Resposta:" aponta ${s2.label}. O comentário se contradiz.`,
      how: 'Releia o comentário original e corrija manualmente qual alternativa é a correta antes de publicar.',
      evidence,
    });
  } else {
    let rule1ProposedLabel: OptionLabel | undefined;

    if (s1Labels.length > 0 && !s1Labels.includes(gabarito)) {
      rule1ProposedLabel = s1Labels[0];
      findings.push({
        questionNumber,
        checkType: 'key_comment_conflict',
        severity: 'error',
        proposedLabel: rule1ProposedLabel,
        what: `O comentário marca a alternativa ${rule1ProposedLabel} como CORRETA, mas o gabarito está registrado como ${gabarito}.`,
        how: `Confirme qual alternativa está certa e corrija o gabarito ou o comentário.`,
        evidence: s1Marks[0]?.evidence ?? '',
      });
    }

    if (s2 && s2.label !== gabarito && s2.label !== rule1ProposedLabel) {
      findings.push({
        questionNumber,
        checkType: 'key_answer_line_conflict',
        severity: 'error',
        proposedLabel: s2.label,
        what: `A linha "Resposta:" do comentário aponta ${s2.label}, mas o gabarito está registrado como ${gabarito}.`,
        how: 'Confirme qual alternativa está certa e corrija o gabarito ou o comentário.',
        evidence: s2.evidence,
      });
    }
  }

  if (s1Labels.length > 1) {
    findings.push({
      questionNumber,
      checkType: 'multiple_correct_marked',
      severity: 'error',
      proposedLabel: s1Labels[0],
      what: `O comentário marca mais de uma alternativa como CORRETA (${s1Labels.join(', ')}).`,
      how: 'Revise o comentário e deixe apenas uma alternativa marcada como correta.',
      evidence: s1Marks.map((m) => m.evidence).join(' | ').slice(0, 200),
    });
  }

  const optionTextByLabel = new Map<OptionLabel, string>();
  for (const option of options) {
    const label = (option.label || '').trim().toUpperCase();
    if (isOptionLabel(label)) optionTextByLabel.set(label, option.text || '');
  }

  const segments = segmentByLetter(cleanComment);
  for (const letter of VALID_LABELS) {
    const segment = segments[letter];
    if (!segment) continue;

    let bestLabel: OptionLabel | null = null;
    let bestScore = -1;
    let ownScore = 0;
    for (const candidate of VALID_LABELS) {
      const optionText = optionTextByLabel.get(candidate);
      if (optionText === undefined) continue;
      const score = scoreSimilarity(segment, optionText);
      if (candidate === letter) ownScore = score;
      if (score > bestScore) {
        bestScore = score;
        bestLabel = candidate;
      }
    }

    if (
      bestLabel &&
      bestLabel !== letter &&
      bestScore >= MISALIGNMENT_MIN_SCORE &&
      bestScore - ownScore >= MISALIGNMENT_MIN_MARGIN
    ) {
      findings.push({
        questionNumber,
        checkType: 'option_letter_misalignment',
        severity: 'warning',
        proposedLabel: bestLabel,
        what: `O parágrafo do comentário sobre a alternativa ${letter} descreve conteúdo mais parecido com o texto da alternativa ${bestLabel}.`,
        how: `Confira se o texto das alternativas ou do comentário foi trocado entre ${letter} e ${bestLabel}.`,
        evidence: segment.slice(0, 200),
      });
    }
  }

  if (s1Labels.length === 0 && !s2) {
    findings.push({
      questionNumber,
      checkType: 'key_unverifiable',
      severity: 'info',
      what: 'O comentário não tem nenhuma marcação de alternativa correta reconhecível.',
      how: 'Revise manualmente se o gabarito está correto.',
      evidence: cleanComment.slice(0, 200),
    });
  }

  return findings;
}

export function summarizeGabaritoFindings(findings: GabaritoFinding[]): GabaritoSummary {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const unverifiableCount = findings.filter(
    (f) => f.severity === 'info' && f.checkType === 'key_unverifiable',
  ).length;
  const blockedQuestionNumbers = Array.from(new Set(errors.map((f) => f.questionNumber))).sort(
    (a, b) => a - b,
  );

  return { errors, warnings, unverifiableCount, blockedQuestionNumbers };
}

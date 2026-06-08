/**
 * cadernoExport.ts — Export do Caderno de Erros em PDF.
 *
 * Função pura client-side `exportNotebookPdf`: gera um PDF de ESTUDO,
 * agrupado por grande área. Cada questão traz o conteúdo completo (sem
 * truncar): enunciado, alternativas com gabarito destacado, explicação
 * oficial, resumo do Prof. San e a anotação do aluno.
 *
 * Opera sobre o array enriquecido devolvido por
 * simuladosApi.getErrorNotebookForExport(userId).
 */

import { getReasonMeta } from '@/lib/errorNotebookReasons';
import {
  COLORS,
  PAGE,
  createPdf,
  drawPremiumHeader,
  addFooterToAllPages,
  checkPageBreak,
  wrapText,
} from '@/lib/pdf/pdfHelpers';

// ---------------------------------------------------------------------------
// Tipo de entrada — enriquecido em getErrorNotebookForExport
// ---------------------------------------------------------------------------

export interface CadernoExportOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface CadernoExportEntry {
  id: string;
  area: string | null;
  theme: string | null;
  question_number: number | null;
  question_text: string | null;
  reason: string;
  learning_text: string | null;
  simulado_title: string | null;
  ai_review_md: string | null;
  created_at: string;
  /** Alternativas da questão, com a correta marcada. Vazio se não disponível. */
  options: CadernoExportOption[];
  /** Label (A/B/C…) da alternativa correta, ou null se desconhecida. */
  correct_label: string | null;
  /** Explicação oficial da questão (pode conter markdown leve). */
  explanation: string | null;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Remove marcadores comuns de markdown para renderização em texto plano. */
function stripMd(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/[*_`>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Agrupa entradas por área, ordenando cada grupo por question_number. */
function groupByArea(entries: CadernoExportEntry[]): Map<string, CadernoExportEntry[]> {
  const map = new Map<string, CadernoExportEntry[]>();
  for (const entry of entries) {
    const key = entry.area ?? 'Sem área';
    const bucket = map.get(key) ?? [];
    bucket.push(entry);
    map.set(key, bucket);
  }
  map.forEach((bucket) => {
    bucket.sort((a, b) => {
      if (a.question_number === null && b.question_number === null) return 0;
      if (a.question_number === null) return 1;
      if (b.question_number === null) return -1;
      return a.question_number - b.question_number;
    });
  });
  return map;
}

/** Converte hex (#rrggbb ou #rgb) para [r, g, b] numéricos. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Gera um PDF de estudo do Caderno de Erros, agrupado por grande área.
 * Cada questão mostra: cabeçalho (Q# · tema · prova), causa do erro + estratégia,
 * enunciado completo, alternativas (gabarito destacado), explicação oficial,
 * resumo do Prof. San e a anotação do aluno.
 * Retorna o Blob e dispara o download no browser.
 */
export function exportNotebookPdf(entries: CadernoExportEntry[]): Blob {
  const doc = createPdf();
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;
  const LINE = 4.4;

  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Cursor vertical compartilhado pelos helpers abaixo.
  let y = drawPremiumHeader(doc, 'Caderno de Erros — SanarFlix PRO', `Exportado em ${today}`);

  // ── Helpers de escrita (mutam `y`) ──
  function writeParagraph(
    text: string,
    opts: {
      fontSize?: number;
      style?: 'normal' | 'bold' | 'italic';
      color?: [number, number, number];
      indent?: number;
      lineH?: number;
    } = {},
  ): void {
    const { fontSize = 8, style = 'normal', color = COLORS.gray700, indent = 0, lineH = LINE } = opts;
    doc.setFont('Helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = wrapText(doc, text, w - indent);
    for (const line of lines) {
      y = checkPageBreak(doc, y, lineH);
      doc.text(line, x + indent, y);
      y += lineH;
    }
  }

  function writeLabel(text: string, color: [number, number, number] = COLORS.gray500): void {
    y = checkPageBreak(doc, y, 7);
    y += 1.5;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...color);
    doc.text(text.toUpperCase(), x, y);
    y += 4.2;
  }

  // ── Sumário ──
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(
    `${entries.length} ${entries.length === 1 ? 'questão' : 'questões'} no caderno de erros`,
    x,
    y,
  );
  y += 8;

  const grouped = groupByArea(entries);

  grouped.forEach((areaEntries, areaName) => {
    // ── Cabeçalho de área ──
    y = checkPageBreak(doc, y, 18);
    doc.setFillColor(...COLORS.wineDark);
    doc.roundedRect(x, y, w, 9, 2, 2, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text(areaName.toUpperCase(), x + 5, y + 6.2);

    const countLabel = `${areaEntries.length} ${areaEntries.length !== 1 ? 'questões' : 'questão'}`;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(countLabel, x + w - 5, y + 6.2, { align: 'right' });
    y += 13;

    areaEntries.forEach((entry, idx) => {
      const reasonMeta = getReasonMeta(entry.reason);

      // Mantém o cabeçalho da questão junto com pelo menos o começo do conteúdo.
      y = checkPageBreak(doc, y, 24);

      // ── Cabeçalho da questão ──
      const qNum = entry.question_number !== null ? `Questão ${entry.question_number}` : 'Questão';
      const headerLine = [qNum, entry.theme].filter(Boolean).join('  ·  ');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.gray900);
      doc.text(headerLine, x, y);
      y += 5;

      if (entry.simulado_title) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.gray500);
        doc.text(`Prova: ${entry.simulado_title}`, x, y);
        y += 4.5;
      }

      // ── Causa do erro (badge) + estratégia ──
      const badgeLabel = `${reasonMeta.badge}: ${reasonMeta.label}`;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.8);
      const badgeW = Math.min(doc.getTextWidth(badgeLabel) + 6, w);
      const [bgR, bgG, bgB] = hexToRgb(reasonMeta.colorBg);
      const [txtR, txtG, txtB] = hexToRgb(reasonMeta.colorText);
      y = checkPageBreak(doc, y, 7);
      doc.setFillColor(bgR, bgG, bgB);
      doc.roundedRect(x, y, badgeW, 5.5, 1, 1, 'F');
      doc.setTextColor(txtR, txtG, txtB);
      doc.text(badgeLabel, x + 3, y + 3.8);
      y += 8;

      // ── Enunciado ──
      if (entry.question_text) {
        writeLabel('Enunciado', COLORS.gray500);
        writeParagraph(entry.question_text, { fontSize: 8, color: COLORS.gray800 });
      }

      // ── Alternativas (com gabarito) ──
      if (entry.options.length > 0) {
        writeLabel('Alternativas', COLORS.gray500);
        for (const opt of entry.options) {
          const prefix = `${opt.label}) `;
          const body = opt.text + (opt.isCorrect ? '   (resposta correta)' : '');
          writeParagraph(prefix + body, {
            fontSize: 8,
            style: opt.isCorrect ? 'bold' : 'normal',
            color: opt.isCorrect ? COLORS.greenDark : COLORS.gray700,
            indent: 2,
          });
        }
      }

      // ── Gabarito (referência rápida) ──
      if (entry.correct_label) {
        y = checkPageBreak(doc, y, 6);
        y += 1;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.greenDark);
        doc.text(`Gabarito: ${entry.correct_label}`, x, y);
        y += 4.5;
      }

      // ── Explicação oficial ──
      if (entry.explanation) {
        writeLabel('Explicação', COLORS.wine);
        writeParagraph(stripMd(entry.explanation), { fontSize: 8, color: COLORS.gray700 });
      }

      // ── Resumo Prof. San ──
      if (entry.ai_review_md) {
        writeLabel('Resumo do Prof. San', COLORS.wine);
        writeParagraph(stripMd(entry.ai_review_md), { fontSize: 8, color: COLORS.gray700 });
      }

      // ── Anotação do aluno ──
      if (entry.learning_text) {
        writeLabel('Sua anotação', COLORS.gray500);
        writeParagraph(entry.learning_text, { fontSize: 8, style: 'italic', color: COLORS.gray600, indent: 2 });
      }

      // Separador entre questões
      const isLast = idx === areaEntries.length - 1;
      y += 2;
      if (!isLast) {
        y = checkPageBreak(doc, y, 5);
        doc.setDrawColor(...COLORS.gray200);
        doc.setLineWidth(0.3);
        doc.line(x, y, x + w, y);
        y += 5;
      }
    });

    y += 6; // gap entre áreas
  });

  addFooterToAllPages(doc);

  const blob = doc.output('blob');
  const filename = `caderno_erros_${slugify(today)}.pdf`;
  saveBlob(blob, filename);
  return blob;
}

/**
 * Generates a "Gabarito Resumido" PDF — lightweight answer key table.
 * 2-5 pages, no images, no explanations.
 */
import { jsPDF } from 'jspdf';
import type { QuestionResult, PerformanceBreakdown } from '@/lib/resultHelpers';
import type { Question } from '@/types';
import {
  COLORS, PAGE, createPdf,
  drawPremiumHeader, drawIdentificationCard, addFooterToAllPages,
  checkPageBreak, scoreColor, scoreBgColor,
} from './pdfHelpers';

export interface GabaritoInput {
  simuladoTitle: string;
  studentName: string;
  questions: Question[];
  breakdown: PerformanceBreakdown;
}

export function generateGabaritoPdf(input: GabaritoInput): Blob {
  const { simuladoTitle, studentName, breakdown } = input;
  const { overall, byArea } = breakdown;
  const doc = createPdf();
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;

  // ─── Header + ID card ───
  let y = drawPremiumHeader(doc, 'Gabarito Resumido', simuladoTitle);
  y = drawIdentificationCard(doc, studentName, {
    correct: overall.totalCorrect,
    total: overall.totalQuestions,
    percentage: overall.percentageScore,
  }, y);

  // ─── Answer Table ───
  y = drawAnswerTable(doc, overall.questionResults, y);

  // ─── Area Breakdown ───
  y = checkPageBreak(doc, y, 60);
  y = drawAreaBreakdown(doc, byArea, y);

  addFooterToAllPages(doc);
  return doc.output('blob');
}

function drawAnswerTable(doc: jsPDF, results: QuestionResult[], startY: number): number {
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;
  let y = startY;

  // Section title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray800);
  doc.text('Gabarito', x, y + 4);
  y += 10;

  // Table header
  const colWidths = [14, 24, 24, 20, w - 82]; // N, Resp, Gab, Status, Tema
  const headers = ['N', 'Resposta', 'Gabarito', 'Status', 'Tema/Area'];

  doc.setFillColor(...COLORS.wineDark);
  doc.rect(x, y, w, 7, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.white);

  let cx = x + 2;
  headers.forEach((h, i) => {
    doc.text(h, cx + 1, y + 5);
    cx += colWidths[i];
  });
  y += 7;

  // Rows
  results.forEach((r, idx) => {
    y = checkPageBreak(doc, y, 7);
    const question = r;
    const rowH = 6.5;
    const isEven = idx % 2 === 0;

    if (isEven) {
      doc.setFillColor(...COLORS.gray50);
      doc.rect(x, y, w, rowH, 'F');
    }

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);

    let rx = x + 2;

    // Number
    doc.setTextColor(...COLORS.gray700);
    doc.text(String(idx + 1), rx + 1, y + 4.5);
    rx += colWidths[0];

    // User answer
    const userLabel = getOptionLabel(r, 'selected');
    doc.setTextColor(...COLORS.gray800);
    doc.text(userLabel || '—', rx + 1, y + 4.5);
    rx += colWidths[1];

    // Correct answer
    const correctLabel = getOptionLabel(r, 'correct');
    doc.setTextColor(...COLORS.gray800);
    doc.text(correctLabel, rx + 1, y + 4.5);
    rx += colWidths[2];

    // Status
    if (r.isCorrect) {
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(rx, y + 1, 14, 4.5, 1, 1, 'F');
      doc.setTextColor(...COLORS.greenDark);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6);
      doc.text('ACERTOU', rx + 1.5, y + 4.2);
    } else if (r.wasAnswered) {
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(rx, y + 1, 14, 4.5, 1, 1, 'F');
      doc.setTextColor(...COLORS.redDark);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6);
      doc.text('ERROU', rx + 2.5, y + 4.2);
    } else {
      doc.setFillColor(...COLORS.gray100);
      doc.roundedRect(rx, y + 1, 14, 4.5, 1, 1, 'F');
      doc.setTextColor(...COLORS.gray500);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6);
      doc.text('BRANCO', rx + 1, y + 4.2);
    }
    rx += colWidths[3];

    // Theme/Area
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.gray600);
    const themeText = `${r.area} — ${r.theme}`;
    const maxThemeW = colWidths[4] - 4;
    const truncated = doc.getTextWidth(themeText) > maxThemeW
      ? themeText.substring(0, Math.floor(themeText.length * (maxThemeW / doc.getTextWidth(themeText)))) + '...'
      : themeText;
    doc.text(truncated, rx + 1, y + 4.5);

    y += rowH;
  });

  return y + 6;
}

function drawAreaBreakdown(
  doc: jsPDF,
  byArea: Array<{ area: string; score: number; correct: number; questions: number }>,
  startY: number,
): number {
  let y = startY;
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray800);
  doc.text('Desempenho por Especialidade', x, y + 4);
  y += 10;

  byArea.forEach(area => {
    y = checkPageBreak(doc, y, 14);

    // Area name + score
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray800);
    doc.text(area.area, x + 2, y + 4);

    const scoreStr = `${area.correct}/${area.questions} (${area.score}%)`;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...scoreColor(area.score));
    doc.text(scoreStr, x + w - 2, y + 4, { align: 'right' });

    y += 7;

    // Progress bar
    doc.setFillColor(...COLORS.gray200);
    doc.roundedRect(x + 2, y, w - 4, 3, 1.5, 1.5, 'F');

    const barW = Math.max(1, ((w - 4) * area.score) / 100);
    const [r, g, b] = scoreColor(area.score);
    doc.setFillColor(r, g, b);
    doc.roundedRect(x + 2, y, barW, 3, 1.5, 1.5, 'F');

    y += 8;
  });

  return y;
}

function getOptionLabel(r: QuestionResult, type: 'selected' | 'correct'): string {
  // We don't have the option labels in QuestionResult, so we use simple letter mapping
  // The option IDs are UUIDs, so we can't derive labels. Return the option letter from the question data.
  // For the gabarito, we'll show "—" for unanswered and use position-based labels.
  if (type === 'selected') {
    return r.wasAnswered ? (r.selectedOptionId ? '●' : '—') : '—';
  }
  return r.correctOptionId ? '●' : '—';
}

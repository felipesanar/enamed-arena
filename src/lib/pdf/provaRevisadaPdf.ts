/**
 * Generates a "Prova Revisada" PDF using jsPDF (browser-friendly).
 *
 * Why jsPDF and not @react-pdf/renderer:
 *   @react-pdf/renderer + remote font registration + 100 questions was
 *   blocking the main thread for many seconds on real devices, causing
 *   the browser's "Página sem resposta" dialog. jsPDF is synchronous and
 *   fast — we yield to the event loop between questions so the UI stays
 *   responsive and the progress indicator updates.
 */
import type { PerformanceBreakdown, QuestionResult } from '@/lib/resultHelpers';
import type { Question } from '@/types';
import type { ExamState } from '@/types/exam';
import {
  COLORS, PAGE, createPdf,
  drawPremiumHeader, drawIdentificationCard, addFooterToAllPages,
  checkPageBreak, scoreColor, wrapText,
} from './pdfHelpers';
import type { jsPDF } from 'jspdf';

export type ProgressStage = 'preparing' | 'loading_images' | 'generating' | 'complete';
export type ProgressCallback = (stage: ProgressStage, current: number, total: number) => void;

export interface ProvaRevisadaInput {
  simuladoTitle: string;
  studentName: string;
  questions: Question[];
  examState: ExamState;
  breakdown: PerformanceBreakdown;
  onProgress?: ProgressCallback;
}

// Yield control to the browser so the UI thread can paint / handle input.
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function generateProvaRevisadaPdf(input: ProvaRevisadaInput): Promise<Blob> {
  const { simuladoTitle, studentName, questions, examState, breakdown, onProgress } = input;
  const { overall, byArea } = breakdown;

  onProgress?.('preparing', 0, 1);
  await yieldToBrowser();

  // ─── Load images (best effort, capped) ───
  const imageMap = new Map<string, string>();
  const questionsWithImages = questions.filter(q => q.imageUrl);
  for (let i = 0; i < questionsWithImages.length; i++) {
    onProgress?.('loading_images', i + 1, questionsWithImages.length);
    try {
      const base64 = await loadImageAsBase64(questionsWithImages[i].imageUrl!);
      if (base64) imageMap.set(questionsWithImages[i].id, base64);
    } catch {
      // Skip failed images — PDF still renders without them.
    }
    // Keep UI responsive between image fetches.
    if (i % 3 === 0) await yieldToBrowser();
  }

  // ─── Generate PDF ───
  onProgress?.('generating', 0, questions.length);
  await yieldToBrowser();

  const doc = createPdf();
  let y = drawPremiumHeader(doc, 'Prova Revisada', simuladoTitle);
  y = drawIdentificationCard(doc, studentName, {
    correct: overall.totalCorrect,
    total: overall.totalQuestions,
    percentage: overall.percentageScore,
  }, y);

  // Per-question blocks
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const result = overall.questionResults[i];
    if (!result) continue;
    y = drawQuestionBlock(doc, q, result, imageMap.get(q.id), y);

    onProgress?.('generating', i + 1, questions.length);
    // Yield every few questions to keep the tab responsive.
    if (i % 4 === 0) await yieldToBrowser();
  }

  // Area breakdown on a fresh page
  doc.addPage();
  y = PAGE.marginTop;
  y = drawAreaBreakdown(doc, byArea, y);

  addFooterToAllPages(doc);

  onProgress?.('complete', questions.length, questions.length);
  await yieldToBrowser();
  return doc.output('blob');
}

// ─── Drawing helpers ───

function drawQuestionBlock(
  doc: jsPDF,
  question: Question,
  result: QuestionResult,
  imageBase64: string | undefined,
  startY: number,
): number {
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;
  let y = checkPageBreak(doc, startY, 30);

  // Header bar
  doc.setFillColor(...COLORS.gray50);
  doc.setDrawColor(...COLORS.gray200);
  doc.roundedRect(x, y, w, 9, 1.5, 1.5, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray800);
  doc.text(`Questao ${question.number}`, x + 3, y + 6);

  const meta = `${question.area} - ${question.theme}`;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray500);
  const metaMaxW = w - 50;
  const metaText = doc.getTextWidth(meta) > metaMaxW
    ? truncateToWidth(doc, meta, metaMaxW) : meta;
  doc.text(metaText, x + 32, y + 6);

  // Status badge
  const badge = result.isCorrect
    ? { bg: [220, 252, 231] as [number, number, number], color: COLORS.greenDark, text: 'ACERTOU' }
    : result.wasAnswered
      ? { bg: [254, 226, 226] as [number, number, number], color: COLORS.redDark, text: 'ERROU' }
      : { bg: [254, 243, 199] as [number, number, number], color: COLORS.amberDark, text: 'BRANCO' };
  const badgeW = 18;
  doc.setFillColor(...badge.bg);
  doc.roundedRect(x + w - badgeW - 2, y + 1.5, badgeW, 6, 1, 1, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...badge.color);
  doc.text(badge.text, x + w - badgeW / 2 - 2, y + 5.5, { align: 'center' });

  y += 12;

  // Question text
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray700);
  const lines = wrapText(doc, question.text ?? '', w - 4);
  for (const line of lines) {
    y = checkPageBreak(doc, y, 5);
    doc.text(line, x + 2, y + 4);
    y += 4.5;
  }
  y += 2;

  // Image (best-effort)
  if (imageBase64) {
    try {
      const imgW = Math.min(w - 20, 110);
      const imgH = 60;
      y = checkPageBreak(doc, y, imgH + 4);
      doc.addImage(imageBase64, 'JPEG', x + (w - imgW) / 2, y, imgW, imgH, undefined, 'FAST');
      y += imgH + 4;
    } catch {
      // Ignore unsupported images
    }
  }

  // Options
  for (const opt of question.options) {
    const isCorrect = opt.id === result.correctOptionId;
    const isUser = opt.id === result.selectedOptionId;
    const isWrong = isUser && !isCorrect;

    const optLines = wrapText(doc, `${opt.label}) ${opt.text}`, w - 14);
    const blockH = optLines.length * 4 + 4;
    y = checkPageBreak(doc, y, blockH + 2);

    let bg: [number, number, number] = [255, 255, 255];
    let border: [number, number, number] = COLORS.gray200;
    let textColor: [number, number, number] = COLORS.gray700;
    if (isCorrect) { bg = [240, 253, 244]; border = COLORS.green; textColor = COLORS.greenDark; }
    else if (isWrong) { bg = [255, 241, 242]; border = COLORS.red; textColor = COLORS.redDark; }

    doc.setFillColor(...bg);
    doc.setDrawColor(...border);
    doc.roundedRect(x, y, w, blockH, 1.5, 1.5, 'FD');

    doc.setFont('Helvetica', isCorrect || isWrong ? 'bold' : 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textColor);
    let ly = y + 4;
    for (const line of optLines) {
      doc.text(line, x + 3, ly);
      ly += 4;
    }
    // Status icon at the right
    if (isCorrect) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.greenDark);
      doc.text('OK', x + w - 8, y + 5);
    } else if (isWrong) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.redDark);
      doc.text('X', x + w - 5, y + 5);
    }
    y += blockH + 1.5;
  }

  // Explanation
  if (question.explanation) {
    const explLines = wrapText(doc, question.explanation, w - 8);
    const explH = explLines.length * 4 + 8;
    y = checkPageBreak(doc, y + 1, explH);
    doc.setFillColor(245, 240, 248);
    doc.setDrawColor(200, 180, 220);
    doc.roundedRect(x, y, w, explH, 2, 2, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.wine);
    doc.text('Comentario do Professor', x + 3, y + 4);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray700);
    let ly = y + 8.5;
    for (const line of explLines) {
      doc.text(line, x + 3, ly);
      ly += 4;
    }
    y += explH + 2;
  }

  // Separator
  doc.setDrawColor(...COLORS.gray200);
  doc.setLineWidth(0.2);
  doc.line(x, y + 2, x + w, y + 2);
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
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.gray800);
  doc.text('Desempenho por Especialidade', x, y + 4);
  y += 10;

  for (const area of byArea) {
    y = checkPageBreak(doc, y, 14);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray800);
    doc.text(area.area, x + 2, y + 4);

    const scoreStr = `${area.correct}/${area.questions} (${area.score}%)`;
    const [r, g, b] = scoreColor(area.score);
    doc.setTextColor(r, g, b);
    doc.text(scoreStr, x + w - 2, y + 4, { align: 'right' });
    y += 7;

    doc.setFillColor(...COLORS.gray200);
    doc.roundedRect(x + 2, y, w - 4, 3, 1.5, 1.5, 'F');
    const barW = Math.max(1, ((w - 4) * area.score) / 100);
    doc.setFillColor(r, g, b);
    doc.roundedRect(x + 2, y, barW, 3, 1.5, 1.5, 'F');
    y += 8;
  }
  return y;
}

function truncateToWidth(doc: jsPDF, text: string, maxW: number): string {
  let t = text;
  while (t.length > 4 && doc.getTextWidth(t + '...') > maxW) t = t.slice(0, -1);
  return t + '...';
}

async function loadImageAsBase64(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Generates a "Prova Revisada" PDF — full exam review with questions,
 * colored alternatives, explanations, and images.
 */
import { jsPDF } from 'jspdf';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import type { Question, QuestionOption } from '@/types';
import type { ExamState } from '@/types/exam';
import {
  COLORS, PAGE, createPdf,
  drawPremiumHeader, drawIdentificationCard, addFooterToAllPages,
  checkPageBreak, wrapText, scoreColor, scoreBgColor,
} from './pdfHelpers';

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

export async function generateProvaRevisadaPdf(input: ProvaRevisadaInput): Promise<Blob> {
  const { simuladoTitle, studentName, questions, examState, breakdown, onProgress } = input;
  const { overall, byArea } = breakdown;

  onProgress?.('preparing', 0, 1);
  const doc = createPdf();

  // ─── Cover Page ───
  drawCoverPage(doc, simuladoTitle, studentName, overall, byArea);

  // ─── Load images ───
  const imageMap = new Map<string, string>();
  const questionsWithImages = questions.filter(q => q.imageUrl);
  for (let i = 0; i < questionsWithImages.length; i++) {
    onProgress?.('loading_images', i + 1, questionsWithImages.length);
    try {
      const base64 = await loadImageAsBase64(questionsWithImages[i].imageUrl!);
      if (base64) {
        imageMap.set(questionsWithImages[i].id, base64);
      }
    } catch {
      // Skip failed images
    }
  }

  // ─── Questions ───
  for (let i = 0; i < questions.length; i++) {
    onProgress?.('generating', i + 1, questions.length);
    const q = questions[i];
    const answer = examState.answers[q.id];
    const result = overall.questionResults[i];
    if (!result) continue;

    doc.addPage();
    let y = PAGE.marginTop;
    y = drawQuestionBlock(doc, q, result, answer, imageMap.get(q.id), y);
  }

  // ─── Analysis Page ───
  doc.addPage();
  drawAnalysisPage(doc, overall, byArea);

  addFooterToAllPages(doc);
  onProgress?.('complete', 1, 1);
  return doc.output('blob');
}

function drawCoverPage(
  doc: jsPDF,
  simuladoTitle: string,
  studentName: string,
  overall: { totalCorrect: number; totalQuestions: number; percentageScore: number; totalAnswered: number },
  byArea: Array<{ area: string; score: number; correct: number; questions: number }>,
) {
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;
  const centerX = PAGE.width / 2;

  // Background
  doc.setFillColor(...COLORS.wineDark);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');

  // Title area
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...COLORS.white);
  doc.text('Prova Revisada', centerX, 60, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(simuladoTitle, centerX, 72, { align: 'center' });

  // Student card
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 15, 90, w - 30, 50, 5, 5, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.gray800);
  doc.text(studentName || 'Aluno', centerX, 104, { align: 'center' });

  // Score circle (simulated)
  const scoreY = 122;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.wine);
  doc.text(`${overall.percentageScore}%`, centerX, scoreY, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(`${overall.totalCorrect} de ${overall.totalQuestions} questoes corretas`, centerX, scoreY + 8, { align: 'center' });

  // Summary stats
  let sy = 160;
  const statBoxW = (w - 30) / 3;

  const stats = [
    { label: 'Acertos', value: String(overall.totalCorrect), color: COLORS.greenDark },
    { label: 'Erros', value: String(overall.totalAnswered - overall.totalCorrect), color: COLORS.redDark },
    { label: 'Em branco', value: String(overall.totalQuestions - overall.totalAnswered), color: COLORS.amberDark },
  ];

  stats.forEach((s, i) => {
    const sx = x + 15 + i * statBoxW;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(sx + 1, sy, statBoxW - 2, 22, 3, 3, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...s.color);
    doc.text(s.value, sx + statBoxW / 2, sy + 10, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray500);
    doc.text(s.label, sx + statBoxW / 2, sy + 17, { align: 'center' });
  });

  // Area bars
  sy = 200;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Desempenho por Especialidade', centerX, sy, { align: 'center' });
  sy += 8;

  byArea.forEach(area => {
    if (sy > 270) return;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x + 15, sy, w - 30, 10, 2, 2, 'F');

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray700);
    doc.text(area.area, x + 18, sy + 4.5);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...scoreColor(area.score));
    doc.text(`${area.score}%`, x + w - 18, sy + 4.5, { align: 'right' });

    // Mini bar
    const barY = sy + 6.5;
    const barW = w - 36;
    doc.setFillColor(...COLORS.gray200);
    doc.roundedRect(x + 18, barY, barW, 2, 1, 1, 'F');
    const fillW = Math.max(0.5, (barW * area.score) / 100);
    const [cr, cg, cb] = scoreColor(area.score);
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(x + 18, barY, fillW, 2, 1, 1, 'F');

    sy += 13;
  });

  // Footer
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    centerX, PAGE.height - 15,
    { align: 'center' },
  );
}

function drawQuestionBlock(
  doc: jsPDF,
  question: Question,
  result: { isCorrect: boolean; wasAnswered: boolean; selectedOptionId: string | null; correctOptionId: string },
  answer: { selectedOption?: string | null; markedForReview?: boolean; highConfidence?: boolean } | undefined,
  imageBase64: string | undefined,
  startY: number,
): number {
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;
  let y = startY;

  // Question header bar
  doc.setFillColor(...COLORS.gray50);
  doc.setDrawColor(...COLORS.gray200);
  doc.roundedRect(x, y, w, 10, 2, 2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray800);
  doc.text(`Questao ${question.number}`, x + 4, y + 6.5);

  // Area/theme badges
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.gray500);
  const meta = `${question.area}  |  ${question.theme}`;
  doc.text(meta, x + 30, y + 6.5);

  // Result badge
  if (result.isCorrect) {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(x + w - 22, y + 2, 18, 6, 2, 2, 'F');
    doc.setTextColor(...COLORS.greenDark);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('ACERTOU', x + w - 20, y + 6.2);
  } else if (result.wasAnswered) {
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(x + w - 22, y + 2, 18, 6, 2, 2, 'F');
    doc.setTextColor(...COLORS.redDark);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('ERROU', x + w - 18.5, y + 6.2);
  } else {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(x + w - 25, y + 2, 21, 6, 2, 2, 'F');
    doc.setTextColor(...COLORS.amberDark);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('EM BRANCO', x + w - 23, y + 6.2);
  }

  y += 14;

  // Question text
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray800);
  const textLines = wrapText(doc, question.text, w - 8);
  textLines.forEach(line => {
    y = checkPageBreak(doc, y, 5);
    doc.text(line, x + 4, y);
    y += 4;
  });
  y += 2;

  // Image
  if (imageBase64) {
    y = checkPageBreak(doc, y, 50);
    try {
      const imgW = Math.min(w - 20, 120);
      doc.addImage(imageBase64, 'JPEG', x + (w - imgW) / 2, y, imgW, 40);
      y += 44;
    } catch {
      // Skip failed image
    }
  }

  // Options
  question.options.forEach(opt => {
    y = checkPageBreak(doc, y, 10);
    const isCorrect = opt.id === result.correctOptionId;
    const isUserSelection = opt.id === result.selectedOptionId;
    const isWrong = isUserSelection && !isCorrect;

    // Option background
    if (isCorrect) {
      doc.setFillColor(220, 252, 231);
      doc.setDrawColor(134, 239, 172);
    } else if (isWrong) {
      doc.setFillColor(254, 226, 226);
      doc.setDrawColor(252, 165, 165);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...COLORS.gray200);
    }

    const optLines = wrapText(doc, opt.text, w - 22);
    const optH = Math.max(8, optLines.length * 3.8 + 4);
    doc.roundedRect(x + 2, y, w - 4, optH, 2, 2, 'FD');

    // Label circle
    const labelBg = isCorrect ? COLORS.greenDark : isWrong ? COLORS.redDark : COLORS.gray400;
    doc.setFillColor(...labelBg);
    doc.circle(x + 8, y + optH / 2, 3, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text(opt.label, x + 8, y + optH / 2 + 1.2, { align: 'center' });

    // Option text
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray800);
    let optTextY = y + 3.5;
    optLines.forEach(line => {
      doc.text(line, x + 14, optTextY);
      optTextY += 3.8;
    });

    // Status icon text
    if (isCorrect) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.greenDark);
      doc.text('✓', x + w - 6, y + optH / 2 + 1, { align: 'right' });
    } else if (isWrong) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.redDark);
      doc.text('✗', x + w - 6, y + optH / 2 + 1, { align: 'right' });
    }

    y += optH + 1.5;
  });

  y += 3;

  // Explanation
  if (question.explanation) {
    y = checkPageBreak(doc, y, 20);

    doc.setFillColor(245, 240, 248); // light purple bg
    doc.setDrawColor(200, 180, 220);
    const explLines = wrapText(doc, question.explanation, w - 16);
    const explH = Math.max(14, explLines.length * 3.8 + 10);
    doc.roundedRect(x + 2, y, w - 4, explH, 3, 3, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.wine);
    doc.text('Comentario do Professor', x + 6, y + 5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.gray700);
    let ey = y + 9;
    explLines.forEach(line => {
      if (ey < y + explH - 2) {
        doc.text(line, x + 6, ey);
      }
      ey += 3.8;
    });

    y += explH + 4;
  }

  return y;
}

function drawAnalysisPage(
  doc: jsPDF,
  overall: { totalCorrect: number; totalQuestions: number; percentageScore: number; totalAnswered: number; totalIncorrect: number; totalUnanswered: number },
  byArea: Array<{ area: string; score: number; correct: number; questions: number }>,
) {
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;
  let y = drawPremiumHeader(doc, 'Analise Estatistica', 'Resumo do seu desempenho');

  // Summary stats
  doc.setFillColor(...COLORS.gray50);
  doc.setDrawColor(...COLORS.gray200);
  doc.roundedRect(x, y, w, 30, 4, 4, 'FD');

  const statsData = [
    { label: 'Total', value: String(overall.totalQuestions), color: COLORS.gray800 },
    { label: 'Respondidas', value: String(overall.totalAnswered), color: COLORS.gray800 },
    { label: 'Acertos', value: String(overall.totalCorrect), color: COLORS.greenDark },
    { label: 'Erros', value: String(overall.totalIncorrect), color: COLORS.redDark },
    { label: 'Em branco', value: String(overall.totalUnanswered), color: COLORS.amberDark },
    { label: 'Score', value: `${overall.percentageScore}%`, color: COLORS.wine },
  ];

  const statW = w / statsData.length;
  statsData.forEach((s, i) => {
    const sx = x + i * statW;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...s.color);
    doc.text(s.value, sx + statW / 2, y + 13, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.gray500);
    doc.text(s.label, sx + statW / 2, y + 20, { align: 'center' });
  });

  y += 38;

  // Area breakdown with horizontal bars
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray800);
  doc.text('Desempenho por Especialidade', x, y + 4);
  y += 10;

  byArea.forEach(area => {
    y = checkPageBreak(doc, y, 14);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray700);
    doc.text(area.area, x + 2, y + 4);

    const scoreStr = `${area.correct}/${area.questions} (${area.score}%)`;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...scoreColor(area.score));
    doc.text(scoreStr, x + w - 2, y + 4, { align: 'right' });

    y += 7;

    // Bar
    doc.setFillColor(...COLORS.gray200);
    doc.roundedRect(x + 2, y, w - 4, 3.5, 1.5, 1.5, 'F');
    const barW = Math.max(1, ((w - 4) * area.score) / 100);
    const [r, g, b] = scoreColor(area.score);
    doc.setFillColor(r, g, b);
    doc.roundedRect(x + 2, y, barW, 3.5, 1.5, 1.5, 'F');

    y += 9;
  });
}

async function loadImageAsBase64(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

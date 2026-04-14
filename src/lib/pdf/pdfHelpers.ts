/**
 * Shared PDF helpers — premium header, footer, identification card, colors.
 * Uses jsPDF directly with Helvetica (built-in, no font loading needed).
 */
import { jsPDF } from 'jspdf';

// ─── Colors ───
export const COLORS = {
  wine: [142, 31, 61] as [number, number, number],
  wineDark: [66, 20, 36] as [number, number, number],
  wineLight: [232, 56, 98] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  greenDark: [22, 101, 52] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  redDark: [153, 27, 27] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  amberDark: [146, 64, 14] as [number, number, number],
  gray50: [249, 250, 251] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray400: [156, 163, 175] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray600: [75, 85, 99] as [number, number, number],
  gray700: [55, 65, 81] as [number, number, number],
  gray800: [31, 41, 55] as [number, number, number],
  gray900: [17, 24, 39] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
};

export const PAGE = {
  marginX: 20,
  marginTop: 20,
  marginBottom: 25,
  width: 210,
  height: 297,
  contentWidth: 170, // 210 - 2*20
};

export function createPdf(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

// ─── Premium Header ───
export function drawPremiumHeader(
  doc: jsPDF,
  title: string,
  subtitle?: string,
  y = PAGE.marginTop,
): number {
  const w = PAGE.contentWidth;
  const x = PAGE.marginX;
  const headerH = subtitle ? 28 : 22;

  // Wine gradient background (simulated with rect)
  doc.setFillColor(...COLORS.wineDark);
  doc.roundedRect(x, y, w, headerH, 4, 4, 'F');

  // Lighter accent stripe
  doc.setFillColor(...COLORS.wine);
  doc.roundedRect(x, y, w * 0.4, headerH, 4, 4, 'F');
  doc.setFillColor(...COLORS.wine);
  doc.rect(x + 10, y, w * 0.4 - 10, headerH, 'F');

  // Title text
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text(title, x + 8, y + (subtitle ? 11 : 14));

  // Subtitle
  if (subtitle) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(subtitle, x + 8, y + 19);
  }

  // Badge
  const badge = 'ENAMED 2026';
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  const badgeW = doc.getTextWidth(badge) + 6;
  const badgeX = x + w - badgeW - 6;
  const badgeY = y + headerH / 2 - 3.5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(badgeX, badgeY, badgeW, 7, 2, 2, 'F');
  doc.setTextColor(...COLORS.wineDark);
  doc.text(badge, badgeX + 3, badgeY + 5);

  return y + headerH + 6;
}

// ─── Identification Card ───
export function drawIdentificationCard(
  doc: jsPDF,
  studentName: string,
  stats: { correct: number; total: number; percentage: number },
  y: number,
): number {
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;
  const h = 22;

  doc.setFillColor(...COLORS.gray50);
  doc.setDrawColor(...COLORS.gray200);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');

  // Student name
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray800);
  doc.text(studentName || 'Aluno', x + 6, y + 8);

  // Date
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray500);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, x + 6, y + 14);

  // Stats on the right
  const statsText = `${stats.correct}/${stats.total}  (${stats.percentage}%)`;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.wine);
  doc.text(statsText, x + w - 6, y + 10, { align: 'right' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray500);
  doc.text('Acertos', x + w - 6, y + 16, { align: 'right' });

  return y + h + 6;
}

// ─── Footer ───
export function addFooterToAllPages(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  const now = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray400);

    doc.text(`ENAMED Arena — ${now}`, PAGE.marginX, PAGE.height - 10);
    doc.text(
      `Pagina ${i} de ${totalPages}`,
      PAGE.width - PAGE.marginX,
      PAGE.height - 10,
      { align: 'right' },
    );

    // Thin line
    doc.setDrawColor(...COLORS.gray200);
    doc.setLineWidth(0.3);
    doc.line(PAGE.marginX, PAGE.height - 14, PAGE.width - PAGE.marginX, PAGE.height - 14);
  }
}

// ─── Helpers ───
export function checkPageBreak(doc: jsPDF, currentY: number, neededH: number): number {
  if (currentY + neededH > PAGE.height - PAGE.marginBottom) {
    doc.addPage();
    return PAGE.marginTop;
  }
  return currentY;
}

/**
 * Wraps text to fit within maxWidth, returns array of lines.
 */
export function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

/**
 * Score color helper.
 */
export function scoreColor(score: number): [number, number, number] {
  if (score >= 70) return COLORS.greenDark;
  if (score >= 50) return COLORS.amberDark;
  return COLORS.redDark;
}

export function scoreBgColor(score: number): [number, number, number] {
  if (score >= 70) return [220, 252, 231]; // green-100
  if (score >= 50) return [254, 243, 199]; // amber-100
  return [254, 226, 226]; // red-100
}

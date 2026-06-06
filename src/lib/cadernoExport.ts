/**
 * cadernoExport.ts — Export do Caderno de Erros (Fase 3).
 *
 * Funções puras client-side:
 *   - exportNotebookPdf   → PDF agrupado por grande área (jsPDF, mesma lib do projeto)
 *   - exportNotebookAnkiCsv → CSV importável no Anki (frente;verso), dispara download
 *
 * Sem dependências de backend. Operam sobre o array retornado por
 * simuladosApi.getErrorNotebook(userId).
 */

import { jsPDF } from 'jspdf';
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
// Tipo de entrada — subconjunto dos campos retornados por getErrorNotebook
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

const MAX_QUESTION_CHARS = 350;
const MAX_LEARNING_CHARS = 200;
const MAX_AI_CHARS = 300;

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
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
  // Sort each bucket by question_number asc (nulls last)
  map.forEach(bucket => {
    bucket.sort((a, b) => {
      if (a.question_number === null && b.question_number === null) return 0;
      if (a.question_number === null) return 1;
      if (b.question_number === null) return -1;
      return a.question_number - b.question_number;
    });
  });
  return map;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Gera um PDF do Caderno de Erros, agrupado por grande área.
 * Cada entrada mostra: Q#, prova, causa do erro (badge+cor), enunciado
 * (truncado), anotação do aluno e resumo do Prof. San (se houver).
 * Cabeçalho: "Caderno de Erros — SanarFlix PRO" + data.
 * Retorna um Blob e também dispara o download no browser.
 */
export function exportNotebookPdf(entries: CadernoExportEntry[]): Blob {
  const doc = createPdf();
  const x = PAGE.marginX;
  const w = PAGE.contentWidth;

  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // ── Cabeçalho premium ──
  let y = drawPremiumHeader(doc, 'Caderno de Erros — SanarFlix PRO', `Exportado em ${today}`);

  // ── Sumário: total de entradas ──
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray500);
  doc.text(`${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'} no caderno`, x, y);
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

    // Contagem no canto direito
    const countLabel = `${areaEntries.length} questão${areaEntries.length !== 1 ? 's' : ''}`;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(countLabel, x + w - 5, y + 6.2, { align: 'right' });

    y += 14;

    areaEntries.forEach((entry, idx) => {
      const reasonMeta = getReasonMeta(entry.reason);
      const isLast = idx === areaEntries.length - 1;

      // Estimate needed height (conservative)
      const questionLines = entry.question_text
        ? wrapText(doc, truncate(entry.question_text, MAX_QUESTION_CHARS), w - 6).length
        : 0;
      const learningLines = entry.learning_text
        ? wrapText(doc, truncate(entry.learning_text, MAX_LEARNING_CHARS), w - 6).length
        : 0;
      const aiLines = entry.ai_review_md
        ? wrapText(doc, truncate(entry.ai_review_md.replace(/[#*_`]/g, ''), MAX_AI_CHARS), w - 6).length
        : 0;
      const estHeight = 10 + questionLines * 4 + (entry.learning_text ? 6 + learningLines * 4 : 0) + (entry.ai_review_md ? 6 + aiLines * 4 : 0) + 6;
      y = checkPageBreak(doc, y, Math.min(estHeight, 80));

      // Card background
      doc.setFillColor(...COLORS.gray50);
      doc.setDrawColor(...COLORS.gray200);
      doc.roundedRect(x, y, w, 3, 1, 1, 'F'); // top accent line placeholder

      // Left color bar (reason color)
      const [rR, rG, rB] = hexToRgb(reasonMeta.colorBase);
      doc.setFillColor(rR, rG, rB);
      doc.roundedRect(x, y, 3, 999, 1, 1, 'F'); // will be clipped by content

      // ── Linha 1: Q# · tema · prova ──
      const cardX = x + 6;
      const cardW = w - 6;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.gray800);

      const qNum = entry.question_number !== null ? `Q${entry.question_number}` : 'Q—';
      const theme = entry.theme ?? '';
      const prova = entry.simulado_title ?? '';
      const headerLine = [qNum, theme, prova].filter(Boolean).join('  ·  ');
      doc.text(truncate(headerLine, 90), cardX, y + 5.5);

      y += 8;

      // ── Causa do erro (badge) ──
      const badgeLabel = `${reasonMeta.badge}: ${reasonMeta.label}`;
      const badgeW = Math.min(doc.getTextWidth(badgeLabel) + 6, cardW - 4);
      const [bgR, bgG, bgB] = hexToRgb(reasonMeta.colorBg);
      const [txtR, txtG, txtB] = hexToRgb(reasonMeta.colorText);
      doc.setFillColor(bgR, bgG, bgB);
      doc.roundedRect(cardX, y, badgeW, 5.5, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(txtR, txtG, txtB);
      doc.text(badgeLabel, cardX + 3, y + 4);
      y += 8;

      // ── Enunciado (truncado) ──
      if (entry.question_text) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.gray700);
        const qText = truncate(entry.question_text, MAX_QUESTION_CHARS);
        const lines = wrapText(doc, qText, cardW - 2);
        lines.forEach(line => {
          y = checkPageBreak(doc, y, 5);
          doc.text(line, cardX, y);
          y += 4;
        });
        y += 2;
      }

      // ── Anotação do aluno ──
      if (entry.learning_text) {
        y = checkPageBreak(doc, y, 8);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.wine);
        doc.text('Anotação:', cardX, y);
        y += 4;

        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.gray600);
        const lText = truncate(entry.learning_text, MAX_LEARNING_CHARS);
        const lLines = wrapText(doc, lText, cardW - 2);
        lLines.forEach(line => {
          y = checkPageBreak(doc, y, 5);
          doc.text(line, cardX + 2, y);
          y += 4;
        });
        y += 2;
      }

      // ── Resumo Prof. San (ai_review_md) ──
      if (entry.ai_review_md) {
        y = checkPageBreak(doc, y, 8);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.gray500);
        doc.text('Resumo Prof. San:', cardX, y);
        y += 4;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.gray600);
        // Strip common markdown markers for plain PDF rendering
        const aiText = truncate(
          entry.ai_review_md.replace(/#{1,6}\s/g, '').replace(/[*_`]/g, '').replace(/\n{2,}/g, '\n'),
          MAX_AI_CHARS,
        );
        const aiLines = wrapText(doc, aiText, cardW - 2);
        aiLines.forEach(line => {
          y = checkPageBreak(doc, y, 5);
          doc.text(line, cardX + 2, y);
          y += 4;
        });
        y += 2;
      }

      // Separator
      if (!isLast) {
        y = checkPageBreak(doc, y, 4);
        doc.setDrawColor(...COLORS.gray200);
        doc.setLineWidth(0.3);
        doc.line(x + 3, y, x + w, y);
        y += 5;
      } else {
        y += 4;
      }
    });

    y += 4; // gap between areas
  });

  addFooterToAllPages(doc);

  const blob = doc.output('blob');
  const filename = `caderno_erros_${slugify(today)}.pdf`;
  saveBlob(blob, filename);
  return blob;
}

// ---------------------------------------------------------------------------
// Anki CSV
// ---------------------------------------------------------------------------

/**
 * Gera um arquivo CSV (separador `;`) importável no Anki.
 * Colunas: Frente (pergunta/tema) ; Verso (gabarito/resumo).
 * Dispara o download do arquivo `.csv` no browser.
 */
export function exportNotebookAnkiCsv(entries: CadernoExportEntry[]): void {
  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const header = `#separator:Semicolon\n#html:false\n#notetype:Basic\n#deck:Caderno de Erros SanarFlix PRO - ${today}\n#columns:Frente;Verso\n`;

  const rows: string[] = entries.map(entry => {
    const reasonMeta = getReasonMeta(entry.reason);
    const areaTheme = [entry.area, entry.theme].filter(Boolean).join(' › ');
    const qNum = entry.question_number !== null ? `Q${entry.question_number} — ` : '';
    const prova = entry.simulado_title ? ` [${entry.simulado_title}]` : '';

    // Frente: contexto + enunciado (ou fallback para área/tema)
    const frontParts: string[] = [];
    frontParts.push(`${qNum}${areaTheme}${prova}`);
    if (entry.question_text) {
      frontParts.push(truncate(entry.question_text, MAX_QUESTION_CHARS));
    }
    const front = frontParts.join('\n');

    // Verso: causa do erro + anotação + resumo Prof. San
    const backParts: string[] = [];
    backParts.push(`Causa: ${reasonMeta.label} (${reasonMeta.badge})`);
    backParts.push(`Estratégia: ${reasonMeta.strategy}`);

    if (entry.learning_text) {
      backParts.push(`\nAnotação do aluno:\n${truncate(entry.learning_text, MAX_LEARNING_CHARS)}`);
    }

    if (entry.ai_review_md) {
      const aiClean = entry.ai_review_md
        .replace(/#{1,6}\s/g, '')
        .replace(/[*_`]/g, '')
        .replace(/\n{2,}/g, '\n')
        .trim();
      backParts.push(`\nResumo Prof. San:\n${truncate(aiClean, MAX_AI_CHARS)}`);
    }

    const back = backParts.join('\n');

    return `${escapeCsvField(front)};${escapeCsvField(back)}`;
  });

  const csv = header + rows.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `caderno_erros_anki_${slugify(today)}.csv`;
  saveBlob(blob, filename);
}

// ---------------------------------------------------------------------------
// Utilitários internos
// ---------------------------------------------------------------------------

/** Escapa campo CSV: envolve em aspas duplas se contiver ; ou \n ou " */
function escapeCsvField(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

/**
 * generate-exam-pdf
 *
 * Generates a beautifully designed PDF for offline exam download.
 *
 * Flow:
 *  1. Check Supabase Storage for cached PDF (exam-pdfs/{simulado_id}.pdf)
 *  2. If cached → return signed URL immediately
 *  3. If not cached → fetch questions, generate PDF with pdf-lib, store, return URL
 *
 * PDF Design (approved):
 *  - Header: dark wine bg, logo left, exam info right
 *  - Body: 2-column layout, 4 questions per page (2 per column)
 *  - Question number: wine accent
 *  - Option letters: circle with wine border
 *  - Footer: exam info + page number
 *  - No area/theme tags on questions
 *  - No option E (A/B/C/D only)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PDFDocument,
  PDFFont,
  rgb,
  StandardFonts,
  PageSizes,
} from "https://esm.sh/pdf-lib@1.17.1";

// ─── Config ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "exam-pdfs";
const SIGNED_URL_EXPIRY = 3600; // 1 hour

// Brand colors (wine palette)
const WINE_DARK  = rgb(0.35, 0.07, 0.19);   // hsl(345,70%,22%) header bg
const WINE_MID   = rgb(0.42, 0.11, 0.24);   // accent question number
const WINE_LIGHT = rgb(0.55, 0.16, 0.30);   // option circles
const BLACK      = rgb(0, 0, 0);
const WHITE      = rgb(1, 1, 1);
const GRAY_LIGHT = rgb(0.92, 0.92, 0.92);
const GRAY_MID   = rgb(0.55, 0.55, 0.55);

// ─── Supabase admin client ────────────────────────────────────────────────────

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimuladoRow {
  id: string;
  title: string;
  slug: string;
  sequence_number: number;
  questions_count: number;
  duration_minutes: number;
}

interface QuestionRow {
  id: string;
  question_number: number;
  text: string;
}

interface OptionRow {
  question_id: string;
  label: string;
  text: string;
}

interface Question {
  number: number;
  text: string;
  options: Array<{ label: string; text: string }>;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generatePdf(
  simulado: SimuladoRow,
  questions: Question[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold     = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageW = PageSizes.A4[0];
  const pageH = PageSizes.A4[1];

  const marginX   = 40;
  const marginTop = 60;
  const marginBot = 50;
  const headerH   = 72;

  const colGap    = 20;
  const colW      = (pageW - marginX * 2 - colGap) / 2;

  const durationH = Math.round(simulado.duration_minutes / 60);
  const examLabel = `${simulado.title} · ${simulado.questions_count} questões · ${durationH}h`;
  const footerLabel = `${simulado.title} · SanarFlix PRO · Modo Offline · Uso exclusivo do candidato`;

  // ─── Cover page ─────────────────────────────────────────────────────────────

  const coverPage = pdfDoc.addPage(PageSizes.A4);

  drawHeader(coverPage, pageW, headerH, fontBold, fontRegular, examLabel);

  let cy = pageH - headerH - 60;

  // Cover title
  coverPage.drawText("PROVA OFFLINE", {
    x: marginX,
    y: cy,
    size: 28,
    font: fontBold,
    color: WINE_DARK,
  });
  cy -= 24;

  coverPage.drawText(simulado.title, {
    x: marginX,
    y: cy,
    size: 16,
    font: fontRegular,
    color: BLACK,
  });
  cy -= 40;

  // Instructions
  const instructions = [
    `• Esta prova contém ${simulado.questions_count} questões de múltipla escolha (A, B, C ou D).`,
    `• Tempo disponível: ${durationH} hora${durationH > 1 ? "s" : ""}.`,
    "• Leia cada questão com atenção antes de marcar sua resposta.",
    "• Utilize a folha de respostas ao final ou o gabarito digital na plataforma.",
    "• Para entrar no ranking, envie o gabarito digital dentro do tempo de prova.",
    "• Acesse o gabarito digital em: sanarflix.com.br/simulados/" + simulado.slug + "/gabarito",
  ];

  for (const line of instructions) {
    const wrapped = wrapText(line, fontRegular, 12, pageW - marginX * 2);
    for (const l of wrapped) {
      coverPage.drawText(l, { x: marginX, y: cy, size: 12, font: fontRegular, color: BLACK });
      cy -= 18;
    }
    cy -= 4;
  }

  drawFooter(coverPage, pageW, marginBot, fontRegular, footerLabel, "Capa");

  // ─── Question pages ──────────────────────────────────────────────────────────

  // 2 questions per column, 4 per page
  const questionsPerPage = 4;
  const totalPages = Math.ceil(questions.length / questionsPerPage);

  let pageNumber = 1;

  for (let p = 0; p < questions.length; p += questionsPerPage) {
    const page = pdfDoc.addPage(PageSizes.A4);
    drawHeader(page, pageW, headerH, fontBold, fontRegular, examLabel);
    drawFooter(
      page,
      pageW,
      marginBot,
      fontRegular,
      footerLabel,
      `Página ${pageNumber} de ${totalPages}`,
    );
    pageNumber++;

    const pageQuestions = questions.slice(p, p + questionsPerPage);
    const leftQs  = pageQuestions.slice(0, 2);
    const rightQs = pageQuestions.slice(2, 4);

    const colTop = pageH - headerH - marginTop;

    renderColumn(page, leftQs,  marginX,                 colTop, colW, fontBold, fontRegular, fontOblique);
    renderColumn(page, rightQs, marginX + colW + colGap, colTop, colW, fontBold, fontRegular, fontOblique);
  }

  // ─── Answer sheet page ───────────────────────────────────────────────────────

  const answerPage = pdfDoc.addPage(PageSizes.A4);
  drawHeader(answerPage, pageW, headerH, fontBold, fontRegular, examLabel);
  drawFooter(answerPage, pageW, marginBot, fontRegular, footerLabel, "Folha de Respostas");

  let ay = pageH - headerH - 40;
  answerPage.drawText("FOLHA DE RESPOSTAS", {
    x: marginX,
    y: ay,
    size: 14,
    font: fontBold,
    color: WINE_DARK,
  });
  ay -= 30;

  // Two columns of answer bubbles
  const ansHalf = Math.ceil(questions.length / 2);
  const leftAns  = questions.slice(0, ansHalf);
  const rightAns = questions.slice(ansHalf);

  renderAnswerColumn(answerPage, leftAns,  marginX,                 ay, colW, fontRegular, fontBold);
  renderAnswerColumn(answerPage, rightAns, marginX + colW + colGap, ay, colW, fontRegular, fontBold);

  return pdfDoc.save();
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  pageW: number,
  headerH: number,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  examLabel: string,
): void {
  const pageH = page.getHeight();

  // Header background
  page.drawRectangle({
    x: 0,
    y: pageH - headerH,
    width: pageW,
    height: headerH,
    color: WINE_DARK,
  });

  // Logo text (left)
  page.drawText("SanarFlix PRO", {
    x: 24,
    y: pageH - headerH + 26,
    size: 14,
    font: fontBold,
    color: WHITE,
  });
  page.drawText("ENAMED", {
    x: 24,
    y: pageH - headerH + 10,
    size: 10,
    font: fontRegular,
    color: rgb(1, 0.75, 0.8),
  });

  // Exam info (right)
  const labelW = fontRegular.widthOfTextAtSize(examLabel, 10);
  page.drawText(examLabel, {
    x: pageW - 24 - labelW,
    y: pageH - headerH + 30,
    size: 10,
    font: fontRegular,
    color: rgb(1, 0.85, 0.9),
  });
}

function drawFooter(
  page: ReturnType<PDFDocument["addPage"]>,
  pageW: number,
  marginBot: number,
  fontRegular: PDFFont,
  leftText: string,
  rightText: string,
): void {
  const y = marginBot - 16;

  // Separator line
  page.drawLine({
    start: { x: 40, y: y + 18 },
    end:   { x: pageW - 40, y: y + 18 },
    thickness: 0.5,
    color: GRAY_LIGHT,
  });

  page.drawText(leftText, {
    x: 40,
    y,
    size: 7,
    font: fontRegular,
    color: GRAY_MID,
  });

  const rightW = fontRegular.widthOfTextAtSize(rightText, 7);
  page.drawText(rightText, {
    x: pageW - 40 - rightW,
    y,
    size: 7,
    font: fontRegular,
    color: GRAY_MID,
  });
}

function renderColumn(
  page: ReturnType<PDFDocument["addPage"]>,
  qs: Question[],
  x: number,
  topY: number,
  colW: number,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  _fontOblique: PDFFont,
): void {
  let y = topY;
  const maxTextW = colW - 8;

  for (const q of qs) {
    // Question number
    page.drawText(`Questão ${q.number}`, {
      x,
      y,
      size: 9,
      font: fontBold,
      color: WINE_MID,
    });
    y -= 14;

    // Question text
    const textLines = wrapText(q.text, fontRegular, 9, maxTextW);
    for (const line of textLines) {
      page.drawText(line, { x, y, size: 9, font: fontRegular, color: BLACK });
      y -= 13;
    }
    y -= 4;

    // Options
    for (const opt of q.options) {
      const circle_x = x + 8;
      const circle_y = y + 4;

      // Option circle
      page.drawCircle({
        x: circle_x,
        y: circle_y,
        size: 6,
        borderColor: WINE_LIGHT,
        borderWidth: 1,
        color: WHITE,
      });
      page.drawText(opt.label, {
        x: circle_x - 3,
        y: circle_y - 3.5,
        size: 7,
        font: fontBold,
        color: WINE_LIGHT,
      });

      // Option text
      const optLines = wrapText(opt.text, fontRegular, 8, maxTextW - 20);
      let oy = y;
      for (const line of optLines) {
        page.drawText(line, { x: x + 22, y: oy, size: 8, font: fontRegular, color: BLACK });
        oy -= 11;
      }
      y = oy - 2;
    }

    y -= 16; // spacing between questions
  }
}

function renderAnswerColumn(
  page: ReturnType<PDFDocument["addPage"]>,
  qs: Question[],
  x: number,
  topY: number,
  _colW: number,
  fontRegular: typeof StandardFonts.Helvetica,
  fontBold: typeof StandardFonts.HelveticaBold,
): void {
  let y = topY;

  for (const q of qs) {
    // Question number
    page.drawText(`${q.number}.`, {
      x,
      y,
      size: 9,
      font: fontBold,
      color: BLACK,
    });

    // A B C D circles
    const labels = ["A", "B", "C", "D"];
    let cx = x + 24;
    for (const label of labels) {
      page.drawCircle({
        x: cx + 6,
        y: y + 4,
        size: 7,
        borderColor: GRAY_MID,
        borderWidth: 0.8,
        color: WHITE,
      });
      page.drawText(label, {
        x: cx + 3,
        y: y,
        size: 7,
        font: fontRegular,
        color: GRAY_MID,
      });
      cx += 20;
    }

    y -= 16;
  }
}

// ─── Text wrap ────────────────────────────────────────────────────────────────

function wrapText(
  text: string,
  font: typeof StandardFonts.Helvetica,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { simulado_id } = await req.json();

    if (!simulado_id) {
      return new Response(
        JSON.stringify({ error: "simulado_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = getAdminClient();
    const pdfPath  = `${simulado_id}.pdf`;

    // ── Check cache ──────────────────────────────────────────────────────────
    const { data: existing } = await supabase.storage
      .from(BUCKET)
      .list("", { search: pdfPath });

    if (existing?.some(f => f.name === pdfPath)) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(pdfPath, SIGNED_URL_EXPIRY);

      if (signedError) throw signedError;

      return new Response(
        JSON.stringify({ url: signedData.signedUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch simulado ────────────────────────────────────────────────────────
    const { data: simuladoRow, error: simErr } = await supabase
      .from("simulados")
      .select("id, title, slug, sequence_number, questions_count, duration_minutes")
      .eq("id", simulado_id)
      .single();

    if (simErr || !simuladoRow) {
      throw new Error("Simulado not found");
    }

    // ── Fetch questions + options ─────────────────────────────────────────────
    const { data: questionRows, error: qErr } = await supabase
      .from("questions")
      .select("id, question_number, text")
      .eq("simulado_id", simulado_id)
      .order("question_number", { ascending: true })
      .limit(300);

    if (qErr || !questionRows) throw qErr ?? new Error("Failed to load questions");

    const questionIds = (questionRows as QuestionRow[]).map(q => q.id);

    const { data: optionRows, error: optErr } = await supabase
      .from("question_options")
      .select("question_id, label, text")
      .in("question_id", questionIds)
      .in("label", ["A", "B", "C", "D"]);

    if (optErr) throw optErr;

    const questions: Question[] = (questionRows as QuestionRow[]).map(q => ({
      number: q.question_number,
      text:   q.text,
      options: ((optionRows as OptionRow[]) ?? [])
        .filter(o => o.question_id === q.id)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(o => ({ label: o.label, text: o.text })),
    }));

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const pdfBytes = await generatePdf(simuladoRow as SimuladoRow, questions);

    // ── Upload to Storage ─────────────────────────────────────────────────────
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // ── Return signed URL ─────────────────────────────────────────────────────
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(pdfPath, SIGNED_URL_EXPIRY);

    if (signedError) throw signedError;

    return new Response(
      JSON.stringify({ url: signedData.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-exam-pdf]", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

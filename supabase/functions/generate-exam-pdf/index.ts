/**
 * generate-exam-pdf — Optimized for Edge Function CPU limits
 *
 * Key optimizations vs original:
 *  1. Character-width cache for text wrapping (avoids O(n) widthOfTextAtSize per test)
 *  2. No image embedding (too CPU-heavy; images shown online only)
 *  3. Simplified option rendering (no circles — text-only "A)" format)
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "exam-pdfs";
const SIGNED_URL_EXPIRY = 3600;

const WINE_DARK  = rgb(0.35, 0.07, 0.19);
const WINE_MID   = rgb(0.42, 0.11, 0.24);
const BLACK      = rgb(0, 0, 0);
const WHITE      = rgb(1, 1, 1);
const GRAY_LIGHT = rgb(0.92, 0.92, 0.92);
const GRAY_MID   = rgb(0.55, 0.55, 0.55);

// ─── Text sanitization ───────────────────────────────────────────────────────

function sanitizeForWinAnsi(text: string): string {
  let out = text;
  // Subscript/superscript digits
  const subs = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
  const sups = "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079";
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(subs[i], String(i));
    out = out.replaceAll(sups[i], String(i));
  }
  out = out
    .replaceAll("\u2013", "-").replaceAll("\u2014", "-")
    .replaceAll("\u2018", "'").replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"').replaceAll("\u201D", '"')
    .replaceAll("\u2026", "...").replaceAll("\u2022", "-")
    .replaceAll("\u00A0", " ");
  // deno-lint-ignore no-control-regex
  out = out.replace(/[^\x00-\xFF]/g, "?");
  return out;
}

// ─── Fast text wrapping with cached char widths ──────────────────────────────

class FontMetrics {
  private cache = new Map<number, Map<number, number>>();

  constructor(private font: PDFFont) {}

  private getCharWidths(size: number): Map<number, number> {
    let m = this.cache.get(size);
    if (m) return m;
    m = new Map();
    // Pre-compute widths for printable ASCII + Latin-1
    for (let c = 32; c <= 255; c++) {
      try {
        m.set(c, this.font.widthOfTextAtSize(String.fromCharCode(c), size));
      } catch {
        m.set(c, this.font.widthOfTextAtSize("?", size));
      }
    }
    this.cache.set(size, m);
    return m;
  }

  textWidth(text: string, size: number): number {
    const widths = this.getCharWidths(size);
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      w += widths.get(code) ?? widths.get(63)!; // '?' fallback
    }
    return w;
  }

  wrap(text: string, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = sanitizeForWinAnsi(text).split(/\r?\n/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) { lines.push(""); continue; }
      const words = trimmed.split(/\s+/);
      let current = "";
      let currentW = 0;
      const spaceW = this.textWidth(" ", size);
      for (const word of words) {
        const wordW = this.textWidth(word, size);
        const testW = current ? currentW + spaceW + wordW : wordW;
        if (testW <= maxWidth) {
          current = current ? `${current} ${word}` : word;
          currentW = testW;
        } else {
          if (current) lines.push(current);
          current = word;
          currentW = wordW;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SimuladoRow {
  id: string; title: string; slug: string;
  sequence_number: number; questions_count: number; duration_minutes: number;
}
interface QuestionRow {
  id: string; question_number: number; text: string; image_url: string | null;
}
interface OptionRow {
  question_id: string; label: string; text: string;
}
interface Question {
  number: number; text: string;
  options: Array<{ label: string; text: string }>;
}

// ─── PDF generation (optimized) ──────────────────────────────────────────────

async function generatePdf(simulado: SimuladoRow, questions: Question[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const metricsRegular = new FontMetrics(fontRegular);
  const metricsBold    = new FontMetrics(fontBold);

  const [pageW, pageH] = PageSizes.A4;
  const marginX = 40, marginBot = 50, headerH = 72;
  const colGap = 20;
  const colW = (pageW - marginX * 2 - colGap) / 2;
  const maxTextW = colW - 8;

  const durationH = Math.round(simulado.duration_minutes / 60);
  const examLabel = sanitizeForWinAnsi(`${simulado.title} - ${simulado.questions_count} questoes - ${durationH}h`);
  const footerLabel = sanitizeForWinAnsi(`${simulado.title} - SanarFlix PRO - Modo Offline`);

  // ── Helper: draw header ──
  const drawHeader = (page: ReturnType<typeof pdfDoc.addPage>) => {
    const pH = page.getHeight();
    page.drawRectangle({ x: 0, y: pH - headerH, width: pageW, height: headerH, color: WINE_DARK });
    page.drawText("SanarFlix PRO", { x: 24, y: pH - headerH + 26, size: 14, font: fontBold, color: WHITE });
    page.drawText("ENAMED", { x: 24, y: pH - headerH + 10, size: 10, font: fontRegular, color: rgb(1, 0.75, 0.8) });
    const lw = metricsRegular.textWidth(examLabel, 10);
    page.drawText(examLabel, { x: pageW - 24 - lw, y: pH - headerH + 30, size: 10, font: fontRegular, color: rgb(1, 0.85, 0.9) });
  };

  // ── Helper: draw footer ──
  const drawFooter = (page: ReturnType<typeof pdfDoc.addPage>, rightText: string) => {
    const y = marginBot - 16;
    page.drawLine({ start: { x: 40, y: y + 18 }, end: { x: pageW - 40, y: y + 18 }, thickness: 0.5, color: GRAY_LIGHT });
    page.drawText(footerLabel, { x: 40, y, size: 7, font: fontRegular, color: GRAY_MID });
    const rw = metricsRegular.textWidth(rightText, 7);
    page.drawText(rightText, { x: pageW - 40 - rw, y, size: 7, font: fontRegular, color: GRAY_MID });
  };

  // ── Cover page ──
  const cover = pdfDoc.addPage(PageSizes.A4);
  drawHeader(cover);
  let cy = pageH - headerH - 60;
  cover.drawText("PROVA OFFLINE", { x: marginX, y: cy, size: 28, font: fontBold, color: WINE_DARK });
  cy -= 24;
  cover.drawText(sanitizeForWinAnsi(simulado.title), { x: marginX, y: cy, size: 16, font: fontRegular, color: BLACK });
  cy -= 40;
  const instructions = [
    `Esta prova contem ${simulado.questions_count} questoes de multipla escolha (A, B, C ou D).`,
    `Tempo disponivel: ${durationH} hora${durationH > 1 ? "s" : ""}.`,
    "Leia cada questao com atencao antes de marcar sua resposta.",
    "Utilize a folha de respostas ao final ou o gabarito digital na plataforma.",
  ];
  for (const line of instructions) {
    const wrapped = metricsRegular.wrap("- " + line, 12, pageW - marginX * 2);
    for (const l of wrapped) {
      cover.drawText(l, { x: marginX, y: cy, size: 12, font: fontRegular, color: BLACK });
      cy -= 18;
    }
    cy -= 4;
  }
  drawFooter(cover, "Capa");

  // ── Pre-compute question layout to assign to pages ──
  // Measure each question height to pack them into columns dynamically
  const colTop = pageH - headerH - 60;
  const colBottom = marginBot + 20;
  const colHeight = colTop - colBottom;

  // Measure a question's height
  function measureQuestion(q: Question): number {
    let h = 14; // question number line
    h += metricsRegular.wrap(q.text, 9, maxTextW).length * 13 + 4;
    for (const opt of q.options) {
      const optLines = metricsRegular.wrap(`${opt.label}) ${opt.text}`, 8, maxTextW - 12);
      h += optLines.length * 11 + 2;
    }
    h += 12; // spacing
    return h;
  }

  // Pack questions into pages with 2 columns
  type PageLayout = { left: Question[]; right: Question[] };
  const pages: PageLayout[] = [];
  let curPage: PageLayout = { left: [], right: [] };
  let leftH = 0, rightH = 0;

  for (const q of questions) {
    const qh = measureQuestion(q);
    // Try left column first
    if (leftH + qh <= colHeight) {
      curPage.left.push(q);
      leftH += qh;
    } else if (rightH + qh <= colHeight) {
      curPage.right.push(q);
      rightH += qh;
    } else {
      // New page
      pages.push(curPage);
      curPage = { left: [q], right: [] };
      leftH = qh;
      rightH = 0;
    }
  }
  if (curPage.left.length || curPage.right.length) pages.push(curPage);

  // ── Render question pages ──
  for (let i = 0; i < pages.length; i++) {
    const page = pdfDoc.addPage(PageSizes.A4);
    drawHeader(page);
    drawFooter(page, `Pagina ${i + 1} de ${pages.length}`);

    renderColumn(page, pages[i].left, marginX, colTop, maxTextW, fontBold, fontRegular, metricsRegular);
    renderColumn(page, pages[i].right, marginX + colW + colGap, colTop, maxTextW, fontBold, fontRegular, metricsRegular);
  }

  // ── Answer sheet ──
  const ansPage = pdfDoc.addPage(PageSizes.A4);
  drawHeader(ansPage);
  drawFooter(ansPage, "Folha de Respostas");
  let ay = pageH - headerH - 40;
  ansPage.drawText("FOLHA DE RESPOSTAS", { x: marginX, y: ay, size: 14, font: fontBold, color: WINE_DARK });
  ay -= 30;
  const ansHalf = Math.ceil(questions.length / 2);
  renderAnswerCol(ansPage, questions.slice(0, ansHalf), marginX, ay, fontRegular, fontBold);
  renderAnswerCol(ansPage, questions.slice(ansHalf), marginX + colW + colGap, ay, fontRegular, fontBold);

  return pdfDoc.save();
}

function renderColumn(
  page: ReturnType<PDFDocument["addPage"]>,
  qs: Question[], x: number, topY: number, maxTextW: number,
  fontBold: PDFFont, fontRegular: PDFFont, metrics: FontMetrics,
): void {
  let y = topY;
  for (const q of qs) {
    page.drawText(`Questao ${q.number}`, { x, y, size: 9, font: fontBold, color: WINE_MID });
    y -= 14;
    for (const line of metrics.wrap(q.text, 9, maxTextW)) {
      page.drawText(line, { x, y, size: 9, font: fontRegular, color: BLACK });
      y -= 13;
    }
    y -= 4;
    for (const opt of q.options) {
      const optLines = metrics.wrap(`${opt.label}) ${opt.text}`, 8, maxTextW - 12);
      for (const line of optLines) {
        page.drawText(line, { x: x + 12, y, size: 8, font: fontRegular, color: BLACK });
        y -= 11;
      }
      y -= 2;
    }
    y -= 12;
  }
}

function renderAnswerCol(
  page: ReturnType<PDFDocument["addPage"]>,
  qs: Question[], x: number, topY: number,
  fontRegular: PDFFont, fontBold: PDFFont,
): void {
  let y = topY;
  const labels = ["A", "B", "C", "D"];
  for (const q of qs) {
    page.drawText(`${q.number}.`, { x, y, size: 9, font: fontBold, color: BLACK });
    let cx = x + 24;
    for (const label of labels) {
      page.drawCircle({ x: cx + 6, y: y + 4, size: 7, borderColor: GRAY_MID, borderWidth: 0.8, color: WHITE });
      page.drawText(label, { x: cx + 3, y, size: 7, font: fontRegular, color: GRAY_MID });
      cx += 20;
    }
    y -= 16;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

function getAdminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { simulado_id } = await req.json();
    if (!simulado_id) {
      return new Response(JSON.stringify({ error: "simulado_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = getAdminClient();

    // Cache check with updated_at-based path
    const { data: simMeta, error: simMetaErr } = await supabase.from("simulados").select("updated_at").eq("id", simulado_id).single();
    if (simMetaErr || !simMeta) {
      return new Response(JSON.stringify({ error: "Simulado not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pdfPath = `${simulado_id}_${new Date(simMeta.updated_at).getTime()}.pdf`;

    const { data: existing } = await supabase.storage.from(BUCKET).list("", { search: pdfPath });
    if (existing?.some(f => f.name === pdfPath)) {
      const { data: signedData, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_EXPIRY);
      if (signedError) throw signedError;
      return new Response(JSON.stringify({ url: signedData.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch simulado
    const { data: simuladoRow, error: simErr } = await supabase
      .from("simulados")
      .select("id, title, slug, sequence_number, questions_count, duration_minutes")
      .eq("id", simulado_id).single();
    if (simErr || !simuladoRow) throw new Error("Simulado not found");

    // Fetch questions + options
    const { data: questionRows, error: qErr } = await supabase
      .from("questions").select("id, question_number, text, image_url")
      .eq("simulado_id", simulado_id).order("question_number", { ascending: true }).limit(300);
    if (qErr || !questionRows) throw qErr ?? new Error("Failed to load questions");

    const questionIds = (questionRows as QuestionRow[]).map(q => q.id);
    const { data: optionRows, error: optErr } = await supabase
      .from("question_options").select("question_id, label, text")
      .in("question_id", questionIds).in("label", ["A", "B", "C", "D"]);
    if (optErr) throw optErr;

    const questions: Question[] = (questionRows as QuestionRow[]).map(q => ({
      number: q.question_number,
      text: q.text,
      options: ((optionRows as OptionRow[]) ?? [])
        .filter(o => o.question_id === q.id)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(o => ({ label: o.label, text: o.text })),
    }));

    // Generate PDF
    const pdfBytes = await generatePdf(simuladoRow as SimuladoRow, questions);

    // Upload
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { data: signedData, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_EXPIRY);
    if (signedError) throw signedError;

    return new Response(JSON.stringify({ url: signedData.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[generate-exam-pdf]", err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

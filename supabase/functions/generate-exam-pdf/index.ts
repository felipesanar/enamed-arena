/**
 * generate-exam-pdf — Optimized for Edge Function CPU limits
 *
 * Includes image embedding with safeguards (timeout, max count, size limit).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PDFDocument,
  PDFFont,
  PDFImage,
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
const MAX_IMAGES = 30;
const IMAGE_FETCH_TIMEOUT = 8000;
const MAX_IMAGE_BYTES = 800_000;

const WINE_DARK  = rgb(0.35, 0.07, 0.19);
const WINE_MID   = rgb(0.42, 0.11, 0.24);
const WINE_LIGHT = rgb(0.55, 0.18, 0.30);
const BLACK      = rgb(0, 0, 0);
const WHITE      = rgb(1, 1, 1);
const GRAY_LIGHT = rgb(0.92, 0.92, 0.92);
const GRAY_MID   = rgb(0.55, 0.55, 0.55);
const GRAY_BG    = rgb(0.96, 0.96, 0.96);

// ─── Embedded white logo icon (40x40 PNG, base64) ────────────────────────────
const LOGO_ICON_B64 = "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAClklEQVR42u2YPY/TQBCG33FyoaBAF1EgjoITEoKCjgaJhgLRUvAPaO73UCJBTXdHASeOipor0HV8CCokkA5BARLg2A/NLFpFibPr2JAiK1kbJ/b6yey8M+MxAK3wKLTiYw247Bj2sGbtRyEJPwaSbBUAA1jR8Nt/A6zcUh8k3Zf0yte/JmlH0titmWdJuhmlz/vA5oxnXABeAzVQ5SysDuGeAiccaAMY+BG+u+5w/xQwhhs5SDHDgoXPR359MuQyYWbiPrYv6bakEijMrJ5xrQEm6W0kmF7jYIB7EuAk2Rw4ScLMkHQ6APcpkt8+P3Zfs2adiLZ3C/juQqn78sEAtwcME+AMKICR3wMw6UskQRC7KXAOOPR5x+/9laviIiMIDyXtSbrj500+9zd7uDiOJH2UNHK/r7v0wUkUhAcplpvznDFwE3ieE2oWAQaH/gac8QcNWsDZ1PmjVH9UovV228JNCWbDP28CX1IUvWirwuvAO7/W2gKaGWZWAgMz+yropa9XLxOoA9BWgiCSWf3PHk8ZoRVgKDpvACclVSHELAGI/9nzSVklQ8UPmhw/0Q9DXLwE/EzxwdRAXUVVyy3gVC5kEJgL5DA11ORkknix98DF1JgYwY2BlzlxMCfgFp5BSknbks55hWKL4MysAsaSDiRd9Wqo6KOaCf54LyUuzrFc2VexEJz5kyu60Qe7gMvd4srnAzP74VtHwrY+i7Y1+y2yTUV93JRVuoTLBQxAl+dllQZBDJdJO6ntt3BdKemKmb3xN7mw9YXn2k4s11bFIXYdAmdnrLUdBeFsQcwaORaMLWmSPkt66C0OucXueosjtEE6qSzadFibGkG1OmzrtfWPUOVUkXhCm63TnmNbC647rGvArsYf0++ijBVDzBAAAAAASUVORK5CYII=";

// ─── Text sanitization ───────────────────────────────────────────────────────

function sanitizeForWinAnsi(text: string): string {
  let out = text;
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
      w += widths.get(code) ?? widths.get(63)!;
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
  image?: { pdfImage: PDFImage; width: number; height: number };
}

// ─── Image fetching ──────────────────────────────────────────────────────────

async function fetchImageWithTimeout(url: string): Promise<Uint8Array | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function embedImage(pdfDoc: PDFDocument, bytes: Uint8Array, url: string): Promise<PDFImage | null> {
  try {
    const lower = url.toLowerCase();
    if (lower.includes(".png")) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    try { return await pdfDoc.embedPng(bytes); } catch { /* ignore */ }
    try { return await pdfDoc.embedJpg(bytes); } catch { /* ignore */ }
    return null;
  }
}

// ─── Base64 decode helper ────────────────────────────────────────────────────

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ─── PDF generation ──────────────────────────────────────────────────────────

async function generatePdf(simulado: SimuladoRow, questions: Question[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const metricsRegular = new FontMetrics(fontRegular);

  const [pageW, pageH] = PageSizes.A4;
  const marginX = 40, marginBot = 50, headerH = 72;
  const colGap = 20;
  const colW = (pageW - marginX * 2 - colGap) / 2;
  const maxTextW = colW - 8;
  const maxImgW = maxTextW - 4;

  const durationH = Math.round(simulado.duration_minutes / 60);
  const examLabel = sanitizeForWinAnsi(`${simulado.title} \u00B7 ${simulado.questions_count} quest\u00F5es \u00B7 ${durationH}h`);
  const footerLabel = sanitizeForWinAnsi(`${simulado.title} \u00B7 SanarFlix PRO \u00B7 Modo Offline`);

  // Embed logo icon
  const logoBytes = base64ToUint8Array(LOGO_ICON_B64);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const drawHeader = (page: ReturnType<typeof pdfDoc.addPage>) => {
    const pH = page.getHeight();
    page.drawRectangle({ x: 0, y: pH - headerH, width: pageW, height: headerH, color: WINE_DARK });
    // Logo icon
    page.drawImage(logoImage, { x: 20, y: pH - headerH + 18, width: 36, height: 36 });
    // Brand text next to icon
    page.drawText("SanarFlix PRO", { x: 62, y: pH - headerH + 30, size: 13, font: fontBold, color: WHITE });
    page.drawText("ENAMED", { x: 62, y: pH - headerH + 14, size: 9, font: fontRegular, color: rgb(1, 0.75, 0.8) });
    // Exam label right-aligned
    const lw = metricsRegular.textWidth(examLabel, 9);
    page.drawText(examLabel, { x: pageW - 24 - lw, y: pH - headerH + 30, size: 9, font: fontRegular, color: rgb(1, 0.85, 0.9) });
  };

  const drawFooter = (page: ReturnType<typeof pdfDoc.addPage>, rightText: string) => {
    const y = marginBot - 16;
    page.drawLine({ start: { x: 40, y: y + 18 }, end: { x: pageW - 40, y: y + 18 }, thickness: 0.5, color: GRAY_LIGHT });
    page.drawText(footerLabel, { x: 40, y, size: 7, font: fontRegular, color: GRAY_MID });
    const rw = metricsRegular.textWidth(rightText, 7);
    page.drawText(rightText, { x: pageW - 40 - rw, y, size: 7, font: fontRegular, color: GRAY_MID });
  };

  // ── Cover page (redesigned) ──
  drawCoverPage(pdfDoc, simulado, durationH, fontRegular, fontBold, metricsRegular, logoImage, drawHeader, drawFooter);

  // ── Layout: measure and pack into columns ──
  const colTop = pageH - headerH - 60;
  const colBottom = marginBot + 20;
  const colHeight = colTop - colBottom;

  function measureQuestion(q: Question): number {
    let h = 14;
    h += metricsRegular.wrap(q.text, 9, maxTextW).length * 13 + 4;
    if (q.image) {
      const scale = Math.min(maxImgW / q.image.width, 1);
      const imgH = q.image.height * scale;
      h += imgH + 8;
    }
    for (const opt of q.options) {
      const optLines = metricsRegular.wrap(`${opt.label}) ${opt.text}`, 8, maxTextW - 12);
      h += optLines.length * 11 + 2;
    }
    h += 12;
    return h;
  }

  type PageLayout = { left: Question[]; right: Question[] };
  const pages: PageLayout[] = [];
  let curPage: PageLayout = { left: [], right: [] };
  let leftH = 0, rightH = 0;

  for (const q of questions) {
    const qh = measureQuestion(q);
    if (leftH + qh <= colHeight) {
      curPage.left.push(q);
      leftH += qh;
    } else if (rightH + qh <= colHeight) {
      curPage.right.push(q);
      rightH += qh;
    } else {
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
    drawFooter(page, `P\u00E1gina ${i + 1} de ${pages.length}`);

    renderColumn(page, pages[i].left, marginX, colTop, maxTextW, maxImgW, fontBold, fontRegular, metricsRegular);
    renderColumn(page, pages[i].right, marginX + colW + colGap, colTop, maxTextW, maxImgW, fontBold, fontRegular, metricsRegular);
  }

  return pdfDoc.save();
}

// ─── Cover Page (redesigned) ─────────────────────────────────────────────────

function drawCoverPage(
  pdfDoc: PDFDocument,
  simulado: SimuladoRow,
  durationH: number,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  metrics: FontMetrics,
  logoImage: PDFImage,
  drawHeader: (page: any) => void,
  drawFooter: (page: any, text: string) => void,
) {
  const [pageW, pageH] = PageSizes.A4;
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  const cover = pdfDoc.addPage(PageSizes.A4);

  drawHeader(cover);

  let cy = pageH - 72 - 40; // below header

  // ── Title block with wine background ──
  const titleBlockH = 90;
  cover.drawRectangle({
    x: marginX - 8,
    y: cy - titleBlockH + 10,
    width: contentW + 16,
    height: titleBlockH,
    color: WINE_DARK,
    borderColor: WINE_MID,
    borderWidth: 1,
  });

  // "PROVA OFFLINE" large
  cover.drawText("PROVA OFFLINE", {
    x: marginX + 8,
    y: cy - 10,
    size: 26,
    font: fontBold,
    color: WHITE,
  });

  // Simulado title
  const titleText = sanitizeForWinAnsi(simulado.title);
  cover.drawText(titleText, {
    x: marginX + 8,
    y: cy - 38,
    size: 14,
    font: fontRegular,
    color: rgb(1, 0.85, 0.9),
  });

  // Subtitle
  cover.drawText("Modo Offline \u00B7 Gabarito Digital", {
    x: marginX + 8,
    y: cy - 58,
    size: 10,
    font: fontRegular,
    color: rgb(1, 0.7, 0.78),
  });

  cy -= titleBlockH + 24;

  // ── Info cards row ──
  const cardW = (contentW - 16) / 3;
  const cardH = 60;
  const infoCards = [
    { label: "Quest\u00F5es", value: `${simulado.questions_count}`, sub: "M\u00FAltipla escolha" },
    { label: "Dura\u00E7\u00E3o", value: `${durationH}h`, sub: `${simulado.duration_minutes} minutos` },
    { label: "Alternativas", value: "A - D", sub: "4 op\u00E7\u00F5es por quest\u00E3o" },
  ];

  for (let i = 0; i < 3; i++) {
    const cx = marginX + i * (cardW + 8);
    // Card background
    cover.drawRectangle({
      x: cx,
      y: cy - cardH,
      width: cardW,
      height: cardH,
      color: GRAY_BG,
      borderColor: GRAY_LIGHT,
      borderWidth: 0.5,
    });
    // Label
    cover.drawText(sanitizeForWinAnsi(infoCards[i].label), {
      x: cx + 10,
      y: cy - 16,
      size: 8,
      font: fontRegular,
      color: GRAY_MID,
    });
    // Value
    cover.drawText(sanitizeForWinAnsi(infoCards[i].value), {
      x: cx + 10,
      y: cy - 32,
      size: 16,
      font: fontBold,
      color: WINE_DARK,
    });
    // Sub
    cover.drawText(sanitizeForWinAnsi(infoCards[i].sub), {
      x: cx + 10,
      y: cy - 48,
      size: 7,
      font: fontRegular,
      color: GRAY_MID,
    });
  }

  cy -= cardH + 30;

  // ── "Como funciona" section ──
  cover.drawText("COMO FUNCIONA", {
    x: marginX,
    y: cy,
    size: 12,
    font: fontBold,
    color: WINE_DARK,
  });

  // Decorative line under title
  cover.drawLine({
    start: { x: marginX, y: cy - 6 },
    end: { x: marginX + 130, y: cy - 6 },
    thickness: 2,
    color: WINE_MID,
  });

  cy -= 28;

  const steps = [
    { num: "1", text: "Imprima esta prova e resolva no papel" },
    { num: "2", text: "Volte \u00E0 plataforma SanarFlix PRO" },
    { num: "3", text: "Preencha o gabarito digital na plataforma" },
    { num: "4", text: "Envie dentro do tempo para entrar no ranking" },
  ];

  for (const step of steps) {
    // Number circle
    const circleR = 10;
    cover.drawCircle({
      x: marginX + circleR,
      y: cy - 2,
      size: circleR,
      color: WINE_DARK,
    });
    cover.drawText(step.num, {
      x: marginX + circleR - 3,
      y: cy - 6,
      size: 10,
      font: fontBold,
      color: WHITE,
    });
    // Step text
    cover.drawText(sanitizeForWinAnsi(step.text), {
      x: marginX + circleR * 2 + 12,
      y: cy - 6,
      size: 11,
      font: fontRegular,
      color: BLACK,
    });
    cy -= 30;
  }

  cy -= 10;

  // ── "Regras importantes" section ──
  const rulesBoxH = 110;
  // Box background
  cover.drawRectangle({
    x: marginX - 4,
    y: cy - rulesBoxH,
    width: contentW + 8,
    height: rulesBoxH,
    color: rgb(0.98, 0.94, 0.95), // very light wine tint
    borderColor: WINE_LIGHT,
    borderWidth: 1,
  });

  // Section title inside box
  cover.drawText("REGRAS IMPORTANTES", {
    x: marginX + 8,
    y: cy - 18,
    size: 10,
    font: fontBold,
    color: WINE_DARK,
  });

  const rules = [
    "O tempo de prova come\u00E7a no momento do download.",
    "Envie o gabarito dentro do prazo para participar do ranking.",
    "Quest\u00F5es n\u00E3o respondidas ser\u00E3o registradas como em branco.",
  ];

  let ry = cy - 38;
  for (const rule of rules) {
    // Bullet diamond
    cover.drawText("\u00B7", {
      x: marginX + 12,
      y: ry,
      size: 14,
      font: fontBold,
      color: WINE_MID,
    });
    cover.drawText(sanitizeForWinAnsi(rule), {
      x: marginX + 26,
      y: ry,
      size: 10,
      font: fontRegular,
      color: BLACK,
    });
    ry -= 22;
  }

  drawFooter(cover, "Capa");
}

// ─── Render column ───────────────────────────────────────────────────────────

function renderColumn(
  page: ReturnType<PDFDocument["addPage"]>,
  qs: Question[], x: number, topY: number, maxTextW: number, maxImgW: number,
  fontBold: PDFFont, fontRegular: PDFFont, metrics: FontMetrics,
): void {
  let y = topY;
  for (const q of qs) {
    page.drawText(`Quest\u00E3o ${q.number}`, { x, y, size: 9, font: fontBold, color: WINE_MID });
    y -= 14;
    for (const line of metrics.wrap(q.text, 9, maxTextW)) {
      page.drawText(line, { x, y, size: 9, font: fontRegular, color: BLACK });
      y -= 13;
    }
    y -= 4;

    // Draw image if present
    if (q.image) {
      const scale = Math.min(maxImgW / q.image.width, 1);
      const drawW = q.image.width * scale;
      const drawH = q.image.height * scale;
      y -= drawH;
      page.drawImage(q.image.pdfImage, { x: x + 2, y, width: drawW, height: drawH });
      y -= 8;
    }

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

    const { simulado_id, force } = await req.json();
    if (!simulado_id) {
      return new Response(JSON.stringify({ error: "simulado_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = getAdminClient();

    // Cache check
    const { data: simMeta, error: simMetaErr } = await supabase.from("simulados").select("updated_at").eq("id", simulado_id).single();
    if (simMetaErr || !simMeta) {
      return new Response(JSON.stringify({ error: "Simulado not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pdfPath = `${simulado_id}_${new Date(simMeta.updated_at).getTime()}.pdf`;

    const forceRegenerate = force === true;
    if (!forceRegenerate) {
      const { data: existing } = await supabase.storage.from(BUCKET).list("", { search: pdfPath });
      if (existing?.some(f => f.name === pdfPath)) {
        const { data: signedData, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_EXPIRY);
        if (signedError) throw signedError;
        return new Response(JSON.stringify({ url: signedData.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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

    // Build questions array
    const questions: Question[] = (questionRows as QuestionRow[]).map(q => ({
      number: q.question_number,
      text: q.text,
      options: ((optionRows as OptionRow[]) ?? [])
        .filter(o => o.question_id === q.id)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(o => ({ label: o.label, text: o.text })),
    }));

    // Generate PDF with image embedding inside
    const pdfDoc = await PDFDocument.create();

    // Fetch and embed images
    const qRows = questionRows as QuestionRow[];
    const imageQuestions = qRows.filter(q => q.image_url).slice(0, MAX_IMAGES);
    if (imageQuestions.length > 0) {
      console.log(`[generate-exam-pdf] Fetching ${imageQuestions.length} images...`);
      const imageResults = await Promise.allSettled(
        imageQuestions.map(async (q) => {
          const bytes = await fetchImageWithTimeout(q.image_url!);
          if (!bytes) return null;
          return { questionId: q.id, bytes, url: q.image_url! };
        })
      );

      const successfulImages: Array<{ questionId: string; bytes: Uint8Array; url: string }> = [];
      for (const r of imageResults) {
        if (r.status === 'fulfilled' && r.value) {
          successfulImages.push(r.value);
        }
      }
      console.log(`[generate-exam-pdf] Successfully fetched ${successfulImages.length} images`);

      for (const img of successfulImages) {
        try {
          const embedded = await embedImage(pdfDoc, img.bytes, img.url);
          if (embedded) {
            const qObj = questions.find(qq => qq.number === qRows.find(r => r.id === img.questionId)?.question_number);
            if (qObj) {
              qObj.image = {
                pdfImage: embedded,
                width: embedded.width,
                height: embedded.height,
              };
            }
          }
        } catch (e) {
          console.error(`[generate-exam-pdf] Failed to embed image:`, e);
        }
      }
    }

    // Now generate using the shared pdfDoc
    const pdfBytes = await generatePdfWithDoc(pdfDoc, simuladoRow as SimuladoRow, questions);

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

// Same as generatePdf but accepts pre-created pdfDoc with embedded images
async function generatePdfWithDoc(pdfDoc: PDFDocument, simulado: SimuladoRow, questions: Question[]): Promise<Uint8Array> {
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const metricsRegular = new FontMetrics(fontRegular);

  const [pageW, pageH] = PageSizes.A4;
  const marginX = 40, marginBot = 50, headerH = 72;
  const colGap = 20;
  const colW = (pageW - marginX * 2 - colGap) / 2;
  const maxTextW = colW - 8;
  const maxImgW = maxTextW - 4;

  const durationH = Math.round(simulado.duration_minutes / 60);
  const examLabel = sanitizeForWinAnsi(`${simulado.title} \u00B7 ${simulado.questions_count} quest\u00F5es \u00B7 ${durationH}h`);
  const footerLabel = sanitizeForWinAnsi(`${simulado.title} \u00B7 SanarFlix PRO \u00B7 Modo Offline`);

  // Embed logo icon
  const logoBytes = base64ToUint8Array(LOGO_ICON_B64);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const drawHeader = (page: ReturnType<typeof pdfDoc.addPage>) => {
    const pH = page.getHeight();
    page.drawRectangle({ x: 0, y: pH - headerH, width: pageW, height: headerH, color: WINE_DARK });
    // Logo icon
    page.drawImage(logoImage, { x: 20, y: pH - headerH + 18, width: 36, height: 36 });
    // Brand text next to icon
    page.drawText("SanarFlix PRO", { x: 62, y: pH - headerH + 30, size: 13, font: fontBold, color: WHITE });
    page.drawText("ENAMED", { x: 62, y: pH - headerH + 14, size: 9, font: fontRegular, color: rgb(1, 0.75, 0.8) });
    // Exam label right-aligned
    const lw = metricsRegular.textWidth(examLabel, 9);
    page.drawText(examLabel, { x: pageW - 24 - lw, y: pH - headerH + 30, size: 9, font: fontRegular, color: rgb(1, 0.85, 0.9) });
  };

  const drawFooter = (page: ReturnType<typeof pdfDoc.addPage>, rightText: string) => {
    const y = marginBot - 16;
    page.drawLine({ start: { x: 40, y: y + 18 }, end: { x: pageW - 40, y: y + 18 }, thickness: 0.5, color: GRAY_LIGHT });
    page.drawText(footerLabel, { x: 40, y, size: 7, font: fontRegular, color: GRAY_MID });
    const rw = metricsRegular.textWidth(rightText, 7);
    page.drawText(rightText, { x: pageW - 40 - rw, y, size: 7, font: fontRegular, color: GRAY_MID });
  };

  // ── Cover page (redesigned) ──
  drawCoverPage(pdfDoc, simulado, durationH, fontRegular, fontBold, metricsRegular, logoImage, drawHeader, drawFooter);

  // ── Layout ──
  const colTop = pageH - headerH - 60;
  const colBottom = marginBot + 20;
  const colHeight = colTop - colBottom;

  function measureQuestion(q: Question): number {
    let h = 14;
    h += metricsRegular.wrap(q.text, 9, maxTextW).length * 13 + 4;
    if (q.image) {
      const scale = Math.min(maxImgW / q.image.width, 1);
      h += q.image.height * scale + 8;
    }
    for (const opt of q.options) {
      const optLines = metricsRegular.wrap(`${opt.label}) ${opt.text}`, 8, maxTextW - 12);
      h += optLines.length * 11 + 2;
    }
    h += 12;
    return h;
  }

  type PageLayout = { left: Question[]; right: Question[] };
  const pages: PageLayout[] = [];
  let curPage: PageLayout = { left: [], right: [] };
  let leftH = 0, rightH = 0;

  for (const q of questions) {
    const qh = measureQuestion(q);
    if (leftH + qh <= colHeight) {
      curPage.left.push(q);
      leftH += qh;
    } else if (rightH + qh <= colHeight) {
      curPage.right.push(q);
      rightH += qh;
    } else {
      pages.push(curPage);
      curPage = { left: [q], right: [] };
      leftH = qh;
      rightH = 0;
    }
  }
  if (curPage.left.length || curPage.right.length) pages.push(curPage);

  for (let i = 0; i < pages.length; i++) {
    const page = pdfDoc.addPage(PageSizes.A4);
    drawHeader(page);
    drawFooter(page, `P\u00E1gina ${i + 1} de ${pages.length}`);

    renderColumn(page, pages[i].left, marginX, colTop, maxTextW, maxImgW, fontBold, fontRegular, metricsRegular);
    renderColumn(page, pages[i].right, marginX + colW + colGap, colTop, maxTextW, maxImgW, fontBold, fontRegular, metricsRegular);
  }

  return pdfDoc.save();
}

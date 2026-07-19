/**
 * generate-exam-pdf — Optimized for Edge Function CPU limits
 *
 * Includes image embedding with safeguards (timeout, max count, size limit).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
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
const MAX_IMAGES = 150;
const IMAGE_FETCH_TIMEOUT = 15_000;
const MAX_IMAGE_BYTES = 5_000_000;

const WINE_DARK  = rgb(0.35, 0.07, 0.19);
const WINE_MID   = rgb(0.42, 0.11, 0.24);
const WINE_LIGHT = rgb(0.55, 0.18, 0.30);
const BLACK      = rgb(0, 0, 0);
const WHITE      = rgb(1, 1, 1);
const GRAY_LIGHT = rgb(0.92, 0.92, 0.92);
const GRAY_MID   = rgb(0.55, 0.55, 0.55);
const GRAY_BG    = rgb(0.96, 0.96, 0.96);

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
    .replaceAll("\u00A0", " ")
    .replaceAll("\u2010", "-").replaceAll("\u2011", "-")
    .replaceAll("\u2012", "-").replaceAll("\u2015", "-")
    .replaceAll("\u2212", "-")
    .replaceAll("\u00AD", "");
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

// ─── Reflow hard-wrapped text into paragraphs/list items ─────────────────────

function reflowText(text: string): Array<{ type: 'p' | 'li'; text: string }> {
  const lines = text.split(/\r?\n/);
  const blocks: Array<{ type: 'p' | 'li'; text: string }> = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      blocks.push({ type: 'p', text: buf.join(' ').trim() });
      buf = [];
    }
  };
  for (const raw of lines) {
    const s = raw.trim();
    if (s === '') { flush(); continue; }
    if (/^[-•–*]\s+/.test(s)) {
      flush();
      blocks.push({ type: 'li', text: s.replace(/^[-•–*]\s+/, '') });
      continue;
    }
    buf.push(s);
    if (s.endsWith(':')) flush();
  }
  flush();
  return blocks;
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

async function fetchImageWithTimeout(url: string, questionNum: number): Promise<Uint8Array | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) {
      console.warn(`[generate-exam-pdf] Image for Q${questionNum} fetch failed: HTTP ${resp.status}`);
      return null;
    }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      console.warn(`[generate-exam-pdf] Image for Q${questionNum} skipped: ${buf.byteLength}B exceeds ${MAX_IMAGE_BYTES}B limit`);
      return null;
    }
    return new Uint8Array(buf);
  } catch (e) {
    const reason = e instanceof DOMException && e.name === 'AbortError' ? 'timeout' : String(e);
    console.warn(`[generate-exam-pdf] Image for Q${questionNum} fetch failed: ${reason}`);
    return null;
  }
}

async function embedImage(pdfDoc: PDFDocument, bytes: Uint8Array, url: string, questionNum: number): Promise<PDFImage | null> {
  try {
    const lower = url.toLowerCase();
    if (lower.includes(".png")) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    try { return await pdfDoc.embedPng(bytes); } catch { /* ignore */ }
    try { return await pdfDoc.embedJpg(bytes); } catch { /* ignore */ }
    console.warn(`[generate-exam-pdf] Image for Q${questionNum} embed failed (${bytes.byteLength}B)`);
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



// ─── Cover Page (redesigned) ─────────────────────────────────────────────────

function drawCoverPage(
  pdfDoc: PDFDocument,
  simulado: SimuladoRow,
  durationH: number,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  metrics: FontMetrics,
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

// ─── Manual justification (pdf-lib has no native justify) ───────────────────

function stripLabel(t: string): string {
  return t.replace(/^\s*[A-Da-d][)\.]\s*/, '');
}

function drawJustifiedLine(
  page: ReturnType<PDFDocument["addPage"]>,
  line: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  justify: boolean,
  metrics: FontMetrics,
  color: ReturnType<typeof rgb> = BLACK,
): void {
  if (!justify) {
    page.drawText(line, { x, y, size, font, color });
    return;
  }
  const words = line.split(' ');
  if (words.length < 2) {
    page.drawText(line, { x, y, size, font, color });
    return;
  }
  let wordsWidth = 0;
  for (const w of words) wordsWidth += metrics.textWidth(w, size);
  const extra = maxWidth - wordsWidth;
  const gap = extra / (words.length - 1);
  const spaceWidth = metrics.textWidth(' ', size);
  if (gap > 3 * spaceWidth || gap < 0) {
    page.drawText(line, { x, y, size, font, color });
    return;
  }
  let cursorX = x;
  for (const word of words) {
    page.drawText(word, { x: cursorX, y, size, font, color });
    cursorX += metrics.textWidth(word, size) + gap;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

function getAdminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// ─── Background generation worker ─────────────────────────────────────────────

async function buildAndUploadPdf(simulado_id: string, pdfPath: string, lockPath: string): Promise<void> {
  const supabase = getAdminClient();
  try {
    const { data: simuladoRow, error: simErr } = await supabase
      .from("simulados")
      .select("id, title, slug, sequence_number, questions_count, duration_minutes")
      .eq("id", simulado_id).single();
    if (simErr || !simuladoRow) throw new Error("Simulado not found");

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

    const pdfDoc = await PDFDocument.create();
    const qRows = questionRows as QuestionRow[];
    const imageQuestions = qRows.filter(q => q.image_url).slice(0, MAX_IMAGES);
    const failedImages: string[] = [];
    let embeddedCount = 0;

    if (imageQuestions.length > 0) {
      console.log(`[generate-exam-pdf:bg] Processing ${imageQuestions.length} images...`);
      const FETCH_BATCH_SIZE = 8;
      const fetchedBytes: Array<{ q: typeof imageQuestions[number]; bytes: Uint8Array | null }> = [];
      for (let i = 0; i < imageQuestions.length; i += FETCH_BATCH_SIZE) {
        const batch = imageQuestions.slice(i, i + FETCH_BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async q => ({ q, bytes: await fetchImageWithTimeout(q.image_url!, q.question_number) })),
        );
        fetchedBytes.push(...results);
      }
      for (const { q, bytes } of fetchedBytes) {
        if (!bytes) { failedImages.push(`Q${q.question_number}: fetch failed`); continue; }
        try {
          const embedded = await embedImage(pdfDoc, bytes, q.image_url!, q.question_number);
          if (embedded) {
            const qObj = questions.find(qq => qq.number === q.question_number);
            if (qObj) {
              qObj.image = { pdfImage: embedded, width: embedded.width, height: embedded.height };
              embeddedCount++;
            }
          } else {
            failedImages.push(`Q${q.question_number}: embed failed`);
          }
        } catch (e) {
          failedImages.push(`Q${q.question_number}: ${String(e)}`);
        }
      }
      console.log(`[generate-exam-pdf:bg] Embedded ${embeddedCount}/${imageQuestions.length} (${failedImages.length} failed)`);
    }

    const pdfBytes = await generatePdfWithDoc(pdfDoc, simuladoRow as SimuladoRow, questions);

    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;
    console.log(`[generate-exam-pdf:bg] Uploaded ${pdfPath} (${pdfBytes.byteLength} bytes)`);
  } catch (err) {
    console.error("[generate-exam-pdf:bg] Failed:", err);
  } finally {
    // Always release lock
    try { await supabase.storage.from(BUCKET).remove([lockPath]); } catch { /* ignore */ }
  }
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

    const { data: simMeta, error: simMetaErr } = await supabase.from("simulados").select("updated_at").eq("id", simulado_id).single();
    if (simMetaErr || !simMeta) {
      return new Response(JSON.stringify({ error: "Simulado not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const versionTs = new Date(simMeta.updated_at).getTime();
    const pdfPath  = `${simulado_id}_${versionTs}.pdf`;
    const lockPath = `${simulado_id}_${versionTs}.lock`;

    // 1) PDF ready? Return signed URL.
    const forceRegenerate = force === true;
    if (!forceRegenerate) {
      const { data: existing } = await supabase.storage.from(BUCKET).list("", { search: pdfPath });
      if (existing?.some(f => f.name === pdfPath)) {
        const { data: signedData, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_EXPIRY);
        if (signedError) throw signedError;
        return new Response(JSON.stringify({ status: "ready", url: signedData.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 2) Already generating? Return processing.
    const { data: lockExisting } = await supabase.storage.from(BUCKET).list("", { search: lockPath });
    const lockFile = lockExisting?.find(f => f.name === lockPath);
    if (lockFile && !forceRegenerate) {
      // Stale lock detection: if lock is older than 90s, assume previous worker died and re-trigger.
      const lockAge = Date.now() - new Date(lockFile.created_at ?? lockFile.updated_at ?? Date.now()).getTime();
      if (lockAge < 90_000) {
        return new Response(JSON.stringify({ status: "processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log(`[generate-exam-pdf] Stale lock detected (${lockAge}ms), re-triggering generation`);
      try { await supabase.storage.from(BUCKET).remove([lockPath]); } catch { /* ignore */ }
    }

    // 3) Acquire lock and start background work.
    const { error: lockErr } = await supabase.storage.from(BUCKET)
      .upload(lockPath, new Uint8Array([1]), { contentType: "application/octet-stream", upsert: true });
    if (lockErr) {
      console.warn("[generate-exam-pdf] Failed to acquire lock:", lockErr);
    }

    // EdgeRuntime.waitUntil keeps the worker alive after the response is sent.
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(buildAndUploadPdf(simulado_id, pdfPath, lockPath));
    } else {
      // Fallback: fire and forget (best effort)
      buildAndUploadPdf(simulado_id, pdfPath, lockPath);
    }

    return new Response(JSON.stringify({ status: "processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[generate-exam-pdf]", err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── PDF generation (uses pre-created pdfDoc with embedded images) ───────────
async function generatePdfWithDoc(pdfDoc: PDFDocument, simulado: SimuladoRow, questions: Question[]): Promise<Uint8Array> {
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const metricsRegular = new FontMetrics(fontRegular);

  const [pageW, pageH] = PageSizes.A4;
  const marginX = 40, marginBot = 50, headerH = 72;
  const contentW = pageW - marginX * 2;

  const durationH = Math.round(simulado.duration_minutes / 60);
  const examLabel = sanitizeForWinAnsi(`${simulado.title} \u00B7 ${simulado.questions_count} quest\u00F5es \u00B7 ${durationH}h`);
  const footerLabel = sanitizeForWinAnsi(`${simulado.title} \u00B7 SanarFlix PRO \u00B7 Modo Offline`);

  const drawHeader = (page: ReturnType<typeof pdfDoc.addPage>) => {
    const pH = page.getHeight();
    page.drawRectangle({ x: 0, y: pH - headerH, width: pageW, height: headerH, color: WINE_DARK });
    // Text-based logo lockup (replaces the raster logo — see incident note at top of file)
    const topY = pH - headerH;
    page.drawText("sanarflix", { x: 24, y: topY + 38, size: 15, font: fontBold, color: WHITE });
    const sw = metricsRegular.textWidth("sanarflix", 15);
    page.drawText("PRO", { x: 24 + sw + 6, y: topY + 42, size: 7.5, font: fontBold, color: rgb(0.9, 0.72, 0.79) });
    page.drawText("S I M U L A D O S", { x: 24, y: topY + 22, size: 7.5, font: fontBold, color: WHITE });
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
  drawCoverPage(pdfDoc, simulado, durationH, fontRegular, fontBold, metricsRegular, drawHeader, drawFooter);

  // ── Single-column flowing layout ──
  const colTop = pageH - headerH - 30;
  const colBottom = marginBot + 20;

  const BODY_SIZE = 9.7, BODY_LEADING = 14;
  const QTITLE_SIZE = 10.5;
  const OPT_SIZE = 9.5, OPT_LEADING = 13, OPT_INDENT = 16;
  const LI_INDENT = 14;

  const contentPages: Array<ReturnType<typeof pdfDoc.addPage>> = [];
  let page = pdfDoc.addPage(PageSizes.A4);
  drawHeader(page);
  contentPages.push(page);
  let y = colTop;

  const newPage = () => {
    page = pdfDoc.addPage(PageSizes.A4);
    drawHeader(page);
    contentPages.push(page);
    y = colTop;
  };

  const ensureSpace = (h: number) => {
    if (y - h < colBottom) newPage();
  };

  for (const q of questions) {
    ensureSpace(QTITLE_SIZE + 5);
    page.drawText(sanitizeForWinAnsi(`Questão ${q.number}`), { x: marginX, y, size: QTITLE_SIZE, font: fontBold, color: WINE_MID });
    y -= QTITLE_SIZE + 5;

    const blocks = reflowText(q.text);
    for (const block of blocks) {
      if (block.type === "p") {
        const lines = metricsRegular.wrap(block.text, BODY_SIZE, contentW);
        for (let li = 0; li < lines.length; li++) {
          ensureSpace(BODY_LEADING);
          const isLastLine = li === lines.length - 1;
          drawJustifiedLine(page, lines[li], fontRegular, BODY_SIZE, marginX, y, contentW, !isLastLine, metricsRegular, BLACK);
          y -= BODY_LEADING;
        }
        y -= 5;
      } else {
        const lines = metricsRegular.wrap(block.text, BODY_SIZE, contentW - LI_INDENT);
        for (let li = 0; li < lines.length; li++) {
          ensureSpace(BODY_LEADING);
          const prefix = li === 0 ? "•  " : "";
          page.drawText(sanitizeForWinAnsi(prefix + lines[li]), { x: marginX + LI_INDENT, y, size: BODY_SIZE, font: fontRegular, color: BLACK });
          y -= BODY_LEADING;
        }
      }
    }

    if (q.image) {
      let drawW = Math.min(contentW * 0.82, q.image.width * 0.75);
      let drawH = drawW * (q.image.height / q.image.width);
      if (drawH > 320) {
        drawH = 320;
        drawW = drawH * (q.image.width / q.image.height);
      }
      ensureSpace(4 + drawH + 4);
      y -= 4;
      const imgX = marginX + (contentW - drawW) / 2;
      y -= drawH;
      page.drawImage(q.image.pdfImage, { x: imgX, y, width: drawW, height: drawH });
      y -= 4;
    }

    for (const opt of q.options) {
      const full = `${opt.label}) ${stripLabel(opt.text)}`;
      const lines = metricsRegular.wrap(full, OPT_SIZE, contentW - OPT_INDENT);
      for (const line of lines) {
        ensureSpace(OPT_LEADING);
        page.drawText(line, { x: marginX + OPT_INDENT, y, size: OPT_SIZE, font: fontRegular, color: BLACK });
        y -= OPT_LEADING;
      }
    }

    y -= 10;
  }

  for (let i = 0; i < contentPages.length; i++) {
    drawFooter(contentPages[i], `Página ${i + 1} de ${contentPages.length}`);
  }

  return pdfDoc.save();
}

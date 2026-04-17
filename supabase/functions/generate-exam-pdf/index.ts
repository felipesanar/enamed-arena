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

// ─── Embedded full white logo PNG (600px wide, base64) ───────────────────────
const LOGO_ICON_B64 = "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";

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
    // Full logo image (aspect ratio ~3.55:1 from 600x169)
    const logoW = 150;
    const logoH = logoW / 3.55;
    page.drawImage(logoImage, { x: 20, y: pH - headerH + (headerH - logoH) / 2, width: logoW, height: logoH });
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

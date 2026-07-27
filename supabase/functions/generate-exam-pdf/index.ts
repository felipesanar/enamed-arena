/**
 * generate-exam-pdf — Optimized for Edge Function CPU limits
 *
 * Includes image embedding with safeguards (timeout, max count, size limit).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import type { SimuladoRow, QuestionRow, OptionRow } from "./types.ts";
import { generateLegacyPdf } from "./legacyPdfLib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "exam-pdfs";
const SIGNED_URL_EXPIRY = 3600;

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

    const pdfBytes = await generateLegacyPdf(
      simuladoRow as SimuladoRow,
      questionRows as QuestionRow[],
      optionRows as OptionRow[],
    );

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

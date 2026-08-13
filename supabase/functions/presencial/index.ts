// Fluxo presencial — identificação do aluno na sala de prova.
//
// Rota pública, chamada de um QR code, SEM sessão de usuário. O aluno nunca
// ganha um JWT do Supabase Auth aqui: o que sai é um token opaco (HMAC,
// token.ts) escopado a um único gabarito, com TTL curto.
//
// Três propriedades de segurança que não podem ser violadas:
//   1. O esqueleto de questões devolvido ao cliente NUNCA contém conteúdo de
//      prova (question_id, number, options:[{id,label}] — só isso).
//   2. O `user_id` nunca sai numa resposta HTTP. A `ref` do candidato
//      sugerido é um HMAC opaco de `user_id` + `code`, recomputável no
//      servidor com o segredo — nunca o `user_id` em claro.
//   3. O e-mail sugerido sai sempre mascarado (maskEmail).
//
// Pin completo obrigatório em import externo (docs/INCIDENTE_2026_05_17.md).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { maskEmail } from "./mask.ts";
import { normalizeName, firstLastKey, pickCandidates } from "./identity.ts";
import { signToken } from "./token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRESENCIAL_TOKEN_SECRET = Deno.env.get("PRESENCIAL_TOKEN_SECRET") ?? "";

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2h — escopo de um único gabarito
const WINDOW_MS = 60 * 60 * 1000;        // janela rolante do rate limit
const MAX_CHECKIN_PER_IP = 120;          // uma sala inteira cabe folgado
const MAX_CHECKIN_PER_EMAIL = 5;
const MAX_NAME_LOOKUP_PER_IP = 20;       // busca por nome é mais sensível (enumeração)

const EMAIL_RE = /^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/;
const PROFILES_PAGE_SIZE = 1000; // PostgREST cap por página (gotcha do projeto)

const VALID_ACTIONS = new Set(["checkin", "claim", "start-unlinked"]);

const SEGMENT_LABELS: Record<string, string> = {
  guest: "Visitante",
  standard: "Aluno SanarFlix",
  pro: "Aluno PRO",
};

const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// ─── Copiado verbatim de create-guest-account/index.ts (mesma allowlist) ────

const ALLOWED_ORIGINS = new Set([
  "https://enamed-arena.lovable.app",
  "https://simulados.sanar.com.br",
]);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      /^id-preview--[a-z0-9-]+\.lovable\.app$/i.test(url.hostname) ||
      /^[a-z0-9-]+\.lovableproject\.com$/i.test(url.hostname) ||
      url.hostname === "sanar.com.br" ||
      url.hostname.endsWith(".sanar.com.br")
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : "https://enamed-arena.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-real-ip")
    ?? "0.0.0.0";
}

// ─── HMAC opaco para a `ref` do candidato (nunca o user_id em claro) ────────

async function hmacHex(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function candidateRef(userId: string, code: string): Promise<string> {
  return hmacHex(`${userId}:${code}`, PRESENCIAL_TOKEN_SECRET);
}

// ─── Tipos internos ──────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  simulado_id: string;
  code: string;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  segment: string;
}

class AlreadySubmittedError extends Error {}

// ─── Sessão + rate limit ─────────────────────────────────────────────────

async function loadOpenSession(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  code: string,
): Promise<SessionRow | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("presencial_sessions")
    .select("id, simulado_id, code, opens_at, closes_at, is_active")
    .eq("code", code)
    .eq("is_active", true)
    .lte("opens_at", nowIso)
    .gte("closes_at", nowIso)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function rateLimit(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  cors: Record<string, string>,
  bucketType: string,
  bucketKey: string,
  max: number,
  message = "Muitas tentativas. Tente novamente em alguns minutos.",
): Promise<Response | null> {
  const { data, error } = await supabaseAdmin.rpc("bump_presencial_bucket", {
    p_bucket_type: bucketType,
    p_bucket_key: bucketKey,
    p_window_ms: WINDOW_MS,
  });
  if (error) {
    console.error(`[presencial] rate-limit RPC error (${bucketType}):`, error.message);
    // Fail-closed: se o rate limit está quebrado, recusa em vez de deixar passar.
    return json({ error: "Serviço temporariamente indisponível" }, 503, cors);
  }
  if ((data ?? 0) > max) {
    console.warn(`[presencial] rate limit exceeded (${bucketType}):`, bucketKey.slice(0, 8));
    return json({ error: message }, 429, cors);
  }
  return null;
}

// ─── Identificação por e-mail / nome ─────────────────────────────────────

async function fetchProfileByEmail(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  email: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, created_at, segment")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// profiles não tem índice de trigrama (pg_trgm não instalado) e o corte de
// candidatos exige comparar TODOS os nomes normalizados — pagina em blocos de
// 1000 para não cair no cap do PostgREST (gotcha já mordeu o ranking antes).
async function fetchAllProfilesWithName(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];
  let from = 0;
  for (;;) {
    const to = from + PROFILES_PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, created_at, segment")
      .not("full_name", "is", null)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PROFILES_PAGE_SIZE) break;
    from += PROFILES_PAGE_SIZE;
  }
  return rows;
}

function searchCandidatesByName(rows: ProfileRow[], name: string): ProfileRow[] {
  const normalized = normalizeName(name);
  const flKey = firstLastKey(name);

  const exact = rows.filter((r) => normalizeName(r.full_name ?? "") === normalized);
  const matches = exact.length > 0
    ? exact
    : rows.filter((r) => firstLastKey(r.full_name ?? "") === flKey);

  return pickCandidates(matches);
}

// ─── Desempate por histórico (só com 2+ candidatos) ──────────────────────

function formatCreatedAt(createdAt: string): string {
  const d = new Date(createdAt);
  return `${MONTHS_PT[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function formatSimuladosClause(titles: string[]): string | null {
  const numbers = titles
    .map((t) => t.match(/\d+/)?.[0])
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => Number(a) - Number(b));
  if (numbers.length === 0) return null;
  return numbers.length === 1
    ? `fez o Simulado ${numbers[0]}`
    : `fez os Simulados ${joinList(numbers)}`;
}

async function buildHints(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  candidates: ProfileRow[],
): Promise<Map<string, string>> {
  const hints = new Map<string, string>();
  if (candidates.length < 2) return hints; // só preenche com 2+ candidatos

  const ids = candidates.map((c) => c.id);
  const { data: attempts, error } = await supabaseAdmin
    .from("attempts")
    .select("user_id, simulados(title)")
    .in("user_id", ids)
    .eq("status", "submitted");
  if (error) throw error;

  const titlesByUser = new Map<string, string[]>();
  for (const a of attempts ?? []) {
    const title = (a as { simulados?: { title?: string } | null }).simulados?.title;
    if (!title) continue;
    const arr = titlesByUser.get(a.user_id) ?? [];
    arr.push(title);
    titlesByUser.set(a.user_id, arr);
  }

  for (const c of candidates) {
    const parts = [
      `criada em ${formatCreatedAt(c.created_at)}`,
      formatSimuladosClause(titlesByUser.get(c.id) ?? []),
      SEGMENT_LABELS[c.segment] ?? null,
    ].filter((p): p is string => Boolean(p));
    hints.set(c.id, parts.join(" · "));
  }
  return hints;
}

// ─── Esqueleto de questões — NUNCA text/explanation/image_url* ───────────

async function buildSkeleton(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  simuladoId: string,
) {
  const { data: questions, error: qErr } = await supabaseAdmin
    .from("questions")
    .select("id, question_number")
    .eq("simulado_id", simuladoId)
    .order("question_number", { ascending: true });
  if (qErr) throw qErr;
  if (!questions || questions.length === 0) return [];

  const questionIds = questions.map((q: { id: string }) => q.id);
  const { data: options, error: oErr } = await supabaseAdmin
    .from("question_options")
    .select("id, question_id, label")
    .in("question_id", questionIds)
    .in("label", ["A", "B", "C", "D"])
    .order("label", { ascending: true });
  if (oErr) throw oErr;

  const byQuestion = new Map<string, { id: string; label: string }[]>();
  for (const opt of options ?? []) {
    const arr = byQuestion.get(opt.question_id) ?? [];
    arr.push({ id: opt.id, label: opt.label });
    byQuestion.set(opt.question_id, arr);
  }

  return questions.map((q: { id: string; question_number: number }) => ({
    question_id: q.id,
    number: q.question_number,
    options: (byQuestion.get(q.id) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

// ─── Criação/conversão do attempt + submissão + token ────────────────────

async function createSession(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  session: SessionRow,
  path: "email_direct" | "name_suggestion" | "unlinked",
  user: ProfileRow | null,
  ipHash: string,
  name: string,
  email: string,
): Promise<{ submissionId: string; body: unknown }> {
  let attemptId: string | null = null;

  if (user) {
    const { data, error } = await supabaseAdmin.rpc("create_or_convert_presencial_attempt", {
      p_simulado_id: session.simulado_id,
      p_user_id: user.id,
    });
    if (error) {
      if (error.message?.includes("PRESENCIAL_ALREADY_SUBMITTED")) {
        throw new AlreadySubmittedError();
      }
      throw error;
    }
    attemptId = data as string;
  }

  const { data: submission, error: subErr } = await supabaseAdmin
    .from("presencial_submissions")
    .insert({
      session_id: session.id,
      simulado_id: session.simulado_id,
      declared_name: name,
      declared_email: email,
      identification_path: path,
      ip_hash: ipHash,
      linked_user_id: user?.id ?? null,
      linked_attempt_id: attemptId,
      status: user ? "linked" : "unlinked",
    })
    .select("id")
    .single();
  if (subErr) throw subErr;

  const questions = await buildSkeleton(supabaseAdmin, session.simulado_id);

  // Token assinado, não cifrado (ver comentário em token.ts): user_id nunca
  // entra aqui. Quem consumir o token depois (Task 10) deriva o user_id no
  // servidor via attempt_id (public.attempts) ou submission_id
  // (public.presencial_submissions.linked_user_id) — nunca do cliente.
  const token = await signToken({
    submission_id: submission.id,
    simulado_id: session.simulado_id,
    session_id: session.id,
    attempt_id: attemptId,
    exp: Date.now() + TOKEN_TTL_MS,
  }, PRESENCIAL_TOKEN_SECRET);

  return { submissionId: submission.id, body: { status: "ready", token, questions } };
}

// ─── Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  const origin = req.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin)) {
    console.warn("[presencial] Blocked non-allowed origin:", origin || "<missing>");
    return json({ error: "Origem não permitida" }, 403, cors);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PRESENCIAL_TOKEN_SECRET) {
    console.error("[presencial] Missing env vars");
    return json({ error: "Configuração inválida" }, 500, cors);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const code = typeof body?.code === "string" ? body.code.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const candidateRefInput = typeof body?.candidate_ref === "string" ? body.candidate_ref : "";

    if (!VALID_ACTIONS.has(action)) {
      return json({ error: "Ação inválida" }, 400, cors);
    }
    if (!code) {
      return json({ error: "Código da sala é obrigatório" }, 400, cors);
    }
    if (!name) {
      return json({ error: "Nome é obrigatório" }, 400, cors);
    }
    if (!email || !EMAIL_RE.test(email)) {
      return json({ error: "Email inválido" }, 400, cors);
    }
    if (action === "claim" && !candidateRefInput) {
      return json({ error: "Referência de candidato é obrigatória" }, 400, cors);
    }

    const session = await loadOpenSession(supabaseAdmin, code);
    if (!session) {
      return json({ error: "Esta sala não está aberta para envio de gabarito." }, 403, cors);
    }

    const ip = getClientIp(req);
    const ipHash = await sha256Hex(ip);
    const emailHash = await sha256Hex(email);

    const ipLimited = await rateLimit(supabaseAdmin, cors, "checkin_ip", ipHash, MAX_CHECKIN_PER_IP);
    if (ipLimited) return ipLimited;
    const emailLimited = await rateLimit(supabaseAdmin, cors, "checkin_email", emailHash, MAX_CHECKIN_PER_EMAIL);
    if (emailLimited) return emailLimited;

    if (action === "start-unlinked") {
      const { body: resultBody } = await createSession(
        supabaseAdmin, session, "unlinked", null, ipHash, name, email,
      );
      return json(resultBody, 200, cors);
    }

    if (action === "checkin") {
      const emailMatch = await fetchProfileByEmail(supabaseAdmin, email);
      if (emailMatch) {
        try {
          const { body: resultBody } = await createSession(
            supabaseAdmin, session, "email_direct", emailMatch, ipHash, name, email,
          );
          return json(resultBody, 200, cors);
        } catch (err) {
          if (err instanceof AlreadySubmittedError) {
            return json(
              { error: "Esta conta já enviou o gabarito presencial deste simulado." },
              409,
              cors,
            );
          }
          throw err;
        }
      }

      const nameLimited = await rateLimit(
        supabaseAdmin, cors, "name_lookup_ip", ipHash, MAX_NAME_LOOKUP_PER_IP,
        "Muitas buscas por nome. Tente novamente em alguns minutos.",
      );
      if (nameLimited) return nameLimited;

      const allProfiles = await fetchAllProfilesWithName(supabaseAdmin);
      const candidates = searchCandidatesByName(allProfiles, name);

      if (candidates.length === 0) {
        return json({ status: "no_account" }, 200, cors);
      }

      if (candidates.length >= 2) {
        const { error: dupErr } = await supabaseAdmin
          .from("presencial_duplicate_candidates")
          .insert(candidates.map((c) => ({
            session_id: session.id,
            submission_id: null,
            candidate_user_id: c.id,
            chosen: false,
          })));
        if (dupErr) throw dupErr;
      }

      const hints = await buildHints(supabaseAdmin, candidates);
      const responseCandidates = await Promise.all(candidates.map(async (c) => ({
        ref: await candidateRef(c.id, session.code),
        masked_email: maskEmail(c.email ?? ""),
        hint: hints.get(c.id) ?? null,
      })));

      return json({ status: "suggestions", candidates: responseCandidates }, 200, cors);
    }

    // action === "claim"
    const nameLimited = await rateLimit(
      supabaseAdmin, cors, "name_lookup_ip", ipHash, MAX_NAME_LOOKUP_PER_IP,
      "Muitas buscas por nome. Tente novamente em alguns minutos.",
    );
    if (nameLimited) return nameLimited;

    const allProfiles = await fetchAllProfilesWithName(supabaseAdmin);
    const candidates = searchCandidatesByName(allProfiles, name);

    let matched: ProfileRow | null = null;
    for (const c of candidates) {
      const ref = await candidateRef(c.id, session.code);
      if (ref === candidateRefInput) {
        matched = c;
        break;
      }
    }

    if (!matched) {
      return json({ error: "Referência de candidato inválida." }, 400, cors);
    }

    try {
      const { submissionId, body: resultBody } = await createSession(
        supabaseAdmin, session, "name_suggestion", matched, ipHash, name, email,
      );

      const { error: updErr } = await supabaseAdmin
        .from("presencial_duplicate_candidates")
        .update({ chosen: true, submission_id: submissionId })
        .eq("session_id", session.id)
        .eq("candidate_user_id", matched.id)
        .is("submission_id", null);
      if (updErr) {
        console.error("[presencial] failed to mark duplicate candidate as chosen:", updErr.message);
      }

      return json(resultBody, 200, cors);
    } catch (err) {
      if (err instanceof AlreadySubmittedError) {
        return json(
          { error: "Esta conta já enviou o gabarito presencial deste simulado." },
          409,
          cors,
        );
      }
      throw err;
    }
  } catch (err) {
    console.error("[presencial] Unexpected error:", err);
    return json({ error: "Erro interno" }, 500, cors);
  }
});

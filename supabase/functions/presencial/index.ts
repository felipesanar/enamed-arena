// Fluxo presencial — identificação do aluno na sala de prova e, ao final,
// envio do gabarito transcrito (action `submit`).
//
// Rota pública, chamada de um QR code, SEM sessão de usuário. O aluno nunca
// ganha um JWT do Supabase Auth aqui: o que sai é um token opaco (HMAC,
// token.ts) escopado a um único gabarito, com TTL curto.
//
// Quatro propriedades de segurança que não podem ser violadas:
//   1. O esqueleto de questões devolvido ao cliente NUNCA contém conteúdo de
//      prova (question_id, number, options:[{id,label}] — só isso).
//   2. O `user_id` nunca sai numa resposta HTTP. A `ref` do candidato
//      sugerido é um HMAC opaco de `user_id` + `code`, recomputável no
//      servidor com o segredo — nunca o `user_id` em claro.
//   3. O e-mail sugerido sai sempre mascarado (maskEmail).
//   4. A action `submit` NUNCA devolve qual era a alternativa correta nem
//      resultado questão-a-questão — só agregados (score_presencial_answers).
//      O `answers` de entrada é validado a fio: array, tamanho == número de
//      questões do simulado, todo question_id do simulado, sem duplicata,
//      todo selected_option_id da própria questão, nenhuma resposta nula.
//      Sem essa validação um envio parcial repetido revelaria o gabarito por
//      diferença. Mas essa validação SÓ funciona se o envio também for
//      único: o `status` one-way do attempt (`submit_presencial_answers`,
//      via `FOR UPDATE ... AND status = 'presencial_pending'`) garante isso
//      no ramo VINCULADO; o índice único por conta é PARCIAL
//      (`WHERE linked_user_id IS NOT NULL`) e não cobre o ramo UNLINKED — lá
//      quem tranca o reenvio é o claim atômico em `presencial_submissions`
//      (`WHERE submitted_at IS NULL`, ver `claimSubmission`). Os dois
//      mecanismos precisam estar de pé; nenhum sozinho cobre os dois ramos
//      (fix round 1/5: o `submit` original só tinha o primeiro).
//
// Pin completo obrigatório em import externo (docs/INCIDENTE_2026_05_17.md).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { maskEmail } from "./mask.ts";
import { normalizeName, firstLastKey, pickCandidates } from "./identity.ts";
import { signToken, verifyToken } from "./token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRESENCIAL_TOKEN_SECRET = Deno.env.get("PRESENCIAL_TOKEN_SECRET") ?? "";

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2h — escopo de um único gabarito
const WINDOW_MS = 60 * 60 * 1000;        // janela rolante do rate limit
const MAX_CHECKIN_PER_IP = 120;          // uma sala inteira cabe folgado
const MAX_CHECKIN_PER_EMAIL = 5;
const MAX_NAME_LOOKUP_PER_IP = 20;       // busca por nome é mais sensível (enumeração)
const MAX_SUBMIT_PER_IP = 120;           // mesma lógica do checkin: uma sala inteira cabe folgado
const CLAIM_RETRY_ATTEMPTS = 3;          // reduz a chance de "attempt certo, submissão incompleta"
const CLAIM_RETRY_BASE_DELAY_MS = 150;

const EMAIL_RE = /^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/;
const PROFILES_PAGE_SIZE = 1000; // PostgREST cap por página (gotcha do projeto)

const VALID_ACTIONS = new Set(["checkin", "claim", "start-unlinked", "submit"]);

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

interface ScorePayload {
  total_questions: number;
  total_correct: number;
  score_percentage: number;
  by_area: { area: string; total: number; correct: number; percentage: number }[];
}

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

// ─── Envio do gabarito (action `submit`) ──────────────────────────────────
//
// A validação abaixo é a peça mais crítica de todo o fluxo presencial: sem
// ela, alguém enviaria um gabarito parcial, veria a nota, mudaria uma
// resposta e enviaria de novo, derivando a alternativa correta de cada
// questão por diferença (com 100 questões e nota agregada isso é totalmente
// viável). Combinada com o `status` one-way do attempt e o índice único por
// conta (uma submissão vinculada por usuário/simulado), o envio passa a ser
// único de verdade — a validação aqui garante que esse único envio já chega
// completo e íntegro, então não sobra brecha de "tentativa parcial".
//
// As 5 condições abaixo (nenhuma pode ser relaxada):
//   1. `answers` precisa ser um array.
//   2. Tamanho tem que bater com o número de questões do simulado.
//   3. Todo `question_id` tem que pertencer àquele simulado.
//   4. Todo `selected_option_id` tem que pertencer à SUA PRÓPRIA questão.
//   5. Nenhuma resposta pode ser nula — a Tela 2 exige as 100 marcadas antes
//      de liberar o envio; aceitar nulo aqui reabriria o envio parcial.
//
// Reforço além das 5 (não relaxa nenhuma, só fecha uma variante do mesmo
// ataque): question_id não pode se repetir. Sem isso, dava para duplicar uma
// resposta para "preencher" o tamanho do array enquanto se omite a resposta
// real de outra questão — o efeito prático seria idêntico a mandar null
// para aquela questão (fica de fora do cômputo), só que sem violar
// literalmente a condição 5. Dedupe fecha essa variante.
async function validateAnswers(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  simuladoId: string,
  answers: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Condição 1: precisa ser array.
  if (!Array.isArray(answers)) {
    return { ok: false, error: "O gabarito enviado é inválido." };
  }

  const { data: questions, error: qErr } = await supabaseAdmin
    .from("questions")
    .select("id")
    .eq("simulado_id", simuladoId);
  if (qErr) throw qErr;

  const questionIds = new Set<string>((questions ?? []).map((q: { id: string }) => q.id));

  // Condição 2: tamanho tem que bater com o número de questões do simulado.
  if (questionIds.size === 0 || answers.length !== questionIds.size) {
    return { ok: false, error: "O gabarito enviado não corresponde ao número de questões do simulado." };
  }

  const { data: options, error: oErr } = await supabaseAdmin
    .from("question_options")
    .select("id, question_id")
    .in("question_id", Array.from(questionIds));
  if (oErr) throw oErr;

  const optionsByQuestion = new Map<string, Set<string>>();
  for (const opt of (options ?? []) as { id: string; question_id: string }[]) {
    const set = optionsByQuestion.get(opt.question_id) ?? new Set<string>();
    set.add(opt.id);
    optionsByQuestion.set(opt.question_id, set);
  }

  const seen = new Set<string>();

  for (const raw of answers) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "O gabarito enviado é inválido." };
    }
    const questionId = (raw as Record<string, unknown>).question_id;
    const selectedOptionId = (raw as Record<string, unknown>).selected_option_id;

    // Condição 3: question_id precisa pertencer ao simulado.
    if (typeof questionId !== "string" || !questionIds.has(questionId)) {
      return { ok: false, error: "O gabarito enviado contém uma questão que não pertence a este simulado." };
    }

    // Reforço: sem duplicata de question_id (ver comentário acima).
    if (seen.has(questionId)) {
      return { ok: false, error: "O gabarito enviado contém uma questão duplicada." };
    }
    seen.add(questionId);

    // Condição 5: nenhuma resposta nula.
    if (typeof selectedOptionId !== "string" || selectedOptionId.length === 0) {
      return { ok: false, error: "Todas as questões precisam de uma alternativa marcada." };
    }

    // Condição 4: selected_option_id precisa pertencer à SUA PRÓPRIA questão.
    const validOptions = optionsByQuestion.get(questionId);
    if (!validOptions || !validOptions.has(selectedOptionId)) {
      return { ok: false, error: "O gabarito enviado contém uma alternativa que não pertence à questão." };
    }
  }

  return { ok: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Claim atômico de presencial_submissions (fix round 1/5) ─────────────
//
// CRITICAL corrigido aqui: no ramo UNLINKED não existe attempt, logo não
// existe o `FOR UPDATE ... status = 'presencial_pending'` que trava reenvio
// no ramo vinculado. O índice único de `presencial_submissions` também não
// cobre esse ramo (é parcial, `WHERE linked_user_id IS NOT NULL`). Sem essa
// função, `submit` no ramo unlinked podia ser chamado quantas vezes o
// cliente quisesse para o MESMO token, mudando uma resposta por vez e lendo
// `total_correct`/`by_area` a cada chamada — o ataque que toda a validação
// de `answers` existe para impedir, disponível sem limite para quem
// simplesmente escolhe não se identificar.
//
// O UPDATE abaixo é um compare-and-swap atômico do Postgres:
// `WHERE submitted_at IS NULL` só casa a linha na PRIMEIRA chamada bem
// sucedida; qualquer chamada concorrente ou posterior para o mesmo
// submission_id encontra 0 linhas e sabe, sem ambiguidade, que já foi
// atendida. Vale para os dois ramos: é a ÚNICA trava do ramo unlinked e um
// reforço (defesa em profundidade) do ramo vinculado, cujo gate primário
// continua sendo `submit_presencial_answers`.
async function claimSubmission(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  submissionId: string,
  answers: unknown,
  score: ScorePayload,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("presencial_submissions")
    .update({
      answers,
      total_correct: score.total_correct,
      score_percentage: score.score_percentage,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .is("submitted_at", null)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

// Retry curto (3 tentativas, backoff linear) só para erro de transporte/DB
// no claim — não para "0 linhas" (que é um resultado válido, não uma
// falha). Reduz a chance da janela residual descrita no comentário de
// `handleSubmit` sobre o ramo vinculado: submit_presencial_answers ter
// sucesso e o claim falhar logo em seguida por um problema transitório.
async function claimSubmissionWithRetry(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  submissionId: string,
  answers: unknown,
  score: ScorePayload,
): Promise<boolean> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= CLAIM_RETRY_ATTEMPTS; attempt++) {
    try {
      return await claimSubmission(supabaseAdmin, submissionId, answers, score);
    } catch (err) {
      lastErr = err;
      if (attempt < CLAIM_RETRY_ATTEMPTS) {
        await sleep(CLAIM_RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }
  throw lastErr;
}

async function handleSubmit(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  cors: Record<string, string>,
  body: Record<string, unknown>,
  req: Request,
): Promise<Response> {
  const token = typeof body?.token === "string" ? body.token : "";
  const answers = body?.answers;

  if (!token) {
    return json({ error: "Token é obrigatório" }, 400, cors);
  }

  const payload = await verifyToken(token, PRESENCIAL_TOKEN_SECRET, Date.now());
  if (!payload) {
    return json({ error: "Sua sessão de gabarito expirou. Chame o fiscal." }, 401, cors);
  }

  // `submit` era o único endpoint público sem teto de chamadas (checkin/
  // claim/start-unlinked já tinham rate limit desde a v1). Mesmo com o
  // claim atômico abaixo, deixar sem limite é convite a abuso — bucket
  // próprio, mesma ordem de grandeza do checkin (uma sala inteira cabe).
  const ip = getClientIp(req);
  const ipHash = await sha256Hex(ip);
  const submitLimited = await rateLimit(supabaseAdmin, cors, "submit_ip", ipHash, MAX_SUBMIT_PER_IP);
  if (submitLimited) return submitLimited;

  const validation = await validateAnswers(supabaseAdmin, payload.simulado_id, answers);
  if (!validation.ok) {
    return json({ error: validation.error }, 400, cors);
  }

  // Fonte única do payload de resposta, nos dois ramos (vinculado e unlinked):
  // o finalize devolve totais mas não a quebra por área, e a Tela 3 precisa
  // de uma fonte só. Chamada pura/stateless (STABLE, sem side effect) —
  // segura de rodar de novo em qualquer retry.
  const { data: scoreData, error: scoreErr } = await supabaseAdmin.rpc("score_presencial_answers", {
    p_simulado_id: payload.simulado_id,
    p_answers: answers,
  });
  if (scoreErr) throw scoreErr;
  const score = scoreData as ScorePayload;

  // O token nunca carrega user_id (payload assinado, mas legível). Só
  // derivamos o user_id no servidor, via join por attempt_id — nunca aceito
  // do cliente e nunca devolvido na resposta.
  let isLinked = false;
  let isWithinWindow = false;

  if (payload.attempt_id) {
    const { data: attemptRow, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .select("user_id")
      .eq("id", payload.attempt_id)
      .maybeSingle();
    if (attemptErr) throw attemptErr;

    if (attemptRow?.user_id) {
      isLinked = true;

      // Gate primário do ramo vinculado: FOR UPDATE + status='presencial_pending'
      // dentro da própria RPC, atômico no Postgres. Uma segunda chamada
      // concorrente para o MESMO attempt (double-click, retry de rede) bloqueia
      // aqui até a primeira commitar, então relê o status e recusa com
      // PRESENCIAL_ATTEMPT_NOT_PENDING — nunca chega a reexpor `score` calculado
      // com um `answers` diferente.
      const { data: submitData, error: submitErr } = await supabaseAdmin.rpc("submit_presencial_answers", {
        p_attempt_id: payload.attempt_id,
        p_user_id: attemptRow.user_id,
        p_answers: answers,
      });
      if (submitErr) {
        if (submitErr.message?.includes("PRESENCIAL_ATTEMPT_NOT_PENDING")) {
          return json({ error: "Este gabarito já foi enviado." }, 409, cors);
        }
        throw submitErr;
      }
      isWithinWindow = Boolean((submitData as { is_within_window?: boolean } | null)?.is_within_window);
    } else {
      console.warn("[presencial] submit: attempt_id do token sem attempt correspondente:", payload.attempt_id);
    }
  }
  // Ramo unlinked (sem attempt_id): não há janela de execução vinculada a
  // nenhum attempt, então is_within_window fica false — o mesmo valor que
  // create_or_convert_presencial_attempt usa para todo attempt presencial
  // ainda pendente, e consistente com "não entra no ranking" (só attempts
  // com is_within_window=true entram). Se esta submissão for vinculada
  // depois pela fila do admin, o is_within_window real é recalculado
  // naquele fluxo a partir de `submitted_at` (20260812100550), não aqui.

  // Claim atômico + gravação de presencial_submissions, nos DOIS ramos. No
  // ramo unlinked esta linha é a ÚNICA coisa que preserva o trabalho do
  // aluno E a ÚNICA trava contra reenvio (ver comentário de claimSubmission).
  let claimed: boolean;
  try {
    claimed = await claimSubmissionWithRetry(supabaseAdmin, payload.submission_id, answers, score);
  } catch (err) {
    if (!isLinked) {
      // Ramo unlinked: nada irreversível aconteceu antes deste ponto (não há
      // attempt). Se o claim não commitou de jeito nenhum após os retries,
      // `submitted_at` permanece NULL — estado seguro "não enviado, pode
      // tentar de novo". 500 é a resposta honesta: nada foi perdido, o
      // aluno pode reenviar o mesmo token.
      throw err;
    }
    // Ramo vinculado: `submit_presencial_answers` já commitou (o attempt já
    // saiu de 'presencial_pending' — mudança one-way, por desenho). Se o
    // claim falhar aqui, `presencial_submissions` fica incompleta, mas a
    // nota do aluno NÃO se perde — já está em `attempts`/
    // `user_performance_history`, íntegra e correta. Falhar a resposta pra
    // ele com 500 seria pior: mentiria "não deu certo" sobre algo que já
    // deu certo, e um retry dele nunca mais teria uma segunda chance (o
    // attempt não pode voltar a 'presencial_pending'). Por isso devolvemos
    // o resultado real ao aluno e registramos o log abaixo como incidente
    // acionável — não é um meio-termo silencioso, é um meio-termo logado
    // com log crítico, para reconciliação manual da fila do admin.
    console.error(
      "[presencial] submit: submit_presencial_answers OK mas claim em presencial_submissions falhou " +
      "após retries — presencial_submissions ficou incompleta, attempts está correto. " +
      "Requer reconciliação manual.",
      { submission_id: payload.submission_id, attempt_id: payload.attempt_id, error: err },
    );
    claimed = true; // trata como concluído para o aluno; a linha requer reparo manual.
  }

  if (!claimed) {
    return json({ error: "Este gabarito já foi enviado." }, 409, cors);
  }

  return json({
    total_questions: score.total_questions,
    total_correct: score.total_correct,
    score_percentage: score.score_percentage,
    by_area: score.by_area,
    is_linked: isLinked,
    is_within_window: isWithinWindow,
  }, 200, cors);
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

    // `submit` não usa code/name/email/candidate_ref — usa o token opaco
    // emitido no checkin/claim/start-unlinked. Fluxo totalmente separado.
    if (action === "submit") {
      return await handleSubmit(supabaseAdmin, cors, body, req);
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

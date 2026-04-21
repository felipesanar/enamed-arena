import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Optional hCaptcha / Turnstile server-side verification.
// Configure ONE of the following in the function secrets:
//   - HCAPTCHA_SECRET      : hCaptcha secret (requires `captchaToken` in body)
//   - TURNSTILE_SECRET     : Cloudflare Turnstile secret (requires `captchaToken` in body)
// If NEITHER is set, the function falls back to Origin allowlist + rate limiting
// (still safer than the previous wide-open version, but a captcha is strongly recommended).
const HCAPTCHA_SECRET = Deno.env.get("HCAPTCHA_SECRET") ?? "";
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? "";

const ALLOWED_ORIGINS = new Set([
  "https://enamed-arena.lovable.app",
  "https://simulados.sanar.com.br",
]);

// Hard caps for the rolling 1-hour window
const MAX_PER_IP = 10;
const MAX_PER_EMAIL = 3;
const WINDOW_MS = 60 * 60 * 1000;

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

async function verifyCaptcha(token: string): Promise<boolean> {
  if (!token) return false;

  if (HCAPTCHA_SECRET) {
    try {
      const form = new URLSearchParams();
      form.set("secret", HCAPTCHA_SECRET);
      form.set("response", token);
      const res = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const data = await res.json();
      return data?.success === true;
    } catch (err) {
      console.error("[create-guest-account] hCaptcha verify error:", err);
      return false;
    }
  }

  if (TURNSTILE_SECRET) {
    try {
      const form = new URLSearchParams();
      form.set("secret", TURNSTILE_SECRET);
      form.set("response", token);
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const data = await res.json();
      return data?.success === true;
    } catch (err) {
      console.error("[create-guest-account] Turnstile verify error:", err);
      return false;
    }
  }

  return false; // should never be reached when callers honor the "captchaRequired" contract
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  // Reject cross-origin and direct-from-CLI calls that don't carry an allowed
  // browser Origin. This alone blocks the majority of scripted abuse.
  const origin = req.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin)) {
    console.warn("[create-guest-account] Blocked non-allowed origin:", origin || "<missing>");
    return json({ error: "Origem não permitida" }, 403, cors);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[create-guest-account] Missing env vars");
    return json({ error: "Configuração inválida" }, 500, cors);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken : "";

    if (!email || !email.includes("@")) return json({ error: "Email é obrigatório" }, 400, cors);
    if (!password || password.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400, cors);
    if (!fullName) return json({ error: "Nome é obrigatório" }, 400, cors);

    // If captcha secrets are configured, a valid token is MANDATORY.
    const captchaRequired = Boolean(HCAPTCHA_SECRET || TURNSTILE_SECRET);
    if (captchaRequired) {
      const ok = await verifyCaptcha(captchaToken);
      if (!ok) {
        console.warn("[create-guest-account] Captcha verification failed");
        return json({ error: "Verificação de segurança falhou. Recarregue a página e tente novamente." }, 400, cors);
      }
    }

    // Rate limit per IP and per email (whichever hits first blocks the request).
    const ip = getClientIp(req);
    const ipHash = await sha256Hex(ip);
    const emailHash = await sha256Hex(email);

    const [{ data: ipCount, error: ipErr }, { data: emailCount, error: emailErr }] = await Promise.all([
      supabaseAdmin.rpc("bump_guest_signup_bucket", { p_bucket_type: "ip",    p_bucket_key: ipHash,    p_window_ms: WINDOW_MS }),
      supabaseAdmin.rpc("bump_guest_signup_bucket", { p_bucket_type: "email", p_bucket_key: emailHash, p_window_ms: WINDOW_MS }),
    ]);

    if (ipErr || emailErr) {
      console.error("[create-guest-account] Rate-limit RPC error:", ipErr?.message ?? emailErr?.message);
      // Fail-closed: if rate limit is broken, refuse rather than silently allowing
      return json({ error: "Serviço temporariamente indisponível" }, 503, cors);
    }

    if ((ipCount ?? 0) > MAX_PER_IP) {
      console.warn("[create-guest-account] IP rate limit exceeded:", ipHash.slice(0, 8));
      return json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, 429, cors);
    }
    if ((emailCount ?? 0) > MAX_PER_EMAIL) {
      console.warn("[create-guest-account] Email rate limit exceeded:", emailHash.slice(0, 8));
      return json({ error: "Muitas tentativas para este e-mail. Tente novamente em alguns minutos." }, 429, cors);
    }

    // Use admin API — bypasses email rate limits entirely
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error) {
      console.error("[create-guest-account] createUser error:", error.message);

      const lower = error.message.toLowerCase();
      if (lower.includes("already been registered") || lower.includes("already registered") || lower.includes("unique_email_address")) {
        return json({ error: "Este e-mail já está cadastrado. Tente fazer login." }, 200, cors);
      }

      return json({ error: error.message }, 200, cors);
    }

    console.log(`[create-guest-account] User created: ${data.user?.id} (emailHash=${emailHash.slice(0, 8)})`);

    return json({ success: true, userId: data.user?.id }, 200, cors);
  } catch (err) {
    console.error("[create-guest-account] Unexpected error:", err);
    return json({ error: "Erro interno" }, 500, cors);
  }
});

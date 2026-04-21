import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const NOVU_EMAIL_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/novu-email`;
// Production default. Override via PASSWORD_RESET_DEFAULT_URL env var for
// deploys that should point users elsewhere (e.g. simulados.sanar.com.br).
const DEFAULT_RESET_URL =
  Deno.env.get("PASSWORD_RESET_DEFAULT_URL")
  ?? "https://simulados.sanar.com.br/reset-password";

// Optional comma-separated allowlist for redirect hostnames.
// Example: PASSWORD_RESET_ALLOWED_HOSTS="simulados.sanar.com.br,app.sanaflix.com"
const EXTRA_HOSTS = (Deno.env.get("PASSWORD_RESET_ALLOWED_HOSTS") ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const DIRECT_HOSTS = new Set<string>([
  "enamed-arena.lovable.app",
  "preview--enamed-arena.lovable.app",
  "simulados.sanar.com.br",
  ...EXTRA_HOSTS,
]);

function isAllowedPreviewHost(hostname: string) {
  return /^id-preview--[a-z0-9-]+\.lovable\.app$/i.test(hostname);
}

function isAllowedResetUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      url.pathname === "/reset-password" &&
      (DIRECT_HOSTS.has(hostname) || isAllowedPreviewHost(hostname))
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function resolveResetUrl(req: Request, requestedRedirectTo?: string) {
  if (requestedRedirectTo && isAllowedResetUrl(requestedRedirectTo)) {
    return requestedRedirectTo;
  }

  const requestOrigin = req.headers.get("origin") ?? "";
  const originBasedResetUrl = `${requestOrigin}/reset-password`;
  if (isAllowedResetUrl(originBasedResetUrl)) {
    return originBasedResetUrl;
  }

  return DEFAULT_RESET_URL;
}

function buildRecoveryUrl(redirectTo: string, properties: { action_link?: string; hashed_token?: string; token_hash?: string; verification_type?: string }) {
  const tokenHash = properties.hashed_token ?? properties.token_hash;

  if (tokenHash) {
    const url = new URL(redirectTo);
    url.searchParams.set("token_hash", tokenHash);
    url.searchParams.set("type", properties.verification_type ?? "recovery");
    return url.toString();
  }

  return properties.action_link ?? redirectTo;
}

function isSilentAuthError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("user not found") || normalized.includes("unable to find user");
}

function getFullName(user: { email?: string; user_metadata?: { full_name?: string } } | null, email: string) {
  return user?.user_metadata?.full_name || user?.email?.split("@")[0] || email.split("@")[0] || "Usuário";
}

Deno.serve(async (req) => {
  const resetUrl = resolveResetUrl(req);
  const corsHeaders = getCorsHeaders(new URL(resetUrl).origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[request-password-reset] Missing Supabase environment variables");
    return new Response(JSON.stringify({ success: false, error: "Configuração inválida" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const redirectTo = resolveResetUrl(req, typeof body?.redirectTo === "string" ? body.redirectTo : undefined);

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Email é obrigatório" }), {
        status: 400,
        headers: { ...getCorsHeaders(new URL(redirectTo).origin), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      if (isSilentAuthError(error.message)) {
        console.log(`[request-password-reset] Silent success for unknown user: ${email}`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...getCorsHeaders(new URL(redirectTo).origin), "Content-Type": "application/json" },
        });
      }

      console.error("[request-password-reset] generateLink error:", error.message);
      return new Response(JSON.stringify({ success: false, error: "Erro ao gerar link de recuperação" }), {
        status: 500,
        headers: { ...getCorsHeaders(new URL(redirectTo).origin), "Content-Type": "application/json" },
      });
    }

    if (!data?.properties) {
      console.error("[request-password-reset] Missing link properties");
      return new Response(JSON.stringify({ success: false, error: "Erro ao gerar link de recuperação" }), {
        status: 500,
        headers: { ...getCorsHeaders(new URL(redirectTo).origin), "Content-Type": "application/json" },
      });
    }

    const actionUrl = buildRecoveryUrl(redirectTo, data.properties);
    const payload = {
      type: "recovery",
      userId: data.user?.id ?? email,
      email,
      fullName: getFullName(data.user ?? null, email),
      actionUrl,
    };

    console.log(`[request-password-reset] Recovery link generated for ${email}`);

    void fetch(NOVU_EMAIL_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          console.error(`[request-password-reset] Novu email error [${response.status}]: ${text}`);
          return;
        }
        console.log(`[request-password-reset] Recovery email queued for ${email}`);
      })
      .catch((fetchError) => {
        console.error("[request-password-reset] Novu email request failed:", fetchError);
      });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...getCorsHeaders(new URL(redirectTo).origin), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[request-password-reset] Error:", error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

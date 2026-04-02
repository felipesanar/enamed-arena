import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = new Set([
  "https://enamed-arena.lovable.app",
  "https://simulados.sanar.com.br",
]);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return /^id-preview--[a-z0-9-]+\.lovable\.app$/i.test(url.hostname);
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

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[create-guest-account] Missing env vars");
    return json({ error: "Configuração inválida" }, 500, cors);
  }

  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";

    if (!email) return json({ error: "Email é obrigatório" }, 400, cors);
    if (!password || password.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400, cors);
    if (!fullName) return json({ error: "Nome é obrigatório" }, 400, cors);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Use admin API — bypasses email rate limits entirely
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so user can log in immediately
      user_metadata: { full_name: fullName },
    });

    if (error) {
      console.error("[create-guest-account] createUser error:", error.message);

      const lower = error.message.toLowerCase();
      if (lower.includes("already been registered") || lower.includes("already registered") || lower.includes("unique_email_address")) {
        return json({ error: "Este e-mail já está cadastrado. Tente fazer login." }, 409, cors);
      }

      return json({ error: error.message }, 400, cors);
    }

    console.log(`[create-guest-account] User created: ${data.user?.id} (${email})`);

    return json({ success: true, userId: data.user?.id }, 200, cors);
  } catch (err) {
    console.error("[create-guest-account] Unexpected error:", err);
    return json({ error: "Erro interno" }, 500, cors);
  }
});

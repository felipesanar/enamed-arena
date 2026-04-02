import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = [
  "https://sanaflix.com",
  "https://app.sanaflix.com",
  "https://simulados.sanaflix.com.br",
  "https://enamed-arena.lovable.app",
  "https://id-preview--389ede2e-db02-48e3-8d83-80bfead9e2f1.lovable.app",
];

const MAX_ATTEMPTS = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (hostname === "sanaflix.com" || hostname.endsWith(".sanaflix.com") || hostname === "sanaflix.com.br" || hostname.endsWith(".sanaflix.com.br")) return true;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (hostname.endsWith(".lovable.app")) return true;
    return false;
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || req.headers.get("referer");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  if (!isAllowedOrigin(origin)) {
    console.error("[sso-magic-link] Blocked origin:", origin);
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  let email: string;
  try {
    const body = await req.json();
    email = (body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email inválido" }), { status: 400, headers });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400, headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Rate limiting ---
  try {
    const { data: rl } = await supabase
      .from("sso_rate_limit")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    const now = Date.now();

    if (rl) {
      const windowExpired = now - new Date(rl.window_start).getTime() > WINDOW_MS;

      if (windowExpired) {
        await supabase
          .from("sso_rate_limit")
          .update({ attempts: 1, window_start: new Date().toISOString() })
          .eq("email", email);
      } else if (rl.attempts >= MAX_ATTEMPTS) {
        console.warn("[sso-magic-link] Rate limit exceeded for:", email);
        return new Response(
          JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
          { status: 429, headers }
        );
      } else {
        await supabase
          .from("sso_rate_limit")
          .update({ attempts: rl.attempts + 1 })
          .eq("email", email);
      }
    } else {
      await supabase
        .from("sso_rate_limit")
        .insert({ email, attempts: 1, window_start: new Date().toISOString() });
    }
  } catch (err) {
    console.error("[sso-magic-link] Rate limit check error:", err);
  }

  // --- Generate magic link (create user if needed) ---
  const redirectTo = "https://simulados.sanaflix.com.br/auth/callback";

  let linkResult = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  // If user doesn't exist, create and retry
  if (linkResult.error) {
    const msg = linkResult.error.message || "";
    if (msg.includes("not found") || msg.includes("Unable") || msg.includes("does not exist")) {
      console.log("[sso-magic-link] User not found, creating:", email);
      const { error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: "" },
      });

      if (createErr) {
        console.error("[sso-magic-link] Create user error:", createErr.message);
        return new Response(
          JSON.stringify({ error: "Erro ao criar conta. Tente novamente." }),
          { status: 500, headers }
        );
      }

      linkResult = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

      if (linkResult.error) {
        console.error("[sso-magic-link] generateLink retry error:", linkResult.error.message);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar link de acesso." }),
          { status: 500, headers }
        );
      }
    } else {
      console.error("[sso-magic-link] generateLink error:", msg);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de acesso." }),
        { status: 500, headers }
      );
    }
  }

  const actionLink = linkResult.data?.properties?.action_link;
  if (!actionLink) {
    console.error("[sso-magic-link] No action_link in response");
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar link." }),
      { status: 500, headers }
    );
  }

  console.log("[sso-magic-link] Magic link generated for:", email);
  return new Response(JSON.stringify({ url: actionLink }), { status: 200, headers });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = [
  "https://sanaflix.com",
  "https://app.sanaflix.com",
  "https://simulados.sanar.com.br",
  "https://enamed-arena.lovable.app",
  "https://id-preview--389ede2e-db02-48e3-8d83-80bfead9e2f1.lovable.app",
];

const MAX_ATTEMPTS = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (hostname === "sanaflix.com" || hostname.endsWith(".sanaflix.com") || hostname === "sanar.com.br" || hostname.endsWith(".sanar.com.br")) return true;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (hostname.endsWith(".lovable.app")) return true;
    if (hostname.endsWith(".lovableproject.com")) return true;
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
  let fullName: string;
  let segment: string;
  let signature: string;
  let timestamp: string;
  try {
    const body = await req.json();
    email = (body.email || "").trim().toLowerCase();
    fullName = (body.name || "").trim();
    segment = (body.segment || "").trim().toLowerCase();
    signature = typeof body.signature === "string" ? body.signature : "";
    timestamp = typeof body.timestamp === "string" ? body.timestamp : "";
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email inválido" }), { status: 400, headers });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400, headers });
  }

  // --- HMAC signature verification for segment elevation ---
  // If the caller wants to set segment=standard|pro, it MUST sign the request
  // with SSO_SIGNING_SECRET (shared between SanarFlix backend and this function).
  // The raw message signed is: `${email}|${segment}|${timestamp}` (ms epoch).
  // Signatures older than 5 minutes are rejected to prevent replay.
  //
  // If no SSO_SIGNING_SECRET is configured, segment is IGNORED (safe default).
  const ssoSigningSecret = Deno.env.get("SSO_SIGNING_SECRET") ?? "";
  let segmentTrusted = false;

  if (segment && ["standard", "pro"].includes(segment)) {
    if (!ssoSigningSecret) {
      console.warn("[sso-magic-link] Segment elevation requested but SSO_SIGNING_SECRET not configured — ignoring segment");
      segment = "";
    } else if (!signature || !timestamp) {
      console.warn("[sso-magic-link] Segment requested without signature/timestamp — ignoring segment");
      segment = "";
    } else {
      const ts = Number(timestamp);
      const now = Date.now();
      if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
        console.warn("[sso-magic-link] Signature timestamp stale or invalid — ignoring segment");
        segment = "";
      } else {
        try {
          const keyBytes = new TextEncoder().encode(ssoSigningSecret);
          const msgBytes = new TextEncoder().encode(`${email}|${segment}|${timestamp}`);
          const key = await crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          );
          const sigBuf = await crypto.subtle.sign("HMAC", key, msgBytes);
          const expectedHex = Array.from(new Uint8Array(sigBuf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          // Constant-time compare
          if (expectedHex.length !== signature.length) {
            segment = "";
          } else {
            let diff = 0;
            for (let i = 0; i < expectedHex.length; i++) {
              diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
            }
            if (diff === 0) {
              segmentTrusted = true;
            } else {
              console.warn("[sso-magic-link] Signature mismatch — ignoring segment");
              segment = "";
            }
          }
        } catch (err) {
          console.error("[sso-magic-link] Signature verify error:", err);
          segment = "";
        }
      }
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const emailHash = await sha256Hex(email);
  const emailRef = `${emailHash.slice(0, 8)}...`;

  // --- Rate limiting ---
  try {
    const { data: rl } = await supabase
      .from("sso_rate_limit")
      .select("*")
      .eq("email_hash", emailHash)
      .maybeSingle();

    const now = Date.now();

    if (rl) {
      const windowExpired = now - new Date(rl.window_start).getTime() > WINDOW_MS;

      if (windowExpired) {
        await supabase
          .from("sso_rate_limit")
          .update({ attempts: 1, window_start: new Date().toISOString() })
          .eq("email_hash", emailHash);
      } else if (rl.attempts >= MAX_ATTEMPTS) {
        console.warn("[sso-magic-link] Rate limit exceeded for hash:", emailRef);
        return new Response(
          JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
          { status: 429, headers }
        );
      } else {
        await supabase
          .from("sso_rate_limit")
          .update({ attempts: rl.attempts + 1 })
          .eq("email_hash", emailHash);
      }
    } else {
      await supabase
        .from("sso_rate_limit")
        .insert({ email_hash: emailHash, attempts: 1, window_start: new Date().toISOString() });
    }
  } catch (err) {
    console.error("[sso-magic-link] Rate limit check error:", err);
  }

  // --- Generate magic link (create user if needed) ---
  const redirectTo = "https://simulados.sanar.com.br/auth/callback";

  let linkResult = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  // If user doesn't exist, create and retry
  if (linkResult.error) {
    const msg = linkResult.error.message || "";
    if (msg.includes("not found") || msg.includes("Unable") || msg.includes("does not exist")) {
      console.log("[sso-magic-link] User not found, creating account for hash:", emailRef);
      const { error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
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

  const userId = linkResult.data?.user?.id;

  // --- Update segment and/or name on profile if provided ---
  if (userId) {
    const profileUpdates: Record<string, string> = {};
    const validSegments = ["standard", "pro"];

    // Only apply segment if signature was trusted
    if (segmentTrusted && segment && validSegments.includes(segment)) {
      profileUpdates.segment = segment;
    }
    if (fullName) {
      profileUpdates.full_name = fullName;
    }

    const promises: Promise<unknown>[] = [];

    // Update profiles table (segment + name)
    if (Object.keys(profileUpdates).length > 0) {
      promises.push(
        Promise.resolve(supabase.from("profiles").update(profileUpdates).eq("id", userId))
          .then(({ error }) => {
            if (error) console.error("[sso-magic-link] Failed to update profile:", error.message);
            else console.log(`[sso-magic-link] Profile updated for ${userId}:`, Object.keys(profileUpdates).join(", "));
          })
      );
    }

    // Update auth metadata (name)
    if (fullName) {
      promises.push(
        supabase.auth.admin.updateUserById(userId, { user_metadata: { full_name: fullName } })
          .then(({ error }) => {
            if (error) console.error("[sso-magic-link] Failed to update auth metadata:", error.message);
            else console.log(`[sso-magic-link] Auth metadata updated for ${userId}`);
          })
      );
    }

    await Promise.all(promises);
  }

  const actionLink = linkResult.data?.properties?.action_link;
  if (!actionLink) {
    console.error("[sso-magic-link] No action_link in response");
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar link." }),
      { status: 500, headers }
    );
  }

  console.log("[sso-magic-link] Magic link generated for hash:", emailRef);
  return new Response(JSON.stringify({ url: actionLink }), { status: 200, headers });
});

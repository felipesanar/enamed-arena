import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// CORS is restrictive: the only legitimate caller is the admin app (browser
// with admin JWT) and our own server-side jobs (with internal secret). No
// wildcard, no public access.
const ALLOWED_ORIGINS = new Set<string>([
  "https://simulados.sanar.com.br",
  "https://enamed-arena.lovable.app",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      /^id-preview--[a-z0-9-]+\.lovable\.app$/i.test(url.hostname) ||
      url.hostname.endsWith(".sanar.com.br")
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && isAllowedOrigin(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const HUBSPOT_WEBHOOK_URL =
  "https://api-na1.hubapi.com/automation/v4/webhook-triggers/9321751/E0lS7db";

// Internal-secret for scheduled server-side jobs (e.g. nightly bulk sync).
// Browser admin callers don't use this — they authenticate via their JWT.
const INTERNAL_SECRET = Deno.env.get("HUBSPOT_SYNC_SECRET") ?? "";

function subscriberType(segment?: string): string {
  if (segment === "pro") return "Aluno PRO";
  if (segment === "standard") return "Aluno SanarFlix";
  return "Não assinante";
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface UserPayload {
  email: string;
  full_name?: string;
  segment?: string;
  created_at?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // ── Caller authorization ──────────────────────────────────────────────────
  // Two legitimate paths:
  //  (1) Admin JWT in Authorization header (browser caller from /admin UI).
  //  (2) Shared HUBSPOT_SYNC_SECRET in x-internal-secret header (server jobs).
  //
  // Without one of these the request is rejected — this endpoint reads
  // profiles with service-role privileges, so unauthenticated access leaks
  // the full user list.
  const internalSecretHeader = req.headers.get("x-internal-secret") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const hasValidInternalSecret =
    INTERNAL_SECRET.length > 0 &&
    internalSecretHeader.length > 0 &&
    constantTimeEqual(internalSecretHeader, INTERNAL_SECRET);

  let authorizedAsAdmin = false;
  if (!hasValidInternalSecret && authHeader.startsWith("Bearer ")) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await callerClient.auth.getUser();
      if (user) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: isAdmin } = await adminClient.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        authorizedAsAdmin = isAdmin === true;
      }
    } catch (err) {
      console.error("[hubspot-contact-sync] Auth check failed:", err);
    }
  }

  if (!hasValidInternalSecret && !authorizedAsAdmin) {
    console.warn("[hubspot-contact-sync] Rejected: no valid credential");
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Mode: "bulk" syncs all existing users, "single" syncs one user.
    // Bulk is restricted to internal-secret callers (cron/scheduled jobs) to
    // avoid letting an admin trigger a multi-thousand-row scan from the UI.
    const mode: string = body.mode || "single";

    if (mode === "bulk") {
      if (!hasValidInternalSecret) {
        console.warn("[hubspot-contact-sync] Bulk denied: admin JWT cannot trigger bulk");
        return new Response(
          JSON.stringify({ error: "Bulk mode requires internal-secret" }),
          { status: 403, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      let allUsers: UserPayload[] = [];
      let from = 0;
      const pageSize = 500;

      while (true) {
        const { data, error } = await supabase
          .from("profiles")
          .select("email, full_name, segment, created_at")
          .not("email", "is", null)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching profiles:", error);
          break;
        }
        if (!data || data.length === 0) break;

        allUsers = allUsers.concat(data as UserPayload[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      console.log(`Bulk sync: ${allUsers.length} users to send`);

      let successCount = 0;
      let failCount = 0;

      for (const user of allUsers) {
        try {
          const res = await fetch(HUBSPOT_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              full_name: user.full_name || "",
              segment: user.segment || "guest",
              subscriber_type: subscriberType(user.segment),
              registered_at: user.created_at || new Date().toISOString(),
              source: "enamed-arena",
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            console.error(`HubSpot error for ${user.email}: ${res.status}`);
          }
        } catch (err) {
          failCount++;
          console.error(`Network error for ${user.email}:`, err);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          total: allUsers.length,
          sent: successCount,
          failed: failCount,
        }),
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    // Single user mode
    const { email, full_name, segment, created_at } = body as UserPayload;

    if (!email || !/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "valid email is required" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const hubspotPayload = {
      email,
      full_name: full_name || "",
      segment: segment || "guest",
      subscriber_type: subscriberType(segment),
      registered_at: created_at || new Date().toISOString(),
      source: "enamed-arena",
    };

    console.log("Sending to HubSpot for email hash prefix:", email.slice(0, 3) + "***");

    const hubspotRes = await fetch(HUBSPOT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hubspotPayload),
    });

    const status = hubspotRes.status;

    if (!hubspotRes.ok) {
      const text = await hubspotRes.text().catch(() => "");
      console.error(`HubSpot non-ok response: ${status} - ${text.slice(0, 200)}`);
    }

    return new Response(
      JSON.stringify({ success: hubspotRes.ok, hubspot_status: status }),
      {
        status: hubspotRes.ok ? 200 : 502,
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

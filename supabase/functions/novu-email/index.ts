import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const NOVU_TRIGGER_URL = "https://kong.app-prod.sanar.cloud/novu/fallback/v1/events/trigger";

// ─── Auth: shared internal secret ────────────────────────────────────────────
// This function is an internal relay between Supabase auth flows and Novu.
// It must NOT be callable from the public internet — otherwise it becomes an
// open relay that spammers can use to send phishing emails from the Sanar
// domain (which has DKIM/SPF aligned with our infra).
//
// Callers are expected to send header `x-internal-secret: <NOVU_RELAY_SECRET>`.
// Use the same value in request-password-reset / auth-email-hook when they
// invoke this function. Keep the secret out of any browser bundle.
const INTERNAL_SECRET = Deno.env.get("NOVU_RELAY_SECRET") ?? "";

// CORS is intentionally restrictive: only OPTIONS requires CORS headers, and
// even then we don't echo arbitrary origins. There's no legitimate browser
// caller for this endpoint.
const corsHeaders = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Action URL allowlist ────────────────────────────────────────────────────
// The action URL is inserted into the email body — it MUST point to a domain
// we control. Otherwise a caller (or attacker who got the secret) could send
// emails branded as Sanar that link to phishing destinations.
const ALLOWED_ACTION_HOSTS: ReadonlyArray<RegExp> = [
  /^simulados\.sanar\.com\.br$/i,
  /^([a-z0-9-]+\.)*sanar\.com\.br$/i,
  /^([a-z0-9-]+\.)*sanaflix\.com$/i,
  /^enamed-arena\.lovable\.app$/i,
  /^id-preview--[a-z0-9-]+\.lovable\.app$/i,
  /^([a-z0-9-]+\.)*supabase\.co$/i, // for direct verify links
];

function isAllowedActionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return ALLOWED_ACTION_HOSTS.some((rx) => rx.test(url.hostname));
  } catch {
    return false;
  }
}

// ─── HTML escape ─────────────────────────────────────────────────────────────
// Email templates are built via string interpolation. Without escaping, a
// crafted firstName like `<script>` or actionUrl with HTML inside would inject
// arbitrary markup into the rendered email (rendered by mail clients that
// support HTML, which is virtually all of them).
function htmlEscape(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

// URLs going into href="..." need stricter handling: must be http(s) and
// already pass the allowlist. We still HTML-escape to neutralize quote breakouts.
function safeHref(value: string): string {
  if (!isAllowedActionUrl(value)) return "#";
  return htmlEscape(value);
}

// ─── Helpers ───

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "Usuário").trim().split(/\s+/);
  return {
    firstName: parts[0] || "Usuário",
    lastName: parts.slice(1).join(" ") || "",
  };
}

// ─── Premium HTML Layout ───

const LOGO_URL = "https://enamed-arena.lovable.app/logo.svg";

function baseLayout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light only"/>
<title>PRO: ENAMED</title>
<style>
  body{margin:0;padding:0;background:#f7f5f3;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#1a1a2e}
  .wrapper{width:100%;background:#f7f5f3;padding:48px 0}
  .container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06)}
  .header{background:linear-gradient(145deg,#3D0F1E 0%,#5A1A2E 50%,#6B1730 100%);padding:36px 40px 32px;text-align:center}
  .header-logo{height:28px;margin-bottom:12px}
  .header-divider{width:40px;height:2px;background:rgba(255,255,255,0.2);margin:0 auto 12px}
  .header-subtitle{margin:0;color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase}
  .body{padding:40px 40px 32px}
  .body h3{margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:700;letter-spacing:-0.01em;line-height:1.3}
  .body p{margin:0 0 16px;color:#4a4a5a;font-size:16px;line-height:1.7}
  .cta-wrap{text-align:center;padding:12px 0 28px}
  .cta{display:inline-block;background:#6B1730;color:#ffffff!important;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.03em}
  .divider{height:1px;background:#eeeae6;margin:28px 0}
  .note{background:#faf8f6;border-radius:8px;padding:16px 20px;margin:0 0 20px}
  .note p{margin:0;color:#6b5a50;font-size:13px;line-height:1.6}
  .note strong{color:#4a3a30}
  .footer{padding:28px 40px;text-align:center;background:#faf8f6;border-top:1px solid #eeeae6}
  .footer p{margin:0;color:#9a9090;font-size:12px;line-height:1.6}
  .footer a{color:#6B1730;text-decoration:none}
  .preheader{display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#f7f5f3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden}
  @media(max-width:640px){.body,.footer{padding-left:24px!important;padding-right:24px!important}.header{padding:28px 24px 24px!important}}
</style>
</head>
<body>
<span class="preheader">${preheader}</span>
<div class="wrapper">
${content}
</div>
</body>
</html>`;
}

function emailHeader(): string {
  return `<div class="header">
    <img src="${LOGO_URL}" alt="PRO: ENAMED" class="header-logo" style="height:28px;display:inline-block;filter:brightness(0) invert(1)"/>
    <div class="header-divider" style="width:40px;height:2px;background:rgba(255,255,255,0.2);margin:12px auto"></div>
    <p class="header-subtitle">Plataforma de simulados para residência médica</p>
  </div>`;
}

function emailFooter(): string {
  return `<div class="footer">
    <p><strong>PRO: ENAMED</strong> · SanarFlix</p>
    <p style="margin-top:6px">Plataforma de simulados para residência médica</p>
    <p style="margin-top:12px">&copy; ${new Date().getFullYear()} Sanar. Todos os direitos reservados.</p>
  </div>`;
}

// ─── Email Templates ───

function welcomeEmailHtml(firstName: string, confirmationUrl: string): string {
  const safeName = htmlEscape(firstName);
  const safeUrl = safeHref(confirmationUrl);
  const content = `<div class="container">
  ${emailHeader()}
  <div class="body">
    <h3>Bem-vindo(a), ${safeName}</h3>
    <p>Sua conta na plataforma <strong>PRO: ENAMED</strong> foi criada com sucesso. Para começar a acessar os simulados, confirme seu endereço de email.</p>
    <div class="cta-wrap">
      <a href="${safeUrl}" class="cta" target="_blank">Confirmar email</a>
    </div>
    <div class="note">
      <p>Este link expira em <strong>1 hora</strong>. Após esse prazo, solicite um novo na página de login.</p>
    </div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#9a9090">Se você não criou esta conta, nenhuma ação é necessária.</p>
  </div>
  ${emailFooter()}
</div>`;
  return baseLayout(content, `${safeName}, confirme seu email para acessar a plataforma PRO: ENAMED`);
}

function recoveryEmailHtml(firstName: string, recoveryUrl: string): string {
  const safeName = htmlEscape(firstName);
  const safeUrl = safeHref(recoveryUrl);
  const content = `<div class="container">
  ${emailHeader()}
  <div class="body">
    <h3>Redefinição de senha</h3>
    <p>Olá, <strong>${safeName}</strong>. Recebemos uma solicitação de redefinição de senha para sua conta na plataforma PRO: ENAMED.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <div class="cta-wrap">
      <a href="${safeUrl}" class="cta" target="_blank">Redefinir senha</a>
    </div>
    <div class="note">
      <p>Este link expira em <strong>1 hora</strong>. Se você não fez essa solicitação, nenhuma ação é necessária — sua senha permanecerá inalterada.</p>
    </div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#9a9090">Em caso de dúvidas, entre em contato com nosso suporte.</p>
  </div>
  ${emailFooter()}
</div>`;
  return baseLayout(content, `${safeName}, redefina sua senha na plataforma PRO: ENAMED`);
}

function magicLinkEmailHtml(firstName: string, magicLinkUrl: string): string {
  const safeName = htmlEscape(firstName);
  const safeUrl = safeHref(magicLinkUrl);
  const content = `<div class="container">
  ${emailHeader()}
  <div class="body">
    <h3>Seu link de acesso</h3>
    <p>Olá, <strong>${safeName}</strong>. Use o botão abaixo para acessar sua conta de forma segura:</p>
    <div class="cta-wrap">
      <a href="${safeUrl}" class="cta" target="_blank">Acessar plataforma</a>
    </div>
    <div class="note">
      <p>Link de uso único, válido por <strong>1 hora</strong>.</p>
    </div>
  </div>
  ${emailFooter()}
</div>`;
  return baseLayout(content, `${safeName}, aqui está seu link de acesso à plataforma PRO: ENAMED`);
}

// ─── Novu Trigger ───

interface NovuPayload {
  type: "welcome" | "recovery" | "magic_link";
  userId: string;
  email: string;
  fullName: string;
  actionUrl: string;
}

async function triggerNovu(payload: NovuPayload): Promise<Response> {
  const { firstName, lastName } = splitName(payload.fullName);

  let subject: string;
  let html: string;

  switch (payload.type) {
    case "welcome":
      subject = "Confirme seu email — PRO: ENAMED";
      html = welcomeEmailHtml(firstName, payload.actionUrl);
      break;
    case "recovery":
      subject = "Redefinição de senha — PRO: ENAMED";
      html = recoveryEmailHtml(firstName, payload.actionUrl);
      break;
    case "magic_link":
      subject = "Seu link de acesso — PRO: ENAMED";
      html = magicLinkEmailHtml(firstName, payload.actionUrl);
      break;
    default:
      throw new Error(`Unknown email type: ${payload.type}`);
  }

  const novuBody = {
    name: "workflow-email",
    to: [
      {
        subscriberId: payload.userId,
        firstName,
        lastName,
        email: payload.email,
      },
    ],
    overrides: {
      email: {
        from: "atendimento@sanar.com.br",
        replyTo: "atendimento@sanar.com.br",
        subject,
        html,
      },
      providers: {
        sendgrid: {
          trackingSettings: {
            clickTracking: { enable: false, enableText: false },
            openTracking: { enable: false },
          },
        },
      },
    },
  };

  console.log(`[novu-email] Triggering ${payload.type} email to ${payload.email}`);

  const res = await fetch(NOVU_TRIGGER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(novuBody),
  });

  const responseText = await res.text();

  if (!res.ok) {
    console.error(`[novu-email] Novu API error [${res.status}]: ${responseText}`);
    throw new Error(`Novu API error: ${res.status}`);
  }

  console.log(`[novu-email] Email triggered successfully for ${payload.email}`);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Handler ───

// Constant-time string compare (avoid timing attacks on the secret)
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Internal-secret gate ─────────────────────────────────────────────────
  // Without this, the function is a public open relay that lets any caller
  // send a Sanar-branded email to any address — i.e. perfect phishing
  // infrastructure. The secret is shared only with our other Edge Functions
  // (request-password-reset, auth-email-hook, create-guest-account).
  if (!INTERNAL_SECRET) {
    console.error("[novu-email] NOVU_RELAY_SECRET not configured — refusing");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!constantTimeEqual(provided, INTERNAL_SECRET)) {
    console.warn("[novu-email] Rejected: missing or invalid x-internal-secret");
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: NovuPayload = await req.json();

    if (!body.type || !body.email || !body.actionUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, email, actionUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject any actionUrl that doesn't point to a Sanar-controlled domain.
    // This is the second layer (the first being the internal secret): even
    // if a relay caller is compromised, it can't redirect users elsewhere.
    if (!isAllowedActionUrl(body.actionUrl)) {
      console.warn("[novu-email] Rejected: actionUrl not in allowlist:", body.actionUrl.slice(0, 100));
      return new Response(
        JSON.stringify({ error: "actionUrl not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic email validation — prevents header injection via newline characters.
    if (!/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(body.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return await triggerNovu(body);
  } catch (error) {
    console.error("[novu-email] Error:", error);
    // Do NOT echo error message back — avoids leaking stack traces / internal paths
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

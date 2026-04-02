import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Supabase Auth Email Hook
 * Intercepts auth email events (signup, recovery, magic_link)
 * and routes them through Novu via the novu-email edge function.
 *
 * Configure in Supabase Dashboard → Auth → Hooks → Send Email Hook
 * pointing to this edge function.
 */

const NOVU_TRIGGER_URL = "https://kong.app-prod.sanar.cloud/novu/fallback/v1/events/trigger";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "Usuário").trim().split(/\s+/);
  return {
    firstName: parts[0] || "Usuário",
    lastName: parts.slice(1).join(" ") || "",
  };
}

// ─── Inline HTML builders (same as novu-email for self-containment) ───

function baseLayout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SanarFlix PRO: ENAMED</title>
<style>
  body{margin:0;padding:0;background:#f5f5f5;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .wrapper{width:100%;background:#f5f5f5;padding:40px 0}
  .container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)}
  .header{background:linear-gradient(135deg,#8E1F3D 0%,#6B1730 100%);padding:32px 40px;text-align:center}
  .header h1{margin:0;color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85}
  .header h2{margin:6px 0 0;color:#fff;font-size:22px;font-weight:800}
  .body{padding:40px}
  .body h3{margin:0 0 8px;color:#1a1a2e;font-size:20px;font-weight:700}
  .body p{margin:0 0 16px;color:#4a4a5a;font-size:15px;line-height:1.65}
  .cta-wrap{text-align:center;padding:8px 0 24px}
  .cta{display:inline-block;background:#8E1F3D;color:#ffffff!important;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700}
  .divider{height:1px;background:#e8e8ee;margin:24px 0}
  .note{background:#faf5f7;border:1px solid #f0e0e6;border-radius:10px;padding:16px 20px;margin:0 0 16px}
  .note p{margin:0;color:#6b4a55;font-size:13px;line-height:1.5}
  .footer{padding:24px 40px;text-align:center;background:#fafafa;border-top:1px solid #f0f0f0}
  .footer p{margin:0;color:#9a9aaa;font-size:12px;line-height:1.5}
  .preheader{display:none!important;font-size:1px;color:#f5f5f5;max-height:0;overflow:hidden}
</style>
</head>
<body>
<span class="preheader">${preheader}</span>
<div class="wrapper">${content}</div>
</body>
</html>`;
}

function buildEmailHtml(type: string, firstName: string, actionUrl: string): { subject: string; html: string } {
  if (type === "signup" || type === "email_change") {
    const subject = "Confirme seu email — PRO: ENAMED";
    const html = baseLayout(`<div class="container">
  <div class="header"><h1>SanarFlix</h1><h2>PRO: ENAMED</h2></div>
  <div class="body">
    <h3>Bem-vindo(a), ${firstName}! 🎉</h3>
    <p>Sua conta foi criada com sucesso. Confirme seu email para começar:</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta">Confirmar meu email</a></div>
    <div class="note"><p>⏱ Link válido por <strong>1 hora</strong>.</p></div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#8a8a9a">Se não criou esta conta, ignore este email.</p>
  </div>
  <div class="footer"><p><strong>Equipe SanarFlix</strong><br/>Simulados para residência médica</p></div>
</div>`, `${firstName}, confirme seu email para acessar PRO: ENAMED`);
    return { subject, html };
  }

  if (type === "recovery") {
    const subject = "Redefinição de senha — PRO: ENAMED";
    const html = baseLayout(`<div class="container">
  <div class="header"><h1>SanarFlix</h1><h2>PRO: ENAMED</h2></div>
  <div class="body">
    <h3>Redefinição de senha</h3>
    <p>Olá, <strong>${firstName}</strong>! Clique abaixo para criar uma nova senha:</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta">Redefinir minha senha</a></div>
    <div class="note"><p>🔒 Link válido por <strong>1 hora</strong>. Se não solicitou, ignore.</p></div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#8a8a9a">Precisa de ajuda? Fale com nosso suporte.</p>
  </div>
  <div class="footer"><p><strong>Equipe SanarFlix</strong><br/>Simulados para residência médica</p></div>
</div>`, `${firstName}, redefina sua senha na PRO: ENAMED`);
    return { subject, html };
  }

  if (type === "magic_link") {
    const subject = "Seu link de acesso — PRO: ENAMED";
    const html = baseLayout(`<div class="container">
  <div class="header"><h1>SanarFlix</h1><h2>PRO: ENAMED</h2></div>
  <div class="body">
    <h3>Seu link de acesso</h3>
    <p>Olá, <strong>${firstName}</strong>! Use o botão abaixo para acessar:</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta">Acessar minha conta</a></div>
    <div class="note"><p>⏱ Link válido por <strong>1 hora</strong>, uso único.</p></div>
  </div>
  <div class="footer"><p><strong>Equipe SanarFlix</strong><br/>Simulados para residência médica</p></div>
</div>`, `${firstName}, aqui está seu link de acesso`);
    return { subject, html };
  }

  // Fallback
  const subject = "Notificação — PRO: ENAMED";
  const html = baseLayout(`<div class="container">
  <div class="header"><h1>SanarFlix</h1><h2>PRO: ENAMED</h2></div>
  <div class="body">
    <p>Olá, <strong>${firstName}</strong>!</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta">Acessar</a></div>
  </div>
  <div class="footer"><p><strong>Equipe SanarFlix</strong></p></div>
</div>`, "Notificação PRO: ENAMED");
  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[auth-email-hook] Full payload:", JSON.stringify(payload));

    // Supabase Auth Send Email Hook payload structure
    // It provides token_hash, NOT a confirmation_url — we must build it
    const user = payload.user || {};
    const emailData = payload.email_data || {};
    const emailType = emailData.email_action_type || payload.type || "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const tokenHash = emailData.token_hash || "";
    const redirectTo = emailData.redirect_to || "https://enamed-arena.lovable.app";

    // Build the verification URL that Supabase expects
    let actionUrl = "";
    if (tokenHash) {
      // Map email_action_type to the Supabase verify type parameter
      const typeMap: Record<string, string> = {
        signup: "signup",
        email_change: "email_change",
        recovery: "recovery",
        magic_link: "magiclink",
        invite: "invite",
        reauthentication: "reauthentication",
      };
      const verifyType = typeMap[emailType] || emailType;
      actionUrl = `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${verifyType}&redirect_to=${encodeURIComponent(redirectTo)}`;
    }

    console.log(`[auth-email-hook] Built actionUrl for type=${emailType}:`, actionUrl ? actionUrl.substring(0, 80) + "..." : "EMPTY");

    const userId = user.id || "anonymous";
    const email = user.email || "";
    const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário";
    const { firstName, lastName } = splitName(fullName);
    const { subject, html } = buildEmailHtml(emailType, firstName, actionUrl);

    // Send via Novu Kong gateway (no API key needed)
    const novuBody = {
      name: "workflow-email",
      to: [
        {
          subscriberId: userId,
          firstName,
          lastName,
          email,
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

    console.log(`[auth-email-hook] Sending ${emailType} email to ${email} via Novu`);

    // Fire-and-forget: respond immediately to avoid Supabase Auth 5s timeout
    const novuPromise = fetch(NOVU_TRIGGER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novuBody),
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        console.error(`[auth-email-hook] Novu error [${res.status}]: ${text}`);
      } else {
        console.log(`[auth-email-hook] Email sent successfully via Novu`);
      }
    }).catch((err) => {
      console.error(`[auth-email-hook] Novu fetch failed:`, err);
    });

    // Keep the promise alive in the background but respond immediately
    // EdgeRuntime will keep the isolate alive until the promise settles
    void novuPromise;

    // Return expected hook response to suppress Supabase default email
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[auth-email-hook] Error:", error);
    // Return 200 to not block auth flow even on error
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

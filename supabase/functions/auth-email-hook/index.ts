import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
<div class="wrapper">${content}</div>
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

function buildEmailHtml(type: string, firstName: string, actionUrl: string): { subject: string; html: string } {
  if (type === "signup" || type === "email_change") {
    const subject = "Confirme seu email — PRO: ENAMED";
    const html = baseLayout(`<div class="container">
  ${emailHeader()}
  <div class="body">
    <h3>Bem-vindo(a), ${firstName}</h3>
    <p>Sua conta na plataforma <strong>PRO: ENAMED</strong> foi criada com sucesso. Para começar a acessar os simulados, confirme seu endereço de email.</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta" target="_blank">Confirmar email</a></div>
    <div class="note"><p>Este link expira em <strong>1 hora</strong>. Após esse prazo, solicite um novo na página de login.</p></div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#9a9090">Se você não criou esta conta, nenhuma ação é necessária.</p>
  </div>
  ${emailFooter()}
</div>`, `${firstName}, confirme seu email para acessar PRO: ENAMED`);
    return { subject, html };
  }

  if (type === "recovery") {
    const subject = "Redefinição de senha — PRO: ENAMED";
    const html = baseLayout(`<div class="container">
  ${emailHeader()}
  <div class="body">
    <h3>Redefinição de senha</h3>
    <p>Olá, <strong>${firstName}</strong>. Recebemos uma solicitação de redefinição de senha para sua conta na plataforma PRO: ENAMED.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta" target="_blank">Redefinir senha</a></div>
    <div class="note"><p>Este link expira em <strong>1 hora</strong>. Se você não fez essa solicitação, nenhuma ação é necessária.</p></div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#9a9090">Em caso de dúvidas, entre em contato com nosso suporte.</p>
  </div>
  ${emailFooter()}
</div>`, `${firstName}, redefina sua senha na PRO: ENAMED`);
    return { subject, html };
  }

  if (type === "magic_link") {
    const subject = "Seu link de acesso — PRO: ENAMED";
    const html = baseLayout(`<div class="container">
  ${emailHeader()}
  <div class="body">
    <h3>Seu link de acesso</h3>
    <p>Olá, <strong>${firstName}</strong>. Use o botão abaixo para acessar sua conta de forma segura:</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta" target="_blank">Acessar plataforma</a></div>
    <div class="note"><p>Link de uso único, válido por <strong>1 hora</strong>.</p></div>
  </div>
  ${emailFooter()}
</div>`, `${firstName}, aqui está seu link de acesso`);
    return { subject, html };
  }

  // Fallback
  const subject = "Notificação — PRO: ENAMED";
  const html = baseLayout(`<div class="container">
  ${emailHeader()}
  <div class="body">
    <p>Olá, <strong>${firstName}</strong>.</p>
    <div class="cta-wrap"><a href="${actionUrl}" class="cta" target="_blank">Acessar</a></div>
  </div>
  ${emailFooter()}
</div>`, "Notificação PRO: ENAMED");
  return { subject, html };
}

// ─── Handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[auth-email-hook] Full payload:", JSON.stringify(payload));

    const user = payload.user || {};
    const emailData = payload.email_data || {};
    const emailType = emailData.email_action_type || payload.type || "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const tokenHash = emailData.token_hash || "";
    const redirectTo = emailData.redirect_to || "https://enamed-arena.lovable.app";

    let actionUrl = "";
    if (tokenHash) {
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

    void novuPromise;

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[auth-email-hook] Error:", error);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

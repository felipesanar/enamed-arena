import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const NOVU_TRIGGER_URL = "https://kong.app-prod.sanar.cloud/novu/fallback/v1/events/trigger";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── HTML Templates ───

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "Usuário").trim().split(/\s+/);
  return {
    firstName: parts[0] || "Usuário",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function baseLayout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>SanarFlix PRO: ENAMED</title>
<style>
  body{margin:0;padding:0;background:#f5f5f5;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrapper{width:100%;background:#f5f5f5;padding:40px 0}
  .container{max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)}
  .header{background:linear-gradient(135deg,#8E1F3D 0%,#6B1730 100%);padding:32px 40px;text-align:center}
  .header h1{margin:0;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85}
  .header h2{margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.01em}
  .body{padding:40px}
  .body h3{margin:0 0 8px;color:#1a1a2e;font-size:20px;font-weight:700}
  .body p{margin:0 0 16px;color:#4a4a5a;font-size:15px;line-height:1.65}
  .cta-wrap{text-align:center;padding:8px 0 24px}
  .cta{display:inline-block;background:#8E1F3D;color:#ffffff!important;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:0.02em;transition:background 0.2s}
  .divider{height:1px;background:#e8e8ee;margin:24px 0}
  .note{background:#faf5f7;border:1px solid #f0e0e6;border-radius:10px;padding:16px 20px;margin:0 0 16px}
  .note p{margin:0;color:#6b4a55;font-size:13px;line-height:1.5}
  .footer{padding:24px 40px;text-align:center;background:#fafafa;border-top:1px solid #f0f0f0}
  .footer p{margin:0;color:#9a9aaa;font-size:12px;line-height:1.5}
  .preheader{display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#f5f5f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden}
  @media(max-width:640px){.body,.footer{padding:24px 20px!important}.header{padding:24px 20px!important}}
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

function welcomeEmailHtml(firstName: string, confirmationUrl: string): string {
  const content = `<div class="container">
  <div class="header">
    <h1>SanarFlix</h1>
    <h2>PRO: ENAMED</h2>
  </div>
  <div class="body">
    <h3>Bem-vindo(a), ${firstName}! 🎉</h3>
    <p>Sua conta na plataforma <strong>PRO: ENAMED</strong> foi criada com sucesso. Estamos felizes em ter você aqui.</p>
    <p>Para ativar sua conta e começar a acessar os simulados, confirme seu email clicando no botão abaixo:</p>
    <div class="cta-wrap">
      <a href="${confirmationUrl}" class="cta" target="_blank">Confirmar meu email</a>
    </div>
    <div class="note">
      <p>⏱ Este link é válido por <strong>1 hora</strong>. Caso expire, solicite um novo link na página de login.</p>
    </div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#8a8a9a">Se você não criou esta conta, ignore este email com segurança.</p>
  </div>
  <div class="footer">
    <p><strong>Equipe SanarFlix</strong><br/>Plataforma de simulados para residência médica</p>
    <p style="margin-top:8px">© ${new Date().getFullYear()} Sanar. Todos os direitos reservados.</p>
  </div>
</div>`;
  return baseLayout(content, `${firstName}, confirme seu email para acessar a plataforma PRO: ENAMED`);
}

function recoveryEmailHtml(firstName: string, recoveryUrl: string): string {
  const content = `<div class="container">
  <div class="header">
    <h1>SanarFlix</h1>
    <h2>PRO: ENAMED</h2>
  </div>
  <div class="body">
    <h3>Redefinição de senha</h3>
    <p>Olá, <strong>${firstName}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta.</p>
    <p>Clique no botão abaixo para criar uma nova senha:</p>
    <div class="cta-wrap">
      <a href="${recoveryUrl}" class="cta" target="_blank">Redefinir minha senha</a>
    </div>
    <div class="note">
      <p>🔒 Este link é válido por <strong>1 hora</strong>. Se você não solicitou esta redefinição, ignore este email — sua senha permanecerá inalterada.</p>
    </div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#8a8a9a">Se precisar de ajuda, entre em contato com nosso suporte.</p>
  </div>
  <div class="footer">
    <p><strong>Equipe SanarFlix</strong><br/>Plataforma de simulados para residência médica</p>
    <p style="margin-top:8px">© ${new Date().getFullYear()} Sanar. Todos os direitos reservados.</p>
  </div>
</div>`;
  return baseLayout(content, `${firstName}, redefina sua senha na plataforma PRO: ENAMED`);
}

function magicLinkEmailHtml(firstName: string, magicLinkUrl: string): string {
  const content = `<div class="container">
  <div class="header">
    <h1>SanarFlix</h1>
    <h2>PRO: ENAMED</h2>
  </div>
  <div class="body">
    <h3>Seu link de acesso</h3>
    <p>Olá, <strong>${firstName}</strong>! Use o botão abaixo para acessar sua conta:</p>
    <div class="cta-wrap">
      <a href="${magicLinkUrl}" class="cta" target="_blank">Acessar minha conta</a>
    </div>
    <div class="note">
      <p>⏱ Este link é válido por <strong>1 hora</strong> e pode ser usado apenas uma vez.</p>
    </div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#8a8a9a">Se você não solicitou este link, ignore este email.</p>
  </div>
  <div class="footer">
    <p><strong>Equipe SanarFlix</strong><br/>Plataforma de simulados para residência médica</p>
    <p style="margin-top:8px">© ${new Date().getFullYear()} Sanar. Todos os direitos reservados.</p>
  </div>
</div>`;
  return baseLayout(content, `${firstName}, aqui está seu link de acesso à plataforma PRO: ENAMED`);
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: NovuPayload = await req.json();

    if (!body.type || !body.email || !body.actionUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, email, actionUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return await triggerNovu(body);
  } catch (error) {
    console.error("[novu-email] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

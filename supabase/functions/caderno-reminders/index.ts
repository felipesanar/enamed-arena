// =============================================================================
// caderno-reminders — Scheduled edge function (Caderno de Erros, plano 08 §3.1)
// =============================================================================
// Dispara o lembrete diário de "revisão devida" do Caderno de Erros: para cada
// usuário PRO com entradas SRS devidas hoje que NÃO desativou o opt-in
// `caderno_daily_review`, aciona um workflow do Novu via o mesmo relay interno
// usado por `novu-email`.
//
// -----------------------------------------------------------------------------
// STATUS — decisão de Produto PENDENTE (canais/cadência)
// -----------------------------------------------------------------------------
// Esta função é um SCAFFOLD deployável com NO-OP gracioso. Enquanto o env do
// Novu não estiver configurado (ver abaixo), ela apenas LOGA o que faria e
// retorna 200 sem disparar nada. Isso permite agendar o pg_cron já (ver
// migration 20260607140000_caderno_reminders_cron.sql) sem risco de spam.
//
// O time precisa, para ir ao ar:
//   1. Criar o workflow/template no Novu (assunto, corpo, canais — email/push/
//      in-app). O canal e a cadência exata são decisão de Produto.
//   2. Definir o WORKFLOW_ID resultante em `CADERNO_REMINDER_WORKFLOW_ID`.
//   3. Confirmar os secrets do relay (mesmos de novu-email).
//
// -----------------------------------------------------------------------------
// ENV VARS NECESSÁRIAS (Supabase → Edge Functions → Secrets)
// -----------------------------------------------------------------------------
//   SUPABASE_URL                  (injetado pela plataforma)
//   SUPABASE_SERVICE_ROLE_KEY     (injetado pela plataforma) — necessário pois a
//                                 função roda fora de um contexto de usuário e
//                                 precisa varrer entradas de TODOS os usuários,
//                                 bypassando RLS. Nunca expor no bundle do app.
//   NOVU_TRIGGER_URL              URL do endpoint de trigger do Novu (mesmo host
//                                 usado por novu-email).
//                                 TODO(team): confirmar valor de produção.
//   NOVU_RELAY_SECRET             Segredo interno compartilhado com novu-email
//                                 (header x-internal-secret). NÃO inventar — o
//                                 time deve reusar o secret existente.
//   CADERNO_REMINDER_WORKFLOW_ID  Nome/ID do workflow Novu a disparar.
//                                 TODO(team): criar o workflow no Novu e colar o
//                                 ID aqui. Sem isso, a função faz no-op.
//   CADERNO_REMINDER_ACTION_URL   (opcional) URL de CTA inserida no payload do
//                                 Novu. Default: https://simulados.sanar.com.br/caderno
//
// -----------------------------------------------------------------------------
// AGENDAMENTO (pg_cron)
// -----------------------------------------------------------------------------
// Invocada 1x/dia às 08:00 BRT (11:00 UTC) por pg_cron via net.http_post.
// Ver supabase/migrations/20260607140000_caderno_reminders_cron.sql.
//
// -----------------------------------------------------------------------------
// SEGURANÇA
// -----------------------------------------------------------------------------
// Como novu-email, esta função NÃO deve ser chamável da internet pública: ela
// dispara comunicações em nome da Sanar. Exige o header `x-internal-secret`
// (mesmo NOVU_RELAY_SECRET). O pg_cron envia esse header (ver migration).
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_ACTION_URL = "https://simulados.sanar.com.br/caderno";

// Constant-time compare (avoid timing attacks on the secret) — copiado de novu-email.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

interface DueUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  due_count: number;
}

function splitName(fullName: string | null): { firstName: string; lastName: string } {
  const parts = (fullName || "Usuário").trim().split(/\s+/);
  return {
    firstName: parts[0] || "Usuário",
    lastName: parts.slice(1).join(" ") || "",
  };
}

// Aciona o Novu para UM usuário. Usa o MESMO contrato de novu-email:
// POST com header x-internal-secret e body { name, to: [...], payload, overrides }.
async function triggerReminder(params: {
  triggerUrl: string;
  relaySecret: string;
  workflowId: string;
  actionUrl: string;
  user: DueUser;
}): Promise<boolean> {
  const { triggerUrl, relaySecret, workflowId, actionUrl, user } = params;
  const { firstName, lastName } = splitName(user.full_name);

  const novuBody = {
    name: workflowId,
    to: [
      {
        subscriberId: user.user_id,
        firstName,
        lastName,
        email: user.email ?? undefined,
      },
    ],
    // O payload alimenta as variáveis do template Novu. As chaves abaixo são
    // uma proposta — o template real é responsabilidade do time (ver header).
    payload: {
      dueCount: user.due_count,
      actionUrl,
      firstName,
    },
  };

  const res = await fetch(triggerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Mesmo gate de relay interno usado por novu-email.
      "x-internal-secret": relaySecret,
    },
    body: JSON.stringify(novuBody),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[caderno-reminders] Novu error [${res.status}] for ${user.user_id}: ${text.slice(0, 200)}`,
    );
    return false;
  }
  return true;
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

  // ── Env ──────────────────────────────────────────────────────────────────
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const RELAY_SECRET = Deno.env.get("NOVU_RELAY_SECRET") ?? "";
  const TRIGGER_URL = Deno.env.get("NOVU_TRIGGER_URL") ?? "";
  // TODO(team): criar o workflow no Novu e definir este ID. Sem ele → no-op.
  const WORKFLOW_ID = Deno.env.get("CADERNO_REMINDER_WORKFLOW_ID") ?? "";
  const ACTION_URL = Deno.env.get("CADERNO_REMINDER_ACTION_URL") ?? DEFAULT_ACTION_URL;

  // ── Internal-secret gate ───────────────────────────────────────────────────
  // Sem segredo configurado, recusa em vez de virar relay aberto (como novu-email).
  if (!RELAY_SECRET) {
    console.error("[caderno-reminders] NOVU_RELAY_SECRET não configurado — recusando");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!constantTimeEqual(provided, RELAY_SECRET)) {
    console.warn("[caderno-reminders] Rejeitado: x-internal-secret ausente ou inválido");
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("[caderno-reminders] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes — no-op");
    // No-op gracioso: não é erro fatal, só não há como consultar.
    return new Response(
      JSON.stringify({ skipped: true, reason: "missing_supabase_env" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Service-role client: a função varre entradas de TODOS os usuários, fora de
    // um contexto de usuário, então precisa bypassar RLS. Chave nunca vai ao app.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 1. Encontrar usuários PRO com entradas SRS devidas hoje e opt-in ativo ──
    // Estratégia sem RPC dedicado (mantém o slice no escopo da migration de
    // tabela + cron): consultamos error_notebook devido (srs_due_at <= now,
    // não resolvido/dominado/deletado), juntamos com profiles (segment='pro')
    // e respeitamos notification_preferences.caderno_daily_review.
    //
    // Opt-out: linha em notification_preferences com caderno_daily_review=false
    // → pulamos. Ausência de linha = default opt-in (true), consistente com a
    // migration 20260607130000.
    const nowIso = new Date().toISOString();

    const { data: dueRows, error: dueErr } = await admin
      .from("error_notebook")
      .select("user_id")
      .lte("srs_due_at", nowIso)
      .is("resolved_at", null)
      .is("mastered_at", null)
      .is("deleted_at", null)
      .not("srs_due_at", "is", null);

    if (dueErr) {
      console.error("[caderno-reminders] Erro consultando error_notebook:", dueErr.message);
      // No-op gracioso (não lançar) — provavelmente schema ainda não migrado.
      return new Response(
        JSON.stringify({ skipped: true, reason: "due_query_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Agrega contagem de devidas por usuário.
    const dueCountByUser = new Map<string, number>();
    for (const row of dueRows ?? []) {
      const uid = (row as { user_id: string }).user_id;
      dueCountByUser.set(uid, (dueCountByUser.get(uid) ?? 0) + 1);
    }
    const candidateIds = [...dueCountByUser.keys()];

    if (candidateIds.length === 0) {
      console.log("[caderno-reminders] Nenhum usuário com revisões devidas hoje.");
      return new Response(
        JSON.stringify({ ok: true, candidates: 0, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Perfis PRO entre os candidatos.
    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("id, email, full_name, segment")
      .in("id", candidateIds)
      .eq("segment", "pro");

    if (profErr) {
      console.error("[caderno-reminders] Erro consultando profiles:", profErr.message);
      return new Response(
        JSON.stringify({ skipped: true, reason: "profiles_query_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const proIds = (profiles ?? []).map((p) => (p as { id: string }).id);
    if (proIds.length === 0) {
      console.log("[caderno-reminders] Nenhum candidato PRO.");
      return new Response(
        JSON.stringify({ ok: true, candidates: candidateIds.length, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Opt-outs: usuários que desativaram caderno_daily_review.
    const { data: prefs, error: prefErr } = await admin
      .from("notification_preferences")
      .select("user_id, caderno_daily_review")
      .in("user_id", proIds);

    if (prefErr) {
      // Tabela pode ainda não estar migrada → tratamos como "todos opt-in"
      // (default), mas logamos. Não é fatal.
      console.warn(
        "[caderno-reminders] notification_preferences indisponível, assumindo opt-in:",
        prefErr.message,
      );
    }

    const optedOut = new Set<string>();
    for (const p of prefs ?? []) {
      const pref = p as { user_id: string; caderno_daily_review: boolean };
      if (pref.caderno_daily_review === false) optedOut.add(pref.user_id);
    }

    const targets: DueUser[] = (profiles ?? [])
      .map((p) => p as { id: string; email: string | null; full_name: string | null })
      .filter((p) => !optedOut.has(p.id))
      .map((p) => ({
        user_id: p.id,
        email: p.email,
        full_name: p.full_name,
        due_count: dueCountByUser.get(p.id) ?? 0,
      }));

    // ── 2. No-op gracioso se o Novu não estiver configurado ────────────────────
    // Decisão de Produto pendente: enquanto não há workflow/URL, NÃO disparamos.
    // Logamos o que faríamos para observabilidade e retornamos 200.
    if (!TRIGGER_URL || !WORKFLOW_ID) {
      console.log(
        `[caderno-reminders] NO-OP (Novu não configurado): disparariamos para ${targets.length} usuário(s) PRO. ` +
          `Faltando: ${[
            !TRIGGER_URL ? "NOVU_TRIGGER_URL" : null,
            !WORKFLOW_ID ? "CADERNO_REMINDER_WORKFLOW_ID" : null,
          ]
            .filter(Boolean)
            .join(", ")}.`,
      );
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "noop_novu_unconfigured",
          candidates: candidateIds.length,
          eligible: targets.length,
          sent: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Disparar (best-effort, um por usuário) ──────────────────────────────
    let sent = 0;
    for (const user of targets) {
      try {
        const ok = await triggerReminder({
          triggerUrl: TRIGGER_URL,
          relaySecret: RELAY_SECRET,
          workflowId: WORKFLOW_ID,
          actionUrl: ACTION_URL,
          user,
        });
        if (ok) sent++;
      } catch (e) {
        // Falha de um usuário não derruba o batch.
        console.error(`[caderno-reminders] Falha ao disparar para ${user.user_id}:`, e);
      }
    }

    console.log(
      `[caderno-reminders] Concluído: ${sent}/${targets.length} lembretes disparados.`,
    );
    return new Response(
      JSON.stringify({
        ok: true,
        candidates: candidateIds.length,
        eligible: targets.length,
        sent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    // Nunca lançar para fora: cron job não deve falhar ruidosamente.
    console.error("[caderno-reminders] Erro inesperado:", error);
    return new Response(
      JSON.stringify({ skipped: true, reason: "unexpected_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// =============================================================================
// gabarito-key-alerts — Scheduled edge function
// =============================================================================
// Avisa por e-mail quando o sinal de distribuição aponta gabarito errado num
// simulado cuja janela de execução já fechou.
//
// Ver docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md
//
// Por que existe: nos três incidentes de gabarito errado (S5 Q35, S5 Q46,
// S6 Q49) o erro foi descoberto por ALUNO, não pelo time. No S6 o sinal ficou
// completo por ~33h entre o fechamento da janela (15/08 23:59) e a liberação
// dos resultados (17/08 09:01) — 265 respostas, 228 numa alternativa contra 18
// no "gabarito" — e ninguém abriu o /admin nesse intervalo. As superfícies
// dentro do admin (banner/seção/badge) são a defesa principal; este e-mail é o
// escalonamento para quando ninguém abre o admin.
//
// -----------------------------------------------------------------------------
// STATUS — nasce em NO-OP até o time configurar o env
// -----------------------------------------------------------------------------
// Mesmo padrão do `caderno-reminders`: sem os secrets, esta função apenas LOGA
// o que faria e retorna 200, sem disparar e-mail e SEM gravar em
// gabarito_key_alerts (gravar sem ter avisado "consumiria" o alerta em
// silêncio — o pior dos mundos).
//
// AVISO HONESTO: o scaffold equivalente do `caderno-reminders` foi mergeado em
// 2026-06 e NUNCA foi configurado. Se ninguém ligar o env, este alerta também
// não dispara. Não conte com ele como única linha de defesa.
//
// -----------------------------------------------------------------------------
// ENV VARS NECESSÁRIAS (Supabase → Edge Functions → Secrets)
// -----------------------------------------------------------------------------
//   SUPABASE_URL               (injetado pela plataforma)
//   SUPABASE_SERVICE_ROLE_KEY  (injetado) — roda fora de contexto de usuário e
//                              precisa varrer attempts de todos os alunos.
//   NOVU_RELAY_SECRET          — mesmo valor que `novu-email` espera no header
//                              x-internal-secret.
//   GABARITO_ALERT_EMAILS      — destinatários, separados por vírgula.
//   ADMIN_BASE_URL             — (opcional) origem do link do e-mail. Default
//                              https://enamed-arena.lovable.app. Precisa estar
//                              na ALLOWED_ACTION_HOSTS de `novu-email`.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─── Limiares do sinal ───────────────────────────────────────────────────────
// ATENÇÃO: precisam bater com `src/admin/lib/suspectKey.ts` (mesma regra, outro
// runtime — Deno não importa de src/). Se divergirem, o e-mail mente em relação
// ao que o admin mostra na tela. Mudou aqui, muda lá.
const MIN_RESPONSES = 30;
const MAX_CORRECT_RATE = 20;
const MIN_TOP_WRONG_PCT = 45;

const DEFAULT_ADMIN_BASE_URL = "https://enamed-arena.lovable.app";

interface KeyStatRow {
  question_number: number;
  correct_rate: number;
  top_wrong_label: string | null;
  top_wrong_pct: number | null;
  total_responses: number;
}

interface Suspect {
  questionNumber: number;
  correctRate: number;
  topWrongLabel: string;
  topWrongPct: number;
  totalResponses: number;
}

/** Mesma regra de `findSuspectKeys` no front. O discriminante é a CONCENTRAÇÃO
 *  das respostas erradas, não a dificuldade: questão difícil de verdade espalha
 *  os erros entre as alternativas. */
function selectSuspects(rows: KeyStatRow[]): Suspect[] {
  return rows
    .filter((r) =>
      r.top_wrong_label != null &&
      r.top_wrong_pct != null &&
      Number(r.total_responses) >= MIN_RESPONSES &&
      Number(r.correct_rate) <= MAX_CORRECT_RATE &&
      Number(r.top_wrong_pct) >= MIN_TOP_WRONG_PCT
    )
    .map((r) => ({
      questionNumber: Number(r.question_number),
      correctRate: Number(r.correct_rate),
      topWrongLabel: String(r.top_wrong_label),
      topWrongPct: Number(r.top_wrong_pct),
      totalResponses: Number(r.total_responses),
    }))
    .sort((a, b) => a.correctRate - b.correctRate);
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const relaySecret = Deno.env.get("NOVU_RELAY_SECRET") ?? "";
    const recipientsRaw = Deno.env.get("GABARITO_ALERT_EMAILS") ?? "";
    const adminBaseUrl = Deno.env.get("ADMIN_BASE_URL") ?? DEFAULT_ADMIN_BASE_URL;

    const recipients = recipientsRaw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    // Sem env não há como avisar ninguém. Segue em modo observação: loga o que
    // faria e NÃO grava em gabarito_key_alerts.
    const dryRun = !relaySecret || recipients.length === 0;
    if (dryRun) {
      console.warn(
        "[gabarito-key-alerts] NO-OP: falta NOVU_RELAY_SECRET e/ou GABARITO_ALERT_EMAILS. " +
          "Vou apenas logar as suspeitas encontradas, sem enviar e sem marcar como alertadas.",
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const nowIso = new Date().toISOString();
    const graceIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Simulados com execução encerrada e resultado ainda não liberado (janela de
    // ouro), mais os liberados nas últimas 48h — nesses ainda vale muito avisar,
    // porque o reprocessamento de notas é mais barato quanto mais cedo.
    const { data: simulados, error: simErr } = await admin
      .from("simulados")
      .select("id, title, sequence_number, execution_window_end, results_release_at")
      .eq("status", "published")
      .lt("execution_window_end", nowIso)
      .gt("results_release_at", graceIso);
    if (simErr) throw simErr;

    const report: Array<Record<string, unknown>> = [];

    for (const s of simulados ?? []) {
      const { data: rows, error: statsErr } = await admin.rpc("gabarito_key_stats", {
        p_simulado_id: s.id,
      });
      if (statsErr) {
        console.error(`[gabarito-key-alerts] stats falhou p/ simulado ${s.id}:`, statsErr);
        continue;
      }

      const suspects = selectSuspects((rows ?? []) as KeyStatRow[]);
      if (suspects.length === 0) continue;

      // Já alertadas e ainda não resolvidas não voltam.
      const { data: existing, error: exErr } = await admin
        .from("gabarito_key_alerts")
        .select("question_number")
        .eq("simulado_id", s.id)
        .is("resolved_at", null);
      if (exErr) {
        console.error(`[gabarito-key-alerts] dedup falhou p/ simulado ${s.id}:`, exErr);
        continue;
      }
      const alreadyAlerted = new Set((existing ?? []).map((r: any) => Number(r.question_number)));
      const fresh = suspects.filter((q) => !alreadyAlerted.has(q.questionNumber));

      if (fresh.length === 0) continue;

      report.push({
        simulado: `#${s.sequence_number} ${s.title}`,
        questoes: fresh.map((q) =>
          `Q${q.questionNumber}: ${q.correctRate}% de acerto, ${q.topWrongPct}% marcaram ${q.topWrongLabel} (${q.totalResponses} respostas)`
        ),
      });

      if (dryRun) {
        console.log(
          `[gabarito-key-alerts] (dry-run) Simulado #${s.sequence_number}: ` +
            fresh.map((q) => `Q${q.questionNumber}`).join(", "),
        );
        continue;
      }

      // Envia ANTES de marcar: se o e-mail falhar, a questão segue "não
      // alertada" e entra de novo amanhã. O inverso perderia o alerta.
      const actionUrl = `${adminBaseUrl}/admin/simulados/${s.id}/analytics`;
      let sent = 0;
      for (const email of recipients) {
        const res = await fetch(`${supabaseUrl}/functions/v1/novu-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": relaySecret,
          },
          body: JSON.stringify({
            type: "ops_gabarito_alert",
            userId: `ops-gabarito-${s.id}`,
            email,
            fullName: "Equipe ENAMED",
            actionUrl,
            simuladoLabel: `#${s.sequence_number} · ${s.title}`,
            suspects: fresh.map((q) => ({
              questionNumber: q.questionNumber,
              correctRate: q.correctRate,
              topWrongLabel: q.topWrongLabel,
              topWrongPct: q.topWrongPct,
              totalResponses: q.totalResponses,
            })),
          }),
        });
        if (res.ok) sent++;
        else console.error(`[gabarito-key-alerts] relay falhou p/ ${email}: ${res.status}`);
      }

      if (sent === 0) {
        console.error(`[gabarito-key-alerts] nenhum e-mail saiu p/ simulado ${s.id} — não marco como alertado`);
        continue;
      }

      const { error: insErr } = await admin.from("gabarito_key_alerts").insert(
        fresh.map((q) => ({
          simulado_id: s.id,
          question_number: q.questionNumber,
          correct_rate: q.correctRate,
          top_wrong_label: q.topWrongLabel,
          top_wrong_pct: q.topWrongPct,
          total_responses: q.totalResponses,
        })),
      );
      if (insErr) console.error(`[gabarito-key-alerts] insert de dedup falhou p/ ${s.id}:`, insErr);
    }

    console.log(`[gabarito-key-alerts] concluído. Simulados com suspeita nova: ${report.length}`);
    return new Response(JSON.stringify({ dryRun, simuladosComSuspeita: report.length, report }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[gabarito-key-alerts] erro:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

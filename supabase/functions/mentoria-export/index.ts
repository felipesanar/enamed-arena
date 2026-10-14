// mentoria-export — exporta resultados de simulados dos alunos cujos e-mails
// vierem na requisição, para o Academy (Página do Mentor).
//
// POST { "emails": [...até 2000], "desde": ISO | null }
// Header: x-mentoria-export-secret (== env MENTORIA_EXPORT_SECRET)
//
// Uso: o chamador deve agrupar ~100 e-mails por requisição e passar `desde`
// nas execuções incrementais (o teto de 2000 é só do contrato, não a meta).
// - Só devolve alunos cujo e-mail veio na requisição; nunca lista a base.
// - Sem CORS: chamada servidor-a-servidor.
// - verify_jwt = false (supabase/config.toml); o gate é o segredo compartilhado.
// - Erros internos: 500 { erro: 'erro_interno' }, sem detalhes na resposta.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import {
  compararSegredo,
  montarExportacao,
  validarCorpo,
  type LinhasCruas,
} from "./montar.ts";

const PAGINA = 1000;
const LOTE_IN = 200;

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lotes<T>(itens: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

// deno-lint-ignore no-explicit-any
type Cliente = any;

// Pagina uma consulta (o PostgREST corta em 1000 linhas por padrao). A fabrica
// devolve a consulta ja com filtros e .order() deterministico.
async function buscarTudo<T>(
  // deno-lint-ignore no-explicit-any
  fabrica: () => any,
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; ) {
    const { data, error } = await fabrica().range(de, de + PAGINA - 1);
    if (error) throw error;
    const linhas = (data ?? []) as T[];
    todas.push(...linhas);
    de += linhas.length; // avança pelo que veio, não pelo que foi pedido
    // Para só em página vazia: se o max_rows do PostgREST for menor que PAGINA,
    // uma página curta não significa fim e truncaria em silêncio.
    if (linhas.length === 0) break;
  }
  return todas;
}

async function coletar(
  db: Cliente,
  emails: string[],
  desde: string | null,
): Promise<LinhasCruas> {
  const desdeMs = desde ? Date.parse(desde) : null;

  // Perfis por e-mail (e-mails são 100% minúsculos em profiles.email).
  const perfis = (
    await Promise.all(
      lotes(emails, LOTE_IN).map((lote) =>
        buscarTudo<LinhasCruas["perfis"][number]>(() =>
          db
            .from("profiles")
            .select("id, full_name, email, segment")
            .in("email", lote)
            .order("id")
        )
      ),
    )
  ).flat();
  const userIds = perfis.map((p) => p.id);

  const [simulados, questoes, opcoes, especialidades, instituicoes, cortes] = await Promise.all([
    buscarTudo<LinhasCruas["simulados"][number]>(() =>
      db
        .from("simulados")
        .select(
          "id, title, sequence_number, questions_count, execution_window_start, execution_window_end, status",
        )
        .order("id")
    ),
    buscarTudo<LinhasCruas["questoes"][number]>(() =>
      db
        .from("questions")
        .select("id, simulado_id, question_number, area, theme")
        .order("id")
    ),
    buscarTudo<LinhasCruas["opcoes"][number]>(() =>
      db.from("question_options").select("id, question_id, label, is_correct").order("id")
    ),
    buscarTudo<LinhasCruas["especialidades"][number]>(() =>
      db.from("enamed_specialties").select("id, name").order("id")
    ),
    buscarTudo<LinhasCruas["instituicoes"][number]>(() =>
      db.from("enamed_institutions").select("id, name").order("id")
    ),
    buscarTudo<LinhasCruas["cortes"][number]>(() =>
      db
        .from("enamed_cutoff_scores")
        .select("institution_id, specialty_id, cutoff_score_general, cutoff_score_quota")
        .not("institution_id", "is", null)
        .not("specialty_id", "is", null)
        .order("institution_id")
        .order("specialty_id")
        .order("id")
    ),
  ]);

  const onboarding = (
    await Promise.all(
      lotes(userIds, LOTE_IN).map((lote) =>
        buscarTudo<LinhasCruas["onboarding"][number]>(() =>
          db
            .from("onboarding_profiles")
            .select("user_id, specialty_id, target_institution_ids")
            .in("user_id", lote)
            .order("user_id")
        )
      ),
    )
  ).flat();

  const tentativas = (
    await Promise.all(
      lotes(userIds, LOTE_IN).map((lote) =>
        buscarTudo<LinhasCruas["tentativas"][number]>(() =>
          db
            .from("attempts")
            .select(
              "id, simulado_id, user_id, finished_at, score_percentage, total_correct, total_answered, attempt_type",
            )
            .in("user_id", lote)
            .not("finished_at", "is", null)
            .order("id")
        )
      ),
    )
  ).flat();

  // Respostas só das tentativas finalizadas a partir de `desde`.
  const idsParaRespostas = tentativas
    .filter((t) => desdeMs === null || Date.parse(t.finished_at as string) >= desdeMs)
    .map((t) => t.id);
  const resultados: LinhasCruas["resultados"] = [];
  for (const lote of lotes(idsParaRespostas, 50)) {
    resultados.push(
      ...(await buscarTudo<LinhasCruas["resultados"][number]>(() =>
        db
          .from("attempt_question_results")
          .select("attempt_id, question_id, selected_option_id, is_correct, was_answered")
          .in("attempt_id", lote)
          .order("attempt_id")
          .order("question_id")
      )),
    );
  }

  return {
    perfis,
    onboarding,
    especialidades,
    instituicoes,
    cortes,
    simulados,
    questoes,
    opcoes,
    tentativas,
    resultados,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "metodo_nao_permitido" });

  const esperado = Deno.env.get("MENTORIA_EXPORT_SECRET") ?? "";
  const recebido = req.headers.get("x-mentoria-export-secret") ?? "";
  // Sem segredo configurado, nada passa (nunca aceitar "" == "").
  if (!esperado || !compararSegredo(recebido, esperado)) {
    return json(401, { erro: "nao_autorizado" });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return json(400, { erro: "emails_invalidos" });
  }
  const validacao = validarCorpo(corpo);
  if (!validacao.ok) return json(validacao.status, { erro: validacao.erro });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const linhas = await coletar(db, validacao.emails, validacao.desde);
    const saida = montarExportacao(linhas, validacao.desde, new Date().toISOString());
    return json(200, saida);
  } catch (_e) {
    // Sem detalhes na resposta nem no log (podem conter e-mails).
    return json(500, { erro: "erro_interno" });
  }
});

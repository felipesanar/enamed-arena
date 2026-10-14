// mentoria-export — lógica pura (sem APIs do Deno), testável sob Vitest.
// Recebe as linhas cruas das tabelas e devolve o JSON do contrato.

export const MAX_EMAILS = 2000;

export interface PerfilRow {
  id: string;
  full_name: string | null;
  email: string | null;
  segment: string | null;
}
export interface OnboardingRow {
  user_id: string;
  specialty_id: string | null;
  target_institution_ids: string[] | null;
}
export interface EspecialidadeRow {
  id: string;
  name: string;
}
export interface InstituicaoRow {
  id: string;
  name: string;
}
export interface CorteRow {
  institution_id: string;
  specialty_id: string;
  cutoff_score_general: number | string | null;
  cutoff_score_quota: number | string | null;
}
export interface SimuladoRow {
  id: string;
  title: string;
  sequence_number: number;
  questions_count: number;
  execution_window_start: string | null;
  execution_window_end: string | null;
  status: string;
}
export interface QuestaoRow {
  id: string;
  simulado_id: string;
  question_number: number;
  area: string | null;
  theme: string | null;
}
export interface OpcaoRow {
  id: string;
  question_id: string;
  label: string;
  is_correct: boolean;
}
export interface TentativaRow {
  id: string;
  simulado_id: string;
  user_id: string;
  finished_at: string | null;
  score_percentage: number | null;
  total_correct: number | null;
  total_answered: number | null;
  attempt_type: string | null;
}
export interface ResultadoRow {
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_correct: boolean | null;
  was_answered: boolean | null;
}

export interface LinhasCruas {
  perfis: PerfilRow[];
  onboarding: OnboardingRow[];
  especialidades: EspecialidadeRow[];
  instituicoes: InstituicaoRow[];
  cortes: CorteRow[];
  simulados: SimuladoRow[];
  questoes: QuestaoRow[];
  opcoes: OpcaoRow[];
  tentativas: TentativaRow[];
  resultados: ResultadoRow[];
}

function numOuNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function montarExportacao(
  linhas: LinhasCruas,
  desde: string | null,
  geradoEm: string,
) {
  const desdeMs = desde ? Date.parse(desde) : null;

  const especialidadePorId = new Map(linhas.especialidades.map((e) => [e.id, e]));
  const instituicaoPorId = new Map(linhas.instituicoes.map((i) => [i.id, i]));
  const onboardingPorUser = new Map(linhas.onboarding.map((o) => [o.user_id, o]));
  const cortePorChave = new Map(
    linhas.cortes.map((c) => [`${c.institution_id}|${c.specialty_id}`, c]),
  );

  const opcaoPorId = new Map(linhas.opcoes.map((o) => [o.id, o]));
  const corretaPorQuestao = new Map<string, string>();
  for (const o of linhas.opcoes) {
    if (o.is_correct && !corretaPorQuestao.has(o.question_id)) {
      corretaPorQuestao.set(o.question_id, o.label);
    }
  }

  const tentativasPorUser = new Map<string, TentativaRow[]>();
  for (const t of linhas.tentativas) {
    if (!t.finished_at) continue; // não finalizada: ignorada
    const lista = tentativasPorUser.get(t.user_id) ?? [];
    lista.push(t);
    tentativasPorUser.set(t.user_id, lista);
  }

  const resultadosPorTentativa = new Map<string, ResultadoRow[]>();
  for (const r of linhas.resultados) {
    const lista = resultadosPorTentativa.get(r.attempt_id) ?? [];
    lista.push(r);
    resultadosPorTentativa.set(r.attempt_id, lista);
  }

  const simulados = [...linhas.simulados]
    .sort((a, b) => a.sequence_number - b.sequence_number)
    .map((s) => ({
      id: s.id,
      sequence_number: s.sequence_number,
      title: s.title,
      questions_count: s.questions_count,
      execution_window_start: s.execution_window_start,
      execution_window_end: s.execution_window_end,
      status: s.status,
    }));

  const questoes = linhas.questoes.map((q) => ({
    id: q.id,
    simulado_id: q.simulado_id,
    question_number: q.question_number,
    area: q.area,
    theme: q.theme,
    correta_label: corretaPorQuestao.get(q.id) ?? null,
  }));

  const vistos = new Set<string>();
  const alunos = [];
  for (const perfil of linhas.perfis) {
    const email = (perfil.email ?? "").trim().toLowerCase();
    if (!email || vistos.has(email)) continue;
    vistos.add(email);

    const onb = onboardingPorUser.get(perfil.id);
    const esp = onb?.specialty_id ? especialidadePorId.get(onb.specialty_id) : undefined;
    const especialidade = esp ? { id: esp.id, nome: esp.name } : null;

    const alvos = [];
    if (especialidade) {
      for (const instId of onb?.target_institution_ids ?? []) {
        const corte = cortePorChave.get(`${instId}|${especialidade.id}`);
        if (!corte) continue; // sem corte para a especialidade do aluno: fora
        alvos.push({
          institution_id: instId,
          nome: instituicaoPorId.get(instId)?.name ?? null,
          corte_geral: numOuNull(corte.cutoff_score_general),
          corte_cota: numOuNull(corte.cutoff_score_quota),
        });
      }
    }

    const tentativasRaw = tentativasPorUser.get(perfil.id) ?? [];
    const tentativas = tentativasRaw.map((t) => ({
      id: t.id,
      simulado_id: t.simulado_id,
      finished_at: t.finished_at,
      score_percentage: t.score_percentage,
      total_correct: t.total_correct,
      total_answered: t.total_answered,
      attempt_type: t.attempt_type,
    }));

    const respostas = [];
    for (const t of tentativasRaw) {
      if (desdeMs !== null && !(Date.parse(t.finished_at as string) >= desdeMs)) continue;
      for (const r of resultadosPorTentativa.get(t.id) ?? []) {
        respostas.push({
          attempt_id: r.attempt_id,
          question_id: r.question_id,
          selected_label: r.selected_option_id
            ? opcaoPorId.get(r.selected_option_id)?.label ?? null
            : null,
          is_correct: r.is_correct,
          was_answered: r.was_answered,
        });
      }
    }

    alunos.push({
      email,
      nome: perfil.full_name,
      segment: perfil.segment,
      especialidade,
      alvos,
      tentativas,
      respostas,
    });
  }

  return { gerado_em: geradoEm, simulados, questoes, alunos };
}

export type ValidacaoCorpo =
  | { ok: true; emails: string[]; desde: string | null }
  | { ok: false; status: 400; erro: "emails_invalidos" };

const INVALIDO: ValidacaoCorpo = { ok: false, status: 400, erro: "emails_invalidos" };

export function validarCorpo(body: unknown): ValidacaoCorpo {
  if (!body || typeof body !== "object") return INVALIDO;
  const { emails, desde } = body as { emails?: unknown; desde?: unknown };
  if (!Array.isArray(emails)) return INVALIDO;
  if (emails.length < 1 || emails.length > MAX_EMAILS) return INVALIDO;
  const normalizados: string[] = [];
  for (const e of emails) {
    if (typeof e !== "string") return INVALIDO;
    const n = e.trim().toLowerCase();
    if (!n) return INVALIDO;
    normalizados.push(n);
  }
  const desdeOk =
    typeof desde === "string" && desde.trim() && Number.isFinite(Date.parse(desde))
      ? desde
      : null;
  return { ok: true, emails: [...new Set(normalizados)], desde: desdeOk };
}

// Comparação em tempo constante (não vaza o ponto da primeira diferença).
export function compararSegredo(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const tamanho = Math.max(ba.length, bb.length);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < tamanho; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

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
  results_release_at: string | null;
  status: string;
}
export interface QuestaoRow {
  id: string;
  simulado_id: string;
  question_number: number;
  area: string | null;
  theme: string | null;
  text: string | null;
  explanation: string | null;
  // As imagens já são URLs públicas completas do bucket público `question-images`
  // (verificado em prod: 154/154 valores no formato
  // https://<proj>.supabase.co/storage/v1/object/public/question-images/...),
  // portanto seguem direto no payload, sem assinar.
  image_url: string | null;
  image_url_2: string | null;
  explanation_image_url: string | null;
  difficulty: string | null;
}
// `text` e `is_correct` vêm ausentes nas linhas de simulados ainda não liberados
// (a consulta só busca id/question_id/label deles, para resolver selected_label
// sem trazer o gabarito). A montagem só exporta opções de simulados liberados.
export interface OpcaoRow {
  id: string;
  question_id: string;
  label: string;
  text?: string | null;
  is_correct?: boolean | null;
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
  is_within_window: boolean | null;
}
// Linha leve de TODAS as tentativas finalizadas da base (não só as dos alunos
// pedidos): o ranking precisa da população completa de cada simulado.
export interface RankingRow {
  id: string;
  simulado_id: string;
  user_id: string;
  status: string | null;
  finished_at: string | null;
  score_percentage: number | string | null;
  is_within_window: boolean | null;
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
  // População do ranking: todas as tentativas finalizadas (status submitted/expired).
  ranking: RankingRow[];
  resultados: ResultadoRow[];
}

export interface PosicaoRanking {
  posicao: number | null;
  participantes: number;
  percentil: number | null;
}

// Regra de ranking copiada da plataforma (não inventada). Fonte:
//  - supabase/migrations/20260624212300_fix_admin_get_ranking_dedupe_best_attempt.sql
//    (admin_get_ranking_for_simulado: CTE `best` + ROW_NUMBER);
//  - supabase/migrations/20260624212600_fix_admin_get_user_attempts_rownumber_dedupe.sql
//    (admin_get_user_attempts: ranking_position só na tentativa vencedora;
//    as demais tentativas do aluno ficam com posição null);
//  - get_ranking_for_simulado em 20260611140000_canonical_academic_rpcs.sql
//    (mesmo filtro e mesma ordenação do ranking que o aluno vê).
// Regra:
//  1. Elegível: status in ('submitted','expired'), score_percentage não nulo e
//     is_within_window = true (tentativa fora da janela é treino, não ranqueia).
//     Online e offline (presencial) contam juntos.
//  2. Uma tentativa por aluno e simulado: a de MAIOR nota; empate de nota entre
//     as tentativas do mesmo aluno, a que finalizou primeiro.
//  3. Ordem: nota desc, finished_at asc (quem terminou antes fica à frente).
//     posicao = ROW_NUMBER() sobre essa ordem: empates de nota NÃO dividem
//     posição, o desempate é o finished_at (id só garante determinismo).
//  4. participantes = nº de alunos elegíveis no simulado (total_candidatos da RPC).
// A plataforma não tem percentil; derivado: 100*(participantes-posicao)/(participantes-1),
// 1 casa decimal (1º = 100, último = 0; null com 1 participante).
// Não aplica o gate de results_release_at da RPC do aluno: é exportação interna.
// Tentativas fora da população (treino, perdedoras do dedupe) recebem posicao e
// percentil null, mas `participantes` do simulado preenchido.
export function calcularRanking(linhas: RankingRow[]): {
  porTentativa: Map<string, PosicaoRanking>;
  participantesPorSimulado: Map<string, number>;
} {
  const nota = (r: RankingRow) => Number(r.score_percentage);
  const ms = (r: RankingRow) => (r.finished_at ? Date.parse(r.finished_at) : Infinity);
  const porNotaTempo = (a: RankingRow, b: RankingRow) =>
    nota(b) - nota(a) || ms(a) - ms(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const melhorPorAluno = new Map<string, RankingRow>(); // chave simulado|user
  for (const r of linhas) {
    if (r.status !== "submitted" && r.status !== "expired") continue;
    if (r.score_percentage === null || r.score_percentage === undefined) continue;
    if (!Number.isFinite(nota(r))) continue;
    if (r.is_within_window !== true) continue;
    const chave = `${r.simulado_id}|${r.user_id}`;
    const atual = melhorPorAluno.get(chave);
    if (!atual || porNotaTempo(r, atual) < 0) melhorPorAluno.set(chave, r);
  }

  const porSimulado = new Map<string, RankingRow[]>();
  for (const r of melhorPorAluno.values()) {
    const lista = porSimulado.get(r.simulado_id) ?? [];
    lista.push(r);
    porSimulado.set(r.simulado_id, lista);
  }

  const porTentativa = new Map<string, PosicaoRanking>();
  const participantesPorSimulado = new Map<string, number>();
  for (const [simuladoId, lista] of porSimulado) {
    lista.sort(porNotaTempo);
    const n = lista.length;
    participantesPorSimulado.set(simuladoId, n);
    lista.forEach((r, i) => {
      const posicao = i + 1;
      porTentativa.set(r.id, {
        posicao,
        participantes: n,
        percentil: n > 1 ? Math.round((1000 * (n - posicao)) / (n - 1)) / 10 : null,
      });
    });
  }
  return { porTentativa, participantesPorSimulado };
}

// Regra de liberação (a mesma do Academy):
//   agora >= greatest(coalesce(results_release_at, execution_window_end), execution_window_end)
// Sem execution_window_end (ou data inválida) = NÃO liberado. Gabarito e
// enunciados de simulado ainda em andamento não saem da plataforma.
export function simuladoLiberado(
  sim: Pick<SimuladoRow, "execution_window_end" | "results_release_at">,
  agora: Date,
): boolean {
  const agoraMs = agora.getTime();
  if (!Number.isFinite(agoraMs)) return false;
  if (!sim.execution_window_end) return false;
  const fim = Date.parse(sim.execution_window_end);
  if (!Number.isFinite(fim)) return false;
  let limite = fim;
  if (sim.results_release_at) {
    const lib = Date.parse(sim.results_release_at);
    if (!Number.isFinite(lib)) return false;
    limite = Math.max(lib, fim);
  }
  return agoraMs >= limite;
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
  agora: Date,
) {
  const desdeMs = desde ? Date.parse(desde) : null;

  const especialidadePorId = new Map(linhas.especialidades.map((e) => [e.id, e]));
  const instituicaoPorId = new Map(linhas.instituicoes.map((i) => [i.id, i]));
  const onboardingPorUser = new Map(linhas.onboarding.map((o) => [o.user_id, o]));
  // Há uma linha por (instituição, especialidade, cenário de prática): vale a de
  // MAIOR cutoff_score_general (mesma regra da RPC get_cutoff_scores), e a cota
  // vem da mesma linha.
  const cortePorChave = new Map<string, CorteRow>();
  for (const c of linhas.cortes) {
    const chave = `${c.institution_id}|${c.specialty_id}`;
    const atual = cortePorChave.get(chave);
    const novo = numOuNull(c.cutoff_score_general) ?? -Infinity;
    const antigo = atual ? numOuNull(atual.cutoff_score_general) ?? -Infinity : -Infinity;
    if (!atual || novo > antigo) cortePorChave.set(chave, c);
  }

  // Só simulados publicados saem da plataforma; rascunhos (e tudo que pende deles:
  // questões, opções, tentativas, respostas, ranking) ficam de fora.
  const simuladosPub = linhas.simulados.filter((s) => s.status === "published");
  const idsPub = new Set(simuladosPub.map((s) => s.id));
  const idsLiberados = new Set(
    simuladosPub.filter((s) => simuladoLiberado(s, agora)).map((s) => s.id),
  );

  const questoesPub = linhas.questoes.filter((q) => idsPub.has(q.simulado_id));
  const questoesLiberadas = new Set(
    questoesPub.filter((q) => idsLiberados.has(q.simulado_id)).map((q) => q.id),
  );
  const questoesPubIds = new Set(questoesPub.map((q) => q.id));

  // Rótulo da alternativa marcada: resolvido para qualquer questão publicada
  // (inclusive não liberada: o rótulo marcado pelo aluno não vaza o gabarito).
  const opcoesPub = linhas.opcoes.filter((o) => questoesPubIds.has(o.question_id));
  const opcaoPorId = new Map(opcoesPub.map((o) => [o.id, o]));
  // Opções e gabarito: só de questões de simulados liberados.
  const opcoesLiberadas = opcoesPub.filter((o) => questoesLiberadas.has(o.question_id));
  const corretaPorQuestao = new Map<string, string>();
  for (const o of opcoesLiberadas) {
    if (o.is_correct && !corretaPorQuestao.has(o.question_id)) {
      corretaPorQuestao.set(o.question_id, o.label);
    }
  }

  const ranking = calcularRanking(
    (linhas.ranking ?? []).filter((r) => idsPub.has(r.simulado_id)),
  );

  const opcoes = opcoesLiberadas.map((o) => ({
    id: o.id,
    question_id: o.question_id,
    label: o.label,
    text: o.text ?? null,
    is_correct: o.is_correct ?? false,
  }));

  const tentativasPorUser = new Map<string, TentativaRow[]>();
  for (const t of linhas.tentativas) {
    if (!t.finished_at) continue; // não finalizada: ignorada
    if (!idsPub.has(t.simulado_id)) continue; // simulado não publicado: fora
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

  const simulados = [...simuladosPub]
    .sort((a, b) => a.sequence_number - b.sequence_number)
    .map((s) => ({
      id: s.id,
      sequence_number: s.sequence_number,
      title: s.title,
      questions_count: s.questions_count,
      execution_window_start: s.execution_window_start,
      execution_window_end: s.execution_window_end,
      results_release_at: s.results_release_at ?? null,
      status: s.status,
    }));

  // Simulado não liberado: a linha da questão sai (as FKs das respostas seguem
  // valendo), mas enunciado, explicação, imagens e gabarito ficam null.
  const questoes = questoesPub.map((q) => {
    const liberada = questoesLiberadas.has(q.id);
    return {
      id: q.id,
      simulado_id: q.simulado_id,
      question_number: q.question_number,
      area: q.area,
      theme: q.theme,
      text: liberada ? q.text ?? null : null,
      explanation: liberada ? q.explanation ?? null : null,
      image_url: liberada ? q.image_url ?? null : null,
      image_url_2: liberada ? q.image_url_2 ?? null : null,
      explanation_image_url: liberada ? q.explanation_image_url ?? null : null,
      difficulty: q.difficulty ?? null,
      correta_label: liberada ? corretaPorQuestao.get(q.id) ?? null : null,
    };
  });

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
    const tentativas = tentativasRaw.map((t) => {
      const pos = ranking.porTentativa.get(t.id);
      return {
        id: t.id,
        simulado_id: t.simulado_id,
        finished_at: t.finished_at,
        score_percentage: t.score_percentage,
        total_correct: t.total_correct,
        total_answered: t.total_answered,
        attempt_type: t.attempt_type,
        is_within_window: t.is_within_window ?? null,
        posicao: pos?.posicao ?? null,
        participantes:
          pos?.participantes ?? ranking.participantesPorSimulado.get(t.simulado_id) ?? 0,
        percentil: pos?.percentil ?? null,
      };
    });

    const respostas = [];
    for (const t of tentativasRaw) {
      const liberado = idsLiberados.has(t.simulado_id);
      if (desdeMs !== null && !(Date.parse(t.finished_at as string) >= desdeMs)) continue;
      for (const r of resultadosPorTentativa.get(t.id) ?? []) {
        respostas.push({
          attempt_id: r.attempt_id,
          question_id: r.question_id,
          selected_label: r.selected_option_id
            ? opcaoPorId.get(r.selected_option_id)?.label ?? null
            : null,
          // is_correct entrega o gabarito: null enquanto o simulado não for liberado.
          is_correct: liberado ? r.is_correct : null,
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

  return { gerado_em: geradoEm, simulados, questoes, opcoes, alunos };
}

export type ValidacaoCorpo =
  | { ok: true; emails: string[]; desde: string | null }
  | { ok: false; status: 400; erro: "emails_invalidos" | "desde_invalido" };

const INVALIDO: ValidacaoCorpo = { ok: false, status: 400, erro: "emails_invalidos" };
const DESDE_INVALIDO: ValidacaoCorpo = { ok: false, status: 400, erro: "desde_invalido" };

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
  // `desde` ausente/null = tudo; presente porém inválido = erro (um typo não
  // pode despejar todas as respostas).
  let desdeOk: string | null = null;
  if (desde !== undefined && desde !== null) {
    if (typeof desde !== "string" || !Number.isFinite(Date.parse(desde))) return DESDE_INVALIDO;
    desdeOk = desde;
  }
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

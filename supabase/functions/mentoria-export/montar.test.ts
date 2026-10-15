// supabase/functions/mentoria-export/montar.test.ts
import { describe, it, expect } from "vitest";
import {
  calcularRanking,
  compararSegredo,
  montarExportacao,
  simuladoLiberado,
  validarCorpo,
  type LinhasCruas,
  type RankingRow,
} from "./montar";

function base(): LinhasCruas {
  return {
    perfis: [
      { id: "u1", full_name: "Ana", email: "a@x.com", segment: "pro" },
      { id: "u2", full_name: "Beto", email: "b@x.com", segment: "pro" },
    ],
    onboarding: [
      { user_id: "u1", specialty_id: "sp1", target_institution_ids: ["i1", "i2"] },
    ],
    especialidades: [{ id: "sp1", name: "Cardiologia" }],
    instituicoes: [
      { id: "i1", name: "HC-FMUSP" },
      { id: "i2", name: "Sem Corte" },
    ],
    cortes: [
      { institution_id: "i1", specialty_id: "sp1", cutoff_score_general: "82.0", cutoff_score_quota: 75 },
      { institution_id: "i2", specialty_id: "outra", cutoff_score_general: 90, cutoff_score_quota: 80 },
    ],
    simulados: [
      {
        id: "s2", title: "Simulado 2", sequence_number: 2, questions_count: 1,
        execution_window_start: "2026-02-01T00:00:00Z", execution_window_end: "2026-02-10T00:00:00Z",
        results_release_at: null, status: "published",
      },
      {
        id: "s1", title: "Simulado 1", sequence_number: 1, questions_count: 1,
        execution_window_start: "2026-01-01T00:00:00Z", execution_window_end: "2026-01-10T00:00:00Z",
        results_release_at: "2026-01-12T00:00:00Z", status: "published",
      },
    ],
    questoes: [
      { id: "q1", simulado_id: "s1", question_number: 1, area: "Clínica Médica", theme: "Hipertensão",
        text: "Enunciado 1", explanation: "Porque C", image_url: "https://x/img1.png", image_url_2: null,
        explanation_image_url: null, difficulty: "media",
      },
    ],
    opcoes: [
      { id: "o1", question_id: "q1", label: "A", text: "Alfa", is_correct: false },
      { id: "o2", question_id: "q1", label: "B", text: "Beta", is_correct: false },
      { id: "o3", question_id: "q1", label: "C", text: null, is_correct: true },
    ],
    tentativas: [
      {
        id: "t1", simulado_id: "s1", user_id: "u1", finished_at: "2026-01-05T10:00:00Z",
        score_percentage: 61, total_correct: 61, total_answered: 98, attempt_type: "online", is_within_window: true,
      },
      {
        id: "t2", simulado_id: "s2", user_id: "u1", finished_at: null,
        score_percentage: null, total_correct: null, total_answered: null, attempt_type: "online", is_within_window: true,
      },
    ],
    ranking: [],
    resultados: [
      { attempt_id: "t1", question_id: "q1", selected_option_id: "o2", is_correct: false, was_answered: true },
      { attempt_id: "t2", question_id: "q1", selected_option_id: "o3", is_correct: true, was_answered: true },
    ],
  };
}

const GERADO = "2026-10-15T07:00:00Z";
const AGORA = new Date(GERADO);

describe("montarExportacao", () => {
  it("devolve gerado_em, simulados ordenados e questões com correta_label", () => {
    const out = montarExportacao(base(), null, GERADO, AGORA);
    expect(out.gerado_em).toBe(GERADO);
    expect(out.simulados.map((s) => s.sequence_number)).toEqual([1, 2]);
    expect(out.questoes).toEqual([
      {
        id: "q1", simulado_id: "s1", question_number: 1, area: "Clínica Médica", theme: "Hipertensão",
        text: "Enunciado 1", explanation: "Porque C", image_url: "https://x/img1.png", image_url_2: null,
        explanation_image_url: null, difficulty: "media", correta_label: "C",
      },
    ]);
  });

  it("aluno sem onboarding -> especialidade null e alvos []", () => {
    const out = montarExportacao(base(), null, GERADO, AGORA);
    const beto = out.alunos.find((a) => a.email === "b@x.com")!;
    expect(beto.especialidade).toBeNull();
    expect(beto.alvos).toEqual([]);
    expect(beto.tentativas).toEqual([]);
    expect(beto.respostas).toEqual([]);
  });

  it("alvo sem corte para a especialidade do aluno fica fora de alvos", () => {
    const out = montarExportacao(base(), null, GERADO, AGORA);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.especialidade).toEqual({ id: "sp1", nome: "Cardiologia" });
    expect(ana.alvos).toEqual([
      { institution_id: "i1", nome: "HC-FMUSP", corte_geral: 82, corte_cota: 75 },
    ]);
  });

  it("vários cenários por instituição+especialidade: vale o maior corte geral, com a cota da mesma linha", () => {
    const l = base();
    l.cortes = [
      { institution_id: "i1", specialty_id: "sp1", cutoff_score_general: 70, cutoff_score_quota: 99 },
      { institution_id: "i1", specialty_id: "sp1", cutoff_score_general: "88.5", cutoff_score_quota: 60 },
      { institution_id: "i1", specialty_id: "sp1", cutoff_score_general: 80, cutoff_score_quota: 95 },
    ];
    const ana = montarExportacao(l, null, GERADO, AGORA).alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.alvos).toEqual([
      { institution_id: "i1", nome: "HC-FMUSP", corte_geral: 88.5, corte_cota: 60 },
    ]);
  });

  it("selected_label vem de question_options.label", () => {
    const out = montarExportacao(base(), null, GERADO, AGORA);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.respostas).toEqual([
      { attempt_id: "t1", question_id: "q1", selected_label: "B", is_correct: false, was_answered: true },
    ]);
  });

  it("selected_label é null quando não respondeu", () => {
    const l = base();
    l.resultados = [
      { attempt_id: "t1", question_id: "q1", selected_option_id: null, is_correct: false, was_answered: false },
    ];
    const ana = montarExportacao(l, null, GERADO, AGORA).alunos[0];
    expect(ana.respostas[0].selected_label).toBeNull();
  });

  it("tentativa não finalizada é ignorada (tentativas e respostas)", () => {
    const out = montarExportacao(base(), null, GERADO, AGORA);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.tentativas.map((t) => t.id)).toEqual(["t1"]);
    expect(ana.respostas.some((r) => r.attempt_id === "t2")).toBe(false);
  });

  it("desde filtra só as respostas; tentativas finalizadas continuam todas", () => {
    const out = montarExportacao(base(), "2026-01-06T00:00:00Z", GERADO, AGORA);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.tentativas.map((t) => t.id)).toEqual(["t1"]);
    expect(ana.respostas).toEqual([]);
  });

  it("desde igual ao finished_at inclui as respostas (>=)", () => {
    const out = montarExportacao(base(), "2026-01-05T10:00:00Z", GERADO, AGORA);
    expect(out.alunos.find((a) => a.email === "a@x.com")!.respostas).toHaveLength(1);
  });

  it("agrupa por e-mail minúsculo e ignora duplicados/sem e-mail", () => {
    const l = base();
    l.perfis.push({ id: "u3", full_name: "Dup", email: "A@X.com", segment: "pro" });
    l.perfis.push({ id: "u4", full_name: "Sem", email: null, segment: "pro" });
    const out = montarExportacao(l, null, GERADO, AGORA);
    expect(out.alunos.map((a) => a.email)).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("validarCorpo", () => {
  it("rejeita não-array, ausente, vazio e > 2000", () => {
    for (const body of [null, undefined, "x", {}, { emails: "a@x.com" }, { emails: [] }]) {
      expect(validarCorpo(body)).toEqual({ ok: false, status: 400, erro: "emails_invalidos" });
    }
    const muitos = Array.from({ length: 2001 }, (_, i) => `u${i}@x.com`);
    expect(validarCorpo({ emails: muitos })).toEqual({ ok: false, status: 400, erro: "emails_invalidos" });
  });

  it("aceita exatamente 2000", () => {
    const emails = Array.from({ length: 2000 }, (_, i) => `u${i}@x.com`);
    const r = validarCorpo({ emails });
    expect(r.ok).toBe(true);
  });

  it("rejeita itens que não são string ou vazios", () => {
    expect(validarCorpo({ emails: ["a@x.com", 3] }).ok).toBe(false);
    expect(validarCorpo({ emails: ["a@x.com", "  "] }).ok).toBe(false);
  });

  it("desde presente mas inválido -> 400 desde_invalido", () => {
    for (const desde of ["lixo", "", 123, {}]) {
      expect(validarCorpo({ emails: ["a@x.com"], desde })).toEqual({
        ok: false,
        status: 400,
        erro: "desde_invalido",
      });
    }
  });

  it("normaliza (trim, minúsculo) e deduplica; desde opcional", () => {
    const r = validarCorpo({ emails: [" A@X.com ", "a@x.com", "B@x.com"], desde: "2026-01-01T00:00:00Z" });
    expect(r).toEqual({ ok: true, emails: ["a@x.com", "b@x.com"], desde: "2026-01-01T00:00:00Z" });
    expect(validarCorpo({ emails: ["a@x.com"] })).toEqual({ ok: true, emails: ["a@x.com"], desde: null });
    expect(validarCorpo({ emails: ["a@x.com"], desde: null })).toMatchObject({ desde: null });
  });
});

describe("compararSegredo", () => {
  it("true só para strings idênticas", () => {
    expect(compararSegredo("segredo", "segredo")).toBe(true);
    expect(compararSegredo("segredo", "segredx")).toBe(false);
    expect(compararSegredo("segredo", "segredo2")).toBe(false);
    expect(compararSegredo("", "segredo")).toBe(false);
    expect(compararSegredo("", "")).toBe(true);
  });
});

describe("campos novos do contrato", () => {
  it("simulados expõem results_release_at", () => {
    const out = montarExportacao(base(), null, GERADO, AGORA);
    expect(out.simulados.map((s) => s.results_release_at)).toEqual(["2026-01-12T00:00:00Z", null]);
  });

  it("opcoes: todas as opções, com text e is_correct", () => {
    const out = montarExportacao(base(), null, GERADO, AGORA);
    expect(out.opcoes).toEqual([
      { id: "o1", question_id: "q1", label: "A", text: "Alfa", is_correct: false },
      { id: "o2", question_id: "q1", label: "B", text: "Beta", is_correct: false },
      { id: "o3", question_id: "q1", label: "C", text: null, is_correct: true },
    ]);
  });

  it("questões: campos ausentes viram null", () => {
    const l = base();
    // linha vinda sem as colunas novas (undefined)
    l.questoes = [{ id: "q9", simulado_id: "s1", question_number: 2, area: null, theme: null } as never];
    const q = montarExportacao(l, null, GERADO, AGORA).questoes[0];
    expect(q).toMatchObject({
      text: null, explanation: null, image_url: null, image_url_2: null,
      explanation_image_url: null, difficulty: null,
    });
  });

  it("tentativa traz is_within_window e ranking (sem população = participantes 0)", () => {
    const t = montarExportacao(base(), null, GERADO, AGORA).alunos[0].tentativas[0];
    expect(t).toMatchObject({
      is_within_window: true, posicao: null, participantes: 0, percentil: null,
    });
  });

  it("tentativa recebe posicao/participantes/percentil do ranking", () => {
    const l = base();
    l.ranking = [
      r("t1", "s1", "u1", 61, "2026-01-05T10:00:00Z"),
      r("x1", "s1", "u9", 80, "2026-01-04T10:00:00Z"),
      r("x2", "s1", "u8", 40, "2026-01-04T11:00:00Z"),
    ];
    const t = montarExportacao(l, null, GERADO, AGORA).alunos[0].tentativas[0];
    expect(t).toMatchObject({ posicao: 2, participantes: 3, percentil: 50 });
  });

  it("tentativa fora do ranking (treino) mantém participantes do simulado e posicao/percentil null", () => {
    const l = base();
    l.tentativas[0].is_within_window = false;
    l.ranking = [
      r("t1", "s1", "u1", 61, "2026-01-05T10:00:00Z", { is_within_window: false }),
      r("x1", "s1", "u9", 80, "2026-01-04T10:00:00Z"),
      r("x2", "s1", "u8", 40, "2026-01-04T11:00:00Z"),
    ];
    const t = montarExportacao(l, null, GERADO, AGORA).alunos[0].tentativas[0];
    expect(t).toMatchObject({
      is_within_window: false, posicao: null, participantes: 2, percentil: null,
    });
  });
});

function r(
  id: string, simulado_id: string, user_id: string, nota: number | string | null,
  finished_at: string | null, extra: Partial<RankingRow> = {},
): RankingRow {
  return {
    id, simulado_id, user_id, status: "submitted", finished_at,
    score_percentage: nota, is_within_window: true, ...extra,
  };
}

describe("calcularRanking", () => {
  it("ordena por nota desc; posição = row_number; percentil 100 no 1º e 0 no último", () => {
    const { porTentativa, participantesPorSimulado } = calcularRanking([
      r("a", "s1", "u1", 50, "2026-01-01T10:00:00Z"),
      r("b", "s1", "u2", 90, "2026-01-01T10:00:00Z"),
      r("c", "s1", "u3", 70, "2026-01-01T10:00:00Z"),
    ]);
    expect(porTentativa.get("b")).toEqual({ posicao: 1, participantes: 3, percentil: 100 });
    expect(porTentativa.get("c")).toEqual({ posicao: 2, participantes: 3, percentil: 50 });
    expect(porTentativa.get("a")).toEqual({ posicao: 3, participantes: 3, percentil: 0 });
    expect(participantesPorSimulado.get("s1")).toBe(3);
  });

  it("empate de nota NÃO divide posição: desempata por finished_at (quem terminou antes)", () => {
    const { porTentativa } = calcularRanking([
      r("tarde", "s1", "u1", 80, "2026-01-01T12:00:00Z"),
      r("cedo", "s1", "u2", 80, "2026-01-01T09:00:00Z"),
    ]);
    expect(porTentativa.get("cedo")!.posicao).toBe(1);
    expect(porTentativa.get("tarde")!.posicao).toBe(2);
  });

  it("fora da janela não entra na população (posicao/percentil null)", () => {
    const { porTentativa, participantesPorSimulado } = calcularRanking([
      r("in", "s1", "u1", 60, "2026-01-01T10:00:00Z"),
      r("treino", "s1", "u2", 99, "2026-01-01T10:00:00Z", { is_within_window: false }),
      r("nulo", "s1", "u3", 99, "2026-01-01T10:00:00Z", { is_within_window: null }),
    ]);
    expect(porTentativa.has("treino")).toBe(false);
    expect(porTentativa.has("nulo")).toBe(false);
    expect(porTentativa.get("in")).toEqual({ posicao: 1, participantes: 1, percentil: null });
    expect(participantesPorSimulado.get("s1")).toBe(1);
  });

  it("um por aluno: vale a maior nota (online+offline juntos); a outra fica sem posição", () => {
    const { porTentativa, participantesPorSimulado } = calcularRanking([
      r("on", "s1", "u1", 60, "2026-01-01T10:00:00Z"),
      r("off", "s1", "u1", 75, "2026-01-02T10:00:00Z"),
      r("o2", "s1", "u2", 70, "2026-01-01T10:00:00Z"),
    ]);
    expect(participantesPorSimulado.get("s1")).toBe(2);
    expect(porTentativa.has("on")).toBe(false);
    expect(porTentativa.get("off")!.posicao).toBe(1);
    expect(porTentativa.get("o2")!.posicao).toBe(2);
  });

  it("mesmo aluno com notas iguais: vale a que finalizou primeiro", () => {
    const { porTentativa } = calcularRanking([
      r("tarde", "s1", "u1", 60, "2026-01-02T10:00:00Z"),
      r("cedo", "s1", "u1", 60, "2026-01-01T10:00:00Z"),
    ]);
    expect(porTentativa.has("tarde")).toBe(false);
    expect(porTentativa.get("cedo")!.posicao).toBe(1);
  });

  it("ignora não finalizadas e sem nota; aceita expired e nota numeric como string", () => {
    const { porTentativa } = calcularRanking([
      r("andamento", "s1", "u1", 90, null, { status: "in_progress" }),
      r("pendente", "s1", "u2", 90, null, { status: "offline_pending" }),
      r("semnota", "s1", "u3", null, "2026-01-01T10:00:00Z"),
      r("exp", "s1", "u4", "55.50", "2026-01-01T10:00:00Z", { status: "expired" }),
    ]);
    expect([...porTentativa.keys()]).toEqual(["exp"]);
  });

  it("populações de simulados diferentes são independentes; percentil com 1 casa", () => {
    const { porTentativa } = calcularRanking([
      r("a1", "s1", "u1", 90, "2026-01-01T10:00:00Z"),
      r("a2", "s1", "u2", 80, "2026-01-01T10:00:00Z"),
      r("a3", "s1", "u3", 70, "2026-01-01T10:00:00Z"),
      r("a4", "s1", "u4", 60, "2026-01-01T10:00:00Z"),
      r("b1", "s2", "u1", 50, "2026-02-01T10:00:00Z"),
    ]);
    expect(porTentativa.get("a2")).toEqual({ posicao: 2, participantes: 4, percentil: 66.7 });
    expect(porTentativa.get("b1")).toEqual({ posicao: 1, participantes: 1, percentil: null });
  });

  it("população vazia", () => {
    const { porTentativa, participantesPorSimulado } = calcularRanking([]);
    expect(porTentativa.size).toBe(0);
    expect(participantesPorSimulado.size).toBe(0);
  });
});

describe("simuladoLiberado", () => {
  const agora = new Date("2026-03-01T12:00:00Z");
  const sim = (fim: string | null, lib: string | null) => ({
    execution_window_end: fim,
    results_release_at: lib,
  });

  it("sem fim de janela -> não liberado (mesmo com results_release_at passado)", () => {
    expect(simuladoLiberado(sim(null, null), agora)).toBe(false);
    expect(simuladoLiberado(sim(null, "2026-01-01T00:00:00Z"), agora)).toBe(false);
  });

  it("sem results_release_at: vale o fim da janela (>=)", () => {
    expect(simuladoLiberado(sim("2026-03-01T12:00:00Z", null), agora)).toBe(true);
    expect(simuladoLiberado(sim("2026-03-01T12:00:01Z", null), agora)).toBe(false);
  });

  it("vale o MAIOR entre results_release_at e fim da janela", () => {
    // liberação antes do fim da janela: manda o fim
    expect(simuladoLiberado(sim("2026-03-02T00:00:00Z", "2026-02-01T00:00:00Z"), agora)).toBe(false);
    // liberação depois do fim da janela: manda a liberação
    expect(simuladoLiberado(sim("2026-02-01T00:00:00Z", "2026-03-02T00:00:00Z"), agora)).toBe(false);
    expect(simuladoLiberado(sim("2026-02-01T00:00:00Z", "2026-02-15T00:00:00Z"), agora)).toBe(true);
  });

  it("datas inválidas -> não liberado", () => {
    expect(simuladoLiberado(sim("lixo", null), agora)).toBe(false);
    expect(simuladoLiberado(sim("2026-02-01T00:00:00Z", "lixo"), agora)).toBe(false);
    expect(simuladoLiberado(sim("2026-02-01T00:00:00Z", null), new Date("x"))).toBe(false);
  });
});

describe("redação de simulados não liberados / não publicados", () => {
  // s1 liberado (base); s3 publicado com janela aberta; s4 rascunho; s5 publicado sem fim de janela;
  // s6 liberação < fim (já passou); s7 liberação futura.
  function comNaoLiberados(): LinhasCruas {
    const l = base();
    const sim = (id: string, n: number, fim: string | null, lib: string | null, status: string) => ({
      id, title: `Simulado ${n}`, sequence_number: n, questions_count: 1,
      execution_window_start: "2026-10-01T00:00:00Z", execution_window_end: fim,
      results_release_at: lib, status,
    });
    l.simulados.push(
      sim("s3", 3, "2026-12-01T00:00:00Z", null, "published"),
      sim("s4", 4, "2026-01-01T00:00:00Z", null, "draft"),
      sim("s5", 5, null, null, "published"),
      sim("s6", 6, "2026-09-01T00:00:00Z", "2026-08-01T00:00:00Z", "published"),
      sim("s7", 7, "2026-09-01T00:00:00Z", "2026-12-01T00:00:00Z", "published"),
    );
    const q = (id: string, sid: string, n: number) => ({
      id, simulado_id: sid, question_number: n, area: "Pediatria", theme: "Tema",
      text: `Enunciado ${id}`, explanation: `Expl ${id}`, image_url: `https://x/${id}.png`,
      image_url_2: `https://x/${id}-2.png`, explanation_image_url: `https://x/${id}-e.png`, difficulty: "alta",
    });
    l.questoes.push(q("q3", "s3", 1), q("q4", "s4", 1), q("q5", "s5", 1), q("q6", "s6", 1), q("q7", "s7", 1));
    for (const id of ["q3", "q4", "q5", "q6", "q7"]) {
      l.opcoes.push(
        { id: `${id}a`, question_id: id, label: "A", text: "Alfa", is_correct: false },
        { id: `${id}b`, question_id: id, label: "B", text: "Beta", is_correct: true },
      );
    }
    const t = (id: string, sid: string) => ({
      id, simulado_id: sid, user_id: "u1", finished_at: "2026-10-05T10:00:00Z",
      score_percentage: 70, total_correct: 70, total_answered: 100, attempt_type: "online",
      is_within_window: true,
    });
    l.tentativas.push(t("t3", "s3"), t("t4", "s4"), t("t5", "s5"), t("t6", "s6"), t("t7", "s7"));
    l.ranking = [
      r("t3", "s3", "u1", 70, "2026-10-05T10:00:00Z"),
      r("t4", "s4", "u1", 70, "2026-10-05T10:00:00Z"),
    ];
    l.resultados.push(
      { attempt_id: "t3", question_id: "q3", selected_option_id: "q3a", is_correct: false, was_answered: true },
      { attempt_id: "t4", question_id: "q4", selected_option_id: "q4b", is_correct: true, was_answered: true },
      { attempt_id: "t5", question_id: "q5", selected_option_id: "q5b", is_correct: true, was_answered: true },
      { attempt_id: "t6", question_id: "q6", selected_option_id: "q6b", is_correct: true, was_answered: true },
      { attempt_id: "t7", question_id: "q7", selected_option_id: null, is_correct: false, was_answered: false },
    );
    return l;
  }
  const NULOS = {
    text: null, explanation: null, image_url: null, image_url_2: null,
    explanation_image_url: null, correta_label: null,
  };

  it("publicado e liberado: conteúdo completo, opções e is_correct", () => {
    const out = montarExportacao(comNaoLiberados(), null, GERADO, AGORA);
    expect(out.questoes.find((q) => q.id === "q1")).toMatchObject({
      text: "Enunciado 1", explanation: "Porque C", image_url: "https://x/img1.png", correta_label: "C",
    });
    expect(out.opcoes.filter((o) => o.question_id === "q1")).toHaveLength(3);
    expect(out.opcoes.find((o) => o.id === "o3")).toMatchObject({ is_correct: true, label: "C" });
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.respostas.find((x) => x.attempt_id === "t1")).toMatchObject({ is_correct: false });
    expect(ana.respostas.find((x) => x.attempt_id === "t6")).toMatchObject({ is_correct: true });
  });

  it("publicado com janela aberta: questão mantém só campos não sensíveis; sem opções", () => {
    const out = montarExportacao(comNaoLiberados(), null, GERADO, AGORA);
    const q3 = out.questoes.find((q) => q.id === "q3")!;
    expect(q3).toEqual({
      id: "q3", simulado_id: "s3", question_number: 1, area: "Pediatria", theme: "Tema",
      difficulty: "alta", ...NULOS,
    });
    expect(out.opcoes.some((o) => o.question_id === "q3")).toBe(false);
    expect(out.simulados.some((s) => s.id === "s3")).toBe(true);
  });

  it("respostas de simulado não liberado: selected_label/was_answered ficam, is_correct vira null", () => {
    const out = montarExportacao(comNaoLiberados(), null, GERADO, AGORA);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.respostas.find((x) => x.attempt_id === "t3")).toEqual({
      attempt_id: "t3", question_id: "q3", selected_label: "A", is_correct: null, was_answered: true,
    });
    expect(ana.respostas.find((x) => x.attempt_id === "t5")).toMatchObject({
      selected_label: "B", is_correct: null,
    });
  });

  it("selected_label resolve com linhas de opção sem text/is_correct (simulado não liberado)", () => {
    const l = comNaoLiberados();
    l.opcoes = l.opcoes.map((o) =>
      o.question_id === "q3" ? { id: o.id, question_id: o.question_id, label: o.label } : o
    );
    const ana = montarExportacao(l, null, GERADO, AGORA).alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.respostas.find((x) => x.attempt_id === "t3")).toMatchObject({ selected_label: "A" });
  });

  it("tentativas de simulado não liberado mantêm nota e ranking", () => {
    const out = montarExportacao(comNaoLiberados(), null, GERADO, AGORA);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.tentativas.find((x) => x.id === "t3")).toMatchObject({
      score_percentage: 70, total_correct: 70, posicao: 1, participantes: 1,
    });
  });

  it("results_release_at anterior ao fim da janela: vale o maior (o fim)", () => {
    const out = montarExportacao(comNaoLiberados(), null, GERADO, AGORA);
    // s6: release 08/01 < fim 09/01, agora 10/15 -> liberado
    expect(out.questoes.find((q) => q.id === "q6")).toMatchObject({ text: "Enunciado q6", correta_label: "B" });
    // s7: release 12/01 (futuro) -> não liberado
    expect(out.questoes.find((q) => q.id === "q7")).toMatchObject(NULOS);
    // entre release (08/01) e fim da janela (09/01) continua oculto
    const cedo = montarExportacao(comNaoLiberados(), null, GERADO, new Date("2026-08-15T00:00:00Z"));
    expect(cedo.questoes.find((q) => q.id === "q6")).toMatchObject(NULOS);
    expect(cedo.opcoes.some((o) => o.question_id === "q6")).toBe(false);
  });

  it("sem execution_window_end: não liberado", () => {
    const out = montarExportacao(comNaoLiberados(), null, GERADO, AGORA);
    expect(out.questoes.find((q) => q.id === "q5")).toMatchObject(NULOS);
    expect(out.opcoes.some((o) => o.question_id === "q5")).toBe(false);
  });

  it("rascunho: fora por inteiro (simulado, questões, opções, tentativas, respostas, ranking)", () => {
    const out = montarExportacao(comNaoLiberados(), null, GERADO, AGORA);
    expect(out.simulados.map((s) => s.id)).not.toContain("s4");
    expect(out.questoes.some((q) => q.simulado_id === "s4")).toBe(false);
    expect(out.opcoes.some((o) => o.question_id === "q4")).toBe(false);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.tentativas.some((x) => x.simulado_id === "s4")).toBe(false);
    expect(ana.respostas.some((x) => x.attempt_id === "t4")).toBe(false);
    // t3 ranqueia sozinha: o rascunho não entra na população
    expect(ana.tentativas.find((x) => x.id === "t3")!.participantes).toBe(1);
  });

  it("nada de conteúdo de simulado não liberado/rascunho aparece no JSON final", () => {
    const json = JSON.stringify(montarExportacao(comNaoLiberados(), null, GERADO, AGORA));
    for (const vazado of ["Enunciado q3", "Expl q3", "x/q3", "Enunciado q4", "Enunciado q5", "Enunciado q7"]) {
      expect(json).not.toContain(vazado);
    }
  });
});

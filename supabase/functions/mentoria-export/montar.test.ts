// supabase/functions/mentoria-export/montar.test.ts
import { describe, it, expect } from "vitest";
import {
  compararSegredo,
  montarExportacao,
  validarCorpo,
  type LinhasCruas,
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
        status: "published",
      },
      {
        id: "s1", title: "Simulado 1", sequence_number: 1, questions_count: 1,
        execution_window_start: "2026-01-01T00:00:00Z", execution_window_end: "2026-01-10T00:00:00Z",
        status: "published",
      },
    ],
    questoes: [
      { id: "q1", simulado_id: "s1", question_number: 1, area: "Clínica Médica", theme: "Hipertensão" },
    ],
    opcoes: [
      { id: "o1", question_id: "q1", label: "A", is_correct: false },
      { id: "o2", question_id: "q1", label: "B", is_correct: false },
      { id: "o3", question_id: "q1", label: "C", is_correct: true },
    ],
    tentativas: [
      {
        id: "t1", simulado_id: "s1", user_id: "u1", finished_at: "2026-01-05T10:00:00Z",
        score_percentage: 61, total_correct: 61, total_answered: 98, attempt_type: "online",
      },
      {
        id: "t2", simulado_id: "s2", user_id: "u1", finished_at: null,
        score_percentage: null, total_correct: null, total_answered: null, attempt_type: "online",
      },
    ],
    resultados: [
      { attempt_id: "t1", question_id: "q1", selected_option_id: "o2", is_correct: false, was_answered: true },
      { attempt_id: "t2", question_id: "q1", selected_option_id: "o3", is_correct: true, was_answered: true },
    ],
  };
}

const GERADO = "2026-10-15T07:00:00Z";

describe("montarExportacao", () => {
  it("devolve gerado_em, simulados ordenados e questões com correta_label", () => {
    const out = montarExportacao(base(), null, GERADO);
    expect(out.gerado_em).toBe(GERADO);
    expect(out.simulados.map((s) => s.sequence_number)).toEqual([1, 2]);
    expect(out.questoes).toEqual([
      { id: "q1", simulado_id: "s1", question_number: 1, area: "Clínica Médica", theme: "Hipertensão", correta_label: "C" },
    ]);
  });

  it("aluno sem onboarding -> especialidade null e alvos []", () => {
    const out = montarExportacao(base(), null, GERADO);
    const beto = out.alunos.find((a) => a.email === "b@x.com")!;
    expect(beto.especialidade).toBeNull();
    expect(beto.alvos).toEqual([]);
    expect(beto.tentativas).toEqual([]);
    expect(beto.respostas).toEqual([]);
  });

  it("alvo sem corte para a especialidade do aluno fica fora de alvos", () => {
    const out = montarExportacao(base(), null, GERADO);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.especialidade).toEqual({ id: "sp1", nome: "Cardiologia" });
    expect(ana.alvos).toEqual([
      { institution_id: "i1", nome: "HC-FMUSP", corte_geral: 82, corte_cota: 75 },
    ]);
  });

  it("selected_label vem de question_options.label", () => {
    const out = montarExportacao(base(), null, GERADO);
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
    const ana = montarExportacao(l, null, GERADO).alunos[0];
    expect(ana.respostas[0].selected_label).toBeNull();
  });

  it("tentativa não finalizada é ignorada (tentativas e respostas)", () => {
    const out = montarExportacao(base(), null, GERADO);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.tentativas.map((t) => t.id)).toEqual(["t1"]);
    expect(ana.respostas.some((r) => r.attempt_id === "t2")).toBe(false);
  });

  it("desde filtra só as respostas; tentativas finalizadas continuam todas", () => {
    const out = montarExportacao(base(), "2026-01-06T00:00:00Z", GERADO);
    const ana = out.alunos.find((a) => a.email === "a@x.com")!;
    expect(ana.tentativas.map((t) => t.id)).toEqual(["t1"]);
    expect(ana.respostas).toEqual([]);
  });

  it("desde igual ao finished_at inclui as respostas (>=)", () => {
    const out = montarExportacao(base(), "2026-01-05T10:00:00Z", GERADO);
    expect(out.alunos.find((a) => a.email === "a@x.com")!.respostas).toHaveLength(1);
  });

  it("agrupa por e-mail minúsculo e ignora duplicados/sem e-mail", () => {
    const l = base();
    l.perfis.push({ id: "u3", full_name: "Dup", email: "A@X.com", segment: "pro" });
    l.perfis.push({ id: "u4", full_name: "Sem", email: null, segment: "pro" });
    const out = montarExportacao(l, null, GERADO);
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

  it("normaliza (trim, minúsculo) e deduplica; desde opcional", () => {
    const r = validarCorpo({ emails: [" A@X.com ", "a@x.com", "B@x.com"], desde: "2026-01-01T00:00:00Z" });
    expect(r).toEqual({ ok: true, emails: ["a@x.com", "b@x.com"], desde: "2026-01-01T00:00:00Z" });
    expect(validarCorpo({ emails: ["a@x.com"] })).toEqual({ ok: true, emails: ["a@x.com"], desde: null });
    expect(validarCorpo({ emails: ["a@x.com"], desde: null })).toMatchObject({ desde: null });
    expect(validarCorpo({ emails: ["a@x.com"], desde: "lixo" })).toMatchObject({ desde: null });
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

import { describe, expect, it } from "vitest";
import type { SimuladoWithStatus } from "@/types";
import { deriveHomeHeroState } from "./home-hero-state";

const baseSimulado: SimuladoWithStatus = {
  id: "sim-1",
  slug: "sim-1",
  title: "Simulado 1",
  sequenceNumber: 1,
  description: "Descricao",
  questionsCount: 100,
  estimatedDuration: "5h",
  estimatedDurationMinutes: 300,
  executionWindowStart: "2026-04-05T08:00:00.000Z",
  executionWindowEnd: "2026-04-05T13:00:00.000Z",
  resultsReleaseAt: "2026-04-06T12:00:00.000Z",
  themeTags: [],
  status: "upcoming",
};

function buildSimulado(
  overrides: Partial<SimuladoWithStatus>,
): SimuladoWithStatus {
  return { ...baseSimulado, ...overrides };
}

describe("deriveHomeHeroState", () => {
  it("retorna onboarding_pending quando onboarding nao foi concluido", () => {
    const state = deriveHomeHeroState({
      userName: "Felipe",
      isOnboardingComplete: false,
      simulados: [],
      simuladosRealizados: 0,
      mediaAtual: 0,
      lastScore: null,
      recentScores: [],
    });

    expect(state.scenario).toBe("onboarding_pending");
    expect(state.ctaTo).toBe("/onboarding");
    expect(state.headline).toContain("Felipe");
  });

  it("prioriza in_progress sobre outros estados", () => {
    const state = deriveHomeHeroState({
      userName: "Felipe",
      isOnboardingComplete: true,
      simulados: [
        buildSimulado({
          id: "sim-open",
          status: "available",
          title: "Simulado Aberto",
        }),
        buildSimulado({
          id: "sim-progress",
          status: "in_progress",
          title: "Simulado em andamento",
          userState: {
            simuladoId: "sim-progress",
            started: true,
            startedAt: "2026-04-05T09:00:00.000Z",
            finished: false,
          },
        }),
      ],
      simuladosRealizados: 1,
      mediaAtual: 72,
      lastScore: 72,
      recentScores: [72],
    });

    expect(state.scenario).toBe("in_progress");
    expect(state.ctaTo).toBe("/simulados/sim-progress");
    expect(state.ctaLabel).toBe("Retomar simulado");
  });

  it("retorna awaiting_results quando ha tentativa aguardando liberacao", () => {
    const state = deriveHomeHeroState({
      userName: "Felipe",
      isOnboardingComplete: true,
      simulados: [
        buildSimulado({
          id: "sim-waiting",
          status: "closed_waiting",
          resultsReleaseAt: "2026-04-08T12:00:00.000Z",
        }),
      ],
      simuladosRealizados: 1,
      mediaAtual: 75,
      lastScore: 75,
      recentScores: [75],
    });

    expect(state.scenario).toBe("awaiting_results");
    expect(state.ctaTo).toBe("/desempenho");
    expect(state.description).toContain("Resultado previsto");
  });

  it("retorna results_ready e link para resultado quando concluido", () => {
    const state = deriveHomeHeroState({
      userName: "Felipe",
      isOnboardingComplete: true,
      simulados: [
        buildSimulado({
          id: "sim-done",
          status: "completed",
          userState: {
            simuladoId: "sim-done",
            started: true,
            finished: true,
            finishedAt: "2026-04-04T10:30:00.000Z",
          },
        }),
      ],
      simuladosRealizados: 3,
      mediaAtual: 77,
      lastScore: 82,
      recentScores: [70, 82],
    });

    expect(state.scenario).toBe("results_ready");
    expect(state.ctaTo).toBe("/simulados/sim-done/resultado");
    expect(state.description).toContain("82%");
  });

  it("retorna first_simulado quando usuario ainda nao tem historico", () => {
    const state = deriveHomeHeroState({
      userName: "",
      isOnboardingComplete: true,
      simulados: [],
      simuladosRealizados: 0,
      mediaAtual: 0,
      lastScore: null,
      recentScores: [],
    });

    expect(state.scenario).toBe("first_simulado");
    expect(state.ctaTo).toBe("/simulados");
    expect(state.ctaLabel).toBe("Iniciar primeiro simulado");
  });
});

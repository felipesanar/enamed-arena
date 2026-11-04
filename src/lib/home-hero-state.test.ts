import { describe, expect, it } from "vitest";
import type { SimuladoWithStatus } from "@/types";
import { deriveHomeHeroState } from "./home-hero-state";
import type { ExamEdition } from '@/types/edition';

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
  const edition = { id: 'e2027' } as ExamEdition;
  const scoped = (simulados: SimuladoWithStatus[], now = new Date('2027-01-15T12:00:00Z')) => deriveHomeHeroState({
    userName: 'Felipe', isOnboardingComplete: true, simulados, simuladosRealizados: 0,
    mediaAtual: 0, lastScore: null, recentScores: [], edition, now,
  });
  it('expired started without upcoming never shows a resume CTA from cached status', () => {
    const state = scoped([buildSimulado({ editionId: 'e2027', status: 'in_progress',
      userState: { simuladoId: 'sim-1', started: true, finished: false, effectiveDeadline: '2026-04-05T12:00:00Z' } })]);
    expect(state.scenario).not.toBe('in_progress');
    expect(state.ctaLabel).not.toMatch(/continuar|retomar/i);
    expect(state.ctaTo).not.toContain('/prova');
  });
  it('2026 completed and 2027 upcoming shows upcoming before the first result', () => {
    const state = scoped([
      buildSimulado({ id: 'old', editionId: 'e2026', status: 'completed', userState: { simuladoId: 'old', started: true, finished: true } }),
      buildSimulado({ id: 'next', editionId: 'e2027', executionWindowStart: '2027-02-01T12:00:00Z', executionWindowEnd: '2027-02-02T12:00:00Z' }),
    ]);
    expect(state.scenario).toBe('upcoming');
  });
  it('selects the open window closing first, not input order', () => {
    const state = scoped([
      buildSimulado({ id: 'later', editionId: 'e2027', status: 'available', executionWindowStart: '2027-01-14', executionWindowEnd: '2027-01-18' }),
      buildSimulado({ id: 'first', editionId: 'e2027', status: 'available', executionWindowStart: '2027-01-14', executionWindowEnd: '2027-01-16' }),
    ]);
    expect(state.ctaTo).toBe('/simulados?openModal=first');
  });
  it('expires results_ready at the fourteenth BRT calendar day, not elapsed hours', () => {
    const done = buildSimulado({ editionId: 'e2027', status: 'completed', resultsReleaseAt: '2027-01-01T23:59:00-03:00',
      userState: { simuladoId: 'sim-1', started: true, finished: true } });
    expect(scoped([done], new Date('2027-01-15T02:59:00Z')).scenario).toBe('results_ready');
    expect(scoped([done], new Date('2027-01-15T03:00:00Z')).scenario).not.toBe('results_ready');
  });
  it('no exams or unresolved context is neutral with calendar soon and training link', () => {
    expect(scoped([]).description).toContain('Calendário em breve');
    expect(scoped([]).ctaTo).toBe('/simulados?filter=treino');
    const state = deriveHomeHeroState({ userName: '', isOnboardingComplete: true, simulados: [buildSimulado({ status: 'completed' })],
      simuladosRealizados: 0, mediaAtual: 0, lastScore: null, recentScores: [], edition: null });
    expect(state.scenario).not.toBe('results_ready');
  });
  it('invalid release configuration does not crash awaiting-results copy', () => {
    expect(() => scoped([buildSimulado({ editionId: 'e2027', status: 'closed_waiting', resultsReleaseAt: 'invalid',
      userState: { simuladoId: 'sim-1', started: true, finished: true } })])).not.toThrow();
  });
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
    expect(state.ctaTo).toBe("/simulados/sim-progress/prova");
    expect(state.ctaLabel).toBe("Retomar simulado");
  });

  it("leva para o gabarito quando a tentativa em andamento e offline", () => {
    const state = deriveHomeHeroState({
      userName: "Felipe",
      isOnboardingComplete: true,
      simulados: [
        buildSimulado({
          id: "sim-offline",
          status: "in_progress",
          title: "Simulado Offline",
          userState: {
            simuladoId: "sim-offline",
            started: true,
            startedAt: "2026-04-05T09:00:00.000Z",
            finished: false,
            attemptType: "offline",
            attemptStatus: "offline_pending",
          },
        }),
      ],
      simuladosRealizados: 1,
      mediaAtual: 72,
      lastScore: 72,
      recentScores: [72],
    });

    expect(state.scenario).toBe("in_progress");
    expect(state.ctaTo).toBe("/simulados/sim-offline/gabarito");
    expect(state.ctaLabel).toBe("Preencher gabarito");
  });

  it("retorna awaiting_results quando ha tentativa aguardando liberacao e sem historico anterior", () => {
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
      simuladosRealizados: 0,
      mediaAtual: 0,
      lastScore: null,
      recentScores: [],
    });

    expect(state.scenario).toBe("awaiting_results");
    expect(state.ctaTo).toBe("/desempenho");
    expect(state.description).toContain("Resultado previsto");
  });

  it("retorna awaiting_results apenas quando nao ha historico anterior liberado", () => {
    // closed_waiting simulado + no released history → should show awaiting_results
    const state = deriveHomeHeroState({
      userName: "Felipe",
      isOnboardingComplete: true,
      simulados: [
        buildSimulado({
          id: "sim-waiting",
          status: "closed_waiting",
          resultsReleaseAt: "2026-04-08T12:00:00.000Z",
          userState: {
            simuladoId: "sim-waiting",
            started: true,
            finished: true,
            finishedAt: "2026-04-07T10:00:00.000Z",
          },
        }),
      ],
      simuladosRealizados: 0,
      mediaAtual: 0,
      lastScore: null,
      recentScores: [],
    });

    expect(state.scenario).toBe("awaiting_results");
  });

  it("nao retorna awaiting_results quando ha historico anterior liberado", () => {
    // closed_waiting simulado + previous released history → should NOT show awaiting_results
    const state = deriveHomeHeroState({
      userName: "Felipe",
      isOnboardingComplete: true,
      simulados: [
        buildSimulado({
          id: "sim-waiting",
          status: "closed_waiting",
          resultsReleaseAt: "2026-04-08T12:00:00.000Z",
          userState: {
            simuladoId: "sim-waiting",
            started: true,
            finished: true,
            finishedAt: "2026-04-07T10:00:00.000Z",
          },
        }),
      ],
      simuladosRealizados: 2,
      mediaAtual: 74,
      lastScore: 74,
      recentScores: [68, 74],
    });

    expect(state.scenario).not.toBe("awaiting_results");
    // Falls through to steady_progress since no completed/available/late simulados
    expect(state.scenario).toBe("steady_progress");
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
    expect(state.ctaTo).toBe("/simulados/sim-done");
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

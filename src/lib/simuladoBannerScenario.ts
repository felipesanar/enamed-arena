import type { SimuladoWithStatus } from "@/types";

export type BannerScenario =
  | { type: "before_window"; start: string; end: string }
  | { type: "open_not_done"; simuladoId: string; title: string }
  | { type: "open_done_waiting"; resultsAt: string }
  | { type: "after_done"; simuladoId: string; title: string }
  | { type: "no_upcoming" };

export function deriveScenario(simulados: SimuladoWithStatus[]): BannerScenario {
  const now = Date.now();

  const openWindow = simulados.find((s) => {
    const start = Date.parse(s.executionWindowStart);
    const end = Date.parse(s.executionWindowEnd);
    return start <= now && now <= end;
  });

  if (openWindow) {
    const finished = openWindow.userState?.finished === true;
    if (!finished) {
      return {
        type: "open_not_done",
        simuladoId: openWindow.id,
        title: openWindow.title,
      };
    }
    const resultsAt = Date.parse(openWindow.resultsReleaseAt);
    if (Number.isFinite(resultsAt) && now < resultsAt) {
      return {
        type: "open_done_waiting",
        resultsAt: openWindow.resultsReleaseAt,
      };
    }
    return {
      type: "after_done",
      simuladoId: openWindow.id,
      title: openWindow.title,
    };
  }

  const recentlyFinished = simulados.find((s) => {
    const end = Date.parse(s.executionWindowEnd);
    return end < now && s.userState?.finished === true;
  });

  if (recentlyFinished) {
    const resultsAt = Date.parse(recentlyFinished.resultsReleaseAt);
    if (Number.isFinite(resultsAt) && now < resultsAt) {
      return {
        type: "open_done_waiting",
        resultsAt: recentlyFinished.resultsReleaseAt,
      };
    }
  }

  const upcoming = simulados
    .filter((s) => {
      const start = Date.parse(s.executionWindowStart);
      return Number.isFinite(start) && start > now;
    })
    .sort(
      (a, b) =>
        Date.parse(a.executionWindowStart) -
        Date.parse(b.executionWindowStart)
    );

  if (upcoming.length > 0) {
    return {
      type: "before_window",
      start: upcoming[0].executionWindowStart,
      end: upcoming[0].executionWindowEnd,
    };
  }

  return { type: "no_upcoming" };
}

/** Rota mais relevante para o cenário atual (sino do header mobile). */
export function getNotificationHref(scenario: BannerScenario): string {
  switch (scenario.type) {
    case "open_not_done":
      return `/simulados/${scenario.simuladoId}`;
    case "after_done":
      return `/simulados/${scenario.simuladoId}/resultado`;
    case "before_window":
    case "open_done_waiting":
    case "no_upcoming":
      return "/simulados";
    default:
      return "/simulados";
  }
}

/** Mostrar ponto de alerta no sino (janela aberta ou resultado disponível). */
export function notificationBellDotVisible(scenario: BannerScenario): boolean {
  return (
    scenario.type === "open_not_done" || scenario.type === "after_done"
  );
}

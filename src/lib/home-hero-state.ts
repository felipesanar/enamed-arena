import type { SimuladoWithStatus } from "@/types";

export type HomeHeroScenario =
  | "onboarding_pending"
  | "in_progress"
  | "window_open"
  | "awaiting_results"
  | "results_ready"
  | "late_training"
  | "first_simulado"
  | "upcoming"
  | "steady_progress";

export type HomeHeroTone = "default" | "focus" | "calm" | "progress";

export interface HomeHeroState {
  scenario: HomeHeroScenario;
  tone: HomeHeroTone;
  eyebrow: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
}

interface DeriveHomeHeroStateInput {
  userName: string;
  isOnboardingComplete: boolean;
  simulados: SimuladoWithStatus[];
  simuladosRealizados: number;
  mediaAtual: number;
  lastScore: number | null;
  recentScores: number[];
}

function formatDateShort(dateIso: string): string {
  const parsed = Date.parse(dateIso);
  if (!Number.isFinite(parsed)) return "data em breve";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(parsed));
}

function getDisplayName(userName: string): string {
  const safeName = userName?.trim();
  return safeName ? safeName : "estudante";
}

function sortByDateAsc(
  items: SimuladoWithStatus[],
  getDateValue: (item: SimuladoWithStatus) => string | undefined,
): SimuladoWithStatus[] {
  return [...items].sort((a, b) => {
    const left = Date.parse(getDateValue(a) ?? "");
    const right = Date.parse(getDateValue(b) ?? "");
    const safeLeft = Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER;
    const safeRight = Number.isFinite(right) ? right : Number.MAX_SAFE_INTEGER;
    return safeLeft - safeRight;
  });
}

function sortByDateDesc(
  items: SimuladoWithStatus[],
  getDateValue: (item: SimuladoWithStatus) => string | undefined,
): SimuladoWithStatus[] {
  return [...items].sort((a, b) => {
    const left = Date.parse(getDateValue(a) ?? "");
    const right = Date.parse(getDateValue(b) ?? "");
    const safeLeft = Number.isFinite(left) ? left : 0;
    const safeRight = Number.isFinite(right) ? right : 0;
    return safeRight - safeLeft;
  });
}

export function deriveHomeHeroState({
  userName,
  isOnboardingComplete,
  simulados,
  simuladosRealizados,
  mediaAtual,
  lastScore,
  recentScores,
}: DeriveHomeHeroStateInput): HomeHeroState {
  const displayName = getDisplayName(userName);
  const safeMedia = Math.max(0, Math.min(100, Math.round(mediaAtual)));
  const safeLastScore =
    lastScore === null ? null : Math.max(0, Math.min(100, Math.round(lastScore)));

  if (!isOnboardingComplete) {
    return {
      scenario: "onboarding_pending",
      tone: "default",
      eyebrow: "Boas-vindas",
      headline: `Bem-vindo, ${displayName}`,
      description:
        "Complete seu perfil para personalizar ranking, desempenho e recomendações do seu ciclo.",
      ctaLabel: "Completar perfil",
      ctaTo: "/onboarding",
    };
  }

  const inProgress = sortByDateDesc(
    simulados.filter((simulado) => simulado.status === "in_progress"),
    (simulado) => simulado.userState?.startedAt ?? simulado.executionWindowEnd,
  )[0];

  if (inProgress) {
    return {
      scenario: "in_progress",
      tone: "focus",
      eyebrow: "Em andamento",
      headline: "Seu simulado ja foi iniciado",
      description: `Retome "${inProgress.title}" de onde parou para manter consistencia no seu ritmo de estudo.`,
      ctaLabel: "Retomar simulado",
      ctaTo: `/simulados/${inProgress.id}`,
    };
  }

  const available = sortByDateAsc(
    simulados.filter((simulado) => simulado.status === "available"),
    (simulado) => simulado.executionWindowEnd,
  )[0];

  if (available) {
    return {
      scenario: "window_open",
      tone: "focus",
      eyebrow: "Janela ativa",
      headline: "Seu proximo passo esta disponivel",
      description: `"${available.title}" esta aberto agora e conta para ranking quando concluido dentro da janela oficial.`,
      ctaLabel: "Realizar simulado",
      ctaTo: `/simulados/${available.id}`,
    };
  }

  const waitingResults = sortByDateAsc(
    simulados.filter((simulado) => simulado.status === "closed_waiting"),
    (simulado) => simulado.resultsReleaseAt,
  )[0];

  if (waitingResults) {
    const resultsDate = formatDateShort(waitingResults.resultsReleaseAt);
    return {
      scenario: "awaiting_results",
      tone: "calm",
      eyebrow: "Aguardando resultado",
      headline: "Sua tentativa ja foi enviada",
      description: `Resultado previsto para ${resultsDate}. Enquanto isso, acompanhe seu historico de evolucao.`,
      ctaLabel: "Ver desempenho",
      ctaTo: "/desempenho",
    };
  }

  const completed = sortByDateDesc(
    simulados.filter(
      (simulado) =>
        simulado.status === "completed" || simulado.status === "results_available",
    ),
    (simulado) =>
      simulado.userState?.finishedAt ?? simulado.resultsReleaseAt ?? simulado.executionWindowEnd,
  )[0];

  if (completed) {
    const scoreText =
      safeLastScore === null
        ? "Resultado pronto para consulta."
        : `Sua ultima nota foi ${safeLastScore}%.`;
    return {
      scenario: "results_ready",
      tone: "progress",
      eyebrow: "Resultado liberado",
      headline: "Hora de transformar dados em progresso",
      description: `${scoreText} Revise os detalhes e direcione melhor os proximos estudos.`,
      ctaLabel: "Ver resultado",
      ctaTo: `/simulados/${completed.id}/resultado`,
    };
  }

  const availableLate = sortByDateDesc(
    simulados.filter((simulado) => simulado.status === "available_late"),
    (simulado) => simulado.executionWindowEnd,
  )[0];

  if (availableLate) {
    return {
      scenario: "late_training",
      tone: "calm",
      eyebrow: "Modo treino",
      headline: "Treino extra para manter tracao",
      description: `"${availableLate.title}" segue aberto para pratica. Nao entra no ranking, mas fortalece sua preparacao.`,
      ctaLabel: "Treinar agora",
      ctaTo: `/simulados/${availableLate.id}`,
    };
  }

  const hasHistory = simuladosRealizados > 0 || recentScores.length > 0;
  if (!hasHistory) {
    return {
      scenario: "first_simulado",
      tone: "default",
      eyebrow: "Inicio da jornada",
      headline: `Comece sua preparacao, ${displayName}`,
      description:
        "Seu primeiro simulado cria a linha de base para comparativos, ranking e plano de evolucao.",
      ctaLabel: "Iniciar primeiro simulado",
      ctaTo: "/simulados",
    };
  }

  const upcoming = sortByDateAsc(
    simulados.filter((simulado) => simulado.status === "upcoming"),
    (simulado) => simulado.executionWindowStart,
  )[0];

  if (upcoming) {
    const startDate = formatDateShort(upcoming.executionWindowStart);
    return {
      scenario: "upcoming",
      tone: "calm",
      eyebrow: "Proxima janela",
      headline: "Preparacao inteligente ate a proxima prova",
      description: `Proximo simulado previsto para ${startDate}. Mantenha revisao ativa para chegar mais forte na abertura da janela.`,
      ctaLabel: "Ver calendario",
      ctaTo: "/simulados",
    };
  }

  const previousScore =
    recentScores.length > 1 ? recentScores[recentScores.length - 2] : null;
  const latestScore = recentScores.length > 0 ? recentScores[recentScores.length - 1] : null;
  const delta =
    latestScore !== null && previousScore !== null ? latestScore - previousScore : null;

  const headline =
    delta !== null && delta > 0
      ? "Sua performance esta em ascensao"
      : simuladosRealizados >= 5
        ? "Construindo consistencia de alto nivel"
        : "Evoluindo com constancia";

  return {
    scenario: "steady_progress",
    tone: "progress",
    eyebrow: "Resumo do ciclo",
    headline,
    description: `${simuladosRealizados} simulado${simuladosRealizados === 1 ? "" : "s"} concluido${simuladosRealizados === 1 ? "" : "s"} com media atual de ${safeMedia}%.`,
    ctaLabel: "Ver desempenho completo",
    ctaTo: "/desempenho",
  };
}

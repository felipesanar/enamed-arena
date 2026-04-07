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
      headline: "Seu simulado já foi iniciado",
      description: `Retome "${inProgress.title}" de onde parou para manter consistência no seu ritmo de estudo.`,
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
      headline: "Seu próximo passo está disponível",
      description: `"${available.title}" está aberto agora e conta para ranking quando concluído dentro da janela oficial.`,
      ctaLabel: "Realizar simulado",
      ctaTo: `/simulados?openModal=${available.id}`,
    };
  }

  const waitingResults = sortByDateAsc(
    simulados.filter((simulado) => simulado.status === "closed_waiting"),
    (simulado) => simulado.resultsReleaseAt,
  )[0];

  // True when the student has at least one released result to show.
  // Values come from the DB RPC which already filters by results_release_at <= now().
  // Used both here (awaiting_results guard) and below (first_simulado guard).
  const hasHistory = simuladosRealizados > 0 || recentScores.length > 0;

  // Only show awaiting_results hero if student has no prior released history.
  // If they have history, fall through to show stats normally — a pending
  // banner is rendered separately in HomePagePremium.
  if (waitingResults && !hasHistory) {
    const resultsDate = formatDateShort(waitingResults.resultsReleaseAt);
    return {
      scenario: "awaiting_results",
      tone: "calm",
      eyebrow: "Aguardando resultado",
      headline: "Sua tentativa já foi enviada",
      description: `Resultado previsto para ${resultsDate}. Enquanto isso, acompanhe seu histórico de evolução.`,
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
        : `Sua última nota foi ${safeLastScore}%.`;
    return {
      scenario: "results_ready",
      tone: "progress",
      eyebrow: "Resultado liberado",
      headline: "Hora de transformar dados em progresso",
      description: `${scoreText} Revise os detalhes e direcione melhor os próximos estudos.`,
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
      headline: "Treino extra para manter tração",
      description: `"${availableLate.title}" segue aberto para prática. Não entra no ranking, mas fortalece sua preparação.`,
      ctaLabel: "Treinar agora",
      ctaTo: `/simulados?openModal=${availableLate.id}`,
    };
  }

  if (!hasHistory) {
    return {
      scenario: "first_simulado",
      tone: "default",
      eyebrow: "Início da jornada",
      headline: `Comece sua preparação, ${displayName}`,
      description:
        "Seu primeiro simulado cria a linha de base para comparativos, ranking e plano de evolução.",
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
      eyebrow: "Próxima janela",
      headline: "Preparação inteligente até a próxima prova",
      description: `Próximo simulado previsto para ${startDate}. Mantenha revisão ativa para chegar mais forte na abertura da janela.`,
      ctaLabel: "Ver calendário",
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
      ? "Sua performance está em ascensão"
      : simuladosRealizados >= 5
        ? "Construindo consistência de alto nível"
        : "Evoluindo com constância";

  return {
    scenario: "steady_progress",
    tone: "progress",
    eyebrow: "Resumo do ciclo",
    headline,
    description: `${simuladosRealizados} simulado${simuladosRealizados === 1 ? "" : "s"} concluído${simuladosRealizados === 1 ? "" : "s"} com média atual de ${safeMedia}%.`,
    ctaLabel: "Ver desempenho completo",
    ctaTo: "/desempenho",
  };
}

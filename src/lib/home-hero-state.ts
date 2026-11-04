import type { SimuladoWithStatus } from "@/types";
import type { ExamEdition } from '@/types/edition';
import { selectCurrentSimulado } from '@/lib/editions';
import { deriveSimuladoStatus } from '@/lib/simulado-helpers';

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
  /** Undefined keeps legacy behavior; null is an unresolved edition, never global. */
  edition?: ExamEdition | null;
  now?: Date;
  resultsReadyDays?: number;
}

export function isRecentReleasedResult(simulado: SimuladoWithStatus, now: Date, days = 14): boolean {
  const release = Date.parse(simulado.resultsReleaseAt);
  if (!Number.isFinite(release) || !Number.isFinite(now.getTime()) || release > now.getTime()) return false;
  const dayNumber = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
    return Date.UTC(value('year'), value('month') - 1, value('day')) / 86_400_000;
  };
  const limit = Number.isFinite(days) && days > 0 ? days : 14;
  return dayNumber(now) - dayNumber(new Date(release)) < limit;
}

export function selectHomeSimulado(simulados: SimuladoWithStatus[], edition: ExamEdition | null, now: Date, days = 14) {
  const selected = selectCurrentSimulado(simulados.filter(sim => !sim.userState?.finished
    || !Number.isFinite(Date.parse(sim.resultsReleaseAt)) || Date.parse(sim.resultsReleaseAt) > now.getTime()
    || isRecentReleasedResult(sim, now, days)), edition, now);
  return selected ? { ...selected, status: deriveSimuladoStatus(selected, selected.userState, now) } : null;
}

function formatDateShort(dateIso: string): string {
  if (!Number.isFinite(Date.parse(dateIso))) return 'data a confirmar';
  const parsed = Date.parse(dateIso);
  if (!Number.isFinite(parsed)) return "data em breve";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: 'America/Sao_Paulo',
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
  edition,
  now = new Date(),
  resultsReadyDays = 14,
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

  if (edition !== undefined) {
    const current = selectHomeSimulado(simulados, edition, now, resultsReadyDays);
    simulados = current ? [current] : [];
    if (!current) return {
      scenario: 'first_simulado', tone: 'calm', eyebrow: 'Próxima edição',
      headline: `Sua preparação continua, ${displayName}`,
      description: 'Calendário em breve. Enquanto isso, pratique com os simulados de edições anteriores.',
      ctaLabel: 'Ver treinos', ctaTo: '/simulados?filter=treino',
    };
  }

  const inProgress = sortByDateDesc(
    simulados.filter((simulado) => simulado.status === "in_progress"),
    (simulado) => simulado.userState?.startedAt ?? simulado.executionWindowEnd,
  )[0];

  if (inProgress) {
    const isOffline =
      inProgress.userState?.attemptType === "offline" ||
      inProgress.userState?.attemptStatus === "offline_pending";

    if (isOffline) {
      return {
        scenario: "in_progress",
        tone: "focus",
        eyebrow: "Prova offline",
        headline: "Seu gabarito ainda está pendente",
        description: `Você iniciou "${inProgress.title}" no modo offline. Transcreva as respostas da prova impressa para o gabarito digital antes do fim do prazo.`,
        ctaLabel: "Preencher gabarito",
        ctaTo: `/simulados/${inProgress.id}/gabarito`,
      };
    }

    return {
      scenario: "in_progress",
      tone: "focus",
      eyebrow: "Em andamento",
      headline: "Seu simulado já foi iniciado",
      description: `Retome "${inProgress.title}" de onde parou para manter consistência no seu ritmo de estudo.`,
      ctaLabel: "Retomar simulado",
      ctaTo: `/simulados/${inProgress.id}/prova`,
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
      ctaTo: `/simulados/${completed.id}`,
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
      eyebrow: "Sua chance de evoluir",
      headline: "Cada questão te aproxima da aprovação",
      description: `"${availableLate.title}" continua disponível. Treine agora, identifique pontos fracos e chegue mais forte no próximo simulado oficial.`,
      ctaLabel: "Bora treinar",
      ctaTo: `/simulados?openModal=${availableLate.id}`,
    };
  }

  if (!hasHistory && !simulados.some(sim => sim.status === 'upcoming')) {
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

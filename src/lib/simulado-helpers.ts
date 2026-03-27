import type { SimuladoConfig, SimuladoStatus, SimuladoWithStatus, SimuladoUserState } from '@/types';
import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Derive the temporal status of a simulado from its config and current time.
 */
export function deriveSimuladoStatus(
  config: SimuladoConfig,
  userState?: SimuladoUserState,
  now: Date = new Date()
): SimuladoStatus {
  const windowStart = parseISO(config.executionWindowStart);
  const windowEnd = parseISO(config.executionWindowEnd);
  const resultsAt = parseISO(config.resultsReleaseAt);

  const userFinished = userState?.finished === true;

  // User finished and results are out
  if (userFinished && isAfter(now, resultsAt)) {
    return 'completed';
  }

  // User finished but results not yet released (regardless of window state)
  if (userFinished) {
    return 'closed_waiting';
  }

  // Results date passed but user never finished → they missed it
  if (isAfter(now, resultsAt)) {
    return 'closed_waiting';
  }

  // Window closed, waiting for results (user didn't finish)
  if (isAfter(now, windowEnd)) {
    return 'closed_waiting';
  }

  // User started but hasn't finished (within window)
  if (userState?.started && !userState.finished && isBefore(now, windowEnd)) {
    return 'in_progress';
  }

  // Window is open
  if (isAfter(now, windowStart) && isBefore(now, windowEnd)) {
    return 'available';
  }

  // Before window
  return 'upcoming';
}

/**
 * Enrich a SimuladoConfig with derived status.
 */
export function enrichSimulado(
  config: SimuladoConfig,
  userState?: SimuladoUserState,
  now?: Date
): SimuladoWithStatus {
  return {
    ...config,
    status: deriveSimuladoStatus(config, userState, now),
    userState,
  };
}

/**
 * Format an ISO date to a human-readable Brazilian date string.
 */
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd 'de' MMMM, yyyy", { locale: ptBR });
}

export function formatDateShort(isoDate: string): string {
  return format(parseISO(isoDate), "dd MMM yyyy", { locale: ptBR });
}

export function formatDateTime(isoDate: string): string {
  return format(parseISO(isoDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatTimeDistance(isoDate: string): string {
  return formatDistanceToNow(parseISO(isoDate), { locale: ptBR, addSuffix: true });
}

/**
 * Status display configuration.
 */
export const STATUS_CONFIG: Record<SimuladoStatus, {
  label: string;
  badgeClass: string;
  description: string;
}> = {
  upcoming: {
    label: 'Em breve',
    badgeClass: 'bg-info/10 text-info',
    description: 'Este simulado ainda não está disponível.',
  },
  available: {
    label: 'Disponível',
    badgeClass: 'bg-success/10 text-success',
    description: 'A janela de execução está aberta. Você pode iniciar agora.',
  },
  in_progress: {
    label: 'Em andamento',
    badgeClass: 'bg-warning/10 text-warning',
    description: 'Você já iniciou este simulado.',
  },
  closed_waiting: {
    label: 'Encerrado',
    badgeClass: 'bg-muted text-muted-foreground',
    description: 'A janela de execução foi encerrada. Resultado em breve.',
  },
  results_available: {
    label: 'Resultado liberado',
    badgeClass: 'bg-primary/10 text-primary',
    description: 'O resultado e gabarito estão disponíveis.',
  },
  completed: {
    label: 'Concluído',
    badgeClass: 'bg-success/10 text-success',
    description: 'Você concluiu este simulado e o resultado está disponível.',
  },
};

/**
 * Get the appropriate CTA for a simulado status.
 */
export function getSimuladoCTA(status: SimuladoStatus): { label: string; variant: 'primary' | 'secondary' | 'disabled' } {
  switch (status) {
    case 'available':
      return { label: 'Iniciar Simulado', variant: 'primary' };
    case 'in_progress':
      return { label: 'Continuar Simulado', variant: 'primary' };
    case 'results_available':
    case 'completed':
      return { label: 'Ver Resultado', variant: 'secondary' };
    case 'closed_waiting':
      return { label: 'Aguardando resultado', variant: 'disabled' };
    case 'upcoming':
    default:
      return { label: 'Indisponível', variant: 'disabled' };
  }
}

/**
 * Check if a user can start/access a simulado.
 */
export function canAccessSimulado(status: SimuladoStatus): boolean {
  return status === 'available' || status === 'in_progress';
}

export function canViewResults(status: SimuladoStatus): boolean {
  return status === 'results_available' || status === 'completed';
}

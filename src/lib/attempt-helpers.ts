import type { AttemptRow } from '@/services/simuladosApi';

/**
 * Given an online and offline attempt for the same simulado,
 * pick the most relevant one for determining userState.
 *
 * Priority: finished attempt (submitted/expired) wins over in-progress.
 * If both are finished, pick the one with the latest finished_at.
 */
export function pickMostRelevantAttempt(
  online: AttemptRow | null | undefined,
  offline: AttemptRow | null | undefined,
): AttemptRow | undefined {
  if (!online && !offline) return undefined;
  if (!online) return offline ?? undefined;
  if (!offline) return online ?? undefined;

  const isFinished = (a: AttemptRow) =>
    a.status === 'submitted' || a.status === 'expired';

  const onlineFinished = isFinished(online);
  const offlineFinished = isFinished(offline);

  // If only one is finished, pick that one
  if (onlineFinished && !offlineFinished) return online;
  if (offlineFinished && !onlineFinished) return offline;

  // Both finished or both in-progress: pick most recent
  const onlineTime = online.finished_at ?? online.started_at;
  const offlineTime = offline.finished_at ?? offline.started_at;
  return onlineTime >= offlineTime ? online : offline;
}

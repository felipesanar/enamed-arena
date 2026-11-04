/** Generate only at a user edit. Transport retries must reuse the resulting value. */
export function nextAnswerVersion(previous: string | null | undefined, serverNow: number): string {
  const prior = previous == null ? -Infinity : Date.parse(previous);
  if (!Number.isFinite(serverNow) || (previous != null && !Number.isFinite(prior))) {
    throw new Error('Invalid answer clock');
  }
  return new Date(Math.max(Math.floor(serverNow), prior + 1)).toISOString();
}

/** Legacy pending retains compatibility only while the remote row is unversioned. */
export function pendingAnswerWins(pending: string | null | undefined, remote: string | null | undefined): boolean {
  if (pending == null) return remote == null;
  if (!Number.isFinite(Date.parse(pending))) return false;
  return remote == null || Date.parse(pending) > Date.parse(remote);
}

/**
 * Internal-secret authentication for this service.
 *
 * `pdf-render` is called server-to-server only (from a Supabase Edge
 * Function or similar server-side job, never directly from a browser), so
 * the only credential it needs to check is a shared secret sent in a
 * header — the same pattern already used by
 * `supabase/functions/hubspot-contact-sync/index.ts` for its internal-secret
 * path. `constantTimeEqual` below is a direct port of that file's helper
 * (lines 49-54); `validateInternalSecret` ports the fail-closed check at
 * `hubspot-contact-sync/index.ts:90` (`INTERNAL_SECRET.length > 0 && ...`).
 */

/**
 * Compares two strings in time that depends only on their length, not their
 * content, to avoid leaking information about how many leading characters
 * of a guess matched the real secret via response-time differences.
 *
 * Returns `false` immediately (no comparison loop at all) if the lengths
 * differ — this is safe: length is not secret-dependent information an
 * attacker can exploit character-by-character the way a byte-value
 * comparison can, and it's exactly what the ported reference
 * implementation does.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Validates an internal-secret header against the service's configured
 * secret, fail-closed:
 *
 * - If `expectedSecret` is empty/undefined (the service has no secret
 *   configured), always returns `false` — even if `headerValue` also
 *   happens to be empty/undefined. An unconfigured secret must never be
 *   treated as "no auth required"; that would let anyone in as soon as an
 *   operator forgot to set an env var.
 * - If `headerValue` is empty/undefined, returns `false`.
 * - Otherwise, returns `constantTimeEqual(headerValue, expectedSecret)`.
 */
export function validateInternalSecret(
  headerValue: string | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret) return false;
  if (!headerValue) return false;
  return constantTimeEqual(headerValue, expectedSecret);
}

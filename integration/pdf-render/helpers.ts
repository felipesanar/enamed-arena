/**
 * Shared helpers for the pdf-render Tier A integration suite.
 *
 * Every test file in this directory imports `offlineApi` from
 * `@/services/offlineApi`, which in turn calls through the singleton
 * `supabase` client from `@/integrations/supabase/client`. That singleton's
 * project URL/anon key come from `import.meta.env.VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_PUBLISHABLE_KEY`, which `vitest.config.ts` in this directory
 * populates from `STAGING_SUPABASE_URL` / `STAGING_SUPABASE_ANON_KEY` before
 * Vite resolves env for the test run. See README.md for the full env var
 * contract.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Authenticates the shared supabase client singleton as a staging test user
 * so that `offlineApi.getSignedPdfUrl` (which invokes the `generate-exam-pdf`
 * Edge Function through this same client) sends a real user JWT rather than
 * just the anon key.
 *
 * `STAGING_TEST_USER_JWT` must be a currently-valid access token for a test
 * account in the staging project (see README.md for how to mint one). The
 * refresh token is a placeholder: these tests are short-lived (well under
 * typical JWT expiry) and never trigger a refresh, so a real refresh token
 * isn't needed for the session to remain usable for the duration of a run.
 */
export async function authenticateAsTestUser(jwt: string): Promise<void> {
  const { error } = await supabase.auth.setSession({
    access_token: jwt,
    refresh_token: "staging-integration-test-placeholder-refresh-token",
  });
  if (error) {
    throw new Error(
      `Failed to set staging session from STAGING_TEST_USER_JWT: ${error.message}. ` +
        "The JWT may have expired — mint a fresh one (see integration/pdf-render/README.md).",
    );
  }
}

/** Downloads the bytes at a signed PDF URL, throwing a descriptive error on non-2xx. */
export async function downloadPdfBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download PDF from signed URL (${res.status} ${res.statusText}): ${url}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** Asserts the well-known `%PDF-` magic bytes at the start of a byte buffer. */
export function assertPdfMagicBytes(bytes: Uint8Array): void {
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (header !== "%PDF-") {
    throw new Error(`Expected PDF magic bytes "%PDF-" at the start of the file, got "${header}"`);
  }
}

/**
 * Client-side polling window from src/services/offlineApi.ts:85-86
 * (`MAX_ATTEMPTS=30 * POLL_INTERVAL_MS=3000`). Re-exported so every test file
 * derives timeouts/gates from a single source instead of re-hardcoding 90_000.
 */
export const CLIENT_POLL_WINDOW_MS = 30 * 3000;

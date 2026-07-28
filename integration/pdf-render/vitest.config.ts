import { defineConfig } from "vitest/config";
import path from "path";

// ─── Map STAGING_* → VITE_* BEFORE Vite resolves env ──────────────────────────
//
// `@/integrations/supabase/client.ts` (the singleton every test in this suite
// exercises indirectly through `@/services/offlineApi`) reads
// `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, with a
// hardcoded production fallback. We deliberately do NOT ask whoever runs this
// suite to set `VITE_SUPABASE_URL` directly — that name is shared with the
// app's own dev/build tooling and it would be too easy to accidentally point a
// local `npm run dev` at staging, or vice-versa. Instead this suite uses its
// own `STAGING_*` names (documented in README.md) and remaps them here, in
// plain Node code that runs when this config module is evaluated — i.e.
// strictly before Vite's `loadEnv()` reads `process.env` to build
// `import.meta.env` for the modules under test.
if (process.env.STAGING_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = process.env.STAGING_SUPABASE_URL;
}
if (process.env.STAGING_SUPABASE_ANON_KEY) {
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.STAGING_SUPABASE_ANON_KEY;
}

// Client polling window from src/services/offlineApi.ts:85-86
// (MAX_ATTEMPTS=30 * POLL_INTERVAL_MS=3000 = 90_000ms). Several tests here
// poll for that long (or need to safely exceed it to observe a client-side
// timeout), so give Vitest a generous per-test timeout headroom.
const CLIENT_POLL_WINDOW_MS = 30 * 3000;

export default defineConfig({
  test: {
    // Plain Node, not jsdom: these are real HTTP integration tests (fetch,
    // child_process for pdftotext), not component tests. The Supabase client
    // singleton still needs a `localStorage` global for its session storage —
    // provided by ./setup.ts rather than by pulling in jsdom.
    environment: "node",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./setup.ts")],
    include: ["**/*.integration.test.ts"],
    testTimeout: CLIENT_POLL_WINDOW_MS + 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    // Replicates the relevant slice of the root vitest.config.ts alias so
    // `@/services/offlineApi` and `@/integrations/supabase/client` resolve
    // the same way they do for the app's own unit tests.
    alias: { "@": path.resolve(__dirname, "../../src") },
  },
});

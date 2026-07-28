/**
 * Minimal `localStorage` polyfill for Node.
 *
 * `@/integrations/supabase/client.ts` constructs its client with
 * `auth: { storage: localStorage, persistSession: true, ... }` — a bare
 * top-level reference evaluated at module-import time. Under the app's own
 * `vitest.config.ts` this works because `environment: "jsdom"` provides a
 * real `localStorage`. This suite intentionally runs under `environment:
 * "node"` (see vitest.config.ts) since it's doing real network I/O and
 * shelling out to `pdftotext`, not DOM testing — so we provide just enough of
 * `localStorage` for supabase-js's session persistence to not throw at
 * import time. It only needs to survive a single short-lived test process;
 * nothing here needs to persist across runs.
 *
 * We unconditionally override rather than checking `typeof globalThis
 * .localStorage === "undefined"`: newer Node versions ship an experimental
 * global `localStorage` that emits a noisy `ExperimentalWarning` (and
 * requires `--localstorage-file`) the first time it's touched. Always
 * installing our own in-memory implementation sidesteps that regardless of
 * which Node version runs this suite.
 */
const store = new Map<string, string>();

const polyfill: Storage = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: polyfill,
  writable: true,
  configurable: true,
});

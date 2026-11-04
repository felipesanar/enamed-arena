import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  // Scope tests use explicit fake env values, never developer secrets.
  envFile: false,
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/**/*.{test,spec}.ts",
    ],
    // Native Deno tests run outside Vitest. Keep dual-runtime _shared tests here.
    exclude: [
      ...configDefaults.exclude,
      "supabase/functions/gemini-*/**",
      "supabase/functions/caderno-reminders/handler.test.ts",
      "supabase/functions/calendar-notifications/worker.test.ts",
      "supabase/functions/hubspot-contact-sync/handler.test.ts",
      "supabase/functions/ops-health-alerts/worker.test.ts",
    ],
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50,
      },
      exclude: [
        "src/integrations/**",
        "src/components/ui/**",
        "src/test/**",
        "**/*.d.ts",
        "**/index.ts",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/**/*.{test,spec}.ts",
    ],
    // Edge functions Deno (gemini-*) importam de https:// e rodam com `deno test`,
    // não sob o Node/Vitest. Excluídas aqui para não quebrar `npm run test`.
    exclude: [
      ...configDefaults.exclude,
      "supabase/functions/gemini-*/**",
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

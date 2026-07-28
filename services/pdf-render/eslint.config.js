// Standalone ESLint config for `services/pdf-render` — a plain Node.js
// backend service (no React/browser code), so this is deliberately NOT the
// root `eslint.config.js` (which is ignored for this whole directory — see
// its `ignores` entry). Node globals only, no `react-hooks`/`react-refresh`
// plugins/rules, since none of that applies to a server-side TS package.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Structured JSON logging to stdout/stderr (see server.ts/compile.ts)
      // is this service's intentional, primary observability mechanism —
      // there is no separate logger module, and Cloud Run captures
      // stdout/stderr directly. `warn`/`error` are always allowed; plain
      // `console.log` calls in this service are deliberate request/compile
      // logging, not debugging leftovers, so this is "off" rather than
      // "warn" (unlike the frontend's root config).
      "no-console": "off",
    },
  },
  // Tests — relax `any` further (test doubles/mocks commonly need it).
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);

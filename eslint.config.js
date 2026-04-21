import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "archive/**", "src/sandbox/**", "supabase/functions/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Unused vars: warn instead of error so refactors don't fail CI hard,
      // but prefix-with-underscore escape hatch is preserved.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      // Warn (not error) to surface `any` in reviews without blocking.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-empty": "off",
      "no-control-regex": "warn",
      // Critical — must be error. Detects state bugs that aren't caught by typecheck.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Catch accidental console.* (use the logger instead). Warn to ease migration.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Bans hard-coded alert/confirm except via explicit inline-comment disable.
      "no-alert": "warn",
    },
  },
  // Tests & setup — relax some rules.
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);

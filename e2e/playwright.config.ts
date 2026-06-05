/**
 * Playwright config standalone para a pasta e2e/.
 *
 * Usa @playwright/test diretamente — NÃO depende de lovable-agent-playwright-config
 * (esse pacote é plataforma Lovable e não está instalado localmente).
 *
 * Como rodar (primeira vez):
 *   npx playwright install chromium
 *   npx playwright test --config e2e/playwright.config.ts
 *
 * O webServer abaixo sobe `npm run dev` automaticamente se o servidor ainda não
 * estiver rodando na porta 8080. Se você já tiver o dev server rodando, o
 * Playwright vai reusar a instância existente (reuseExistingServer: true).
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",           // testes ficam nesta mesma pasta (e2e/)
  testMatch: "**/*.spec.ts",

  // Timeout por teste — 30 s é conservador para um SPA com bundle grande
  timeout: 30_000,

  // Retries apenas em CI para evitar flake local mascarado
  retries: process.env.CI ? 2 : 0,

  // Workers paralelos: 1 em CI para evitar concorrência no dev server
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: "http://localhost:8080",
    // Headless por padrão; sobrescreva com PWDEBUG=1 ou --headed
    headless: true,
    // Viewport padrão — garante que elementos "hidden abaixo de sm" sejam visíveis
    viewport: { width: 1280, height: 720 },
    // Screenshot e trace apenas em falha
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    // Ignora erros de HTTPS em ambientes locais (não aplicável aqui, mas boa prática)
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    // Se o dev server já estiver rodando (comum em dev local), reusa.
    reuseExistingServer: !process.env.CI,
    // Timeout para o Vite subir — 60 s deve ser mais que suficiente
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

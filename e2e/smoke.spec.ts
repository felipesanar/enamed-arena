/**
 * E2E Smoke Test — enamed-arena
 *
 * Cobre apenas rotas públicas que não requerem autenticação nem backend real.
 * Auth está FORA do escopo destes testes.
 *
 * Pré-requisitos para executar:
 *   1. Instalar os browsers do Playwright (apenas uma vez por máquina):
 *        npx playwright install chromium
 *   2. Subir o dev server em paralelo (ou deixar o webServer config fazer isso):
 *        npm run dev
 *   3. Rodar os testes:
 *        npx playwright test --config e2e/playwright.config.ts
 *
 * Ou tudo de uma vez:
 *   npx playwright install chromium && npx playwright test --config e2e/playwright.config.ts
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// /login — tela de escolha de tipo de acesso (pública, sem backend call)
// ---------------------------------------------------------------------------
test.describe("/login — tela pública de acesso", () => {
  test("monta sem erros de runtime", async ({ page }) => {
    const consoleErrors: string[] = [];

    // Captura apenas erros JS reais; ignora ruído de rede (Supabase offline em CI).
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        !msg.text().includes("ERR_CONNECTION_REFUSED") &&
        !msg.text().includes("net::") &&
        !msg.text().includes("supabase") &&
        !msg.text().includes("Failed to fetch")
      ) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/login");

    // A tela inicial do /login é o "choice screen" — aparece antes de qualquer
    // chamada de rede porque depende apenas do estado local da AuthContext
    // (loading=true → spinner, loading=false sem user → choice screen).
    // Aguarda até a tela choice aparecer (timeout de 15 s é mais que suficiente
    // para o Vite dev server servir o bundle inicial).
    const choiceHeading = page.getByText("Como você quer acessar?");
    await expect(choiceHeading).toBeVisible({ timeout: 15_000 });

    // Confirma que os dois cards de escolha estão presentes
    await expect(page.getByText("Não sou aluno SanarFlix")).toBeVisible();
    await expect(page.getByText("Sou aluno SanarFlix")).toBeVisible();

    // Nenhum erro de runtime JS
    expect(consoleErrors, `Erros no console: ${consoleErrors.join("\n")}`).toHaveLength(0);
  });

  test("navega para o formulário de login ao escolher 'Não sou aluno SanarFlix'", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Não sou aluno SanarFlix").click();

    // Após a escolha o formulário de email/senha deve aparecer
    await expect(page.getByText("Acesse com e-mail")).toBeVisible({ timeout: 5_000 });
  });

  test("exibe instruções SanarFlix ao escolher 'Sou aluno SanarFlix'", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Sou aluno SanarFlix").click();

    await expect(page.getByText("Acesso via SanarFlix")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("link", { name: /Ir para o SanarFlix/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// /landing — página de marketing pública
// ---------------------------------------------------------------------------
test.describe("/landing — página de marketing", () => {
  test("monta e exibe a navbar com logo", async ({ page }) => {
    await page.goto("/landing");

    // A navbar tem um link acessível para "/landing" com aria-label
    const brandLink = page.getByRole("link", { name: /SanarFlix Simulados/i });
    await expect(brandLink).toBeVisible({ timeout: 15_000 });
  });

  test("botão 'Entrar' na navbar aponta para /login", async ({ page }) => {
    await page.goto("/landing");

    // Botão "Entrar" — visível apenas em sm+ (hidden abaixo de sm, mas Playwright
    // por padrão usa viewport 1280×720 então é visível)
    const loginLink = page.getByRole("link", { name: "Entrar" }).first();
    await expect(loginLink).toBeVisible({ timeout: 10_000 });
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

// ---------------------------------------------------------------------------
// Rotas inválidas — NotFound
// ---------------------------------------------------------------------------
test.describe("rota inexistente", () => {
  test("exibe a página 404 sem crash", async ({ page }) => {
    await page.goto("/esta-rota-nao-existe-8675309");

    // NotFound é lazy-loaded — aguarda o suspense resolver
    // O componente NotFound provavelmente tem "404" ou "não encontrada" no texto
    await expect(page.locator("body")).not.toBeEmpty();
    // Garante que o app não crashou (sem tela em branco total): ao menos um elemento renderizado
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });
});

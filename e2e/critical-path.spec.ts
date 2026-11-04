import { test, expect } from '@playwright/test';
import { criticalEnvironment } from './fixtures/criticalEnvironment';
import { installBackendFence } from './fixtures/backendFence';

test.describe('STAGING real', () => {
  const environment = criticalEnvironment();
  test.skip(!environment.ready, environment.reason);
test('password login, answer, reload/resume and finalize isolated exam', async ({ page, context }) => {
  const fence = await installBackendFence(context, environment.baseURL!, environment.projectRef!);
  // No auth interception or demo response: this is intentionally a real backend test.
  await page.goto('/login');
  fence.assertSafe();
  await page.getByText('Não sou aluno SanarFlix', { exact: true }).click();
  const passwordMode = page.getByRole('button', { name: 'Entrar com senha', exact: true });
  if (await passwordMode.isVisible()) await passwordMode.click();
  // Never retain auth traces or echo credential values on failures.
  await test.step('Authenticate dedicated fixture (credentials redacted)', async () => {
    try {
      fence.assertSafe();
      await page.getByLabel('Seu e-mail', { exact: true }).fill(process.env.E2E_FIXTURE_EMAIL!);
      await page.getByLabel('Sua senha', { exact: true }).fill(process.env.E2E_FIXTURE_PASSWORD!);
      await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
      await expect(page).not.toHaveURL(/\/login/);
      fence.assertSafe();
    } catch { throw new Error('Fixture authentication failed; sensitive details omitted.'); }
  });
  fence.assertSafe();
  await page.goto(`/simulados/${process.env.E2E_FIXTURE_SIMULADO_ID}/prova`);
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: /^(Começar|Continuar de onde parei)$/ }).click();
  const alternatives = page.getByRole('radiogroup', { name: /Alternativas da questão/ });
  await expect(alternatives).toBeVisible();
  fence.assertSafe();
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/answers' && response.request().method() === 'POST' && response.ok());
  await page.keyboard.press('1');
  await expect(alternatives.getByRole('radio', { checked: true })).toHaveCount(1);
  await saved;
  await expect(page.getByText('Salvo', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar de onde parei' }).click();
  await expect(alternatives.getByRole('radio', { checked: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /Finalizar|Confirmar/ }).click();
  await expect(page.getByRole('heading', { name: 'Prova concluída' })).toBeVisible();
  await expect(page.getByRole('timer')).not.toBeVisible();
  fence.assertSafe();
});
});

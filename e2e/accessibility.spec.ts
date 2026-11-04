import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

let bundle: string;
let styles: string;
test.skip(process.env.CRITICAL_E2E_MODE !== 'harness', 'Local harness only: set CRITICAL_E2E_MODE=harness and use critical.config.ts.');
test.beforeAll(async () => {
  const output = await build({ entryPoints: [path.resolve('e2e/fixtures/accessibility-harness.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': path.resolve('src') }, define: { 'process.env.NODE_ENV': '"production"' } });
  bundle = output.outputFiles[0].text;
  const css = await readFile(path.resolve('src/index.css'), 'utf8');
  styles = (await postcss([tailwindcss(path.resolve('tailwind.config.ts'))]).process(css, { from: undefined })).css;
});
for (const width of [375, 768, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`local harness (not real E2E): focus, timer, recovery ${width}/${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.route('**/*', route => {
      if (route.request().url() !== 'http://127.0.0.1:4897/harness') return route.abort();
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="pt-BR" class="${theme === 'dark' ? 'dark' : ''}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><div id="root"></div><script>${bundle.replace(/<\/script/gi, '<\\/script')}</script></html>` });
    });
    await page.goto('http://127.0.0.1:4897/harness');
    await page.keyboard.press('Tab'); await expect(page.getByRole('link')).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
    const status = page.getByRole('status'); const initial = await status.textContent();
    await page.getByRole('button', { name: 'Avançar relógio' }).click(); await expect(status).toHaveText('Tempo restante: 5 minutos.');
    await page.getByRole('button', { name: 'Avançar relógio' }).click(); await expect(status).toHaveText('Tempo restante: 5 minutos.');
    expect(initial).not.toBe(await status.textContent());
    await page.getByRole('button', { name: 'Ver atalhos de teclado' }).click();
    await expect(page.getByText(/baixa, média e alta/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('timer')).toHaveAttribute('aria-live', 'off');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const trigger = page.getByRole('button', { name: 'Ver atalhos de teclado' });
    expect(await trigger.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
    if (width === 375 && theme === 'dark') {
      const finalize = page.getByRole('button', { name: 'Finalizar', exact: true });
      for (const state of ['normal', 'hover', 'focus']) {
        if (state === 'hover') await finalize.hover();
        if (state === 'focus') { await page.mouse.move(0, 899); await finalize.focus(); }
        // Allow the existing color transition to settle before compositing alpha backgrounds.
        await page.waitForTimeout(300);
        const ratio = await finalize.evaluate(element => {
          const parse = (value: string) => {
            const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
            return [numbers[0], numbers[1], numbers[2], numbers.length > 3 ? numbers[3] : 1];
          };
          const mix = (top: number[], bottom: number[]) => top.slice(0, 3).map((v, i) => v * top[3] + bottom[i] * (1 - top[3]));
          const background = (el: Element | null): number[] => el ? mix(parse(getComputedStyle(el).backgroundColor), background(el.parentElement)) : [255, 255, 255];
          const luminance = (color: number[]) => color.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
          const bg = background(element);
          const fg = mix(parse(getComputedStyle(element).color), bg);
          return (Math.max(luminance(fg), luminance(bg)) + 0.05) / (Math.min(luminance(fg), luminance(bg)) + 0.05);
        });
        expect(ratio, `Finalizar dark ${state} contrast`).toBeGreaterThanOrEqual(4.5);
      }
    }
    await page.getByRole('button', { name: 'Simular falha de chunk' }).click();
    await expect(page.getByRole('alert')).toContainText('podem ser perdidas');
    await expect(page.getByRole('button', { name: 'Recarregar e retomar' })).toBeVisible();
  });
  test(`local HTML prototype: responsive focus ${width}/${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme });
    await page.route('**/*', route => route.abort());
    await page.setContent(await readFile(path.resolve('docs/design/exam-accessibility-prototype.html'), 'utf8'));
    await page.keyboard.press('Tab'); await expect(page.getByRole('link')).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.getByRole('button').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  });
}

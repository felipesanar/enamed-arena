import { defineConfig } from '@playwright/test';
import { criticalEnvironment } from './fixtures/criticalEnvironment';

const harness = process.env.CRITICAL_E2E_MODE === 'harness';
const safety = process.env.CRITICAL_E2E_MODE === 'safety';
const environment = harness || safety ? undefined : criticalEnvironment();
if (process.env.CI && !harness && !safety && !environment?.ready) throw new Error('Critical E2E requires the complete protected STAGING configuration.');

export default defineConfig({
  testDir: '.',
  testMatch: harness ? 'accessibility.spec.ts' : safety ? 'critical-safety.spec.ts' : 'critical-path.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  outputDir: `fixtures/.results/${harness ? 'harness' : safety ? 'safety' : 'staging'}`,
  use: {
    baseURL: environment?.baseURL,
    browserName: 'chromium',
    serviceWorkers: 'block',
    storageState: { cookies: [], origins: [] },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : undefined,
    // No traces/screenshots/video containing credentials, answers or session tokens.
    trace: 'off', screenshot: 'off', video: 'off',
  },
});

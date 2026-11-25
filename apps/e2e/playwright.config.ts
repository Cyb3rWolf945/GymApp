import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

// The web build is exported with a fake Supabase URL (http://localhost:54321) and every call to it is answered by
// support/fake-backend.ts, so the suite needs no Supabase, Stripe or OpenRouter. `MODEL_PROFILE=dev` is set in CI.
export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    viewport: { width: 420, height: 900 },
    // Set CHROMIUM_PATH to use a browser that is already installed instead of Playwright's own download.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'web', use: { ...devices['Desktop Chrome'], viewport: { width: 420, height: 900 } } }],
  webServer: { command: 'node serve.mjs', port: PORT, reuseExistingServer: !process.env.CI, env: { E2E_PORT: String(PORT) } },
});

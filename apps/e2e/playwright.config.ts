import { defineConfig, devices } from '@playwright/test';
import { SIZES } from './support/projects';

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
    // Set CHROMIUM_PATH to use a browser that is already installed instead of Playwright's own download.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  // Every spec runs at three screen sizes. The browser is the same; only the window changes.
  projects: (['phone', 'tablet', 'desktop'] as const).map((name) => ({ name, use: { ...devices['Desktop Chrome'], viewport: SIZES[name] } })),
  webServer: { command: 'node serve.mjs', port: PORT, reuseExistingServer: !process.env.CI, env: { E2E_PORT: String(PORT) } },
});

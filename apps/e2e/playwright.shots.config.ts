import { defineConfig, devices } from '@playwright/test';

// Screenshot tour (not part of the E2E suite): `SHOTS_DIR=/some/dir npx playwright test -c playwright.shots.config.ts`.
// Phone and desktop at deviceScaleFactor 2, dark, reduced motion so nothing is caught mid-animation.
const PORT = Number(process.env.E2E_PORT ?? 4173);
export default defineConfig({
  testDir: 'screenshots',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    deviceScaleFactor: 2,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
  ],
  webServer: { command: 'node serve.mjs', port: PORT, reuseExistingServer: !process.env.CI, env: { E2E_PORT: String(PORT) } },
});

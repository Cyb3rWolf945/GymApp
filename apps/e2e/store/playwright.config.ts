import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4173);

// Store screenshots: the web build, rendered at the sizes the stores ask for (pixels = viewport x scale factor).
//   pnpm --filter e2e build:web && pnpm --filter e2e screenshots      (output: apps/e2e/store/screenshots/<device>/)
// Same fake backend and synthetic data as the E2E suite: nothing real is ever shown.
export const DEVICES = [
  { name: 'ios-6.9in', width: 440, height: 956, scale: 3 }, // 1320 x 2868, the App Store's 6.9" slot (also used for 6.5")
  { name: 'ios-6.5in', width: 428, height: 926, scale: 3 }, // 1284 x 2778
  { name: 'android-phone', width: 360, height: 640, scale: 3 }, // 1080 x 1920
] as const;

export default defineConfig({
  testDir: '.',
  testMatch: 'screenshots.spec.ts',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    // The helpers freeze the clock for stable dates, which would freeze entrance animations half way: no motion here.
    reducedMotion: 'reduce',
    isMobile: true,
    hasTouch: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: DEVICES.map((d) => ({ name: d.name, use: { viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.scale } })),
  webServer: { command: 'node serve.mjs', cwd: join(__dirname, '..'), port: PORT, reuseExistingServer: true, env: { E2E_PORT: String(PORT) } },
});

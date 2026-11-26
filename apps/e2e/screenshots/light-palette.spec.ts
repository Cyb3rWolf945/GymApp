import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { completeQuiz, signUpWithPassword, signedInWithPlan, start } from '../support/app';

// Light and dark tour for the palette PR (E-70): the screens named in the issue, at phone and desktop size.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, scheme: string, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, project, `${scheme}-${name}.jpg`), type: 'jpeg', quality: 65 });
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((s) => localStorage.setItem('fuelift.theme', s), scheme);
    });

    test('signed out: landing, quiz, sign-in', async ({ page }) => {
      await start(page);
      await page.goto('/');
      await shot(page, scheme, '1-landing');
      await page.goto('/onboarding/goal');
      await shot(page, scheme, '2-onboarding');
      await page.goto('/sign-in');
      await shot(page, scheme, '3-sign-in');
    });

    test('the account modal plan step', async ({ page }) => {
      await start(page);
      await page.goto('/onboarding/welcome');
      await completeQuiz(page);
      await signUpWithPassword(page);
      await page.getByRole('dialog').getByText(en.plan.generating.stepIndicator(2)).first().waitFor();
      await shot(page, scheme, '4-plan-step');
    });

    test('signed in: Today, Plan, Nutrition, Progress, Settings, paywall', async ({ page }) => {
      const backend = await signedInWithPlan(page, { fixedTime: false });
      backend.state.history = new Date();
      for (const [name, path] of [['5-today', '/'], ['6-plan', '/plan'], ['7-nutrition', '/nutrition'], ['8-progress', '/progress'], ['9-settings', '/settings'], ['10-paywall', '/paywall']] as const) {
        await page.goto(path);
        await shot(page, scheme, name);
        if (name === '8-progress') {
          await page.getByTestId('heat-legend').filter({ visible: true }).first().scrollIntoViewIfNeeded();
          await shot(page, scheme, '8b-progress-map');
        }
      }
    });
  });
}


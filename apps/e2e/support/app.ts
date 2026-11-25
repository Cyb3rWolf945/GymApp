import { type Page, expect } from '@playwright/test';
import { authCopy } from '../../mobile/src/auth/copy';
import { en } from '../../mobile/src/copy/en';
import { type Backend, installFakeBackend } from './fake-backend';
import { NUTRITION_PLAN, SESSION_STORAGE_KEY, WORKOUT_PLAN, fakeSession } from './fixtures';

// Labels come from the app's own copy file, so a wording change cannot silently break the tests.

const o = en.onboarding.steps;
export const CHECKOUT_PATH = '/e2e-checkout';

/** Fixed date: a Monday, so with preferred days Mon and Thu "Upper body" is today's workout. */
export const FIXED_NOW = new Date('2026-11-23T10:00:00Z');

export async function start(page: Page, { fixedTime = true } = {}): Promise<Backend> {
  // A frozen clock keeps dates stable, but JS animations read `Date.now()` and would never advance: tests of motion turn it off.
  if (fixedTime) await page.clock.setFixedTime(FIXED_NOW);
  // The fake "Stripe Checkout" page: Stripe's hosted page is not part of this suite.
  // On the context, not the page: Checkout opens in a new tab.
  await page.context().route(`**${CHECKOUT_PATH}**`, (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Stripe Checkout (test stub)</h1>' }));
  return installFakeBackend(page, { checkoutUrl: `http://localhost:${process.env.E2E_PORT ?? 4173}${CHECKOUT_PATH}` });
}

const chip = (page: Page, label: string) => page.getByRole('checkbox', { name: label, exact: true });
const button = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
/** Text that is on screen. Expo Router keeps earlier screens mounted but hidden, so plain `getByText` can match those too. */
const shown = (page: Page, text: string, exact = true) => page.getByText(text, { exact }).filter({ visible: true }).first();
export { button, chip, shown };

/** The quiz (13 screens) with a synthetic profile. Ends on "Building your plan…" with the account modal open. */
export async function completeQuiz(page: Page, { waitForModal = true } = {}): Promise<void> {
  await button(page, o.welcome.cta).click();

  await chip(page, o.goal.options.recomp).click();
  await button(page, en.common.continue).click();

  await chip(page, o.basics.sex.male).click();
  await button(page, en.common.continue).click();

  await chip(page, o.experience.options.beginner).click();
  await button(page, en.common.continue).click();

  await chip(page, o.availability.weekdays.mon).click();
  await chip(page, o.availability.weekdays.thu).click();
  await button(page, en.common.continue).click();

  await chip(page, o.equipment.location.gym).click();
  await chip(page, o.equipment.equipment.full_gym).click();
  await button(page, en.common.continue).click();

  await button(page, o.injuries.skip).click();

  await chip(page, o.activity.options.light).click();
  await button(page, en.common.continue).click();

  await chip(page, o.diet.diet.omnivore).click();
  await chip(page, '3').click();
  await button(page, en.common.continue).click();

  await button(page, en.common.continue).click(); // allergies: none

  await button(page, o.budget.skip).click();

  for (const k of ['terms', 'privacy', 'healthData', 'disclaimer'] as const) await chip(page, o.consents[k]).click();
  await button(page, o.consents.cta).click();

  // Screen 14 before the account exists: the calories are calculated here, then the account modal opens over it.
  if (waitForModal) await expect(page.getByRole('dialog', { name: en.plan.generating.accountTitle })).toBeVisible();
}

/** The Create account form with a synthetic email and password. With "Confirm email" off in the fake, you are signed in at once. */
export async function signUpWithPassword(page: Page, email = 'e2e-user@example.test', password = 'e2e-password-1'): Promise<void> {
  await page.getByLabel(authCopy.emailLabel, { exact: true }).fill(email);
  await page.getByLabel(authCopy.passwordLabel, { exact: true }).fill(password);
  await page.getByRole('button', { name: authCopy.createAccount, exact: true }).click();
}

/** Give the fake backend a generated plan, a profile and a paid plan: what a returning user has. */
export function seedPlan(backend: Backend): void {
  backend.completeCheckout();
  const job = (id: string, kind: 'workout_plan' | 'nutrition_plan', plan: unknown) => ({ id, kind, status: 'done', created_at: new Date().toISOString(), result: { plan } });
  backend.state.jobs = [
    job('20000000-0000-4000-8000-000000000001', 'workout_plan', WORKOUT_PLAN),
    job('20000000-0000-4000-8000-000000000002', 'nutrition_plan', NUTRITION_PLAN),
  ];
  backend.state.profile = { user_id: 'u', onboarding: { preferredDays: ['mon', 'thu'], equipment: ['full_gym'], contraindications: [] }, experience: 'beginner' };
}

/** A signed-in Pro user whose plan is already generated, on Home. */
export async function signedInWithPlan(page: Page): Promise<Backend> {
  const backend = await start(page);
  seedPlan(backend);
  await page.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_STORAGE_KEY, fakeSession()] as const);
  await page.goto('/');
  return backend;
}

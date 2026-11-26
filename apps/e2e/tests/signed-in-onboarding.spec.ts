import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, completeQuiz, shown, signUpWithPassword, start } from '../support/app';
import { SESSION_STORAGE_KEY, USER, fakeSession } from '../support/fixtures';

const signedIn = (page: import('@playwright/test').Page) =>
  page.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_STORAGE_KEY, fakeSession()] as const);

test('sign up from /sign-in with no quiz answers: onboarding → generation → preview', async ({ page }) => {
  const backend = await start(page);
  await page.goto('/sign-in');
  await signUpWithPassword(page);

  // Not "Couldn't save your answers": the quiz, from its first screen.
  await expect(page).toHaveURL(/\/onboarding\/welcome/);
  await expect(page.getByText(en.onboarding.errors.saveProfile)).toHaveCount(0);
  await expect.poll(() => backend.writesTo('/track-event').some((w) => (w.body as { name?: string })?.name === 'onboarding_resumed_signed_in')).toBe(true);

  // Signed in there is no account to make: the last answer goes straight to building the plan, no account modal.
  await completeQuiz(page, { waitForModal: false });
  await expect(page).toHaveURL(/\/preview/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(backend.functionCalls.filter((f) => f === 'generate-plan')).toHaveLength(2);
  expect(backend.state.profile).toMatchObject({ sex: 'male', goal: 'recomp' });
});

test('a signed-in user with a half-filled profile resumes at the first missing step, with what is saved', async ({ page }) => {
  const backend = await start(page);
  backend.state.profile = {
    user_id: USER.id,
    onboarding: { version: 1, goalType: 'recomp', sex: 'male', age: 30, heightCm: 180, weightKg: 80, units: 'metric' },
  };
  await signedIn(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/onboarding\/experience/);
  await expect(page.getByRole('checkbox', { name: en.onboarding.steps.experience.options.beginner, exact: true })).toBeVisible();
  // Going back shows the saved answer, not an empty form.
  await button(page, en.common.back).click();
  await expect(page.getByRole('checkbox', { name: en.onboarding.steps.basics.sex.male, exact: true })).toBeChecked();
  const event = backend.writesTo('/track-event').map((w) => w.body as { name?: string; props?: { step?: string } }).find((b) => b?.name === 'onboarding_resumed_signed_in');
  expect(event?.props).toEqual({ step: 'experience' });
});

test('"Building your plan…" with an incomplete profile asks to finish the questions and never says the save failed', async ({ page }) => {
  await start(page);
  await signedIn(page);
  await page.goto('/generating');

  await expect(shown(page, en.plan.generating.needsAnswers)).toBeVisible();
  await expect(page.getByText(en.onboarding.errors.saveProfile)).toHaveCount(0);
  await button(page, en.common.continue).click();
  await expect(page).toHaveURL(/\/onboarding\/welcome/);
});

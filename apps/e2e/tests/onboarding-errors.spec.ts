import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, start } from '../support/app';

const o = en.onboarding.steps;
const m = en.onboarding.fieldErrors;

async function openStep(page: Page, step: string) {
  await start(page);
  await page.goto(`/onboarding/${step}`);
  await button(page, en.tracking.reject).click();
}
const alert = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text });

test('Basics: leave sex empty → the message appears under the sex options, and goes when you choose one', async ({ page }) => {
  await openStep(page, 'basics');
  await button(page, en.common.continue).click();

  const message = alert(page, m.sex.missing);
  await expect(message).toBeVisible();
  // Right under the sex options, not at the bottom of the screen.
  const sex = (await chip(page, o.basics.sex.female).boundingBox())!;
  const text = (await message.boundingBox())!;
  const age = (await page.getByText(o.basics.age, { exact: false }).first().boundingBox())!;
  expect(text.y, 'below the sex options').toBeGreaterThan(sex.y + sex.height - 2);
  expect(text.y, 'above the next field').toBeLessThan(age.y);
  // Nothing else is wrong on this step, and the old generic line is gone.
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByText('Pick an option to continue.')).toHaveCount(0);

  // Announced and linked to its field: the field is marked invalid and points at the message.
  const field = page.locator('[aria-invalid="true"]');
  await expect(field).toHaveCount(1);
  const describedBy = await field.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText(m.sex.missing);
  // It says it in words and a mark, not only in colour.
  await expect(message).toContainText('⚠');
  // Focus moved to the field with the error.
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-invalid'))).toBe('true');

  await chip(page, o.basics.sex.female).click();
  await expect(alert(page, m.sex.missing)).toHaveCount(0);
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await button(page, en.common.continue).click();
  await expect(page).not.toHaveURL(/\/onboarding\/basics/);
});

test('Equipment: two things missing → two messages, each goes on its own', async ({ page }) => {
  await openStep(page, 'equipment');
  await button(page, en.common.continue).click();
  await expect(alert(page, m.location.missing)).toBeVisible();
  await expect(alert(page, m.equipment.missing)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(2);

  await chip(page, o.equipment.location.gym).click();
  await expect(alert(page, m.location.missing)).toHaveCount(0);
  await expect(alert(page, m.equipment.missing)).toBeVisible(); // the other one stays

  await chip(page, o.equipment.equipment.full_gym).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Consents: each unticked one is named; ticking one clears only that one', async ({ page }) => {
  await openStep(page, 'consents');
  await button(page, o.consents.cta).click();
  for (const text of [m.consents.terms, m.consents.privacy, m.consents.healthData, m.consents.disclaimer]) await expect(alert(page, text)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(4);

  await chip(page, o.consents.privacy).click();
  await expect(alert(page, m.consents.privacy)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(3);
});

test('a message waits until Continue is pressed: nothing is shown on a fresh step', async ({ page }) => {
  await openStep(page, 'goal');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await button(page, en.common.continue).click();
  await expect(alert(page, m.goalType.missing)).toBeVisible();
  await chip(page, o.goal.options.recomp).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

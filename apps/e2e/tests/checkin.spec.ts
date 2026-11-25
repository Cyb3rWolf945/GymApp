import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, shown, signedInWithPlan } from '../support/app';

const t = en.home.checkin;

test('the weekly check-in card leads to a short form; once sent, the card is gone', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  await page.goto('/');
  await expect(shown(page, t.cardTitle)).toBeVisible();

  await button(page, t.cardCta).click();
  await expect(page).toHaveURL(/\/checkin/);
  await expect(shown(page, t.title)).toBeVisible();

  // Nothing is sent until the numbers are valid: energy and sleep are required, the weight has a range.
  await page.getByLabel(t.weight).fill('900');
  await button(page, t.save).click();
  await expect(shown(page, t.errors.weight)).toBeVisible();
  await expect(shown(page, t.errors.energy)).toBeVisible();
  expect(backend.functionCalls).not.toContain('weekly-checkin');

  await page.getByLabel(t.weight).fill('80,5');
  await chip(page, '4').first().click();
  await chip(page, '3').nth(1).click();
  await page.getByLabel(t.note).fill('Knee felt tight.');
  await button(page, t.save).click();

  await expect(page).not.toHaveURL(/\/checkin/);
  const sent = backend.writes.filter((w) => w.path.endsWith('/weekly-checkin')).at(-1)!.body as Record<string, unknown>;
  expect(sent).toMatchObject({ weightKg: 80.5, energy: 4, sleep: 3, note: 'Knee felt tight.', weekStart: '2026-11-23' });

  await page.goto('/');
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(shown(page, t.cardTitle)).toHaveCount(0);
});

test('"Not now" hides the card for the week without sending anything', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  await page.goto('/');
  await button(page, t.cardDismiss).click();
  await expect(shown(page, t.cardTitle)).toHaveCount(0);
  await page.reload();
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(shown(page, t.cardTitle)).toHaveCount(0);
  expect(backend.functionCalls).not.toContain('weekly-checkin');
});

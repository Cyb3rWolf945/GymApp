import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { chip, shown, signedInWithPlan } from '../support/app';

const c = en.coach;

test('Today greets in the saved coach style; Settings changes it and saves it to the profile', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  backend.state.profile = { ...(backend.state.profile as object), coach_style: 'hype' };
  await page.goto('/');
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(page.getByText(new RegExp(`^(${c.greeting.hype.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`)).filter({ visible: true }).first()).toBeVisible();

  await page.goto('/settings');
  await expect(shown(page, c.settingsTitle)).toBeVisible();
  await chip(page, c.styles.direct.label).click();
  await expect.poll(() => backend.writesTo('/profiles').length).toBeGreaterThan(0);
  expect(backend.writesTo('/profiles').at(-1)!.body).toEqual({ coach_style: 'direct' });
  await expect(shown(page, c.styles.direct.example)).toBeVisible();
});

test('without a saved style Today is Calm', async ({ page }) => {
  await signedInWithPlan(page);
  await page.goto('/');
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(page.getByText(new RegExp(`^(${c.greeting.calm.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`)).filter({ visible: true }).first()).toBeVisible();
});

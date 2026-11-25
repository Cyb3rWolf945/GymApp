import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, shown, signedInWithPlan } from '../support/app';
import type { Backend } from '../support/fake-backend';

const t = en.home.weekly;
const WEEK = '2026-11-23';

/** The plan jobs of `seedPlan`, plus a newer weekly pair waiting for the user's decision. */
function withWeeklyUpdate(backend: Backend) {
  const jobs = backend.state.jobs as { id: string; kind: string; result: { plan: unknown } }[];
  const weekly = jobs.map((j, i) => ({
    ...j,
    id: `30000000-0000-4000-8000-00000000000${i + 1}`,
    created_at: '2099-01-01T00:00:00Z',
    adapt_week: WEEK,
    adapt_state: 'new',
    result: { ...j.result, update: { note: 'You trained 3 of 3 days. Nice week.', changes: [{ where: 'Monday', text: 'Squat 3×8 → 4×6', why: 'Your squat went up 5 kg.' }] } },
  }));
  backend.state.jobs = [...jobs, ...weekly];
}

test('a weekly update shows a card and a "What changed" screen; keeping it sends the choice', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  withWeeklyUpdate(backend);
  await page.goto('/');
  await expect(shown(page, t.cardTitle)).toBeVisible();
  await button(page, t.cardCta).click();

  await expect(page).toHaveURL(/\/weekly-changes/);
  await expect(shown(page, t.title)).toBeVisible();
  await expect(shown(page, 'Monday: Squat 3×8 → 4×6')).toBeVisible();
  await expect(shown(page, 'Your squat went up 5 kg.')).toBeVisible();

  await button(page, t.keep).click();
  await expect(page).toHaveURL(/\/plan/);
  const call = backend.writes.filter((w) => w.path.endsWith('/resolve_weekly_adapt')).at(-1)!.body;
  expect(call).toEqual({ p_week: WEEK, p_keep: true });

  await page.goto('/');
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(shown(page, t.cardTitle)).toHaveCount(0);
});

test('"Go back to last week" reverts it and the card is gone', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  withWeeklyUpdate(backend);
  await page.goto('/weekly-changes');
  await button(page, t.revert).click();
  await expect(page).toHaveURL(/\/plan/);
  expect(backend.writes.filter((w) => w.path.endsWith('/resolve_weekly_adapt')).at(-1)!.body).toEqual({ p_week: WEEK, p_keep: false });
  await page.goto('/');
  await expect(shown(page, en.home.title)).toBeVisible();
  await expect(shown(page, t.cardTitle)).toHaveCount(0);
});

test('Settings: weekly updates are on by default and can be turned off', async ({ page }) => {
  const backend = await signedInWithPlan(page);
  await page.goto('/settings');
  await expect(shown(page, t.settingsTitle)).toBeVisible();
  await expect(shown(page, t.enabledNote)).toBeVisible();
  await button(page, t.off).click();
  await expect.poll(() => backend.writesTo('/profiles').length).toBeGreaterThan(0);
  expect(backend.writesTo('/profiles').at(-1)!.body).toEqual({ weekly_adapt: false });
  await expect(button(page, t.on)).toBeVisible();
});

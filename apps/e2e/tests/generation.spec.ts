import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, seedPlan, shown, start } from '../support/app';
import { FIXED_NOW } from '../support/app';
import { SESSION_STORAGE_KEY, fakeSession } from '../support/fixtures';

/** A signed-in user whose profile is saved and complete, on the "Building your plan…" screen, with `jobs` already in the table. */
async function building(page: import('@playwright/test').Page, setup: (b: Awaited<ReturnType<typeof start>>) => void) {
  const backend = await start(page);
  seedPlan(backend);
  backend.state.entitled = true;
  setup(backend);
  await page.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_STORAGE_KEY, fakeSession()] as const);
  await page.goto('/generating');
  return backend;
}

const minutesBefore = (m: number) => new Date(FIXED_NOW.getTime() - m * 60_000).toISOString();

test('a job stuck in "running" is not waited on: a new one starts and the preview opens', async ({ page }) => {
  const backend = await building(page, (b) => {
    const [workout, nutrition] = b.state.jobs as Record<string, unknown>[];
    // The workout plan is done; the meal plan job has been "running" for 10 minutes: its function died.
    b.state.jobs = [{ ...workout, created_at: minutesBefore(11) }, { ...nutrition, status: 'running', result: null, created_at: minutesBefore(10) }];
  });
  await expect(page).toHaveURL(/\/preview/);
  // Only the dead kind was started again.
  const started = backend.writes.filter((w) => w.path.endsWith('/generate-plan')).map((w) => (w.body as { kind: string }).kind);
  expect(started).toEqual(['nutrition_plan']);
});

test('a failing run shows the error and Try again; Try again starts new jobs and reaches the preview', async ({ page }) => {
  const backend = await building(page, (b) => {
    b.state.jobs = [];
    b.state.generation = 'fail-once';
  });
  await expect(shown(page, en.errors.generatePlan)).toBeVisible();
  const before = backend.state.generateCalls;
  await button(page, en.plan.generating.retry).click();
  await expect(page).toHaveURL(/\/preview/);
  expect(backend.state.generateCalls).toBeGreaterThan(before); // new jobs, not a wait on the dead ones
});

test('polling stops once the preview is open', async ({ page }) => {
  const backend = await building(page, (b) => {
    b.state.jobs = [];
  });
  await expect(page).toHaveURL(/\/preview/);
  await expect(shown(page, en.plan.preview.title)).toBeVisible();
  const reads = backend.reads.generation_jobs ?? 0;
  await page.waitForTimeout(7_000); // longer than the longest polling gap (5 s)
  expect(backend.reads.generation_jobs ?? 0).toBe(reads);
});

test('the starter plan is announced when the models could not make a personal one', async ({ page }) => {
  await building(page, (b) => {
    for (const j of b.state.jobs as { result: Record<string, unknown> }[]) j.result = { ...j.result, source: 'template' };
  });
  await page.goto('/preview');
  await expect(shown(page, en.plan.starterPlan)).toBeVisible();
});

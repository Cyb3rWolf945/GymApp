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

test('a template meal plan: the starter note with its button, and the meal slots by name (preview and Nutrition)', async ({ page }) => {
  await building(page, (b) => {
    const nutrition = (b.state.jobs as { kind: string; result: Record<string, unknown> }[]).find((j) => j.kind === 'nutrition_plan')!;
    const meal = (name: string, recipeSlug: string) => ({ name, recipeSlug, portions: 1 });
    const day = (dayType: string) => ({ dayType, meals: [meal('Breakfast', 'oats-and-berries'), meal('Lunch', 'chicken-rice-bowl'), meal('Afternoon snack', 'oats-and-berries'), meal('Dinner', 'lentil-curry')], kcal: 2400, proteinG: 140, carbsG: 260, fatG: 70 });
    // What `generate-plan` stores when it falls back to the template: source 'template', four meals a day with slot names.
    nutrition.result = { source: 'template', relaxed: [], plan: { days: [day('training'), day('rest')], rationale: 'Four meals a day around 2,400 kcal and 140 g protein on training days, 30 minutes or less to cook. Swap any meal you like less.' } };
  });
  await page.goto('/preview');
  await expect(shown(page, en.plan.starterPlan)).toBeVisible();
  for (const name of ['Breakfast', 'Lunch', 'Afternoon snack', 'Dinner']) await expect(shown(page, name)).toBeVisible();
  await expect(shown(page, 'Four meals a day around 2,400 kcal', false)).toBeVisible();

  // The same note on Nutrition, and its button leads to "Update my plan".
  await page.goto('/nutrition');
  await expect(shown(page, en.plan.starterPlan)).toBeVisible();
  await button(page, en.plan.starterPlanCta).click();
  await expect(page).toHaveURL(/\/update-plan/);
});

test('a plan made by the models has no starter note', async ({ page }) => {
  await building(page, () => {});
  await page.goto('/preview');
  await expect(shown(page, en.plan.preview.title)).toBeVisible();
  await expect(shown(page, en.plan.starterPlan)).toHaveCount(0);
});

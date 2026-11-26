import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, chip, completeQuiz, start } from '../support/app';

const o = en.onboarding.steps;
const live = en.onboarding.livePreview;

async function atActivity(page: Page) {
  await start(page);
  await page.goto('/onboarding/goal');
  await button(page, en.tracking.reject).click();
  await chip(page, o.goal.options.recomp).click();
  await button(page, en.common.continue).click();
  await chip(page, o.basics.sex.male).click();
  await button(page, en.common.continue).click();
  await chip(page, o.experience.options.beginner).click();
  await button(page, en.common.continue).click();
  await chip(page, o.availability.weekdays.mon).click();
  await button(page, en.common.continue).click();
  await chip(page, o.equipment.location.gym).click();
  await chip(page, o.equipment.equipment.full_gym).click();
  await button(page, en.common.continue).click();
  await button(page, o.injuries.skip).click();
  await expect(chip(page, o.activity.options.light)).toBeVisible();
}

test('the choices are large cards, still checkboxes named by their label', async ({ page }) => {
  await start(page);
  await page.goto('/onboarding/goal');
  await button(page, en.tracking.reject).click();
  for (const label of Object.values(o.goal.options)) {
    const card = chip(page, label);
    await expect(card).toBeVisible();
    expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  }
  await chip(page, o.goal.options.cut).click();
  await expect(chip(page, o.goal.options.cut)).toHaveAttribute('aria-checked', 'true');
  await expect(chip(page, o.goal.options.bulk)).toHaveAttribute('aria-checked', 'false');
});

test('the calorie target shows up once it can be worked out, and changes with the answers', async ({ page }) => {
  await atActivity(page);
  const card = page.getByTestId('live-preview').filter({ visible: true });
  await expect(card).toHaveCount(0); // no activity level yet
  await chip(page, o.activity.options.sedentary).click();
  await expect(card).toContainText(/About [\d,]+ kcal a day/);
  await expect(card).toContainText(/g protein · \d+ g carbs · \d+ g fat/);
  const kcal = async () => Number(((await card.innerText()).match(/About ([\d,]+) kcal/) ?? [])[1].replace(',', ''));
  const low = await kcal();
  await chip(page, o.activity.options.very_active).click();
  await expect.poll(kcal).toBeGreaterThan(low);
  await expect(card.getByText(live.title)).toBeVisible();
});

test('"Building your plan…" has the pulsing orb above the steps', async ({ page }) => {
  await start(page);
  await page.goto('/onboarding/goal');
  await button(page, en.tracking.reject).click();
  await completeQuiz(page);
  await expect(page.getByTestId('building-orb')).toHaveCount(1);
  await expect(page.getByText(en.plan.generating.title, { exact: true })).toBeVisible();
});

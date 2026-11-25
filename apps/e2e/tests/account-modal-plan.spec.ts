import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { type Backend } from '../support/fake-backend';
import { SIZES, type ProjectName } from '../support/projects';
import { button, completeQuiz, shown, signUpWithPassword, signedInWithPlan, start } from '../support/app';

// E-62: step 2 of the account modal (choose a plan), right after the account exists.

const g = en.plan.generating;
const p = en.paywall;
const project = () => test.info().project.name as ProjectName;

async function toModal(page: Page): Promise<Backend> {
  const backend = await start(page);
  await page.goto('/');
  await button(page, en.tracking.reject).click();
  await button(page, en.landing.cta).click();
  await completeQuiz(page);
  return backend;
}
const planDialog = (page: Page) => page.getByRole('dialog', { name: g.planTitle });
const events = (backend: Backend) => backend.writesTo('/track-event').map((w) => w.body as { name: string; props: Record<string, unknown> });

test('step 1 shows "1 of 2" and the price line; signing up moves to step 2 in place, Pro and Annual chosen', async ({ page }) => {
  const backend = await toModal(page);
  const dialog = page.getByRole('dialog', { name: g.accountTitle });
  await expect(dialog).toBeVisible();
  await expect(shown(page, g.stepIndicator(1))).toBeVisible();
  // The line comes from the same prices as the paywall: "Plans from $X a month · 7-day free trial on annual plans".
  await expect(page.getByText(/^Plans from \$\d+\.\d\d a month · 7-day free trial on annual plans$/).filter({ visible: true }).first()).toBeVisible();

  await signUpWithPassword(page);
  await expect(planDialog(page)).toBeVisible();
  await expect(shown(page, g.stepIndicator(2))).toBeVisible();

  // Pro is pre-selected and marked "Most popular"; Annual is selected.
  await expect(page.getByRole('radio', { name: p.chosen('Pro', p.annual) })).toBeChecked();
  await expect(shown(page, p.popular)).toBeVisible();
  await expect(button(page, p.annual)).toHaveAttribute('aria-selected', 'true');
  await expect(button(page, p.ctaTrial(7))).toBeVisible();
  await expect(page.getByText(/Then \$\d+\.\d\d\/year after the trial\. Cancel anytime\./).filter({ visible: true }).first()).toBeVisible();

  // Picking Elite and then Monthly changes the announced choice and the button.
  await page.getByRole('radio', { name: p.chosen('Elite', p.annual) }).click();
  await expect(page.getByRole('radio', { name: p.chosen('Elite', p.annual) })).toBeChecked();
  await button(page, p.monthly).click();
  await expect(button(page, p.subscribe)).toBeVisible();
  await expect(page.getByRole('radio', { name: p.chosen('Elite', p.monthly) })).toBeChecked();

  const seen = events(backend).filter((e) => e.name === 'paywall_view');
  expect(seen.at(-1)?.props).toMatchObject({ placement: 'account_modal' });
});

test('Start free trial opens Checkout for the selected tier; the picker remembers it', async ({ page, context }) => {
  const backend = await toModal(page);
  await signUpWithPassword(page);
  await expect(planDialog(page)).toBeVisible();

  const popup = context.waitForEvent('page');
  await button(page, p.ctaTrial(7)).click();
  const checkout = await popup;
  await expect(checkout.getByText('Stripe Checkout (test stub)')).toBeVisible();
  const call = backend.writesTo('/stripe-checkout')[0]?.body as { priceKey: string; returnTo?: string };
  expect(call.priceKey).toBe('pro_annual');
  expect(call.returnTo).toBe('account_modal'); // a cancelled Checkout comes back to this modal
  expect(events(backend).find((e) => e.name === 'checkout_start')?.props).toMatchObject({ price_key: 'pro_annual', placement: 'account_modal' });
  await checkout.close();
});

test('"See my plan first" closes the modal and continues to the preview, with no payment', async ({ page }) => {
  const backend = await toModal(page);
  await signUpWithPassword(page);
  await expect(planDialog(page)).toBeVisible();
  await button(page, g.seePlan).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/preview/);
  await expect(shown(page, 'Upper body')).toBeVisible();
  expect(backend.functionCalls).not.toContain('stripe-checkout');
  expect(events(backend).filter((e) => e.name === 'plan_step_skipped')).toHaveLength(1);
});

test('Escape closes step 2 and leaves "Choose a plan"; the button brings it back; the backdrop does nothing', async ({ page }) => {
  await toModal(page);
  await signUpWithPassword(page);
  await expect(planDialog(page)).toBeVisible();
  // Tapping outside does not close it.
  await page.mouse.click(2, 2);
  await expect(planDialog(page)).toBeVisible();
  // (Escape is heard by whatever has focus inside the dialog; the click outside moved focus away, so put it back.)
  await planDialog(page).focus();
  await page.keyboard.press('Escape');
  await expect(planDialog(page)).toHaveCount(0);
  await expect(button(page, g.planCta)).toBeVisible();
  await button(page, g.planCta).click();
  await expect(planDialog(page)).toBeVisible();
});

test('someone who already has a plan skips step 2', async ({ page }) => {
  const backend = await toModal(page);
  backend.state.entitled = true;
  await signUpWithPassword(page);
  await expect(page).toHaveURL(/\/preview/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(events(backend).filter((e) => e.name === 'paywall_view')).toHaveLength(0);
});

test('back from a cancelled Checkout lands on step 2 with the same selection', async ({ page }) => {
  const backend = await start(page);
  void backend;
  await signedInWithPlan(page);
  await page.evaluate(() => localStorage.setItem('fuelift.account_modal.selection', JSON.stringify({ tier: 'elite', interval: 'month' })));
  await page.goto('/?checkout=cancelled');
  await expect(planDialog(page)).toBeVisible();
  await expect(page.getByRole('radio', { name: p.chosen('Elite', p.monthly) })).toBeChecked();
  await expect(page).not.toHaveURL(/checkout=cancelled/);
});

test('step 1 is a dialog of at most 420 px; step 2 is wider on desktop with the tiers side by side, and a sheet on phones', async ({ page }) => {
  await toModal(page);
  const { width, height } = SIZES[project()];
  const step1 = (await page.getByRole('dialog', { name: g.accountTitle }).boundingBox())!;
  if (project() !== 'phone') expect(step1.width).toBeLessThanOrEqual(420);
  await signUpWithPassword(page);
  await expect(planDialog(page)).toBeVisible();
  const box = (await planDialog(page).boundingBox())!;
  if (project() === 'phone') {
    expect(box.y + box.height, 'phone: sheet on the bottom edge').toBeGreaterThanOrEqual(height - 2);
    expect(box.height, 'phone: almost full height').toBeGreaterThan(height * 0.8);
    // The main button stays on screen (pinned), whatever the scroll position.
    const cta = (await button(page, p.ctaTrial(7)).boundingBox())!;
    expect(cta.y + cta.height).toBeLessThanOrEqual(height);
  } else if (project() === 'desktop') {
    expect(box.width).toBeLessThanOrEqual(960);
    expect(box.width).toBeGreaterThan(420);
    const [a, b] = await Promise.all([
      page.getByRole('radio', { name: p.chosen('Basic', p.annual) }).boundingBox(),
      page.getByRole('radio', { name: p.chosen('Pro', p.annual) }).boundingBox(),
    ]);
    expect(b!.x, 'cards side by side').toBeGreaterThan(a!.x + a!.width - 2);
  }
  expect(Math.abs(box.x + box.width / 2 - width / 2) < 4 || project() === 'phone').toBe(true);
});

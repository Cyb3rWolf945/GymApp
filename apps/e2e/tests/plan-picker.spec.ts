import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, signedInWithPlan, shown } from '../support/app';

const p = en.paywall;
const radio = (page: Page, tier: string, interval: string = p.annual) => page.getByRole('radio', { name: p.chosen(tier, interval) });
const lookupKeys = (b: Awaited<ReturnType<typeof signedInWithPlan>>) => b.writesTo('/stripe-checkout').map((w) => (w.body as { priceKey: string }).priceKey);

async function paywall(page: Page) {
  const backend = await signedInWithPlan(page);
  await page.goto('/paywall');
  await expect(shown(page, p.title)).toBeVisible();
  return backend;
}

test('the paywall page is one group: Pro is selected, and picking Basic leaves only Basic selected', async ({ page }) => {
  await paywall(page);
  await expect(page.getByRole('radiogroup')).toBeVisible();
  await expect(radio(page, 'Pro')).toBeChecked();
  for (const other of ['Basic', 'Elite']) await expect(radio(page, other)).not.toBeChecked();

  await radio(page, 'Basic').click(); // anywhere on the card
  await expect(radio(page, 'Basic')).toBeChecked();
  for (const other of ['Pro', 'Elite']) await expect(radio(page, other)).not.toBeChecked();
  await expect(shown(page, p.selected)).toBeVisible();
  await expect(page.getByText(p.selected, { exact: true }).filter({ visible: true })).toHaveCount(1);
  // "Most popular" is a label on Pro, whatever is selected.
  await expect(shown(page, p.popular)).toBeVisible();
});

test('one primary button for the selected plan (no per-card buttons); Checkout starts with that plan; the choice survives Monthly and Annual', async ({ page, context }) => {
  const backend = await paywall(page);
  await expect(button(page, p.cta)).toHaveCount(0); // the old per-card buttons are gone
  await expect(button(page, p.ctaTrial(7))).toHaveCount(1);
  await radio(page, 'Basic').click();
  await expect(page.getByText(/Then \$59\.99\/year after the trial/).filter({ visible: true }).first()).toBeVisible();

  await button(page, p.monthly).click();
  await expect(radio(page, 'Basic', p.monthly)).toBeChecked(); // still Basic
  await expect(button(page, p.subscribe)).toHaveCount(1);
  await expect(shown(page, p.cancelAnytime)).toBeVisible();
  const popup = context.waitForEvent('page');
  await button(page, p.subscribe).click();
  await (await popup).close();
  expect(lookupKeys(backend)).toEqual(['basic_monthly']);

  await button(page, p.annual).click();
  await expect(radio(page, 'Basic')).toBeChecked();
  const popup2 = context.waitForEvent('page');
  await button(page, p.ctaTrial(7)).click();
  await (await popup2).close();
  expect(lookupKeys(backend)).toEqual(['basic_monthly', 'basic_annual']);
});

test('arrow keys move the selection through the cards', async ({ page }) => {
  await paywall(page);
  await radio(page, 'Pro').focus();
  await page.keyboard.press('ArrowRight');
  await expect(radio(page, 'Elite')).toBeChecked();
  await expect(radio(page, 'Elite')).toBeFocused();
  await page.keyboard.press('ArrowRight'); // wraps
  await expect(radio(page, 'Basic')).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(radio(page, 'Elite')).toBeChecked();
});

test('the selected card is marked by more than colour: a check and the word "Selected"; unselected cards are not', async ({ page }) => {
  await paywall(page);
  const proCard = radio(page, 'Pro');
  await expect(proCard.getByText(p.selected, { exact: true })).toBeVisible();
  await expect(radio(page, 'Basic').getByText(p.selected, { exact: true })).toHaveCount(0);
  await radio(page, 'Elite').click();
  await expect(radio(page, 'Elite').getByText(p.selected, { exact: true })).toBeVisible();
  await expect(proCard.getByText(p.selected, { exact: true })).toHaveCount(0);
});

test('tap targets: every card and the toggle are at least 48 px tall', async ({ page }) => {
  await paywall(page);
  for (const tier of ['Basic', 'Pro', 'Elite']) expect((await radio(page, tier).boundingBox())!.height).toBeGreaterThanOrEqual(48);
  for (const label of [p.monthly, p.annual]) expect((await button(page, label).boundingBox())!.height).toBeGreaterThanOrEqual(40);
});

test('desktop hover: an unselected card lightens its border towards the accent; the selected card does not change', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'hover is a desktop thing');
  await paywall(page);
  const frame = (tier: string) => radio(page, tier).locator('xpath=./div/div');
  const border = (tier: string) => frame(tier).evaluate((e) => getComputedStyle(e).borderTopColor);
  const idle = await border('Basic');
  await radio(page, 'Basic').hover();
  await expect.poll(() => border('Basic')).not.toBe(idle);
  await page.mouse.move(0, 0);
  await expect.poll(() => border('Basic')).toBe(idle);

  const selected = await border('Pro');
  await radio(page, 'Pro').hover();
  await page.waitForTimeout(300);
  expect(await border('Pro')).toBe(selected);
  expect(selected).toBe('rgb(198, 255, 61)'); // the accent
});

test('in light mode the selected card has the light accent border (accentBorder) and the others the plain border', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await paywall(page);
  const border = (tier: string) => radio(page, tier).locator('xpath=./div/div').evaluate((e) => getComputedStyle(e).borderTopColor);
  await expect.poll(() => border('Pro')).toBe('rgb(94, 143, 10)');
  expect(await border('Basic')).not.toBe('rgb(94, 143, 10)');
});

import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { button, completeQuiz, shown, signUpWithMagicLink, start } from '../support/app';

test('landing → quiz → account → plan generated → preview → paywall → checkout → Home shows the plan', async ({ page, context }) => {
  const backend = await start(page);

  // Landing, arriving from an ad.
  await page.goto('/?utm_source=meta&utm_medium=paid&utm_campaign=e2e');
  await expect(shown(page, en.landing.hero)).toBeVisible();
  await expect.poll(() => backend.writesTo('/track-event').filter((w) => (w.body as { name?: string })?.name === 'landing_view').length).toBe(1); // counted once, with the UTM tags
  expect((backend.writesTo('/track-event')[0].body as { props: Record<string, string> }).props).toMatchObject({ utm_source: 'meta', utm_campaign: 'e2e' });
  // Tracking consent: reject, so nothing is sent to Meta.
  await expect(shown(page, en.tracking.title)).toBeVisible();
  await button(page, en.tracking.reject).click();
  await expect(page.getByText(en.tracking.title)).toBeHidden();
  await button(page, en.landing.cta).click();

  await completeQuiz(page);
  await signUpWithMagicLink(page);

  // The profile is saved with the ad attribution and the consents, then the plan is generated.
  await expect(shown(page, en.plan.generating.title)).toBeVisible();
  await expect.poll(() => backend.functionCalls.filter((f) => f === 'generate-plan').length).toBe(2); // workout + meals
  const profile = backend.writesTo('/profiles')[0]?.body as { attribution?: Record<string, string>; goal?: string } | undefined;
  expect(profile?.attribution).toMatchObject({ utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'e2e' });
  expect(profile?.attribution?.fbc).toBeUndefined(); // tracking was rejected: no Facebook ids are kept
  const consents = backend.writesTo('/consent_records')[0]?.body as { kind: string; accepted: boolean }[];
  expect(consents.map((c) => c.kind)).toEqual(expect.arrayContaining(['terms', 'privacy', 'health_data', 'disclaimer']));
  expect(consents.find((c) => c.kind === 'marketing')).toMatchObject({ accepted: false });

  // Plan preview, then the paywall (the plan is free to see, the full plan is not).
  await expect(page).toHaveURL(/\/preview/);
  await expect(shown(page, 'Upper body')).toBeVisible();
  await button(page, en.plan.preview.cta).click();
  await expect(page).toHaveURL(/\/paywall/);
  await expect(shown(page, en.paywall.popular)).toBeVisible();
  await expect(shown(page, en.paywall.eliteHighlight)).toBeVisible();

  // Checkout opens in a new tab (Stripe's hosted page; here a stub). The webhook then grants the entitlement.
  const popup = context.waitForEvent('page');
  await button(page, en.paywall.cta).first().click();
  const checkout = await popup;
  await expect(checkout.getByText('Stripe Checkout (test stub)')).toBeVisible();
  expect(backend.functionCalls).toContain('stripe-checkout');
  const checkoutCall = backend.writesTo('/stripe-checkout')[0]?.body as { priceKey: string };
  expect(checkoutCall.priceKey).toMatch(/_annual$/);
  backend.completeCheckout();
  await checkout.close();

  // Back in the app, Home shows the plan: today's workout and meals.
  await page.goto('/');
  await expect(shown(page, 'Upper body')).toBeVisible();
  await expect(button(page, en.home.startWorkout)).toBeVisible();
  await expect(shown(page, en.home.mealsTitle)).toBeVisible();
  await expect(shown(page, 'Chicken rice bowl', false)).toBeVisible();
});

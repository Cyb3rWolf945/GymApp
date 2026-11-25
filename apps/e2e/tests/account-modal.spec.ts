import { expect, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { SIZES, type ProjectName } from '../support/projects';
import { button, completeQuiz, signUpWithPassword, start } from '../support/app';

const t = en.plan.generating;
const project = () => test.info().project.name as ProjectName;

/** The quiz up to "Building your plan…" with the account modal open. */
async function toModal(page: Parameters<typeof completeQuiz>[0]) {
  const backend = await start(page);
  await page.goto('/');
  await button(page, en.tracking.reject).click(); // the cookie banner is not what is tested here
  await button(page, en.landing.cta).click();
  await completeQuiz(page);
  return backend;
}

test('the checklist shows first, then the account modal opens over it', async ({ page }) => {
  await start(page);
  await page.goto('/');
  await button(page, en.tracking.reject).click();
  await button(page, en.landing.cta).click();
  await completeQuiz(page, { waitForModal: false });

  // Calories are done and the rest is pending, with no dialog yet: people see the progress first.
  await expect(page.getByText(/^About [\d,]+ kcal a day$/).first()).toBeVisible();
  const dialog = page.getByRole('dialog', { name: t.accountTitle });
  await expect(dialog).toHaveCount(0);
  // After about a second the modal opens.
  await expect(dialog).toBeVisible();
});

test('modal over the progress list: no inline sign-up block, nothing dismisses it by tapping outside', async ({ page }) => {
  await toModal(page);
  const dialog = page.getByRole('dialog', { name: t.accountTitle });

  // The page behind is only the title and the checklist; the account prompt lives in the dialog.
  await expect(page.getByText(t.title, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^About [\d,]+ kcal a day$/).first()).toBeAttached();
  await expect(dialog.getByText(t.accountBody, { exact: true })).toBeVisible();
  await expect(page.getByText(t.accountBody, { exact: true })).toHaveCount(1); // only inside the dialog
  await expect(button(page, t.accountCta)).toHaveCount(0); // no reopen button while it is open

  // Focus moved into the dialog when it opened, and it is announced as a modal.
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  // Tapping the dimmed background does nothing.
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();

});

test('Escape closes it, a visible "Create my account" button reopens it', async ({ page }) => {
  await toModal(page);
  const dialog = page.getByRole('dialog', { name: t.accountTitle });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const reopen = button(page, t.accountCta);
  await expect(reopen).toBeVisible();
  await reopen.click();
  await expect(dialog).toBeVisible();
  await expect(button(page, t.accountCta)).toHaveCount(0);
});

test('bottom sheet on phones, a centred dialog of at most 420 px from 600 px', async ({ page }) => {
  await toModal(page);
  const box = (await page.getByRole('dialog', { name: t.accountTitle }).boundingBox())!;
  const { width, height } = SIZES[project()];
  if (project() === 'phone') {
    expect(box.y + box.height, 'phone: sheet sits on the bottom edge').toBeGreaterThanOrEqual(height - 2);
    expect(box.width, 'phone: full width').toBeGreaterThanOrEqual(width - 2);
  } else {
    expect(box.width, `${project()}: capped`).toBeLessThanOrEqual(420);
    expect(Math.abs(box.x + box.width / 2 - width / 2), `${project()}: centred`).toBeLessThan(4);
    expect(box.y + box.height, `${project()}: not on the bottom edge`).toBeLessThan(height - 20);
  }
});

test('signing up in the modal keeps the answers and moves on; the funnel events are recorded', async ({ page }) => {
  const backend = await toModal(page);
  await signUpWithPassword(page);
  // Signed in: the answers (not re-entered) are saved and the plan is generated.
  await expect.poll(() => backend.functionCalls.filter((f) => f === 'generate-plan').length).toBe(2);
  await expect(page).toHaveURL(/\/preview/);

  const events = backend.writesTo('/track-event').map((w) => w.body as { name: string; props: Record<string, unknown> });
  expect(events.filter((e) => e.name === 'account_modal_view')).toHaveLength(1);
  expect(events.find((e) => e.name === 'signin_method_chosen')?.props).toEqual({ method: 'password' });
  // No email or password in any analytics event.
  expect(JSON.stringify(events)).not.toMatch(/example\.test|e2e-password/);
});

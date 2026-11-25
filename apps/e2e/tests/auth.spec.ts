import { expect, test, type Page } from '@playwright/test';
import { authCopy } from '../../mobile/src/auth/copy';
import { en } from '../../mobile/src/copy/en';
import { FAKE_EMAIL_CODE } from '../support/fake-backend';
import { button, seedPlan, shown, start } from '../support/app';

// Account creation and log-in against the fake backend: it stands in for Supabase Auth and records the "emails" it
// would send (the role Mailpit plays against a local Supabase). Synthetic addresses and passwords only.

const EMAIL = 'new-user@example.test';
const PASSWORD = 'correct horse battery';

const fill = async (page: Page, email: string, password?: string) => {
  await page.getByLabel(authCopy.emailLabel, { exact: true }).fill(email);
  if (password !== undefined) await page.getByLabel(authCopy.passwordLabel, { exact: true }).fill(password);
};
const signedIn = (page: Page) => expect(page.getByRole('tab', { name: en.home.tabs.settings, exact: true })).toBeVisible();
const logOut = async (page: Page) => {
  await page.getByRole('tab', { name: en.home.tabs.settings, exact: true }).click();
  await button(page, authCopy.signOut).click();
};

test('create account → confirm email → log in → log out', async ({ page }) => {
  const backend = await start(page);
  seedPlan(backend);
  backend.auth.confirmEmails = true;

  await page.goto('/sign-in');
  await fill(page, EMAIL, PASSWORD);
  await button(page, authCopy.createAccount).click();

  // "Check your inbox", the email was sent, and Resend waits 60 s.
  await expect(shown(page, authCopy.confirmTitle)).toBeVisible();
  expect(backend.auth.mailbox.filter((m) => m.kind === 'confirm' && m.to === EMAIL)).toHaveLength(1);
  await expect(page.getByRole('button', { name: /^Resend email in \d+ s$/ })).toBeDisabled();

  // Logging in before confirming says so and offers the email again.
  await button(page, authCopy.backToLogIn).click();
  await fill(page, EMAIL, PASSWORD);
  await button(page, authCopy.logIn).click();
  await expect(shown(page, authCopy.errors.emailNotConfirmed)).toBeVisible();
  await expect(button(page, authCopy.resend)).toBeVisible();

  // Open the link from the email: the callback route signs you in and opens the app.
  const link = backend.auth.mailbox.find((m) => m.kind === 'confirm')!;
  await page.goto(`/auth?code=${link.code}`);
  await signedIn(page);

  // Log out returns to the landing page.
  await logOut(page);
  await expect(shown(page, en.landing.hero)).toBeVisible();

  // Log in again with the password.
  await button(page, en.landing.signIn).click();
  await fill(page, EMAIL, PASSWORD);
  await button(page, authCopy.logIn).click();
  await signedIn(page);
});

test('log in shows specific errors: wrong password, existing account, short password', async ({ page }) => {
  const backend = await start(page);
  backend.auth.accounts.set(EMAIL, { password: PASSWORD, confirmed: true });

  await page.goto('/sign-in?mode=login');
  await button(page, en.tracking.reject).click(); // the cookie banner sits over the bottom of a phone screen
  await fill(page, EMAIL, 'not the password');
  await button(page, authCopy.logIn).click();
  await expect(shown(page, authCopy.errors.invalidCredentials)).toBeVisible();

  // Creating an account for an address that has one: say so and switch to Log in.
  await page.getByRole('tab', { name: authCopy.modes.signUp, exact: true }).click();
  await fill(page, EMAIL, PASSWORD);
  await button(page, authCopy.createAccount).click();
  await expect(shown(page, authCopy.errors.alreadyRegistered)).toBeVisible();
  await button(page, authCopy.modes.logIn).click();
  await expect(page.getByRole('tab', { name: authCopy.modes.logIn, exact: true })).toHaveAttribute('aria-selected', 'true');

  // A short password is refused before anything is sent.
  await page.getByRole('tab', { name: authCopy.modes.signUp, exact: true }).click();
  await fill(page, 'other@example.test', 'short');
  await button(page, authCopy.createAccount).click();
  await expect(shown(page, authCopy.shortPassword)).toBeVisible();
  expect(backend.auth.accounts.has('other@example.test')).toBe(false);
});

test('email me a sign-in code: wrong code, then the right one', async ({ page }) => {
  const backend = await start(page);
  seedPlan(backend);
  await page.goto('/sign-in?mode=login');
  await button(page, authCopy.codeOption).click();
  await fill(page, EMAIL);
  await button(page, authCopy.codeSend).click();
  await expect(shown(page, authCopy.codeSent(EMAIL))).toBeVisible();
  expect(backend.auth.mailbox.at(-1)).toMatchObject({ kind: 'code', to: EMAIL });

  await page.getByLabel(authCopy.codeLabel, { exact: true }).fill('000000');
  await button(page, authCopy.codeSubmit).click();
  await expect(shown(page, authCopy.errors.invalidCode)).toBeVisible();

  await page.getByLabel(authCopy.codeLabel, { exact: true }).fill(FAKE_EMAIL_CODE);
  await button(page, authCopy.codeSubmit).click();
  await signedIn(page);
});

test('forgot password: email the link, set a new password, log in with it', async ({ page }) => {
  const backend = await start(page);
  seedPlan(backend);
  backend.auth.accounts.set(EMAIL, { password: PASSWORD, confirmed: true });

  await page.goto('/sign-in?mode=login');
  await button(page, authCopy.forgotPassword).click();
  await fill(page, EMAIL);
  await button(page, authCopy.resetSend).click();
  await expect(shown(page, authCopy.resetSent)).toBeVisible();
  const mail = backend.auth.mailbox.find((m) => m.kind === 'reset' && m.to === EMAIL);
  expect(mail).toBeTruthy();

  await page.goto(`/reset-password?code=${mail!.code}`);
  await expect(shown(page, authCopy.newPasswordTitle)).toBeVisible();
  await page.getByLabel(authCopy.newPasswordLabel, { exact: true }).fill('short');
  await button(page, authCopy.newPasswordSave).click();
  await expect(shown(page, authCopy.shortPassword)).toBeVisible();
  await page.getByLabel(authCopy.newPasswordLabel, { exact: true }).fill('a brand new password');
  await button(page, authCopy.newPasswordSave).click();
  await signedIn(page);
  expect(backend.auth.accounts.get(EMAIL)!.password).toBe('a brand new password');
});

test('a link that failed shows a plain message and a way back', async ({ page }) => {
  await start(page);
  await page.goto('/auth#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(shown(page, authCopy.errors.linkExpired)).toBeVisible();
  await button(page, authCopy.modes.logIn).click();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('Google and Apple stay hidden until the owner switches them on', async ({ page }) => {
  await start(page);
  await page.goto('/sign-in');
  await expect(button(page, authCopy.createAccount)).toBeVisible();
  await expect(page.getByText(authCopy.google)).toHaveCount(0);
  await expect(page.getByText(authCopy.apple)).toHaveCount(0);
});

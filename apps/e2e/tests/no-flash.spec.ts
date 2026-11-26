import { expect, test, type Page } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { palettes } from '../../mobile/src/theme/tokens';
import { button, shown, signedInWithPlan, start } from '../support/app';
import { ownViewports } from '../support/projects';

// E-67: moving between pages must never reveal a colour other than the theme background (no white flash in the dark
// theme, no black flash in the light one). While each transition runs, frames are captured about every 50 ms for 600 ms
// and each is checked for near-white (dark) or near-black (light) pixels. Text is light on dark (and dark on light), so a
// small share is normal: a flash covers most of the screen, and the limit is 5%.
ownViewports();

const WINDOW_MS = 600;
const EVERY_MS = 50;
const MAX_SHARE = 0.05;
const o = en.onboarding;

const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;

interface Share {
  white: number;
  black: number;
}

/** The share of near-white (luminance above 0.9) and near-black (below 0.1) pixels in a screenshot, decoded in a spare page. */
async function shareOf(decoder: Page, shot: Buffer): Promise<Share> {
  return decoder.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    const w = Math.max(1, Math.round(img.width / 4));
    const h = Math.max(1, Math.round(img.height / 4));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let white = 0;
    let black = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      if (l > 0.9) white++;
      else if (l < 0.1) black++;
    }
    return { white: white / (w * h), black: black / (w * h) };
  }, shot.toString('base64'));
}

/** Frames of the next `WINDOW_MS`, about every `EVERY_MS`. */
async function sample(page: Page, decoder: Page): Promise<Share[]> {
  const frames: Share[] = [];
  const started = Date.now();
  while (Date.now() - started < WINDOW_MS) {
    frames.push(await shareOf(decoder, await page.screenshot({ type: 'jpeg', quality: 60 })));
    await page.waitForTimeout(EVERY_MS);
  }
  return frames;
}

function expectNoFlash(frames: Share[], scheme: 'dark' | 'light', what: string) {
  expect(frames.length, `${what}: frames captured`).toBeGreaterThanOrEqual(3);
  const worst = Math.max(...frames.map((f) => (scheme === 'dark' ? f.white : f.black)));
  expect(worst, `${what}: the largest share of ${scheme === 'dark' ? 'near-white' : 'near-black'} pixels in a frame`).toBeLessThanOrEqual(MAX_SHARE);
}

/** The computed background of the page, the body and the app's root element. */
const backgrounds = (page: Page) =>
  page.evaluate(() => {
    const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : 'missing');
    return { html: bg(document.documentElement), body: bg(document.body), root: bg(document.getElementById('root')) };
  });

async function expectThemeBackgrounds(page: Page, scheme: 'dark' | 'light') {
  const want = rgb(palettes[scheme].background);
  await expect.poll(() => backgrounds(page)).toEqual({ html: want, body: want, root: want });
}

const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;
const COMBOS = [
  { scheme: 'dark', motion: 'reduce', size: 'desktop' },
  { scheme: 'dark', motion: 'no-preference', size: 'desktop' },
  { scheme: 'dark', motion: 'no-preference', size: 'phone' },
  { scheme: 'light', motion: 'reduce', size: 'desktop' },
  { scheme: 'light', motion: 'no-preference', size: 'desktop' },
] as const;

for (const { scheme, motion, size } of COMBOS) {
  test.describe(`${scheme} theme, motion ${motion === 'reduce' ? 'reduced' : 'on'}, ${size}`, () => {
    test.use({ colorScheme: scheme, reducedMotion: motion, viewport: SIZES[size] });

    test('signed out: landing → onboarding → sign-in never flashes', async ({ page, context }) => {
      const decoder = await context.newPage();
      await start(page, { fixedTime: false });
      // The first paint: the page's own background is the theme's before React has rendered anything.
      await page.goto('/', { waitUntil: 'commit' });
      expectNoFlash(await sample(page, decoder), scheme, 'the first load');
      await expect(shown(page, en.landing.hero)).toBeVisible();
      await expectThemeBackgrounds(page, scheme);
      await button(page, en.tracking.reject).click();

      await button(page, en.landing.cta).click();
      expectNoFlash(await sample(page, decoder), scheme, 'landing → onboarding');
      await expect(button(page, o.steps.welcome.cta)).toBeVisible();

      await button(page, o.steps.welcome.cta).click();
      expectNoFlash(await sample(page, decoder), scheme, 'onboarding → first step');
      await expect(page).toHaveURL(/\/onboarding\/goal/);

      await page.goto('/sign-in?mode=login', { waitUntil: 'commit' });
      expectNoFlash(await sample(page, decoder), scheme, 'reload on sign-in');
      await expectThemeBackgrounds(page, scheme);
    });

    test('signed in: Today → Plan → Progress → recipe → back never flashes', async ({ page, context }) => {
      const decoder = await context.newPage();
      await signedInWithPlan(page, { fixedTime: false });
      await expect(shown(page, en.home.title)).toBeVisible();
      await expectThemeBackgrounds(page, scheme);
      const tab = (name: string) => page.getByRole('tab', { name, exact: true }).filter({ visible: true }).first();

      await tab(en.home.tabs.plan).click();
      expectNoFlash(await sample(page, decoder), scheme, 'Today → Plan');
      await tab(en.home.tabs.progress).click();
      expectNoFlash(await sample(page, decoder), scheme, 'Plan → Progress');
      await tab(en.home.tabs.nutrition).click();
      expectNoFlash(await sample(page, decoder), scheme, 'Progress → Nutrition');

      // Today stays mounted behind the tabs and has a Breakfast row too: the Nutrition screen's rows are the later ones.
      await page.getByRole('button', { name: /Breakfast/ }).filter({ visible: true }).last().click();
      expectNoFlash(await sample(page, decoder), scheme, 'Nutrition → recipe');
      await expect(page).toHaveURL(/\/recipe\//);
      await button(page, en.common.close).click();
      expectNoFlash(await sample(page, decoder), scheme, 'recipe → back');
      await expectThemeBackgrounds(page, scheme);
    });
  });
}

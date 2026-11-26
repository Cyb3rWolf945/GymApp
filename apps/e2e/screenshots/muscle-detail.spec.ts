import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { en } from '../../mobile/src/copy/en';
import { signedInWithPlan } from '../support/app';

// Key shots for the muscle detail sheet (E-75): a trained muscle (top and scrolled) and an untrained one.
const DIR = process.env.SHOTS_DIR ?? '/tmp/shots';

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  mkdirSync(join(DIR, project), { recursive: true });
  await page.screenshot({ path: join(DIR, project, `${name}.jpg`), type: 'jpeg', quality: 82 });
}

async function open(page: Page, muscle: string) {
  const shape = page.getByLabel(new RegExp(`^${muscle}, `)).filter({ visible: true }).first();
  await shape.scrollIntoViewIfNeeded();
  await shape.click();
  await page.getByRole('dialog', { name: muscle }).waitFor();
  await page.getByTestId('train-next').first().waitFor();
  await page.waitForTimeout(900);
}

test('muscle detail sheet', async ({ page }) => {
  const backend = await signedInWithPlan(page, { fixedTime: false });
  backend.state.history = new Date();
  await page.goto('/progress');
  await page.getByText(en.home.progress.weightTitle, { exact: true }).filter({ visible: true }).first().waitFor();

  await open(page, 'Quadriceps');
  await shot(page, 'sheet-top');
  // Scroll the sheet's own scroll area to the end.
  await page.getByRole('dialog', { name: 'Quadriceps' }).evaluate((el) => {
    for (const node of Array.from(el.querySelectorAll<HTMLElement>('*'))) if (node.scrollHeight > node.clientHeight + 20 && getComputedStyle(node).overflowY !== 'visible') node.scrollTop = node.scrollHeight;
  });
  await page.waitForTimeout(400);
  await shot(page, 'sheet-bottom');
  await page.getByRole('button', { name: en.common.close, exact: true }).first().click({ position: { x: 4, y: 4 } });
  await page.getByRole('dialog', { name: 'Quadriceps' }).waitFor({ state: 'hidden' });

  await open(page, 'Rectus abdominis');
  await shot(page, 'sheet-empty');
});

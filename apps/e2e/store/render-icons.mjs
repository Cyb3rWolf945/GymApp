// Renders the SVG sources in apps/mobile/assets/src to the PNGs Expo and the stores need.
//   pnpm --filter e2e icons        (set CHROMIUM_PATH to use an installed Chromium)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const assets = join(dirname(fileURLToPath(import.meta.url)), '../../mobile/assets');
const jobs = [
  // [source, output, size, transparent background]
  ['icon.svg', 'icon.png', 1024, false],
  ['adaptive-icon.svg', 'adaptive-icon.png', 1024, true],
  ['splash.svg', 'splash-icon.png', 1024, true],
  ['icon.svg', 'favicon.png', 48, false],
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [src, out, size, transparent] of jobs) {
  const svg = await readFile(join(assets, 'src', src), 'utf8');
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace(/<svg /, `<svg width="${size}" height="${size}" `)}</div></body></html>`);
  await writeFile(join(assets, out), await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } }));
  await page.close();
  console.log(`wrote assets/${out} (${size}px)`);
}
await browser.close();

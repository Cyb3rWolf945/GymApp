// Writes the web page template for the single-page build: `pnpm tsx scripts/write-web-index.ts`.
// The content comes from apps/mobile/src/theme/html.ts (the same colours as app/+html.tsx); a unit test keeps them equal.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexHtml } from '../apps/mobile/src/theme/html';

const out = join(dirname(fileURLToPath(import.meta.url)), '../apps/mobile/public/index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, indexHtml());
console.log(`wrote ${out}`);

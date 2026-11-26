import { Platform, Share } from 'react-native';
import type { ShareCard } from '@gymapp/shared';
import { fonts, palettes } from '../theme/tokens';

// The share card as an image. Web: drawn on a canvas (no extra library), then handed to the browser's share sheet when it can
// share files, otherwise downloaded as a PNG. Phones: shared as text (an image needs a native view-capture module: follow-up).

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
export const CARD_FILE = 'fuelift-workout.png';

/** Draws the card (always on the dark palette, so it looks the same whatever the app theme is). */
export function drawShareCard(ctx: CanvasRenderingContext2D, card: ShareCard, copy: { brand: string; recordLine: (name: string, e1rm: number) => string; recordsTitle: string }): void {
  const c = palettes.dark;
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  const display = `700 %spx "${fonts.displayBold}", system-ui, sans-serif`;
  const ui = (w: number, px: number) => `${w} ${px}px "${fonts.uiMedium}", system-ui, sans-serif`;
  const font = (px: number) => display.replace('%s', String(px));

  ctx.fillStyle = c.background;
  ctx.fillRect(0, 0, W, H);
  // The glow behind the header: the secondary accent fading into the page.
  const glow = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  glow.addColorStop(0, `${c.accent2}55`);
  glow.addColorStop(1, `${c.background}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H * 0.55);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = c.accent;
  ctx.font = font(44);
  ctx.fillText(copy.brand, 80, 130);

  ctx.fillStyle = c.text;
  ctx.font = font(92);
  const words = card.title.split(' ');
  let line = '';
  let y = 330;
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > W - 160 && line) {
      ctx.fillText(line, 80, y);
      line = w;
      y += 108;
    } else line = next;
  }
  ctx.fillText(line, 80, y);

  // Three big numbers.
  const top = y + 110;
  const colW = (W - 160) / 3;
  card.stats.forEach((s, i) => {
    const x = 80 + i * colW;
    ctx.fillStyle = c.surface;
    roundRect(ctx, x, top, colW - 20, 260, 28);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.font = font(s.value.length > 5 ? 64 : 84);
    ctx.fillText(s.value, x + 28, top + 130);
    ctx.fillStyle = c.muted;
    ctx.font = ui(500, 32);
    ctx.fillText(s.label, x + 28, top + 200);
  });

  if (card.records.length > 0) {
    let ry = top + 400;
    ctx.fillStyle = c.text;
    ctx.font = font(52);
    ctx.fillText(copy.recordsTitle, 80, ry);
    ctx.font = ui(500, 40);
    for (const r of card.records) {
      ry += 80;
      ctx.fillStyle = c.accent;
      ctx.fillText('★', 80, ry);
      ctx.fillStyle = c.text;
      ctx.fillText(copy.recordLine(r.name, r.e1rm), 140, ry);
    }
  }
  ctx.fillStyle = c.muted;
  ctx.font = ui(500, 30);
  ctx.fillText(copy.brand, 80, H - 70);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The card as a PNG (web only); null where there is no canvas. */
export async function renderShareCard(card: ShareCard, copy: Parameters<typeof drawShareCard>[2]): Promise<Blob | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    await document.fonts?.ready;
  } catch {
    // Fonts are a nicety: the fallback face still draws the card.
  }
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawShareCard(ctx, card, copy);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export type ShareOutcome = 'shared' | 'downloaded' | 'text' | 'failed' | 'cancelled';

/** Shares the card: the image through the browser's share sheet or as a download on the web, text on phones. */
export async function shareSummary(card: ShareCard, copy: Parameters<typeof drawShareCard>[2], text: string): Promise<ShareOutcome> {
  if (Platform.OS !== 'web') {
    try {
      const r = await Share.share({ message: text });
      return r.action === Share.dismissedAction ? 'cancelled' : 'text';
    } catch {
      return 'failed';
    }
  }
  const blob = await renderShareCard(card, copy);
  if (!blob) return 'failed';
  const file = new File([blob], CARD_FILE, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return 'cancelled';
      // Fall through to the download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = CARD_FILE;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

// The post-workout card people can share as an image: what goes on it, decided here so it can be tested. The drawing is in the app.

export interface ShareCardInput {
  /** "Upper body" (the day name), or null. */
  title: string | null;
  /** Whole workout stats. */
  sets: number;
  minutes: number;
  volumeKg: number;
  /** New personal records, any order. */
  prs: readonly { name: string; e1rm: number; previous: number }[];
}

export interface ShareCard {
  title: string;
  /** Label/value pairs shown as big numbers. */
  stats: { label: string; value: string }[];
  /** At most 3, the biggest gains first. */
  records: { name: string; e1rm: number; gain: number }[];
}

/** Largest number of records on the card. */
export const MAX_CARD_RECORDS = 3;
const MAX_NAME = 34;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/** The kg lifted, grouped: 12840 -> "12,840". */
export const groupThousands = (n: number): string => whole(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Decides what the card shows. Labels come from the caller (the copy file). */
export function buildShareCard(input: ShareCardInput, labels: { sets: string; minutes: string; volume: string; fallbackTitle: string }): ShareCard {
  const records = [...input.prs]
    .map((p) => ({ name: clip(p.name, MAX_NAME), e1rm: Math.round(p.e1rm * 10) / 10, gain: Math.round((p.e1rm - p.previous) * 10) / 10 }))
    .filter((p) => p.e1rm > 0)
    .sort((a, b) => b.gain - a.gain || a.name.localeCompare(b.name))
    .slice(0, MAX_CARD_RECORDS);
  return {
    title: clip(input.title?.trim() || labels.fallbackTitle, MAX_NAME + 6),
    stats: [
      { label: labels.sets, value: String(whole(input.sets)) },
      { label: labels.minutes, value: String(whole(input.minutes)) },
      { label: labels.volume, value: groupThousands(input.volumeKg) },
    ],
    records,
  };
}

/** The same card as plain text, for sharing where an image cannot be (phones without a capture module, apps that only take text). */
export function shareCardText(card: ShareCard, recordLine: (name: string, e1rm: number) => string, footer: string): string {
  const stats = card.stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(' · ');
  return [card.title, stats, ...card.records.map((r) => recordLine(r.name, r.e1rm)), footer].join('\n');
}

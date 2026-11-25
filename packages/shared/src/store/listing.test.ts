import { describe, expect, it } from 'vitest';
import { LISTING, TARGET_KEYWORDS, listingFields } from './listing.ts';

describe('store listing', () => {
  it('keeps every field inside the store limits', () => {
    for (const f of listingFields()) expect(f.text.length, `${f.store}.${f.field} is ${f.text.length} of ${f.limit}`).toBeLessThanOrEqual(f.limit);
  });

  it('uses the target search terms in the keywords, with no spaces after commas and no duplicates', () => {
    const keywords = LISTING.apple.keywords.split(',');
    for (const k of TARGET_KEYWORDS) expect(keywords, k).toContain(k);
    expect(LISTING.apple.keywords).not.toMatch(/,\s|\s,/);
    expect(new Set(keywords.map((k) => k.toLowerCase())).size).toBe(keywords.length);
  });

  it("does not waste keyword space on words already in the name or subtitle (Apple indexes those)", () => {
    const indexed = new Set(`${LISTING.apple.name} ${LISTING.apple.subtitle}`.toLowerCase().match(/[a-z]+/g));
    const single = LISTING.apple.keywords.split(',').filter((k) => !k.includes(' '));
    expect(single.filter((k) => indexed.has(k.toLowerCase()))).toEqual([]);
  });

  it('makes no medical claims or guarantees, and carries the disclaimer', () => {
    const all = listingFields().map((f) => f.text).join('\n').toLowerCase();
    for (const banned of ['guarantee', 'cure', 'treat ', 'clinically', 'doctor-approved', 'lose \\d+ ?(kg|lb|pounds)', 'no excuses', 'guilt', 'cheat meal']) {
      expect(all, banned).not.toMatch(new RegExp(banned));
    }
    expect(LISTING.apple.description).toContain("isn't medical advice");
    expect(LISTING.google.fullDescription).toContain("isn't medical advice");
  });

  it('follows the glossary: "workout" and "plan", never "session", "routine" or "program"', () => {
    const all = listingFields().map((f) => f.text).join('\n').toLowerCase();
    for (const bad of ['session', 'routine', 'program']) expect(all, bad).not.toMatch(new RegExp(`\\b${bad}\\b`));
  });

  it('names the app the same on both stores', () => {
    expect(LISTING.google.title).toBe(LISTING.apple.name);
  });
});

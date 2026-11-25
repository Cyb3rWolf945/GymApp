import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, getCopy, glossary, locales } from './index';
import { en } from './en';

/** Every plain string in the copy tree, with its key path. Function entries are called with sample args. */
function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') return [[path, (node as (...a: unknown[]) => string)(1, 4, 1000)]].map(([p, v]) => [p as string, String(v)] as [string, string]);
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}
const all = strings(en);

describe('copy', () => {
  it('has copy for the main screens', () => {
    for (const k of ['common', 'auth', 'onboarding', 'home', 'workout', 'nutrition', 'health', 'paywall', 'toasts', 'errors']) {
      expect(en).toHaveProperty(k);
    }
  });
  it('uses the glossary: "workout", never "session" or "routine"', () => {
    for (const [path, text] of all) {
      for (const bad of glossary.workout.avoid) expect(text.toLowerCase(), path).not.toMatch(new RegExp(`\\b${bad}\\b`));
    }
  });
  it('has no guilt or shame words', () => {
    const banned = /cheat meal|burn off|guilt-free|no excuses|lazy|fail(ed|ure)?\b/i;
    for (const [path, text] of all) expect(text, path).not.toMatch(banned);
  });
  it('buttons are sentence case, short and never OK/Submit', () => {
    const buttons = Object.entries({
      ...en.common, ...en.home, ...en.workout, ...en.paywall,
    }).filter(([k, v]) => typeof v === 'string' && /cta$|^(cancel|save|continue|back|skip|done|retry|close|startWorkout|logSet|finish|swap|restore)$/i.test(k)) as [string, string][];
    expect(buttons.length).toBeGreaterThan(8);
    for (const [k, text] of buttons) {
      expect(text.split(/\s+/).length, k).toBeLessThanOrEqual(4);
      expect(text, k).toMatch(/^[A-Z][^A-Z]*$|^[A-Z][a-z]+( [a-z]+)*$/);
      expect(text, k).not.toMatch(/^(ok|submit|yes|no|click)\b/i);
    }
  });
  it('errors say what happened and what to do', () => {
    for (const [path, text] of strings(en.errors)) {
      expect(text.split(/(?<=[.!?])\s+/).length, path).toBeGreaterThanOrEqual(2);
      expect(text, path).toMatch(/try again|check/i);
      expect(text, path).not.toMatch(/\byou (failed|forgot|did)\b/i);
    }
  });
  it('writes at most one emoji per string', () => {
    for (const [path, text] of all) expect((text.match(/\p{Extended_Pictographic}/gu) ?? []).length, path).toBeLessThanOrEqual(1);
  });
  it('is i18n-ready: locales share a shape and unknown tags fall back to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(Object.keys(locales)).toEqual(['en']);
    expect(getCopy('en-GB')).toBe(en);
    expect(getCopy('pt-PT')).toBe(en);
    expect(getCopy()).toBe(en);
  });

  describe('coach styles (E-55)', () => {
    const styles = ['calm', 'direct', 'hype'] as const;
    const sets = { greeting: en.coach.greeting, summaryTitle: en.coach.summaryTitle, prCheer: en.coach.prCheer };
    it('every style has at least two variants of each encouragement line', () => {
      for (const [name, set] of Object.entries(sets)) for (const st of styles) expect(set[st].length, `${name}.${st}`).toBeGreaterThanOrEqual(2);
    });
    it('every style has a label and a one-line example', () => {
      for (const st of styles) {
        expect(en.coach.styles[st].label).toMatch(/^[A-Z][a-z]+$/);
        expect(en.coach.styles[st].example.split('\n')).toHaveLength(1);
      }
    });
    it('Direct stays short and plain; Hype keeps to one exclamation mark per sentence', () => {
      for (const set of Object.values(sets)) for (const line of set.direct) expect(line, line).not.toContain('!');
      for (const set of Object.values(sets)) for (const line of set.hype) for (const sentence of line.split(/(?<=[.!?])\s+/)) expect((sentence.match(/!/g) ?? []).length, sentence).toBeLessThanOrEqual(1);
    });
    it('all style copy is 2nd person at most, with no guilt, shame or medical claims', () => {
      const text = [...Object.values(sets).flatMap((s) => styles.flatMap((st) => s[st])), ...styles.map((st) => en.coach.styles[st].example)].join('\n');
      expect(text).not.toMatch(/\b(lazy|fail\w*|shame\w*|guilt\w*|disappoint\w*|excuses?|cure[sd]?|treat(s|ment)?|diagnos\w+|heal\w*)\b/i);
    });
  });
});

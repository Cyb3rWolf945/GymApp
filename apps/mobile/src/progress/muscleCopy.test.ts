import { describe, expect, it } from 'vitest';
import { MUSCLE_IDS, muscleLabel } from '@gymapp/shared';
import { en } from '../copy/en';

const p = en.home.progress;

describe('muscle detail copy (E-75)', () => {
  it('describes every muscle in the catalog, and nothing else', () => {
    expect(Object.keys(p.muscles).sort()).toEqual([...MUSCLE_IDS].sort());
  });
  it.each([...MUSCLE_IDS])('%s: a plain name and one or two short sentences, no medical claims', (id) => {
    const { plain, about } = p.muscles[id];
    expect(plain.length).toBeGreaterThan(8);
    expect(plain).not.toMatch(/[.!?]$/); // a phrase that follows "Name:"
    expect(about.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
    expect(about.length).toBeLessThanOrEqual(120);
    expect(about).toMatch(/[.]$/);
    // The sheet reads "Name: plain. About" so the whole thing must stay short.
    expect(`${muscleLabel(id)}: ${plain}. ${about}`.length).toBeLessThanOrEqual(230);
    expect(`${plain} ${about}`).not.toMatch(/\b(injur|pain|treat|cure|heal|rehab|therap|diagnos|prevent|medical|symptom|disease|condition)/i);
    expect(`${plain} ${about}`).not.toMatch(/\bsession\b/i);
  });
  it('has a name for each of the five heat levels, in the order of the map legend', () => {
    expect(p.heatNames).toHaveLength(5);
    expect(new Set(p.heatNames).size).toBe(5);
  });
  it('states the growth guideline as general, not as advice', () => {
    expect(p.detail.guideline).toMatch(/general/i);
    expect(p.detail.guideline).toMatch(/10 to 20/);
  });
  it('status wording is guidance, never medical', () => {
    for (const k of ['fresh', 'ready', 'recovering']) {
      expect(p.detail.statusNames[k]).toBeTruthy();
      expect(p.detail.statusHints[k]).not.toMatch(/injur|pain|medical|doctor/i);
    }
    expect(p.detail.statusNote).toMatch(/general/i);
  });
});

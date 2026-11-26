import { describe, expect, it } from 'vitest';
import { MUSCLE_IDS } from '../catalog/catalog.ts';
import { type BodyVariant, DEEP_MUSCLE_REGION, MAP_HEIGHT, MAP_WIDTH, bodyDetails, bodyOutline, bodyRegions, regionSets, unmappedMuscles } from './index.ts';

const VARIANTS: BodyVariant[] = ['male', 'female', 'neutral'];

describe('body map', () => {
  it('every muscle in the catalog has a region on the front or the back, or a rule that heats a visible one', () => {
    expect(unmappedMuscles()).toEqual([]);
    const drawn = new Set([...bodyRegions('front'), ...bodyRegions('back')].map((r) => r.muscle));
    for (const [deep, targets] of Object.entries(DEEP_MUSCLE_REGION)) {
      expect(MUSCLE_IDS as readonly string[]).toContain(deep);
      expect(targets!.length).toBeGreaterThan(0);
      for (const t of targets!) expect(drawn.has(t), `${deep} -> ${t}`).toBe(true);
    }
  });
  it('the rules for deep muscles: the core, the chest', () => {
    expect(DEEP_MUSCLE_REGION.transversus_abdominis).toEqual(['rectus_abdominis', 'obliques']);
    const sets = (m: string) => (m === 'transversus_abdominis' ? 6 : m === 'rectus_abdominis' ? 2 : 0);
    expect(regionSets('rectus_abdominis', sets as never)).toBe(6);
    expect(regionSets('obliques', sets as never)).toBe(6);
    expect(regionSets('quadriceps', sets as never)).toBe(0);
  });
  it('only draws real muscles, once per view, with curves and no straight-line polygons', () => {
    for (const view of ['front', 'back'] as const) {
      const regions = bodyRegions(view);
      const ids = regions.map((r) => r.muscle);
      expect(new Set(ids).size).toBe(ids.length);
      for (const r of regions) {
        expect(MUSCLE_IDS as readonly string[]).toContain(r.muscle);
        expect(r.d).toContain('C');
        expect(r.d).not.toMatch(/ L /);
      }
    }
    for (const d of bodyOutline()) {
      expect(d).toContain('C');
      expect(d).not.toMatch(/ L /);
    }
  });
  it('keeps every shape inside the box, for each body', () => {
    for (const variant of VARIANTS) {
      const all = [...bodyOutline(variant), ...bodyRegions('front', variant).map((r) => r.d), ...bodyRegions('back', variant).map((r) => r.d), ...bodyDetails('front', variant), ...bodyDetails('back', variant)];
      for (const d of all) {
        const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
        for (let i = 0; i < nums.length; i += 2) {
          expect(nums[i], `${variant} x`).toBeGreaterThanOrEqual(-1);
          expect(nums[i], `${variant} x`).toBeLessThanOrEqual(MAP_WIDTH + 1);
          expect(nums[i + 1], `${variant} y`).toBeGreaterThanOrEqual(-1);
          expect(nums[i + 1], `${variant} y`).toBeLessThanOrEqual(MAP_HEIGHT + 1);
        }
      }
    }
  });
  it('the same muscles on all three bodies, with different shapes', () => {
    const ids = (v: BodyVariant) => bodyRegions('front', v).map((r) => r.muscle);
    expect(ids('female')).toEqual(ids('male'));
    expect(ids('neutral')).toEqual(ids('male'));
    expect(bodyOutline('female')).not.toEqual(bodyOutline('male'));
    expect(bodyOutline('neutral')).not.toEqual(bodyOutline('female'));
  });
  it('stays under the path budget per view', () => {
    for (const view of ['front', 'back'] as const) {
      // Regions are drawn twice (the shape and its tap area) next to the outline and the thin lines.
      const paths = bodyOutline().length + bodyRegions(view).length * 2 + bodyDetails(view).length;
      expect(paths).toBeLessThan(120);
    }
  });
  it('draws the regions top to bottom', () => {
    for (const view of ['front', 'back'] as const) {
      const ys = bodyRegions(view).map((r) => r.y);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
  });
});

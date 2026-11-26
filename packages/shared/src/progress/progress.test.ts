import { describe, expect, it } from 'vitest';
import { MUSCLE_IDS } from '../catalog/catalog.ts';
import { areaPath, scaleBars, scaleSeries, recentVolumes, toPath } from './chart.ts';
import { type SetRecord, e1rmTrend, personalRecords, trendLifts } from './lifts.ts';
import { HEAT_FULL_SETS, MAP_HEIGHT, MAP_REGIONS, MAP_WIDTH, UNMAPPED, type MuscleSet, ellipsePath, heat, muscleLabel, muscleStats, regionShapes } from './muscles.ts';
import { parseWeightKg, trendChange, weightTrend } from './weight.ts';

describe('parseWeightKg', () => {
  it('accepts dot and comma decimals and rounds to 1 decimal', () => {
    expect(parseWeightKg('80')).toBe(80);
    expect(parseWeightKg(' 80,54 ')).toBe(80.5);
    expect(parseWeightKg('72.25')).toBe(72.3);
  });
  it('rejects junk and values that are not a body weight', () => {
    for (const bad of ['', 'abc', '19.9', '401', '-70', '8 0', 'NaN', 'Infinity']) expect(parseWeightKg(bad), bad).toBeNull();
  });
});

describe('weightTrend', () => {
  it('averages the readings in the 7 calendar days ending on each date', () => {
    const t = weightTrend([
      { date: '2026-12-03', kg: 82 }, { date: '2026-12-01', kg: 80 }, { date: '2026-12-02', kg: 81 }, { date: '2026-12-10', kg: 78 },
    ]);
    expect(t.map((p) => [p.date, p.avg])).toEqual([['2026-12-01', 80], ['2026-12-02', 80.5], ['2026-12-03', 81], ['2026-12-10', 78]]);
  });
  it('drops readings older than the window (day 7 back is out)', () => {
    const t = weightTrend([{ date: '2026-12-01', kg: 90 }, { date: '2026-12-08', kg: 80 }]);
    expect(t[1].avg).toBe(80);
    const inside = weightTrend([{ date: '2026-12-02', kg: 90 }, { date: '2026-12-08', kg: 80 }]);
    expect(inside[1].avg).toBe(85);
  });
  it('handles no data and computes the change of the average', () => {
    expect(weightTrend([])).toEqual([]);
    expect(trendChange(weightTrend([{ date: '2026-12-01', kg: 80 }]))).toBeNull();
    expect(trendChange(weightTrend([{ date: '2026-11-01', kg: 82 }, { date: '2026-12-01', kg: 80 }]))).toBe(-2);
  });
});

const set = (slug: string, weightKg: number, reps: number, loggedAt: string, name = slug): SetRecord => ({ slug, name, weightKg, reps, loggedAt });

describe('personalRecords', () => {
  it('keeps the best e1RM per exercise with its set, highest first', () => {
    const prs = personalRecords([
      set('bench', 100, 5, '2026-11-01T10:00:00Z', 'Bench'), // 116.7
      set('bench', 110, 3, '2026-11-20T10:00:00Z', 'Bench'), // 121
      set('squat', 140, 1, '2026-11-10T10:00:00Z', 'Squat'), // 140
      set('curl', 0, 10, '2026-11-10T10:00:00Z', 'Curl'), // bodyweight / no weight: ignored
    ]);
    expect(prs.map((p) => [p.slug, p.e1rm, p.weightKg, p.reps, p.date])).toEqual([
      ['squat', 140, 140, 1, '2026-11-10'],
      ['bench', 121, 110, 3, '2026-11-20'],
    ]);
  });
  it('gives a tie to the earlier set', () => {
    const prs = personalRecords([set('b', 100, 1, '2026-11-20T10:00:00Z'), set('b', 100, 1, '2026-11-01T10:00:00Z')]);
    expect(prs[0].date).toBe('2026-11-01');
  });
});

describe('e1rmTrend and trendLifts', () => {
  const sets = [
    set('bench', 100, 5, '2026-11-02T09:00:00Z'), set('bench', 80, 10, '2026-11-02T09:10:00Z'), // best of the day: 106.7 vs 100 -> 116.7
    set('bench', 105, 5, '2026-11-09T09:00:00Z'),
    set('squat', 120, 5, '2026-11-09T09:30:00Z'),
  ];
  it('takes the best set of each day, oldest first, for one exercise', () => {
    expect(e1rmTrend(sets, 'bench')).toEqual([{ date: '2026-11-02', e1rm: 116.7 }, { date: '2026-11-09', e1rm: 122.5 }]);
    expect(e1rmTrend(sets, 'row')).toEqual([]);
  });
  it('offers the logged main lifts first, then the most logged others, up to the limit', () => {
    const lots = [...sets, ...Array.from({ length: 5 }, (_, i) => set('lunge', 20, 10, `2026-11-0${i + 1}T09:00:00Z`)), set('barbell-back-squat', 100, 5, '2026-11-01T09:00:00Z')];
    expect(trendLifts(lots, 3).map((l) => l.slug)).toEqual(['barbell-back-squat', 'lunge', 'bench']);
    expect(trendLifts([])).toEqual([]);
  });
});

describe('muscleStats', () => {
  const now = new Date('2026-12-10T12:00:00Z');
  const ms = (slug: string, loggedAt: string, muscles: MuscleSet['muscles']): MuscleSet => ({ slug, name: slug, loggedAt, muscles });
  const bench = [{ muscle: 'pectoralis_major', role: 'primary' as const }, { muscle: 'triceps_brachii', role: 'secondary' as const }];

  it('counts primary as 1 set and secondary as half, over the last 7 days only', () => {
    const stats = muscleStats(
      [ms('bench', '2026-12-09T10:00:00Z', bench), ms('bench', '2026-12-08T10:00:00Z', bench), ms('bench', '2026-11-20T10:00:00Z', bench)],
      now,
    );
    expect(stats.get('pectoralis_major')!.sets).toBe(2);
    expect(stats.get('triceps_brachii')!.sets).toBe(1);
    expect(stats.get('quadriceps')!.sets).toBe(0);
  });
  it('reports the last time a muscle was trained even outside the window, and ignores future sets', () => {
    const stats = muscleStats([ms('bench', '2026-11-20T10:00:00Z', bench), ms('bench', '2026-12-20T10:00:00Z', bench)], now);
    expect(stats.get('pectoralis_major')).toMatchObject({ sets: 0, lastTrained: '2026-11-20' });
    expect(stats.get('quadriceps')!.lastTrained).toBeNull();
  });
  it('lists the top exercises by contribution and ignores unknown muscle ids', () => {
    const row = [{ muscle: 'latissimus_dorsi', role: 'primary' as const }, { muscle: 'not_a_muscle', role: 'primary' as const }];
    const stats = muscleStats(
      [ms('row', '2026-12-09T10:00:00Z', row), ms('row', '2026-12-09T10:05:00Z', row), ms('pulldown', '2026-12-09T10:10:00Z', row)],
      now,
    );
    expect(stats.get('latissimus_dorsi')!.topExercises).toEqual([{ slug: 'row', name: 'row', sets: 2 }, { slug: 'pulldown', name: 'pulldown', sets: 1 }]);
    expect(stats.size).toBe(MUSCLE_IDS.length);
  });
  it('turns ids into labels', () => {
    expect(muscleLabel('latissimus_dorsi')).toBe('Latissimus dorsi');
    expect(muscleLabel('quadriceps')).toBe('Quadriceps');
  });
  it('maps weekly sets to heat between 0 and 1', () => {
    expect(heat(0)).toBe(0);
    expect(heat(HEAT_FULL_SETS / 2)).toBe(0.5);
    expect(heat(HEAT_FULL_SETS * 3)).toBe(1);
    expect(heat(-1)).toBe(0);
  });
});

describe('muscle map geometry', () => {
  it('only uses real muscle ids and keeps every shape inside the box', () => {
    for (const regions of Object.values(MAP_REGIONS)) {
      for (const r of regions) {
        expect(MUSCLE_IDS as readonly string[]).toContain(r.muscle);
        for (const s of regionShapes(r)) {
          expect(s.cx - s.rx, r.muscle).toBeGreaterThanOrEqual(0);
          expect(s.cx + s.rx, r.muscle).toBeLessThanOrEqual(MAP_WIDTH);
          expect(s.cy - s.ry, r.muscle).toBeGreaterThanOrEqual(0);
          expect(s.cy + s.ry, r.muscle).toBeLessThanOrEqual(MAP_HEIGHT);
        }
      }
    }
  });
  it('mirrors paired muscles and draws centred ones once', () => {
    const [pec] = MAP_REGIONS.front.filter((r) => r.muscle === 'pectoralis_major');
    expect(regionShapes(pec).map((s) => s.cx)).toEqual([47, MAP_WIDTH - 47]);
    const abs = MAP_REGIONS.front.find((r) => r.muscle === 'rectus_abdominis')!;
    expect(regionShapes(abs)).toHaveLength(1);
  });
  it('lists the muscles the map cannot show instead of dropping them silently', () => {
    expect([...UNMAPPED]).toEqual(['pectoralis_minor', 'transversus_abdominis']);
    for (const id of UNMAPPED) expect(Object.values(MAP_REGIONS).flat().some((r) => r.muscle === id)).toBe(false);
  });
  it('builds a closed ellipse path', () => {
    expect(ellipsePath({ cx: 10, cy: 20, rx: 4, ry: 6 })).toBe('M 6 20 a 4 6 0 1 0 8 0 a 4 6 0 1 0 -8 0 Z');
  });
});

describe('scaleSeries', () => {
  it('spreads x evenly and flips y so higher values are higher on screen', () => {
    const pts = scaleSeries([10, 20, 30], 100, 50, 5);
    expect(pts.map((p) => p.x)).toEqual([0, 50, 100]);
    expect(pts[0].y).toBe(45);
    expect(pts[2].y).toBe(5);
  });
  it('puts several series on one y-scale while each spreads over the full width', () => {
    const range = { min: 0, max: 100 };
    const line = scaleSeries([0, 100], 100, 50, 5, range);
    const dots = scaleSeries([50, 50, 50], 100, 50, 5, range);
    expect(line.map((p) => p.x)).toEqual([0, 100]);
    expect(dots.map((p) => p.x)).toEqual([0, 50, 100]);
    expect(dots.map((p) => p.y)).toEqual([25, 25, 25]); // 50 is the middle of 0..100 on the shared scale
  });
  it('centres flat and single-point series and handles empty input', () => {
    expect(scaleSeries([7, 7], 100, 50).map((p) => p.y)).toEqual([25, 25]);
    expect(scaleSeries([7], 100, 50)).toEqual([{ x: 50, y: 25 }]);
    expect(scaleSeries([], 100, 50)).toEqual([]);
    expect(toPath([{ x: 0, y: 1 }, { x: 2, y: 3.14159 }])).toBe('M 0.0 1.0 L 2.0 3.1');
  });
});

describe('areaPath, scaleBars and recentVolumes', () => {
  it('closes a line down to the bottom edge', () => {
    const pts = scaleSeries([10, 20, 30], 100, 50, 5);
    const d = areaPath(pts, 50);
    expect(d.startsWith(toPath(pts))).toBe(true);
    expect(d.endsWith('L 100.0 50 L 0.0 50 Z')).toBe(true);
    expect(areaPath([], 50)).toBe('');
  });
  it('makes bars in proportion, from the bottom, filling the width', () => {
    const bars = scaleBars([50, 100, 25], 100, 60, 10, 0);
    expect(bars).toHaveLength(3);
    expect(bars[1].height).toBeCloseTo(60);
    expect(bars[0].height).toBeCloseTo(30);
    expect(bars[2].height).toBeCloseTo(15);
    expect(bars.every((b) => b.y + b.height === 60)).toBe(true);
    const last = bars[2];
    expect(last.x + last.width).toBeCloseTo(100);
  });
  it('keeps a tiny value visible, and draws nothing for zero, empty or all-zero data', () => {
    const bars = scaleBars([1000, 1], 100, 60, 6, 0, 3);
    expect(bars[1].height).toBe(3);
    expect(scaleBars([0, 0], 100, 60).every((b) => b.height === 0)).toBe(true);
    expect(scaleBars([], 100, 60)).toEqual([]);
  });
  it('takes the last volumes in time order and skips empty workouts', () => {
    const rows = [{ volume: 5 }, { volume: 0 }, { volume: 4 }, { volume: 3 }, { volume: 2 }, { volume: 1 }];
    expect(recentVolumes(rows, 3)).toEqual([3, 4, 5]);
    expect(recentVolumes(rows, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(recentVolumes([])).toEqual([]);
  });
});

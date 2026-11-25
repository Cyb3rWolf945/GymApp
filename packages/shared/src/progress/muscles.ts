import { MUSCLE_IDS, type MuscleId } from '../catalog/catalog.ts';

// Muscle map: weekly effective sets per muscle (heatmap) and the detail shown when a muscle is tapped.

export const PRIMARY_WEIGHT = 1;
export const SECONDARY_WEIGHT = 0.5;
/** Sets per week that count as "fully trained" for the heatmap (10 is the usual weekly volume target). */
export const HEAT_FULL_SETS = 10;
export const WINDOW_DAYS = 7;

export interface MuscleSet {
  slug: string;
  name: string;
  /** ISO timestamp. */
  loggedAt: string;
  /** Muscles the exercise works (catalog `exercise_muscles`). */
  muscles: { muscle: string; role: 'primary' | 'secondary' }[];
}

export interface MuscleStat {
  muscle: MuscleId;
  /** Effective sets in the window: primary 1, secondary 0.5 (1 decimal). */
  sets: number;
  /** Date of the most recent set that worked it (any time, YYYY-MM-DD), or null. */
  lastTrained: string | null;
  /** Exercises that contributed most in the window, by effective sets. */
  topExercises: { slug: string; name: string; sets: number }[];
}

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const isMuscle = (m: string): m is MuscleId => (MUSCLE_IDS as readonly string[]).includes(m);

/** Per muscle stats. `sets` and `topExercises` use the last 7 days; `lastTrained` looks at everything passed in. */
export function muscleStats(sets: readonly MuscleSet[], now = new Date(), windowDays = WINDOW_DAYS): Map<MuscleId, MuscleStat> {
  const since = now.getTime() - windowDays * DAY;
  const acc = new Map<MuscleId, { sets: number; last: string | null; byExercise: Map<string, { name: string; sets: number }> }>();
  for (const s of sets) {
    const at = Date.parse(s.loggedAt);
    if (!Number.isFinite(at) || at > now.getTime()) continue;
    for (const m of s.muscles) {
      if (!isMuscle(m.muscle)) continue;
      const a = acc.get(m.muscle) ?? { sets: 0, last: null, byExercise: new Map() };
      if (!a.last || s.loggedAt > a.last) a.last = s.loggedAt;
      if (at > since) {
        const w = m.role === 'primary' ? PRIMARY_WEIGHT : SECONDARY_WEIGHT;
        a.sets += w;
        const ex = a.byExercise.get(s.slug) ?? { name: s.name, sets: 0 };
        ex.sets += w;
        a.byExercise.set(s.slug, ex);
      }
      acc.set(m.muscle, a);
    }
  }
  const out = new Map<MuscleId, MuscleStat>();
  for (const id of MUSCLE_IDS) {
    const a = acc.get(id);
    out.set(id, {
      muscle: id,
      sets: round1(a?.sets ?? 0),
      lastTrained: a?.last ? a.last.slice(0, 10) : null,
      topExercises: [...(a?.byExercise.entries() ?? [])]
        .map(([slug, e]) => ({ slug, name: e.name, sets: round1(e.sets) }))
        .sort((x, y) => y.sets - x.sets || x.name.localeCompare(y.name))
        .slice(0, 3),
    });
  }
  return out;
}

/** 0 (not trained this week) to 1 (at or above the weekly target): the heatmap intensity. */
export const heat = (sets: number): number => Math.max(0, Math.min(1, sets / HEAT_FULL_SETS));

// ---- Map geometry. A stylised figure in a 120 x 260 box; regions are ellipses, mirrored left/right unless centred.

export const MAP_WIDTH = 120;
export const MAP_HEIGHT = 260;
export type MapView = 'front' | 'back';

export interface Region {
  muscle: MuscleId;
  /** Ellipse centre and radii of the left-hand region (viewer's left). */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** One shape in the middle instead of a mirrored pair. */
  center?: boolean;
}

export const MAP_REGIONS: Record<MapView, Region[]> = {
  front: [
    { muscle: 'neck_flexors', cx: 60, cy: 38, rx: 5, ry: 6, center: true },
    { muscle: 'trapezius', cx: 49, cy: 44, rx: 8, ry: 4 },
    { muscle: 'deltoid_anterior', cx: 32, cy: 56, rx: 7, ry: 9 },
    { muscle: 'deltoid_lateral', cx: 24, cy: 58, rx: 4, ry: 8 },
    { muscle: 'pectoralis_major', cx: 47, cy: 62, rx: 13, ry: 9 },
    { muscle: 'serratus_anterior', cx: 38, cy: 80, rx: 4, ry: 8 },
    { muscle: 'biceps_brachii', cx: 24, cy: 80, rx: 5, ry: 13 },
    { muscle: 'brachialis', cx: 21, cy: 94, rx: 3, ry: 6 },
    { muscle: 'forearm_flexors', cx: 18, cy: 116, rx: 5, ry: 15 },
    { muscle: 'rectus_abdominis', cx: 60, cy: 98, rx: 8, ry: 22, center: true },
    { muscle: 'obliques', cx: 44, cy: 100, rx: 6, ry: 17 },
    { muscle: 'hip_flexors', cx: 49, cy: 132, rx: 6, ry: 7 },
    { muscle: 'hip_adductors', cx: 54, cy: 160, rx: 5, ry: 16 },
    { muscle: 'quadriceps', cx: 42, cy: 172, rx: 10, ry: 28 },
    { muscle: 'tibialis_anterior', cx: 40, cy: 226, rx: 5, ry: 17 },
  ],
  back: [
    { muscle: 'trapezius', cx: 60, cy: 52, rx: 14, ry: 12, center: true },
    { muscle: 'deltoid_posterior', cx: 32, cy: 57, rx: 7, ry: 9 },
    { muscle: 'rhomboids', cx: 51, cy: 68, rx: 7, ry: 8 },
    { muscle: 'latissimus_dorsi', cx: 44, cy: 88, rx: 10, ry: 16 },
    { muscle: 'triceps_brachii', cx: 23, cy: 82, rx: 5, ry: 14 },
    { muscle: 'forearm_extensors', cx: 18, cy: 116, rx: 5, ry: 15 },
    { muscle: 'erector_spinae', cx: 55, cy: 110, rx: 4, ry: 17 },
    { muscle: 'gluteus_medius', cx: 40, cy: 130, rx: 7, ry: 6 },
    { muscle: 'gluteus_maximus', cx: 48, cy: 146, rx: 11, ry: 10 },
    { muscle: 'hamstrings', cx: 43, cy: 182, rx: 10, ry: 24 },
    { muscle: 'gastrocnemius', cx: 41, cy: 224, rx: 7, ry: 15 },
    { muscle: 'soleus', cx: 41, cy: 244, rx: 5, ry: 8 },
  ],
};

/** Muscles with no region on the map (deep or hidden). Their numbers still exist; the map just can't show them. */
export const UNMAPPED: readonly MuscleId[] = MUSCLE_IDS.filter((id) => !Object.values(MAP_REGIONS).some((rs) => rs.some((r) => r.muscle === id)));

/** The shapes to draw for a region: the left one, plus its mirror image unless centred. */
export function regionShapes(r: Region): { cx: number; cy: number; rx: number; ry: number }[] {
  return r.center ? [{ cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry }] : [{ cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry }, { cx: MAP_WIDTH - r.cx, cy: r.cy, rx: r.rx, ry: r.ry }];
}

/** SVG path for an ellipse, so the map needs only <Path>. */
export const ellipsePath = (s: { cx: number; cy: number; rx: number; ry: number }): string =>
  `M ${s.cx - s.rx} ${s.cy} a ${s.rx} ${s.ry} 0 1 0 ${2 * s.rx} 0 a ${s.rx} ${s.ry} 0 1 0 ${-2 * s.rx} 0 Z`;

/** "latissimus_dorsi" -> "Latissimus dorsi". */
export const muscleLabel = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');

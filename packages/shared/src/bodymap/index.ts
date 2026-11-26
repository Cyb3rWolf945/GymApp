import { MUSCLE_IDS, type MuscleId } from '../catalog/catalog.ts';
import { type Pt, mirrorPt, smoothClosed, smoothOpen } from './geometry.ts';
import { BACK_DETAILS, BACK_MUSCLES, FRONT_DETAILS, FRONT_MUSCLES, type MuscleShape, SILHOUETTE, type Shape } from './shapes.ts';

export { smoothClosed, smoothOpen } from './geometry.ts';

export const MAP_WIDTH = 120;
/** 264, not 260: the feet need room below the ankles, and the figure stays fully inside the box. */
export const MAP_HEIGHT = 264;
export type MapView = 'front' | 'back';
/** Which body is drawn: from the profile's `sex`, or a neutral one when it is unknown. Same muscles on all three. */
export type BodyVariant = 'male' | 'female' | 'neutral';

/** Horizontal scale around the midline by height: shoulders, waist and hips differ between the variants. */
const FEMALE_SCALE: readonly Pt[] = [[0, 1], [40, 0.9], [60, 0.9], [100, 0.88], [130, 1.06], [160, 1.1], [200, 1.04], [260, 1]];
const WEIGHT: Record<BodyVariant, number> = { male: 0, female: 1, neutral: 0.5 };

function scaleAt(y: number, variant: BodyVariant): number {
  const w = WEIGHT[variant];
  if (w === 0) return 1;
  let k = 1;
  for (let i = 0; i < FEMALE_SCALE.length - 1; i++) {
    const [y0, k0] = FEMALE_SCALE[i];
    const [y1, k1] = FEMALE_SCALE[i + 1];
    if (y >= y0 && y <= y1) k = k0 + ((k1 - k0) * (y - y0)) / (y1 - y0);
  }
  return 1 + (k - 1) * w;
}

const shape = (pts: readonly Pt[], variant: BodyVariant): Pt[] => pts.map(([x, y]) => [60 + (x - 60) * scaleAt(y, variant), y] as Pt);

/** The path of a shape: both sides in one path (a pair, or the left half joined to its mirror image). */
function partsOf(s: Shape, variant: BodyVariant): string[] {
  const left = shape(s.pts, variant);
  if (s.center) {
    // Left half from the top to the bottom of the midline, then back up along the mirrored right half.
    const right = left.slice(1, -1).reverse().map((p) => mirrorPt(p, MAP_WIDTH));
    return [smoothClosed([...left, ...right])];
  }
  return [smoothClosed(left), smoothClosed(left.map((p) => mirrorPt(p, MAP_WIDTH)))];
}
const pathOf = (s: Shape, variant: BodyVariant): string => partsOf(s, variant).join(' ');

export interface BodyRegion {
  muscle: MuscleId;
  /** SVG path, both sides. */
  d: string;
  /** The same shape as separate closed paths: one on the midline, or the left and right of a pair (tap areas). */
  parts: string[];
  /** Vertical centre, for drawing order and the fill animation (top to bottom). */
  y: number;
}

const MUSCLES: Record<MapView, readonly MuscleShape[]> = { front: FRONT_MUSCLES, back: BACK_MUSCLES };
const DETAILS: Record<MapView, readonly (readonly Pt[])[]> = { front: FRONT_DETAILS, back: BACK_DETAILS };

/** The muscle regions of a view, top to bottom. */
export function bodyRegions(view: MapView, variant: BodyVariant = 'neutral'): BodyRegion[] {
  return MUSCLES[view]
    .map((s) => ({ muscle: s.muscle as MuscleId, d: pathOf(s, variant), parts: partsOf(s, variant), y: s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length }))
    .sort((a, b) => a.y - b.y);
}

/** The body itself (head, torso, arms, legs), as paths. */
export const bodyOutline = (variant: BodyVariant = 'neutral'): string[] => SILHOUETTE.map((s) => pathOf(s, variant));

/** The thin lines inside the figure, as open paths (both sides). */
export function bodyDetails(view: MapView, variant: BodyVariant = 'neutral'): string[] {
  return DETAILS[view].flatMap((pts) => {
    const left = shape(pts, variant);
    const onMidline = left.every(([x]) => Math.abs(x - 60) < 0.01);
    const horizontal = left[0][0] < 60 && left[left.length - 1][0] > 60;
    if (onMidline || horizontal) return [smoothOpen(left)];
    return [smoothOpen(left), smoothOpen(left.map((p) => mirrorPt(p, MAP_WIDTH)))];
  });
}

/**
 * Deep muscles have no region of their own: their sets heat a visible one. The region shows the larger of its own
 * sets and those of the muscles that point at it.
 */
export const DEEP_MUSCLE_REGION: Partial<Record<MuscleId, readonly MuscleId[]>> = {
  transversus_abdominis: ['rectus_abdominis', 'obliques'],
  pectoralis_minor: ['pectoralis_major'],
};

/** Every muscle id in the catalog is either drawn on one of the views or has a rule above. */
export function unmappedMuscles(): MuscleId[] {
  const drawn = new Set<string>([...FRONT_MUSCLES, ...BACK_MUSCLES].map((s) => s.muscle));
  return MUSCLE_IDS.filter((id) => !drawn.has(id) && !DEEP_MUSCLE_REGION[id]);
}

/** Sets shown on a region: its own, or those of a deep muscle that heats it, whichever is larger. */
export function regionSets(region: MuscleId, setsOf: (m: MuscleId) => number): number {
  let best = setsOf(region);
  for (const [deep, targets] of Object.entries(DEEP_MUSCLE_REGION)) if (targets?.includes(region)) best = Math.max(best, setsOf(deep as MuscleId));
  return best;
}

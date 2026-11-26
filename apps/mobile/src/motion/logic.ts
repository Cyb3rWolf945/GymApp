// Pure helpers behind the motion components, so the rules are unit-tested without a renderer.
import { STEP_IDS, type StepId } from '@gymapp/shared';
import { motion } from '../theme/tokens';

export type StepDirection = 'forward' | 'back' | 'none';

/** Which way a step enters: forward (new step slides in from the right) or back (from the left). `null` = first screen shown. */
export function stepDirection(previous: StepId | null, next: StepId): StepDirection {
  if (!previous || previous === next) return 'none';
  return STEP_IDS.indexOf(next) > STEP_IDS.indexOf(previous) ? 'forward' : 'back';
}

/** Horizontal offset (px) a step starts from. Reduced motion: no travel, only a fade. */
export function slideOffset(direction: StepDirection, reduced: boolean): number {
  if (reduced || direction === 'none') return 0;
  return direction === 'forward' ? motion.slide : -motion.slide;
}

/** How long to animate (ms). Components skip animating altogether with reduced motion; this is the fallback if one does not. */
export function durationFor(name: keyof typeof motion.duration, reduced: boolean): number {
  return reduced ? motion.duration.fast : motion.duration[name];
}

/** Delay for the nth item of a staggered entrance (ms). None with reduced motion. */
export function staggerDelay(index: number, reduced: boolean, step: number = motion.stagger): number {
  return reduced ? 0 : Math.max(0, index) * step;
}

/** Light haptics only on a phone, only when the person has not asked for less motion. */
export function hapticsAllowed(platform: string, reduced: boolean): boolean {
  return !reduced && (platform === 'ios' || platform === 'android');
}

/** Moments the app confirms with a small physical tap on a phone. */
export type FeedbackEvent = 'choice' | 'set_logged' | 'pr' | 'plan_ready';
export type Haptic = { kind: 'impact'; weight: 'light' | 'medium' } | { kind: 'notification'; type: 'success' };

/**
 * Which tap goes with which moment: a light one for a choice, a firmer one for a set logged, and the "success" pattern
 * for the two moments worth celebrating (a personal record, the plan being ready). Nothing at all when haptics are not
 * allowed (web, or reduced motion).
 */
export function hapticFor(event: FeedbackEvent, platform: string, reduced: boolean): Haptic | null {
  if (!hapticsAllowed(platform, reduced)) return null;
  switch (event) {
    case 'choice':
      return { kind: 'impact', weight: 'light' };
    case 'set_logged':
      return { kind: 'impact', weight: 'medium' };
    case 'pr':
    case 'plan_ready':
      return { kind: 'notification', type: 'success' };
  }
}

/** How far a pressed thing shrinks: `1` (no change) with reduced motion, otherwise `scale`. */
export const pressScale = (reduced: boolean, scale: number): number => (reduced ? 1 : scale);

/** The number shown while counting up to `to`: eased, whole numbers, never past `to`. */
export function countUpValue(to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - Math.pow(1 - p, 3);
  return Math.min(to, Math.round(to * eased));
}

/**
 * Lets the first tap through and ignores the rest until the next screen is shown (the lock lives as long as the
 * screen does), so a double tap on Continue can't navigate twice.
 */
export function createTapLock() {
  let locked = false;
  return {
    /** True for the first call only. */
    take(): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    get locked() {
      return locked;
    },
  };
}

// ---- E-63: motion across the app. Pure rules, so they are unit-tested; the components only apply them.

/** At most this many items of a list stagger in; the rest appear with the group. */
export const STAGGER_MAX_ITEMS = 8;

/**
 * Remembers which screens were already shown in this session. A screen staggers its content in only on its first visit;
 * later visits rely on the quick cross-fade, so switching tabs never feels slow.
 */
export function createVisitTracker() {
  const seen = new Set<string>();
  return {
    /** True until `mark` is called for this screen. Reading does not change it (several parts of a screen ask at once). */
    isFirst: (screen: string): boolean => !seen.has(screen),
    mark: (screen: string): void => void seen.add(screen),
    reset: (): void => seen.clear(),
  };
}

/** Gap between items of a screen's entrance (ms): tighter than the onboarding stagger, so 8 items plus the fade stay under 400 ms. */
export const SCREEN_STAGGER_MS = 20;

/** Delay for the nth item of a screen's stagger: none after the first visit, with reduced motion, or past the first 8 items. */
export function revealDelay(index: number, firstVisit: boolean, reduced: boolean, step: number = SCREEN_STAGGER_MS): number {
  if (!firstVisit || reduced || index >= STAGGER_MAX_ITEMS) return 0;
  return Math.max(0, index) * step;
}

/** Whether an item animates in at all (the items past the 8th and every item after the first visit just appear). */
export const revealsIn = (index: number, firstVisit: boolean, reduced: boolean): boolean => firstVisit && !reduced && index < STAGGER_MAX_ITEMS;

/** The length of a polyline through points (px). */
export function polylineLength(points: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/**
 * Dash settings that draw a line left to right: at progress 0 nothing shows, at 1 all of it. Reduced motion or no
 * progress info (`undefined`) draws the whole line.
 */
export function drawDash(length: number, progress: number | undefined): { dasharray: string; dashoffset: number } {
  const p = progress === undefined ? 1 : Math.min(1, Math.max(0, progress));
  const len = Math.max(0, length);
  return { dasharray: `${len} ${len}`, dashoffset: len * (1 - p) };
}

/** The line draws during the first 75% of the animation; the points appear in the last 25%. */
export const LINE_DRAW_SHARE = 0.75;
export const lineProgress = (t: number): number => Math.min(1, Math.max(0, t / LINE_DRAW_SHARE));
export const pointsOpacity = (t: number): number => Math.min(1, Math.max(0, (t - LINE_DRAW_SHARE) / (1 - LINE_DRAW_SHARE)));

/** One muscle's fill between its old and new intensity (0 to 1). */
export function blendIntensity(from: number, to: number, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - Math.pow(1 - p, 3);
  return from + (to - from) * eased;
}

/**
 * Progress of the nth region (0 = top) when all regions fill within `totalMs`: each starts a little later than the one above
 * and takes `fillMs`. `t` is the overall progress, 0 to 1.
 */
export function regionProgress(t: number, index: number, count: number, totalMs = 500, fillMs = 250): number {
  if (count <= 1) return Math.min(1, Math.max(0, t));
  const startMs = (index / (count - 1)) * Math.max(0, totalMs - fillMs);
  return Math.min(1, Math.max(0, (t * totalMs - startMs) / fillMs));
}

/** Remembers which celebrations were shown (a new PR pops once, never again on re-render or re-visit). */
export function createCelebrationLedger() {
  const shown = new Set<string>();
  return {
    /** True the first time for this id, false afterwards. */
    once(id: string): boolean {
      if (shown.has(id)) return false;
      shown.add(id);
      return true;
    },
    reset: (): void => shown.clear(),
  };
}

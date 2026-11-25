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

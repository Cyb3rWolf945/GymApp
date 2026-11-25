// Pure helpers behind the components, so they can be unit-tested without a renderer.

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Snap a value to the nearest step inside [min, max]. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  if (!(step > 0) || !(max > min)) return min;
  const snapped = min + Math.round((value - min) / step) * step;
  return clamp(Number(snapped.toFixed(6)), min, max);
}

/** Pointer x inside the track → slider value. */
export function valueFromPosition(x: number, trackWidth: number, min: number, max: number, step: number): number {
  if (trackWidth <= 0) return min;
  return snapToStep(min + (clamp(x, 0, trackWidth) / trackWidth) * (max - min), min, max, step);
}

/** Slider value → 0..1 fraction of the track. */
export function fractionOf(value: number, min: number, max: number): number {
  return max > min ? clamp((value - min) / (max - min), 0, 1) : 0;
}

/** Onboarding progress: step is 1-based. */
export function progressFraction(step: number, total: number): number {
  return total > 0 ? clamp(step / total, 0, 1) : 0;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}
export const MAX_TOASTS = 3;

/** Newest last; keeps at most MAX_TOASTS. */
export function pushToast(list: ToastItem[], item: ToastItem): ToastItem[] {
  return [...list, item].slice(-MAX_TOASTS);
}
export const dismissToast = (list: ToastItem[], id: number): ToastItem[] => list.filter((t) => t.id !== id);

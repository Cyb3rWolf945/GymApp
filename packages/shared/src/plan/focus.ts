/** The kind of session a training day is, read from its name ("Push A", "Lower body", "Full body"). Drives the hero art only. */
export const WORKOUT_FOCUSES = ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'core', 'other'] as const;
export type WorkoutFocus = (typeof WORKOUT_FOCUSES)[number];

const RULES: readonly [WorkoutFocus, RegExp][] = [
  ['full', /\bfull[\s-]?body\b|\btotal[\s-]?body\b/i],
  ['upper', /\bupper\b/i],
  ['lower', /\blower\b/i],
  ['push', /\bpush\b|\bchest\b|\bpress\b|\bshoulders?\b|\btriceps?\b/i],
  ['pull', /\bpull\b|\bback\b|\bbiceps?\b|\brows?\b/i],
  ['legs', /\blegs?\b|\bquads?\b|\bglutes?\b|\bhamstrings?\b|\bsquat\b/i],
  ['core', /\bcore\b|\babs?\b/i],
];

/** Which kind of day this is. Anything unrecognised is `other` (a generic hero), never an error. */
export function workoutFocus(dayName: string): WorkoutFocus {
  for (const [focus, re] of RULES) if (re.test(dayName)) return focus;
  return 'other';
}

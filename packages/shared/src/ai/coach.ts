// E-55: coach style. It changes the TONE of what the app and the models write, never the training or nutrition content.

export const COACH_STYLES = ['calm', 'direct', 'hype'] as const;
export type CoachStyle = (typeof COACH_STYLES)[number];
export const DEFAULT_COACH_STYLE: CoachStyle = 'calm';

export const isCoachStyle = (v: unknown): v is CoachStyle => typeof v === 'string' && (COACH_STYLES as readonly string[]).includes(v);

/** Anything unknown (null, an old row, a bad value) is the default style. */
export const parseCoachStyle = (v: unknown): CoachStyle => (isCoachStyle(v) ? v : DEFAULT_COACH_STYLE);

/**
 * Tone instructions for the models. Fixed text (never user data), so it is safe in the prompt.
 * Every style: 2nd person, no guilt or shame, no medical claims, and the content rules still win.
 */
export const COACH_STYLE_PROMPTS: Record<CoachStyle, string> = {
  calm: 'Calm: gentle and explanatory. Short sentences that say why. Reassuring, never pushy.',
  direct: 'Direct: short and to the point. One idea per sentence, no filler, no exclamation marks.',
  hype: 'Hype: energetic and upbeat. Celebrate effort, at most one exclamation mark per sentence.',
};

/** The rule added to system prompts that write text for the user. The style never overrides content or safety rules. */
export const COACH_STYLE_RULE =
  '- If <coach_style> is present, use it for the tone of the text you write only. It never changes exercises, sets, reps, calories, meals, allergens, injuries or any rule above, and it never excuses guilt, shame or medical claims.';

/** The `<coach_style>` block for a user message: the style name and its fixed tone line. */
export const coachStyleBlock = (style: unknown): string => {
  const s = parseCoachStyle(style);
  return `<coach_style>${s}: ${COACH_STYLE_PROMPTS[s]}</coach_style>`;
};

/** A line from a per-style list of variants. Same seed, same line (stable within a day or a workout); falls back to Calm, then to ''. */
export function pickLine(lines: Partial<Record<CoachStyle, readonly string[]>>, style: unknown, seed = 0): string {
  const list = lines[parseCoachStyle(style)]?.length ? lines[parseCoachStyle(style)]! : (lines[DEFAULT_COACH_STYLE] ?? []);
  return list.length === 0 ? '' : list[Math.abs(Math.trunc(seed)) % list.length];
}

/** A small stable number from a string (a date key, a workout id) to seed `pickLine`. */
export function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

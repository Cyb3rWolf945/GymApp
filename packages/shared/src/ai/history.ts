import { z } from 'zod';
import { escapeTags } from './prompts.ts';

// The SQL summary (public.user_history) turned into a compact text block for the planner.
// It goes inside <user_history> tags, as data. It only holds numbers, catalog names and cleared facts.

const Named = z.object({ name: z.string(), times: z.number() });

export const UserHistorySchema = z.object({
  days: z.number().default(28),
  workouts_done: z.number().default(0),
  workouts_planned: z.number().default(0),
  weight_first_kg: z.number().nullable().default(null),
  weight_last_kg: z.number().nullable().default(null),
  e1rm: z.array(z.object({ name: z.string(), first: z.number(), last: z.number() })).default([]),
  swapped_exercises: z.array(Named).default([]),
  swapped_meals: z.array(Named).default([]),
  checkins: z
    .array(
      z.object({
        week: z.string(),
        weight_kg: z.number().nullable().default(null),
        energy: z.number(),
        sleep: z.number(),
        done: z.number().default(0),
        planned: z.number().default(0),
        note: z.string().nullable().default(null),
      }),
    )
    .default([]),
  facts: z.array(z.string()).default([]),
});
export type UserHistory = z.infer<typeof UserHistorySchema>;

const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Number(n.toFixed(digits)))}`;
const num = (n: number) => String(Number(n.toFixed(1)));

/** Adherence as a whole percentage, or null when nothing was planned. */
export function adherencePct(h: Pick<UserHistory, 'workouts_done' | 'workouts_planned'>): number | null {
  return h.workouts_planned > 0 ? Math.min(100, Math.round((h.workouts_done / h.workouts_planned) * 100)) : null;
}

/** Compact lines, one per signal; empty string when there is no history at all. */
export function formatUserHistory(raw: unknown): string {
  const parsed = UserHistorySchema.safeParse(raw);
  if (!parsed.success) return '';
  const h = parsed.data;
  const weeks = Math.max(1, Math.round(h.days / 7));
  const lines: string[] = [];

  const pct = adherencePct(h);
  if (h.workouts_done > 0 || h.workouts_planned > 0) {
    lines.push(`Last ${weeks} weeks: ${h.workouts_done} of ${h.workouts_planned} planned workouts${pct === null ? '' : ` (${pct}%)`}.`);
  }
  if (h.weight_first_kg !== null && h.weight_last_kg !== null) {
    const d = h.weight_last_kg - h.weight_first_kg;
    lines.push(`Weight: ${num(h.weight_first_kg)} kg → ${num(h.weight_last_kg)} kg (${signed(d)} kg).`);
  }
  if (h.e1rm.length > 0) {
    lines.push(`Estimated 1RM trend: ${h.e1rm.map((e) => `${e.name} ${num(e.first)} → ${num(e.last)} kg (${signed(e.last - e.first)})`).join('; ')}.`);
  }
  const swaps = [...h.swapped_exercises, ...h.swapped_meals];
  if (swaps.length > 0) lines.push(`Swapped out: ${swaps.map((s) => `${s.name} ×${s.times}`).join(', ')}.`);
  if (h.checkins.length > 0) {
    // Newest first, at most 4. The note was cleared by the guardrails before it was stored.
    lines.push(
      `Weekly check-ins (newest first):\n${h.checkins
        .slice(0, 4)
        .map(
          (c) =>
            `- Week of ${c.week}: energy ${c.energy}/5, sleep ${c.sleep}/5, ${c.done} of ${c.planned} workouts` +
            `${c.weight_kg === null ? '' : `, ${num(c.weight_kg)} kg`}${c.note ? `, note: "${c.note.replace(/\s+/g, ' ').trim()}"` : ''}.`,
        )
        .join('\n')}`,
    );
  }
  if (h.facts.length > 0) lines.push(`Known about the user:\n${h.facts.map((f) => `- ${f}`).join('\n')}`);
  return escapeTags(lines.join('\n'));
}

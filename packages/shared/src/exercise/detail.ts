import { MUSCLE_IDS, type MuscleId } from '../catalog/catalog.ts';
import { type SetRecord, type TrendPoint, e1rmTrend } from '../progress/lifts.ts';
import { epley } from '../workout/e1rm.ts';

// Exercise detail screen: steps, muscle roles and "your history", shaped from catalog rows and the user's own sets.

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Numbered steps from the catalog `instructions` text: one step per line, or per sentence when it is a single
 * paragraph. Leading numbering ("1.", "2)", "-", "•") is stripped, because the screen numbers the steps itself.
 */
export function parseSteps(instructions: string | null | undefined): string[] {
  const text = (instructions ?? '').replace(/\r/g, '').trim();
  if (!text) return [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : text.split(/(?<=[.!?])\s+/);
  return parts.map((l) => l.replace(/^(?:\d+\s*[.)]|[-•*])\s*/, '').trim()).filter(Boolean);
}

export interface MuscleRoles {
  primary: MuscleId[];
  secondary: MuscleId[];
}

/** Primary and secondary muscles for the map. Unknown muscle names are dropped; a muscle listed as both counts as primary. */
export function muscleRoles(rows: readonly { muscle: string; role: string }[] | null | undefined): MuscleRoles {
  const known = (m: string): m is MuscleId => (MUSCLE_IDS as readonly string[]).includes(m);
  const primary = new Set<MuscleId>();
  const secondary = new Set<MuscleId>();
  for (const r of rows ?? []) if (known(r.muscle) && r.role === 'primary') primary.add(r.muscle);
  for (const r of rows ?? []) if (known(r.muscle) && r.role !== 'primary' && !primary.has(r.muscle)) secondary.add(r.muscle);
  return { primary: [...primary], secondary: [...secondary] };
}

export interface HistorySession {
  /** YYYY-MM-DD. */
  date: string;
  /** The set with the highest estimated 1RM that day. */
  weightKg: number;
  reps: number;
  e1rm: number;
}

export interface ExerciseHistory {
  /** Last sessions (one per day with a logged set), newest first. */
  sessions: HistorySession[];
  /** Best estimated 1RM ever logged, kg (1 decimal), or null when nothing countable was logged. */
  bestE1rm: number | null;
  /** Best e1RM per day, oldest first (the trend chart). */
  trend: TrendPoint[];
}

export const HISTORY_SESSIONS = 5;

/** Summary of the user's own sets of one exercise. Sets with no weight or reps are ignored; other exercises are skipped. */
export function exerciseHistory(sets: readonly SetRecord[], slug: string, limit = HISTORY_SESSIONS): ExerciseHistory {
  const byDay = new Map<string, HistorySession>();
  for (const s of sets) {
    if (s.slug !== slug) continue;
    const e = epley(s.weightKg, s.reps);
    if (e <= 0) continue;
    const date = s.loggedAt.slice(0, 10);
    const cur = byDay.get(date);
    if (!cur || e > cur.e1rm) byDay.set(date, { date, weightKg: s.weightKg, reps: s.reps, e1rm: e });
  }
  const days = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
  const best = days.reduce((m, d) => Math.max(m, d.e1rm), 0);
  return {
    sessions: days.slice(0, limit).map((d) => ({ ...d, e1rm: round1(d.e1rm) })),
    bestE1rm: best > 0 ? round1(best) : null,
    trend: e1rmTrend(sets, slug),
  };
}

export type MediaKind = 'image' | 'video';

/** What `media_url` points to, by file extension. Only http(s) links count; anything else (or nothing) is no media. */
export function mediaKind(url: string | null | undefined): MediaKind | null {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  const path = u.split(/[?#]/)[0].toLowerCase();
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return 'video';
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(path)) return 'image';
  return null;
}

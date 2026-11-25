export const SUITE_LABELS: Record<string, string> = { red_team: 'Red team', plan_quality: 'Plan quality' };

/** Share of cases that passed (0..1); null for a run with no cases. */
export const evalPassRate = (passed: number, total: number): number | null => (total > 0 ? passed / total : null);

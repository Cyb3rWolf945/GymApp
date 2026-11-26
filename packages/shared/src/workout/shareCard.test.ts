import { describe, expect, it } from 'vitest';
import { MAX_CARD_RECORDS, buildShareCard, groupThousands, shareCardText } from './shareCard';

const labels = { sets: 'Sets', minutes: 'Minutes', volume: 'kg lifted', fallbackTitle: 'Workout done' };
const base = { title: 'Upper body', sets: 14, minutes: 52, volumeKg: 12840, prs: [] as { name: string; e1rm: number; previous: number }[] };

describe('buildShareCard', () => {
  it('shows the day and three big numbers', () => {
    const c = buildShareCard(base, labels);
    expect(c.title).toBe('Upper body');
    expect(c.stats).toEqual([{ label: 'Sets', value: '14' }, { label: 'Minutes', value: '52' }, { label: 'kg lifted', value: '12,840' }]);
    expect(c.records).toEqual([]);
  });
  it('falls back to a plain title and never prints nonsense numbers', () => {
    expect(buildShareCard({ ...base, title: null }, labels).title).toBe('Workout done');
    expect(buildShareCard({ ...base, title: '   ' }, labels).title).toBe('Workout done');
    const c = buildShareCard({ ...base, sets: NaN, minutes: -3, volumeKg: Infinity }, labels);
    expect(c.stats.map((s) => s.value)).toEqual(['0', '0', '0']);
  });
  it('lists at most three records, the biggest gains first', () => {
    const prs = [
      { name: 'Squat', e1rm: 120, previous: 118 },
      { name: 'Bench press', e1rm: 90, previous: 80 },
      { name: 'Deadlift', e1rm: 150, previous: 140 },
      { name: 'Row', e1rm: 70, previous: 60 },
    ];
    const c = buildShareCard({ ...base, prs }, labels);
    expect(c.records).toHaveLength(MAX_CARD_RECORDS);
    expect(c.records.map((r) => r.name)).toEqual(['Bench press', 'Deadlift', 'Row']); // ties on gain by name
    expect(c.records[0]).toEqual({ name: 'Bench press', e1rm: 90, gain: 10 });
  });
  it('keeps long names on the card, and ignores empty records', () => {
    const c = buildShareCard({ ...base, prs: [{ name: 'Incline barbell bench press with a very long name indeed', e1rm: 100.04, previous: 90 }, { name: 'Zero', e1rm: 0, previous: 0 }] }, labels);
    expect(c.records).toHaveLength(1);
    expect(c.records[0].name.length).toBeLessThanOrEqual(34);
    expect(c.records[0].name.endsWith('…')).toBe(true);
    expect(c.records[0].e1rm).toBe(100);
  });
});

describe('groupThousands and the text version', () => {
  it('groups digits', () => {
    expect(groupThousands(0)).toBe('0');
    expect(groupThousands(999)).toBe('999');
    expect(groupThousands(1000)).toBe('1,000');
    expect(groupThousands(1234567.6)).toBe('1,234,568');
    expect(groupThousands(-5)).toBe('0');
  });
  it('says the same in plain text', () => {
    const card = buildShareCard({ ...base, prs: [{ name: 'Squat', e1rm: 120, previous: 110 }] }, labels);
    expect(shareCardText(card, (n, e) => `PR: ${n} ${e} kg`, 'Fuelift')).toBe('Upper body\n14 sets · 52 minutes · 12,840 kg lifted\nPR: Squat 120 kg\nFuelift');
  });
});

import { describe, expect, it, vi } from 'vitest';

// AsyncStorage needs a native/web runtime; the pure parsing is what we test here.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
const { parsePersisted, serialize } = await import('./persist');

describe('persisted onboarding state', () => {
  const good = { version: 1, stepId: 'basics', answers: { goalType: 'cut', sex: 'male', age: 31 } } as const;

  it('round-trips', () => {
    expect(parsePersisted(serialize(good as never))).toMatchObject(good);
  });
  it('returns null for empty, broken or foreign data', () => {
    expect(parsePersisted(null)).toBeNull();
    expect(parsePersisted('not json')).toBeNull();
    expect(parsePersisted(JSON.stringify({ ...good, version: 99 }))).toBeNull();
    expect(parsePersisted(JSON.stringify({ ...good, stepId: 'nope' }))).toBeNull();
  });
  it('drops saved answers that no longer match the schema', () => {
    expect(parsePersisted(JSON.stringify({ ...good, answers: { age: 3 } }))).toBeNull();
    expect(parsePersisted(JSON.stringify({ ...good, answers: { goalType: 'fly' } }))).toBeNull();
  });
});

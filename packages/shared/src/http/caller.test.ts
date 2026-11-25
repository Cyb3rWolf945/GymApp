import { describe, expect, it } from 'vitest';
import { resolveCaller, safeEqual } from './caller.ts';

const KEY = 'service-role-key-secret';
const USER = '00000000-0000-4000-8000-0000000000aa';

describe('resolveCaller', () => {
  it('lets the service-role key act for a user', () => {
    expect(resolveCaller(KEY, KEY, USER)).toEqual({ kind: 'service', userId: USER });
  });
  it('treats every other token as an ordinary user call and ignores a userId in the body', () => {
    expect(resolveCaller('a-user-jwt', KEY, USER)).toEqual({ kind: 'user' });
    expect(resolveCaller(undefined, KEY, USER)).toEqual({ kind: 'user' });
    expect(resolveCaller('', KEY, USER)).toEqual({ kind: 'user' });
    expect(resolveCaller(KEY.slice(0, -1), KEY, USER)).toEqual({ kind: 'user' });
    expect(resolveCaller(KEY + 'x', KEY, USER)).toEqual({ kind: 'user' });
  });
  it('never matches when the server has no key configured (an empty token must not equal an empty key)', () => {
    expect(resolveCaller('', '', USER)).toEqual({ kind: 'user' });
    expect(resolveCaller('x', undefined, USER)).toEqual({ kind: 'user' });
    expect(resolveCaller(undefined, undefined, USER)).toEqual({ kind: 'user' });
  });
  it('needs a real user id when acting as the service', () => {
    for (const bad of [undefined, null, '', 'not-a-uuid', 42, { id: USER }, `${USER}; drop table x`]) {
      expect(resolveCaller(KEY, KEY, bad), String(bad)).toMatchObject({ kind: 'invalid', status: 400 });
    }
  });
});

describe('safeEqual', () => {
  it('compares strings exactly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

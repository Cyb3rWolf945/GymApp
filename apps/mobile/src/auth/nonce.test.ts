import { describe, expect, it } from 'vitest';
import { makeNonce, toHex } from './nonce';

const fake = {
  randomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => i),
  // Not a real hash: it only has to be a function of the input that differs from it.
  sha256Hex: async (s: string) => `hash(${s})`,
};

describe('nonce', () => {
  it('encodes bytes as lowercase hex', () => {
    expect(toHex(Uint8Array.from([0, 15, 16, 255]))).toBe('000f10ff');
  });
  it('gives Apple the hash of the raw nonce, never the raw nonce itself', async () => {
    const n = await makeNonce(fake);
    expect(n.raw).toHaveLength(64);
    expect(n.hashed).toBe(`hash(${n.raw})`);
    expect(n.hashed).not.toBe(n.raw);
  });
  it('asks for fresh randomness each time', async () => {
    let calls = 0;
    const deps = { ...fake, randomBytes: (n: number) => { calls++; return Uint8Array.from({ length: n }, () => calls); } };
    const a = await makeNonce(deps);
    const b = await makeNonce(deps);
    expect(a.raw).not.toBe(b.raw);
  });
});

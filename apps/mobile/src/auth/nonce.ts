// Nonce for native "Sign in with Apple": Apple gets the SHA-256 of a random string, Supabase gets the string itself,
// and Supabase checks that the token Apple signed carries the hash of that string. The crypto is injected so the
// logic is testable; the app passes expo-crypto.
export interface NonceDeps {
  randomBytes: (length: number) => Uint8Array;
  /** Lowercase hex SHA-256 of a UTF-8 string. */
  sha256Hex: (input: string) => Promise<string>;
}

export const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** A fresh nonce: `raw` goes to Supabase, `hashed` goes to Apple. 32 random bytes, so 64 hex characters. */
export async function makeNonce(deps: NonceDeps, bytes = 32): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(deps.randomBytes(bytes));
  return { raw, hashed: await deps.sha256Hex(raw) };
}

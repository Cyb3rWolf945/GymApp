import * as Crypto from 'expo-crypto';
import type { NonceDeps } from './nonce';

/** expo-crypto behind the `NonceDeps` shape. */
export const nativeNonceDeps: NonceDeps = {
  randomBytes: (n) => Crypto.getRandomBytes(n),
  sha256Hex: (s) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s),
};

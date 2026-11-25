// Stripe webhook signature check (`Stripe-Signature: t=...,v1=...`): HMAC-SHA256 of `${t}.${payload}` with the
// endpoint secret, constant-time compare, and a timestamp tolerance against replays. Uses WebCrypto only.

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export async function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  tolerance = SIGNATURE_TOLERANCE_SECONDS,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim().split('=') as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const v1 = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || v1.length === 0) return false;
  if (Math.abs(nowSeconds - ts) > tolerance) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return v1.some((s) => safeEqual(s, expected));
}

/** For tests and local tooling: the header Stripe would send. */
export async function signStripePayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${payload}`)}`;
}

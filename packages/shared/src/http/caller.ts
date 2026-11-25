// Who is calling an Edge Function. Normally a signed-in user (JWT). The admin backoffice calls a few functions on
// behalf of a user (regenerate a plan, delete an account) with the service-role key as bearer token and the target
// `userId` in the body. Only that key, which never leaves the server, can do this: a body `userId` from anyone else
// is ignored.

export type Caller =
  | { kind: 'user' }
  | { kind: 'service'; userId: string }
  | { kind: 'invalid'; status: 400; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function resolveCaller(token: string | undefined | null, serviceKey: string | undefined | null, bodyUserId: unknown): Caller {
  if (!token || !serviceKey || !safeEqual(token, serviceKey)) return { kind: 'user' };
  if (typeof bodyUserId !== 'string' || !UUID.test(bodyUserId)) return { kind: 'invalid', status: 400, message: 'Missing or invalid userId.' };
  return { kind: 'service', userId: bodyUserId };
}

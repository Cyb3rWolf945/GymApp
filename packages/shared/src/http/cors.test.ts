import { describe, expect, it } from 'vitest';
import { corsHeadersFor, parseAllowedOrigins, withCors } from './cors.ts';

const allowed = ['https://app.example.com', 'http://localhost:8081'];

describe('parseAllowedOrigins', () => {
  it('splits a list, trims and drops trailing slashes and empties', () => {
    expect(parseAllowedOrigins(' https://a.com/ , http://localhost:8081,, ')).toEqual(['https://a.com', 'http://localhost:8081']);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
  });
});

describe('corsHeadersFor', () => {
  it('echoes an allowed origin with the headers a preflight needs', () => {
    const h = corsHeadersFor('https://app.example.com', allowed);
    expect(h['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(h['Access-Control-Allow-Headers']).toContain('authorization');
    expect(h['Access-Control-Allow-Headers']).toContain('apikey');
    expect(h['Access-Control-Allow-Methods']).toContain('OPTIONS');
    expect(h.Vary).toBe('Origin');
  });
  it('gives nothing but Vary to unknown or missing origins, never a wildcard', () => {
    for (const origin of ['https://evil.example', null, undefined, '*', 'https://app.example.com.evil.io']) {
      const h = corsHeadersFor(origin, allowed);
      expect(h['Access-Control-Allow-Origin'], String(origin)).toBeUndefined();
      expect(h.Vary).toBe('Origin');
    }
    expect(corsHeadersFor('https://app.example.com', [])['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('withCors', () => {
  const handler = withCors(async () => new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } }), () => allowed);
  const req = (method: string, origin?: string) => new Request('https://fn.example.com/x', { method, headers: origin ? { Origin: origin } : {} });

  it('answers the preflight with 204 and the CORS headers, without running the function', async () => {
    let ran = false;
    const h = withCors(() => { ran = true; return new Response('x'); }, () => allowed);
    const res = await h(req('OPTIONS', 'http://localhost:8081'));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081');
    expect(ran).toBe(false);
  });
  it('adds the headers to normal responses and keeps status, body and other headers', async () => {
    const res = await handler(req('POST', 'https://app.example.com'));
    expect(res.status).toBe(201);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
  });
  it('adds them to error responses too (a 401 must still be readable by the browser)', async () => {
    const h = withCors(() => new Response('no', { status: 401 }), () => allowed);
    const res = await h(req('POST', 'https://app.example.com'));
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
  });
  it('does not grant other origins', async () => {
    const res = await handler(req('POST', 'https://evil.example'));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const pre = await handler(req('OPTIONS', 'https://evil.example'));
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

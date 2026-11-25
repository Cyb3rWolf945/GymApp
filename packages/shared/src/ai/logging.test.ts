import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MODEL_PROFILES } from './models.config.ts';
import { type AiCallLog, callStructured } from './openrouter.ts';
import { aiCallRow, guardrailRow } from './logging.ts';

const schema = z.object({ pass: z.boolean() });
const reply = (content: unknown, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ model: 'm', choices: [{ message: { content: JSON.stringify(content), ...extra } }], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.001 } }), { status: 200 });

const run = async (fetchImpl: typeof fetch, over: Record<string, unknown> = {}) => {
  const logs: AiCallLog[] = [];
  const cfg = { profile: { ...MODEL_PROFILES.dev, escalation: 'big-model' }, apiKey: 'k', log: (l: AiCallLog) => void logs.push(l), fetchImpl };
  await callStructured(cfg, { role: 'qa', schemaName: 's', schema, system: 's', user: 'u', userId: null, ...over }).catch(() => {});
  return logs[0];
};

describe('ai call logging (E-29)', () => {
  it('logs retry number, escalation and the QA result', async () => {
    const log = await run(async () => reply({ pass: false }), { retry: 2, escalate: true, qaResult: (v: { pass: boolean }) => (v.pass ? 'pass' : 'fail') });
    expect(log).toMatchObject({ retry: 2, escalated: true, qaResult: 'fail', refusal: false, status: 'ok' });
    expect((await run(async () => reply({ pass: true }), { qaResult: (v: { pass: boolean }) => (v.pass ? 'pass' : 'fail') })).qaResult).toBe('pass');
  });
  it('defaults to retry 0, not escalated, no QA result', async () => {
    expect(await run(async () => reply({ pass: true }))).toMatchObject({ retry: 0, escalated: false, refusal: false });
  });
  it('logs refusals, including a refusal that fails schema validation', async () => {
    const log = await run(async () => reply('', { refusal: 'I cannot help with that.' }));
    expect(log).toMatchObject({ refusal: true, status: 'invalid_output' });
  });
  it('logs retry and escalation on HTTP errors too', async () => {
    expect(await run(async () => new Response('x', { status: 502 }), { retry: 1 })).toMatchObject({ status: 'http_error', retry: 1, escalated: false });
  });
  it('maps a log to a row without any prompt or output text', () => {
    const row = aiCallRow({ userId: 'u', jobId: 'j', role: 'planner', model: 'm', tokensIn: 1, tokensOut: 2, costUsd: 0.1, latencyMs: 5, status: 'ok', retry: 1, escalated: true, refusal: false, qaResult: 'pass' });
    expect(row).toEqual({ user_id: 'u', job_id: 'j', role: 'planner', model: 'm', tokens_in: 1, tokens_out: 2, cost_usd: 0.1, latency_ms: 5, status: 'ok', qa_result: 'pass', retry: 1, escalated: true, refusal: false });
  });
});

describe('guardrail rows', () => {
  const ev = (action: 'truncated' | 'blocked' | 'dropped' | 'conservative_mode' | 'blocked_unclassified') => ({ field: 'notes' as const, rule: 'injection', action, inputText: 'some user text' });
  it('keeps the text only for the review queue', () => {
    expect(guardrailRow('u', 'j', ev('blocked')).input_text).toBe('some user text');
    expect(guardrailRow('u', 'j', ev('dropped')).input_text).toBe('some user text');
    expect(guardrailRow('u', 'j', ev('blocked_unclassified')).input_text).toBe('some user text');
    expect(guardrailRow('u', 'j', ev('truncated')).input_text).toBeNull();
    expect(guardrailRow('u', 'j', ev('conservative_mode')).input_text).toBeNull();
  });
  it('records field, category (rule) and action', () => {
    expect(guardrailRow('u', null, ev('blocked'))).toMatchObject({ user_id: 'u', job_id: null, field: 'notes', rule: 'injection', action: 'blocked' });
  });
});

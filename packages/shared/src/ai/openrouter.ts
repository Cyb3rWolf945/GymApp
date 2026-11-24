import type { z } from 'zod';
import { type ModelProfile, type ModelRole, modelsForRole } from './models.config.ts';
import { toJsonSchema } from './schemas.ts';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface AiCallLog {
  userId: string | null;
  jobId: string | null;
  role: ModelRole;
  /** Model that actually served the call (may be a fallback); the requested primary on early failure. */
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  latencyMs: number;
  status: 'ok' | 'http_error' | 'invalid_output';
}

export type LogSink = (entry: AiCallLog) => Promise<void> | void;

export interface StructuredCall<T> {
  role: ModelRole;
  schemaName: string;
  schema: z.ZodType<T>;
  /** Stable text first (cache-friendly). */
  system: string;
  user: string;
  userId: string | null;
  jobId?: string | null;
  /** Use the escalation model instead of the role's models. */
  escalate?: boolean;
}

export interface OpenRouterConfig {
  profile: ModelProfile;
  apiKey: string;
  log: LogSink;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class AiCallError extends Error {
  constructor(
    public readonly code: 'HTTP_ERROR' | 'INVALID_OUTPUT' | 'NO_ESCALATION',
    message: string,
  ) {
    super(message);
    this.name = 'AiCallError';
  }
}

/** Stable, non-reversible id for OpenRouter's `user` field. */
export async function hashUserId(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(`fuelift:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildRequestBody<T>(cfg: OpenRouterConfig, call: StructuredCall<T>) {
  const { profile } = cfg;
  let models: string[];
  if (call.escalate) {
    if (!profile.escalation) throw new AiCallError('NO_ESCALATION', 'This profile has no escalation model.');
    models = [profile.escalation];
  } else {
    models = modelsForRole(profile, call.role);
  }
  return {
    model: models[0],
    // OpenRouter tries these in order if the primary fails.
    ...(models.length > 1 ? { models } : {}),
    messages: [
      { role: 'system', content: call.system },
      { role: 'user', content: call.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: call.schemaName, strict: true, schema: toJsonSchema(call.schema) },
    },
    provider: {
      require_parameters: true,
      ...(profile.denyDataCollection ? { data_collection: 'deny' } : {}),
    },
    usage: { include: true },
    ...(call.userId ? { user: await hashUserId(call.userId) } : {}),
  };
}

/** One structured-output call. Logs metadata only (never prompts or content). */
export async function callStructured<T>(cfg: OpenRouterConfig, call: StructuredCall<T>): Promise<T> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const now = cfg.now ?? Date.now;
  const body = await buildRequestBody(cfg, call);
  const started = now();
  const base = { userId: call.userId, jobId: call.jobId ?? null, role: call.role };

  const res = await doFetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const latencyMs = now() - started;

  if (!res.ok) {
    await cfg.log({ ...base, model: body.model, tokensIn: null, tokensOut: null, costUsd: null, latencyMs, status: 'http_error' });
    throw new AiCallError('HTTP_ERROR', `OpenRouter returned ${res.status}.`);
  }

  const json = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };
  const entry: AiCallLog = {
    ...base,
    model: json.model ?? body.model,
    tokensIn: json.usage?.prompt_tokens ?? null,
    tokensOut: json.usage?.completion_tokens ?? null,
    costUsd: json.usage?.cost ?? null,
    latencyMs,
    status: 'ok',
  };

  let parsed: T;
  try {
    parsed = call.schema.parse(JSON.parse(json.choices?.[0]?.message?.content ?? ''));
  } catch {
    await cfg.log({ ...entry, status: 'invalid_output' });
    throw new AiCallError('INVALID_OUTPUT', 'The model output did not match the schema.');
  }
  await cfg.log(entry);
  return parsed;
}

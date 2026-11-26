// The only place model IDs live. Selected by MODEL_PROFILE (dev | prod).
// IDs and prices verified on the OpenRouter Models API (structured_outputs) on 2026-11-24.

export const MODEL_ROLES = ['planner', 'qa', 'light'] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export const MODEL_PROFILE_NAMES = ['dev', 'prod'] as const;
export type ModelProfileName = (typeof MODEL_PROFILE_NAMES)[number];

export interface RoleModels {
  primary: string;
  /** Tried in order by OpenRouter if the primary fails. */
  fallbacks: string[];
}

export interface ModelProfile {
  name: ModelProfileName;
  roles: Record<ModelRole, RoleModels>;
  /** Stronger model used when validation of a cheap model's output keeps failing. null = never escalate. */
  escalation: string | null;
  /** Ask OpenRouter to route only to providers that do not store/train on prompts. */
  denyDataCollection: boolean;
  /** Planner retries after the first failed attempt. Free models take about 30 s a call, so dev retries once. */
  maxRetries: number;
  /** `skip`: the deterministic validator alone decides (free-model QA fails every time and doubles the wall time). */
  qa: 'enforce' | 'skip';
}

const DEV_MODELS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'baidu/ernie-5.5-flash-preview:free',
  'inclusionai/ling-3.2-flash:free',
] as const;

export const MODEL_PROFILES: Record<ModelProfileName, ModelProfile> = {
  // Free endpoints: synthetic data only. No escalation.
  dev: {
    name: 'dev',
    roles: {
      // Live data, last 12 h (ai_call_logs): nemotron timed out (40 s) on 5 of 12 calls, ernie answered 4 of 4 in about 3 s. Fastest first.
      planner: { primary: DEV_MODELS[1], fallbacks: [DEV_MODELS[0], DEV_MODELS[2]] },
      qa: { primary: DEV_MODELS[0], fallbacks: [DEV_MODELS[1], DEV_MODELS[2]] }, // a different family than the planner (QA is skipped on dev)
      light: { primary: DEV_MODELS[2], fallbacks: [DEV_MODELS[1], DEV_MODELS[0]] },
    },
    escalation: null,
    denyDataCollection: false,
    maxRetries: 1,
    qa: 'skip',
  },
  // Paid models: production only.
  prod: {
    name: 'prod',
    roles: {
      planner: { primary: 'deepseek/deepseek-v4.1-flash', fallbacks: ['z-ai/glm-5.3-flash'] },
      qa: { primary: 'z-ai/glm-5.3-flash', fallbacks: ['deepseek/deepseek-v4.1-flash'] },
      light: { primary: 'openai/gpt-6-luna', fallbacks: ['z-ai/glm-5.3-flash'] },
    },
    escalation: 'anthropic/claude-sonnet-5.5',
    denyDataCollection: true,
    maxRetries: 2,
    qa: 'enforce',
  },
};

/** Resolve the profile from MODEL_PROFILE. Unset means dev (the safe default). */
export function getModelProfile(name: string | undefined): ModelProfile {
  const key = (name?.trim() || 'dev') as ModelProfileName;
  const profile = MODEL_PROFILES[key];
  if (!profile) throw new Error(`Unknown MODEL_PROFILE "${name}". Use "dev" or "prod".`);
  return profile;
}

/**
 * The profile for a running function. Same as `getModelProfile`, plus a second lock for the paid models:
 * `prod` only works when `APP_ENV=production` is also set, so copying `MODEL_PROFILE=prod` into a dev or preview
 * environment fails closed instead of spending money. Set both only in the production Supabase project.
 */
export function getRuntimeModelProfile(name: string | undefined, appEnv: string | undefined): ModelProfile {
  const profile = getModelProfile(name);
  if (profile.name === 'prod' && appEnv?.trim() !== 'production') {
    throw new Error('MODEL_PROFILE=prod needs APP_ENV=production. Paid models run in production only.');
  }
  return profile;
}

/** Models in call order for a role: primary first, then fallbacks. */
export function modelsForRole(profile: ModelProfile, role: ModelRole): string[] {
  const r = profile.roles[role];
  return [r.primary, ...r.fallbacks];
}

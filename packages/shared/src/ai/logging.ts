import type { AiCallLog } from './openrouter.ts';
import type { GuardrailEventData } from './guardrails.ts';

/** `ai_call_logs` row for one OpenRouter call. Metadata only: never prompts or model output. */
export function aiCallRow(l: AiCallLog) {
  return {
    user_id: l.userId,
    job_id: l.jobId,
    role: l.role,
    model: l.model,
    tokens_in: l.tokensIn,
    tokens_out: l.tokensOut,
    cost_usd: l.costUsd,
    latency_ms: l.latencyMs,
    status: l.status,
    qa_result: l.qaResult ?? null,
    retry: l.retry ?? 0,
    escalated: l.escalated ?? false,
    refusal: l.refusal ?? false,
  };
}

/** Actions whose text a human reviews. Everything else is a count only (no text, so no health data kept). */
export const REVIEW_ACTIONS: readonly GuardrailEventData['action'][] = ['blocked', 'dropped', 'blocked_unclassified'];

/**
 * `guardrail_events` row. The category is `rule` (injection, off_topic, medical_red_flag, too_long, unclassified).
 * The user's text is stored only when it goes to the review queue; the database nulls it after the retention
 * window (`purge_guardrail_text`).
 */
export function guardrailRow(userId: string, jobId: string | null, e: GuardrailEventData) {
  return {
    user_id: userId,
    job_id: jobId,
    field: e.field,
    rule: e.rule,
    action: e.action,
    input_text: REVIEW_ACTIONS.includes(e.action) ? e.inputText : null,
  };
}

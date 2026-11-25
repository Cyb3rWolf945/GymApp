import { z } from 'zod';
import { FREE_TEXT_MAX } from '../ai/guardrails.ts';

// Optional post-workout feedback. The note is free text: it goes through the guardrails before it can
// become a memory fact for the planner.
export const FeedbackSchema = z.object({
  sessionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().max(FREE_TEXT_MAX).optional(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

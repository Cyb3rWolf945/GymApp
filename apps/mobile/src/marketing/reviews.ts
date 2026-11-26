import type { Review } from '@gymapp/shared';

/**
 * Real reviews for the landing page. Empty on purpose: nothing is invented, and the section stays hidden until there are
 * real, attributable ones here (quote in their words, how they are named, a 1 to 5 rating and where it was published).
 * `usableReviews` shows at most three and skips any that are incomplete.
 */
export const REVIEWS: readonly Review[] = [];

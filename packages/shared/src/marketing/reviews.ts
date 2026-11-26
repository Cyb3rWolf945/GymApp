/**
 * Social proof on the landing page. Only real, attributable reviews are shown: nothing is made up, so the list starts
 * empty and the section stays hidden until the owner adds some. `usableReviews` drops anything that is not complete.
 */
export interface Review {
  /** What the person wrote, in their words. */
  quote: string;
  /** How they are named, for example "Sam, lifting 3 days a week". */
  name: string;
  /** 1 to 5. */
  rating: number;
  /** Where it was published, for example "App Store". */
  source: string;
}

export const MAX_REVIEWS_SHOWN = 3;
const MAX_QUOTE_CHARS = 280;

/** The reviews that can be shown: complete, rated 1 to 5, quote not too long; at most `MAX_REVIEWS_SHOWN`, in the order given. */
export function usableReviews(reviews: readonly Partial<Review>[]): Review[] {
  return reviews
    .filter(
      (r): r is Review =>
        typeof r.quote === 'string' && r.quote.trim().length > 0 && r.quote.length <= MAX_QUOTE_CHARS &&
        typeof r.name === 'string' && r.name.trim().length > 0 &&
        typeof r.source === 'string' && r.source.trim().length > 0 &&
        typeof r.rating === 'number' && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5,
    )
    .slice(0, MAX_REVIEWS_SHOWN);
}

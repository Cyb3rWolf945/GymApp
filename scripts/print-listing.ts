// Prints the store listing with character counts, ready to paste into App Store Connect and Google Play Console.
//   pnpm tsx scripts/print-listing.ts
import { LISTING, listingFields } from '../packages/shared/src/store/listing.ts';

for (const store of ['apple', 'google'] as const) {
  console.log(`\n==================== ${store === 'apple' ? 'App Store Connect' : 'Google Play Console'} ====================`);
  for (const f of listingFields().filter((x) => x.store === store)) {
    console.log(`\n--- ${f.field} (${f.text.length}/${f.limit}) ---\n${f.text}`);
  }
}
console.log('\n--- other ---');
console.log(`Apple category: ${LISTING.apple.category.primary} / ${LISTING.apple.category.secondary}`);
console.log(`Apple age rating (suggested): ${LISTING.apple.ageRating}`);
console.log(`Google category: ${LISTING.google.category}. Tags: ${LISTING.google.tags.join(', ')}`);

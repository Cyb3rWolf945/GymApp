// Creates the Products, Prices and the FOUNDING coupon in Stripe (test mode). Idempotent: prices are found by
// lookup_key, products by metadata. Usage: STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts
import { FOUNDING_COUPON, PAID_TIERS, PRICES, stripeClient } from '../packages/shared/src/payments/index.ts';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test_')) throw new Error('Set STRIPE_SECRET_KEY to a test-mode key (sk_test_...). Live keys are not used here.');
const stripe = stripeClient(key);

type List<T> = { data: T[] };
const NAMES = { basic: 'Fuelift Basic', pro: 'Fuelift Pro', elite: 'Fuelift Elite' } as const;

async function main() {
  const productIds = new Map<string, string>();
  for (const tier of PAID_TIERS) {
    const found = await stripe<List<{ id: string }>>('GET', '/products/search', { query: `metadata['tier']:'${tier}' AND active:'true'` });
    const id = found.data[0]?.id ?? (await stripe<{ id: string }>('POST', '/products', { name: NAMES[tier], metadata: { tier } })).id;
    productIds.set(tier, id);
    console.log(`product ${tier}: ${id}`);
  }
  for (const p of PRICES) {
    const existing = await stripe<List<{ id: string }>>('GET', '/prices', { lookup_keys: [p.lookupKey], active: true });
    if (existing.data[0]) {
      console.log(`price ${p.lookupKey}: exists (${existing.data[0].id})`);
      continue;
    }
    const created = await stripe<{ id: string }>('POST', '/prices', {
      product: productIds.get(p.tier), currency: 'usd', unit_amount: p.cents, recurring: { interval: p.interval },
      lookup_key: p.lookupKey, metadata: { tier: p.tier },
    });
    console.log(`price ${p.lookupKey}: ${created.id}`);
  }
  try {
    await stripe('GET', `/coupons/${FOUNDING_COUPON.id}`);
    console.log('coupon FOUNDING: exists');
  } catch {
    await stripe('POST', '/coupons', {
      id: FOUNDING_COUPON.id, name: 'Founding member', amount_off: FOUNDING_COUPON.amountOffCents, currency: 'usd', duration: 'once',
      applies_to: { products: [productIds.get(FOUNDING_COUPON.tier)] },
    });
    console.log('coupon FOUNDING: created');
  }
}
void main();

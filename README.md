# GymApp (working brand: Fuelift)

AI-personalised workouts **and** meal plans in one plan that adapts every week. Universal Expo app (iOS, Android, web), Supabase backend, Stripe subscriptions (Basic / Pro / Elite), LLMs via OpenRouter.

- Spec: [`docs/SPEC.md`](docs/SPEC.md)
- Agent conventions: [`CLAUDE.md`](CLAUDE.md)
- Work is tracked as GitHub issues (milestones Day 1–3) and built by a scheduled team of agents.

## How to deploy DB changes

1. Add a new file in `supabase/migrations` with a later timestamp prefix than the existing ones. Never edit an applied file.
2. Run `pnpm gen:types` and commit the result.
3. Apply to the real project: `SUPABASE_ACCESS_TOKEN=<token> pnpm tsx supabase/scripts/apply-remote.ts`.
   The script applies migrations, then the seed, in order. Applied files are recorded in `_applied_migrations`, so re-running is safe. It prints row counts and any table without RLS.
4. Add `--print-env` to print the project URL and anon key. Put them in Vercel env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and in your local `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Never commit them.

In the cloud agent environment, set `SUPABASE_ACCESS_TOKEN=proxy-injected` and run Node with `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` so `fetch` goes through the proxy.

## Stripe (test mode)

1. Create products, prices and the `FOUNDING` coupon: `STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts` (safe to re-run).
2. Deploy the functions and set secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`): `supabase functions deploy stripe-webhook --no-verify-jwt`, then `stripe-checkout`, `stripe-portal`, `stripe-reconcile`.
3. In Stripe, add a webhook endpoint pointing at the `stripe-webhook` function for: `checkout.session.completed`, `customer.subscription.created|updated|deleted|trial_will_end`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`. Copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Schedule `stripe-reconcile` daily, calling it with the service-role key as bearer token.
5. Access is decided in SQL: `has_access(user, feature)` (service role) and `my_access(feature)` (signed-in user). Never use live keys from agents.

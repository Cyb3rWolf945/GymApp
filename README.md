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

## Analytics, AI logs and admin views

- `track(sink, who, name, props)` in `packages/shared/src/analytics` is the typed helper for the server. The app uses `trackEvent` (`apps/mobile/src/analytics/track.ts`), which goes through the `track-event` function. Client events: quiz, onboarding screens, plan preview, paywall, checkout, workout logged. `signup`, `trial_start` and `purchase` are written by the database trigger and the Stripe webhook only.
- Every OpenRouter call is logged to `ai_call_logs` (role, model, tokens, cost, latency, QA result, retry, escalated, refusal). Never the prompt or the output.
- Guardrail events are counted in `guardrail_events`. The user's text is kept only for blocked or dropped input (the review queue) and removed after 30 days or once reviewed. Schedule the `daily-maintenance` function daily to purge it.
- Views for the admin dashboards (service role only): `analytics_funnel_daily`, `ai_usage_daily`, `guardrail_daily`, `revenue_net_daily`.

## Admin backoffice (`apps/admin`)

Next.js (App Router) + Tailwind + shadcn/ui-style components + Recharts. Run it with `pnpm --filter admin dev` (port 3001) after copying `apps/admin/.env.example` to `.env.local`.

- **Access:** sign in with Supabase email and password, then the account must be in the `admins` table and must verify a TOTP code in the current session (first login enrols an authenticator app). Add an admin with `insert into public.admins (user_id) values ('<auth user id>');`. Turn on TOTP in the Supabase dashboard (Auth, Multi-factor) for the hosted project; `supabase/config.toml` covers local.
- **Service role:** only in `src/lib/supabase/admin.ts`, which imports `server-only`. Every page, action and route handler starts with `requireAdmin()`; the proxy only refreshes cookies.
- **Audit:** `admin_audit_log` gets a row for each login, each 2FA step, the user list and every view of a user's health data (the row is written before the data is read; if it fails the page shows nothing).
- **Vercel:** create a project with root directory `apps/admin` (it picks up `apps/admin/vercel.json`), set the three env vars from `.env.example`, and add the domain `admin.<domain>` in the project settings.

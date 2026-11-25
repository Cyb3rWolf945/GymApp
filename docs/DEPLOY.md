# Production deploy and launch checklist

Everything here that needs no secret is already in the repo (scripts, config, guards). The steps marked **Owner** need
your keys, accounts or approval. Agents never switch Stripe to live keys and never start ad spend.

## 0. Environments

| | Dev / preview | Production |
|---|---|---|
| Supabase | the development project | the production project (`SUPABASE_PROJECT_REF`) |
| `MODEL_PROFILE` | unset or `dev` (free models, synthetic data only) | `prod` (paid models) |
| `APP_ENV` | unset | `production` |
| Stripe keys | `sk_test_...` | `sk_live_...` only after the owner approves (step 5) |

`MODEL_PROFILE=prod` has a second lock: the Edge Functions refuse it unless `APP_ENV=production` is also set
(`getRuntimeModelProfile`). Set both, only in the production Supabase project's function secrets. Never in Vercel
preview, local `.env` files or CI.

## 1. Database (agents can do this)

```bash
# idempotent: applies migrations then the seed, records them in _applied_migrations
NODE_USE_ENV_PROXY=1 SUPABASE_ACCESS_TOKEN=<token> pnpm tsx supabase/scripts/apply-remote.ts
```

Check: every table has RLS (the script prints `tables_without_rls`, it must be empty) and the seed counts are
exercises 150, ingredients 155, recipes 60.

## 2. Edge Functions (Owner: needs the Supabase CLI login)

```bash
supabase login
SUPABASE_PROJECT_REF=<ref> supabase/scripts/deploy-functions.sh
```

The script deploys every function with the right flags (`stripe-webhook` runs with `--no-verify-jwt`, because Stripe
has no Supabase token: its signature is the authentication). Then set the secrets:

```bash
supabase secrets set --project-ref <ref> \
  APP_ENV=production MODEL_PROFILE=prod OPENROUTER_API_KEY=... \
  APP_URL=https://<domain> ALLOWED_ORIGINS=https://<domain> \
  STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... \
  META_PIXEL_ID=... META_CAPI_TOKEN=...
```

| Secret | Used by | Notes |
|---|---|---|
| `APP_ENV`, `MODEL_PROFILE` | generate-plan, workout-feedback | `production` and `prod`, together |
| `OPENROUTER_API_KEY` | generate-plan, workout-feedback | set a spend limit in OpenRouter |
| `APP_URL`, `ALLOWED_ORIGINS` | checkout, portal, CORS | the web origin, no trailing slash |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | stripe-*, delete-account | test keys until step 5 |
| `META_PIXEL_ID`, `META_CAPI_TOKEN` | track-event, stripe-webhook | optional until ads start |

Schedule two daily calls with the service-role key as bearer token: `stripe-reconcile` and `daily-maintenance`.

## 3. Web (Owner: Vercel account and domain)

1. **App (the web build and quiz funnel):** new Vercel project, root directory = repo root (uses `vercel.json`).
   Environment variables (Production): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   `EXPO_PUBLIC_META_PIXEL_ID`. The anon key comes from `apply-remote.ts --print-env`.
2. **Admin:** second project, root directory `apps/admin` (uses `apps/admin/vercel.json`). Variables:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only).
3. Domains: the app on `<domain>`, admin on `admin.<domain>`. In Supabase Auth, add both to the redirect URLs.
4. Enable TOTP (Multi-factor) in Supabase Auth, then insert the first admin: `insert into public.admins (user_id) values ('<auth user id>');`

## 4. Smoke test the AI (needs `OPENROUTER_API_KEY`)

Three synthetic profiles (cut / bulk / recomp, with allergies, diets and injuries), a workout and a meal plan each.
A plan passes only if a model made it (not the template fallback), the validator finds nothing and QA passes.

```bash
# free models, anywhere:
NODE_USE_ENV_PROXY=1 SUPABASE_ACCESS_TOKEN=<token> pnpm tsx scripts/smoke-ai.ts
# paid models, from the production environment only (about $0.01 per plan, 6 plans):
MODEL_PROFILE=prod CONFIRM_PROD_SMOKE=yes SUPABASE_ACCESS_TOKEN=<token> pnpm tsx scripts/smoke-ai.ts
```

The prod run must print `6/6 passed` with the paid models listed. It exits 1 otherwise.

## 5. Stripe live (Owner approval required)

Do this only after you have asked for and given approval in the "MVP status" issue (#36).

1. Test mode first: `STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts`, a test checkout and a refund.
2. For live: create the live products and prices (the script refuses non-test keys on purpose, so create them in the
   Stripe dashboard with the same lookup keys, see `packages/shared/src/payments/pricing.ts`), the `FOUNDING` coupon,
   the live webhook endpoint (`stripe-webhook`, events in the README), and the Customer Portal settings.
3. Set the live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as function secrets, then run one real purchase and
   refund it.

## 6. Launch checklist

- [ ] Migrations applied, no table without RLS, seed counts right (step 1)
- [ ] All functions deployed, secrets set, `APP_ENV=production` and `MODEL_PROFILE=prod` together (step 2)
- [ ] `stripe-reconcile` and `daily-maintenance` scheduled (step 2)
- [ ] Web and admin deployed on their domains; auth redirect URLs set; first admin added with TOTP (step 3)
- [ ] AI smoke test: prod profile `6/6 passed` (step 4)
- [ ] Legal text replaced by lawyer-approved text, company and DPO details filled in, versions bumped (`packages/shared/src/legal/docs.ts`)
- [ ] Owner approval given, then Stripe live checked with one real purchase and refund (step 5)
- [ ] Free-generation policy confirmed and rate limiting planned (E-28)
- [ ] Meta Pixel and CAPI checked in Meta's test events before any ad spend
- [ ] Sign-in providers (Google, Apple, email) configured and the bundle id replaced in `apps/mobile/app.json`

## 7. Rollback

- **Web:** promote the previous Vercel deployment.
- **Functions:** redeploy the previous git tag with `deploy-functions.sh`.
- **Database:** migrations are forward-only. Fix forward with a new migration; for a bad data change restore from the
  Supabase backup (point in time recovery).
- **AI costs spiking:** unset `MODEL_PROFILE` in the function secrets (back to the free models), or rotate the OpenRouter key.

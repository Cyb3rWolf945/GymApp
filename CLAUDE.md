# CLAUDE.md — Agent conventions for GymApp (working brand: Fuelift)

The spec is `docs/SPEC.md` (Portuguese). Each GitHub issue is self-contained: **the issue's acceptance criteria are your scope**.

## Prime directive: ship, don't plan
- Read the issue → implement → test → open PR. Do **not** write plans, design docs or ADRs.
- Ambiguity: pick the simplest option that meets the acceptance criteria, note it in the PR description, keep going. Don't stop to ask.
- Keep the PR scoped to the issue. Don't touch files outside it unless strictly required (say why in the PR).
- If the issue is bigger than expected, ship the essential part and list the rest under "Follow-ups" in the PR.

## Stack
- **App:** Expo (expo-router) + TypeScript, universal (iOS, Android, **web**). Dark theme first.
- **Backend:** Supabase (Postgres + RLS + Auth + Edge Functions in Deno/TS + Storage).
- **Admin:** Next.js (App Router) + shadcn/ui + Recharts, deployed on Vercel.
- **Payments:** Stripe (web Checkout + Customer Portal + webhooks → `entitlements`). Access is always checked **server-side**.
- **LLM:** OpenRouter only, via `packages/shared/src/ai/models.config.ts`. Profiles: `MODEL_PROFILE=dev` (free `:free` models, synthetic data only) and `MODEL_PROFILE=prod` (paid models, production only). Never hardcode model IDs elsewhere.
- **Tests:** Vitest (unit), Playwright (E2E on the web build).
- **Package manager:** pnpm workspaces. Node 22.

## Layout
```
apps/mobile      Expo universal app (also the web app + quiz funnel)
apps/admin       Next.js backoffice
packages/shared  types, Zod schemas, calc lib, AI config/prompts
supabase/        migrations, seed, functions/ (Edge Functions)
docs/            SPEC.md
```

## Commands (root)
- `pnpm install`
- `pnpm lint` · `pnpm typecheck` · `pnpm test`
- `pnpm --filter mobile exec expo export --platform web`

## Definition of Done
- [ ] All acceptance criteria in the issue met
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally; CI green
- [ ] New logic has unit tests (calc, validators, guardrails, entitlements are mandatory)
- [ ] No secrets in code or commits (use env vars; `.env.example` updated)
- [ ] User-facing copy follows the writing guide (`docs/SPEC.md` → "Guia de escrita"): EN, 2nd person, short, verb-first buttons, no guilt language
- [ ] PR description: what changed, decisions taken, how to verify, `Closes #<n>`

## Git
- Branch: `feat/<issue-number>-<short-slug>` from `main`. Conventional commits (`feat:`, `fix:`, `chore:`, `test:`).
- One PR per issue, targeting `main`. Never force-push `main`.

## Security & privacy (non-negotiable)
- RLS on every user table, filter by `auth.uid()`. Service role only in server code.
- User free-text goes to LLMs only inside delimited data tags, after the guardrail pre-filter. LLM output only via JSON Schema, then deterministic validation.
- Health data = GDPR special category. Never log raw health data or prompts with real user data to third parties. Free models (`dev`) get synthetic data only.
- Stripe webhooks: verify signature, idempotent by `event.id`.

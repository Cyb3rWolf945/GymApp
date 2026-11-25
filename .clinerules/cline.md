# Cline rules: GymApp (working brand: Fuelift)

Cline loads this file automatically from `.clinerules/`. It sets the same quality bar as the Claude agents that work on this repo.

**Sources of truth, in this order:** the GitHub issue you are working on, then `CLAUDE.md`, then `docs/SPEC.md`. If this file and `CLAUDE.md` ever disagree, `CLAUDE.md` wins. Keep both in sync when you change conventions.

---

## 1. Working alongside the agent team

A scheduled orchestrator agent works through the backlog **one issue at a time** (issues #1–#35, IDs `E-01`…`E-35`). Issue #36 "MVP status" is the live board. To avoid two people or agents doing the same work:

1. **Claim before you code.** Assign yourself on the issue and set the label `status:in-progress` (replace `status:todo` or `status:ready`). The orchestrator skips any issue that has a human assignee.
2. Only pick an issue whose `Depends on: E-xx` issues are all **closed**.
3. One issue = one branch = one PR. If you stop working on it, remove your assignment and put the label back to `status:ready`.
4. Don't change files owned by an issue that's in progress elsewhere. Check the open PRs first.

## 2. Workflow in Cline (Plan → Act)

1. **Plan mode, briefly.** Read the issue, `CLAUDE.md` and the relevant code. Write a short plan: files to touch and how you'll test it. Keep it under about 10 lines, with no design docs. The rule is the same as for the agents: ship, don't plan.
2. **Act mode.** Implement in small steps. After each meaningful step, run the checks below and fix anything red before going further.
3. If something is ambiguous, pick the simplest option that meets the acceptance criteria and write the decision in the PR description. Don't block on it.
4. If the issue turns out bigger than expected, ship the essential part and list the rest under **Follow-ups** in the PR.

Cline settings:
- **Model:** use a strong coding model for implementation. Claude Sonnet 5.5 is recommended, the same as the agents. Don't use the app's free `:free` OpenRouter models to write code.
- **Auto-approve:** allow reading files and running the check commands. Keep writes outside the repo and any `git push --force` on manual approval.
- **Checkpoints:** leave them on, so you can roll back a bad step.

## 3. Stack (don't swap without an issue)

| Area | Choice |
|---|---|
| App | Expo (expo-router) + TypeScript strict, universal: iOS, Android and **web** |
| Backend | Supabase: Postgres + RLS + Auth + Edge Functions (Deno/TS) + Storage |
| Admin | Next.js App Router + shadcn/ui + Recharts (`apps/admin`) |
| Payments | Stripe Checkout + Customer Portal + webhooks → `entitlements` |
| LLM in the app | **OpenRouter only**, through `packages/shared/src/ai/models.config.ts` |
| Tests | Vitest (unit) and Playwright (E2E on the web build) |
| Tooling | pnpm workspaces, Node 22, ESLint, Prettier |

Layout:
```
apps/mobile      Expo universal app (also web + quiz funnel)
apps/admin       Next.js backoffice
packages/shared  types, Zod schemas, calc lib, AI config/prompts
supabase/        migrations, seed, functions/
docs/SPEC.md     product spec (Portuguese)
```

## 4. Commands you must run before every commit

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter mobile exec expo export --platform web
```

CI runs the same commands, and a PR with red CI will not be merged.

## 5. Code standards

- **TypeScript strict.** No `any` unless you explain it in a comment. Validate every external input with Zod: API bodies, LLM output, webhooks, forms.
- Shared logic (types, schemas, calculations, AI config) lives in `packages/shared`. Don't duplicate it inside the apps.
- Small, pure functions for business rules, with unit tests next to them (`*.test.ts`).
- **Tests are mandatory** for calculations, validators, guardrails, entitlements/access checks, shopping-list aggregation and webhook handlers. Cover the edge cases, not only the happy path.
- No dead code, commented-out blocks or stray `console.log`. Use the project logger once it exists.
- Prefer existing utilities and components (`apps/mobile/src/…`, `packages/shared`) over new dependencies. Each new dependency needs a reason in the PR.

## 6. AI and LLM rules (in-app)

- Never hardcode a model ID. Use the roles (`planner`, `qa`, `light`, `escalation`) from `models.config.ts`.
- **`MODEL_PROFILE=dev`** (free `:free` models) for all local work, tests, CI and previews. **`MODEL_PROFILE=prod`** is only for the production environment.
- Free models may log prompts, so **use synthetic data only** with them. Never paste real user data into prompts, tests or fixtures.
- LLM output only via JSON Schema (`response_format: json_schema, strict`), then the deterministic validator, then the QA judge. Never trust raw model text.
- User free text goes to the model only after the guardrail pre-filter, and only inside delimited data tags (`<user_notes>…</user_notes>`).
- The OpenRouter key lives on the server (Edge Functions) as `OPENROUTER_API_KEY`. Never put it in the client or in `EXPO_PUBLIC_*` variables.

## 7. Security and privacy (non-negotiable)

- RLS on every user table, filtered by `auth.uid()`. Use the service-role key only in server code, never in the app or the browser.
- Every new table migration enables RLS, adds policies **and** explicit `grant`s for the roles that use it (new Supabase projects give `anon`/`authenticated` no table access by default; `service_role` gets it from default privileges).
- Health data is GDPR special-category data. Don't log raw health data. In the admin app, record every view of user health data in `admin_audit_log`.
- Stripe webhooks: verify the signature and make the handler idempotent by `event.id`. Access to paid features is checked **server-side** (`has_access`), never only in the UI.
- **No secrets in the repo.** Use `.env` locally (it's gitignored) and keep `.env.example` updated with empty values. If you ever commit a key by mistake, tell the team and rotate it immediately.

## 8. UX copy (English, in-app)

Follow the writing guide in `docs/SPEC.md` ("Guia de escrita") and keep strings in `apps/mobile/src/copy/en.ts`:
- second person, active voice, short sentences, concrete numbers;
- buttons start with a verb and say what happens ("Start workout", "Swap exercise"), never "OK" or "Submit";
- error messages say what happened and what to do, without blaming the user;
- no guilt or shame language ("cheat meal", "burn off", "no excuses") and no unrealistic promises;
- glossary: say **workout** (not "session" or "routine"), **plan**, **meal**, **shopping list**.

## 9. Git and PRs

- Branch from `main`: `feat/<issue-number>-<short-slug>` (or `fix/…`).
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `refactor:`, `docs:`.
- One PR per issue, targeting `main`. Never force-push `main`.
- The PR description must include:
  - **What changed**
  - **Decisions taken** (anything ambiguous you resolved)
  - **How to verify** (commands and steps)
  - **Follow-ups** (if any)
  - `Closes #<n>`
- The orchestrator reviews PRs and merges them once CI is green. Address its review comments in the same PR.

## 10. Definition of Done (check every box before opening the PR)

- [ ] All acceptance criteria in the issue are met
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally, and the web export builds
- [ ] New logic has unit tests (the mandatory areas in section 5)
- [ ] No secrets, no real user data in fixtures, `.env.example` updated
- [ ] UX copy follows the writing guide
- [ ] RLS and server-side access checks are in place for any new table or endpoint
- [ ] PR description complete, with `Closes #<n>`

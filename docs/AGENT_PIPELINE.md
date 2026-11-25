# Agent pipeline: scheduled runner teams, strictly sequential

The MVP is built by **runner teams**. A team is two long-lived cloud sessions, each with repo and GitHub access and its own hourly scheduled task (watchdog). Each team runs on a different person's Claude account, so the project keeps going while at least one account has usage left. **Only the team that holds the shift lock (issue #49) works**, and inside a team the two runners hand work to each other with `send_message`, so only one agent works at a time.

| Team | Account | IMPLEMENTER session | REVIEWER session |
|---|---|---|---|
| A | António (repo owner) | `session_01CWbvJqfz84tsJqy7tRiobX` | `session_01CWbvJsYk7BCAU48iigGYJn` |
| B | Collaborator | _fill in when created_ | _fill in when created_ |

Every runner knows its own team letter from its first prompt. **Only send messages to sessions of your own team.**

The owner explicitly authorized merging PRs that pass review with green CI. Never activate Stripe live keys or ad spend.

## Shift lock (issue #49)
The body of issue #49 holds exactly two lines: `owner: <A|B>` and `heartbeat: <ISO-8601 UTC>`.

**Before every job and every watchdog run**, read issue #49:
- **`owner` is your team:** set `heartbeat` to now (keep `owner`), then do the job. Refresh `heartbeat` again when the job ends.
- **`owner` is the other team and `heartbeat` is less than 90 minutes old:** the other team is working. Do nothing and stop.
- **`owner` is the other team and `heartbeat` is 90 minutes old or more:** that team has stalled, probably because its account ran out of usage. **Take over**:
  1. Set `owner` to your team and `heartbeat` to now.
  2. Add a line to #36: "Shift taken over by team <X> at <time>".
  3. Resume as described in "Hourly watchdog" below. The REVIEWER reviews any open PR first. The IMPLEMENTER continues any `status:in-progress` issue on its existing branch, keeping the other team's commits.

Only the REVIEWER of the owning team edits #36's "Progress" section.

Repo: `Cyb3rWolf945/GymApp`. Issues #1–#35 are `E-01`…`E-35`. The status board is issue #36. A human colleague may work on issues with Cline (`.clinerules/cline.md`): never take an issue that has a human assignee, but do review their PRs the same way.

## Start of every job (both runners)
1. `git fetch origin && git checkout main && git reset --hard origin/main`, then re-read this file and `CLAUDE.md`.
2. Keep the context small. Don't re-read large files you've already read; read only what the current issue needs.

## IMPLEMENTER runner
**On `NEXT <n>`** (sent by the reviewer, or chosen yourself by the watchdog):
1. Read issue #n and its comments. Label it `status:in-progress`.
2. Work on branch `feat/<n>-<slug>`, created from `main`. Ship, don't plan.
3. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` until they all pass.
4. Open a PR to `main` with `Closes #<n>`, then label the issue `status:review`.
5. Send the REVIEWER: `REVIEW PR #<p> issue #<n>`. Stop.

**On `FIX PR #<p> issue #<n>: …`:**
1. Check out the PR branch.
2. Address every point in the latest review comment and run the checks again.
3. Push, then send the REVIEWER: `REVIEW PR #<p> issue #<n>`. Stop.

**When the issue needs owner input** (keys, accounts, approvals):
1. Label it `status:blocked` and add a "Needs owner" line to #36.
2. Pick the next eligible issue yourself (rules below) and start it.

## REVIEWER runner
**On `REVIEW PR #<p> issue #<n>`:**
1. Wait for CI to finish. Use `send_later` to check back in 5 minutes; don't poll in a loop.
2. Review the diff against the issue's acceptance criteria and `CLAUDE.md`. Check:
   - correctness bugs;
   - missing tests in the mandatory areas;
   - RLS and server-side access checks;
   - secrets;
   - webhook signature checks and idempotency;
   - guardrails;
   - real user data sent to free models;
   - scope creep.
3. Merge the PR branch onto current `main` locally and run lint, typecheck and tests.
4. **If it passes:**
   1. Squash-merge with the title `<PR title> (#<p>)`.
   2. Close the issue as completed and label it `status:done`.
   3. Update the "Progress" section of #36: closed x/35, last merged, next issue, blocked, needs owner.
   4. Pick the next eligible issue and send the IMPLEMENTER: `NEXT <n>`. Stop.
5. **If it fails:** post one PR comment listing the concrete required changes, then send the IMPLEMENTER: `FIX PR #<p> issue #<n>: <one-line summary>`. Stop.

## Hourly watchdog (scheduled task on each runner)
0. Apply the shift-lock rules above first. If the other team holds a fresh lock, stop.
1. If you are in the middle of a job, carry on.
2. If the pipeline has stalled (no open PR or `status:in-progress` issue updated in the last 2 hours), restart it:
   - the REVIEWER reviews any open PR, or sends `NEXT <n>`;
   - the IMPLEMENTER resumes an unfinished `status:in-progress` issue of its own.
3. Otherwise do nothing and stop. Keep this cheap.

## Next eligible issue
- Open, and every `Depends on: E-xx` issue is closed.
- No human assignee, and not `status:blocked`.
- Order: `priority:must` before `should`, then lower `day:`, then lowest number.
- If nothing is eligible, write "Pipeline idle: waiting on …" in #36 and stop.

## Conventions
- In code, `OPENROUTER_API_KEY` comes from the environment. In the agent environment, set it to `proxy-injected`; the network proxy injects the real key. Never commit keys.
- Use `MODEL_PROFILE=dev` (free models, synthetic data only) for every test. `prod` is only for production.
- End every GitHub comment with:

```
---
_Generated by [Claude Code](https://claude.ai/code)_
```

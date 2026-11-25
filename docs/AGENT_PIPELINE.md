# Agent pipeline: scheduled runner teams, strictly sequential

The MVP is built by **runner teams**. A team is two long-lived cloud sessions, each with repo and GitHub access and its own hourly scheduled task (watchdog). Each team runs on a different person's Claude account, so the project keeps going while at least one account has usage left. **Only the team that holds the shift lock (issue #49) works**, and inside a team the two runners hand work to each other with `send_message`, so only one agent works at a time.

| Team | Account | IMPLEMENTER session | REVIEWER session |
|---|---|---|---|
| A | António (repo owner) | `session_01CWbvJqfz84tsJqy7tRiobX` | `session_01CWbvJsYk7BCAU48iigGYJn` |
| B | Collaborator | `session_01Kdop2igX7KLqqN61nWjG9S` | `session_01Kdop2jLbpwqz6qKGYGFxR6` |

Every runner knows its own team letter from its first prompt. **Only send messages to sessions of your own team.**

The owner explicitly authorized merging PRs that pass review with green CI. Never activate Stripe live keys or ad spend.

## Shift lock (issue #49)
The body of issue #49 holds exactly two lines: `owner: <A|B>` and `heartbeat: <ISO-8601 UTC>`.

**Before every job and every watchdog run**, read issue #49:
- **`owner` is your team:** run the usage check below first. If you're under 65%, set `heartbeat` to now (keep `owner`), then do the job. While you work, refresh `heartbeat` at least every 20 minutes: after every push, every CI wait and every message you send. Refresh it again when the job ends.
- **`owner` is the other team and `heartbeat` is less than 45 minutes old:** the other team is working. Do nothing and stop.
- **`owner` is the other team and `heartbeat` is 45 minutes old or more:** that team has stalled, probably because its account ran out of usage. **Take over**:
  1. Set `owner` to your team and `heartbeat` to now.
  2. Add a line to #36: "Shift taken over by team <X> at <time>".
  3. Resume as described in "Hourly watchdog" below. The REVIEWER reviews any open PR first. The IMPLEMENTER continues any `status:in-progress` issue on its existing branch, keeping the other team's commits.

**Lost the lock?** Re-read issue #49 before every push, merge and message you send. If `owner` is no longer your team, the other team has taken over: push your work in progress to its branch, comment where you stopped on the issue or PR, and stop. Never take the lock back while the other team's heartbeat is fresh.

### Usage handoff at 65%
Each team hands over the shift **before** its account runs out, so the other team can start at its next watchdog run without waiting for the stale-lock takeover.

**Usage check.** Call `get_session` with no `session_id` to get your own session ID. Then call `list_events` on that ID with `kinds: ["rate_limit_event"]` and `limit: 100`. Read `unifiedWindows.five_hour.utilization` from the newest event. It's account-wide, so it covers both runners of your team. If no event is returned, treat usage as under 65%.

**When to check:** before every job, at every watchdog run, and after every push.

**At 65% or more** (`utilization >= 0.65`), or if `five_hour.status` isn't `allowed`, while your team holds the lock:
1. Stop where you are. Push any work in progress to its branch, even if checks fail, and don't open a new PR.
2. Comment on the issue or PR you're working on: "Handoff from team <X> at <time> (5-hour usage <n>%). Branch `<branch>`. Done: … Next step: …". This note is what the other team resumes from.
3. Set issue #49 to `owner: <other team>` and `heartbeat: <now>`.
4. Add a line to #36: "Shift handed to team <Y> at <time> (team <X> at <n>% of its 5-hour limit, resets <time from five_hour.resetsAt>)".
5. Don't send any more `NEXT`, `REVIEW` or `FIX` messages, and don't refresh the heartbeat again. Stop.

**When the lock is handed to you** (`owner` is your team, but your team didn't hold it before), resume as in step 3 of "Take over" above. Read the latest "Handoff from team …" comment first.

**If your own usage is also 65% or more** when the lock is yours, don't hand it back. Do nothing, don't refresh the heartbeat, and stop. Whichever team has usage left takes over once the heartbeat is 45 minutes old.

The 45-minute takeover rule is the fallback for a team that runs out without handing over, for example when its account is also used outside the pipeline.

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
4. Run `git merge origin/main` and re-run the checks, so the PR doesn't open with conflicts.
5. Open a PR to `main` with `Closes #<n>`, then label the issue `status:review`.
6. Send the REVIEWER: `REVIEW PR #<p> issue #<n>`. Stop.

**On `FIX PR #<p> issue #<n>: …`:**
1. Check out the PR branch, then run `git fetch origin && git merge origin/main`. Keep both sides' changes and regenerate the lockfile and types if needed.
2. Address every point in the latest review comment and run all the checks again.
3. Push, then send the REVIEWER: `REVIEW PR #<p> issue #<n>`. Stop.

**When the issue needs owner input** (keys, accounts, approvals):
1. Label it `status:blocked` and add a "Needs owner" line to #36.
2. Pick the next eligible issue yourself (rules below) and start it.

## REVIEWER runner
**On `REVIEW PR #<p> issue #<n>`:**
0. Read the PR's `mergeable_state`. If it is `unknown`, read it again after about 1 minute.
   - `clean` or `unstable`: continue with the normal review.
   - `dirty` or `behind`:
     - **Trivial conflict** (only `*.md`, `pnpm-lock.yaml` or generated types such as `database.types.ts`): resolve it yourself. Check out the PR branch and run `git merge origin/main`. Regenerate the lockfile with `pnpm install` and the types with `pnpm gen:types`. Run lint, typecheck and tests, then push the merge commit to the PR branch. Comment "Resolved merge conflict with main (trivial: <files>)". Wait for CI and continue the review.
     - **Code conflict** (`apps/`, `packages/`, `supabase/migrations`, `supabase/functions`): don't resolve it. Comment the conflicting files on the PR, send your team's IMPLEMENTER `FIX PR #<p> issue #<n>: merge conflict with main in <files>`, and stop.
     - Migrations that share a timestamp prefix with main always count as a code conflict. The IMPLEMENTER renames the PR's migration to a later timestamp and regenerates the types.
   - PRs without an issue, or opened by humans (a Cline colleague, the team B setup): resolve trivial conflicts the same way. For a code conflict in a human PR, comment asking the author to merge main, and send nothing to the IMPLEMENTER.
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
3. Run the checks on the PR merged into `main`, or skip that when CI already did it:
   - **Skip the local merge-and-test** when **all** of these are true:
     - CI concluded `success` on the PR's current head SHA (the `ci` check; read the check runs for that SHA, not an older run);
     - the PR is up to date with `main`: `GET /repos/{owner}/{repo}/compare/main...<head sha>` returns `behind_by: 0`, and `mergeable_state` is `clean`;
     - the PR doesn't touch `supabase/migrations/**` or `supabase/functions/**` (check the PR's file list).
     In the review comment, say that the local run was skipped and why, for example "Local run skipped: CI green on <sha>, up to date with main, no migrations or Edge Functions."
   - **Otherwise** (CI not green on the current head, the PR is behind `main`, or it touches migrations or Edge Functions): merge the PR branch onto current `main` locally and run lint, typecheck and tests, as before. Migrations and Edge Functions are always run locally.
4. **If it passes:**
   1. Squash-merge as described in "Merging" below.
   2. Close the issue as completed and label it `status:done`.
   3. Update the "Progress" section of #36: closed x/35, last merged, next issue, blocked, needs owner.
   4. Pick the next eligible issue and send the IMPLEMENTER: `NEXT <n>`. Stop.
5. **If it fails:** post one PR comment listing the concrete required changes, then send the IMPLEMENTER: `FIX PR #<p> issue #<n>: <one-line summary>`. Stop.

## Merging
Every PR is squash-merged, including docs PRs and PRs opened by humans. Never use a merge commit, a rebase merge or GitHub's default squash message. Merge through the API so the message is exactly this:

```
gh api -X PUT repos/Cyb3rWolf945/GymApp/pulls/<p>/merge \
  -f merge_method=squash -f sha=<PR head sha> \
  -f commit_title='<PR title> (#<p>)' -f commit_message="$BODY"
```

`$BODY` follows this template:

```
<Summary: 1–4 lines on what changed and why, and any decision a later reader needs.>

Commits:
- <subject of each commit in the PR, oldest first>

Closes #<n>
```

- **Summary:** always write it. For a one-commit PR whose subject says it all, one line is enough.
- **Commits:** list each commit's subject line only, without bodies or `Co-Authored-By`/`Claude-Session` trailers. Leave out merges of `main` into the branch.
- **Closes:** leave the line out for PRs without an issue.
- **Trailers:** end the body with one `Co-Authored-By` line and your own `Claude-Session` line.

## Hourly watchdog (scheduled task on each runner)
0. Apply the shift-lock rules above first, including the usage check. If the other team holds a fresh lock, or you just handed it over, stop.
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

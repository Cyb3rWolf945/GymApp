# Setting up runner team B (collaborator account)

Team B is a copy of the runner pipeline running on a second person's Claude account. Both teams stay switched on, and the shift lock in issue #49 makes sure only one of them works at a time (see `docs/AGENT_PIPELINE.md` → "Shift lock"). When team A reaches 65% of its 5-hour usage limit, it hands the lock to team B, which starts at its next watchdog run (within about 30 minutes). The other way round works the same. If a team stops without handing over, the other team takes over once the lock is 45 minutes old.

## 1. Prerequisites (about 5 minutes)
1. **GitHub:** the repo owner adds you as a collaborator on `Cyb3rWolf945/GymApp` (Settings → Collaborators). Accept the invite.
2. **Claude:** open **claude.ai/code** and connect your GitHub account. If you're asked, install the Claude GitHub App on the repo.
3. **Keys:** you need your own OpenRouter API key and a Supabase Personal Access Token. The token must come from an account that's a member of the Supabase organisation that owns project `qcmpzjopinnqfmbkpqnp`, so ask the owner for an invite. **Never paste keys into the chat.** The setup session will ask for them through a secure form.

## 2. Create the team (one prompt)
1. In claude.ai/code, start a **new cloud session** with the repository `Cyb3rWolf945/GymApp` selected.
2. Set the mode to **Auto** in the dropdown next to the prompt box.
3. Paste the prompt from the next section.

## 3. Prompt to paste

```
You are setting up runner TEAM B for the GymApp MVP (repo Cyb3rWolf945/GymApp). Read docs/AGENT_PIPELINE.md and docs/HANDOVER.md first. Do exactly this, then stop:

1. Ask me for credentials with the secure credential form (never in chat): host openrouter.ai (my OpenRouter API key) and host api.supabase.com (my Supabase Personal Access Token). Verify each: GET https://openrouter.ai/api/v1/key and GET https://api.supabase.com/v1/projects (send "Authorization: Bearer proxy-injected"; the proxy injects the real key).

2. Create two cloud sessions with create_session, both with source_url https://github.com/Cyb3rWolf945/GymApp, source_revision main, model sonnet:
   - title "GymApp IMPLEMENTER runner (team B)", tags ["gymapp-mvp","runner","implementer","team-b"]
   - title "GymApp REVIEWER runner (team B)", tags ["gymapp-mvp","runner","reviewer","team-b"]
   - title "GymApp QA runner (team B)", tags ["gymapp-mvp","runner","qa","team-b"] (first prompt: "You are the QA runner of TEAM B…", same pattern, listing both other team B session IDs)
   Give each this first prompt (fill in the role and the other runner's session ID): "You are the <ROLE> runner of TEAM B for the GymApp MVP. Your team's other runner is <OTHER_SESSION_ID>. Follow docs/AGENT_PIPELINE.md from origin/main for every job, including the Shift lock rules (issue #49). Only message sessions of team B. For now reply 'team B <role> ready' and stop."

3. Create two hourly scheduled tasks with create_trigger, each with persistent_session_id set to its runner:
   - "GymApp IMPLEMENTER watchdog (team B)", cron "15 * * * *"
   - "GymApp REVIEWER watchdog (team B)", cron "45 * * * *"
   - "GymApp QA watchdog (team B)", cron "5 * * * *"
   Prompt for both: "Hourly watchdog: follow the 'Hourly watchdog' section of docs/AGENT_PIPELINE.md (from origin/main) as the <ROLE> runner of TEAM B, starting with the Shift lock rules. Keep it brief."

4. Open a PR that fills in the three team B session IDs in the table in docs/AGENT_PIPELINE.md. Do not touch issue #49 (the lock).

5. Tell me the two session titles and remind me to set the mode to Auto in both.
```

## 4. After the prompt
1. Open the two new sessions, "GymApp IMPLEMENTER runner (team B)" and "GymApp REVIEWER runner (team B)", and set the mode to **Auto** in each.
2. You're done. Team B waits while team A holds a fresh lock, and takes over by itself if team A stalls.

## Checking which team is working
- Issue #49 shows `owner` (A or B) and the last `heartbeat`.
- Issue #36 shows progress and any "Shift taken over by team …" lines.

## Pausing a team
Disable that team's two "watchdog" scheduled tasks in claude.ai (Code → Routines), or ask any session on that account to disable them. The other team takes over once the lock is 45 minutes old.

## Adding the QA runner to an existing team B
Team B was set up before the QA runner existed, so it needs this extra step. In claude.ai/code, start a **new cloud session** with the repository `Cyb3rWolf945/GymApp`, set the mode to **Auto**, and paste:

```
You are adding the QA runner to TEAM B of the GymApp MVP (repo Cyb3rWolf945/GymApp). Read docs/AGENT_PIPELINE.md (sections "QA runner" and "Shift lock") and docs/HANDOVER.md first. Team B's IMPLEMENTER is session_01Kdop2igX7KLqqN61nWjG9S and its REVIEWER is session_01Kdop2jLbpwqz6qKGYGFxR6. Do exactly this, then stop:

1. Create one cloud session with create_session: source_url https://github.com/Cyb3rWolf945/GymApp, source_revision main, model sonnet, title "GymApp QA runner (team B)", tags ["gymapp-mvp","runner","qa","team-b"]. First prompt: "You are the QA runner of TEAM B for the GymApp MVP. Your team's IMPLEMENTER is session_01Kdop2igX7KLqqN61nWjG9S and REVIEWER is session_01Kdop2jLbpwqz6qKGYGFxR6. Only message team B sessions. For every job follow the 'QA runner' section of docs/AGENT_PIPELINE.md from origin/main, including the Shift lock rules (issue #49). You receive 'QA PR #<p> issue #<n>' from the REVIEWER and hourly watchdog prompts. Playwright and Chromium are pre-installed (require('playwright')). For now reply 'team B QA ready' and stop."

2. Create one hourly scheduled task with create_trigger, persistent_session_id set to the new QA session: name "GymApp QA watchdog (team B)", cron "5 * * * *", prompt "Hourly watchdog: follow the 'Hourly watchdog' section of docs/AGENT_PIPELINE.md (from origin/main) as the QA runner of TEAM B, starting with the Shift lock rules. Never start a QA run on your own. Keep it brief."

3. Send team B's REVIEWER (session_01Kdop2jLbpwqz6qKGYGFxR6) this message: "Team B now has a QA runner: <new QA session ID>. From now on follow docs/AGENT_PIPELINE.md: after a passing code review, send 'QA PR #<p> issue #<n>' to it instead of merging, and merge only on 'QA PASS'."

4. Open a PR that fills in the team B QA session ID in the team table in docs/AGENT_PIPELINE.md. Do not touch issue #49.

5. Remind me to set the mode to Auto in the new session, and to add QA_TEST_EMAIL and QA_TEST_PASSWORD (the QA test account) as environment variables of my cloud environment (environment menu in the session title bar → Edit → Environment variables), then tell me the session title.
```

After that, set the mode to **Auto** in "GymApp QA runner (team B)". Then add the QA test account as environment variables, so QA can log in. The owner gives you the email and password privately, never in a GitHub issue or PR.

## SOCIAL runner (Instagram)
Team B's account also runs a separate **SOCIAL runner** that manages Fuelift's Instagram by itself: the session "GymApp SOCIAL runner (Instagram)" and the scheduled task "GymApp SOCIAL daily (Instagram)". Its playbook is `docs/SOCIAL_RUNNER.md`, and every run is logged in issue #146. It skips its daily run when team B is building and usage is 50% or more.

To switch publishing on: create an Instagram Professional account for Fuelift, connect it to a Meta developer app with the Instagram API (Instagram Login), generate a long-lived access token with `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments` and `instagram_business_manage_insights`, and ask any session on this account to save it for `graph.instagram.com` through the secure credential form. Never paste it in chat. The runner detects it at its next run.


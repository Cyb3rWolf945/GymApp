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
   Give each this first prompt (fill in the role and the other runner's session ID): "You are the <ROLE> runner of TEAM B for the GymApp MVP. Your team's other runner is <OTHER_SESSION_ID>. Follow docs/AGENT_PIPELINE.md from origin/main for every job, including the Shift lock rules (issue #49). Only message sessions of team B. For now reply 'team B <role> ready' and stop."

3. Create two hourly scheduled tasks with create_trigger, each with persistent_session_id set to its runner:
   - "GymApp IMPLEMENTER watchdog (team B)", cron "15 * * * *"
   - "GymApp REVIEWER watchdog (team B)", cron "45 * * * *"
   Prompt for both: "Hourly watchdog: follow the 'Hourly watchdog' section of docs/AGENT_PIPELINE.md (from origin/main) as the <ROLE> runner of TEAM B, starting with the Shift lock rules. Keep it brief."

4. Open a PR that fills in the two team B session IDs in the table in docs/AGENT_PIPELINE.md. Do not touch issue #49 (the lock).

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

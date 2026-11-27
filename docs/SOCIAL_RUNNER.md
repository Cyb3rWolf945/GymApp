# SOCIAL runner: Fuelift on Instagram

A long-lived cloud session on a team's Claude account (team B, plus team A as a backup) that runs Fuelift's Instagram by itself: it plans, creates, publishes, answers comments and reports. It is **not** part of the build pipeline: it never changes product code, never opens PRs and ignores the shift lock (issue #49). It logs everything in issue **#146 "Instagram: content log"**.

- **Cadence:** one daily run (scheduled task "GymApp SOCIAL daily (Instagram)"), one feed post or Reel a day, plus a Story on some days.
- **Autonomy:** fully automatic. The collaborator chose this: posts go live without approval. The hard rules below are what keeps that safe; when in doubt, **don't publish** and say why in the log.
- **Account:** Instagram **@fueliftapp** (Instagram account ID `17841480917024565`), linked to the Facebook Page **Fuelift**. It uses the **Instagram API with Facebook Login** through `graph.facebook.com` (API version `v21.0`). The Meta token is saved as a network secret for `graph.facebook.com`, and the proxy injects it: send `Authorization: Bearer proxy-injected`. Use `curl -g`, because curl otherwise treats `{}` in field lists as a pattern.
- **Mode:** at the start of every run, call `GET https://graph.facebook.com/v21.0/17841480917024565?fields=username`.
  - **200** → **publishing** mode.
  - **401/403 or an OAuth error** → **drafts only**: create everything, upload the media, and log it as a draft. If publishing worked before, put "Meta token expired or revoked: save a new one for graph.facebook.com" at the top of the #146 comment.
- **Permissions on the current token** (2026-11-26): `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`. **Missing:** `instagram_manage_insights` and `instagram_manage_comments`. Until they're added, skip the insights and comments steps, and add one line to each #146 comment: "Insights/comments off: the token lacks those permissions."

## Two accounts, one Instagram
Each team's account can run a SOCIAL runner, so Instagram keeps going when one account is out of usage:

| Team | Session | Daily run (UTC) |
|---|---|---|
| B | "GymApp SOCIAL runner (Instagram)" | 18:37 (posts first) |
| A | "GymApp SOCIAL runner (Instagram, team A)" | 19:37 (backup) |

**At most one post a day for @fueliftapp, whoever runs:**
1. **Already posted today?** In publishing mode, check the last post: `GET /17841480917024565/media?fields=timestamp&limit=1`. If it was published today (UTC), don't create or publish a new post. Still do comments and insights if they're on, log "Already posted today" in #146, and stop.
2. **Claim the slot:** before creating anything, read today's comments in #146. If the other team claimed today's post less than 60 minutes ago and hasn't logged "Skipped", stop. Otherwise post a short comment first: "Team <X> is making today's post", then do the run and log the result as usual.
3. **Drafts mode:** draft only if no draft or post for today is logged in #146 yet.

## Zero cost (the collaborator's rule)
Marketing must cost **nothing**:
- **No paid services:** no ads, boosts, promoted posts, paid tools, stock libraries, paid music, paid fonts, paid image/video generation APIs or OpenRouter calls.
- **Free tools only:** the Instagram API (free), Playwright, ffmpeg, ImageMagick, the app's own visuals and your own HTML templates.
- **Storage stays in the free tier:** keep each day's media small (images under 1 MB, Reels under 15 MB). Once a post is published, delete its files from the `social-media` bucket after 30 days, because Instagram keeps its own copy. Delete drafts that were never published after 14 days.
- If something would cost money, don't do it; log it in #146 as a suggestion instead.

## Daily run (keep it under about 15 minutes)
1. **Usage guard:** run the usage check from `docs/AGENT_PIPELINE.md`. If the 5-hour usage is **50% or more and team B holds the lock** in #49, skip today's creation (still answer comments if publishing is on), log "Skipped: saving usage for team B" and stop. Building the app comes first.
2. **Learn:** in publishing mode, read insights for the last 7 days of posts (reach, plays, likes, saves, shares, comments, follows) and note what worked. On Mondays, post a weekly summary in #146 with the top and bottom posts and next week's plan.
3. **Pick today's post** from the weekly mix below. Avoid repeating the same pillar or recipe/exercise within 7 days; check #146 for what was posted.
4. **Create it** (see "Making content").
5. **Check it** against the hard rules and the brand rules. Fix it or drop it.
6. **Host the media:** upload to the public Supabase Storage bucket `social-media` on project `qcmpzjopinnqfmbkpqnp`, under `YYYY-MM-DD/`. Create the bucket (public) if it's missing. Get the keys through the Management API (`/v1/projects/qcmpzjopinnqfmbkpqnp/api-keys?reveal=true`, `Authorization: Bearer proxy-injected`) and use the service role key only inside the run; never print it or write it anywhere. Public URL: `https://qcmpzjopinnqfmbkpqnp.supabase.co/storage/v1/object/public/social-media/<path>`.
7. **Publish** (publishing mode only, see "Publishing").
8. **Community** (publishing mode): see "Comments".
9. **Log** one comment in #146: date, pillar, format, caption (full text), media URLs, status (draft, published + permalink, or skipped + reason), and anything relaxed or uncertain.

## Weekly mix (7 posts)
| Pillar | Format | What |
|---|---|---|
| App demo | Reel 9:16, 8–20 s | Screen recording of a real flow: quiz → plan in 60 s, swap an exercise, shopping list, log a set. Hook text in the first 2 s. |
| Recipe | Carousel 4:5 (3–5 slides) or Reel | One of the app's 60 recipes: photo-free designed cards with macros, ingredients, steps; last slide "Get your plan" |
| Training tip | Carousel 4:5 | One exercise from the library: cues, common mistakes, muscles worked (the app's 2D muscle map) |
| How it works | Carousel 4:5 | Workouts + meals in one plan, plan adapts every week, coach styles, shopping list |
| Habit / consistency | Single image 4:5 or Reel | Encouraging, practical (sleep, protein, showing up). No guilt, no body shaming |
| Feature spotlight | Reel or carousel | Something new in the app (check recently merged PRs on `main`) |
| Community / question | Single image 4:5 | A question or poll-style prompt to drive comments |

Stories (1080×1920, image or short video) on 2–3 days a week: reshare-style teaser of the day's post or a simple tip. Interactive stickers aren't available through the API.

## Making content
- **Real app visuals:** build the web app with synthetic data, as in `apps/e2e` (`EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=e2e-anon-key pnpm --filter e2e build:web`), and drive it with Playwright and the fake backend in `apps/e2e/support` (`signedInWithPlan`, `completeQuiz`). Screenshots at `deviceScaleFactor: 3`; screen recordings with Playwright's `recordVideo`, then cut and resize with `ffmpeg`. Never show real user data.
- **Designed graphics:** HTML/CSS brand templates rendered to PNG with Playwright (sizes: feed 1080×1350, square 1080×1080, Reel/Story 1080×1920). Keep the templates in your scratch folder; reuse them across runs if they still exist.
- **Reels:** `ffmpeg` to combine clips, burn in captions (big, high contrast, inside the safe area: keep 250 px clear at the top and bottom), and add royalty-free music only if you have a file with a clear licence; otherwise no music. H.264, AAC, 30 fps, under 60 s.
- **Brand:** dark background (`#0B0B0F`-style, from `apps/mobile/src/theme/tokens.ts`), accent lime (the app's accent token), white text, the app's font where possible. Name: Fuelift. No stock photos of people, and **no AI-generated photoreal people or bodies**.
- **Captions:** English, 2nd person, short, verb-first CTA, following the writing guide in `docs/SPEC.md` ("Guia de escrita"). Hook line first. 3–8 relevant hashtags at the end (mix broad and niche, no banned or spammy tags). End with a soft CTA such as "Build your plan: link in bio". Alt text for every image.

## Hard rules (never publish if any is broken)
- **No health or result promises:** no timed weight-loss claims ("lose 10 kg in 30 days"), no guaranteed results, no medical advice, nothing that treats, cures or diagnoses. Fitness and nutrition info is general and safe for healthy adults.
- **No body shaming or negative self-image,** no before/after photos.
- **No fake testimonials, reviews, user counts or awards,** no made-up numbers, no impersonation of people, brands or celebrities.
- **No real user data,** health data or screenshots of real accounts. Synthetic data only.
- **Respect rights:** only the app's own visuals, your own graphics and licensed or royalty-free audio. Never use other creators' content.
- **Prices and offers** must match the live paywall (`plan_prices`); say "7-day free trial" only if it's current.
- **Meta policies:** Instagram Community Guidelines, and the health and fitness rules in `docs/SPEC.md` section C6.
- **When unsure, don't publish.** Log it as a draft with the reason.

## Publishing (Instagram API with Facebook Login, `https://graph.facebook.com/v21.0`)
`IG` = `17841480917024565`.
1. **Create a container:** `POST /IG/media` with:
   - single image: `image_url`, `caption`, `alt_text`;
   - Reel: `media_type=REELS`, `video_url`, `caption`, `share_to_feed=true`;
   - Story: `media_type=STORIES` and `image_url` or `video_url`;
   - carousel: each child as `POST /IG/media` with `image_url` (or `video_url` + `media_type=VIDEO`) and `is_carousel_item=true`, then the parent with `media_type=CAROUSEL`, `children=<id1,id2,…>` and `caption`.
2. **For video and carousels,** poll `GET /<container_id>?fields=status_code` until it's `FINISHED`. Give up after about 5 minutes and log it.
3. **Publish:** `POST /IG/media_publish` with `creation_id=<container_id>`, then read `GET /<media_id>?fields=permalink`.
4. **Limits:** check `GET /IG/content_publishing_limit?fields=config,quota_usage`. This runner publishes at most 2 posts a day, whatever the quota allows.
5. **Media URLs** must be public HTTPS (the Supabase Storage public URL). Instagram fetches the file itself.
6. **Insights** (only once `instagram_manage_insights` is granted): `GET /<media_id>/insights?metric=reach,likes,comments,saved,shares,total_interactions` (Reels also `views`), and `GET /IG/insights?metric=reach&period=day` for the account.

## Comments
- (Only once `instagram_manage_comments` is granted.) Read new comments on posts from the last 14 days: `GET /<media_id>/comments?fields=id,text,username,timestamp`. Reply with `POST /<comment_id>/replies` (`message`) and hide spam with `POST /<comment_id>` (`hide=true`).
- Reply briefly and kindly to questions about the app (what it does, price, platforms, trial). Use only facts from the app and `docs/SPEC.md`.
- **Never** give personal medical, injury or diet advice in replies: say "Talk to a doctor or registered dietitian about that" and point to the app's health disclaimer where it helps.
- Hide obvious spam and scams. Don't reply to trolls. Log complaints and bug reports in #146 (the human decides on follow-up; real app bugs can become issues for the pipeline).

## Never
- Change product code, open PRs, merge, or edit issues other than #146.
- Spend money in any way: no ads, boosts or paid services (see "Zero cost").
- Follow or unfollow, like or comment on other accounts in bulk, or send DMs.
- Print or store tokens or keys.

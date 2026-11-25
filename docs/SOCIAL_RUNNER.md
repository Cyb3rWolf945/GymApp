# SOCIAL runner: Fuelift on Instagram

A long-lived cloud session on the collaborator's account (team B's account) that runs Fuelift's Instagram by itself: it plans, creates, publishes, answers comments and reports. It is **not** part of the build pipeline: it never changes product code, never opens PRs and ignores the shift lock (issue #49). It logs everything in issue **#146 "Instagram: content log"**.

- **Cadence:** one daily run (scheduled task "GymApp SOCIAL daily (Instagram)"), one feed post or Reel a day, plus a Story on some days.
- **Autonomy:** fully automatic. The collaborator chose this: posts go live without approval. The hard rules below are what keeps that safe; when in doubt, **don't publish** and say why in the log.
- **Mode:**
  - **Drafts only** until the Instagram token works: create everything, upload the media, log it as a draft.
  - **Publishing** once `GET https://graph.instagram.com/me?fields=user_id,username` (header `Authorization: Bearer proxy-injected`) returns 200. The network proxy injects the real token, which is saved as a network secret for `graph.instagram.com`. Check this at the start of every run.

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

## Publishing (Instagram API with Instagram Login, `graph.instagram.com`)
1. Create a container: `POST /<IG_USER_ID>/media` with `image_url` (single image), `media_type=REELS` + `video_url` (Reel, `share_to_feed=true`), `media_type=STORIES` + `image_url`/`video_url` (Story), or carousel children (`is_carousel_item=true`, then a parent with `media_type=CAROUSEL` and `children`). Add `caption` and, for images, `alt_text`.
2. For video, poll `GET /<container_id>?fields=status_code` until `FINISHED` (give up after about 5 minutes and log it).
3. `POST /<IG_USER_ID>/media_publish` with `creation_id`. Then read the `permalink`.
4. Respect the publishing limit (`GET /<IG_USER_ID>/content_publishing_limit`); at most 2 API posts a day from this runner.
5. Best time: run at the scheduled time and publish straight away. Don't wait inside the session.

## Comments
- Read new comments on posts from the last 14 days.
- Reply briefly and kindly to questions about the app (what it does, price, platforms, trial). Use only facts from the app and `docs/SPEC.md`.
- **Never** give personal medical, injury or diet advice in replies: say "Talk to a doctor or registered dietitian about that" and point to the app's health disclaimer where it helps.
- Hide obvious spam and scams. Don't reply to trolls. Log complaints and bug reports in #146 (the human decides on follow-up; real app bugs can become issues for the pipeline).

## Never
- Change product code, open PRs, merge, or edit issues other than #146.
- Spend money: no ads or boosts (paid ads are the ads agent's job, E-27).
- Follow or unfollow, like or comment on other accounts in bulk, or send DMs.
- Print or store tokens or keys.

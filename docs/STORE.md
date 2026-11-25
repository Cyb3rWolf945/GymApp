# App Store and Google Play: builds, assets and submission

What is ready in the repo, what you (the owner) must do, and the answers drafted for the privacy forms. Agents cannot
create or use store accounts, so nothing here has been submitted.

## 1. What is ready

| | Where | Command |
|---|---|---|
| EAS build profiles (`development`, `preview`, `production`; iOS and Android) | `apps/mobile/eas.json` | `eas build --profile production --platform all` |
| App config: icon, adaptive icon, splash, no Android permissions, export compliance flag | `apps/mobile/app.json` | |
| Placeholder icons (SVG source, PNG output) | `apps/mobile/assets/` | `pnpm --filter e2e icons` |
| Listing text (name, subtitle, keywords, descriptions) with the stores' limits tested | `packages/shared/src/store/listing.ts` | `pnpm tsx scripts/print-listing.ts` |
| Automated screenshots at store sizes | `apps/e2e/store/` | `pnpm --filter e2e build:web && pnpm --filter e2e screenshots` |
| Privacy label drafts | section 4 below | |

## 2. Build (Owner: Expo account)

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init                      # creates the EAS project and writes extra.eas.projectId into app.json: commit it
# Public config baked into the app (EXPO_PUBLIC_* values are not secret):
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
npx eas-cli build --profile production --platform ios       # asks you to sign in to your Apple Developer account
npx eas-cli build --profile production --platform android   # EAS generates and stores the upload keystore
```

- Replace the placeholder bundle id and package `app.fuelift.mobile` in `app.json` with yours **before the first build**:
  store identifiers cannot be changed afterwards.
- Versions: `appVersionSource: remote` and `autoIncrement` give each production build a new build number. Raise
  `version` in `app.json` for each release.
- `development` and `preview` build installable test apps (iOS simulator, Android APK); `production` builds the store
  files (an App Store build and an Android App Bundle).
- There is no over-the-air update channel yet (`expo-updates` is not installed): every change needs a new build.

## 3. Assets and listing

- **Icon:** the one in the repo is a placeholder (a lime "F" on the dark brand colour). Replace the SVGs in
  `apps/mobile/assets/src/` or the PNGs with the designer's logo: icon 1024 x 1024 without transparency, adaptive
  icon foreground with the mark inside the central 66%.
- **Screenshots:** `pnpm --filter e2e screenshots` writes six per device to `apps/e2e/store/screenshots/<device>/`
  (today, plan, meals, recipe, shopping list, progress), all with synthetic data:
  `ios-6.9in` 1320 x 2868, `ios-6.5in` 1284 x 2778, `android-phone` 1080 x 1920. They are renders of the web build, so
  fonts and safe areas can differ slightly from the native app. Replace them with simulator screenshots before
  submitting if you want them pixel-exact. Apple also asks for iPad screenshots only if the app supports iPad (it does not:
  `supportsTablet` is false).
- **Google Play:** also needs a 512 x 512 icon and a 1024 x 500 feature graphic (not generated).
- **Text:** `pnpm tsx scripts/print-listing.ts` prints every field with its character count. Keywords: "AI workout
  planner", "meal plan" and "macro" are in the App Store keyword field. Category: Health & Fitness (secondary Food & Drink).
  Suggested age rating 12+.

## 4. Privacy forms (drafts, check them against the final build)

Based on what the code collects today. **Owner:** confirm with whoever signs the legal text.

### Apple: App Privacy ("nutrition labels")

| Data type | Collected | Linked to the user | Used to track | Purposes |
|---|---|---|---|---|
| Contact info: email address | Yes | Yes | No | App functionality (account, sign-in) |
| Health & fitness: health (height, weight, age, sex, injuries, allergies, diet) | Yes | Yes | No | App functionality, personalisation |
| Health & fitness: fitness (workouts, sets, records) | Yes | Yes | No | App functionality, personalisation |
| Identifiers: user id | Yes | Yes | No | App functionality, analytics |
| Usage data: product interaction (onboarding steps, paywall views) | Yes | Yes | No | Analytics |
| Purchases: subscription tier and status | Yes | Yes | No | App functionality |
| User content: short free-text notes (max 280 characters) | Yes | Yes | No | App functionality, personalisation |

- **Tracking:** the iOS and Android apps do not track (no advertising id, no App Tracking Transparency prompt). The Meta
  Pixel and Conversions API run on the **web** only, after the visitor accepts the cookie banner. Answer "Data Not Used to Track You".
- **Not collected:** location, contacts, photos, browsing history, crash or performance data (no crash reporter yet).
- Sign in with Apple is offered, as Apple requires when other social sign-in (Google) exists.

### Google Play: Data safety

| Section | Answer |
|---|---|
| Data collected | Personal info (email, user id); Health and fitness (health info, fitness info); App activity (app interactions); Financial info (purchase history: tier and status only, no card data) |
| Data shared | None shared with third parties for their own use. Service providers that process data for us: Supabase (database and auth), Stripe (payments), OpenRouter and its model providers (plan generation). The plan generation request holds goal, body measurements, diet, allergens, injuries and notes that passed the guardrail filter, never name or email |
| Encrypted in transit | Yes |
| Users can ask for deletion | Yes: Settings, Delete account (deletes all data and cancels the subscription), and data export |
| Optional data | Notification reminders and tracking consent are optional |

- Google also asks for a **web link where users can request account deletion**. The in-app flow exists; you need a public
  page that explains it (for example a section of the privacy policy at `https://<domain>/legal/privacy`) and a support email.

## 5. Submission checklist (what only you can provide)

- [ ] Apple Developer Program account; app record in App Store Connect (get the numeric id for `eas.json` `ascAppId`)
- [ ] Google Play Console account; app record; a service account key with release permission saved as `apps/mobile/google-play-service-account.json` (git-ignored: never commit it)
- [ ] Your real bundle id and package name in `app.json` (section 2)
- [ ] Sign-in providers: Apple (Services id and key) and Google OAuth client ids configured in Supabase Auth
- [ ] Public URLs: privacy policy `https://<domain>/legal/privacy`, terms, support page and email, marketing page
- [ ] Lawyer-approved legal text (`packages/shared/src/legal/docs.ts`) and the company details filled in
- [ ] Final icon, screenshots, Google feature graphic
- [ ] Privacy forms answered (section 4), age rating questionnaire, content rights, export compliance (already declared: no non-exempt encryption)
- [ ] **A way for the reviewers to sign in** (see risk 2)
- [ ] `eas build` for both platforms, test the builds on real devices, then `eas submit --profile production --platform ios|android`
- [ ] Review notes: the app gives general guidance and is not medical advice (the disclaimer is in onboarding and Settings)

## 6. Risks to decide before you submit

1. **Apple in-app purchase rule (guideline 3.1.1).** The plan is "no IAP in MVP": subscriptions are bought on the web and
   the app only signs in. Apple generally requires in-app purchase for digital subscriptions, and may reject an app that
   points to outside payment (rules differ by country; the US and EU allow external purchase links under conditions). The
   native paywall currently tells users to subscribe on the website, which is exactly what can get flagged. Options: add
   StoreKit and Google Play Billing (largest change), keep the native app free of any purchase wording and pricing, or
   check the current external-link rules for your target countries. This needs your decision.
2. **Reviewers cannot open a magic link.** Sign-in is by email link, Google or Apple. Apple and Google both need test
   credentials. Create a review account (for example an email with a fixed one-time code in Supabase Auth, or a
   password account) and put it in the review notes.
3. **Health claims.** Keep the listing as it is (no medical claims, no guaranteed results). The tests guard the listing text.
4. **Android target API and 64-bit** are handled by the current Expo SDK; re-check Google's requirement at submission time.

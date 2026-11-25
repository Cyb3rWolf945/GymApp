# Visual identity v2 (issue #138, item 1)

What changed in the look, and why. Tokens live in `apps/mobile/src/theme/tokens.ts`; components in `apps/mobile/src/ui`.
The screenshots in `before/` and `after/` (phone 390x844 and desktop 1440x900, deviceScaleFactor 2, dark) come from
`apps/e2e/screenshots/tour.spec.ts`: `SHOTS_DIR=/tmp/shots/after npx playwright test -c playwright.shots.config.ts` in `apps/e2e`
(build the web export first, see the PR description). Re-run it for any later design PR to get comparable shots.

## Colour
- **Brand**: neon lime `#C6FF3D` stays (deep green `#3F6212` in light, so it still reads as text on white).
- **Secondary accent**: electric violet (`accent2`, `#9A8CFF` dark, `#5B45E8` light). Used for the glow behind screen headers and for charts and highlights next to the brand colour. It is never a second "primary" button colour.
- **Surfaces**: a slightly cooler, deeper dark (`#0A0B10` page, `#14161D` card, `#1D202A` raised); light is `#F5F6FA` / `#FFFFFF` / `#ECEEF4`.
- **Gradients** (`palette.gradient`): `brand` (lime to mint) fills progress bars; `glow` (violet fading into the page) sits behind the top of every screen; `card` is a hair lighter at the top. Decoration only: text never sits on a gradient edge.
- Every text pair is WCAG AA in both schemes (unit tests in `theme.test.ts`); the brand gradient stops are at least 3:1 against the page.

## Type
- **Space Grotesk** (display, titles, headings: it has character and makes numbers look good) and **Inter** (body, buttons, captions).
- Scale: 12, 14, 16, 20, 24, 34 px; line heights on a 4-pt grid; tight tracking on display sizes.
- One font file per weight (a family name per weight, so no `fontWeight` in the tokens). Fonts load once at the root before the first screen; on the web a missing font falls back to a system sans, never to the browser's serif.

## Space, shape, depth
- **8-pt grid**: spacing is 4 (half step), 8, 12 (the in-between for list rows), 16, 24, 32, 48, 64. Everything except 4 and 12 is a multiple of 8 (tested).
- **Radius**: 8, 12, 16, 24, pill.
- **Elevation** (`elevations`, `theme.elevation`): `none`, `low` (cards), `mid` (raised cards), `high` (dialogs): soft `boxShadow`s, lighter in the light scheme.
- Tap targets stay at least 48 px.

## Icons
Ionicons through `<Icon />` (`src/ui/Icon.tsx`): outline when idle, filled when active, decorative by default (the label names the thing, so screen readers skip the glyph). The five tabs now carry icons.

## Illustration and imagery (the style to follow, applied in the "empty, error and loading states" item)
Flat, geometric shapes in the surface colours, one lime or violet highlight per picture, rounded ends, no outlines thicker than the icon stroke, no photos of people. Food photography (the Nutrition item) is the one place for real images: bright, top-down, dark background, one plate per photo.

## Components touched
`Card` (elevation, `raised`), `Button` (soft brand glow under the primary button in dark), `ProgressBar` (gradient fill, 8 px), `Screen` (header glow), `Text` (new families, `accent2` tone), tab bar and side rail (icons).

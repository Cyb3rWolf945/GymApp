# Design tokens

Generated from `apps/mobile/src/theme/tokens.ts` (the single source: no colour literals exist in `app/` or `src/`, a unit test fails on them). Dark is the default look; light keeps the neon identity and adds structure (grey page, white cards with a shadow, outlines at 3:1).

Rules of thumb:
- **Fill** (button, selected, progress): `accent` with `onAccent` on it.
- **Text, links, icons on a surface**: `accentText` (`Text tone="accent"` and `Icon tone="accent"` already use it).
- **Selected card or chip outline**: `accentBorder` over `accentSubtle`.
- **Charts and graphics**: `chart[0..4]`; **body map**: `heat`.
- **Controls** outline with `border`; **separators** with `divider`; **keyboard focus** with `focusRing`.
- Brand marks (the Fuelift logo and the sign-in providers' official marks) are fixed in `brandAssets`, outside the theme.

| Token | Use | Dark | Light |
|---|---|---|---|
| `background` | The page behind everything (a soft cool grey in light). | `#0A0B10` | `#E9ECF2` |
| `surface` | Cards, sheets, the tab bar (white in light). | `#14161D` | `#FFFFFF` |
| `surfaceAlt` | Raised cards, chips and inputs at rest, the secondary button. | `#1D202A` | `#F1F3F8` |
| `border` | Outlines of controls (inputs, chips, toggles). Light: at least 3:1 on the page and cards. | `#2A2E3C` | `#7B8195` |
| `divider` | Non-interactive separators: list rows, card edges, chart grid. | `#2A2E3C` | `#DCE0E9` |
| `text` | Body text and headings. | `#F5F6FA` | `#0B0D14` |
| `muted` | Secondary text. | `#A6AABC` | `#4F5468` |
| `accent` | Brand fill: primary button, selected chip, progress, slider. Neon lime in both themes. Not for text on a surface. | `#C6FF3D` | `#B8F230` |
| `onAccent` | Text and icons on `accent` (7:1 or better). | `#0A0B10` | `#0B0D14` |
| `accentText` | Brand colour as text, links and icons on a surface (the same lime in dark, a deep green in light). | `#C6FF3D` | `#3F6212` |
| `accentSubtle` | Tinted background of a selected card or state. | `#293221` | `#EEF9D0` |
| `accentBorder` | Outline of a selected card, chip or state (3:1 on the page and cards). | `#C6FF3D` | `#5E8F0A` |
| `accentGlow` | The halo under the main button. | `rgba(198,255,61,0.22)` | `rgba(184,242,48,0.4)` |
| `accent2` | Secondary accent (violet): highlights next to the brand colour, never a second primary. | `#9A8CFF` | `#5B45E8` |
| `onAccent2` | Text on `accent2`. | `#0A0B10` | `#FFFFFF` |
| `danger` | Errors and destructive actions (text 4.5:1 on every surface). | `#FF7A7A` | `#B91C1C` |
| `onDanger` | Text on a `danger` fill. | `#0A0B10` | `#FFFFFF` |
| `success` | Success text and marks. | `#4ADE80` | `#166534` |
| `onSuccess` | Text on a `success` fill. | `#0A0B10` | `#FFFFFF` |
| `warning` | Warnings. | `#FFB74D` | `#92400E` |
| `onWarning` | Text on a `warning` fill. | `#0A0B10` | `#FFFFFF` |
| `info` | Neutral information. | `#7CB8FF` | `#1D4ED8` |
| `onInfo` | Text on an `info` fill. | `#0A0B10` | `#FFFFFF` |
| `focusRing` | Keyboard focus outline (3:1 on the page and cards). | `#C6FF3D` | `#3F6212` |
| `overlay` | The dim layer behind sheets and dialogs. | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.4)` |
| `skeleton` | Loading blocks: `base` at rest and the `highlight` that sweeps over it. | `{base:#1D202A,highlight:#2A2E3C}` | `{base:#E3E7EF,highlight:#F4F6FA}` |
| `shadow` | Shadow colour and opacity per level (`sm`, `md`, `lg`). | `{color:#000000,sm:0.3,md:0.4,lg:0.5}` | `{color:#0B0D14,sm:0.08,md:0.12,lg:0.18}` |
| `chart` | Five chart series colours, 3:1 on a card; the first is the brand. | `[#C6FF3D,#9A8CFF,#5BE3B0,#FFB74D,#FF7A7A]` | `[#4D7C0F,#5B45E8,#0F766E,#B45309,#B91C1C]` |
| `heat` | Body map ramp from "not trained" to "very high volume", ordered by brightness. | `[#2B2E3B,#75923B,#92B93C,#AFE03C,#FF8A3D]` | `[#DCE0E9,#C9E586,#A4D12F,#5F9A14,#C2410C]` |
| `gradient` | Two-stop gradients: `brand` (lime to mint), `card`, `glow`. Decoration only. | `{brand:[#C6FF3D,#5BE3B0],card:[#1B1E28,#14161D],glow:[rgba(154,140,255,0.22),rgba(10,11,16,0)]}` | `{brand:[#B8F230,#5BE3B0],card:[#FFFFFF,#F7F8FC],glow:[rgba(91,69,232,0.12),rgba(233,236,242,0)]}` |

_Contrast is enforced by `src/theme/theme.test.ts` for both schemes._

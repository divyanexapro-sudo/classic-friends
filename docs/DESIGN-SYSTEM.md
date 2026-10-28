# Classic Friends design system

The idea: **one bold gradient, everything else quiet glass.** The "Sunset Vibe" gradient is reserved for voice and action — the speaking ring, the create button, the gift button, primary CTAs. Surfaces are translucent plum over a deep violet night so the people and the gifts are what glow.

All tokens live in `app/css/tokens.css` (app, admin) and the `:root` block of `website/css/site.css` (website).

## Colour

| Token | Hex | Used for |
|---|---|---|
| `--midnight` | `#0F0B2A` | App background (deep violet-black, deliberately not grey) |
| `--plum` / `--plum-2` | `#1E1540` / `#2A1E55` | Raised surfaces, sheets, nav |
| `--violet` | `#8B5CF6` | Primary, selected states, links |
| `--magenta` | `#F043A6` | Accent, gifts, badges counts |
| `--amber` | `#FFB547` | Coins, VIP, gold |
| `--aqua` | `#2DD4BF` | Live, online, speaking rings, "on mic" |
| `--rose` | `#FF6B8A` | Likes, hearts, CP |
| `--danger` / `--success` | `#FF5D5D` / `#34D399` | Errors, confirmations |

Gradients: `--g-vibe` (violet → magenta → amber, 135°), `--g-gold`, `--g-aqua`, `--g-rose`, `--g-violet`.
Glass: `--glass` 6 % white, `--glass-2` 10 %, `--glass-3` 16 %; lines 10 % / 18 %.
Text: `--text #F7F5FF`, `--text-2 #C9C2E6`, `--text-3 #8E86B3`.

**Light theme** (`html[data-theme="light"]`): background `#F6F3FF`, surfaces white, text `#1A1333`. Rooms stay dark in both themes — a voice room is a night-time space.

**Level badge tiers:** 1–9 green · 10–19 blue · 20–29 violet · 30–39 pink · 40–49 orange · 50–69 gold · 70+ rainbow (`--lv-*`).

The website uses the same palette on a light lilac page so the dark phone mockups pop; the gifts band and the download band flip to midnight.

## Type

* **Bricolage Grotesque** — display: screen titles, room titles, big numbers, headlines. Weight 700/800, tracking −0.02em.
* **Plus Jakarta Sans** — everything else. 400–800.
* Both are self-hosted in `app/assets/fonts/` (SIL OFL) so the app works offline and loads fast in India and the Gulf.
* Scale (`--fs-*`): 11 · 12 · 13 · 15 · 17 · 20 · 24 · 30 · 38 px. Body line-height 1.45, display 1.15. Counts use tabular numerals.

## Shape & space

* Radii hierarchy: sheets 28 · cards 20 · buttons 14 · chips/pills full · people always circles.
* Spacing on a 4-pt grid (`--s-1` 4 → `--s-9` 56).
* App column max 480 px, centred on desktop with a soft glow behind it.
* Bottom nav 64 px with the raised gradient mic button in the centre.
* Minimum touch target 40 px; primary actions live in the bottom third of the screen.

## Motion

* Motion answers an action: sheets slide up (420 ms, ease-out), gifts fly to the seat, reactions float, entry banners cross the top. Nothing animates on page load except the splash.
* Speaking ring: two ripples (`ripple` 1.1 s) plus a glow in the user's mic-wave colour.
* Gift tiers: 1 seat pop · 2 banner + fly-in · 3 full-screen bounce + particles · 4 adds a background flash and haptics.
* `prefers-reduced-motion` turns all of it off.

## Components (app/css/components.css)

`.btn` (primary / gold / aqua / ghost / danger, sizes sm/xs) · `.icon-btn` · `.chip` / `.tabs` / `.seg` · `.card` · `.list-row` · `.menu-grid` · `.settings-row` · `.avatar` (xs → xxl, `.frame` conic ring, `.online` dot) · `.lv` `.vip` `.fam` `.host-tag` `.admin-tag` `.pill.live` `.coin` `.diamond` · `.input` `.switch` `.stepper` · `.sheet` `.modal` `.toast` · `.msg` chat bubbles (+ `data-bubble` skins) · `.gift-tile` · `.progress` · `.empty`.

Room-specific pieces (seats, chat, bars, effects) are in `app/css/screens.css` under `/* room */`.

## Avatars & covers

`shared/avatar.js` draws every avatar as an SVG from a seed string: 12 background gradients × 6 skin tones × 8 hairstyles (incl. hijab, cap, bun, curly) × accessories (glasses, headphones, earrings, mic) × expressions. Room covers are layered radial gradients from a seed, with the topic emoji on top. No image files, no CDN, instantly consistent across app, website and admin.

## Logo

`assets/logo.svg`: a rounded tile in the Sunset Vibe gradient holding a white speech bubble with three voice bars. Use the lowercase wordmark **Classic Friends** in Bricolage Grotesque 800 next to it. Keep the tile on dark or light; never stretch it.

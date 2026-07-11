# Underdeck — App Shell Specification (area: app-shell)

Source of truth for re-implementing the Flutter app "Underdeck" (companion app for the game
Underpunks55 / "UP55") as a Vite + React + TypeScript web app. This document covers the
**application shell**: entry point, routing table, bottom navigation, boot/splash sequence,
onboarding flow, the Menu tab and all of its sub-pages (Settings, About, FAQ, Disclaimer,
Contact), global error handling, the network layer, and the shared `core/` utilities.

Flutter source files covered:

- `lib/main.dart`
- `lib/app/app.dart`, `lib/app/app_shell.dart`, `lib/app/router.dart`, `lib/app/theme.dart`
- `lib/features/boot/` (boot_screen.dart, widgets/boot_emblem.dart, widgets/hexagon_shape.dart, widgets/scan_beam.dart)
- `lib/features/onboarding/onboarding_view.dart`
- `lib/features/menu/views/` (menu_view.dart, settings_view.dart, about_view.dart, faq_view.dart, disclaimer_view.dart, contact_view.dart)
- `lib/core/` (app_constants.dart, app_version.dart, error_text.dart, external_link.dart, internal_link.dart, logging.dart, relative_date.dart, network/app_dio.dart, platform/*)

Referenced but owned by other spec areas (summarized here only as needed):
`lib/design_system/` (colors, typography, spacing, GlassCard, NeonButton, SectionHeader,
TransmissionHeader, BannerPage, PageScrollView, AppBackground, BootTerminalText, TagChip),
`lib/services/` (app_settings, haptics, notifications, data_export, backup_controller,
share_card), and every feature view the router points at (tools, captures, hangar, knowledge,
search).

---

## 1. Global design tokens (used throughout this area)

The whole app is **dark-theme only** (Material 3 dark base). There is no light theme.

### 1.1 Colors (`lib/design_system/colors.dart`)

| Token | Hex / value | Usage |
|---|---|---|
| `bgDeepest` | `#03060B` | Scaffold/page background, bottom nav backdrop, text on neon buttons |
| `bgElevated` | `#0A1220` | Dialog background |
| `bgGlass` | `#0F1C30` at 55% alpha (`rgba(15,28,48,0.55)`) | Translucent card/action-row fill |
| `bgCard` | `#111E30` (opaque) | Default GlassCard fill (no blur) |
| `accentPrimary` | `#4FC3FF` | Primary cyan accent (icons, borders, glows, links) |
| `accentSecondary` | `#7AE3FF` | Lighter cyan (mono sub-labels, gradients) |
| `accentDanger` | `#FF5577` | Errors, destructive actions |
| `accentWarn` | `#FFB347` | Warnings, danger-button gradient end |
| `accentSuccess` | `#5FE8A0` | Success, live "pulsing dot", checkmark bullets |
| `textPrimary` | `#E8F4FF` | Main text |
| `textSecondary` | `#8AA4C2` | Secondary text, captions, inactive tab tint |
| `textDim` | `#6E8AAB` | Dim informational text (WCAG-AA tuned vs bgCard) |
| `borderSubtle` | `#7AE3FF` at 12% alpha | 1px card/hairline borders |
| `borderGlow` | `#4FC3FF` at 45% alpha | Accent borders (neon button, onboarding icon box) |

### 1.2 Typography (`lib/design_system/typography.dart`)

Fonts are **bundled** (never fetched from Google Fonts at runtime — privacy + offline first
paint). Variable TTFs; weight axis interpolated from font-weight:

- `Inter` ("fontSans") — asset `assets/fonts/Inter-Variable.ttf`
- `JetBrainsMono` ("fontMono") — asset `assets/fonts/JetBrainsMono-Variable.ttf`
- `Quicksand` ("fontRounded", weight axis maxes at 700) — asset `assets/fonts/Quicksand-Variable.ttf`

OFL license texts bundled at `assets/fonts/Inter-OFL.txt`, `assets/fonts/JetBrainsMono-OFL.txt`,
`assets/fonts/Quicksand-OFL.txt` and registered in the license registry at startup (web: link
to the OFL texts on an about/licenses page or ship them alongside).

Named styles (all `color` defaults listed; views override freely):

| Style | Family | Size | Weight | Extra | Color |
|---|---|---|---|---|---|
| `display` | Quicksand | 34 | 600 | line-height 1.1 | textPrimary |
| `title` | Inter | 22 | 600 | — | textPrimary |
| `headline` | Inter | 17 | 600 | — | textPrimary |
| `body` | Inter | 15 | 400 | — | textPrimary |
| `caption` | Inter | 12 | 500 | — | textSecondary |
| `mono` | JetBrainsMono | 14 | 400 | — | textPrimary |
| `terminal` | JetBrainsMono | 13 | 500 | — | accentPrimary |

### 1.3 Spacing & radii (`lib/design_system/spacing.dart`)

`AppSpacing`: xxs=2, xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48 (logical px).
`AppRadius`: sm=8, md=14, lg=22.

### 1.4 Material theme (`lib/app/theme.dart`)

`ThemeData.dark(useMaterial3: true)` copied with:

- `scaffoldBackgroundColor: #03060B`
- colorScheme: `surface=#03060B`, `primary=#4FC3FF`, `secondary=#7AE3FF`, `error=#FF5577`, `onSurface=#E8F4FF`
- textTheme mapping: displayLarge→`display`; displayMedium/titleLarge→`title`; titleMedium→`headline`; bodyLarge/bodyMedium→`body`; labelMedium/labelSmall→`caption`
- default icon color `#E8F4FF`
- ink splash color `#4FC3FF` @ 8% alpha; highlight `#4FC3FF` @ 4% alpha

Web equivalent: a CSS variables file + base styles; no theme switching needed.

### 1.5 Shared components referenced in this area (full spec in design-system area)

- **GlassCard** — rounded (radius 14 default) container: fill `bgCard` `#111E30`, 1px border
  `borderSubtle`, padding 12 default. Optional `glow` adds outer box-shadow
  `#4FC3FF@0.18, blur 14`. Optional `blur` adds backdrop-blur(18px) (rarely used).
- **NeonButton** — pressable pill (min-height 50, radius 14): horizontal gradient
  `accentPrimary→accentSecondary` (danger variant: `accentDanger→accentWarn`), 1px border
  `borderGlow`, glow shadow tint@0.45 blur 14; content row = optional icon (18px, color
  `bgDeepest`) + label (Inter 16 / 600, color `bgDeepest`). Press animation: scale 0.97, 200ms
  ease-out. Disabled: whole button at 40% opacity, no pointer. Fires a light haptic on tap.
- **SectionHeader** — optional 18px `accentPrimary` icon + title rendered UPPERCASE in
  JetBrainsMono 12 / 600 / letter-spacing 2 / `accentPrimary`; optional caption subtitle below.
- **TransmissionHeader** ("ESSI banner") — fully opaque `bgDeepest` bar with a 1px
  `borderSubtle` bottom hairline. Left: pulsing green dot (`accentSuccess`) + the label
  UPPERCASED in JetBrainsMono 10 / 600 / letter-spacing 2 / `accentPrimary` (ellipsis
  overflow). Right: scroll-driven "sector code" text `ESSI//NNN` in JetBrainsMono
  10 / 500 / `textDim`, then optional trailing action icon buttons.
  Sector code algorithm: per-header random seed `seed = randomInt(0..899)` fixed on mount;
  `value = 100 + ((seed + floor(abs(scrollOffsetPx) / 4)) % 900)` → renders `ESSI//<value>`
  (changes every 4px of scroll). Pure cosmetics — explicitly *not* location data.
- **BannerPage** — layout for main shell pages: SafeArea(top), TransmissionHeader pinned at
  top, page body (scrollable) filling the rest. Owns the ScrollController so the banner sector
  code reacts to scroll. Content scrolls *between* the banner and the bottom nav (both opaque).
- **PageScrollView** — scroll wrapper broadcasting scroll offset; shows a floating
  "back to top" button (44×44 circle, `bgDeepest` fill, 1px border `#4FC3FF@0.6`, glow shadow
  `#4FC3FF@0.4` blur 10, `arrow_upward` icon 22 `accentPrimary`) at bottom-right (16px insets)
  once scrolled past one viewport height; appears/disappears with a 200ms scale+fade; clicking
  it animates scroll to top over 300ms ease-in-out and fires a tap haptic.
- **AppBackground** — full-bleed page backdrop: solid `#03060B`; radial gradient from top-left
  (center (-1,-1), radius 1.2) `#4FC3FF@0.10 → transparent`; a hex-grid pattern overlay at 6%
  opacity; optional floating "cyber particles" layer (boot only); CRT scanlines overlay at 55%
  opacity on top of content. Tapping anywhere on it removes input focus (dismisses keyboard).
- **TagChip** — pill chip (padding 10×5, radius 20). Unselected: text/icon `accentPrimary`,
  fill `accentPrimary@0.15`, 1px border `accentPrimary@0.4`. Selected: text `bgDeepest`, fill
  `accentPrimary`, no border. Label 12 / 500. Fires selection haptic on tap.

---

## 2. Entry point & global bootstrapping (`lib/main.dart`)

Order of operations on launch:

1. Everything runs inside a guarded zone (`runZonedGuarded`); any uncaught async error is sent
   to `logError` (see §13).
2. `FlutterError.onError` and `PlatformDispatcher.onError` are both routed to `logError` so
   framework/platform errors are never silently swallowed. **Web equivalent:**
   `window.onerror` + `window.onunhandledrejection` → the shared logger.
3. Font licenses (SIL OFL for Inter, JetBrainsMono, Quicksand) are registered in the license
   registry, loaded from `assets/fonts/<Family>-OFL.txt`. **Web:** optional; keep the OFL files
   available and referenced from About/licenses.
4. Orientation locked to portrait (`portraitUp` only). **Web: drop** (design is a single
   phone-width column; consider a max-width container instead).
5. System chrome: transparent status bar with light icons; system navigation bar colored
   `#03060B` with light icons. **Web equivalent:** `<meta name="theme-color" content="#03060B">`.
6. Local notification plugin initialized inside try/catch — a failure is logged and boot
   continues (must never leave a blank screen). **Web:** notifications are a separate feature
   area; from the shell's point of view, just keep failures non-fatal.
7. `SharedPreferences` instance loaded, injected into the Riverpod `ProviderScope` via
   `sharedPreferencesProvider.overrideWithValue(prefs)`. **Web:** `localStorage` behind the same
   settings store abstraction.
8. `runApp(UnderdeckApp)`.

### 2.1 Root widget (`lib/app/app.dart`)

`UnderdeckApp` = `MaterialApp.router` with:

- `title: 'Underdeck'` (browser tab title)
- no debug banner
- theme from §1.4
- the go_router from §3.

It also keeps `autoBackupControllerProvider` watched for the whole session, which is what makes
the opt-in auto-backup listen to DB write batches (see data/services area). The shell only
needs to instantiate that controller once, app-wide, at the root. (On web the Documents
auto-backup feature is **hidden/unsupported** — see §16.)

---

## 3. Routing (`lib/app/router.dart`)

Router: `go_router` with `initialLocation: '/boot'` and a `StatefulShellRoute.indexedStack`
for the 5 bottom tabs. Each tab branch keeps **its own navigation stack** and its own scroll
state; switching tabs preserves the sub-route you were on. Re-tapping the *current* tab resets
that branch to its initial location (pops to the tab root).

**Web equivalent:** React Router (or TanStack Router) with a layout route rendering the tab bar
and 5 nested route trees; preserve per-tab history if feasible (at minimum, restore the tab
root on re-click of the active tab).

### 3.1 Complete route map

| Path | View | Notes |
|---|---|---|
| `/boot` | `BootScreen` | Initial location. On complete → `/tools` if `onboardingSeen`, else `/onboarding` (replace, not push). |
| `/onboarding` | `OnboardingView` | First-run intro; also pushed from Settings ("Replay intro"). |
| **Tab 0 — Tools** (branch root `/tools`) | | |
| `/tools` | `ToolsHomeView` | Tools deck home. |
| `/tools/scan` | `SystemScanView` | |
| `/tools/asteroid` | `AsteroidAnalyzerView` | |
| `/tools/wallet` | `WalletLookupView(initialQuery: ?q)` | Query param `q` (from global search) pre-seeds the lookup. |
| `/tools/mars-express` | `MarsExpressView` | |
| `/tools/fishing` | `FishingMapView` | |
| `/tools/fishing/:roomId` | `FishingRoomView(roomId)` | |
| `/tools/tracker` | `TrackerView(prefill)` | `prefill` passed as in-memory navigation state (`extra` of type `TrackTarget`), NOT in the URL. Web: pass via router `state`/location state; absent state → no prefill. |
| `/tools/discoveries` | `CelestialView` | |
| `/tools/jobs` | `JobsView` | |
| **Tab 1 — Notes/Captures** (branch root `/captures`) | | |
| `/captures` | `CapturesHomeView` | |
| `/captures/note/:id` | `NoteDetailView(noteId)` | |
| `/captures/link/:id` | `LinkDetailView(linkId)` | |
| **Tab 2 — Hangar** (branch root `/hangar`) | | |
| `/hangar` | `HangarListView` | |
| **Tab 3 — Knowledge** (branch root `/knowledge`) | | |
| `/knowledge` | `KBHomeView` | |
| `/knowledge/category/:id` | `KBCategoryView(categoryId)` | |
| `/knowledge/article/:slug` | `KBArticleView(slug)` | |
| `/knowledge/maps` | `MapsGalleryView` | |
| `/knowledge/maps/:id` | `MapDetailView(id, initialZoneId: ?zone)` | `?zone=` pre-selects + centers a zone. View renders a real "map not found" pane when id doesn't resolve (stale deep link must never spin forever). |
| **Tab 4 — Menu** (branch root `/menu`) | | |
| `/menu` | `MenuView` | |
| `/menu/search` | `GlobalSearchView` | |
| `/menu/settings` | `SettingsView` | |
| `/menu/about` | `AboutView` | |
| `/menu/faq` | `FAQView` | |
| `/menu/disclaimer` | `DisclaimerView` | |
| `/menu/contact` | `ContactView` | |
| *anything else* | `_RouteNotFound` | Router-level error page (see §3.2). |

Navigation verbs used in this area: `context.go(path)` (replace current location — used by
boot→tools/onboarding and onboarding-finish-first-run), `context.push(path)` (push onto the
current tab stack — used by menu rows, Settings→Replay intro, banner search icon),
`context.pop()` (used by onboarding replay finish).

### 3.2 Route-not-found screen (`_RouteNotFound`)

Terminal fallback for a bad/stale deep link. Deliberately dependency-light.

- Standard AppBar titled **"Not found"**.
- Centered column, 24px padding:
  - Icon `explore_off` (Material), size 40
  - 12px gap
  - Text **"This screen doesn't exist."** (centered)
  - 4px gap
  - The offending path (the URL path string), centered, font-size 12
  - 16px gap
  - Filled button **"Back to Underdeck"** → navigates (`go`) to `/tools`.

---

## 4. App shell & bottom navigation (`lib/app/app_shell.dart`)

The shell wraps the 5 tab branches: `Scaffold` with `backgroundColor #03060B`, body = active
branch, `extendBody: false` — the nav bar is opaque and page content scrolls *between* the top
ESSI banner and the bottom nav (never behind either).

### 4.1 Tab items (order fixed)

| Index | Label | Inactive icon (Material) | Active icon |
|---|---|---|---|
| 0 | Tools | `handyman_outlined` | `handyman` |
| 1 | Notes | `note_alt_outlined` | `note_alt` |
| 2 | Hangar | `inventory_2_outlined` | `inventory_2` |
| 3 | Knowledge | `menu_book_outlined` | `menu_book` |
| 4 | Menu | `more_horiz` | `more_horiz` (same both states) |

Tap behavior: switch to that branch; if the tapped tab is already current, reset the branch to
its initial location (pop to `/tools`, `/captures`, …).

### 4.2 Visual spec — "floating glass capsule" tab bar

Outer wrapper: solid `#03060B` backdrop (so nothing bleeds through), padding
`14px left/right, 0 top, 12px + safe-area-bottom` below.

Capsule:

- Base height **68px**; grows if the user's text scale enlarges labels (see below).
- Fully rounded (border-radius = height/2), clipped.
- Fill: linear-gradient top-left → bottom-right, `#0B1422 → #050A14` (opaque deep navy).
- Border: 1px `#4FC3FF @ 18%`.
- Shadows: ambient `rgba(0,0,0,0.55)` blur 28 offset (0,12); accent glow `#4FC3FF @ 14%`
  blur 24 spread −6 offset (0,8).

Inner layout: 6px inset all around (`_innerInset`). The inner width is divided equally into 5
cells.

**Selection pill** (glass-on-glass layer that slides behind the active tab):

- Positioned at `left = 6 + currentIndex * cellWidth`, `top = 6`, size = cellWidth ×
  (capsuleHeight − 12).
- Slide animation: **380ms, cubic ease-out** (`easeOutCubic`) on position when the index
  changes.
- Style: border-radius 28; backdrop-blur 18px; fill gradient top-left→bottom-right
  `white @ 18% → #4FC3FF @ 16%`; border 1px `#4FC3FF @ 55%`; outer cyan glow shadow
  `#4FC3FF @ 45%` blur 18 spread −2; faint inner-top highlight `white @ 10%` blur 6 offset (0,−1).
- Pointer-events: none.

**Tab cell** (each of the 5): full-height hit area, vertically centered column of:

- Icon, 22px. Color animates (280ms ease-out tween) between dim `#8AA4C2` and active
  `#4FC3FF`; when selected, the icon also gets a text-shadow glow `#4FC3FF @ 60%` blur 8 and
  swaps to its filled variant.
- 3px gap.
- Label: font-size **10.5**, weight 600, letter-spacing 0.2, same animated color; single line,
  no wrap, ellipsis overflow, centered.

Accessibility / text scaling ("F69"): the user's OS text-scale applies to labels but is
clamped to `[1.0, 1.3]`; the capsule height grows by the extra label height
(`68 + (scaledFontSize − 10.5)`). Each cell is exposed to assistive tech as a single button
node with its label and selected state (inner text not separately announced).

**Web equivalent:** fixed-bottom nav; CSS transitions for the pill (`left` transition 380ms
cubic-bezier(0.215,0.61,0.355,1)) and color; `env(safe-area-inset-bottom)` for the bottom pad.

---

## 5. Boot screen (`/boot`, `lib/features/boot/boot_screen.dart`)

Cyberpunk "console boot" splash. Full-screen, `#03060B`, wrapped in `AppBackground`
**with particles enabled** (unless animations are reduced). A full-width tap target covers the
screen: **tapping anywhere skips the intro immediately** at any moment.

### 5.1 Layout (top to bottom, inside safe area)

1. 32px top gap.
2. **BootEmblem** (220×220, see §5.4).
3. 24px gap.
4. Wordmark **"UNDERDECK"** — Quicksand, 38px, weight 900, letter-spacing 6, `#E8F4FF`, text
   shadow `#4FC3FF @ 55%` blur 8.
5. 6px gap.
6. Sub-line **"UP55 FAN COMPANION"** — JetBrainsMono, 11px, weight 600, letter-spacing 4,
   `#7AE3FF`.
7. 16px gap, then flexible spacer pushing the rest to the bottom.
8. **Boot terminal card** (see §5.3), horizontal padding 24, bottom margin 32.
9. Hint **"tap to continue"** — caption style at 10px, letter-spacing 3, `#7AE3FF`; hidden
   (opacity 0) until the boot text finishes, then fades to 70% opacity over 220ms. Bottom
   padding 12.

A **scan beam** overlay (§5.5) sweeps the whole screen behind the content.

### 5.2 Boot sequence & state machine

Boot lines (exact copy, typed in order):

```
> initializing ESSI subsystems…
> linking local datastore…
> indexing knowledge core…
> calibrating ESSI scanners…
> verifying drive nodes…
> loading hangar registry…
> spooling cargo manifest…
> mounting Rankle River grid…
> syncing pilot codex…
> ready.
```

- Typewriter: each character appears every **18ms**; after a line completes, **180ms** pause,
  then a new line starts. Whole sequence ≈ 8–10s.
- Only the last **4 lines** are visible (line height 18px, line spacing 4px, container height
  = 4×18 + 3×4 = 84px); older lines scroll up (scroll-to-bottom animated 180ms ease-out);
  content is clipped, not user-scrollable.
- A blinking block cursor `▋` (terminal style) trails the current line, opacity oscillating
  0→1 with a 600ms reverse-repeat animation.
- When all lines are typed → wait **1600ms** → begin exit.
- **Exit**: whole screen fades out (opacity 1→0) over **550ms ease-out**; when the fade ends,
  navigate: `onboardingSeen == false` → `/onboarding`, else `/tools` (replace).
- **Tap to skip**: any tap triggers the exit immediately (same fade).
- **Fast boot** setting (`settings.fastBoot == true`): skip the sequence entirely — begin exit
  on the first frame with a shorter **180ms** fade.
- **Reduced animations** (app setting `reduceAnimations` OR OS prefers-reduced-motion): the
  terminal renders all lines instantly and fires completion immediately (so: static screen for
  1.6s then fade); particles and scan beam are disabled; the emblem renders its static variant.

### 5.3 Boot terminal card

Container: padding 12, fill `bgGlass` (`rgba(15,28,48,0.55)`), radius 14, 1px border
`borderSubtle`, glow shadow `#4FC3FF @ 18%` blur 14.

Header row: three 7px circles ("traffic lights") — `#FF5F57`, `#FEBC2E`, `#28C840` — each
separated by 6px; right-aligned label **`essi://boot`** in JetBrainsMono 10 / `textDim`.
4px gap, then the typewriter text area (terminal style: JetBrainsMono 13 / 500 / `#4FC3FF`).

### 5.4 Boot emblem (220×220)

**Static variant** (reduced motion): three concentric 1px circle outlines — Ø200 in
`borderSubtle`, Ø140 in `#4FC3FF @ 40%`, Ø90 in `#7AE3FF @ 50%` — plus the core (below).

**Animated variant** — five concurrent loops:

- Outer dashed ring Ø200 (`borderSubtle`, stroke 1, dash 3 gap 7) rotating **counter-clockwise,
  14s/turn**, with 4 small ticks (1×8px, `#4FC3FF @ 55%`) at N/E/S/W on its rim.
- Static ring Ø140, 1px `#4FC3FF @ 18%`.
- A "scan arc" on the Ø140 ring rotating clockwise **4.5s/turn**: a sweep-gradient arc covering
  22% of the circle from `#4FC3FF` to transparent, stroke 2.2, round cap, gaussian blur 4.
- Inner dashed ring Ø90 (`#7AE3FF @ 50%`, stroke 0.7, dash 2 gap 4) rotating clockwise 8s/turn.
- Pulse (1.6s, ease-in-out, reverse-repeating): scales the core 1.0→1.06 and drives a radial
  glow disc Ø120 behind it (`#4FC3FF` alpha 0.6→0.85 fading to 0 at the edge).

**Core** (56×56, scales with the pulse): a regular hexagon (flat orientation, first vertex at
top: vertices at angles `i*60° − 90°`), filled with a linear gradient top-left→bottom-right
`#7AE3FF → #4FC3FF`, drop-shadow `#4FC3FF @ 70%` blur 12, hexagonal outline stroked 0.8px in
`white @ 25%`, and the text **"UD"** centered (18px, weight 900, letter-spacing 2, color
`#03060B`).

Web: SVG with CSS keyframe rotations is the natural port.

### 5.5 Scan beam

A full-screen horizontal light band, 90px tall, sweeping top→bottom on a **4.5s ease-in-out
loop** (travels from y = −45 to viewportHeight + 45). Vertical gradient: transparent →
`#4FC3FF @ 18%` → `#4FC3FF @ 32%` → `#4FC3FF @ 18%` → transparent, composited with **screen**
blend mode. Pointer-events none. Hidden entirely when animations are reduced.

---

## 6. Onboarding (`/onboarding`, `lib/features/onboarding/onboarding_view.dart`)

First-run intro styled as three "incoming transmission" cards in a horizontal pager.

Reached two ways:

- **First run** — `/boot` navigates here with a location *replace* when `onboardingSeen ==
  false`. Finishing has nothing to pop back to → `go('/tools')`.
- **Replay** — Settings *pushes* `/onboarding`. Finishing pops back to Settings.

Finishing (via Done **or** Skip) always persists `onboardingSeen = true`, so the flow shows
exactly once automatically.

### 6.1 Layout

Full-screen `#03060B` + `AppBackground` (no particles). Inside safe area, a column:

1. **Top bar** (padding 16 left, 8 top, 8 right): icon `wifi_tethering` 14px `accentSuccess`,
   8px gap, label **"INCOMING TRANSMISSION"** (JetBrainsMono 10 / 600 / letter-spacing 2 /
   `#7AE3FF`), spacer, then a text button **"Skip"** (caption style, `textSecondary`;
   accessibility label "Skip intro") → finish.
2. **Pager** (fills remaining height): 3 pages, swipe-enabled. Programmatic page changes
   animate 320ms `easeOutCubic` (or jump instantly under reduced motion).
3. **Dots row** (vertical padding 12, centered): one pill per page, 4px horizontal margins,
   height 7, border-radius 4; active = width 22 / `#4FC3FF`, inactive = width 7 /
   `textDim @ 50%`; width/color animate 220ms.
4. **Primary button** (padding 16 sides / 16 bottom, full width): `NeonButton` labelled
   **"Next"** with icon `arrow_forward` on pages 0–1, **"Enter Underdeck"** with icon
   `rocket_launch` on the last page. Tap → next page, or finish on the last page.

### 6.2 Page content (exact copy)

Each page is a vertically scrollable `GlassCard` (glow on, padding 16, page padding 16
horizontal / 12 vertical) containing: a header row (icon in a 1px `borderGlow`-bordered
rounded-8 box filled `#4FC3FF @ 10%`, icon 22px `accentPrimary`; then the channel tag in
JetBrainsMono 11 / 600 / letter-spacing 2 / `#7AE3FF`), 16px gap, the title in `display`
style, 12px gap, the body in `body` style colored `textSecondary` with line-height 1.5, 16px
gap, a 1px `borderSubtle` divider, 12px gap, then bullet rows (icon `chevron_right` 16px
`accentSuccess`, 8px gap, caption text; 3px vertical padding per row).

**Page 1** — channel `ESSI//WELCOME`, icon `satellite_alt`, title **"What Underdeck is"**:

> Underdeck is an unofficial fan companion for UP55 — a pocket ESSI terminal for pilots.
>
> It bundles the field tools, references and trackers you reach for mid-run into one
> offline-first console. No account, no sign-in — open it and it works.

Bullets:
- Made by a player, for the UP55 community.
- Everything lives on-device and works offline.

**Page 2** — channel `ESSI//TOOLKIT`, icon `grid_view_rounded`, title **"The tools & SL-sectors"**:

> The Tools deck holds the working kit — System Scan, Asteroid Analyzer, Mars Express alerts,
> the Fishing map and more. Captures, Hangar and the Knowledge core keep your notes and
> references close.
>
> The ESSI banner up top reads out an SL-sector code (SL = star-lane): a scroll-driven
> coordinate that anchors where you are in the console. It is flavour, not a live position —
> no location is ever read.

Bullets:
- Sector codes are cosmetic — nothing is tracked from them.
- Tabs along the bottom switch between decks.

**Page 3** — channel `ESSI//PRIVACY`, icon `shield_moon`, title **"Privacy promise"**:

> Underdeck has no backend operated by us and ships no telemetry or analytics SDK. Your data
> stays on your device.
>
> Most outbound network is opt-in (a Discord invite, System Scan, Discoveries, Tracker).
> Interactive maps are the exception: they download content from GitHub (Pages/Fastly +
> jsDelivr) at most once a day, on by default — you can switch that off in Settings. You own
> your data: back it up or move devices with a plain JSON export.

Bullets:
- No backend. No telemetry. No ads.
- Maps fetch from GitHub by default — toggle in Settings › Maps.
- Full JSON export & import lives in Settings › Data.

---

## 7. Menu tab (`/menu`, `lib/features/menu/views/menu_view.dart`)

Shell page using `BannerPage` with banner label **"ESSI · Operator Support"** and one banner
action: an icon button `search` (`accentPrimary`) with tooltip **"Search"** → push
`/menu/search` (fires tap haptic).

Body: `PageScrollView`, padding 12/12/12/32, a stretched column of **menu rows** separated by
12px gaps. Each row is a tappable `GlassCard` (tap haptic): a 36×36 slot holding the leading
icon (22px, `accentPrimary`), 12px gap, then title (`headline`) over subtitle (`caption`, 2px
gap), and a trailing 20px `textDim` chevron — `chevron_right` for in-app rows, `open_in_new`
for external ones.

| # | Title | Subtitle | Icon | Action |
|---|---|---|---|---|
| 1 | Search | Maps, KB, jobs, wallets, notes | `search` | push `/menu/search` |
| 2 | Settings | Animations · haptics | `tune` | push `/menu/settings` |
| 3 | FAQ | Free, local, private, the rules. | `help_outline` | push `/menu/faq` |
| 4 | Contact | Feedback, bug reports, support | `mail_outline` | push `/menu/contact` |
| 5 | Join Discord | UP55 community invite | `forum` | open `https://discord.gg/pGcD92Dm8H` externally (external chevron) |
| 6 | Disclaimer | Unofficial fan project · made for the UP55 community | `info_outline` | push `/menu/disclaimer` |
| 7 | About | `v<version>` (Alpha) — e.g. "v0.2.0 (Alpha)" | `auto_awesome` | push `/menu/about` |

The version string comes from the async app-version provider with fallback `v0.2.0` (§12).

---

## 8. Settings (`/menu/settings`, `lib/features/menu/views/settings_view.dart`)

Sub-page pattern shared by Settings/About/FAQ/Disclaimer/Contact: `Scaffold` with a
**transparent AppBar over the content** (`extendBodyBehindAppBar: true`, elevation 0), title
in `headline` style, back icon tinted `accentPrimary`; body = `AppBackground` +
`PageScrollView` padded `12, safeAreaTop + toolbarHeight(56) + 8, 12, 32`.
Web equivalent: a sticky transparent header with a back button over the page background.

Content: a column of `GlassCard` sections, 16px gaps.

### 8.1 Card "FEEDBACK" (SectionHeader icon `graphic_eq`)

- Toggle **"Haptic feedback"** — subtitle "Vibrations on tap, save, and selection." Bound to
  `hapticsEnabled` (default ON). Turning it ON fires a confirmation tap haptic.

Toggle row layout (used everywhere here): left column = title (`body`) + subtitle (`caption`,
2px gap); right: a switch with **active thumb color `accentSuccess`**. A disabled toggle dims
the whole row to 45% opacity and is inert.

### 8.2 Card "MOTION" (icon `auto_awesome`)

- Toggle **"Animations"** — subtitle "Console reveals, particles, pulsing glows, blinking
  cursors and the boot intro typewriter." NOTE: the switch shows the *inverse* of the stored
  flag: `value = !reduceAnimations`, toggling sets `reduceAnimations = !value`. Default: ON
  (reduceAnimations = false).
- 12px gap.
- Toggle **"Fast boot"** — subtitle "Skip the boot intro and jump straight into the app on
  launch." Bound to `fastBoot` (default OFF).

### 8.3 Card "DATA" (icon `data_object`)

- Caption: "Backup or move your data between devices using a JSON file."
- **Action row "Export…"** (icon `upload`). Action rows: rounded-8 container, 1px
  `borderSubtle` border, `bgGlass` fill, padding 12 h / 10 v; leading 18px `accentPrimary`
  icon, 8px gap, label (`body`), spacer, `chevron_right` in `textDim`; tap haptic; exposed as
  a single button to assistive tech.
  - Behavior: calls the data-export service share flow (on web this triggers a JSON download,
    see §16). On success where the share was not dismissed, records "backed up now"
    (`markBackedUp()` — refreshes the backup-reminder timer). On error: snackbar with
    `friendlyError(e, fallback: 'Export failed. Please try again.')`.
  - Native detail (iPad share-sheet anchoring): the row captures its on-screen rect at tap
    time and passes it as the share origin. **Web: drop.**
- **Action row "Import…"** (icon `download`). Opens the import file picker flow; on success
  shows a snackbar with the import summary — a comma list such as
  `"3 notes, 1 link, 2 tags, 1 ship, 4 scans, 2 tracks, 5 discoveries, 1 favorite,
  2 job statuses, 3 map notes"`, singular/plural per count, or **"Nothing imported."** when
  empty. On failure: snackbar with the human-readable parse message (a `FormatException`
  message) or generic **"Import failed"**.
- **Toggle "Auto-backup"** — subtitle: "After you make a batch of changes, quietly save a
  timestamped safety copy inside the app and keep the latest few. For a file you control, use
  Export above to share the JSON somewhere durable." Bound to `autoBackupEnabled`
  (default OFF). **Web: this feature is unsupported (no Documents dir) — hide this row.**

### 8.4 Card "INTERACTIVE MAPS" (icon `map`)

- Toggle **"Download interactive maps"** — subtitle "Fetch new and updated maps from GitHub
  (Pages/Fastly + jsDelivr), at most once a day. Off keeps only what is already on your
  device." Bound to `mapsNetworkEnabled` (**default ON** — owner's decision; this is the
  user's off-switch).
- Toggle **"Auto-update maps"** — subtitle "Automatically check for newer map content in the
  background. Turn off to update only when you choose." Bound to `mapsAutoUpdate`
  (default ON). **Disabled (dimmed 45%) while "Download interactive maps" is off.**
- Info line **"Installed version: <value>"** — value in JetBrainsMono, `#7AE3FF`; shows
  `none` when no version is installed. (6px gap below.)
- Management row **"Downloaded maps: <size>"** (same label/value styling; value shows `…`
  while the async size computes) with a trailing **"Clear"** button: rounded-8 outline
  button, 1px border `accentDanger @ 50%`, padding 12 h / 8 v, label `body` colored
  `accentDanger`; accessibility label "Clear downloaded maps".
  - Size formatting: `<=0` → `none`; else divide by 1024 through `B, KB, MB, GB`; show 1
    decimal when the value is `<10` and unit > B, otherwise 0 decimals. E.g. `3.4 MB`,
    `12 MB`, `812 KB`, `540 B`.
  - Clear flow: confirmation dialog (background `bgElevated`) — title **"Clear downloaded
    maps?"** (`headline`), body **"This frees up space by removing downloaded map content.
    The built-in sample map is restored, and maps re-download the next time you open them (if
    downloads are on)."** (`body`), actions **"Cancel"** / **"Clear"** (Clear in
    `accentDanger`). On confirm: clears the maps blob store, resets the seed-import guard so
    the bundled baseline re-imports, and refreshes the dependent providers (store size,
    installed version, manifest, seed import). On failure: snackbar **"Could not clear maps.
    Try again."**

### 8.5 Card "INTRO" (icon `satellite_alt`)

- Caption: "Replay the incoming-transmission intro that explains Underdeck, the tools and the
  privacy promise."
- Action row **"Replay intro"** (icon `replay`) → tap haptic, push `/onboarding`.

### 8.6 Card "WHAT STAYS ON" (icon `shield`)

Static bullet list (each: `check_circle` 14px `accentSuccess`, 8px gap, caption text, 2px
vertical padding):

- CRT scanlines and hex grid (static, no motion).
- Critical UI feedback (errors, save success).
- Save flash on edit (very brief, accessibility-safe).
- Static splash on launch.

---

## 9. About (`/menu/about`, `lib/features/menu/views/about_view.dart`)

Same sub-page chrome (transparent AppBar titled **"About"**).

**Card 1** (identity):

- **"UNDERDECK"** — Quicksand, 30px, weight 900, letter-spacing 4, `#E8F4FF`.
- 4px gap; version line **"v<version> (Alpha · cross-platform)"** (e.g. `v0.2.0 (Alpha ·
  cross-platform)`) in `mono` colored `textSecondary`.
- 8px gap, 1px `borderSubtle` divider, 8px gap.
- Body: **"Made by a player, for the UP55 community."**

**Card 2** — SectionHeader **"Privacy at a glance"** (icon `lock`), then bullets
(`check_circle` 16px `accentSuccess` + `body` text, 2px vertical padding):

- Free forever. No ads, no IAP.
- No telemetry. No analytics SDK.
- No backend operated by us. Data stays on your device.
- Most outbound network is opt-in (Discord invite, System Scan, Discoveries, Tracker).
- Interactive maps download from GitHub (Pages/Fastly + jsDelivr), at most once a day. On by
  default — turn it off in Settings › Interactive maps.

---

## 10. FAQ (`/menu/faq`, `lib/features/menu/views/faq_view.dart`)

Sub-page chrome (AppBar title **"FAQ"**). Entries are grouped by section, preserving entry
order; each section renders a `SectionHeader` with the section key (displayed UPPERCASE by the
component): `operations`, `privacy`, `network`. Under each header, accordion items (8px gaps;
12px gap after each section).

Accordion item: tappable `GlassCard`; header row = question (`headline`) + trailing icon
`expand_more` (closed) / `expand_less` (open) in `accentPrimary`; answer area cross-fades
open/closed in **200ms**, with the answer (`body`) padded 8px above.
All items start closed; items toggle independently (no auto-close of siblings).

Exact Q/A copy:

**operations**

1. **Is Underdeck free?**
   Yes. Underdeck is free and will stay free, forever. No ads, no in-app purchases, no premium tier.
2. **Is this an official UP55 app?**
   No. Underdeck is a fan project. It is not affiliated with or endorsed by Jaydz Dev (alias Lama), the creator of Underpunks55.

**privacy**

3. **Does Underdeck collect my data?**
   No. Zero telemetry, zero analytics. The app does not communicate with any server we operate.
4. **Where is my data stored?**
   On your device, in a local SQLite database. To move data between devices, use the export/import feature in Settings.

**network**

5. **Does the app need internet?**
   Not for normal use. Notes, links, ships, the knowledge base, the Asteroid Analyzer, the Fishing Map, the Mars Express schedule and the Wallet Lookup all work fully offline. Three tools are opt-in and do talk to a network: System Scan, Discoveries, and Tracker. They call NASA APIs (JPL Horizons and SBDB). Nothing happens unless you tap their action button. Interactive maps are the one feature that reaches out on its own: they download map content from GitHub (see the next question). Tapping the Discord invite link in the Menu also opens the network, but only at the moment you tap it.
6. **Where do interactive maps come from?**
   Map content (the map list, each map, and its images) is hosted on GitHub and delivered over a multi-CDN path: GitHub Pages (fronted by Fastly) for the small "which version is current" pointer, and jsDelivr — with raw.githubusercontent.com as a fallback — for the actual files. Downloads are on by default and happen at most once every 24 hours; every file is checked against a SHA-256 hash before it is stored. Nothing about you is sent — these are plain GET requests, so your IP address is visible to those CDNs, and that is all. A built-in sample map ships inside the app so maps work offline on first launch. You can turn downloads off entirely in Settings › Interactive maps, and clear anything already downloaded there too.
7. **What does System Scan send to NASA?**
   When you tap "Scan now" in Tools / System Scan, Underdeck makes 9 GET requests to ssd.jpl.nasa.gov/api/horizons.api, one per planet. Sent: NAIF code (199-999) and current UTC timestamp. Received: public ephemeris text. Visible to NASA: your IP address. Stored: nothing on first run; entries you keep are saved locally.
8. **What does Tracker send to NASA?**
   When you tap "Track" in Tools / Tracker, Underdeck makes 1 to 4 GET requests to JPL Horizons / SBDB. Sent: object name or designation, plus a fixed instruction. No identifier of yours is added. Stored: each successful track is saved to local history. You can delete entries any time.

---

## 11. Disclaimer (`/menu/disclaimer`, `lib/features/menu/views/disclaimer_view.dart`)

Sub-page chrome (AppBar title **"Disclaimer"**). Five `GlassCard`s, 16px gaps:

**Card 1** — header row: icon `info_outline` (`accentPrimary`) + **"Unofficial fan project"**
(`headline`); then two `body` paragraphs (8px gaps):

- "Underdeck is an independent companion app made by a player for the UP55 community."
- "It is not affiliated with, endorsed by, or sponsored by the creator of Underpunks55."

**Card 2** — SectionHeader **"Credits"**:

- "Underpunks55 (UP55) is created by Jaydz Dev (alias Lama)." (built from constants)
- "All in-game terminology, lore, zone names and bot commands referenced in this app belong to the original creators. Underdeck only mirrors information that is freely visible in the public Discord bot."

**Card 3** — SectionHeader **"Community resources"** (icon `menu_book`):

- "The Underpunks Fandom wiki is a community-maintained reference for UP55 lore, zones and game mechanics."
- Link row (opens `https://underpunks.fandom.com` externally): icon `open_in_new` 16px
  `accentPrimary` + **"underpunks.fandom.com"** in `mono` weight 600 colored `#7AE3FF`.

**Card 4** — SectionHeader **"Map content & updates"** (icon `public`):

- "Interactive maps are downloaded from GitHub — GitHub Pages (fronted by Fastly) for the version pointer and jsDelivr (with raw.githubusercontent.com as a fallback) for the files — at most once a day, and verified by SHA-256 before use. A built-in sample map ships with the app so maps work offline. Downloads are on by default and can be turned off, or cleared, in Settings › Interactive maps."

**Card 5** — SectionHeader **"Trademarks & assets"**:

- "The names \"Underpunks55\", \"UP55\", \"East-Shire\" and any related visual assets are the property of their respective owners. Underdeck uses no in-game art assets, only original UI elements built from scratch."

---

## 12. Contact (`/menu/contact`, `lib/features/menu/views/contact_view.dart`)

Sub-page chrome (AppBar title **"Contact"**). Composes an email to
`contact@overthecloud.xyz`. Accepts an optional `initialMessage` prop that pre-fills the
message field (used by a KB "Contribute intel" flow); default empty.

Body content, top to bottom (16px gaps):

1. `TransmissionHeader` inline with label **"ESSI · operator support"** (renders uppercased).
2. **Card "CATEGORY"** (icon `tag`): a wrap of 4 `TagChip`s (8px spacing both axes) —
   **Feedback** (default selected), **Bug report**, **Support**, **Other**. Single-select.
3. **Card "YOUR MESSAGE"** (icon `mail_outline`): borderless multiline text field, hint
   **"Tell me what's on your mind…"** (hint colored `textDim`), min 5 / max 20 lines,
   sentence auto-capitalization.
4. **Card "PHOTOS (OPTIONAL)"** (icon `photo_library_outlined`):
   - Caption when empty: "Up to 4 photos. Helpful for bug reports — attach a screenshot
     showing the issue."
   - Caption with attachments: "N/4 attached. Photos travel through the OS share sheet so
     Mail / Gmail can attach them."
   - Horizontal 84px-tall strip: attachment thumbnails (84×84, rounded 8, cover-fit; broken
     images show a `broken_image` icon in `accentDanger` on `bgGlass`), each with a small ×
     remove badge top-right (14px `close` icon in `accentDanger` on a `bgDeepest` circle,
     2px padding); after the thumbs, while under the cap of **4**, an add tile (84×84,
     `bgGlass` fill, rounded 8, 1px border `#4FC3FF @ 40%`, centered `add_a_photo` 28px
     `accentPrimary`).
   - Add flow: multi-image picker, image quality 80, limited to the remaining slots
     (4 − current). Picker errors surface a danger-colored snackbar via
     `friendlyError(e, fallback: "Couldn't pick that photo. Please try again.")`.
     Selection haptic on open; tap haptic on remove.
5. **Card "Auto-included in the email"** — header row: `info_outline` 14px `accentPrimary` +
   label "Auto-included in the email" (caption, `accentPrimary`, weight 600); then three mono
   11px lines: `App: Underdeck v<version> (<build>) (Alpha)` (`textSecondary`),
   `Device: <os> <osVersion>` (`textSecondary`; on web the device label is just `Web`, §16),
   `Sent to: contact@overthecloud.xyz` (`#7AE3FF`).
6. **Send button** (`NeonButton`, full width): label **"Open in Mail"** with icon `mail` when
   there are no attachments; **"Send via share sheet"** with icon `ios_share` when there are.
   Enabled only when the trimmed message is non-empty OR there is at least one attachment.

Send behavior:

- Email body template (exact):

  ```
  <message text, trimmed>

  ---
  App: Underdeck v<version> (<build>) (Alpha)
  Device: <os> <osVersion>
  Category: <Feedback|Bug report|Support|Other>
  Sent to: contact@overthecloud.xyz
  ```

- Subject: `[Underdeck] <category label>` (e.g. `[Underdeck] Bug report`).
- **No attachments** → open
  `mailto:contact@overthecloud.xyz?subject=<enc>&body=<enc>` externally. If launching fails,
  show a dialog (background `bgElevated`): title **"No mail account"**, body **"This device
  has no Mail account configured. Send a mail manually to contact@overthecloud.xyz
  instead."**, single action **"OK"** (`accentPrimary`).
- **With attachments** → OS share sheet with subject, body text and the image files.
  **Web adaptation:** the OS share sheet with files maps to the Web Share API
  (`navigator.share` with `files`, feature-detected); otherwise fall back to mailto without
  attachments + a hint to attach the photos manually, or drop the attachments feature on web
  (it is mobile-only today per the codebase's own note).

---

## 13. Core utilities (`lib/core/`)

### 13.1 `app_constants.dart`

```ts
const discordInviteUrl = 'https://discord.gg/pGcD92Dm8H';
const fandomUrl = 'https://underpunks.fandom.com';
const contactEmail = 'contact@overthecloud.xyz';
const gameCreator = 'Jaydz Dev (alias Lama)';
const gameTitle = 'Underpunks55 (UP55)';
```

### 13.2 `app_version.dart`

`AppVersion { version: string; buildNumber: string }` with getters
`shortLabel = 'v' + version` (e.g. `v0.2.0`) and `fullLabel = 'v' + version + ' (' +
buildNumber + ')'` (e.g. `v0.2.0 (5)`). Read at runtime from the platform bundle
(pubspec `version: 0.2.0+5`); an async provider exposes it and **UI must never block on it** —
consumers use the resolved value or the constant fallback `{version:'0.2.0',
buildNumber:'0'}`. **Web equivalent:** inject the version at build time
(`import.meta.env` / define) — no async needed.

### 13.3 `error_text.dart` — `friendlyError(error, fallback)`

Converts any caught error into short, human-safe copy; **never** shows a raw exception string.

```
if error is a network transport error:
  connection error / connect timeout / send timeout / receive timeout
      -> 'No network connection. Check your signal and try again.'
  cancelled -> 'Request cancelled.'
  bad response / bad certificate / unknown
      -> "Couldn't reach the server. Please try again."
if error is a parse/format error carrying a curated human message -> that message (trimmed)
else -> fallback   // default fallback: 'Something went wrong. Please try again.'
```

Web equivalent: classify `fetch`/Axios errors the same way (offline/timeout/abort/HTTP-error)
and keep the exact strings.

### 13.4 `external_link.dart` — `launchExternal(href)`

Security-conscious single entry point for opening URLs that came from importable content.
Allowed schemes: **http, https, mailto** only. Parse the href (trimmed); if unparseable or
scheme not allowed → show snackbar **"Couldn't open that link."** with background
`accentDanger`, and do nothing. Otherwise open externally; if the launch reports failure, show
the same snackbar. Web equivalent: `window.open(url, '_blank', 'noopener,noreferrer')` after
the same scheme allow-list.

### 13.5 `internal_link.dart`

Custom in-app scheme `underdeck://` for cross-links inside content (KB markdown, zone links,
imported notes). It is **never** registered with the OS — it's resolved in-app:

```
resolveInternalLink(href):
  parse href (trimmed); scheme must be 'underdeck' (case-insensitive) else null
  kind = host (lowercased); id = first non-empty path segment, URL-encoded; none -> null
  kind 'kb'  -> '/knowledge/article/<id>'
  kind 'map' -> '/knowledge/maps/<id>'
               + '?zone=<encoded zone>' when the query param 'zone' is non-empty
  otherwise  -> null
```

`resolveLink(href)`: if `resolveInternalLink` returns a path → **push** that route; else hand
to `launchExternal` (so `javascript:`/`file:`/etc. can never launch — worst case is the
friendly snackbar). A resolved target that no longer exists (removed article/map) still lands
on a valid route whose view renders a real "not found" state — never an infinite spinner.

### 13.6 `logging.dart`

Minimal centralized error logger with a pluggable crash-reporter seam:

- `logError(error, stack?)` — the single sink for every caught/uncaught error. In dev builds
  prints `"[Underdeck] ERROR: <error>"` + stack to console; in all builds forwards to the
  attached reporter inside its own try/catch (a reporter must never throw out of an error
  handler).
- `setErrorReporter(fn | null)` — attach/detach a crash-reporting backend (e.g. Sentry) in
  exactly one place; call sites never change. Default reporter is a no-op.

### 13.7 `relative_date.dart` — `formatRelativeDate(date)`

```
diff = now - date
future (diff < 0)      -> 'd MMM y, HH:mm' of the local date   (e.g. '5 Jul 2026, 14:30')
< 1 minute             -> 'just now'
< 60 minutes           -> '<m> min ago'
< 24 hours             -> '<h>h ago'
< 7 days               -> '<d>d ago'
< 30 days              -> '<floor(d/7)>w ago'
< 365 days             -> '<floor(d/30)> mo ago'
else                   -> 'd MMM y' of the local date          (e.g. '5 Jul 2025')
```

---

## 14. Network layer (`lib/core/network/app_dio.dart`)

One shared HTTP client for every JPL/NASA call:

- **connect timeout 10s**, **receive timeout 30s** (per-request overrides win).
- **Retry interceptor** for idempotent requests:
  - Never retries a cancelled request (respects the caller's cancellation token, including a
    cancellation that happens during backoff).
  - Only retries **GET/HEAD**.
  - Retries only *transient* failures: connection error, connect timeout, receive timeout, or
    an HTTP **5xx** response.
  - Max **2 retries** with backoff delays **500ms then 1500ms** (the last delay repeats if
    ever more retries were configured). Attempt count is carried on the request so retries of
    retries stop at the cap.

**Web equivalent:** a `fetch` wrapper with `AbortController` timeouts (10s connect ≈ overall
abort; 30s read) and the same retry policy (2 retries, 500/1500ms, GET/HEAD only, on network
failure or 5xx, never after abort).

---

## 15. Settings state & persistence

State object (`AppSettingsState`) — all persisted in SharedPreferences (**web:
localStorage**), loaded synchronously at startup, defaults applied per-key when unset:

| Field | Type | Default | Prefs key |
|---|---|---|---|
| hapticsEnabled | bool | `true` | `settings.hapticsEnabled` |
| reduceAnimations | bool | `false` | `settings.reduceAnimations` |
| fastBoot | bool | `false` | `settings.fastBoot` |
| onboardingSeen | bool | `false` | `settings.onboardingSeen` |
| lastBackupAt | DateTime? (epoch ms int) | `null` | `settings.lastBackupAt` |
| backupReminderSnoozedUntil | DateTime? (epoch ms int) | `null` | `settings.backupReminderSnoozedUntil` |
| autoBackupEnabled | bool | `false` | `settings.autoBackupEnabled` |
| mapsNetworkEnabled | bool | `true` | `settings.mapsNetworkEnabled` |
| mapsAutoUpdate | bool | `true` | `settings.mapsAutoUpdate` |
| mapsLastSeenChangelogVersion | string? | `null` | `settings.mapsLastSeenChangelogVersion` |

Mutations relevant to this area:

- `setOnboardingSeen(true)` — on onboarding finish (Done or Skip).
- `setFastBoot`, `setReduceAnimations`, `setHapticsEnabled`, `setAutoBackupEnabled`,
  `setMapsNetworkEnabled`, `setMapsAutoUpdate` — Settings toggles; each updates state then
  persists.
- `markBackedUp(at = now)` — sets `lastBackupAt` and **clears** any snooze (removes the snooze
  key) so the backup-reminder timer restarts; called after a successful (non-dismissed) export.
- `snoozeBackupReminder(until)` — sets the snooze timestamp (used by the reminder banner,
  another area).
- `markMapsChangelogSeen(version)` — no-op if empty or unchanged; else persist.

**Reduced-motion rule used app-wide:** animations are skipped when
`reduceAnimations == true` **OR** the OS/browser signals reduced motion
(`prefers-reduced-motion` on web). Every animated shell element (boot typewriter, emblem, scan
beam, particles, onboarding page transitions) checks this.

**Haptics abstraction:** `Haptics.tap()` (light), `.selection()`, `.success()` /
`.warning()` (medium), `.error()` (heavy) — all no-ops when `hapticsEnabled` is off. **Web
equivalent:** `navigator.vibrate` where available (short pulses, e.g. 10/5/20/40ms), or drop
silently; keep the setting UI either way or hide it behind capability detection.

---

## 16. Platform features & web adaptations

| Feature | Where used (this area) | Flutter impl | Web equivalent |
|---|---|---|---|
| Share sheet (JSON export) | Settings › Export | temp file + OS share sheet, stable filename `underdeck-export.json` | **Already ported in-repo:** Blob + object URL + hidden `<a download>` click; return a synthetic "success" result so the caller still calls `markBackedUp()` |
| Share sheet (PNG share cards) | (other areas) | temp PNG + share sheet with text | Blob download; drop the accompanying text |
| Documents auto-backup + pruning | Settings › Auto-backup toggle; root controller | writes `<Documents>/backups/<file>`, prunes to newest N by filename prefix | **Unsupported on web — hide the toggle and never subscribe the controller** (the io code throws if reached) |
| File picker (import JSON) | Settings › Import | file_selector | `<input type="file" accept="application/json">` |
| Image picker (contact photos) | Contact | image_picker `pickMultiImage(quality 80, limit)` | `<input type="file" accept="image/*" multiple>`; thumbnails via object URLs (the repo's web variant already renders the picked blob URL) |
| mailto compose | Contact (no attachments), Menu | url_launcher external | `window.location.href = mailto:` / `window.open` |
| Share with files (contact w/ photos) | Contact | share_plus with XFiles | `navigator.share({files})` when supported; else fall back to mailto without attachments (or hide attachments — they are mobile-only today) |
| External URLs | Menu (Discord), Disclaimer (fandom), external_link.dart | url_launcher externalApplication | `window.open(url,'_blank','noopener,noreferrer')` with the http/https/mailto allow-list |
| Haptics | All tap targets in this area | HapticFeedback light/selection/medium/heavy | `navigator.vibrate` or drop |
| Local notifications + timezone db | main() init (feature lives in Mars Express area) | flutter_local_notifications | Web Notifications API (separate area); shell only needs init failures to be non-fatal |
| Orientation lock (portrait) | main() | SystemChrome | **Drop**; constrain layout width instead |
| Status/navigation bar theming | main() | SystemChrome overlay style | `<meta name="theme-color" content="#03060B">` |
| Package info (version/build) | About, Menu, Contact | package_info_plus | build-time constant |
| Device label | Contact "Device:" line | `Platform.operatingSystem + version`; web variant returns `'Web'` | return `'Web'` (or parse UA if desired) |
| Disk-full detection (ENOSPC 28) | maps seed importer (other area) | FileSystemException errorCode 28 | always `false` on web (already split that way) |
| SharedPreferences | settings store | shared_preferences | localStorage |
| SQLite (Drift) | FAQ copy references it; data area | drift + sqlite3 | (data area decision — e.g. sql.js/wa-sqlite/IndexedDB) |

---

## 17. Assets referenced by this area

- `assets/fonts/Inter-Variable.ttf`, `assets/fonts/JetBrainsMono-Variable.ttf`,
  `assets/fonts/Quicksand-Variable.ttf` — the three bundled font families.
- `assets/fonts/Inter-OFL.txt`, `assets/fonts/JetBrainsMono-OFL.txt`,
  `assets/fonts/Quicksand-OFL.txt` — license texts registered at startup.
- No raster/vector image assets are used by the shell, boot, onboarding, or menu screens —
  every visual (emblem, hexagon, scan beam, particles, hex grid, scanlines) is drawn
  programmatically. (Other asset dirs — `assets/catalog/`, `assets/knowledge/**`,
  `assets/maps_seed/` — belong to other areas.)

---

## 18. Behavior summary / acceptance checklist

1. Cold start → `/boot` plays the typewriter boot (≈8–10s) → 1.6s hold → 550ms fade →
   `/onboarding` (first run) or `/tools`.
2. Tap anywhere on boot at any time → immediate 550ms fade-out and navigate.
3. `fastBoot` on → boot exits on first frame with a 180ms fade.
4. Reduced motion (setting or OS) → no particles/beam/typewriter/emblem-motion anywhere; boot
   text renders complete instantly; onboarding page changes jump without animation.
5. Onboarding Done/Skip persists `onboardingSeen`; first-run finish goes to `/tools`,
   replayed finish pops back to Settings.
6. The 5 tabs keep independent navigation stacks; re-tapping the active tab returns to the tab
   root; the selection pill slides 380ms easeOutCubic.
7. Unknown URL → "Not found" screen with the path shown and a "Back to Underdeck" button to
   `/tools`.
8. All settings toggles persist immediately and take effect without reload (the boot/animation
   flags are read live).
9. `underdeck://kb/<slug>` and `underdeck://map/<id>[?zone=]` links inside content navigate
   in-app; only http/https/mailto ever leave the app; anything else → "Couldn't open that
   link." snackbar.
10. Every user-visible error message comes from the `friendlyError` table or a curated string —
    raw exception text must never render.

---

## 19. Open questions

- `_RouteNotFound` uses the default Material AppBar/FilledButton (not the custom transparent
  chrome). Decide whether the web port keeps this plain look or restyles it to match the
  sub-page chrome (recommendation: match the app style; keep the copy).
- Tracker prefill (`/tools/tracker` with a `TrackTarget` in navigation state) is not
  URL-addressable; the web port must decide between router location-state (ephemeral, matches
  current behavior) or promoting it to query params.
- The Contact attachments flow relies on the OS share sheet to deliver photos into a mail app;
  no true web equivalent exists when `navigator.share` with files is unavailable — product
  decision needed (hide the photos card on web vs. best-effort Web Share API).
- The FAQ answer "stored ... in a local SQLite database" may need rewording on web depending
  on the storage engine the data area chooses.
- `MediaQuery.disableAnimationsOf` maps to `prefers-reduced-motion: reduce`; confirm the
  product wants the OS signal ORed with the in-app toggle on web too (spec assumes yes).
- Deep links: the native app registers no OS scheme; on GitHub Pages, direct URL entry to any
  route must work (SPA fallback/404 redirect needed — hosting concern, not app logic).

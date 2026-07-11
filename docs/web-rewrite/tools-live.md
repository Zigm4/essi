# Underdeck — Area spec: `tools-live`

**The three NASA-API tools + shared scan/track/discovery history.**
Source paths covered (Flutter app, read exhaustively):

- `lib/features/tools/scan/` — System Scan (JPL Horizons planet positions → game sectors)
- `lib/features/tools/celestial/` — Celestial Discoveries (JPL SBDB bulk queries)
- `lib/features/tools/tracker/` — Object Tracker (SBDB single-body lookup + Horizons vectors)
- `lib/features/tools/history/` — shared generic history store + bottom sheet
- Supporting files referenced: `lib/core/network/app_dio.dart`, `lib/data/database/tables/scan_history_table.dart`, `lib/design_system/*`, `lib/services/{haptics,share_card}.dart`, `lib/features/favorites/*`, `assets/catalog/tracked_objects.json`, `lib/app/router.dart`.

This document is written for a from-scratch web recode (Vite + React + TypeScript, GitHub Pages). The web team will NOT see the Flutter code; everything needed is here.

> ⚠️ **CRITICAL WEB CONSTRAINT — CORS.** Every network call in this area goes to `ssd.jpl.nasa.gov` or `ssd-api.jpl.nasa.gov`. **Neither host sends CORS headers**, so a browser cannot call them directly. Every call site is flagged inline with **[CORS-BLOCKED]**. The web port needs ONE of: (a) a CORS proxy (e.g. a tiny Cloudflare Worker / Netlify function that forwards GETs and adds `Access-Control-Allow-Origin: *`), (b) a public proxy the team controls, or (c) dropping live features. GitHub Pages itself cannot host a proxy — this is an unavoidable extra deployment. All request/response shapes below are given so the proxy can be a transparent pass-through.

---

## Table of contents

1. [Shared visual foundation (design tokens & components)](#1-shared-visual-foundation)
2. [Shared network layer](#2-shared-network-layer)
3. [Shared history feature](#3-shared-history-feature)
4. [Tool: System Scan](#4-tool-system-scan)
5. [Tool: Celestial Discoveries](#5-tool-celestial-discoveries)
6. [Tool: Object Tracker](#6-tool-object-tracker)
7. [Share cards (PNG export)](#7-share-cards)
8. [Platform features & web equivalents](#8-platform-features--web-equivalents)
9. [Assets used](#9-assets-used)
10. [Full "How it works" page texts](#10-how-it-works-full-texts)
11. [Open questions](#11-open-questions)

---

## 1. Shared visual foundation

All three tools use the same dark "cyberpunk terminal" design system. Exact tokens:

### 1.1 Colors (`AppColors`)

| Token | Hex / value | Usage |
|---|---|---|
| `bgDeepest` | `#03060B` | Page/scaffold background, share-card background |
| `bgElevated` | `#0A1220` | Dialog backgrounds (AlertDialog) |
| `bgGlass` | `#0F1C30` at 55% alpha | Segmented-control track, text-field fill, InfoCard fill |
| `bgCard` | `#111E30` (opaque) | GlassCard fill, date-picker surface |
| `accentPrimary` | `#4FC3FF` | Primary cyan — icons, section headers, sector numbers, buttons |
| `accentSecondary` | `#7AE3FF` | Lighter cyan — SL distances, code text, progress text |
| `accentDanger` | `#FF5577` | Errors, delete actions, stop buttons, PHA badge |
| `accentWarn` | `#FFB347` | Warnings, caution status, latency hints |
| `accentSuccess` | `#5FE8A0` | OK status, success check icons, pulsing dot |
| `textPrimary` | `#E8F4FF` | Main text |
| `textSecondary` | `#8AA4C2` | Secondary text, captions |
| `textDim` | `#6E8AAB` | Dim informational text (WCAG-tuned; ~4.7:1 on bgCard) |
| `borderSubtle` | `#7AE3FF` at 12% alpha | Card borders, dividers |
| `borderGlow` | `#4FC3FF` at 45% alpha | Focused input border, NeonButton border |

Divider pattern used everywhere: `height: 1px` container colored `borderSubtle` at reduced alpha (0.5, 0.4, 0.3, or 0.25 depending on context — exact values noted per view).

### 1.2 Typography (`AppTypography`)

Fonts are **bundled** (no Google Fonts network fetch): families `Inter` (sans), `JetBrainsMono` (mono), `Quicksand` (rounded — not used in this area). Web equivalent: self-host these as woff2.

| Style | Family | Size | Weight | Color | Notes |
|---|---|---|---|---|---|
| `headline` | Inter | 17 | 600 | textPrimary | App-bar titles, card headings |
| `body` | Inter | 15 | 400 | textPrimary | Paragraphs, list titles |
| `caption` | Inter | 12 | 500 | textSecondary | Hints, secondary info |
| `mono` | JetBrainsMono | 14 | 400 | textPrimary | Base mono; nearly always `.copyWith` overridden (sizes 9–22 noted per usage) |
| `terminal` | JetBrainsMono | 13 | 500 | accentPrimary | (not used directly in this area) |

### 1.3 Spacing & radii

`AppSpacing`: xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48 (px).
`AppRadius`: sm 8, md 14, lg 22 (px).

### 1.4 Shared components used by these views

**AppBackground** — full-bleed page background stack: (1) solid `#03060B`; (2) radial gradient centered top-left (alignment −1,−1, radius 1.2) from `accentPrimary` @ 10% alpha to transparent; (3) a hex-grid CustomPaint at 6% opacity (decorative, may be reproduced with an SVG pattern or dropped); (4) the page content; (5) horizontal "scanlines" overlay at 55% opacity (decorative; the history sheets and detail sheets pass `showsScanlines: false`). Tapping empty background dismisses the keyboard/focus.

**GlassCard** — the standard card: fill `bgCard` (#111E30), border 1px `borderSubtle`, radius 14 (`AppRadius.md`), padding 12 (`AppSpacing.md`) all sides, clipped to radius. Optional `glow` (box-shadow accentPrimary @18%, blur 14) — not used in this area. No backdrop blur by default.

**InfoCard** — used in "How it works" sheets: width 100%, fill `bgGlass`, border 1px `borderSubtle`, radius 14, padding 16 (`AppSpacing.lg`).

**SectionHeader** — row: optional icon 18px `accentPrimary`, gap 8, then title `text-transform: uppercase`, JetBrainsMono 12/600, letter-spacing 2, color `accentPrimary`. Optional caption subtitle below (not used here).

**TransmissionHeader** — the "ESSI" banner at the top of each tool's scroll content. Opaque `bgDeepest` container, horizontal padding 12, vertical 6; inside, a bottom border (1px borderSubtle) with 4px padding-bottom; row = green `PulsingDot` (6px circle, `accentSuccess`, opacity pulsing every 800 ms between bright/dim; static circle if reduced-motion) + 8px gap + label uppercased in JetBrainsMono 10/600, letter-spacing 2, `accentPrimary`, ellipsized + right-aligned scroll-driven counter text `ESSI//NNN` (JetBrainsMono 10/500, `textDim`). NNN = `100 + ((randomSeed + floor(scrollOffsetPx / 4)) % 900)` — random seed per mount, ticks as the page scrolls. Pure decoration; reproduce or simplify to a static `ESSI//` + random 3-digit value.

**NeonButton** — primary CTA. Min-height 50, radius 14, background linear-gradient left→right `accentPrimary → accentSecondary` (danger variant: `accentDanger → accentWarn`, not used here), border 1px `borderGlow`, box-shadow: tint @ 45% alpha, blur 14. Content centered row: optional icon 18px colored `bgDeepest` + 8px gap + label 16/600 colored `bgDeepest` (dark text on bright gradient). Press animation: scale 0.97 over 200 ms ease-out. Disabled: whole button at 40% opacity, non-interactive. Fires a light haptic on press (web: drop or `navigator.vibrate`).

**PageScrollView** — scroll container that (a) broadcasts scroll offset (drives TransmissionHeader counter), (b) shows a floating "back to top" button once scrolled > 1 viewport height: circular 44×44, background `bgDeepest`, 1px border accentPrimary @ 60%, box-shadow accentPrimary @ 40% blur 10, icon `arrow_upward` 22px `accentPrimary`, positioned right 16 / bottom 16, appears/disappears with a 200 ms scale+fade; clicking smooth-scrolls to top over 300 ms ease-in-out.

**CodeBlock** ("How it works" sheets) — horizontally scrollable `<pre>`: background `bgDeepest` @ 55%, radius 8, border 1px `borderSubtle`, padding 8 (right 40 to clear button), text JetBrainsMono 11 `accentSecondary`. A copy button pinned top-right (6px inset): 28×26 box, `bgDeepest` fill, radius 5, 1px `borderSubtle`, icon `copy` 11px `accentPrimary`; on click copies the raw text to clipboard, swaps icon to `check` in `accentSuccess` for 1500 ms, fires success haptic.

**KvRow** — label column (default width 110px, per-sheet overrides 120/130 noted below) JetBrainsMono 11/600 `accentPrimary`; 8px gap; value JetBrainsMono 11 `textSecondary`, wrapping. Vertical padding 2.

**ParamRow** — first line: name JetBrainsMono 12/600 `accentSecondary` + value JetBrainsMono 11 `accentPrimary` (wrapping row, 8px gap); second line: note Inter 11 `textSecondary`. Vertical padding 2.

**OpRow** — op column width 70, JetBrainsMono 12/600 `accentSecondary`; desc Inter 11 `textSecondary`.

**StatusRow** — emoji column width 28 (font-size 18), then title JetBrainsMono 12/600 `accentPrimary` over rule Inter 11 `textSecondary`.

**QuirkRow** — leading `warning_amber_rounded` icon 14px `accentWarn`, then title JetBrainsMono 12/600 `accentWarn` over detail Inter 11 `textSecondary`.

**StepRow** — number column width 22, JetBrainsMono 16/700 `accentPrimary`; title JetBrainsMono 12/600 `accentSecondary`; body Inter 11 `textSecondary`.

**TierRow** — leading 22×22 circle (border 0.7px accentPrimary @ 60%) containing tier number JetBrainsMono 11/700 `accentPrimary`; title JetBrainsMono 12/600 `accentSecondary`; body Inter 11 `textSecondary`.

**WindowRow** — planet name JetBrainsMono 12/600 `accentSecondary`; below, two equal columns "Coarse" / "Refine": tiny label JetBrainsMono 9 `textDim` over value JetBrainsMono 11 `textSecondary`.

**HowItWorksSheet** — the scaffold for all three "How it works" pages. Native: a draggable modal bottom sheet, initial height 92% of screen, min 50%, max 97%, top corners radius 22 (`AppRadius.lg`), background `bgDeepest`. App bar: transparent, leading text-button **"Close"** (Inter 15 `textSecondary`, leading width 80) that dismisses; centered title **"How it works"** (headline). Body: vertical list of the cards with 16px gaps, padded (12, top-safe-area + toolbar + 8, 12, 32). **Web equivalent:** a modal drawer/dialog sliding from the bottom, or a routed sub-page; content scrolls internally.

### 1.5 App-bar pattern (all three tool screens)

Scaffold background `bgDeepest`, body extends behind the app bar. AppBar: transparent background, elevation 0 (`scrolledUnderElevation: 0` on Scan), title = tool name in `headline` style, back-arrow icon tinted `accentPrimary` (automatic back navigation to `/tools`). Trailing actions (identical order on all three): an `info_outline` icon button (tooltip **"How this tool works"**) opening the How-it-works sheet, and a `history` icon button (tooltip: **"Scan history"** / **"Search history"** / **"Tracker history"**) opening the history sheet. Both icons `accentPrimary`.

Scroll content top padding = safe-area top + toolbar height (56) + 8; horizontal 12; bottom 32.

### 1.6 Navigation / routes

Tools are reached from the Tools home (`/tools`) via ToolCard tiles (that view is another area; the relevant tiles are):

- **System Scan** — subtitle "Live planet positions (network · JPL NASA)", icon `radar`, tint accentDanger → route `/tools/scan`
- **Discoveries** — subtitle "Find comets and asteroids by date (NASA SBDB)", icon `travel_explore`, tint accentDanger → `/tools/discoveries`
- **Tracker** — subtitle "Track a comet or asteroid live (JPL Horizons)", icon `gps_fixed`, tint accentPrimary → `/tools/tracker`

`/tools/tracker` additionally accepts an in-memory navigation "extra" of type `TrackTarget { name, kind, mpcID? }` (used by Discoveries → "Track this object live"). **Web suggestion:** encode as query params, e.g. `/tools/tracker?name=…&kind=asteroid&mpc=…`, and auto-track when `mpc` is present.

History detail (Scan) is pushed as a full-screen dialog route (no URL in Flutter). Web: either a sub-route `/tools/scan/history/:id` or modal.

---

## 2. Shared network layer

One shared HTTP client (Dio) used by all three tools:

- **Connect timeout: 10 s** (global). **Receive timeout: 30 s** default; per-request overrides win (Discoveries asteroid queries use 90 s).
- **Retry interceptor** — for idempotent GET/HEAD only: retries on *transient* failures (connection error, connect timeout, receive timeout, or HTTP 5xx). Max **2 retries** with backoff delays **500 ms then 1500 ms**. Never retries a cancelled request; re-checks cancellation after the backoff sleep before re-issuing.
- **Cancellation** — every fetch takes a cancel token; starting a new operation cancels the in-flight one. Web equivalent: `AbortController` (fetch), one per operation, aborted on new-start/cancel/unmount.

Web note: all three tools' requests are plain GETs with query strings, no headers, no auth. **[CORS-BLOCKED]** applies to every one of them; route through the proxy.

---

## 3. Shared history feature

### 3.1 Persistence

Three identical Drift (SQLite) tables — `scan_history`, `tracker_history`, `discovery_history` — with the exact same shape:

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT, primary key | UUID v4, generated at save time |
| `date` | DATETIME | `DateTime.now()` at save |
| `mode` | TEXT | Scan: `"light"`/`"full"`; Tracker & Discoveries: `"comet"`/`"asteroid"` |
| `payloadJson` | TEXT | JSON blob (schemas per tool below) |
| `errored` | BOOL, default `false` | Only Scan sets it to true (partial-error scans) |

**Web equivalent:** IndexedDB (e.g. one object store per tool, indexed on `date`), or localStorage with care about size (scan payloads are small; a pre-1900 discovery search payload can hold up to 50 000 objects → IndexedDB strongly recommended).

### 3.2 Read behavior

- `watchAll()` streams rows **newest-first**, capped at **`kHistoryLimit = 100`** rows. Older rows remain on disk but are never loaded.
- Payload decoding is **lazy**: the list entry keeps `payloadJson` as a string; `detail` parses on first access and caches. A corrupt payload throws at access time and must degrade only that row, never the whole list (see corrupted-row tile below).
- Row construction from columns is guarded: a malformed row is logged and skipped rather than erroring the stream.

### 3.3 Shared history bottom sheet (`HistorySheet`)

Presentation: draggable modal bottom sheet, initial 85% height, min 50%, max 95%, top radius 22, `bgDeepest`, AppBackground **without scanlines**.

App bar: transparent; leading text button **"Done"** (Inter 15 `textSecondary`, width 80) closes the sheet; centered title (per tool); trailing action:

- When entries exist: a `delete_outline` icon button in `accentDanger`, tooltip = the clear-dialog title (per tool). Hidden when list empty or loading.
- **When the provider itself errors, the delete button is STILL shown** so a user can purge a poisoned store.

Clear-all flow: AlertDialog on `bgElevated`; title per tool (headline); content = per-tool message (body); actions: **"Cancel"** (body, `textSecondary`) and **"Delete all"** (body, `accentDanger`). On confirm: warning haptic + delete the whole table.

Single-delete flow (long-press a row, or the corrupted tile): AlertDialog, per-tool title (e.g. "Delete scan?"), no content text, actions **"Cancel"** / **"Delete"** (`accentDanger`). On confirm: warning haptic + delete row by id.

Body states:

- **Loading:** centered circular spinner.
- **Empty:** centered column — `history` icon 48px accentPrimary @ 40% alpha; 8px gap; per-tool empty title (headline); 4px gap; optional subtitle (caption). Padding 24.
- **Error:** centered column — `warning_amber_rounded` 48px accentDanger @ 60%; per-tool error title (headline); then caption, centered: **"Some saved data may be corrupted. Use the delete button above to clear history and recover."**
- **Data:** virtualized list, rows spaced 8px apart, padding (12, safe-top + toolbar + 8, 12, 32). Each row is tool-specific (below). If building one row throws (corrupt payload), render the **corrupted tile** instead: GlassCard row = `warning_amber_rounded` 18px accentDanger @ 80%, 12px gap, column [ "Corrupted entry" (body), 2px, "Long-press to delete this entry." (caption) ]. Long-press (web: context-menu or a small ⋯ button) opens the single-delete confirm.

---

## 4. Tool: System Scan

**Route:** `/tools/scan`. App bar title **"System Scan"**. Tooltips: "How this tool works", "Scan history".

### 4.1 Screen layout (top → bottom, all inside one scroll view)

1. `TransmissionHeader` — label **"ESSI · deep space monitoring"** (rendered uppercase). 16px gap after (all inter-card gaps on this page are 16px / `lg`).
2. **Transparency card** (GlassCard):
   - Header row: `wifi_tethering` icon 18px `accentWarn` + 8px + **"Network access required"** (headline).
   - 8px; body caption: **"This is one of a few Underdeck features that reach the network (System Scan, Tracker and Discoveries). Calls are made one at a time with a small gap, to stay under JPL Horizons' rate limit."**
   - 8px; divider (1px, borderSubtle @ 40%); 8px.
   - Six bullet rows (label column width 88, JetBrainsMono 11/600 `accentPrimary`; value JetBrainsMono 11 `textSecondary`; vertical padding 1):
     - `Endpoint:` — `ssd.jpl.nasa.gov/api/horizons.api`
     - `Sent:` — `Planet codes (199-999) and the current UTC timestamp`
     - `Received:` — `Public ephemeris text (X, Y, Z heliocentric vectors)`
     - `Locally:` — `Sector (1-12) and distance in SL`
     - `To NASA:` — `Your IP address (like any web request)`
     - `Stored:` — `Nothing sent to a server (scans are saved locally on your device)`
   - 8px; caption: **"This feature is opt-in: nothing happens until you tap Scan now."**
3. **Mode card** (GlassCard):
   - SectionHeader **"Mode"** with icon `tune`; 12px gap.
   - Segmented control (2 options) — container: `bgGlass` fill, radius 8, 1px borderSubtle, 2px inner padding; each segment expands equally, vertical padding 8; selected segment: fill accentPrimary @ 16%, radius 6 (sm − 2), 1px accentPrimary border; label JetBrainsMono 12/600, selected `accentPrimary` else `textSecondary`. Labels: **"Light"**, **"Full"**. Disabled while scanning (55% opacity, taps ignored). Selecting fires a selection haptic.
   - 12px; mode summary (body):
     - Light: **"Current sector and distance for each planet."**
     - Full: **"Light data plus the next sector change for each planet (more API calls)."**
   - 4px; row: `schedule` icon 12px `accentWarn`, 6px gap, **"Estimated time: ≈ 10 to 20 seconds"** (Light) / **"Estimated time: ≈ 45 to 120 seconds"** (Full) in JetBrainsMono 11/500 `accentWarn`.
4. **Action card** (GlassCard):
   - Idle: `NeonButton` — title **"Scan now"**, icon `center_focus_strong`.
   - Scanning: row = 18×18 spinner (stroke 2, `accentPrimary`), 8px, text **"Scanning… {progressCount}/9"** (JetBrainsMono 13/500 `accentSecondary`), and a stop icon-button (`stop_circle` 26px `accentDanger`, tooltip **"Stop scan"**; warning haptic on press).
   - When `lastScannedAt != null` and not scanning: 8px gap then **"Last scan: HH:mm:ss local"** (local time, JetBrainsMono 11 `textSecondary`).
5. **Results card** (GlassCard):
   - Header row: SectionHeader **"Solar system snapshot"** icon `public` (expanded), and — only when at least one row is OK and not scanning — an `ios_share` icon button 18px `accentPrimary`, tooltip **"Share scan"**.
   - 12px; then the 9 planet rows, separated by 1px dividers (borderSubtle @ 30%, vertical margin 2).

### 4.2 Planet row (`PlanetResultRow`)

Row (vertical padding 4), 55% opacity while pending:

- Leading: **planet glyph** (32×32; see 4.3).
- 12px gap; column: planet name (body); 2px; secondary status line (JetBrainsMono 10):
  - pending → `pending` in `textDim`
  - ok with a known next change → `→ sector {toSector} on {date}` — date format `d MMM yyyy, HH:mm` local, or `d MMM yyyy` if > 365 days away. Color by proximity: ≤ 30 days `accentSuccess`, ≤ 365 days `accentWarn`, else `accentDanger`.
  - ok without next change (Light mode) → the sample timestamp `HH:mm:ss` local, `textDim`
  - errored → the error message (max 2 lines, ellipsis) in `accentDanger`
- Trailing:
  - pending → `radio_button_unchecked` icon 18px `textDim`
  - ok → column right-aligned: baseline row [ "Sector" JetBrainsMono 10/500 `textSecondary`, 4px, `{sector}` JetBrainsMono 16/600 `accentPrimary` ]; 2px; `{distanceSL} SL` JetBrainsMono 11 `accentSecondary`.
  - errored → `error` icon 20px `accentDanger`

### 4.3 Planet glyph (decorative canvas)

Per-planet colored disc inside a 32×32 box. Data table:

| Planet | diameter px | lightColor | darkColor | scanColor |
|---|---|---|---|---|
| Mercury | 11 | `#C8B594` | `#6F5F44` | accentSecondary `#7AE3FF` |
| Venus | 18 | `#F0C988` | `#9C6E2F` | accentSecondary |
| Earth | 18 | `#6CB4F7` | `#2C5990` | `#9DDCFF` |
| Mars | 14 | `#E8745A` | `#8C2E1A` | `#FFB0A0` |
| Jupiter | 26 | `#E8B270` | `#8E5826` | `#FFD79A` |
| Saturn | 22 | `#F0DA9C` | `#9C7E36` | accentSecondary |
| Uranus | 19 | `#9CEBE0` | `#3F8478` | `#9DDCFF` |
| Neptune | 19 | `#6F88F0` | `#2C3FA2` | `#9DDCFF` |
| Pluto | 10 | `#C2A8C4` | `#694E6B` | accentSecondary |

Rendering layers (canvas or SVG):
1. **Halo**: radial gradient circle, base radius 16, from `lightColor` @ (0.55 × haloOpacity) to transparent. Animated: scale oscillates 0.85→1.0 and opacity 1.0→0.55, ease-in-out, 1600 ms, ping-pong.
2. **Body**: circle radius diameter/2, linear gradient top-left→bottom-right lightColor→darkColor.
3. **Glow**: same circle, `lightColor` @ 55% with 2px blur.
4. **Border**: 0.5px stroke white @ 22%.
5. **Saturn ring**: ellipse rotated −22°, width diameter×1.85, height diameter×0.5; two strokes: lightColor @ 50% width 0.5, darkColor @ 90% width 1.2.
6. **Scan arc** (animated only): arc radius (diameter+5)/2, sweep 0.18×360° ≈ 64.8°, stroke `scanColor` width 1.4 round-cap with 1.5 blur; rotates a full revolution every 4500 ms; per-planet phase offset = planetIndex × 0.41 × 90°.

Static variant (no halo pulsing at mid-state 0.5, no scan arc rotation — arc omitted) used in share cards and when the app "reduce animations" setting or OS reduced-motion is on. Web: honor `prefers-reduced-motion`.

### 4.4 State machine (`ScanState`)

```ts
type ScanMode = 'light' | 'full';
interface ScanState {
  mode: ScanMode;              // default 'light'
  isScanning: boolean;         // default false
  progressCount: number;       // 0..9
  rows: PlanetRow[];           // always 9, initial status 'pending'
  lastScannedAt: Date | null;
}
type PlanetRowStatus = { pending } | { ok: PlanetPosition } | { errored: ScanError };
```

- `setMode` ignored while scanning.
- `startScan()`:
  1. Cancel any in-flight scan (generation counter — a stale run must never write state or persist after being superseded/cancelled).
  2. Reset all 9 rows to pending, `progressCount = 0`, `isScanning = true`. Snapshot the mode at start (mode changes mid-run don't apply).
  3. **Sequentially** for each of the 9 planets: fetch (Light or Full, below); on success mark the row ok; on tool error mark errored (except cancellation → break the loop); on unknown exception mark errored with the "Couldn't parse" error. After each planet: `progressCount = i + 1`; if not last, **sleep 200 ms** (`interRequestDelay`) before the next request.
  4. After the loop (only if still the current generation): set `isScanning = false`, `lastScannedAt = now`. If ≥ 1 row is OK, **persist to history** with `mode`, all OK snapshots, and `errored = rows.any(isErrored)`.
- `cancel()`: abort the in-flight request, bump generation (so the loop's tail is skipped — no lastScannedAt stamp, no persist), set `isScanning = false`.
- `canShare` = not scanning AND ≥ 1 OK row.

### 4.5 Horizons client — Light fetch

**[CORS-BLOCKED]** `GET https://ssd.jpl.nasa.gov/api/horizons.api` with query parameters (note the **literal single quotes are part of each value** — a Horizons quirk):

```
format=text
COMMAND='<code>'        // Mercury 199, Venus 299, Earth 399, Mars 499, Jupiter 599,
                        // Saturn 699, Uranus 799, Neptune 899, Pluto 999
OBJ_DATA='NO'
MAKE_EPHEM='YES'
EPHEM_TYPE='VECTORS'
CENTER='500@10'
OUT_UNITS='KM-S'
START_TIME='YYYY-MM-DD HH:mm'   // now, UTC
STOP_TIME='YYYY-MM-DD HH:mm'    // now + 1 hour, UTC
STEP_SIZE='1h'
QUANTITIES='1'
```

Timeouts: 30 s send/receive per call. Response type: plain text. Non-200 → `ScanHttpError(status)`.

Parse the first position (see 4.7); if the payload has no `$$SOE` marker → `ScanApiMessageError(preview)`; if parseable but empty → `ScanNoDataError`. Compute metrics (4.8) → `PlanetPosition { name, emoji, sector, distanceSL, timestamp }`.

Planet emojis (stored in payloads, used in share/detail contexts): Mercury `☿`, Venus `♀`, Earth `🌍` (U+1F30D), Mars `♂`, Jupiter `♃`, Saturn `♄`, Uranus `♅`, Neptune `♆`, Pluto `♇`. (The live scan UI draws glyphs, not these emojis, but they're serialized.)

### 4.6 Horizons client — Full fetch (next sector change)

Per planet: one **broad** sweep request (same params, but `START_TIME = now`, `STOP_TIME = now + broadDays`, `STEP_SIZE = broadStep`), then optionally one **refinement** request.

Per-planet windows:

| Planet(s) | broadDays | broadStep | precision half-window (hours) | precisionStep |
|---|---|---|---|---|
| Mercury, Venus, Earth, Mars (and default) | 60 | `1h` | ±12 h | `1m` |
| Jupiter | 540 | `12h` | ±18 h | `5m` |
| Saturn | 4 × 365 = 1460 | `1d` | ±48 h | `30m` |
| Uranus | 10 × 365 = 3650 | `2d` | ±72 h | `1h` |
| Neptune | 20 × 365 = 7300 | `7d` | ±240 h | `6h` |
| Pluto | 30 × 365 = 10950 | `14d` | ±480 h | `12h` |

Algorithm:
1. Parse **all** positions of the broad sweep. Empty → `ScanNoDataError`. First sample gives current sector + SL.
2. Walk samples in order computing each sector; the first sample whose sector differs from the previous one gives `rough` (its date) and `nextSectorRaw` (its sector). If no transition in the window → result has `nextChange = null`.
3. If a transition was found: sleep 200 ms, then fetch the refinement window `[rough − halfWindow, rough + halfWindow]` at `precisionStep`; walk it the same way; first transition found becomes the precise `NextSectorChange { date, toSector }`. **Any error in the refinement call is swallowed** and the rough transition is used instead.

### 4.7 Horizons text parsing rules (shared by Scan and Tracker)

The response is a plain-text document. The ephemeris lives between the markers `$$SOE` and `$$EOE`.

- If `$$SOE` is absent → the payload is not an ephemeris (e.g. "API SERVER BUSY", rate-limit notice). Raise a distinct "format" error carrying a **preview**: collapse all whitespace runs to single spaces, trim, take the first 200 chars.
- Body = substring between the markers (to end of text if `$$EOE` missing). Split on `\n`; walk lines (trimmed):
  - A line containing `A.D.` is a **date line**. Take the text after the last `A.D.` and before the first `TDB`, trim → parse as `yyyy-MMM-dd HH:mm:ss.SSSS` where MMM ∈ {Jan…Dec} (English, locale-independent). Fractional seconds → milliseconds (rounded). Interpret as **UTC**. Malformed → skip (pendingDate stays null).
  - A line matching (anchored at line start, tolerant of spacing and scientific notation) `X = <num> Y = <num> Z = <num>` is a **vector line** (regex: `^X\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)\s+Y\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)\s+Z\s*=\s*(-?[\d.]+(?:[eE][+-]?\d+)?)`). The anchor prevents matching the `VX= VY= VZ=` velocity line. Combined with the pending date → one raw position (x, y, z in **km**, heliocentric).
  - Everything else is ignored.

Sample response excerpt (for tests):

```
$$SOE
2461164.500000000 = A.D. 2026-May-04 00:00:00.0000 TDB
 X =-3.012345678901234E+07 Y = 4.567890123456789E+07 Z = 1.234567890123456E+06
 VX=-5.123456789012345E+01 VY=-2.345678901234567E+01 VZ= 3.456789012345678E+00
 LT= 1.234567890123456E+02 RG= 5.678901234567890E+07 RR= 1.234567890123456E+01
$$EOE
```

### 4.8 Sector & SL math (THE core formulas)

Inputs x, y in km (Z ignored — the game map is 2D in the ecliptic):

```
distance_km    = sqrt(x*x + y*y)
distance_miles = distance_km * 0.621371
distance_SL    = floor(distance_miles / 3_000_000)        // 1 SL = 3,000,000 miles (game convention)

theta = atan2(y, x)                 // radians, [-π, π]
if (theta < 0) theta += 2π          // wrap to [0, 2π)
raw    = floor(theta * 12 / (2π))   // 0…11
sector = ((raw + 12) % 12) + 1      // 1…12  (the +12 %12 guards the θ==2π float edge)
```

Sectors count counter-clockwise from the +X axis.

### 4.9 Scan error taxonomy (messages shown verbatim in the row)

| Error | Trigger | Message |
|---|---|---|
| `ScanOfflineError` | connection error / connect timeout / receive timeout | `No internet connection.` |
| `ScanHttpError(status)` | non-2xx response | `JPL Horizons returned HTTP {status}.` |
| `ScanUnparseableError` | other transport failure or unknown exception | `Couldn't parse JPL Horizons response.` |
| `ScanApiMessageError(detail)` | payload lacks `$$SOE` | `JPL Horizons returned an unexpected response: {200-char preview}` |
| `ScanNoDataError` | parsed but zero positions | `JPL Horizons returned no position data.` |
| `ScanCancelledError` | user cancel | `Scan cancelled.` (never rendered — cancellation breaks the loop) |

### 4.10 Scan history persistence payload

```json
{ "snapshots": [ {
    "name": "Mercury", "emoji": "☿", "sector": 7, "distanceSL": 12,
    "timestamp": "2026-05-04T12:00:00.000Z",
    "nextChange": { "date": "2026-06-01T03:04:00.000Z", "toSector": 8 }   // optional
} ] }
```

`mode` column = `"light"` | `"full"`; unknown/missing mode decodes as `light`.

### 4.11 Scan history sheet

Title **"Scan history"**. Empty: **"No scans yet"** / subtitle **"Run a scan from the Tools tab to populate history."** Error title: **"Couldn't load scan history"**. Clear dialog: title **"Delete all scans?"**, message **"All saved scans will be removed. This can't be undone."** Delete dialog title: **"Delete scan?"**

Row (GlassCard, tap → detail view with tap haptic; long-press → delete confirm):
- Leading icon: `check_circle` 18px `accentSuccess`, or `warning` 18px `accentWarn` if the entry's `errored` flag is set.
- 12px; column: date `d MMM yyyy, HH:mm:ss` local (body); 2px; row of [ mode badge: bordered pill (border 0.7px accentPrimary @ 60%, radius 3, padding 5×2) containing `LIGHT`/`FULL` in JetBrainsMono 10/700 letter-spacing 1 `accentPrimary`; 6px; `{count} planet(s)` caption ("1 planet", "9 planets") ].
- Trailing: `chevron_right` icon `textDim`.

### 4.12 Scan history detail view

Full-screen dialog. App bar: transparent, leading text-button **"Close"** (pops), centered title = entry date `d MMM, HH:mm` local (headline). Body scroll (padding as usual):

1. GlassCard: SectionHeader **"Scan"** icon `center_focus_strong`; 8px; row [ full date `d MMM yyyy, HH:mm:ss` (body, expanded) + mode badge (same pill, padding 6×3, letter-spacing 1.5) ].
2. 16px; GlassCard: header row [ SectionHeader **"Snapshot"** icon `public` + (if any snapshots) `ios_share` 18px button tooltip **"Share scan"** ]; 12px; the planet rows (all OK status) with 1px @30% dividers — same `PlanetResultRow` as the live screen.

---

## 5. Tool: Celestial Discoveries

**Route:** `/tools/discoveries`. App bar title **"Discoveries"**. Tooltips: "How this tool works", "Search history".

### 5.1 Screen layout (top → bottom)

1. `TransmissionHeader` — label **"ESSI · deep space discovery"**.
2. **Transparency card** (GlassCard):
   - Header: `wifi_tethering` 18px `accentWarn` + **"Network access required"** (headline).
   - Caption: **"This tool sends a single GET request to the NASA SBDB Query API. Nothing happens until you tap Search."**
   - Divider (borderSubtle @ 40%).
   - Bullets (label width 88; same style as Scan):
     - `Endpoint:` — `ssd-api.jpl.nasa.gov/sbdb_query.api`
     - `Sent:` — `Object kind (comet or asteroid) + a date range`
     - `Received:` — `JSON list of bodies matching the filter`
     - `Locally:` — `Status icon + optional client-side date filter for pre-1900 dates`
     - `To NASA:` — `Your IP address (like any web request)`
     - `Stored:` — `Nothing sent to a server (searches are saved locally on your device)`
3. **Query card** (GlassCard):
   - SectionHeader **"Query"** icon `event_note`; 12px.
   - **Kind pills** — fully-rounded segmented control (container: `bgGlass`, radius 999, 1px borderSubtle, 3px padding; each option expands, vertical padding 9; selected: fill accentPrimary @ 18%, radius 999, 1px border accentPrimary @ 70%, box-shadow accentPrimary @ 20% blur 12; 180 ms animated transition; label JetBrainsMono 12/700 letter-spacing 1, selected `accentPrimary` else `textSecondary`). Labels: **"Comets"**, **"Asteroids"**. Disabled while searching. Selection haptic.
   - 12px; **Start date row**: label **"Start"** (caption, weight 600, letter-spacing 0.4, fixed width 56) …spacer… date chip (fill accentPrimary @ 10%, radius 14, 1px border accentPrimary @ 55%, padding 12×8; text `d MMM yyyy` in body/600 `accentPrimary` + 6px + `expand_more` icon 16px accentPrimary). 50% opacity + disabled while searching. Opens a date picker.
   - 8px; **End date row**: label **"End"**, same chip.
   - 8px; **window summary chip**: full-width container, fill accentSecondary @ 8%, radius 8, border 0.7px accentSecondary @ 35%, padding 8×6; text `"{yyyy-MM-dd} → {yyyy-MM-dd} · {N} day(s) (UTC)"` JetBrainsMono 11/500 `accentSecondary` ("1 day" singular).
   - 8px; **latency hint** row: icon 14px (`timer_outlined` if asteroid or wide window, else `schedule`), tint `accentWarn` if asteroid else `accentPrimary`; then column:
     - `"Estimated time: {lo} to {hi} seconds"` JetBrainsMono 11/500, same tint.
     - 2px; caption:
       - asteroid: **"Asteroid queries are slower than comet queries (the SBDB indexes millions of bodies). Timeout is set to 90 seconds."**
       - comet + wide window: **"Wide windows return more rows. Timeout is 30 seconds; if you hit it, narrow the range."**
       - comet normal: **"Comet queries return quickly. Timeout is 30 seconds."**
   - If start year < 1900: 8px; row [ `info_outline` 14px `accentWarn`; 8px; caption **"Pre-1900 start dates trigger a broader query and a local filter. May take significantly longer."** ].
4. **Action card** (GlassCard):
   - Idle: NeonButton **"Search"**, icon `travel_explore`.
   - Searching: 18×18 spinner + **"Querying SBDB…"** (JetBrainsMono 13 `accentSecondary`) + stop button (`stop_circle` 26 `accentDanger`).
5. **Error card** (only when `errorMessage != null`): GlassCard with row [ icon `timer_off_outlined` (if offline/timeout) else `warning_amber`, 18px `accentDanger`; 8px; message (body) ]. If timeout: extra caption **"Try narrowing the window, or shifting the dates so the query lands inside SBDB's indexed range."**
6. **Results section** (only when `results != null`):
   - Empty: GlassCard — row [ `search_off` 18px `accentWarn` + **"No matches"** (headline) ]; 8px; caption **"No {comets|asteroids} were discovered between {yyyy-MM-dd} and {yyyy-MM-dd}. Try a wider window or shift the dates."**
   - Non-empty: GlassCard — header row [ SectionHeader **"Results · {N}"** icon `list` + `ios_share` 18px button tooltip **"Share results"** ]. If `truncated`: warning banner (fill accentWarn @ 10%, radius 8, border 0.7px accentWarn @ 50%, padding 8): `warning_amber` 16px accentWarn + caption in accentWarn: **"Results truncated — SBDB capped this reply at its row limit, so more matches almost certainly exist. Narrow the date range for a complete list."** Then 8px and one **discovery card** per object, 8px apart.

**Discovery card** (nested GlassCard, tap haptic + opens the detail sheet):
- Leading: status bar — 8×50 rounded-2 rect colored by status (ok `accentSuccess`, caution `accentWarn`, danger `accentDanger`, unknown `textSecondary`).
- 12px; column: display name (body); 2px; row of [ kind emoji (☄ comet / ◯ asteroid, font-size 12); 4px; `firstObs` or `?` (JetBrainsMono 11 `textSecondary`); if diameter known: 6px + `"{diameter, 1 decimal} m"` (JetBrainsMono 11 `textDim`); if hazardous: 6px + **"PHA"** (JetBrainsMono 10/700 `accentDanger`) ].
- Trailing: `gps_fixed` icon 18px `accentPrimary`.

### 5.2 Date pickers

Material date picker dialog, range **1800-01-01 … today** (both pickers share the bounds; "today" = local calendar date). Dark theme mapping: primary `accentPrimary`, onPrimary `bgDeepest`, surface `bgCard`, onSurface `textPrimary`, surfaceContainerHigh `bgElevated`, onSurfaceVariant `textSecondary`, dialog background `bgCard`. Web: any date-picker component with a fast year grid (the range is wide).

Clamping rules: picking a start after the current end drags the end forward to it; picking an end before the current start drags the start back to it (range never inverts).

### 5.3 State (`CelestialState`)

```ts
interface CelestialState {
  kind: 'comet' | 'asteroid';    // default 'comet'
  startDate: Date;               // default: yesterday(local midnight) − 10 days
  endDate: Date;                 // default: yesterday(local midnight)
  isSearching: boolean;
  results: DiscoveredObject[] | null;  // null until first success; kept during re-search
  resultsTruncated: boolean;
  errorMessage: string | null;
  timedOut: boolean;             // true only for the offline/timeout error (drives icon + hint)
}
windowDays = floor((endDate - startDate) in days)
expectedSeconds:  comet & windowDays<11 → 1–4 s;  comet otherwise → 4–20 s;
                  asteroid & windowDays<11 → 5–30 s;  asteroid & windowDays<31 → 20–60 s;  asteroid else → 30–90 s
isWideWindow: asteroid → windowDays > 10;  comet → windowDays > 30
```

`search()` flow: cancel in-flight; set `isSearching = true`, clear error/timeout/truncated (keep old results visible); call the client; **save to history on success (even for 0 results)**; only the newest request may write state (identity check — a superseded request's error must not clobber the newer search's state); on success set results + truncated, `isSearching = false`, haptic success (or warning haptic if 0 results). On `CelestialCancelledError`: just `isSearching = false`, keep prior results, no error. On other CelestialError: `results = null`, `errorMessage = e.message`, `timedOut = (e is offline)`, warning haptic. Unknown exception → `errorMessage = "Unexpected error."`

`cancel()`: abort, `isSearching = false` (prior results retained).

History replay (tap a history row): closes the sheet and applies `{kind, startDate, endDate}` to the form in one shot; **does not auto-search**.

### 5.4 SBDB Query client

**[CORS-BLOCKED]** `GET https://ssd-api.jpl.nasa.gov/sbdb_query.api`

Date validation before the request (calendar-date semantics; never let time zones shift the picked y/m/d): compare pure dates; if `start > end` or `end > today` → `CelestialDateOutOfRangeError` (message **"Pick a date no later than today."**). Format dates as `YYYY-MM-DD` straight from the calendar fields.

`isHistorical = startDate.year < 1900`. `limit = 50000` if historical else `1000`.

Query parameters:

```
fields = full_name,name,kind,pdes,first_obs,last_obs,pha                    // comets
fields = full_name,name,kind,pdes,first_obs,last_obs,pha,diameter,albedo   // asteroids
sb-kind = c | a          // comet / asteroid
limit   = 1000 | 50000
sb-cdata = {"AND":["first_obs|RG|<start>|<end>"]}    // OMITTED entirely when isHistorical
```

`sb-cdata` is a JSON string whose clause values use SBDB's pipe mini-language (`field|OP|v1|v2`); it must be URL-encoded as usual. Timeouts: **90 s** send+receive for asteroids, **30 s** for comets. Response: JSON.

Truncation: SBDB gives no "more rows" flag; if `data.length >= limit`, mark `truncated = true`.

**Historical (pre-1900) strategy:** SBDB's `first_obs` filter misbehaves for lower bounds before 1900, so the client fetches the whole catalog (no `sb-cdata`, limit 50000) and filters client-side: keep rows whose `first_obs` parses as a date and satisfies `start ≤ first_obs ≤ end` (rows with missing/unparseable `first_obs` are dropped in historical mode).

**Parsing rules:**
1. Build a name→index map from the response `fields` array — never assume column order.
2. Cell decoding is tolerant: strings, numbers, or null anywhere; numbers may arrive as strings (`parseFloat` fallback); empty strings count as null.
3. Drop rows with missing/empty `pdes`.
4. `diameter` arrives in **kilometres**; convert to **metres** (×1000) — the 140 m threshold and every "X m" display depend on this.
5. `pha` is `'Y'`, `'N'`, or null; `isHazardous = (pha === 'Y')`.
6. Sort ascending by `first_obs` (missing treated as empty string → sorts first).

Response shape (for the proxy/tests):

```json
{
  "signature": {"source": "NASA/JPL Small-Body Database Query API", "version": "1.5"},
  "count": 2,
  "fields": ["full_name", "pdes", "first_obs", "last_obs", "pha"],
  "data": [
    ["       1P/Halley",   "1P",       "1835-08-05", "2017-03-22", null],
    ["       (2020 AB1)",  "2020 AB1", "2020-01-15", "2020-04-22", "N"]
  ]
}
```

### 5.5 Domain model & status classification

```ts
interface DiscoveredObject {
  designation: string;      // pdes — required
  fullName: string;         // falls back to designation
  firstObs?: string;        // ISO YYYY-MM-DD (string, kept raw)
  lastObs?: string;
  isHazardous: boolean;     // default false
  diameterMeters?: number;
  albedo?: number;
  kind: 'comet' | 'asteroid';
}
displayName: trim fullName; if wrapped in a single pair of outer parens, strip them; if empty → designation.
trackingPeriodDays: null unless both obs dates parse; else floor(lastObs − firstObs) in days.
```

**Status (computed locally, top-down, first match wins):**

```
if isHazardous                                  → danger   (🔴)
if asteroid and (diameterMeters ?? 0) > 140     → caution  (🟡)
if (trackingPeriodDays ?? 0) < 3                → caution  (🟡)
else                                            → ok       (🟢)
```

(The enum also has `unknown` (❓) — displayed in share cards / labels but the getter above never returns it in current code; missing obs dates yield `days=0 → caution`. Keep behavior identical.)

Status labels (detail sheet + share card): ok **"Within normal parameters"**, caution **"Short tracking window"**, danger **"Potentially hazardous"**, unknown **"Unclassified"**.

Status explanation (detail sheet, evaluated in THIS order — note it differs from the status order):

```
if isHazardous → "Flagged as potentially hazardous (PHA=Y) by SBDB."
if days < 3    → "Short tracking window — orbit refinement may still be in progress."
if asteroid && diameter > 140 → "Large diameter (>140 m). Worth watching."
else           → "Within normal parameters."
```

### 5.6 Celestial error taxonomy

| Error | Trigger | Message |
|---|---|---|
| `CelestialDateOutOfRangeError` | client-side date validation | `Pick a date no later than today.` |
| `CelestialHttpError(status)` | HTTP error response | `JPL SBDB returned HTTP {status}.` |
| `CelestialUnparseableError` | other transport failure | `Couldn't parse JPL SBDB response.` |
| `CelestialOfflineError` | connection error / timeouts | `No network connection. Check your signal.` (sets `timedOut`) |
| `CelestialCancelledError` | cancel | `Request cancelled.` (not surfaced) |
| (unknown exception) | — | `Unexpected error.` |

### 5.7 Discovery detail sheet

Modal bottom sheet (85% / 50% / 95%, top radius 22, `bgDeepest`, AppBackground without scanlines). App bar: **"Close"** leading; centered title **"Discovery"**; trailing `ios_share` button (tooltip **"Share discovery"**) → shares the single-object card.

Body (padding lg sides):
1. GlassCard: kind emoji (font 30) + 12px + column [ displayName (headline, max 2 lines ellipsis); 2px; row [ "MPC" JetBrainsMono 10/500 `textSecondary`; 4px; designation JetBrainsMono 12/600 `accentSecondary` ] ].
2. 16px; GlassCard: status emoji (font 28) + 12px + column [ status label (Inter 13/600, colored by status); 4px; status explanation (caption) ].
3. 16px; GlassCard **"Details"** (SectionHeader icon `info_outline`), then label/value rows (label JetBrainsMono 12/500 `textSecondary` expanded; value JetBrainsMono 12/600 `textPrimary` right-aligned; vertical padding 2):
   - Kind → "Comets"/"Asteroids" · Designation → pdes · First obs. (if present) · Last obs. (if present) · Tracking → `{N} day(s)` (if computable) · asteroids only: Diameter → `{N} m` (0 decimals, if present), Albedo → 3 decimals (if present), PHA flag → `Yes`/`No`.
4. 16px; GlassCard: NeonButton **"Track this object live"** icon `center_focus_strong` — closes the sheet and navigates to `/tools/tracker` passing `TrackTarget{ name: displayName, kind, mpcID: designation }` (Tracker will auto-track). Below, caption: **"Opens the Tracker tool with this object pre-filled. Sends 1 GET to JPL Horizons."**

### 5.8 Discoveries history

Payload JSON:

```json
{ "startDate": "2020-01-01T00:00:00.000Z", "endDate": "...", "results": [ <DiscoveredObject.toJson>... ] }
```

`DiscoveredObject` JSON keys: `designation, fullName, firstObs, lastObs, isHazardous, diameterMeters, albedo, kind`.

Sheet strings — title **"Discoveries history"**; empty **"No searches yet"** (no subtitle); error **"Couldn't load discoveries history"**; clear title **"Delete all searches?"**, message **"All saved searches will be removed."**; delete title **"Delete search?"**

Row (tap → replay into the form; long-press → delete): kind emoji (font 22); 12px; column [ kind displayName (body); 2px; `"{d MMM yyyy} → {d MMM yyyy}"` (caption) ]; trailing right-aligned column [ result count JetBrainsMono 14/600 `accentPrimary`; **"hits"** caption ].

---

## 6. Tool: Object Tracker

**Route:** `/tools/tracker` (+ optional prefill target). App bar title **"Tracker"**. Tooltips: "How this tool works", "Tracker history".

### 6.1 Screen layout (top → bottom)

1. `TransmissionHeader` — label **"ESSI · real-time object tracking"**.
2. **Transparency card** (GlassCard): `wifi_tethering` 18 `accentWarn` + **"Network access required"** (headline); caption: **"This tool sends up to 5 GET requests to public NASA APIs (JPL Horizons + SBDB). Nothing happens until you tap Track."**
3. **Target card** (GlassCard):
   - SectionHeader **"Target"** icon `center_focus_strong`; 8px.
   - **Text field** — placeholder **"Object name (e.g. Ceres, C/2025 N1)"** (body colored `textDim`); fill `bgGlass`; radius 8; 1px border `borderSubtle`, focused border `borderGlow`; content padding 12×10; text style body; autocorrect/suggestions off; disabled while loading. `onChange` → `setQuery`.
   - **Pinned chips** (only if the user has pinned objects): 12px gap; header row [ `push_pin` icon 12px `accentPrimary`; 4px; **"PINNED"** JetBrainsMono 10/600 letter-spacing 2 `accentPrimary` ]; 6px; wrap (6px gaps) of chips: border 0.7px accentPrimary @ 50%, radius 4, padding 8×4, content = `push_pin` 11px accentPrimary + 4px + label JetBrainsMono 11 `textPrimary`. **Tap** = track that pin immediately (tap haptic; fills the field, prefILLs `{name: label, kind, mpcID: id}`, fires track). **Long-press** = unpin (selection haptic; toggles the favorite off; snackbar **"Unpinned."** for 1500 ms; on failure snackbar **"Couldn't unpin."**).
   - **Suggestion chips** (only when there are catalog suggestions AND no locked MPC id): 8px gap; wrap of chips styled like pinned chips but without the pin icon; content = `"{kindEmoji} {name}"` JetBrainsMono 11 `textPrimary`. Tap: selection haptic, set the field text + query to the suggestion name (which locks its MPC id via exact match). Suggestions = catalog filtered by current kind, name-or-identifier contains the query (case-insensitive; empty query → first N), limit 8, minus any entry whose name equals the current query.
   - 12px; **Kind picker** — same square segmented control as Scan's mode control (labels **"Comets"** / **"Asteroids"**; container `bgGlass` radius 8 border borderSubtle padding 2; selected fill accentPrimary @16% + 1px accentPrimary border). Disabled (55% opacity) while loading **or when an MPC id is locked** (catalog/prefill match pins the kind).
4. **Action card** (GlassCard):
   - Idle: NeonButton **"Track"**, icon `gps_fixed`, **enabled only when query is non-blank and not loading**.
   - Loading: 18×18 spinner + **"Tracking…"** (JetBrainsMono 13 `accentSecondary`) + stop button (`stop_circle` 26 `accentDanger`).
5. **Error card** (phase = errored): GlassCard row [ `warning` icon `accentDanger` (default 24px); 8px; error message (body) ].
6. **Result card** (phase = ready): GlassCard:
   - Header row: SectionHeader **"Position"** icon `public` (expanded) + **pin toggle button** (FavoriteButton: kind `tracked_object`, id = result.mpcID; inactive icon `push_pin_outlined` in `textDim`, active `push_pin` in `accentPrimary`; 18px; tooltip **"Pin object"** / when active **"Remove favorite"**; 36×36 hit area) + `ios_share` 18px button tooltip **"Share track"**.
   - 8px; row: kind emoji (font 22) + 8px + column [ displayName (headline); 2px; `"MPC {mpcID} · {d MMM yyyy}"` (timestamp local, caption) ].
   - 12px; divider (1px borderSubtle); 12px.
   - Info rows (label caption expanded; value JetBrainsMono weight 600, size/color per row; vertical padding 2):
     - **Sector** → `{sector}` — size 22, `accentPrimary`
     - **Distance** → `{slRounded to 3 decimals} SL` — size 14, `accentSecondary`
     - If `slFloor < slRounded`: 4px; caption in `accentWarn`: **"Navigation flooring → {slFloor} SL"**
     - 8px; **AU distance** → 3 decimals · **X (AU)** / **Y (AU)** / **Z (AU)** → 3 decimals each (size 14, `textPrimary`).

### 6.2 Prefill / auto-track

When opened with a prefill target (from Discoveries, history pick, or a pinned chip): the text field is seeded with the name; the controller applies `{query, kind, lockedMpcID}`; **if an MPC id is present, a track fires automatically once** (guarded so it can't double-fire).

### 6.3 State

```ts
type TrackerPhase = 'idle' | 'loading' | { ready: TrackerResult } | { errored: TrackerError };
interface TrackerState {
  query: string;               // default ''
  kind: 'comet' | 'asteroid';  // default 'asteroid'
  phase: TrackerPhase;         // default idle
  lockedMpcID: string | null;  // set when query exactly matches a catalog entry or a prefill provided one
}
```

- `setQuery(value)`: if value exactly matches a catalog entry (case-insensitive name or identifier), lock `{kind: entry.kind, lockedMpcID: entry.identifier}`; else clear the lock.
- `setKind` only changes kind (UI already disables it when locked).
- `track()`: supersede-safe (generation counter). Phase → loading; build target from state; run the client pipeline; save to history; phase → ready. Cancellation → idle. TrackerError → errored. Unknown → errored(unparseable).
- `cancel()`: abort + generation bump; phase → idle.

### 6.4 Curated catalog (`assets/catalog/tracked_objects.json`) — FULL CONTENTS

Bundled asset; on load failure falls back to an empty catalog (log only). Schema per entry: `{ "name": string, "identifier": string, "type": "Asteroid" | "Comet" }` (kind = comet iff `type` lowercased == "comet").

| name | identifier | type |
|---|---|---|
| Ceres | 1 | Asteroid |
| Pallas | 2 | Asteroid |
| Juno | 3 | Asteroid |
| Vesta | 4 | Asteroid |
| Astraea | 5 | Asteroid |
| Hygiea | 10 | Asteroid |
| Davida | 89 | Asteroid |
| Interamnia | 704 | Asteroid |
| Eunomia | 15 | Asteroid |
| C/2025 N1 (ATLAS) | C/2025 N1 (ATLAS) | Comet |
| C/2024 G3 (ATLAS) | C/2024 G3 (ATLAS) | Comet |
| C/2023 A3 (Tsuchinshan-ATLAS) | C/2023 A3 (Tsuchinshan-ATLAS) | Comet |
| C/2022 E3 (ZTF) | C/2022 E3 (ZTF) | Comet |
| C/2021 O3 (PANSTARRS) | C/2021 O3 (PANSTARRS) | Comet |
| C/2020 F3 (NEOWISE) | C/2020 F3 (NEOWISE) | Comet |

(15 entries. The how-it-works text calls it "15 well-known bodies".)

### 6.5 Pinned objects (favorites integration)

Pins live in the generic `favorites` table with `entityType = 'tracked_object'`, `entityId = mpcID` (plus `createdAt`). Toggle = insert/delete. The Tracker view resolves each pinned id against the catalog (case-insensitive match on identifier or name) for a friendly label + kind; unresolvable pins display the raw id and **guess the kind**: comet iff the id matches `^[CPDXAI]/` or `^[0-9]+[PDI]$` (case-insensitive via uppercasing), else asteroid. Pins are sorted by label, case-insensitive. Web: same store in IndexedDB/localStorage.

### 6.6 Tracking pipeline (business logic)

`track(target, catalog)`:

**Step 1 — resolve a canonical MPC designation** (`_resolveMPC`), strategies in order, first hit wins:

- **Tier 0:** target has a non-blank `mpcID` hint (prefill) → use it.
- **Tier 1:** exact catalog match on `target.name` (case-insensitive name/identifier) → use `entry.identifier`.
- Normalize the name: trim; strip one pair of wrapping parens (`"(2020 AB1)"` → `"2020 AB1"`). Empty after cleaning → `TrackerMpcLookupError`.
- **Tier 2:** kind is asteroid AND cleaned name is all digits → it already IS a pdes; use as-is.
- **Tier 3:** SBDB lookup (below) on the cleaned name; if no hit and the name has a trailing parenthetical, retry with it stripped (`"C/2024 G3 (ATLAS)"` → `"C/2024 G3"`).
- **Tier 4:** if the cleaned name contains at least one digit AND one letter, pass it through as-is (Horizons can often resolve designations directly).
- Otherwise → `TrackerMpcLookupError`.

**SBDB single-body lookup** — **[CORS-BLOCKED]** `GET https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<query>`, 30 s timeouts, JSON. Accept HTTP 2xx **and 3xx** (SBDB returns **HTTP 300** with a `list` body on ambiguous queries). Read `object.pdes` (single match) or `list[0].pdes` (ambiguous — take the first). Missing → null. **HTTP 404 → null** (genuine "no such object", lets the next tier run). Connection error/timeouts → `TrackerOfflineError`. Any other HTTP error response → `TrackerHttpError(status)`. Other transport failure → null.

**Step 2 — fetch Horizons vectors with day retry.** Candidates: today (UTC midnight), yesterday, tomorrow — in that order. For each candidate:

Build the COMMAND id from the resolved mpcID:
- comet: strip a leading `C/`, `P/` (case-insensitive) and a trailing parenthetical → e.g. `C/2024 G3 (ATLAS)` → `2024 G3`.
- asteroid: if all digits, append `;` → `1` → `1;` (**critical**: `COMMAND='1'` is the Mercury barycenter; `'1;'` is Ceres). **The `;` must be percent-encoded (`%3B`) in the URL** — many URL encoders leave `;` bare and Horizons truncates the COMMAND at it.

**[CORS-BLOCKED]** `GET https://ssd.jpl.nasa.gov/api/horizons.api` with:

```
format=json
COMMAND='<commandID>'
OBJ_DATA='YES'
MAKE_EPHEM='YES'
EPHEM_TYPE='VECTORS'
CENTER='500@10'
OUT_UNITS='KM-S'
START_TIME='YYYY-MM-DD'          // the candidate day
STOP_TIME='YYYY-MM-DD'           // candidate + 1 day
STEP_SIZE='1d'
```

(Note: no QUANTITIES param here, and format is **json**.) 30 s timeouts. Parse JSON envelope; take the `result` string (the same plain-text ephemeris format as Scan). Empty/missing `result` → try the next candidate. Parse with the shared parser (4.7): a payload without `$$SOE` → `TrackerApiMessageError(preview)` (**not** a retry); zero positions → next candidate.

If a position is found, compute:

```
au_per_km = 1 / 149_597_870.7            // IAU 2012 AU, exact
xAU = x * au_per_km;  yAU = y * au_per_km;  zAU = z * au_per_km
distanceAU     = sqrt(xAU² + yAU²)                       // Z ignored
distance_miles = (distanceAU / au_per_km) * 0.621371     // == distance_km * 0.621371
slExact   = distance_miles / 3_000_000
slRounded = round(slExact * 1000) / 1000                 // 3 decimals (display)
slFloor   = floor(slExact)                               // in-game navigation value
sector    = same atan2 formula as Scan (on raw x, y km — sign-equivalent)
hasFloorWarning = slFloor < slRounded
```

Result: `TrackerResult { mpcID, displayName (= target.name as typed/prefilled), kind, xAU, yAU, zAU, sector, distanceAU, slExact, slRounded, slFloor, timestamp }`.

All three candidates exhausted → `TrackerNoEphemerisError`.

Errors:

| Error | Message |
|---|---|
| `TrackerOfflineError` | `No network connection. Check your signal.` |
| `TrackerHttpError(status)` | `Upstream returned HTTP {status}.` |
| `TrackerUnparseableError` | `Couldn't parse the upstream response.` |
| `TrackerMpcLookupError` | `Couldn't resolve an MPC ID for that target.` |
| `TrackerApiMessageError(detail)` | `JPL Horizons returned an unexpected response: {preview}` |
| `TrackerNoEphemerisError` | `No ephemeris data available for that object right now.` |
| `TrackerCancelledError` | `Request cancelled.` (→ idle, not surfaced) |

### 6.7 Tracker history

Payload JSON = `TrackerResult.toJson`: keys `mpcID, displayName, kind, xAU, yAU, zAU, sector, distanceAU, slExact, slRounded, slFloor, timestamp` (ISO UTC). `mode` column = kind id.

Sheet strings — title **"Tracker history"**; empty **"No tracks yet"** (no subtitle); error **"Couldn't load tracker history"**; clear title **"Delete all tracks?"**, message **"All saved tracks will be removed."**; delete title **"Delete track?"**

Row (tap → close sheet, prefill `{name: displayName, kind, mpcID}` and **auto-track**; long-press → delete): kind emoji (22); 12px; column [ displayName (headline); 2px; entry date `d MMM yyyy, HH:mm` local (caption) ]; trailing column right-aligned [ `"Sector {sector}"` JetBrainsMono 12/600 `accentPrimary`; `"{slRounded to 2 decimals} SL"` caption ].

---

## 7. Share cards

Each tool can export a PNG "share card". Native implementation renders the card off-screen at width **380 logical px, 3× pixel ratio**, forces **no text scaling**, snapshots to PNG, writes a temp file, and opens the OS share sheet with accompanying text. Failure → snackbar **"Couldn't create the share image — try again"** on `accentDanger` background. A tap haptic fires when the share button is pressed.

**Web equivalent:** render the card DOM off-screen → `html-to-image`/`canvas` → PNG blob → `navigator.share({files})` when available, else download the file (`<a download>`). Or simply offer "Download PNG".

Common card chrome: container padding 16, background `bgDeepest` with a top-left→bottom-right linear gradient overlay accentPrimary @ 8% → transparent, 1px `borderSubtle` border (no radius). Full-width 1px dividers at `borderSubtle` @ 50%. Footer row: `wifi_tethering` icon 9px `textDim` + 4px + footer text JetBrainsMono 9 `textDim`.

### 7.1 Scan share card (`ScanShareCard`)

Used from the results card (only OK rows are included) and the history detail. File name `underdeck-scan-{epochMillis}.png`, share text **"Underdeck system scan"**.

- Header: column [ **"UNDERDECK · SYSTEM SCAN"** JetBrainsMono 11/700 letter-spacing 2 `accentPrimary`; 3px; date `"{d} {MMM} {yyyy}, {HH}:{mm}:{ss}"` (English month abbreviations, from the scan date as-is) JetBrainsMono 12 `textSecondary` ] + right-aligned mode pill (`LIGHT`/`FULL`, border 0.7px accentPrimary @ 60%, radius 3, padding 6×3, JetBrainsMono 10/700 letter-spacing 1.5 accentPrimary).
- 12px; divider @50%; 12px; the planet rows (static glyphs, dividers @ 25%); 12px; divider @50%; 8px.
- Footer text: **"Generated by Underdeck · ESSI deep space monitoring"**.

### 7.2 Discoveries list share card (`DiscoveriesListShareCard`)

File `underdeck-discoveries-{epochMillis}.png`, text **"Underdeck discoveries"**.

- Header: column [ **"UNDERDECK · DISCOVERIES"** (same style); 3px; `"{d MMM yyyy} → {d MMM yyyy}"` JetBrainsMono 12 `textSecondary` ] + kind pill (`COMETS`/`ASTEROIDS`).
- Divider; rows capped at **30** objects: status emoji (🟢🟡🔴❓ font 14) + 8px + displayName (body, 1 line ellipsis) + right-aligned firstObs or `?` (JetBrainsMono 11 `textSecondary`); vertical padding 2. If capped: **"+{hidden} more"** caption. Empty list: **"No matches in this window."** caption.
- Footer: **"Generated by Underdeck · ESSI deep space discovery"**.

### 7.3 Discovery object share card (`DiscoveryObjectShareCard`)

File `underdeck-discovery-{epochMillis}.png`, text **"Underdeck discovery"**.

- **"UNDERDECK · DISCOVERY"**; divider; kind emoji 28 + displayName (headline) + `"MPC {designation}"` JetBrainsMono 11 `textSecondary`; divider; status emoji 22 + status label (body); then KV rows (label JetBrainsMono 11 `textSecondary` expanded, value JetBrainsMono 11/600 `textPrimary`): Kind, Designation, First obs., Last obs., Tracking `{N} day(s)`, and for asteroids Diameter `{N} m`, Albedo (3 dp), PHA flag Yes/No — each only if present, same rules as the detail sheet; divider.
- Footer: **"Generated by Underdeck · ESSI deep space discovery"**.

### 7.4 Tracker share card (`TrackerShareCard`)

File `underdeck-track-{epochMillis}.png`, text **"Underdeck tracker"**.

- **"UNDERDECK · TRACKER"**; 3px; date `{d} {MMM} {yyyy}` (local, English months) caption; divider; kind emoji 22 + displayName (headline) + `"MPC {mpcID}"` JetBrainsMono 11 `textSecondary`; 12px; rows (label caption expanded / value JetBrainsMono 600): **Sector** (size 22 accentPrimary), **Distance** `{slRounded 3 dp} SL` (accentSecondary), **AU** (3 dp), **X (AU)**, **Y (AU)**, **Z (AU)**; divider.
- Footer: **"Generated by Underdeck · ESSI real-time tracking"**.

---

## 8. Platform features & web equivalents

| Feature | Where | Native impl | Web suggestion |
|---|---|---|---|
| HTTP to JPL (Horizons ×2 forms, SBDB query, SBDB lookup) | all 3 tools | Dio GETs | **[CORS-BLOCKED]** — proxy required (see banner at top). Keep the 10 s connect / 30–90 s read timeouts via `AbortSignal.timeout` |
| Request cancellation | all 3 tools | CancelToken | `AbortController` |
| Bounded GET retry (2×, 500/1500 ms, transient-only) | shared Dio | interceptor | small fetch wrapper |
| SQLite (Drift) history + favorites | history, pins | drift tables | IndexedDB (recommended) |
| Haptics (tap/selection/success/warning) | buttons, toggles, results | `HapticFeedback.*`, user setting to disable | drop, or `navigator.vibrate` where supported; keep the setting |
| OS share sheet with PNG file | 4 share cards | share_plus + temp file + iPad popover anchor | `navigator.share({files})` with download fallback |
| Off-screen widget → PNG capture | share cards | RepaintBoundary @3× | render card node → canvas (`html-to-image`); fix width 380, 3× scale |
| Clipboard copy | CodeBlocks in how-it-works | `Clipboard.setData` | `navigator.clipboard.writeText` |
| Bundled asset load | tracker catalog | rootBundle JSON | static import / fetch of a bundled JSON |
| Bottom sheets (draggable, snap 0.5/0.85–0.92/0.95–0.97) | how-it-works, histories, discovery detail | showModalBottomSheet | modal drawer/dialog; drag-resize optional |
| Material date picker (1800→today, themed) | Discoveries | showDatePicker | any datepicker w/ year grid; apply the dark theme colors |
| Reduced-motion setting | planet glyphs, pulsing dot | app setting + `MediaQuery.disableAnimations` | `prefers-reduced-motion` + app setting |
| Snackbars | unpin, share failure, favorite failure | ScaffoldMessenger | toast component |
| Long-press gestures | history rows, pinned chips | GestureDetector | context menu / dedicated delete button (mobile-web long-press is unreliable) |
| Navigation "extra" object (TrackTarget) | Discoveries → Tracker | go_router extra | query params |
| Tooltips on icon buttons | app bars, share/pin buttons | Tooltip | `title` attr / tooltip component |

---

## 9. Assets used

- `assets/catalog/tracked_objects.json` — the ONLY asset in this area. Full contents in §6.4. Ship it with the web bundle.
- Fonts (bundled app-wide, from `assets/fonts/` per pubspec): Inter, JetBrainsMono (Quicksand unused here). Self-host as woff2.
- No images. Planet glyphs, backgrounds, hex grid and scanlines are all procedurally drawn.

---

## 10. "How it works" full texts

Reproduce these verbatim. All three sheets share the HowItWorksSheet chrome (§1.4): title **"How it works"**, Close button, and start with a `TransmissionHeader` labeled **"ESSI · how this tool works"**. Every card below is an InfoCard; card titles are SectionHeaders (uppercase, with the noted icon). `CodeBlock` contents must keep exact formatting (they're copyable).

### 10.1 System Scan sheet

**Overview** (icon `search`)
> System Scan asks NASA's JPL Horizons service for the heliocentric position vector of each of the nine planets, then converts (X, Y) into the in-game grid: a sector from 1 to 12 and a distance in SL.
>
> In Full mode, the tool then samples each orbit forward in time to find the moment the planet crosses into its next sector.

**Endpoint** (icon `link`) — KvRows (label width 110):
- Base URL — `https://ssd.jpl.nasa.gov/api/horizons.api`
- Method — `GET`
- Auth — `None. Public, no API key, no token.`
- Rate limit — `Per source IP. Parallel bursts of 9 requests return HTTP 503 about every other time. Sequential calls with a small gap pass cleanly.`
- Docs — `ssd.jpl.nasa.gov/horizons/manual.html`

> JPL Horizons is a free public ephemeris service from NASA's Solar System Dynamics group. Anyone can hit it from any tool: a browser, curl, a Swift app, a Python script.

**Request parameters** (icon `list_alt`)
> Every value must be wrapped in single quotes inside the query string. That is a Horizons quirk, not URL encoding. The single quotes are part of the value.

ParamRows:
- `format` = `text` — Plain text body. Easier to parse than the html or json variants.
- `COMMAND` = `'199' to '999'` — NAIF body code. Mercury 199, Venus 299, Earth 399, Mars 499, Jupiter 599, Saturn 699, Uranus 799, Neptune 899, Pluto 999.
- `OBJ_DATA` = `'NO'` — Skip the body's metadata block. We only want the ephemeris.
- `MAKE_EPHEM` = `'YES'` — Generate the ephemeris.
- `EPHEM_TYPE` = `'VECTORS'` — Cartesian X, Y, Z position vectors instead of RA/Dec angles.
- `CENTER` = `'500@10'` — Origin of the coordinate system. 500 is the standard geocentric body code; @10 redirects to the Sun's barycenter, giving heliocentric output.
- `START_TIME` = `'YYYY-MM-DD HH:mm'` — UTC. Light mode uses now.
- `STOP_TIME` = `'YYYY-MM-DD HH:mm'` — UTC. Light mode uses now + 1h.
- `STEP_SIZE` = `'1h', '1d', '1m'…` — Sampling interval. Smaller = more rows in the response. Pick big enough that the response stays in the low thousands of lines.
- `QUANTITIES` = `'1'` — Only ask for the X/Y/Z vector. Cuts response size by about 70 percent.

**Sample request** (icon `terminal`) — caption "Mercury, position right now:" then CodeBlock:
```
GET https://ssd.jpl.nasa.gov/api/horizons.api
  ?format=text
  &COMMAND='199'
  &OBJ_DATA='NO'
  &MAKE_EPHEM='YES'
  &EPHEM_TYPE='VECTORS'
  &CENTER='500@10'
  &START_TIME='2026-05-04 12:00'
  &STOP_TIME='2026-05-04 13:00'
  &STEP_SIZE='1h'
  &QUANTITIES='1'
```

**Response shape** (icon `description`)
> Horizons returns one big plain-text document with a header (target metadata, request echo), an ephemeris block bracketed by $$SOE / $$EOE markers, and a footer.
>
> Each ephemeris row is two lines: a date line containing 'A.D.' and 'TDB', then a vector line starting with 'X ='. Underdeck only reads those two line types and ignores everything else.
>
> Excerpt:

CodeBlock: (the `$$SOE … $$EOE` excerpt shown in §4.7)

> X, Y, Z are kilometres relative to the Sun's centre. VX/VY/VZ are velocities (km/s). LT is light-time. RG is range. RR is range rate. Underdeck ignores everything except X and Y.

**Parsing** (icon `search`)
> The parser is naive on purpose. Walk the lines: when one contains 'A.D.' grab the date, when the next starts with 'X =' grab the vector, repeat. No regex, no XML, no JSON.
>
> Date format used to decode the timestamp:

CodeBlock: `yyyy-MMM-dd HH:mm:ss.SSSS  (UTC)`

> Locale is forced to en_US_POSIX so 'May' parses regardless of the device language.

**Math** (icon `functions`)
> Two conversions turn (X, Y) in kilometres into the game's grid. Z is ignored: the game's map is 2D in the ecliptic plane.

"Distance in SL" (body) then CodeBlock:
```
distance_km    = sqrt(x*x + y*y)
distance_miles = distance_km * 0.621371
distance_SL    = floor(distance_miles / 3_000_000)
```
> 1 SL = 3,000,000 miles. The constant comes from the East-Shire Utilities bot the app mirrors: it is a game convention, not a physical unit.

"Sector (1 to 12)" (body) then CodeBlock:
```
theta = atan2(y, x)              // radians, range [-π, π]
if theta < 0: theta += 2π        // wrap to [0, 2π)
raw    = floor(theta * 12 / 2π)  // 0…11
sector = ((raw + 12) % 12) + 1   // 1…12
```
> The +12 then mod 12 is defensive: it handles the boundary case where atan2 returns exactly 2π due to floating-point rounding. Sectors are counted counter-clockwise from the +X axis.

**Per-planet windows (Full mode)** (icon `timer`)
> To find the next sector change, Underdeck does a coarse sweep then refines around the first transition. The window has to be wide enough to contain at least one transition: Pluto sits in one sector for years.
>
> Step is sized so each broad response stays in the low thousands of lines. A 30-year window stepped at 1 hour would be 260,000 rows.

WindowRows:
- Mercury / Venus / Earth / Mars — Coarse `60 d, 1h step` · Refine `±12 h, 1m step`
- Jupiter — `540 d, 12h step` · `±18 h, 5m step`
- Saturn — `4 y, 1d step` · `±2 d, 30m step`
- Uranus — `10 y, 2d step` · `±3 d, 1h step`
- Neptune — `20 y, 7d step` · `±10 d, 6h step`
- Pluto — `30 y, 14d step` · `±20 d, 12h step`

**Rate limiting** (icon `speed`)
> Calls are issued sequentially with a 200 ms gap between them. A parallel burst of 9 requests returns HTTP 503 about every other time; a gentle drip never has.

KvRows: Light mode — `9 calls (one per planet).` · Full mode — `9 to 18 calls. One coarse per planet, plus one refinement per planet when a transition is found.` · Timeout — `30 s per call.`

**Privacy** (icon `lock`) — KvRows:
- Sent — `Planet code (199 to 999), UTC timestamp, fixed query string. No identifier of yours is added.`
- Visible to NASA — `Your IP address, like for any web request.`
- Stored remotely — `Nothing on Underdeck servers (there are none). NASA's standard request logs apply on their side.`
- Stored locally — `Successful scans go to local history (no cloud sync in this build). You can delete entries from the history sheet.`
- Opt-in — `Nothing leaves the device until you tap Scan now.`

**Try it yourself** (icon `code`)
> Run this in a terminal to get Mars's current position. The %27 sequences are URL-encoded single quotes; the literal quotes around values are required by Horizons.

CodeBlock:
```
curl "https://ssd.jpl.nasa.gov/api/horizons.api\
?format=text\
&COMMAND=%27499%27\
&OBJ_DATA=%27NO%27\
&MAKE_EPHEM=%27YES%27\
&EPHEM_TYPE=%27VECTORS%27\
&CENTER=%27500@10%27\
&START_TIME=%272026-05-04%2012:00%27\
&STOP_TIME=%272026-05-04%2013:00%27\
&STEP_SIZE=%271h%27\
&QUANTITIES=%271%27"
```
> Look for the X = and Y = values between $$SOE and $$EOE, then apply the two formulas in the Math section. That is the entire pipeline.

**Credits** (icon `star`)
> Ephemeris data: NASA / JPL Solar System Dynamics group, public domain. Sector and SL conventions: East-Shire Utilities Discord bot.

### 10.2 Discoveries sheet

**Overview** (icon `search`)
> Discoveries searches NASA's Small-Body Database (SBDB) for comets or asteroids whose first observation date falls within a window you choose. SBDB indexes every minor body the world's observatories have ever reported: about 1.4 million asteroids and 4,000 comets at the time of writing.
>
> Each result gets a status icon computed locally on the device, mirroring the East-Shire Utilities bot's classification rules.

**Endpoint** (icon `link`) — KvRows (label width **120**):
- Base URL — `https://ssd-api.jpl.nasa.gov/sbdb_query.api`
- Method — `GET`
- Auth — `None. Public, no API key, no token.`
- Rate limit — `No documented hard limit. Underdeck issues one request per Search tap.`
- Docs — `ssd-api.jpl.nasa.gov/doc/sbdb_query.html`

> This is JPL's bulk-query interface to the small-body catalog. The same backend powers the SBDB browser at ssd.jpl.nasa.gov/tools/sbdb_lookup.html and the per-object SBDB API used by the Tracker tool.

**Request parameters** (icon `list_alt`)
> All four parameters go in the query string of a single GET. No body, no headers required.

ParamRows:
- `sb-kind` = `c | a` — 'c' for comets, 'a' for asteroids. Required: SBDB will not return both kinds in the same response.
- `fields` = `comma-separated` — Which columns you want back. Underdeck asks for full_name, name, kind, pdes, first_obs, last_obs, pha, plus diameter and albedo for asteroids. Smaller field lists return faster.
- `sb-cdata` = `JSON object` — The filter. JSON-encoded constraint object using SBDB's mini-language (next section). Skipped entirely for pre-1900 queries.
- `limit` = `1000 or 50000` — 1000 is plenty for any 30-day window. 50000 is used as a safety upper bound when fetching the full pre-1900 catalog without a date filter.

**Constraint mini-language** (icon `functions`)
> sb-cdata is the unusual part. SBDB expects a JSON object whose values are NOT JSON: each clause is a single string with pipe-separated tokens.
>
> Shape:

CodeBlock:
```
{
  "AND": [
    "first_obs|RG|2020-01-01|2020-01-31"
  ]
}
```
> Tokens, in order: field name, operator, then 1 to 2 values depending on the operator.
>
> Operators Underdeck might use:

OpRows: `RG` — Range, inclusive on both ends. Two values: lower, upper. · `EQ / NE` — Equals / not equals. One value. · `LT / LE / GT / GE` — Less / less-equal / greater / greater-equal. One value. · `LK` — SQL-style LIKE pattern, % wildcard. One value. · `NL / NN` — Is null / is not null. No value.

> The full operator set is in the SBDB docs. The whole sb-cdata value is then URL-encoded as the query parameter.

**Sample request** (icon `terminal`) — caption "Comets first observed in January 2020:" then CodeBlock:
```
GET https://ssd-api.jpl.nasa.gov/sbdb_query.api
  ?sb-kind=c
  &fields=full_name,pdes,first_obs,last_obs,pha
  &sb-cdata={"AND":["first_obs|RG|2020-01-01|2020-01-31"]}
  &limit=1000
```
> Shown unencoded for readability. The sb-cdata value must be percent-encoded in the actual request: braces become %7B / %7D, brackets %5B / %5D, pipes %7C, double-quotes %22.

**Response shape** (icon `description`)
> JSON document. The top-level keys are 'signature' (versioning), 'count' (row count), 'fields' (column names in order), and 'data' (an array of arrays, one per body).
>
> Each row is positional: row[i] is the value for fields[i]. Cells are heterogeneous: a single column can return strings, numbers, or null in different rows.
>
> Excerpt:

CodeBlock: (the JSON excerpt in §5.4)

> full_name comes back with leading whitespace and unnumbered designations wrapped in parens. The UI strips both for display. Dates are ISO YYYY-MM-DD strings. The pha field is 'Y', 'N', or null (potentially hazardous asteroid flag).

**Parsing** (icon `search`)
> Three small rules turn the wire format into typed objects:

KvRows (width 120):
- 1. Column map — `Build name→index from the 'fields' array first. Never assume column order: SBDB has reordered fields in the past.`
- 2. Tolerant cells — `Each cell decoder accepts string OR number OR null. SBDB returns dates as strings but diameter as a number, sometimes the same column shifts type across rows.`
- 3. Sort — `Order results by first_obs ascending so the earliest discovery is at the top, matching the bot.`

> Rows where pdes (the canonical designation) is missing are dropped: those are SBDB internal placeholders.

**Status icon (computed locally)** (icon `bubble_chart`)
> After parsing, each object gets one of four icons. The rules are evaluated top-down, first match wins. They mirror the East-Shire Utilities bot's calculate_status function.

StatusRows:
- 🔴 **Potentially hazardous** — pha == 'Y'. SBDB has flagged this asteroid as a Potentially Hazardous Asteroid (close approach within 0.05 AU and absolute magnitude H ≤ 22).
- 🟡 **Caution: large asteroid** — kind = asteroid AND diameter > 140 m. Large enough to matter on impact, even if not currently flagged hazardous.
- 🟡 **Caution: short tracking** — tracking_days < 3, where tracking_days = last_obs − first_obs. The orbit is poorly constrained; future positions are uncertain.
- 🟢 **Within normal parameters** — Default. None of the above triggers.
- ❓ **Unclassified** — Either first_obs or last_obs is missing or unparseable. Status cannot be computed.

> This computation is 100 percent local. SBDB does not return a status field; the 4 buckets are an Underdeck/bot convention to give a quick visual read.

**Pre-1900 quirk** (icon `event_busy`)
> SBDB's first_obs filter behaves erratically when the lower bound is before 1900. Some legitimate rows (Halley, the first numbered minor planets, etc.) get skipped server-side for reasons that are not documented.
>
> When the start date you pick is in 1899 or earlier, Underdeck switches strategy:

KvRows: Server — `Drop the sb-cdata constraint entirely. Set limit=50000.` · Client — `Filter the response locally by parsing each row's first_obs and keeping only those inside [start, end].`

> Cost: bigger response (a few MB instead of a few KB), longer wait. Benefit: no rows quietly missing.

**Timeouts and limits** (icon `schedule`) — KvRows (width **130**):
- Comet timeout — `30 s. The comet table is small (~4,000 rows total).`
- Asteroid timeout — `90 s. SBDB scans 1.4 M asteroid rows; even an indexed query takes time.`
- Result cap — `1,000 rows for normal queries, 50,000 for pre-1900.`

> If you hit the timeout, narrow the date range. Asteroid windows of 10+ days are flagged in the UI for that reason.

**Privacy** (icon `lock`) — KvRows (120):
- Sent — `Object kind, date range (or none for pre-1900), field list, fixed limit. No identifier of yours is added.`
- Visible to NASA — `Your IP address, like for any web request.`
- Stored remotely — `Nothing on Underdeck servers (there are none). NASA's standard request logs apply on their side.`
- Stored locally — `Search results live in memory until you leave the screen or run another search. Each search is logged to local history.`
- Opt-in — `Nothing leaves the device until you tap Search.`

**Try it yourself** (icon `code`)
> Run this in a terminal. The --data-urlencode -G form lets curl handle the percent-encoding of the JSON value for you.

CodeBlock:
```
curl -G "https://ssd-api.jpl.nasa.gov/sbdb_query.api" \
  --data-urlencode "sb-kind=c" \
  --data-urlencode "fields=full_name,pdes,first_obs,last_obs,pha" \
  --data-urlencode 'sb-cdata={"AND":["first_obs|RG|2020-01-01|2020-01-31"]}' \
  --data-urlencode "limit=1000"
```
> Pipe to jq for readable output: append | jq '.data[0:3]' to see the first three rows. Replace 'c' with 'a' for asteroids, but expect a much larger response.

**Credits** (icon `star`)
> Catalog data: NASA / JPL Solar System Dynamics group, public domain. Status classification: East-Shire Utilities Discord bot.

### 10.3 Tracker sheet

**Overview** (icon `search`)
> Tracker takes one celestial body (Ceres, Halley, 2020 AB1, …) and returns its current heliocentric position: an X/Y/Z vector in AU, a sector from 1 to 12, and a distance in SL with three precision flavors (exact, rounded, floored).
>
> Each Track tap fires up to five GET requests across two NASA endpoints. No background work, no caching: every Track is a fresh round-trip.

**Two-step pipeline** (icon `alt_route`)
> Tracking is split into a resolve step and a fetch step. They use different endpoints and have completely different response shapes.

StepRows:
- **1 · Resolve** — Turn the user's input ('Halley', 'Ceres', '2020 AB1', '433') into a canonical MPC designation. Up to one GET, often zero.
- **2 · Fetch** — Ask JPL Horizons for the body's heliocentric vector today. Up to three GETs (today → yesterday → tomorrow) until one returns data.

**Endpoints** (icon `link`) — KvRows (120):
- SBDB single-body — `https://ssd-api.jpl.nasa.gov/sbdb.api`
- Horizons — `https://ssd.jpl.nasa.gov/api/horizons.api`
- Method — `GET on both`
- Auth — `None on either. Public, no API key, no token.`
- Timeout — `30 s per call`

> SBDB is JPL's per-object metadata browser (different from the bulk sbdb_query.api used by Discoveries). Horizons is the ephemeris service shared with System Scan.

**Step 1: resolve a canonical ID** (icon `search`)
> The user types a name. Horizons wants a clean designation. Tracker tries four strategies, in order, and stops at the first hit. The first three avoid network entirely.

TierRows:
- **0 · Prefilled MPC ID** — When you arrive from Discoveries, the canonical pdes is already known. Skip resolve entirely.
- **1 · Curated catalog** — 15 well-known bodies (Ceres, Vesta, Halley-class comets, recent ATLAS comets) are bundled in the app. Match by case-insensitive name. Zero network.
- **2 · Numbered asteroid shortcut** — Input is digits-only and kind is asteroid? It is already a pdes. Use as-is.
- **3 · SBDB sstr lookup** — GET sbdb.api?sstr=<input>. Returns a single match (object.pdes) or an ambiguous list (list[].pdes, take the first). HTTP errors are silently treated as 'not found' so the next tier kicks in.
- **4 · Designation passthrough** — Last resort. If the input has both letters and digits ('2024 G3', 'C/2024 G3 (ATLAS)'), Horizons can resolve it directly. We send it as-is.

**SBDB response shapes** (icon `description`)
> sbdb.api returns one of two JSON shapes depending on whether the query was unambiguous.
>
> Single match (e.g. sstr=Ceres):

CodeBlock:
```
{
  "object": {
    "pdes": "1",
    "fullname": "1 Ceres",
    "kind": "an"
  },
  "phys_par": [...],
  "orbit": {...}
}
```
> Ambiguous match (e.g. sstr=Adams):

CodeBlock:
```
{
  "code": 300,
  "list": [
    {"pdes": "1996", "name": "Adams"},
    {"pdes": "(2009 BJ81)", "name": "..."}
  ]
}
```
> Tracker reads only the pdes string from either shape and discards everything else. The fullname and orbital data are interesting but not needed to fetch a position.

**Step 2: Horizons VECTORS request** (icon `list_alt`)
> Once an MPC ID is resolved, Tracker asks Horizons for one day's worth of position vector. Same endpoint as System Scan but with format=json this time.

ParamRows:
- `format` = `json` — Wraps the Horizons text response inside a JSON envelope. Easier to parse status and error fields than the raw text.
- `COMMAND` = `'<pdes>;'` — The canonical designation. The trailing semicolon matters for numbered asteroids: see the next card.
- `OBJ_DATA` = `'YES'` — Include the object header. Future versions of Tracker may surface mass, magnitude, etc.
- `MAKE_EPHEM` = `'YES'` — Generate the ephemeris (else only the metadata header).
- `EPHEM_TYPE` = `'VECTORS'` — Cartesian X, Y, Z position vectors instead of RA/Dec angles.
- `CENTER` = `'500@10'` — Heliocentric origin. 500 is geocentric; @10 redirects to the Sun's barycenter.
- `START_TIME` = `'YYYY-MM-DD'` — UTC. The retry candidate (today, then yesterday, then tomorrow).
- `STOP_TIME` = `start + 1 day` — A 1-day window with a 1-day step yields exactly one row.
- `STEP_SIZE` = `'1d'` — One sample, no waste.

**Three undocumented quirks** (icon `warning_amber_rounded`)
> Reproducing Tracker without these will hit silent 400s and 'No matches found' errors. None of them are in the obvious places of the JPL docs.

QuirkRows:
- **Numbered asteroids need a trailing ;** — COMMAND='1' resolves to Mercury Barycenter (NAIF major body code). COMMAND='1;' resolves to Ceres (small body 1). Without the semicolon, every query for a numbered asteroid returns the wrong object.
- **; must be percent-encoded as %3B** — Horizons (and many web frameworks) treat an unescaped ; as equivalent to & in the query string, which truncates COMMAND. CharacterSet.urlQueryAllowed includes ; by default, so Underdeck adds an explicit removal.
- **Comet names need stripping** — 'C/2024 G3 (ATLAS)' is the human-readable form. Horizons rejects it with 'No matches found'. We strip the leading C/ or P/ and the trailing parenthetical to get '2024 G3', which Horizons resolves.

**Horizons response (JSON wrap)** (icon `description`)
> With format=json, Horizons returns a thin JSON envelope whose 'result' field contains the same plain-text ephemeris System Scan parses.

CodeBlock:
```
{
  "signature": {"source": "NASA/JPL Horizons API", "version": "1.2"},
  "result": "*****\n Ephemeris / WWW_USER...\n$$SOE\n2461164.500 = A.D. 2026-May-04 ...\n X = 1.234E+08 Y = 5.678E+08 Z = 9.012E+06 ...\n$$EOE\n*****"
}
```
> The 'result' string follows the same conventions as the text mode: an $$SOE/$$EOE-bracketed ephemeris block, dates flagged with 'A.D.' and 'TDB', vectors on lines starting with 'X ='. The same parser System Scan uses works here unchanged.
>
> If the body has no ephemeris for the requested date, 'result' is an empty string or contains 'No ephemeris available'. Both cases land Tracker in the day-retry loop.

**Today / yesterday / tomorrow retry** (icon `refresh`)
> Some bodies (recently observed comets, freshly discovered asteroids) have ephemeris coverage that does not extend to the current UTC day. Rather than fail, Tracker tries the surrounding days.

KvRows (120): Attempt 1 — `today (UTC start of day)` · Attempt 2 — `today minus 1 day` · Attempt 3 — `today plus 1 day`

> First attempt that returns a parseable position wins. If all three are empty, the result is .noEphemerisData and the user gets 'No ephemeris data available for that object right now'.

**Math** (icon `functions`)
> The position vector arrives in kilometres. Three conversions turn it into the units the UI shows. Z is preserved here (Tracker shows it) but ignored when computing sector and distance.

"Position in AU" then CodeBlock:
```
au_per_km = 1 / 149_597_870.7
xAU = x * au_per_km
yAU = y * au_per_km
zAU = z * au_per_km
```
> 149,597,870.7 km is the IAU 2012 value of one astronomical unit, exact.

"Sector (1 to 12), distance in AU" then CodeBlock:
```
distanceAU = sqrt(xAU*xAU + yAU*yAU)
theta = atan2(y, x)              // radians on raw km, sign-equivalent
if theta < 0: theta += 2π
sector = ((floor(theta * 12 / 2π) + 12) % 12) + 1
```

"SL distance, three flavors" then CodeBlock:
```
distance_miles = (distanceAU / au_per_km) * 0.621371
slExact   = distance_miles / 3_000_000      // raw double
slRounded = round(slExact * 1000) / 1000    // 3 decimals, for display
slFloor   = floor(slExact)                  // for in-game navigation
```
> In-game coordinates are integers, so navigation uses the floor. The display shows the rounded value. When floor < rounded the UI flags it: 'navigate to <floor>, not <rounded>', so the player does not overshoot.

**Privacy** (icon `lock`) — KvRows (120):
- Sent — `The object name or designation you typed (or the prefilled pdes from Discoveries), plus a fixed query string. No identifier of yours is added.`
- Visible to NASA — `Your IP address, like for any web request. SBDB and Horizons sit behind ssd.jpl.nasa.gov; both log standard request metadata server-side.`
- Stored remotely — `Nothing on Underdeck servers (there are none).`
- Stored locally — `Each successful track is saved to local history. You can delete entries from the Tracker history sheet.`
- Opt-in — `Nothing leaves the device until you tap Track.`

**Try it yourself** (icon `code`)
> Two-step example for tracking Ceres. Notice the explicit %3B for the trailing semicolon: -G --data-urlencode would not encode it because it is already in CharacterSet.urlQueryAllowed.

"Step 1, resolve the pdes:" then CodeBlock:
```
curl -G "https://ssd-api.jpl.nasa.gov/sbdb.api" \
  --data-urlencode "sstr=Ceres"
# → object.pdes = "1"
```
"Step 2, fetch the vector for today:" then CodeBlock:
```
curl "https://ssd.jpl.nasa.gov/api/horizons.api\
?format=json\
&COMMAND=%271%3B%27\
&OBJ_DATA=%27YES%27\
&MAKE_EPHEM=%27YES%27\
&EPHEM_TYPE=%27VECTORS%27\
&CENTER=%27500@10%27\
&START_TIME=%272026-05-04%27\
&STOP_TIME=%272026-05-05%27\
&STEP_SIZE=%271d%27"
```
> Pipe the second response to jq -r .result to extract the ephemeris text. Look for 'X = ... Y = ... Z = ...' between $$SOE and $$EOE, then apply the math.

**Credits** (icon `star`)
> Catalog metadata: NASA / JPL Solar System Dynamics group, public domain. Curated body list and SL convention: East-Shire Utilities Discord bot.

---

## 11. Open questions

1. **CORS proxy** — the single blocking decision: what proxy will the web app use for `ssd.jpl.nasa.gov` and `ssd-api.jpl.nasa.gov`? (GitHub Pages cannot host one.) The transparency/how-it-works copy says requests go straight to NASA and only NASA sees your IP; if a proxy is introduced, that privacy copy must be amended.
2. **`DiscoveryStatus.unknown` is unreachable** in the current status getter (missing obs dates → days=0 → caution), though the how-it-works text documents ❓ for missing dates and the UI supports it. Decide: replicate the code behavior (recommended: bug-for-bug) or the documented behavior.
3. **Discoveries saves empty-result searches to history and saves before checking supersession** — a cancelled/superseded search may still write a history row. Replicate or tidy?
4. **Scan share date formatting**: the live scan card formats `state.lastScannedAt` (local Date) directly, while the history detail passes the stored entry date; both use English month names irrespective of locale. Keep English-only formatting?
5. **Long-press interactions** (history row delete, chip unpin) need a deliberate web substitute (context menu, swipe, or explicit buttons); the spec suggests explicit buttons for accessibility.
6. **Draggable-sheet fidelity** — how faithfully should the web version mimic snap-point bottom sheets vs. plain modals? Content and copy are identical either way.
7. **Tracker `displayName`** in results is exactly what the user typed (or the prefill name) — it is NOT canonicalized from SBDB. Keep as-is for parity.
8. **History cap** — only the newest 100 entries are ever displayed; older rows are retained but invisible (and "Delete all" wipes them too). Decide whether the web store should prune at write time instead (simpler, slightly different semantics).

# Underdeck — HANGAR Feature Specification (for web recode)

Source of truth: Flutter app `lib/features/hangar/` (+ shared design system, catalog assets, Drift DB tables it uses). Target: Vite + React + TypeScript web app. The web team will NOT see the Flutter code; this document is exhaustive.

---

## Table of contents

1. [Feature overview](#1-feature-overview)
2. [Navigation & routes](#2-navigation--routes)
3. [Shared design tokens used by Hangar](#3-shared-design-tokens-used-by-hangar)
4. [Shared components used by Hangar](#4-shared-components-used-by-hangar)
5. [View: Hangar list (`/hangar`)](#5-view-hangar-list-hangar)
6. [View: Ship editor (modal bottom sheet)](#6-view-ship-editor-modal-bottom-sheet)
7. [Sub-widgets of the editor (pickers, fields)](#7-sub-widgets-of-the-editor)
8. [View: EVIL ship intro (fullscreen easter-egg)](#8-view-evil-ship-intro-fullscreen-easter-egg)
9. [Data models](#9-data-models)
10. [Catalog assets (JSON format + full data)](#10-catalog-assets)
11. [Persistence (Drift tables, SharedPreferences keys)](#11-persistence)
12. [Repository & business logic](#12-repository--business-logic)
13. [State management / loading / error behavior](#13-state-management)
14. [Export / backup involvement](#14-export--backup-involvement)
15. [Platform features & web equivalents](#15-platform-features--web-equivalents)
16. [Complete copy-string inventory](#16-complete-copy-string-inventory)

---

## 1. Feature overview

The Hangar is the "Fleet Registry" of the companion app: a personal list of the player's ships in the game Underpunks55. The user can:

- See all their ships grouped by craft category (Landcraft / Watercraft / Spacecraft / Other), sorted alphabetically.
- Add a ship via a full-height modal editor (name/call sign, model from a catalog, registered flag, location from a catalog with contextual parameters, hull integer, up to 12 crew role names, a free-text note, and tags shared app-wide with Notes/Links).
- Quick-adjust a ship's hull directly from its list card with +/- stepper buttons (clamped to `[0, hullMax]`).
- Delete a ship via long-press → confirm dialog.
- A hidden easter egg: selecting the "EVIL Lawless" spacecraft model triggers a full-screen "captain's log" cinematic intro (star-scroll text + void portal animation), after which the form is auto-filled and partially locked.

There is **no image/photo attachment on ships** and **no direct per-ship share/export UI**. (`image_picker` is used elsewhere in the app — menu/contact view — not in Hangar.) Ships ARE included in the global app backup/export JSON (section 14).

---

## 2. Navigation & routes

- The app uses a 5-tab bottom navigation shell (go_router `StatefulShellRoute`). Tabs in order: **Tools** (`/`… tools branch), **Notes** (`/captures`), **Hangar** (`/hangar`), **Knowledge** (`/knowledge`), **Menu**.
- Hangar tab: label `Hangar`, unselected icon `Icons.inventory_2_outlined` (Material `inventory_2` outlined), selected icon `Icons.inventory_2` (filled). Icon size 22, label font-size 10.5, weight 600, letter-spacing 0.2. Tapping the current tab again resets the branch to its initial location.
- Route: `GoRoute(path: '/hangar')` → `HangarListView`. There are **no sub-routes** in the hangar branch.
- The ship editor is NOT a route: it opens as a **modal bottom sheet** (`showModalBottomSheet`, `isScrollControlled: true`, `enableDrag: false` — swipe-to-dismiss is deliberately disabled so the editor's unsaved-changes guard cannot be bypassed; `backgroundColor: transparent`).
- The EVIL intro is a fullscreen dialog route (`MaterialPageRoute(fullscreenDialog: true)`) pushed from within the editor.

Web suggestion: `/hangar` route; editor as a modal overlay (not a URL) or `/hangar?edit=<id>` if deep-linking is wanted (not present in the original).

---

## 3. Shared design tokens used by Hangar

### 3.1 Colors (`AppColors`)

| Token | Value | Notes |
|---|---|---|
| `bgDeepest` | `#03060B` | app/page background |
| `bgElevated` | `#0A1220` | dialogs, picker sheets |
| `bgGlass` | `#0F1C30` at 55% alpha (`rgba(15,28,48,0.55)`) | input fills |
| `bgCard` | `#111E30` | opaque card fill (GlassCard) |
| `accentPrimary` | `#4FC3FF` | cyan — icons, headers, buttons |
| `accentSecondary` | `#7AE3FF` | lighter aqua — role icons, prefix chip, EVIL accents |
| `accentDanger` | `#FF5577` | errors, delete, low hull |
| `accentWarn` | `#FFB347` | "Unregistered", mid hull |
| `accentSuccess` | `#5FE8A0` | "Registered", high hull, status dots |
| `textPrimary` | `#E8F4FF` | |
| `textSecondary` | `#8AA4C2` | |
| `textDim` | `#6E8AAB` | hints, disabled |
| `borderSubtle` | `#7AE3FF` at 12% alpha | card & input borders |
| `borderGlow` | `#4FC3FF` at 45% alpha | focused input border |

### 3.2 Typography (`AppTypography`)

Bundled variable fonts (no network fetch): `Inter` (assets/fonts/Inter-Variable.ttf), `JetBrainsMono` (assets/fonts/JetBrainsMono-Variable.ttf), `Quicksand` (assets/fonts/Quicksand-Variable.ttf).

| Style | Family | Size | Weight | Color | Other |
|---|---|---|---|---|---|
| `display` | Quicksand | 34 | 600 | textPrimary | line-height 1.1 |
| `title` | Inter | 22 | 600 | textPrimary | |
| `headline` | Inter | 17 | 600 | textPrimary | |
| `body` | Inter | 15 | 400 | textPrimary | |
| `caption` | Inter | 12 | 500 | textSecondary | |
| `mono` | JetBrainsMono | 14 | 400 | textPrimary | |
| `terminal` | JetBrainsMono | 13 | 500 | accentPrimary | |

### 3.3 Spacing & radii

`AppSpacing`: xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48 (px).
`AppRadius`: sm 8, md 14, lg 22 (px).

---

## 4. Shared components used by Hangar

### 4.1 `AppBackground`

Full-screen stack behind page content:
1. Solid `bgDeepest` fill.
2. Radial gradient centered at top-left (alignment (-1,-1), radius 1.2): `accentPrimary` at 10% alpha → transparent.
3. Hex-grid pattern painter at opacity 0.06 (pointer-events: none).
4. Page content.
5. Optional scanlines overlay at opacity 0.55 (list view shows it; the ship editor passes `showsScanlines: false`).
Tapping anywhere on the background unfocuses the current text input.

### 4.2 `GlassCard`

Card container used for every hangar card: fill `bgCard` (#111E30), 1px border `borderSubtle`, border-radius 14 (`AppRadius.md`), padding 12 (`AppSpacing.md`), clipped to radius. No blur by default (opt-in `blur` adds an 18×18 backdrop blur — not used in hangar). Optional `glow` (box-shadow accentPrimary 18% alpha, blur 14) — not used in hangar.

### 4.3 `BannerPage` + `TransmissionHeader` (top banner)

Every main tab page pins an opaque "ESSI" banner above the scrolling content (content scrolls between the banner and the bottom nav, never behind either):

- Container: background `bgDeepest`, padding 12 horizontal / 6 vertical, inner bottom border 1px `borderSubtle` with 4px padding-bottom.
- Row contents left→right:
  - `PulsingDot`: 6×6 circle, color `accentSuccess`, opacity crossfades 1.0 ↔ 0.35 every 800 ms (easeInOut). If "reduce animations" (app setting or OS `prefers-reduced-motion`) → static dot.
  - 8px gap; the banner label uppercased in JetBrainsMono 10px w600 letter-spacing 2, color `accentPrimary`, ellipsized. Hangar label: `ESSI · Fleet Registry` → renders `ESSI · FLEET REGISTRY`.
  - Right-aligned scroll-driven sector code in JetBrainsMono 10px w500 `textDim`, format `ESSI//NNN` where `NNN = 100 + ((seed + floor(|scrollOffset|/4)) % 900)`; `seed = random integer in [0,900)` fixed per page instance. I.e. the number ticks as you scroll, purely decorative.
  - Then any banner action icons (hangar has one: a `+` button — `Icons.add`, 18px, color `accentPrimary`, hit padding 4h/2v).

### 4.4 `PageScrollView` (scroll container)

Scrollable page body that:
- broadcasts scroll offset (drives the banner sector code),
- shows a floating **back-to-top** button once scrolled more than one viewport height: 44×44 circle, background `bgDeepest`, 1px border `accentPrimary` @60%, box-shadow `accentPrimary` @40% blur 10, icon `Icons.arrow_upward` 22px `accentPrimary`, positioned right 16 / bottom 16, appears/disappears with a 200ms scale+fade; clicking smooth-scrolls to top over 300ms easeInOut (with a light haptic tap on native).
- Hangar uses the virtualized `slivers` variant (windowed list rendering — on web, simple DOM rendering or react-window is fine).
- Keyboard dismisses on scroll-drag (mobile behavior; drop on web).

### 4.5 `SectionHeader`

Row: optional icon (18px `accentPrimary`) + 8px gap + title uppercased in JetBrainsMono 12px w600 letter-spacing 2 `accentPrimary`; optional caption subtitle beneath (2px gap). Used for editor sections.

### 4.6 `TerminalNotes`

Terminal-style notes card (GlassCard) shown at the bottom of the hangar list:
- Header row: `> {title}` in `terminal` style (JetBrainsMono 13 w500 accentPrimary), spacer, 6×6 `accentSuccess` circle.
- 8px gap, 1px divider (`borderSubtle` at 40% of its alpha), 8px gap.
- Each line: `[NN]` zero-padded index (width 28px, JetBrainsMono 11 w600 accentPrimary) + 8px gap + text in `body` style with `textSecondary` color. 4px between lines.
- Trailing "pending" line: `[NN]` (next index, accentPrimary at 55% alpha) + a blinking `▋` cursor character in `terminal` style, opacity animating 0→1 reverse-repeat every 600ms easeInOut (static when reduce-motion).

### 4.7 `TagChip` / `TagInputField` (shared with Notes/Links)

`TagChip`: pill with padding 10h/5v, border-radius 20.
- Unselected: bg `accentPrimary` @15% alpha, 1px border `accentPrimary` @40%, text `accentPrimary` 12px w500.
- Selected: bg `accentPrimary` solid, border transparent, text `bgDeepest`.
- Optional remove `×` (`Icons.close` 12px) with 6px gap.

`TagInputField`: a wrap container (padding 12h/8v, bg `bgGlass`, radius 8, 1px border — `borderGlow` when focused else `borderSubtle`) holding: selected tags as removable selected-chips + an inline borderless text input (min-width 80, placeholder `Add tag…` in body style `textDim`).
Behavior:
- Typing a comma or trailing space **commits** the current token (comma stripped, trimmed). Enter commits. Newlines are filtered out.
- Duplicate check is case-insensitive; duplicates silently ignored.
- Suggestions: when the trimmed input is non-empty, show up to **6** pool tags whose lowercase name **contains** the input and are not already selected, as tappable unselected chips in a horizontal scroll row below (8px gaps). Tapping adds and clears the input.
- `TagInputController.commitPending()` — the editor calls this at the start of Save so a half-typed tag is not lost (F38).

---

## 5. View: Hangar list (`/hangar`)

File: `lib/features/hangar/views/hangar_list_view.dart`.

### 5.1 Layout, top to bottom

1. **Banner**: `ESSI · Fleet Registry` with one `+` action (opens the New-ship editor sheet; light haptic tap).
2. **Scrollable body** (PageScrollView.slivers, content padding: left/right 12, top 12, bottom 32) over the shared `AppBackground` (scanlines ON), page background `bgDeepest`.
3. Stream states:
   - **Loading**: centered circular progress indicator.
   - **Error**: centered text `Couldn't load your hangar.` (via `friendlyError` fallback; see §13.3) in `body` style colored `accentDanger`.
   - **Empty** (no ships): centered column with vertical padding 32: icon `Icons.archive_outlined` 48px in `accentPrimary` @40% alpha; 8px gap; `Hangar empty` in `headline`; 4px gap; `Tap + to register your first ship.` in `caption`.
   - **Data**: ships grouped by category (see 5.2), then a 16px gap, then the `TerminalNotes` card (see 5.4).
4. After the groups: 16px spacer, then the notes card. (When empty, the notes card still renders after the empty state.)

### 5.2 Grouping & ordering

- Ships arrive sorted **alphabetically by name, case-insensitive** (repository sort).
- Each ship is bucketed by the **category of its catalog model** (`shipForKey(modelKey)?.category`); no model or unknown model → bucket `other`.
- Buckets render in this fixed order, skipping empty ones:

| key | Header label | Header icon |
|---|---|---|
| `landcraft` | LANDCRAFT | `Icons.directions_car` |
| `watercraft` | WATERCRAFT | `Icons.sailing` |
| `spacecraft` | SPACECRAFT | `Icons.rocket_launch` |
| `other` | OTHER | `Icons.help_outline` |

- Category header row (8px vertical padding): icon 18px `accentPrimary`, 8px gap, label uppercased JetBrainsMono 12 w600 letter-spacing 2 `accentPrimary`, 6px gap, `· {count}` in JetBrainsMono 11 `textSecondary`.
- Ship cards follow with 8px bottom margin each; 12px gap after each category block.

### 5.3 Ship card (`_ShipCard`)

A `GlassCard`; whole card is tappable (opens editor pre-filled, haptic tap) and **long-pressable** (delete confirm). Content column, left-aligned:

1. **Header row**: left column — ship name in `headline` (empty name renders literal `(unnamed)`); if a model display exists, 2px gap + model label in `caption`. Model display = `customModelLabel` if non-empty, else the catalog entry's `displayName`. Right side — registered badge: icon 14px + 4px gap + text in `caption` recolored:
   - registered: `Icons.verified`, color `accentSuccess`, text `Registered`
   - not: `Icons.warning_amber_rounded`, color `accentWarn`, text `Unregistered`
2. **Location row** (only when `locationDisplay` non-null; 8px gap above): `Icons.place` 16px `accentPrimary`, 4px gap, location string in `body` (formats in §12.4).
3. **Hull row** (only when `hull != null`; 4px gap above): `Icons.shield` 16px `accentPrimary`, 4px gap, `Hull ` in `caption`, then:
   - if the catalog model has `hullMax`: `{hull} / {hullMax}` in JetBrainsMono 13 w600, colored by ratio `hull/hullMax`: `>= 0.75` → `accentSuccess`; `>= 0.40` → `accentWarn`; else `accentDanger` (ratio counts as 0 when max is 0).
   - else: `{hull}` in JetBrainsMono 13 w600 `accentSecondary`.
   - Spacer, then two stepper buttons (`−` then 6px gap then `+`): 28×28 squares, bg `bgGlass`, radius 8, 1px border (`accentPrimary` @40% when enabled, `borderSubtle` when disabled), icon 16px (`Icons.remove` / `Icons.add`) colored `accentPrimary` enabled / `textDim` disabled. `−` disabled at hull ≤ 0; `+` disabled when hullMax is known and hull ≥ hullMax.
4. **Assigned roles** (only when at least one role has a non-blank name; 8px gap above): one row per assigned role in seat order, 1px vertical padding: 4px indent, role icon 12px `accentSecondary`, 6px gap, role display name in `caption` inside a fixed 80px-wide box, then the crew member's name in JetBrainsMono 12 w600 `textPrimary`.
5. **Tags** (only when the ship has tags; 8px gap above): horizontal scroll row of unselected `TagChip`s with 4px gaps.

Role icons (Material):

| Role | Icon |
|---|---|
| Pilot | `flight` |
| Gunner | `center_focus_strong` |
| Cartographer | `map` |
| Prospector | `search` |
| Signaller | `wifi_tethering` |
| Technician | `build` |
| Sentry | `shield` |
| Fabricator | `handyman` |
| Medic | `local_hospital` |
| Quartermaster | `inventory_2` |
| Chef | `restaurant` |
| Alchemist | `science` |

**Hull stepper logic** (exact):
```
adjustHull(delta):
  if ship.hull == null: return
  max = catalog[ship.modelKey]?.hullMax   // may be null
  next = ship.hull + delta                // delta is ±1
  if next < 0: next = 0
  if max != null and next > max: next = max
  if next == ship.hull: return            // no-op, no write
  haptics.selection()
  repository.updateHull(ship.id, next)    // writes hull + updatedAt only
```
UI updates optimistically via the reactive ships stream (the DB watch re-emits).

**Delete flow**: long-press card → `AlertDialog` (background `bgElevated`): title `Delete ship?` (headline). No body text. Actions: `Cancel` (body, `textSecondary`) → dismiss; `Delete` (body, `accentDanger`) → warning haptic + `repository.delete(id)`. No undo.

### 5.4 Hangar notes card

`TerminalNotes` with title `hangar.notes` and exactly these 3 lines:
1. `To locate a ship, type its entry command in #verified-perk-room and match the APM shown to a known place.`
2. `A ship can be recalled at any time, but at a heavy stamina cost.`
3. `To register a ship, just try to board it once. Spacecraft spawn at Mars space station, the Rat Raft at Rankle River; other vessels vary.`

---

## 6. View: Ship editor (modal bottom sheet)

File: `lib/features/hangar/views/ship_editor_view.dart`. Opened for "new" (no ship passed) or "edit" (a `ShipModel` passed).

### 6.1 Container & app bar

- Draggable sheet: initial 95% of screen height, min 50%, max 97%; top corners rounded 22px (`AppRadius.lg`). Content background `bgDeepest` over `AppBackground` **without scanlines**.
- App bar (transparent, elevation 0, body extends behind it):
  - Leading (width 80): text button `Cancel` in `body` colored `textSecondary` → close (with unsaved-changes guard).
  - Centered title: `New ship` or `Edit ship` in `headline`.
  - Trailing (right padding 8): text button `Save` in `body` w600; enabled color `accentPrimary`, disabled color `textDim`. Disabled while the composed name is blank or catalogs haven't loaded (before catalogs load, enablement falls back to "name field or suffix field non-blank").
- Body list content padding: 12 left/right; top = safe-area top + toolbar height + 8; bottom = 32 + software-keyboard inset.
- SnackBars from this sheet display via a sheet-local messenger (so they appear inside the sheet).

### 6.2 Unsaved-changes guard (F14)

- A snapshot of every field is taken on open ("baseline"). `dirty` = any of: name, suffix, custom model, hull, sector, SL, zone, custom location, note text differs; or modelKey, locationKey, registered differ; or the tags list differs (ordered comparison); or any role text differs.
- Baseline is **re-captured** after programmatic normalizations so they don't count as user edits: (a) after splitting a saved `PREFIX-NNNN` name into the suffix field on open; (b) after applying EVIL defaults.
- Closing (Cancel button, back navigation) while dirty shows an `AlertDialog` (bg `bgElevated`): title `Discard changes?` (headline), content `You have unsaved changes.` (body), actions `Keep editing` (body `textSecondary`) / `Discard` (body `accentDanger`). Only "Discard" closes. The bottom sheet's swipe-dismiss is disabled at the call site precisely so this guard can't be bypassed.

### 6.3 Form sections, top to bottom

All cards are `GlassCard`s separated by 16px gaps.

**Card 1 — IDENTITY** (`SectionHeader` title `Identity`, no icon; 8px gap after header; 12px between fields):

1. Name input — two variants:
   - Selected model has a known prefix → labeled field `Call sign` containing the **prefix+number field** (§7.3): static `PREFIX-` chip + numeric-ish suffix input. Disabled when EVIL-locked.
   - Otherwise → labeled field `Name`, plain text input, hint `Ship's call sign`, `body` style.
2. Labeled field `Model` → **model picker** button (§7.1). Disabled (55% opacity, no tap) when EVIL-locked.
3. Labeled field `Custom model label` (plain text input, JetBrainsMono style, hint `e.g. MMC-1234 (optional)`) — **only shown when** no model is selected OR the selected catalog model has no prefix. (All current catalog models have prefixes, so in practice this shows only with "No model".)
4. Row: Material switch (active thumb `accentSuccess`) + 8px gap + text `Registered` in `body`.

**Card 2 — LOCATION** (header `Location`, icon `Icons.place`):

1. **Location picker** button (§7.2).
2. If the selected location `paramKind == zone`: labeled field `Zone` — numeric input, digits only, hint = the location's `defaultZone` (or `55`), JetBrainsMono style.
3. If `paramKind == spaceCoordinate`: a row of two equal labeled fields with 12px gap: `Sector` (text, hint `A-1`, mono) and `SL` (digits only, hint `0`, mono).
4. If the selected location key is `other` (custom): labeled field `Custom location` — text input, hint `Free text`, `body` style.

**Card 3 — HULL** (header `Hull`, icon `Icons.shield`):

- Labeled field, label `Hull (max {hullMax})` when the selected model has `hullMax`, else `Hull`. Digits-only input, hint `0`, mono style. NOTE: the max is a label hint only — the editor does NOT clamp or validate against hullMax (only the list-card stepper clamps).

**Card 4 — CREW ROLES or OWNER**:

- If the selected model is the EVIL ship (prefix `EVIL`): an **Owner** card instead (header `Owner`, icon `Icons.shield_moon`): row with `Icons.directions_boat_filled` 18px `accentSecondary`, 8px gap, `East-Shire` in `body`, spacer, `EVIL-01` in JetBrainsMono 12 w700 `accentSecondary`; below (8px gap) caption text: `Roles do not apply to the void ship. She answers no captain.`
- Else, if the model's `availableRoles` is non-empty (see §12.2): card with header `Crew roles`, icon `Icons.groups`; one text field per available role (4px vertical padding each), Material floating label = role display name, hint = `{Role}'s name` (e.g. `Pilot's name`), `body` style.
- If `availableRoles` is empty (crewSize == 0, non-EVIL — not currently in catalog) the card is omitted.

**Card 5 — NOTE** (header `Note`, icon `Icons.notes`): multi-line text area, hint `Anything else worth knowing about this ship`, `body` style, min 3 lines / max 10, sentence auto-capitalization (mobile-only nicety).

**Tags block** (not in a card): `SectionHeader` title `Tags`, icon `Icons.tag`; 8px gap; `TagInputField` (§4.7) with the suggestion pool = all existing tag display names app-wide (live `tagsStreamProvider`).

### 6.4 Input decoration (all standard TextFields in the editor)

- Filled with `bgGlass`; content padding 12 horizontal / 10 vertical; border-radius 8; 1px border `borderSubtle` normally, `borderGlow` when focused. Hint text: `body` style in `textDim`. Floating label (crew fields): `caption` style.
- `_LabeledField` wrapper: label above the control in `caption` style with `textSecondary` color and weight 600, 4px gap.

### 6.5 Prefix / suffix name logic (exact)

Catalog models carry a call-sign prefix (e.g. `MMCS`). The stored ship `name` is the full string `PREFIX-SUFFIX`; the editor surfaces only the suffix.

```
extractSuffix(name, prefix):
  if prefix empty → ''
  if name startsWith prefix + '-': return remainder
  if name startsWith prefix:          // tolerate missing dash
     rest = name minus prefix
     return rest minus a leading '-' if present
  return name                          // prefix mismatch → raw name

composedName():
  entry = catalog[modelKey]
  if entry exists and has prefix:
      suffix = trim(suffixField)
      return suffix == '' ? '' : entry.prefix + '-' + suffix
  return trim(nameField)
```

- **On open (edit mode)**: after catalogs load, if the ship's model has a prefix, the suffix field is set to `extractSuffix(savedName, prefix)` and the dirty baseline is re-captured.
- **On model change**:
  - to a prefixed model: `suffix = extractSuffix(trim(nameField), newPrefix)` (so e.g. a raw name "1234" carries over as the suffix, and a matching `MMCS-1234` is split).
  - to no-prefix/no model: if the suffix field is non-empty and the name field is blank, promote the suffix into the name field; then clear the suffix.
- The suffix input uppercases input (autocapitalize characters), no autocorrect/suggestions. It is not digit-restricted despite the `number` hint.

### 6.6 Save validation & mapping (exact)

Save enabled iff `composedName()` is non-blank. On Save:

```
commit pending tag token
hull = parseInt(trim(hullField)) or null
zone = parseInt(trim(zoneField)) or null
sl   = parseInt(trim(slField)) or null
roles[r] = trim(roleField[r]) == '' ? null : trim(roleField[r])   // all 12 seats

model = {
  id: existing id or '' (new),
  name: composedName(),
  modelKey,
  customModelLabel: only persisted when its field is visible in the UI
      (modelKey == null OR catalog entry hasPrefix == false); trimmed; '' → null;
      otherwise forced null (avoids saving stale hidden text),
  registered,
  locationKey,
  customLocation: only when locationKey == 'other'; trimmed; '' → null; else null,
  locationZone: only when selected location supportsZone, else null,
  locationSector: only when supportsSpaceCoordinate; trimmed, '' → null; else null,
  locationSL: only when supportsSpaceCoordinate, else null,
  hull, roles,
  note: note text AS-IS (not trimmed),
  createdAt: existing or now, updatedAt: now
}
repository.save(model, tagDisplayNames: tags)
```
- On success: success haptic, sheet closes.
- On failure: error logged; SnackBar inside the sheet: `Couldn't save — please try again.` (via `friendlyError` fallback); sheet stays open.

### 6.7 EVIL ship behavior in the editor

Constants: prefix `EVIL`, instance number `01`, full identifier `EVIL-01`, owner label `East-Shire`, default location key `east-shire`.

- Selecting the EVIL model (`prefix == 'EVIL'`):
  - If the intro has been seen before (SharedPreferences `hangar.evilIntroSeen` true): mark intro-played and apply defaults immediately.
  - Else: play the fullscreen intro (§8) with a warning haptic; when the user closes it, mark intro-played, apply defaults, and persist `hangar.evilIntroSeen = true`.
- Opening the editor on an already-EVIL ship **replays the intro** (regardless of the seen flag; the flag only skips it during model selection).
- `applyEvilDefaults()` (then re-baseline dirty state): `registered = true`; `locationKey = 'east-shire'`; clear customLocation/zone/sector/sl; `name = 'EVIL-01'`; `suffix = '01'`; clear all 12 role fields.
- While intro-played ("EVIL locked"): the call-sign suffix input is disabled and the model picker is disabled (55% opacity). Location, hull, note and tags stay editable. The crew card is replaced by the Owner card. (Roles won't be saved anyway: crewSize 0 → no role inputs; role map entries all null.)

---

## 7. Sub-widgets of the editor

### 7.1 Model picker (`_ModelPicker` + sheet)

- Trigger button: container padding 12h/12v, bg `bgGlass`, radius 8, 1px `borderSubtle`; left: selected model displayName in `body` (or placeholder `Pick a model` in `textDim`); right: `Icons.expand_more` in `textSecondary`.
- Opens a modal bottom sheet: bg `bgElevated`, top corners radius 20, safe-area padded, content padding 12. Column: title `Pick a model` in `headline`; 12px gap; scrollable list:
  - First item: ListTile leading `Icons.cancel` (`textSecondary`), title `No model` (body), marked selected when nothing chosen; returns null-key result.
  - Then for each category in fixed order `landcraft`, `watercraft`, `spacecraft`: a category label (padding 12,12,12,4; uppercased JetBrainsMono 11 w600 letter-spacing 1.5 `accentPrimary`), then its ships **sorted by displayName** (case-sensitive `compareTo`), each a ListTile: title = displayName (body), subtitle = `Crew {crewSize}` (caption) only when crewSize non-null, `selected` when it's the current model.
- Dismissal semantics: an explicit choice (including "No model") returns a wrapped result; tapping the barrier/swiping down returns nothing and **leaves the selection unchanged** (crucial: "None" and "dismissed" must be distinguishable).

### 7.2 Location picker (`_LocationPicker` + sheet)

Identical construction to the model picker, with: placeholder `Pick a location`, sheet title `Pick a location`, first item `No location`. Groups render in the fixed order `landmarks`, `stations`, `bodies`, `special`, `custom` (groups absent from the catalog are skipped) with the same uppercased group labels. Location tiles: title = displayName, subtitle = the catalog `subtitle` when present (caption). **Within a group, catalog file order is preserved** (no sort). Same dismissal semantics. The location picker is never disabled (even when EVIL-locked).

### 7.3 Prefix+number field (`_PrefixNumberField`)

Container: bg `bgGlass`, radius 8, 1px `borderSubtle`, horizontal padding 12. Row: static text `{PREFIX}-` in JetBrainsMono 18 w700 `accentSecondary`; 2px gap; expanded borderless TextField in JetBrainsMono 18 w700 `textPrimary`, vertical content padding 14, hint `number`, autocapitalize-characters, no autocorrect/suggestions. When disabled (EVIL lock) the field is non-editable.

---

## 8. View: EVIL ship intro (fullscreen easter-egg)

File: `lib/features/hangar/widgets/evil_ship_intro.dart`. A fullscreen page over `bgDeepest` with three phases: `scrolling` → `fading` → `portal`.

### 8.1 Layout

Stack (full screen):
1. **Starfield** (fades from opacity 1.0 to 0.25 over 1600ms once scrolling ends): 70 stars with a fixed RNG seed (42), each `x,y ∈ [0,1)` fractions of the viewport, radius `0.8 + rand*1.6` px, opacity `0.25 + rand*0.6`, color `accentSecondary` at the star's opacity. Stars drift downward: `y = (y0*H + phase*30) mod H`, where `phase` loops 0→1 over 60 s.
2. **Void portal** (only after scrolling ends; see 8.3).
3. Safe-area padded column (padding 16 left/right, 24 top, 16 bottom):
   - **Header** (fades out with the text): centered row `Icons.directions_boat_filled` 22px `accentSecondary` + 8px gap + `VOID SHIP` in JetBrainsMono 22 w900 letter-spacing 8 `textPrimary` with a glow text-shadow (`accentPrimary` @50%, blur 6). Below (6px): `EAST-SHIRE VESSEL INDUSTRIES . LAWLESS . EVIL-01` in JetBrainsMono 10 w600 letter-spacing 3 `accentSecondary`, centered.
   - **Log scroller** (expanded middle; fades out too): see 8.2.
   - **Footer**: a hint line `She'll wait. So will the rest of the form.` in JetBrainsMono 11 `textDim` (visible only during the scrolling phase; 500ms fade), 8px gap, then the close button: pill (padding 10v/16h, radius 40) filled `accentPrimary` with a glow shadow (`accentPrimary` @55%, blur 10); row: `Icons.cancel` 18px in `bgDeepest` + 6px gap + label in JetBrainsMono 13 w600 letter-spacing 2 `bgDeepest`. Label: `Close log` during scrolling/fading, `Step through` once the portal has settled. Tapping at any time calls `onClose` (pops the intro).

### 8.2 Log scroller (Star-Wars-style crawl)

- Total scroll duration: **110 seconds**, linear. Content starts at `85%` of the viewport height and translates to `-(contentHeight + 40)`. A vertical mask fades content at the edges (transparent → opaque → transparent, stops 0 / 0.18 / 0.5 / 0.82 / 1.0).
- When reduce-motion: progress jumps to 1 immediately and the completion fires post-frame.
- On completion → `triggerPortal()`: phase = fading; text opacity animates 1→0 over 1600ms (200ms reduce-motion); portal radius progress animates 0→1 over 4000ms (600ms reduce-motion); when done, phase = portal (portal "settled", wobble freezes).
- Line rendering: empty string → 4px spacer. Line starting with `//` → JetBrainsMono 11 w500 letter-spacing 1, `accentSecondary` @75% alpha, 8px vertical padding. Otherwise → serif paragraph: font-size 17, line-height 1.4, `textPrimary`, family `serif` (fallback `AmericanTypewriter`, serif), 8px vertical padding, horizontal padding 8.

**Full log text, in order (verbatim; blank strings are blank lines):**

```
// captain's log, uncertified channel
// origin: somewhere astern of the present

I am Captain GreyWhisker.

If this transmission reaches your console, you have already brushed against the void. That is not a threat. That is just how she introduces herself.

The vessel you are about to register is no Solstice, no Ratship. It is the Lawless: the only EVIL hull ever laid down at the East-Shire docks. There were others. The records of them have been politely forgotten.

She does not move the way ships move. She is not pulled by gravity, she is invited by it. She does not warm her hull on a star, she remembers being warm. The instruments lie about her, and the instruments are not at fault.

I have steered her through three Marses now. Two of them were ours. One belonged to an East-Shire that took a different vote, in a year you will never live in. The crew there were kind. The food was strange. We did not stay.

She will tell you, in her quiet way, that she has been to places this companion app does not list. Coastal towns under Phobos. A trade route to a Ceres that survived. The Imperious Falls running upward, slowly, against a sky that had given up on being blue.

She has no pilot. She has no gunner. She does not need a quartermaster, because what we bring back is rarely the same shape as what we left with.

If you mean to keep her in your hangar, understand this: she is registered to East-Shire and to East-Shire alone. She answers no captain. She answers a question I no longer remember asking.

When you close this log, your console will show what little can honestly be said about her. Matricule EVIL-01. Ownership East-Shire. Attached to the void docks. The other fields will fall quiet. They are not broken. They are simply not for you to fill in.

Take care out there.

GreyWhisker, somewhere off the chart.
```

### 8.3 Void portal animation (decorative — a simpler CSS/SVG re-interpretation is acceptable)

Centered concentric layers scaling with `r = progress * max(viewportW, viewportH) * 1.15`, where `t` = seconds elapsed:
1. Far halo: radial-gradient circle, diameter `2.6r`, `accentPrimary` @35% → transparent.
2. Outer corona: radial-gradient circle, diameter `1.9r`, `accentPrimary` @65% → transparent.
3. Aqua halo blob: diameter `1.55r`, rotation `+9°/s`, `accentSecondary` @45%, gaussian blur σ24, 5 lobes, wobble amplitude 0.27, filled.
4. Dark mantle blob: `1.18r`, rotation `−11°/s`, color `#050810` @90%, blur σ18, 6 lobes, amplitude 0.18, filled.
5. Void core blob: `0.9r`, rotation `+14°/s`, black, blur σ8, 7 lobes, amplitude 0.14, filled.
6. Inner glints blob: `0.7r`, rotation `−17°/s`, `accentSecondary` @60%, blur σ6, 9 lobes, amplitude 0.30, stroked (width 1.2).

Blob outline (180 segments): radius modulated by a 3-sine wobble
`wobble(θ) = 0.55·sin(θ·lobes + time + seed) + 0.30·sin(θ·(lobes+2)·0.7 + 1.8·time + 1.7·seed) + 0.15·sin(θ·(lobes+5)·1.2 + 0.5·time + 0.3·seed)`; `r(θ) = baseR·(1 + wobble·amplitude)`. Per-layer time multipliers 0.42 / 0.55 / 0.78 / 1.05 and seeds 9.3 / 13.1 / 21.7 / 33.5. The wobble freezes once the portal settles. All motion is skipped when reduce-motion is on.

---

## 9. Data models

### 9.1 `ShipRight` enum (12 seats, order matters — this IS the seat order)

`pilot, gunner, cartographer, prospector, signaller, technician, sentry, fabricator, medic, quartermaster, chef, alchemist`.
Display names: capitalized English (`Pilot` … `Alchemist`). Role input placeholder: `{DisplayName}'s name`.

### 9.2 `ShipCatalogEntry`

| Field | Type | Notes |
|---|---|---|
| `key` | string (required) | stable id, e.g. `mmc-shootingstar` |
| `displayName` | string (required) | |
| `category` | string? | `landcraft` \| `watercraft` \| `spacecraft` |
| `prefix` | string? | call-sign prefix, e.g. `MMCS` |
| `crewSize` | int? | null → all 12 seats available |
| `hullMax` | int? | null → unbounded hull |

Derived: `hasPrefix` = trimmed prefix non-empty. `availableRoles`: crewSize null → all 12 seats; crewSize ≤ 0 → none; else the **first `crewSize` seats in seat order** (e.g. crewSize 2 → Pilot, Gunner).

### 9.3 `ShipLocation`

| Field | Type | Notes |
|---|---|---|
| `key` | string (required) | e.g. `mars-space-station` |
| `displayName` | string (required) | |
| `group` | string (required) | `landmarks` \| `stations` \| `bodies` \| `special` \| `custom` |
| `subtitle` | string? | shown in the picker |
| `paramKind` | `'zone'` \| `'spaceCoordinate'` \| null | drives the contextual fields |
| `defaultZone` | int? | zone hint (all zone locations use 55) |
| `isSpacecraftDefault` | bool (default false) | flag on Mars space station; exposed via a `spacecraftDefaultKey` getter — **currently unused by any UI** |

Constant: custom location key = `other`.

### 9.4 `ShipModel` (domain object)

| Field | Type | Default |
|---|---|---|
| `id` | string | `''` for unsaved |
| `name` | string | required (full composed name incl. prefix) |
| `modelKey` | string? | null |
| `customModelLabel` | string? | null |
| `registered` | bool | false |
| `locationKey` | string? | null |
| `customLocation` | string? | null |
| `locationZone` | int? | null |
| `locationSector` | string? | null |
| `locationSL` | int? | null |
| `hull` | int? | null |
| `roles` | map ShipRight → string? | `{}` |
| `note` | string | `''` |
| `createdAt` / `updatedAt` | DateTime | required |
| `tags` | TagModel[] | `[]` |

Helpers: `roleName(r)` returns the trimmed name or null if blank; `assignedRoles` returns `(role, name)` pairs in seat order for non-blank roles; `locationDisplay` see §12.4.

### 9.5 `TagModel` (shared)

`id: string; displayName: string; name: string (lowercase dedupe key); colorHex: string|null`.

---

## 10. Catalog assets

### 10.1 `assets/catalog/ship_catalog.json` — **14 entries**

JSON array of ShipCatalogEntry objects. Full data:

| key | displayName | category | prefix | crewSize | hullMax |
|---|---|---|---|---|---|
| `moon-buggy` | Moon Buggy | landcraft | MOOB | 1 | null |
| `ork-grasshooper` | ORK Grasshooper | landcraft | ORKG | 1 | 4 |
| `rts-squeakter` | RTS Squeakter | landcraft | RTSS | null | 4 |
| `vst-ranger` | VST Ranger | landcraft | VSTR | null | null |
| `evi-navigator` | EVI Navigator | watercraft | EVIN | null | null |
| `rat-raft` | Rat Raft | watercraft | RATR | null | null |
| `evil-lawless` | EVIL Lawless | spacecraft | EVIL | 0 | null |
| `mmc-shootingstar` | MMC Shootingstar | spacecraft | MMCS | null | null |
| `prq-coaster` | PRQ Coaster | spacecraft | PRQC | null | null |
| `ratship-one` | Ratship One | spacecraft | RATS | null | null |
| `solstice-trigrave` | Solstice Trigrave | spacecraft | SOLT | 2 | 80 |
| `solstice-vanguard` | Solstice Vanguard | spacecraft | SOLV | null | 8 |
| `sos-starfire` | SOS Starfire | spacecraft | SOSS | null | null |
| `ufo-oort` | UFO Oort | spacecraft | OORT | null | null |

(4 landcraft, 2 watercraft, 8 spacecraft.)

### 10.2 `assets/catalog/ship_locations.json` — **32 entries**

JSON array of ShipLocation objects. Full data (file order preserved — this is picker order within groups):

**landmarks (4):** `imperious-falls` Imperious Falls; `area-55` Area 55; `east-shire` East-Shire (subtitle `Currently only the void ship docks`); `rankle-river` Rankle River (paramKind `zone`, defaultZone 55).

**stations (7):** `mars-space-station` Mars space station (subtitle `Default for spacecraft`, isSpacecraftDefault true); `mercury-space-station` Mercury space station; `earth-space-station` Earth space station; `jupiter-space-station` Jupiter space station; `neptune-space-station` Neptune space station; `oort-space-station` Oort space station; `ceres-space-station` Ceres space station.

**bodies (14, all paramKind `zone`, defaultZone 55):** `mars` Mars; `ceres` Ceres; `luna` Luna; `phobos` Phobos; `diemos` Diemos; `europa-moon` Europa Moon; `io` IO; `kirsch` Kirsch; `velvet` Velvet; `atlas-c-2024-g3` Atlas C 2024 G3; `oortopia` Oortopia; `sylvia` Sylvia; `romulus` Romulus; `remus` Remus.

**special (1):** `space` Space (subtitle `Sector + distance in SL`, paramKind `spaceCoordinate`).

**custom (1):** `other` Other (custom).

### 10.3 Loading behavior

Both files are loaded once at startup of the feature (async, cached provider). Each file loads independently; a parse/IO failure logs an error and falls back to an **empty list** (the UI then shows raw fallbacks: everything groups under "Other", pickers show only the "No model/No location" rows). On web: fetch static JSON from the site bundle.

Other files in `assets/catalog/` (asteroid_tables, fishing_zones, jobs, tracked_objects, train_schedule, wallets) are NOT used by hangar.

Fonts used (bundled): `assets/fonts/Inter-Variable.ttf`, `assets/fonts/JetBrainsMono-Variable.ttf`, `assets/fonts/Quicksand-Variable.ttf`. No images are used by the hangar feature.

---

## 11. Persistence

### 11.1 Drift (SQLite) table `ships`

| Column | SQL type | Nullable | Default |
|---|---|---|---|
| `id` | TEXT (PK) | no | — (uuid v4) |
| `name` | TEXT | no | `''` |
| `modelKey` | TEXT | yes | |
| `customModelLabel` | TEXT | yes | |
| `registered` | BOOL | no | `false` |
| `locationKey` | TEXT | yes | |
| `customLocation` | TEXT | yes | |
| `locationZone` | INT | yes | |
| `locationSector` | TEXT | yes | |
| `locationSL` | INT | yes | |
| `hull` | INT | yes | |
| `pilotName`, `gunnerName`, `cartographerName`, `prospectorName`, `signallerName`, `technicianName`, `sentryName`, `fabricatorName`, `medicName`, `quartermasterName`, `chefName`, `alchemistName` | TEXT | yes (all 12) | |
| `note` | TEXT | no | `''` |
| `createdAt` | DATETIME | no | |
| `updatedAt` | DATETIME | no | |

### 11.2 `tags` table (shared)

`id TEXT PK; displayName TEXT; name TEXT UNIQUE (lowercase dedupe key); colorHex TEXT NULL`.

### 11.3 `ship_tags` join table

`shipId TEXT REFERENCES ships(id) ON DELETE CASCADE; tagId TEXT REFERENCES tags(id) ON DELETE CASCADE; PRIMARY KEY (shipId, tagId)`. (Sibling joins `note_tags`, `link_tags` exist for the other features; orphan pruning considers all three.)

### 11.4 SharedPreferences keys touched by hangar

- `hangar.evilIntroSeen` (bool, default false) — "user has seen the EVIL intro at least once". Web: `localStorage`.
- Read-only settings that affect hangar UI: `settings.hapticsEnabled` (default true), `settings.reduceAnimations` (default false).

Web persistence suggestion: IndexedDB (e.g. Dexie) mirroring the three tables, or sql.js; localStorage for the flags.

---

## 12. Repository & business logic

### 12.1 `watchAll()` — reactive ship list

Combines a live query of all `ships` rows with a live join of `ship_tags ⨝ tags`; builds `ShipModel`s with their tag lists; sorts by `name.toLowerCase()` ascending. Any DB write re-emits the whole list (this is how all UI refresh happens — no manual refresh anywhere).

### 12.2 `save(model, tagDisplayNames)`

- `id`: keep existing, or new uuid v4 when `model.id == ''`.
- `createdAt`: now for new, preserved for edits; `updatedAt`: always now.
- Single atomic transaction: insert-or-update the ship row; **replace** all `ship_tags` rows for the ship with resolved tags; prune orphan tags.
- Tag resolution (shared `_resolveTags`): for each display name — trim; skip blanks; dedupe within the batch by lowercase; reuse an existing tag whose `name` (lowercase key) matches, else insert a new tag `{id: uuid, displayName: trimmed, name: lowercased}`.
- Orphan pruning: delete every tag not referenced by any of `note_tags`, `link_tags`, `ship_tags` (single DELETE with three NOT EXISTS subqueries).

### 12.3 `updateHull(id, hull)` / `delete(id)`

- `updateHull`: writes only `hull` and `updatedAt` (used by the card stepper).
- `delete`: atomic transaction — delete the ship's `ship_tags` rows, delete the ship, prune orphan tags.

### 12.4 Location display string (list card)

```
locationDisplay(catalogs):
  if locationKey == null → null (row hidden)
  if locationKey == 'other' → trimmed customLocation, or null if blank
  entry = catalogs[locationKey]; if missing → null
  switch entry.paramKind:
    zone:            z = locationZone ?? entry.defaultZone ?? 55
                     → '{displayName} · zone {z}'          e.g. 'Mars · zone 55'
    spaceCoordinate: sec = trim(locationSector); sl = locationSL?.toString() ?? '?'
                     if sec empty → '{displayName} · ? SL' e.g. 'Space · ? SL'
                     else         → '{displayName} · {sec}, {sl} SL'  e.g. 'Space · A-1, 12 SL'
    none:            → displayName
```
(Separator is a middle dot `·` with spaces.)

### 12.5 Sorting/filtering summary

- List sort: name, case-insensitive, ascending. No user-facing filters or search in the hangar.
- Category grouping order: landcraft, watercraft, spacecraft, other.
- Model picker: categories in fixed order; models alphabetical by displayName within category.
- Location picker: groups in fixed order landmarks/stations/bodies/special/custom; entries in catalog file order.
- Tag suggestions: substring match (case-insensitive), max 6, excluding already-selected.

---

## 13. State management

- **Hangar list**: renders from a stream — loading spinner → error text → data. There is no pull-to-refresh (the stream is always live). Catalogs load in parallel; while unresolved, ships simply group under "Other" and cards show no model/location metadata (they re-render when catalogs arrive).
- **Editor**: waits for catalogs — loading spinner; error state text `Couldn't load the ship catalog.` in `accentDanger`. Save button also requires catalogs.
- **Dirty tracking**: every keystroke re-evaluates the dirty flag (drives the close guard). No debounce; no autosave.
- **Hull stepper**: fire-and-forget DB write; no explicit optimistic state — the stream re-emission is fast enough. No debounce (each tap is one write).
- **Error surface**: `friendlyError(error, fallback)` maps network-transport errors to canned strings and otherwise returns the screen-specific fallback; raw exception text never reaches the UI. Hangar fallbacks: list `Couldn't load your hangar.`; editor catalog `Couldn't load the ship catalog.`; save `Couldn't save — please try again.`
- No cancellation concerns (no network in hangar).

---

## 14. Export / backup involvement

No hangar-local share/export UI. The global backup service (Menu feature) serializes ships into the app-wide JSON export (`version: 1`, `app: 'Underdeck'`, `exportedAt` ISO-8601 UTC) under `data.ships` (all §11.1 columns, dates as UTC ISO-8601) and `data.shipTags` (`{shipId, tagId}` pairs); `data.tags` carries the tag definitions. Import upserts by id. If the web app implements the backup feature, keep this JSON shape for cross-compatibility; otherwise nothing to do in hangar.

---

## 15. Platform features & web equivalents

| Feature | Where in hangar | Web equivalent |
|---|---|---|
| Haptics (`HapticFeedback` light/selection/medium) | + button tap, card tap, hull step, delete-confirm warning, save success, EVIL intro warning; gated by `settings.hapticsEnabled` | `navigator.vibrate()` where supported, or **drop** (recommended: drop) |
| Drift/SQLite local DB | ships/tags persistence | IndexedDB (Dexie) or sql.js + persistence |
| SharedPreferences | `hangar.evilIntroSeen`, settings flags | `localStorage` |
| Modal bottom sheet (draggable 50–97% height) | ship editor, model/location pickers | fixed-position modal/drawer; disable backdrop-click-to-close on the editor when dirty (guard dialog) |
| `PopScope` back-navigation guard | unsaved changes | intercept route change / `beforeunload` while the editor modal is open and dirty |
| Reduce-motion (app setting + OS) | banner dot, blinking cursor, EVIL intro crawl/portal | `prefers-reduced-motion` media query + app setting |
| Keyboard insets / dismiss-on-drag, sentence auto-capitalization, `TextInputType.number` | editor inputs | `inputmode="numeric"` + `pattern` for digit fields; drop the rest |
| Long-press to delete | ship card | long-press works on touch; add a visible affordance for desktop (e.g. context menu or a delete button inside the editor) — flag as an adaptation decision |
| `image_picker` | **not used in hangar** (used in Menu → contact view only) | n/a |
| Share/notifications/url_launcher | not used in hangar | n/a |

Digit-only enforcement (`FilteringTextInputFormatter.digitsOnly`) applies to: Zone, SL, Hull. The call-sign suffix and Sector fields are NOT digit-restricted.

---

## 16. Complete copy-string inventory

**Navigation / banner**
- Tab label: `Hangar`
- Banner: `ESSI · Fleet Registry` (rendered uppercase)
- Sector code format: `ESSI//{100–999}`

**List view**
- Empty state: `Hangar empty` / `Tap + to register your first ship.`
- Load error: `Couldn't load your hangar.`
- Category headers: `LANDCRAFT`, `WATERCRAFT`, `SPACECRAFT`, `OTHER` + `· {count}`
- Unnamed ship: `(unnamed)`
- Badges: `Registered` / `Unregistered`
- Hull row: `Hull ` + `{hull} / {max}` or `{hull}`
- Location row: see §12.4 formats (`{name} · zone {z}`, `{name} · {sector}, {sl} SL`, `{name} · ? SL`)
- Delete dialog: `Delete ship?` / `Cancel` / `Delete`
- Notes card title: `hangar.notes`; lines: see §5.4 (3 lines, verbatim)

**Editor**
- Titles: `New ship` / `Edit ship`; buttons `Cancel`, `Save`
- Discard dialog: `Discard changes?` / `You have unsaved changes.` / `Keep editing` / `Discard`
- Section headers: `Identity`, `Location`, `Hull`, `Owner`, `Crew roles`, `Note`, `Tags`
- Field labels: `Call sign`, `Name`, `Model`, `Custom model label`, `Registered`, `Zone`, `Sector`, `SL`, `Custom location`, `Hull` / `Hull (max {hullMax})`
- Hints: `Ship's call sign`, `e.g. MMC-1234 (optional)`, `number`, `{defaultZone}` (zone), `A-1` (sector), `0` (SL & hull), `Free text`, `Anything else worth knowing about this ship`, `Add tag…`
- Role labels: `Pilot`, `Gunner`, `Cartographer`, `Prospector`, `Signaller`, `Technician`, `Sentry`, `Fabricator`, `Medic`, `Quartermaster`, `Chef`, `Alchemist`; hints `{Role}'s name`
- Picker: `Pick a model`, `No model`, `Crew {n}`, `Pick a location`, `No location`
- Owner card: `Owner` / `East-Shire` / `EVIL-01` / `Roles do not apply to the void ship. She answers no captain.`
- Catalog load error: `Couldn't load the ship catalog.`
- Save error snackbar: `Couldn't save — please try again.`

**EVIL intro**
- Header: `VOID SHIP` / `EAST-SHIRE VESSEL INDUSTRIES . LAWLESS . EVIL-01`
- Footer hint: `She'll wait. So will the rest of the form.`
- Button: `Close log` → `Step through`
- Log body: 22 lines verbatim in §8.2.

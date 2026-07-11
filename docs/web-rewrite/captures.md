# Underdeck — CAPTURES feature specification (web recode target)

Source of truth: `lib/features/captures/` of the Flutter app, plus the shared design-system,
database and service files it depends on. This document is self-contained: a web developer
with **no access to the Flutter code** must be able to rebuild the feature pixel- and
behavior-faithfully in Vite + React + TypeScript (GitHub Pages, purely client-side).

The Captures feature is the app's personal capture system: **Notes** (title + markdown body)
and **Links** (title + URL + markdown note), both taggable with a shared, global **Tags**
system (tags are also shared with the Hangar feature's ships). Everything is stored locally
(Drift/SQLite on mobile → IndexedDB or SQLite-wasm on web). There are no images in this
feature despite the mission title — the entity types are exactly: Note, Link, Tag (+ 3 join
tables).

---

## Table of contents

1. Feature overview & entity map
2. Routes & navigation
3. Design tokens (colors, spacing, radii, typography)
4. Shared visual components used by Captures
5. View: Captures Home (`/captures`)
6. View: Notes list (embedded)
7. View: Links list (embedded)
8. View: Note editor (modal bottom sheet)
9. View: Link editor (modal bottom sheet)
10. View: Note detail (`/captures/note/:id`)
11. View: Link detail (`/captures/link/:id`)
12. Widget: NoteCard
13. Widget: LinkCard
14. Widget: TagChip
15. Widget: TagInputField (+ TagInputController)
16. Widget: UnderdeckMarkdownView (markdown rendering rules)
17. Widget: BackupReminderBanner
18. Business logic (formulas, algorithms, sorting, validation)
19. Data models & persistence schema
20. State management & providers
21. Export / import interaction (captures portion)
22. Platform features & web equivalents
23. Assets used
24. Complete copy-string inventory
25. Open questions

---

## 1. Feature overview & entity map

```
CapturesHomeView  (/captures, tab "Notes" in the bottom nav)
 ├─ BackupReminderBanner            (conditional warning banner)
 ├─ Segmented control  [Notes | Links]        (mode kept in app-level state)
 ├─ NotesListView   (mode == notes)
 │   ├─ search field, tag-filter chip row
 │   └─ NoteCard list  → tap → NoteDetailView   (push /captures/note/:id)
 │                      → long-press → "Delete note?" dialog
 └─ LinksListView   (mode == links)
     ├─ search field, tag-filter chip row
     └─ LinkCard list  → tap → LinkDetailView   (push /captures/link/:id)
                        → long-press → "Delete link?" dialog

Banner "+" action → modal bottom sheet:
     NoteEditorView (mode==notes) or LinkEditorView (mode==links)
Detail views' "Edit" action → same editors pre-filled.
```

Entities:

- **Note** — `id (uuid v4), title, body (markdown), createdAt, updatedAt, tags[]`
- **Link** — `id (uuid v4), title, url, note (markdown), createdAt, updatedAt, tags[]`
- **Tag** — `id (uuid v4), displayName (as typed), name (lowercased dedupe key, UNIQUE), colorHex (nullable, currently unused by UI)`
- Join tables: `note_tags(noteId, tagId)`, `link_tags(linkId, tagId)`, `ship_tags(shipId, tagId)` — composite PKs, ON DELETE CASCADE both ways.

Tags are global: creating tag "Salvage" on a note makes it suggestable/filterable on links
and ships. Tags referenced by nothing are auto-deleted ("orphan tag pruning") after every
save/delete of a note or link.

---

## 2. Routes & navigation

Router: go_router `StatefulShellRoute.indexedStack` with 5 branches (Tools, **Captures**,
Hangar, Knowledge, Menu). The Captures branch:

| Route | View | Params |
|---|---|---|
| `/captures` | `CapturesHomeView` | — |
| `/captures/note/:id` | `NoteDetailView(noteId)` | `id` = note uuid (path param) |
| `/captures/link/:id` | `LinkDetailView(linkId)` | `id` = link uuid (path param) |

- Bottom nav tab for this branch: label **"Notes"**, icon `note_alt_outlined`
  (Material), selected icon `note_alt`. (Nav bar itself is out of this area's scope, but
  the tab label/icon matter for wayfinding.)
- Detail routes are **pushed** (`context.push`) so the back button/gesture returns to the
  list. Deep links straight to `/captures/note/:id` are valid.
- Editors are **not routes**: they are modal bottom sheets (`showModalBottomSheet`) with
  `isScrollControlled: true`, `enableDrag: false` (swipe-down-to-dismiss is deliberately
  disabled so the unsaved-changes guard can't be bypassed — comment tag "F14"),
  `backgroundColor: transparent`.
- Global search (another area) deep-links into `/captures/note/{id}` and
  `/captures/link/{id}` with URI-encoded ids.
- Unknown routes anywhere land on a shared "Not found" screen (out of scope here).

Web adaptation suggestion: keep `/captures`, `/captures/note/:id`, `/captures/link/:id` as
real routes; implement editors as a modal dialog/drawer layered over the current route
(optionally `#edit` state) with a `beforeunload`-style dirty guard replicated in-app.

---

## 3. Design tokens

### 3.1 Colors (`AppColors`)

| Token | Value | Notes |
|---|---|---|
| `bgDeepest` | `#03060B` | page/scaffold background |
| `bgElevated` | `#0A1220` | dialog background |
| `bgGlass` | `#0F1C30` at 55% alpha (`rgba(15,28,48,0.55)`) | input fills, code background |
| `bgCard` | `#111E30` (opaque) | GlassCard fill |
| `accentPrimary` | `#4FC3FF` | cyan — icons, links, selected states |
| `accentSecondary` | `#7AE3FF` | lighter cyan — URLs, inline code |
| `accentDanger` | `#FF5577` | destructive actions, errors |
| `accentWarn` | `#FFB347` | backup banner |
| `accentSuccess` | `#5FE8A0` | pulsing status dot |
| `textPrimary` | `#E8F4FF` | main text |
| `textSecondary` | `#8AA4C2` | secondary text |
| `textDim` | `#6E8AAB` | hints, disabled, tertiary |
| `borderSubtle` | `#7AE3FF` at 12% alpha (`rgba(122,227,255,0.12)`) | card/input borders, dividers |
| `borderGlow` | `#4FC3FF` at 45% alpha (`rgba(79,195,255,0.45)`) | focused input border |

Derived alphas used in this feature (all on `accentPrimary #4FC3FF` unless noted):
`0.16` segmented-selected fill, `0.15` TagChip idle fill, `0.4` TagChip idle border &
empty-state icon, `0.10` radial background glow; `accentWarn` `0.10` banner fill, `0.45`
banner border, `0.12` banner button fill, `0.55` banner button border.

### 3.2 Spacing (`AppSpacing`) & radii (`AppRadius`)

```
xxs = 2, xs = 4, sm = 8, md = 12, lg = 16, xl = 24, xxl = 32, xxxl = 48   (px)
AppRadius: sm = 8, md = 14, lg = 22                                        (px)
```

### 3.3 Typography (`AppTypography`)

Bundled fonts (no Google Fonts CDN — bundle these files):
- `Inter` → `assets/fonts/Inter-Variable.ttf` (sans; all body text)
- `JetBrainsMono` → `assets/fonts/JetBrainsMono-Variable.ttf` (mono; URLs, code, headers)
- `Quicksand` → `assets/fonts/Quicksand-Variable.ttf` (rounded; display only — not used in Captures)

| Style | family | size | weight | color | extra |
|---|---|---|---|---|---|
| `display` | Quicksand | 34 | 600 | textPrimary | line-height 1.1 (unused here) |
| `title` | Inter | 22 | 600 | textPrimary | note titles |
| `headline` | Inter | 17 | 600 | textPrimary | card titles, dialog titles, app-bar titles |
| `body` | Inter | 15 | 400 | textPrimary | body text, buttons, inputs |
| `caption` | Inter | 12 | 500 | textSecondary | dates, helper text |
| `mono` | JetBrainsMono | 14 | 400 | textPrimary | URLs (often overridden to 13/11) |
| `terminal` | JetBrainsMono | 13 | 500 | accentPrimary | (unused in Captures) |

All styles set `text-decoration: none` by default.

---

## 4. Shared visual components used by Captures

### 4.1 `AppBackground`

Full-bleed stack behind every screen:
1. solid `bgDeepest` fill;
2. radial gradient centered at the top-left corner (Alignment(-1,-1)), radius 1.2×,
   from `accentPrimary @ 10% alpha` to transparent;
3. hexagonal grid pattern at 6% opacity (decorative canvas; CSS suggestion: an SVG hex
   pattern tile at `opacity:0.06`);
4. the content;
5. optional scanlines overlay at 55% opacity (horizontal 1px lines painter).
   **Captures home and both editors pass `showsScanlines: false`** — no scanlines.
   Note/Link **detail views use the default `showsScanlines: true`**.
Tapping anywhere on the background unfocuses the active text input (blur on outside click).

### 4.2 `GlassCard`

The standard content card:
- background `bgCard #111E30` (opaque; the "glass" blur is disabled by default for perf),
- border 1px `borderSubtle`, border-radius `md = 14`,
- default padding `12` all sides,
- content clipped to the radius.
Optional `glow` (unused in captures) adds `box-shadow: 0 0 14px rgba(79,195,255,0.18)`.

### 4.3 `BannerPage` + `TransmissionHeader` (the "ESSI banner")

Main-page chrome, pinned at the top (page content scrolls *under nothing* — content
scrolls between banner and bottom nav; the banner is fully opaque `bgDeepest`).

Layout of the banner (height ≈ 30px total):
- container: `background: bgDeepest`, padding `12px horizontal, 6px vertical`,
  a 1px bottom border `borderSubtle` with 4px padding underneath the row;
- row contents, left→right:
  1. **PulsingDot** — 6px circle, color `accentSuccess #5FE8A0`, opacity crossfades
     1.0 ↔ 0.35 every 800ms (ease-in-out). If "reduce animations" is on, static dot.
  2. 8px gap.
  3. Label text, uppercased, `JetBrainsMono 10px w600 letter-spacing 2px, accentPrimary`,
     single line, ellipsized, flexes.
  4. Sector code text `ESSI//nnn` — `JetBrainsMono 10px w500 textDim`. `nnn` is a fun
     scroll-driven counter: `100 + ((seed + floor(scrollOffsetPx / 4)) % 900)` where
     `seed = random integer in [0, 900)` chosen once per page instance. It ticks as the
     list scrolls.
  5. Optional trailing action icons (Captures shows one: a `+`).

Banner labels for this feature (mode-dependent):
- Notes mode: **`ESSI · Operator Logbook`** (rendered uppercase: `ESSI · OPERATOR LOGBOOK`)
- Links mode: **`ESSI · External Comms Cache`** (uppercase: `ESSI · EXTERNAL COMMS CACHE`)

The `+` action (`_BannerIconButton`): Material icon `add`, 18px, color `accentPrimary`,
hit padding 4px horizontal / 2px vertical; on tap fires a light haptic and opens the
Note or Link editor sheet depending on the current mode.

### 4.4 `SectionHeader`

Row: optional icon (18px, `accentPrimary`) + 8px gap + title uppercased in
`JetBrainsMono 12px w600 letter-spacing 2px accentPrimary`, optional caption subtitle
underneath. Captures uses it once per editor: title `Tags`, icon Material `tag`.

### 4.5 `PageScrollView`

Scroll wrapper used by the detail views:
- plain vertical scroll of a single child with given padding;
- keyboard dismisses on drag (mobile);
- **back-to-top button**: appears after scrolling more than one viewport height.
  44×44 circle, background `bgDeepest`, 1px border `accentPrimary @ 60%`,
  `box-shadow 0 0 10px accentPrimary @ 40%`, Material icon `arrow_upward` 22px
  `accentPrimary`; positioned 16px from right and bottom of the scroll area; appears and
  disappears with a 200ms scale+fade; clicking smooth-scrolls to top in 300ms ease-in-out
  and fires a light haptic.

---

## 5. View: Captures Home (`/captures`)

File: `lib/features/captures/views/captures_home_view.dart`

### Structure, top → bottom

1. Scaffold background `bgDeepest`; `AppBackground(showsScanlines: false)`.
2. `BannerPage` (see 4.3) with mode-dependent label and one `+` action.
3. `BackupReminderBanner` (§17) — usually renders nothing.
4. **Segmented control** (Notes | Links), horizontal padding 12, vertical padding 8:
   - outer container: fill `bgGlass`, radius `sm = 8`, 1px border `borderSubtle`,
     inner padding 2px;
   - two equal-width cells; each cell: vertical padding 8, radius `sm − 2 = 6`;
   - selected cell: fill `accentPrimary @ 16%`, 1px border `accentPrimary`;
     unselected: transparent fill and border;
   - label centered, `body (Inter 15)` with `font-weight 600`; color `accentPrimary`
     when selected else `textSecondary`;
   - labels: exactly `Notes` and `Links`;
   - switching fires a "selection" haptic and updates `capturesModeProvider`.
5. Expanded body: `NotesListView` or `LinksListView` (both receive the banner's shared
   scroll controller so the sector code ticks).

### State

`capturesModeProvider` — a simple app-lifetime state (`CapturesMode.notes` default,
`notes | links`). NOT reset when navigating away (not autoDispose): returning to the tab
restores the last mode. It also determines which editor the `+` opens and the banner label.

---

## 6. View: Notes list (embedded in home)

File: `lib/features/captures/views/notes_list_view.dart`

### State providers

- `notesSearchProvider` — string, **autoDispose** (reset to `''` whenever the view is
  disposed, i.e. leaving the screen clears the search; deliberate, commented in source).
- `notesSelectedTagsProvider` — `Set<String>` of selected tag ids; **not** autoDispose —
  tag filter selection persists across navigation for the app session.
- Data: `notesStreamProvider` (live list of all notes), `tagsStreamProvider` (all tags).

### Async states

- loading → centered spinner (Material `CircularProgressIndicator`);
- error → centered text, `body` style colored `accentDanger`:
  message from `friendlyError` with fallback **"Couldn't load your notes."** (see §18.6);
- data → the scroll view below.

### Layout (a single CustomScrollView; slivers top → bottom)

1. **Search field** — padding (12, 0, 12, 8):
   - placeholder `Search notes`, hint style `body` colored `textDim`;
   - leading (prefix) Material icon `search`, color `textSecondary`;
   - filled, fill `bgGlass`; content-padding 12 horizontal;
   - border radius `sm = 8`; enabled border 1px `borderSubtle`,
     focused border 1px `borderGlow`;
   - input text style `body`; every keystroke writes to `notesSearchProvider`
     (no debounce — filtering is synchronous & local).
2. **Tag filter row** (only if at least one tag exists in the whole DB): a 38px-high
   horizontal scroller, horizontal padding 12, 8px gaps; one `TagChip` (§14) per tag,
   ordered by the global tags stream (alphabetical by displayName, case-sensitive
   lexicographic — see §18.4). Chip selected state = its tag id ∈ selected set; tap
   toggles membership.
3. 8px spacer.
4. **List or empty state**:
   - If the filtered list is empty → fills remaining viewport, centered column, padding 32:
     - Material icon `note_outlined`, 48px, color `accentPrimary @ 40%`;
     - 8px gap; headline text: `No matches` when a search query is active, else `No notes yet`;
     - 4px gap; caption text (centered): `Try a different search.` when query active,
       else `Tap + to capture your first note.`
   - Else a vertical list of note rows, horizontal padding 12, 12px gap between cards.
5. Bottom spacer 32px.

### Filtering (exact algorithm)

```text
search  = lowercase(searchInput)          # raw, not trimmed
selected = set of selected tag ids
keep note if:
  (search == '' OR lowercase(note.title).contains(search)
               OR lowercase(note.body).contains(search))
  AND
  (selected.isEmpty OR any(note.tags, t -> t.id ∈ selected))   # OR across tags
```

Order: as provided by the stream — **`updatedAt` descending** (most recently edited first).

### Row interactions

- **Tap** → push `/captures/note/{id}`.
- **Long-press** → confirmation dialog (web: context menu/right-click or an explicit
  affordance — see §25 open questions):
  - Material AlertDialog, background `bgElevated`;
  - title `Delete note?` (headline style);
  - buttons: `Cancel` (body, `textSecondary`) and `Delete` (body, `accentDanger`);
  - no body text; confirming calls `deleteNote(id)` (§18.2) — no undo, no snackbar.

---

## 7. View: Links list (embedded in home)

File: `lib/features/captures/views/links_list_view.dart`

Identical structure and styling to the Notes list with these differences:

- providers: `linksSearchProvider` (autoDispose string), `linksSelectedTagsProvider`
  (persistent set), data from `linksStreamProvider`;
- search placeholder: `Search links`;
- error fallback: **"Couldn't load your links."**;
- filter predicate matches on **title, url, note** (all lowercase `contains`):

```text
textOk = search == '' OR title~search OR url~search OR note~search
tagsOk = selected.isEmpty OR any(link.tags, t.id ∈ selected)
```

- empty state icon: Material `link` (48px, `accentPrimary @ 40%`);
- empty-state strings: `No matches` / `No links yet`;
  captions: `Try a different search.` / `Save Discord messages and other URLs here.`;
- delete dialog title: `Delete link?`; confirm calls `deleteLink(id)`;
- tap pushes `/captures/link/{id}`.

Sort: `updatedAt` descending.

---

## 8. View: Note editor (modal bottom sheet)

File: `lib/features/captures/views/note_editor_view.dart`
Opened by: home `+` (create) or detail `Edit` (edit, receives the `NoteModel`).

### Sheet behavior

- Draggable sheet: initial height 92% of viewport, min 50%, max 95%; the content list
  scrolls within it. Swipe-to-dismiss of the *modal* is disabled (`enableDrag:false` at
  `showModalBottomSheet`); the sheet's own drag between 50–95% remains.
- Top corners rounded `lg = 22` (ClipRRect vertical top radius).
- Inside: its own Scaffold, background `bgDeepest`, `AppBackground(showsScanlines:false)`,
  body extends behind a transparent app bar.

### App bar (transparent, no elevation)

- leading (width 80): text button `Cancel` — `body` colored `textSecondary`; triggers the
  close flow (below);
- centered title: `New note` when creating, `Edit note` when editing — `headline`;
- trailing (right padding 8): text button `Save` — `body w600`; color `accentPrimary`
  when enabled else `textDim` (disabled).

### Body (scrollable list; padding left/right 12, top = safe-area + toolbar + 8, bottom = 32 + keyboard inset)

1. `GlassCard` containing:
   - **Title field** — borderless TextField, hint `Title`, hint style `title` colored
     `textDim`, text style `title` (Inter 22 w600), sentence auto-capitalization,
     single line (default), dense;
   - divider: 1px line `borderSubtle`, 8px vertical margins;
   - **Body field** — borderless, hint `Body`, hint `body`+`textDim`, style `body`,
     sentence capitalization, min 6 lines, max 30 lines (grows with content).
2. 16px gap.
3. `SectionHeader` — `TAGS` with Material icon `tag`.
4. 8px gap.
5. `TagInputField` (§15) seeded with current tag display-names; suggestion pool = every
   tag displayName in the DB.

Both text fields trigger a re-render on change (live enable/disable of Save & dirty
tracking).

### Validation / Save enablement

`canSave = trim(title) != '' OR trim(body) != ''` — at least one of title/body non-blank.
Tags alone do not enable save.

### Dirty tracking & discard guard

```
dirty = title != initialTitle OR body != initialBody OR tags list != initialTags (ordered equality)
```
Attempting to close (Cancel button, back gesture/navigation pop) while dirty shows:
- AlertDialog on `bgElevated`; title `Discard changes?` (headline);
  content `You have unsaved changes.` (body);
- actions: `Keep editing` (body, textSecondary) → stay; `Discard` (body, accentDanger) → close.
Not dirty → closes immediately.

### Save flow

1. Commit any half-typed tag token in the tag field (F38 — `TagInputController.commitPending`).
2. Call `saveNote(id?, title, body, tagDisplayNames)` (§18.2). Title/body are saved
   **as typed** (not trimmed).
3. On failure: log, show snackbar (inside the sheet's own messenger) with
   `friendlyError(e, fallback: "Couldn't save — please try again.")`, keep the sheet open.
4. On success: "success" haptic (medium impact) and close the sheet. The lists update
   automatically via the live stream.

---

## 9. View: Link editor (modal bottom sheet)

File: `lib/features/captures/views/link_editor_view.dart`

Identical shell/app-bar/sheet/guard behavior to the Note editor; differences:

- title: `New link` / `Edit link`;
- card fields, top → bottom, separated by the same 1px `borderSubtle` dividers
  (8px vertical margins):
  1. **Title** — hint `Title (optional)`, hint/style `headline` (17 w600) — note: smaller
     than the note editor's 22px title style;
  2. **URL** — hint `https://...`, style `mono 13px` (hint `mono 13` + `textDim`),
     URL keyboard type, autocorrect off, suggestions off, single line;
  3. **Note** — hint `Note (optional)`, `body` style, sentence capitalization,
     min 3 / max 10 lines.
- `canSave = trim(url) != ''` — **URL is the only required field**. No format/scheme
  validation at save time (any non-blank string is accepted; scheme checking happens at
  open time, §16/§18.7).
- dirty check covers title, url, note, tags.
- save calls `saveLink(id?, title, url, note, tagDisplayNames)`; same error snackbar
  (`"Couldn't save — please try again."`), haptic, close.

---

## 10. View: Note detail (`/captures/note/:id`)

File: `lib/features/captures/views/note_detail_view.dart`

### Data resolution

Watches the same `notesStreamProvider`; picks the note whose `id == noteId`.
While the stream has no value yet **or the id is not found**, renders a plain
`bgDeepest` scaffold with a centered spinner. (Caveat: a deleted/nonexistent id spins
forever — flagged in §25.)

### App bar

Transparent over the background, body extends behind it; title `Note` (headline);
back icon (Material default back arrow) tinted `accentPrimary`;
action: text button `Edit` — `body w600 accentPrimary` — opens the Note editor sheet
pre-filled (same modal parameters as home: isScrollControlled, enableDrag:false,
transparent background). Because the detail view watches the stream, the page updates
live after the editor saves.

### Body

`AppBackground` **with scanlines** (default true here) → `PageScrollView` with padding
(12, safeTop + toolbar + 8, 12, 32):

1. `GlassCard`:
   - title (only if non-empty) — `title` style (22 w600);
   - if body non-empty: divider (1px `borderSubtle`, 12px vertical margins, only when a
     title is present) then the body rendered as **markdown** (§16);
2. 16px gap;
3. Meta row: left — relative date of `updatedAt` in `caption` style (§18.5);
   right — the note's tag chips (read-only, no tap), horizontally scrollable if
   overflowing, right-aligned (scroll view is `reverse`d so the end of the list is
   visible first), 4px between chips.

No delete affordance on the detail page (delete is only via list long-press).

---

## 11. View: Link detail (`/captures/link/:id`)

File: `lib/features/captures/views/link_detail_view.dart`

Same skeleton as Note detail (spinner fallback, transparent app bar with title `Link`,
`Edit` action, scanlines on, same paddings). Card content:

1. Title (only if non-empty) — `title` style; 8px gap below.
2. **URL row** (tappable when the URL parses as a URI):
   - leading icon 18px: Material `forum_outlined` if `link.url` contains the substring
     `discord` (case-sensitive) else Material `link`;
     icon color `accentPrimary` when the URL parses, else `textSecondary`;
   - 8px gap; URL text `mono 13`, colored `accentSecondary` + underline
     (decoration color `accentSecondary`) when parseable, else `textSecondary`
     without underline;
   - tap → `launchExternal` (§18.7): scheme-allowlisted external open.
3. If `note` non-empty: divider (1px `borderSubtle`, 12px vertical margins), then the
   note rendered as markdown (§16).
4. Below the card: same meta row (relative `updatedAt` + right-aligned read-only chips).

---

## 12. Widget: NoteCard (list row)

File: `lib/features/captures/widgets/note_card.dart`

`GlassCard` (fill `#111E30`, border `borderSubtle`, radius 14, padding 12) containing a
left-aligned column:

1. Title (if non-empty): `headline` (17 w600), max 2 lines, ellipsis.
2. If body non-empty: 8px gap; body preview: `body` (15) — the **raw markdown source**
   (not rendered), max 3 lines, ellipsis.
3. 8px gap; bottom row:
   - relative `updatedAt` (`caption`);
   - spacer;
   - tag chips (read-only), right-aligned, horizontally scrollable (reverse), 4px gaps.

---

## 13. Widget: LinkCard (list row)

File: `lib/features/captures/widgets/link_card.dart`

`GlassCard` column:

1. Header row: icon 18px `accentPrimary` — `forum_outlined` when url contains `discord`
  else `link`; 8px gap; column:
   - display title: `link.title` if non-empty else the url — `headline`, max 2 lines,
     ellipsis;
   - 2px gap; the url — `mono 11px` colored `textSecondary`, 1 line, ellipsis.
2. If note non-empty: 8px gap; note preview (raw text) — `body` colored `textSecondary`,
   max 2 lines, ellipsis.
3. If tags: 8px gap; horizontally scrollable chips (forward direction here,
   left-aligned), 4px gaps.

Note asymmetry vs NoteCard: LinkCard shows **no date** on the card and its chips are
left-aligned; NoteCard shows the date and right-aligns chips.

---

## 14. Widget: TagChip

File: `lib/features/captures/widgets/tag_chip.dart`

Pill: padding 10px horizontal / 5px vertical, border-radius 20 (fully rounded), 1px border.

| State | text/icon color | background | border |
|---|---|---|---|
| unselected | `accentPrimary` | `accentPrimary @ 15%` | `accentPrimary @ 40%` |
| selected | `bgDeepest` (#03060B) | `accentPrimary` (solid) | transparent |

Label: 12px, weight 500 (font family inherited → Inter), no decoration.
Optional trailing remove affordance (used in the editor's selected chips): 6px gap then a
Material `close` icon at 12px — color `bgDeepest` when selected else label-color @ 80%.
Taps on the chip and on the remove icon each fire a "selection" haptic before invoking
their callbacks. Chips without `onTap` (detail/card contexts) are inert.

---

## 15. Widget: TagInputField (+ TagInputController)

File: `lib/features/captures/widgets/tag_input_field.dart`

A combined chips-plus-input control used by both editors (and by the Hangar ship editor).

### Structure

1. Container: padding 12 horizontal / 8 vertical, fill `bgGlass`, radius `sm = 8`,
   1px border — `borderGlow` when the inner input is focused else `borderSubtle`.
   Contents wrap onto multiple lines (8px column & row gaps, items vertically centered):
   - one **selected** TagChip per current tag (selected style, with remove ✕; removing
     calls back with the tag filtered out — comparison by exact string);
   - the text input, intrinsic width with min-width 80px: borderless, dense,
     placeholder default **`Add tag…`** (`body` + `textDim`; overridable prop),
     style `body`, autocorrect off, suggestions off, Enter key = "done",
     newline characters are blocked by an input formatter.
2. If suggestions exist: 8px gap below the box, a horizontal scroll row of **unselected**
   TagChips, 8px apart; tapping one adds it (exact pool string) and clears the input.

### Suggestion algorithm

```text
raw = lowercase(trim(inputText))
if raw == '' → no suggestions
else → first 6 of suggestionPool where lowercase(pool).contains(raw)
                                     AND pool not already in selectedTags (exact match)
```
Pool = every tag displayName in the DB (alphabetical). Max 6 suggestions.

### Commit (tokenization) rules

- Typing a comma `,` **or ending the input with a space** immediately commits the token.
- Enter/submit commits.
- Commit = `trim(text.replaceAll(',', ''))`; empty result → just clear the field.
- `_add(tag)`: ignore blank; ignore if a selected tag already equals it
  case-insensitively; else append to the list (order preserved = insertion order).
- The parent editor holds the list of **display-name strings**; nothing touches the DB
  until Save.
- `TagInputController.commitPending()` — the editors call this first thing in `_save()`
  so a half-typed tag ("salvage" typed but not comma'd) is still included (F38).

Consequence of the space rule: **multi-word tags cannot be typed** (a space commits);
tags never contain commas or newlines; leading/trailing whitespace is trimmed.

---

## 16. Widget: UnderdeckMarkdownView

File: `lib/features/captures/widgets/markdown_view.dart`
Used for: note bodies and link notes on the **detail** pages only (lists show raw text).

Rendering: the Flutter `flutter_markdown_plus` `MarkdownBody` — standard CommonMark-ish
subset (paragraphs, headings, emphasis, strong, links, inline code, fenced code blocks,
blockquotes, bulleted/numbered lists). Web equivalent: `react-markdown` or `marked` +
sanitizer. Style sheet (map to CSS):

| Element | Style |
|---|---|
| `p` | `body` (Inter 15 w400 `#E8F4FF`) |
| `h1` | `title` (Inter 22 w600) |
| `h2` | `headline` (Inter 17 w600) |
| `h3` | headline at 15px |
| `em` | body italic |
| `strong` | body w700 |
| `a` | body, color `accentPrimary`, underline (decoration color `accentPrimary`) |
| inline `code` | JetBrainsMono 13, color `accentSecondary`, background `bgGlass` |
| code block | container: fill `bgGlass`, radius 6, 1px border `borderSubtle`, padding 8 |
| `blockquote` | body italic, color `textSecondary`; left border 3px solid `accentPrimary` |
| list bullet | `body` |

Link taps route through `launchExternal` (§18.7) — never a raw `window.open` of
arbitrary schemes.

---

## 17. Widget: BackupReminderBanner

File: `lib/features/captures/widgets/backup_reminder_banner.dart`
Rendered at the top of the Captures home body (above the segmented control). Renders
`null` (nothing) unless the reminder is due.

### Visibility logic (pure function `BackupReminder.shouldShowReminder`)

Constants:
```
reminderThreshold        = 30 days
snoozeDuration           = 7 days
autoBackupChangeThreshold = 20 write batches   (auto-backup, out of banner scope)
autoBackupKeep           = 3 files
```

```text
show =
  hasData                                         # any user data at all (COUNT over 9 tables > 0)
  AND NOT (snoozedUntil != null AND now < snoozedUntil)
  AND (lastBackupAt == null                       # never backed up → changedSinceBackup true
       OR lastChangedAt == null                   # unknown change time counts as changed
       OR lastChangedAt > lastBackupAt)           # data changed since last backup
  AND (lastBackupAt == null OR now − lastBackupAt >= 30 days)
```

`hasData` / `lastChangedAt` come from a cheap aggregate over notes, links, ships,
scanHistory, trackerHistory, discoveryHistory, favorites, jobStatus, mapPins
(`COUNT(*)` and `MAX(timestamp)` per table; `lastChangedAt` = max across all).

Label (`lastBackupLabel`): `daysSince = max(0, floor((now − lastBackupAt) in days))`;
- null → `never backed up`
- 0 → `backed up today`
- 1 → `last backup yesterday`
- n → `last backup {n} days ago`

### Visual layout

Container: margins (12 left/right, 8 top, 0 bottom), padding 12, fill
`accentWarn @ 10%`, radius `md = 14`, 1px border `accentWarn @ 45%`. Row:

1. Material icon `backup_outlined`, 20px, `accentWarn`; 8px gap.
2. Column (flexes):
   - title `Back up your data` — `body` w600;
   - 2px gap; caption:
     `Everything lives on this device only — {label}. Export a copy so an uninstall can't wipe it.`
   - 8px gap; button row:
     - primary `_BannerButton`: label `Export now` (while running: `Exporting…`),
       leading Material icon `upload` 16px; style: padding 12 h / 8 v, radius 8,
       fill `accentWarn @ 12%`, border `accentWarn @ 55%`, text `caption` w600
       `accentWarn`; disabled during export at 50% opacity;
     - 8px gap; subtle `_BannerButton`: label `Later` — transparent fill, border
       `borderSubtle`, text/tint `textSecondary`.
3. Dismiss ✕: Material `close` 18px `textDim`, left padding 4; accessible label
   `Dismiss backup reminder`.

### Actions

- **Export now**: light haptic; runs the shared JSON export → native share sheet
  (`share_plus`, iPad popover anchored to the banner's rect). If the share result is
  anything but an explicit "dismissed", it counts as a backup: `markBackedUp(now)`
  (persists `settings.lastBackupAt`, clears snooze) and the banner disappears.
  On exception: snackbar `Export failed. Please try again.` (via friendlyError fallback).
  Re-entrancy guarded by an `_exporting` flag.
- **Later** and **✕** both: light haptic; snooze until `now + 7 days`
  (persists `settings.backupReminderSnoozedUntil`); banner hides immediately.

Web adaptation: replace the share sheet with a Blob download of the export JSON
(`underdeck-export.json`) and treat a completed download as backed-up.

---

## 18. Business logic

### 18.1 Tag resolution (`_resolveTags(displayNames)`)

Given the editor's ordered list of display-name strings:

```text
existing = all tag rows;  byKey = { row.name → row }   # name = lowercase unique key
out = [];  seen = {}
for raw in displayNames:
    trimmed = trim(raw);            if trimmed == '' continue
    key = lowercase(trimmed);       if key ∈ seen continue      # dedupe within input
    seen += key
    if byKey[key] exists → out += existing tag                  # reuse, displayName UNCHANGED
    else → insert new tag { id: uuidv4, displayName: trimmed, name: key, colorHex: null }
           out += it
return out                                                       # ordered as typed
```

Key facts: case-insensitive global dedupe on `name`; the **first-ever spelling wins** for
`displayName` (typing "SALVAGE" later still shows "Salvage" if that existed first);
`colorHex` is never set by any current UI.

### 18.2 Save / delete (all inside a single DB transaction — atomicity tag "F45")

`saveNote({id?, title, body, tagDisplayNames})`:
1. `now = DateTime.now()`; `noteId = id ?? uuidv4()`.
2. In a transaction: resolve tags (18.1); INSERT (create: sets createdAt=updatedAt=now) or
   UPDATE (edit: writes title/body/updatedAt=now; createdAt untouched);
   DELETE all `note_tags` for the note then INSERT one row per resolved tag;
   then **prune orphan tags** (18.3).
3. Returns the saved model. No trimming of title/body.

`saveLink({id?, title, url, note, tagDisplayNames})` — identical shape with the three
text columns (also saved untrimmed).

`deleteNote(id)` / `deleteLink(id)`: transaction { delete join rows for the entity;
delete the entity row; prune orphan tags }.

### 18.3 Orphan tag pruning (`pruneOrphanTags`)

One SQL DELETE (comment tag "R9a"):

```sql
DELETE FROM tags WHERE
  NOT EXISTS (SELECT tag_id FROM note_tags WHERE note_tags.tag_id = tags.id) AND
  NOT EXISTS (SELECT tag_id FROM link_tags WHERE link_tags.tag_id = tags.id) AND
  NOT EXISTS (SELECT tag_id FROM ship_tags WHERE ship_tags.tag_id = tags.id);
```

Runs after every note/link save & delete (and after ship-tag updates in the Hangar
feature). Effect: the tag-filter rows only ever show tags in actual use.

### 18.4 Sorting

- Tags stream: `ORDER BY display_name ASC` (SQLite default collation — case-sensitive
  binary ordering: all uppercase letters sort before lowercase).
- Notes stream: `ORDER BY updated_at DESC`.
- Links stream: `ORDER BY updated_at DESC`.

### 18.5 Relative date (`formatRelativeDate`, used on cards & detail meta rows)

```text
diff = now − date
date in the future        → 'd MMM y, HH:mm' (e.g. "11 Jul 2026, 14:03", local time)
diff < 1 min              → "just now"
diff < 60 min             → "{minutes} min ago"
diff < 24 h               → "{hours}h ago"
diff < 7 days             → "{days}d ago"
diff < 30 days            → "{floor(days/7)}w ago"
diff < 365 days           → "{floor(days/30)} mo ago"
else                      → 'd MMM y' (e.g. "3 Jun 2025")
```
(Not live-refreshing; recomputed on rebuild.)

### 18.6 Error text (`friendlyError(error, fallback)`)

Never show raw exception text. For network exceptions (not relevant to captures'
local-only ops): connection/timeout → `No network connection. Check your signal and try
again.`, cancel → `Request cancelled.`, other → `Couldn't reach the server. Please try
again.`. A `FormatException` with a non-empty message shows that message. Anything else
(DB failures included) → the screen-specific fallback:
- notes list: `Couldn't load your notes.`
- links list: `Couldn't load your links.`
- editors: `Couldn't save — please try again.`
- export: `Export failed. Please try again.`

### 18.7 External link opening (`launchExternal`) — security rule "R4"

Allowed schemes: **`http`, `https`, `mailto`** (lowercased scheme compare). The href is
trimmed and parsed; unparseable or disallowed schemes (e.g. `javascript:`, `tel:`, custom
app schemes possibly present in imported data) are **blocked** and show a snackbar
`Couldn't open that link.` on a `accentDanger` background. Allowed URLs open in the
external browser/app; if the OS launch fails, the same snackbar shows.
Web: `window.open(url, '_blank', 'noopener,noreferrer')` after the same allowlist check.

### 18.8 Discord detection

`link.url.contains('discord')` — plain case-sensitive substring test, used only to swap
the icon (`forum_outlined` vs `link`) in LinkCard and LinkDetail.

---

## 19. Data models & persistence schema

### 19.1 TypeScript-ready models

```ts
interface TagModel  { id: string; displayName: string; name: string; colorHex: string | null; }
interface NoteModel { id: string; title: string; body: string;
                      createdAt: Date; updatedAt: Date; tags: TagModel[]; }
interface LinkModel { id: string; title: string; url: string; note: string;
                      createdAt: Date; updatedAt: Date; tags: TagModel[]; }
```
All ids are UUID v4 strings. `title`, `body`, `url`, `note` default to `''` (non-null).
`tags` ordering in a loaded model is join-table order (effectively insertion order).

### 19.2 SQL schema (Drift → SQLite; app schemaVersion = 5)

```sql
CREATE TABLE notes (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,      -- drift datetime (unix seconds)
  updated_at INTEGER NOT NULL
);
CREATE TABLE links (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE tags (
  id TEXT NOT NULL PRIMARY KEY,
  display_name TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,        -- lowercase dedupe key (F44)
  color_hex TEXT                    -- nullable; currently always NULL from the UI
);
CREATE TABLE note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
CREATE TABLE link_tags (
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (link_id, tag_id)
);
CREATE TABLE ship_tags (               -- owned by Hangar but shares the tags table
  ship_id TEXT NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (ship_id, tag_id)
);
-- PRAGMA foreign_keys = ON is set on every connection.
```

Web persistence suggestion: IndexedDB (Dexie) with the same shape, or sql.js/wa-sqlite.
The FK-cascade + unique-name invariants must be enforced in code if IndexedDB is used.

### 19.3 SharedPreferences keys touched by this feature (via the backup banner)

| Key | Type | Meaning |
|---|---|---|
| `settings.lastBackupAt` | int (ms epoch) | last successful export/backup |
| `settings.backupReminderSnoozedUntil` | int (ms epoch) | banner hidden until this time |
| `settings.hapticsEnabled` | bool (default true) | gates all haptic calls |
| `settings.autoBackupEnabled` | bool (default false) | opt-in silent auto-export (settings screen; captures only indirectly) |

Web equivalent: `localStorage` with the same keys.

---

## 20. State management & providers (Riverpod → your state lib)

| Provider | Kind | Lifetime | Purpose |
|---|---|---|---|
| `capturesRepositoryProvider` | Provider | app | repository over the DB |
| `tagsStreamProvider` | StreamProvider | app | live `List<TagModel>`, name-sorted |
| `notesStreamProvider` | StreamProvider | app | live `List<NoteModel>` incl. joined tags, updatedAt DESC |
| `linksStreamProvider` | StreamProvider | app | live `List<LinkModel>` idem |
| `capturesModeProvider` | StateProvider\<CapturesMode> | app | notes/links segmented mode |
| `notesSearchProvider` | StateProvider\<String> **autoDispose** | while notes list mounted | search text (cleared on leave) |
| `notesSelectedTagsProvider` | StateProvider\<Set\<String>> | app | selected tag-id filter |
| `linksSearchProvider` | StateProvider\<String> **autoDispose** | while links list mounted | idem |
| `linksSelectedTagsProvider` | StateProvider\<Set\<String>> | app | idem |
| `backupStatusProvider` | FutureProvider **autoDispose** | recomputed on invalidate | `{hasData, lastChangedAt}` snapshot |

Stream mechanics: the note/link streams are `combineLatest(entityRows, joinRows⋈tags)`
— i.e. any insert/update/delete of notes/links/tags/join rows re-emits a fully joined
list. Web equivalent: Dexie `liveQuery`, or manual pub/sub invalidation after each write.
Since deletes/saves go through the repository, the UI never mutates lists directly.

Loading/error/empty matrix (lists): loading → spinner; error → red message; empty (after
filter) → icon + two-line empty state. Detail views: missing data → spinner only.
No pull-to-refresh, no debounce, no pagination anywhere (lists are fully in-memory).
Note: a stale-tag edge case — selected filter tag ids that no longer exist simply never
match, so the filtered list can appear empty until the user clears chips (the chips row
itself only renders existing tags).

---

## 21. Export / import (captures portion of the app-wide JSON)

The app-wide export (Menu → settings, and the banner's Export now) is one JSON document:

```jsonc
{
  "version": 1,
  "app": "Underdeck",
  "exportedAt": "2026-07-11T09:00:00.000Z",       // UTC ISO-8601
  "data": {
    "notes":    [{ "id", "title", "body", "createdAt", "updatedAt" }],       // UTC ISO strings
    "links":    [{ "id", "title", "url", "note", "createdAt", "updatedAt" }],
    "tags":     [{ "id", "displayName", "name", "colorHex" }],
    "noteTags": [{ "noteId", "tagId" }],
    "linkTags": [{ "linkId", "tagId" }],
    "shipTags": [{ "shipId", "tagId" }],
    // ... ships, scanHistory, trackerHistory, discoveryHistory, favorites, jobStatus, mapPins
  }
}
```

Import rules relevant to captures (implemented elsewhere but constraining the schema):
- notes/links merge **by id, newer `updatedAt` wins**; equal/older imported rows are
  ignored; `createdAt` is preserved on update;
- tags dedupe by lowercase `name`: an imported tag whose name already exists locally is
  remapped onto the local id (join rows follow the remap);
- join rows referencing missing parents are skipped;
- malformed rows are skipped individually, never abort the import;
- unreadable `updatedAt` in an import loses (treated as epoch 0); unreadable `createdAt`
  becomes `now`.
- invalid file message: `This file isn't a valid Underdeck export`; version too new:
  `Unsupported export version: {v} (expected ≤ 1)`.

Temp export filename: `underdeck-export.json`. Auto-backups (opt-in):
`backups/underdeck-backup-{ISO-stamp}-{ms}-{seq}.json`, keep newest 3.

---

## 22. Platform features & web equivalents

| Feature | Where | Flutter plugin | Web equivalent |
|---|---|---|---|
| Haptics: light impact ("tap"), selection click, medium impact ("success") | banner +, segmented switch, tag chips, save success, back-to-top, banner buttons | `HapticFeedback` | `navigator.vibrate?.(10)` where available, gated by the haptics setting — or **drop** (recommended: drop, keep the setting no-op) |
| Share sheet for export file | BackupReminderBanner "Export now" | `share_plus` (returns dismissed/success) | Blob + `<a download="underdeck-export.json">`; count a completed download as backed up. `navigator.share({files})` optional progressive enhancement |
| External URL open | link detail URL, markdown links | `url_launcher` (external app mode) | `window.open(url,'_blank','noopener,noreferrer')` after the http/https/mailto allowlist |
| Modal bottom sheet (drag 50–95%) | both editors | `showModalBottomSheet` + `DraggableScrollableSheet` | modal overlay/drawer; drag-resize optional; **must** keep the dirty-close guard |
| Long-press to delete | list rows | `GestureDetector.onLongPress` | context menu / long-press on touch; consider adding a visible delete affordance (see §25) |
| Back-gesture interception when dirty | editors (`PopScope`) | Navigator | intercept overlay-close (Esc, backdrop click, history back) with the same Discard dialog |
| Keyboard insets / dismiss-on-drag | editors, lists | MediaQuery/scroll config | native browser behavior; ensure editor bottom padding when the virtual keyboard shows |
| Local SQLite (Drift) | all persistence | `drift` | IndexedDB (Dexie) or wa-sqlite; keep invariants of §19.2 |
| SharedPreferences | backup reminder state | `shared_preferences` | `localStorage` |
| File picker (import) | settings area (adjacent) | `file_selector` | `<input type="file" accept="application/json">` |

---

## 23. Assets

The captures feature loads **no images or JSON assets** directly. Indirect asset
dependencies (fonts, bundled at app level):

- `assets/fonts/Inter-Variable.ttf` (family `Inter`)
- `assets/fonts/JetBrainsMono-Variable.ttf` (family `JetBrainsMono`)
- `assets/fonts/Quicksand-Variable.ttf` (family `Quicksand`) — not actually used by any
  captures style, but part of the global theme
- License texts shipped: `assets/fonts/Inter-OFL.txt`, `assets/fonts/JetBrainsMono-OFL.txt`,
  `assets/fonts/Quicksand-OFL.txt`

Icons are Material icon-font glyphs (names given per usage): `add`, `search`,
`note_outlined`, `link`, `forum_outlined`, `tag`, `close`, `backup_outlined`, `upload`,
`arrow_upward`, plus the nav tab's `note_alt_outlined`/`note_alt`.

---

## 24. Complete copy-string inventory (verbatim)

Banner / chrome
- `ESSI · Operator Logbook` (notes banner label; displayed uppercase)
- `ESSI · External Comms Cache` (links banner label; displayed uppercase)
- `Notes`, `Links` (segmented control)

Notes list
- `Search notes` (placeholder)
- `No matches` / `Try a different search.` (filtered-empty)
- `No notes yet` / `Tap + to capture your first note.` (true empty)
- `Couldn't load your notes.` (stream error)
- `Delete note?` / `Cancel` / `Delete` (long-press dialog)

Links list
- `Search links`
- `No matches` / `Try a different search.`
- `No links yet` / `Save Discord messages and other URLs here.`
- `Couldn't load your links.`
- `Delete link?` / `Cancel` / `Delete`

Note editor
- `New note` / `Edit note` (title), `Cancel`, `Save`
- `Title` (hint), `Body` (hint)
- `Tags` (section header; displayed `TAGS`)
- `Add tag…` (tag input placeholder)
- `Discard changes?` / `You have unsaved changes.` / `Keep editing` / `Discard`
- `Couldn't save — please try again.` (save-failure snackbar)

Link editor
- `New link` / `Edit link`, `Cancel`, `Save`
- `Title (optional)`, `https://...`, `Note (optional)`
- same Tags / discard / error strings as above

Detail views
- `Note` (app-bar title), `Link` (app-bar title), `Edit`
- `Couldn't open that link.` (blocked/failed URL snackbar)

Backup banner
- `Back up your data`
- `Everything lives on this device only — {label}. Export a copy so an uninstall can't wipe it.`
  where `{label}` ∈ { `never backed up`, `backed up today`, `last backup yesterday`,
  `last backup {n} days ago` }
- `Export now` / `Exporting…` / `Later`
- `Dismiss backup reminder` (a11y label)
- `Export failed. Please try again.`

Relative dates: `just now`, `{n} min ago`, `{n}h ago`, `{n}d ago`, `{n}w ago`,
`{n} mo ago`, else `d MMM y` (and `d MMM y, HH:mm` for future dates).

---

## 25. Open questions / spec gaps for the web team

1. **Detail view for a deleted/unknown id spins forever** (source behavior). Web should
   probably render a "not found" state with a back link instead of replicating the bug.
2. **Long-press delete has no pointer-friendly equivalent** on desktop web; decide on a
   kebab menu / swipe action / delete button in the detail view.
3. `Tag.colorHex` exists in the schema and export format but no UI reads or writes it —
   keep the field for round-trip compatibility; rendering is always accentPrimary.
4. The tag-filter selection (`*SelectedTagsProvider`) survives navigation but not app
   restart; the search text resets on navigation. Confirm this asymmetry is wanted on web.
5. The space-commits-token rule makes multi-word tags impossible to create, yet imported
   tags MAY contain spaces (import doesn't sanitize `name`); the chips render them fine.
6. Scanlines are off on home/editors but on for detail pages — likely incidental, but
   replicated here for fidelity; confirm whether web should unify.
7. URL field accepts any non-blank string (no validation until open-time scheme check);
   confirm desired web behavior (probably keep as-is).
8. `discord` icon detection is case-sensitive (`Discord.com` in mixed case still matches
   because hostnames are lowercase in practice, but `DISCORD` in a path would not).
9. Sector-code Easter egg (ESSI//nnn scroll counter) — cheap to replicate; confirm it's wanted.

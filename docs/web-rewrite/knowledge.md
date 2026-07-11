# Underdeck — Knowledge Base, Favorites & Global Search — Web Recode Spec

Area: `lib/features/knowledge/` (EXCEPT `maps/`), `lib/features/search/`, `lib/features/favorites/`, `assets/knowledge/`.
Target: Vite + React + TypeScript, GitHub Pages (static hosting, hash-based routing recommended).

This document is the ONLY source for reimplementing this area. It covers three subsystems:

1. **Knowledge Base (KB)** — a bundled, offline article library (manifest + markdown files) with categories, an article reader with themed markdown rendering, per-article bookmarking, and an in-page prefix search.
2. **Favorites** — a generic, persistent star/pin/bookmark store shared across the whole app (jobs, KB articles, fishing zones, tracked objects, maps, map zones). Only the KB usage is detailed here; the storage layer is fully specified because it is shared.
3. **Global Search** — a federated search screen (reached from the Menu tab) that fans a single query out to 6 sources (map zones, KB articles, jobs, wallets, notes & links, personal map notes), groups results by source, and caps each group at 5.

The interactive maps subsystem (`lib/features/knowledge/maps/`) is documented in a separate spec. Where this area touches it (the "Interactive maps" block on the KB home, map-zone search hits), the touch points are described here and the internals deferred.

---

## Table of contents

1. Design-system tokens and shared components used by this area
2. Routes & navigation
3. View: KB Home (`/knowledge`)
4. View: KB Category (`/knowledge/category/:id`)
5. View: KB Article (`/knowledge/article/:slug`)
6. Component: KBMarkdownView (markdown rendering rules)
7. Internal & external link handling (`underdeck://` scheme)
8. Data models & loading (manifest format, KBData)
9. KB search index (tokenizer, ranking) — exact algorithm
10. Favorites system (Drift table, repository, FavoriteButton)
11. View: Global Search (`/menu/search`)
12. Global search: sources, federation, business logic
13. Assets inventory (`assets/knowledge/`)
14. Platform features → web equivalents
15. Full copy-string compendium
16. Open questions

---

## 1. Design-system tokens and shared components used by this area

### 1.1 Colors (exact hex, from `lib/design_system/colors.dart`)

| Token | Value | Notes |
|---|---|---|
| `bgDeepest` | `#03060B` | Page background (near-black navy) |
| `bgElevated` | `#0A1220` | (not used directly in this area) |
| `bgGlass` | `#0F1C30` at **55% alpha** (`rgba(15,28,48,0.55)`) | Fill for text fields, code blocks, "see all" row |
| `bgCard` | `#111E30` (opaque) | Card fill (GlassCard) |
| `accentPrimary` | `#4FC3FF` | Cyan — icons, links, section headers, active bookmark |
| `accentSecondary` | `#7AE3FF` | Lighter cyan — inline code text, "or discuss on Discord" |
| `accentDanger` | `#FF5577` | Error text, error snackbar background |
| `accentWarn` | `#FFB347` | Draft-banner icon, "no matches" icon, default favorite active color |
| `accentSuccess` | `#5FE8A0` | Pulsing dot in the top banner |
| `textPrimary` | `#E8F4FF` | Body text |
| `textSecondary` | `#8AA4C2` | Captions, secondary icons |
| `textDim` | `#6E8AAB` | Hints, chevrons, inactive favorite icon |
| `borderSubtle` | `#7AE3FF` at **12% alpha** | 1px card & field borders, dividers |
| `borderGlow` | `#4FC3FF` at **45% alpha** | Focused text-field border |

### 1.2 Typography (from `lib/design_system/typography.dart`)

Font families are **bundled** (no Google Fonts CDN at runtime — privacy/offline requirement; for web, self-host the same variable TTFs/woff2):

- `Inter` (sans, variable weight) — `fontSans`
- `JetBrainsMono` (mono, variable weight) — `fontMono`
- `Quicksand` (rounded, variable weight) — `fontRounded` (not used in this area)

Named styles (all `color: textPrimary` unless overridden at call site):

| Style | Family | Size | Weight | Line height | Color |
|---|---|---|---|---|---|
| `title` | Inter | 22 | 600 | default | `#E8F4FF` |
| `headline` | Inter | 17 | 600 | default | `#E8F4FF` |
| `body` | Inter | 15 | 400 | default | `#E8F4FF` |
| `caption` | Inter | 12 | 500 | default | `#8AA4C2` (textSecondary) |
| `mono` | JetBrainsMono | 14 | 400 | default | `#E8F4FF` |
| `display` | Quicksand | 34 | 600 | 1.1 | (not used here) |
| `terminal` | JetBrainsMono | 13 | 500 | default | `#4FC3FF` (not used here) |

A recurring derived style, the **"kicker" / eyebrow label** (used by SectionHeader, category label above article titles, banner label): `mono` with `fontSize: 10–12`, `fontWeight: 600`, `letterSpacing: 2`, `color: accentPrimary`, text transformed to UPPERCASE.

### 1.3 Spacing & radii (from `lib/design_system/spacing.dart`)

```
AppSpacing: xxs=2, xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48   (all px)
AppRadius:  sm=8, md=14, lg=22                                          (px)
```

### 1.4 GlassCard (shared card component)

The signature container for every list row / card in this area.

- Fill: `bgCard` `#111E30` (opaque — deliberately NOT blurred by default for GPU cost; the historical look was `backdrop-filter: blur(18px)` over `bgGlass`, only used when `blur: true` which this area never passes).
- Border: 1px solid `borderSubtle` (`rgba(122,227,255,0.12)`).
- Border-radius: `AppRadius.md` = **14px** (default).
- Padding: `AppSpacing.md` = **12px** all sides (default).
- Optional `glow` (not used in this area): outer box-shadow `accentPrimary` @18% alpha, blur 14.
- Content is clipped to the rounded rect.

### 1.5 SectionHeader

Row layout: optional leading icon (18px, `accentPrimary`) + 8px gap + column of:
- Title: UPPERCASE, JetBrainsMono 12px, weight 600, letter-spacing 2, `accentPrimary`.
- Optional subtitle (2px below): `caption` style.

### 1.6 AppBackground (page backdrop, behind all content)

Stack, bottom to top:
1. Solid `bgDeepest` `#03060B`.
2. Radial gradient centered at top-left corner (Alignment(-1,-1)), radius 1.2 (relative), from `accentPrimary` @10% alpha to transparent.
3. A hex-grid pattern painter at **6% opacity** (decorative; a subtle hexagon wireframe — web: an SVG/canvas pattern or omit).
4. The page content.
5. A scanlines overlay at **55% opacity** on top of content, pointer-events none (thin horizontal CRT-style lines; web: repeating-linear-gradient overlay or omit).

Tapping anywhere on the background unfocuses the current text input (dismisses keyboard on mobile).

### 1.7 BannerPage + TransmissionHeader (KB Home top banner)

Main shell pages (KB Home is one) render an opaque "ESSI" banner pinned above the scrolling content (content scrolls *between* banner and bottom nav, never behind).

TransmissionHeader layout (full width, background `bgDeepest`, horizontal padding 12, vertical padding 6, inner bottom border 1px `borderSubtle` with 4px padding-bottom):
- Left: a small pulsing dot, color `accentSuccess` (animated pulse).
- 8px gap.
- Label (expands, ellipsis): UPPERCASE, JetBrainsMono 10px, weight 600, letter-spacing 2, `accentPrimary`. KB Home label: `ESSI · Archive & Doctrine` → renders `ESSI · ARCHIVE & DOCTRINE`.
- Right: scroll-driven "sector code" text, JetBrainsMono 10px, weight 500, `textDim`. Format `ESSI//NNN` where `NNN = 100 + ((seed + floor(scrollOffsetPx / 4)) % 900)`; `seed` is a random int in [0,900) chosen once per page instance. Pure flavor — number ticks as you scroll.
- Optional trailing action icon buttons (KB Home has none; Menu has a search icon).

### 1.8 PageScrollView (scroll wrapper used by Category / Article / Search views)

- Wraps content in a scrollable (single-child list) with caller padding.
- Keyboard dismisses on drag.
- **Back-to-top button**: appears once `scrollTop > viewportHeight`. Positioned bottom-right, 16px from right and bottom. Appearance/disappearance animated 200ms scale+fade. Button: 44×44 circle, fill `bgDeepest`, border 1px `accentPrimary` @60% alpha, box-shadow `accentPrimary` @40% blur 10; icon `arrow_upward` 22px `accentPrimary`. Click smooth-scrolls to top over 300ms ease-in-out (+ light haptic).

### 1.9 NeonButton (used by the "Contribute intel" card)

- Min-height 50, full width, border-radius 14 (`AppRadius.md`).
- Background: horizontal linear gradient `accentPrimary → accentSecondary` (`#4FC3FF → #7AE3FF`). (Danger variant: `#FF5577 → #FFB347` — not used here.)
- Border 1px `borderGlow`; box-shadow: tint (`accentPrimary`) @45% alpha, blur 14.
- Content centered: optional icon 18px + 8px gap + label, Inter 16px weight 600, color `bgDeepest` (dark text on bright button).
- Press feedback: scales to 0.97 over 200ms ease-out while pressed; light haptic on release.
- Disabled: whole button at 40% opacity (not used here).

### 1.10 TagChip (used to render article tags)

- Pill: padding 10px horizontal / 5px vertical, border-radius 20.
- Unselected (the only state used in this area): background `accentPrimary` @15% alpha, border 1px `accentPrimary` @40% alpha, label 12px weight 500 color `accentPrimary`.
- (Selected state elsewhere: solid `accentPrimary` background, label `bgDeepest`.)
- Tags render exactly as stored, e.g. `kb:map`, `kb:draft`.

### 1.11 Bottom navigation (context)

The app has a 5-tab bottom nav (Tools, Captures, Hangar, Knowledge, Menu). The Knowledge tab: label `Knowledge`, icon `menu_book_outlined` (inactive) / `menu_book` (active). Each tab is a separate navigation stack (state preserved when switching tabs — with react-router, nested routes per tab or a scroll-restoration approach).

---

## 2. Routes & navigation

go_router paths (recreate with react-router; suggest `HashRouter` for GitHub Pages):

| Path | View | How it's reached |
|---|---|---|
| `/knowledge` | KBHomeView | Bottom-nav "Knowledge" tab |
| `/knowledge/category/:id` | KBCategoryView | Tap a category card on KB Home |
| `/knowledge/article/:slug` | KBArticleView | Tap article row (category view or home search results), KB hit in global search, `underdeck://kb/<slug>` internal link |
| `/knowledge/maps` | MapsGalleryView (maps spec) | "View all"/"See all maps" on KB Home |
| `/knowledge/maps/:id?zone=<zoneId>` | MapDetailView (maps spec) | Map card, map-zone search hit, `underdeck://map/...` link |
| `/menu/search` | GlobalSearchView | Menu tab: banner search icon-button (tooltip "Search") or the "Search" menu row (subtitle "Maps, KB, jobs, wallets, notes", icon `search`) |

All pushes are stack pushes (back button returns). Unknown paths land on a global "Not found" screen (outside this area): icon `explore_off` 40px, text "This screen doesn't exist.", the offending path at 12px, and a filled button "Back to Underdeck" that goes to `/tools`.

Detail views (`category`, `article`, `search`) use a **transparent app bar drawn over the content** (`extendBodyBehindAppBar: true`, `backgroundColor: transparent`, `elevation: 0`): content scrolls behind the app-bar area; top content padding is `safeAreaTop + toolbarHeight(56) + 8`. The back arrow (and any app-bar icons) are tinted `accentPrimary`. App-bar titles use the `headline` style (Inter 17/600).

---

## 3. View: KB Home (`/knowledge`)

File: `lib/features/knowledge/views/kb_home_view.dart`.

### 3.1 Structure (top → bottom)

1. **TransmissionHeader banner** — label `ESSI · Archive & Doctrine` (see §1.7). Pinned; content scrolls under it. No trailing actions.
2. Scrollable content (CustomScrollView; the banner owns the scroll controller so the sector code ticks):
   1. **Search field** — padding (12, 12, 12, 8):
      - Placeholder: `Search articles` (style: body with `textDim` color).
      - Leading icon `search` (`textSecondary`).
      - Filled, fill color `bgGlass`; content-padding horizontal 12.
      - Border: 1px `borderSubtle`, radius 8 (`AppRadius.sm`); focused: 1px `borderGlow`.
      - Input text style: `body`.
      - **No debounce** — every keystroke updates the query state immediately.
      - Query state is an autoDispose provider: **navigating away from and back to the tab resets the query to empty** (field is rebuilt without a controller, so it shows blank). Recreate: clear query state on unmount.
   2. *(only when query is empty)* **Interactive maps section** (`MapsHomeSection`, horizontal padding 12) — belongs to the maps spec; summary of its appearance for layout purposes:
      - Header row (tappable → `/knowledge/maps`): icon `map` 18px accentPrimary, `INTERACTIVE MAPS` kicker (mono 12/600/ls2/accentPrimary), right-aligned `View all` caption (textSecondary) + `chevron_right` 18px textDim.
      - Up to **3** map gallery cards (12px gaps).
      - If more maps exist: a "See all" row — container padding 12h/10v, radius 8, border `borderSubtle`, fill `bgGlass`; icon `grid_view_rounded` 18 accentPrimary + text `See all maps (N more)` (body) + spacer + `chevron_right` textDim → `/knowledge/maps`.
      - First entry into this screen triggers the one-time bundled map-seed import; on failure with nothing installed, a GlassCard error state appears here: icon `sd_card_alert` (disk full) or `map_outlined` in accentWarn 18 + title `Interactive maps` (headline); caption `Storage is full, so offline maps could not be set up. Free up some space and try again.` or `Couldn't set up offline maps.`; text-button `Retry` (icon `refresh` 18 accentPrimary, label body accentPrimary) that re-runs the import.
   3. *(only when query is empty)* **Drafts banner** — padding (12, 0, 12, 12), a GlassCard:
      - Row: icon `edit_note` 18px `accentWarn` (top-aligned, 2px top offset), 8px gap, column:
        - `Drafts in progress` (headline)
        - 2px gap
        - Caption: `Every article here is a working draft. Writing takes time, so expect missing sections, light tables, and updates over the next builds.`
   4. **Category list** (query empty) or **Search results** (query non-empty) — horizontal padding 12. See below.
   5. Bottom spacer 32px.

### 3.2 Categories list (query empty)

- `SectionHeader` — title `Library` (renders `LIBRARY`), icon `menu_book`. 12px gap below.
- One **GlassCard per category**, in manifest order (sorted by `order` asc), 12px between cards. Entire card tappable (opaque hit area) → push `/knowledge/category/<id>`.
- Card row layout:
  - Fixed 44×44 box containing the category icon, 26px, `accentPrimary` (centered).
  - 12px gap.
  - Expanded column: category title (headline); 2px gap; count caption: `N article` / `N articles` (exact pluralization: `'$n article${n == 1 ? '' : 's'}'`).
  - Trailing `chevron_right` 20px `textDim`.

**Icon mapping** (manifest stores SF-Symbol-like names; map to Material icons):

KB Home mapping (`_iconFor` in kb_home_view.dart):

| Manifest `icon` | Material icon |
|---|---|
| `map.fill`, `map` | `map` |
| `gearshape.fill`, `gearshape` | `settings` |
| `books.vertical`, `book`, `book.fill` | `menu_book` |
| `star.fill` | `star` |
| `person.3.fill`, `person.3`, `people` | `groups` |
| `map.circle.fill`, `map.circle`, `public` | `public` |
| anything else | `bookmark` |

### 3.3 Search results (query non-empty)

- `SectionHeader` — title `Results` (renders `RESULTS`), icon `search`. 12px gap.
- Empty state (no hits): 12px padding, caption `No matches.`
- Hits: one GlassCard per article, 12px apart, tap → push `/knowledge/article/<slug>`. Card column:
  - Category kicker: `article.categoryTitle.toUpperCase()`, mono **10px**, weight 600, letter-spacing 2, `accentPrimary`.
  - 4px gap.
  - Article title (headline).
  - If tags: 8px gap, wrap of TagChips (4px spacing/run-spacing).
- Results are **uncapped** and ordered alphabetically by title (see §9 for the algorithm). Matching is instant (in-memory index), no loading state.

### 3.4 States

- `kbDataProvider` loading → centered spinner (Material circular progress).
- Error → centered text, `body` style in `accentDanger`: transport errors map to friendly copy (§14.3), otherwise fallback `Couldn't load the knowledge base.`
- KB data loads once and is cached for the app lifetime (no refresh mechanism, no pull-to-refresh).

---

## 4. View: KB Category (`/knowledge/category/:id`)

File: `lib/features/knowledge/views/kb_category_view.dart`.

### 4.1 App bar

Transparent app bar over content (see §2): back arrow `accentPrimary`; title = category title (headline style). While data is loading the title is empty string. If the `:id` doesn't match any category, the view **falls back to the first category** (`firstWhere(..., orElse: first)`) — no not-found state.

### 4.2 Body

PageScrollView (back-to-top button per §1.8), padding: left/right 12, top `safeTop + 56 + 8`, bottom 32.

- Loading → centered spinner. Error → centered `accentDanger` body text, fallback `Couldn't load this category.`
- Empty category: vertical padding 32, caption `No articles yet in this category.`
- Otherwise, one GlassCard per article, **sorted by `order` ascending** within the category, 12px apart. Tap → push `/knowledge/article/<slug>`. Row layout:
  - 44×44 box with the **category** icon (not per-article), **22px** (note: home uses 26px), `accentPrimary`.
  - 12px gap.
  - Expanded column: article title (headline); if tags: 6px gap then TagChip wrap (4px spacing).
  - Trailing `chevron_right` (default 24px) `textDim`.

**Icon mapping quirk**: this view has its own smaller `_iconFor` that only maps `map.fill|map → map`, `gearshape.fill|gearshape → settings`, `books.vertical|book|book.fill → menu_book`, default → `bookmark`. So **Guilds (`person.3.fill`) and Shires (`map.circle.fill`) article rows show the `bookmark` icon** here, while their home cards show `groups`/`public`. Reproduce as-is or fix (flagged in Open questions).

---

## 5. View: KB Article (`/knowledge/article/:slug`)

File: `lib/features/knowledge/views/kb_article_view.dart`.

### 5.1 App bar

Transparent over content; back arrow `accentPrimary`; title = article title (headline, 1 line, ellipsis; empty while loading).

**Action (right): bookmark toggle** — `FavoriteButton` with:
- `kind: 'kb_article'`, `id: slug`
- inactive icon `bookmark_border_rounded` in `textDim`; active icon `bookmark_rounded` in `accentPrimary`
- tooltip `Bookmark article` (inactive) / `Remove favorite` (active)
- See §10 for behavior.

### 5.2 Body

PageScrollView, padding left/right **16** (`lg`), top `safeTop + 56 + 8`, bottom 32.

Top → bottom:
1. Category kicker: `categoryTitle.toUpperCase()`, mono **11px**, weight 600, letter-spacing 2, `accentPrimary`.
2. 4px gap.
3. Article title, `title` style (Inter 22/600).
4. 16px gap.
5. **KBMarkdownView** rendering `article.markdown` (§6).
6. *(only if the article is a placeholder/draft — detected by `markdown.contains('Draft in progress')`)* 16px gap, then the **Contribute intel card** (§5.3).
7. *(only if tags non-empty)* 16px gap; 1px horizontal divider (`borderSubtle`); 12px gap; `SectionHeader` title `Tags` icon `tag`; 8px gap; TagChip wrap (4px spacing).

### 5.3 Contribute intel card (draft articles only)

GlassCard, column:
1. SectionHeader: title `Contribute intel` (renders `CONTRIBUTE INTEL`), icon `volunteer_activism`.
2. 8px gap.
3. Caption: `This article is still a draft. If you have first-hand info, corrections or screenshots, send them in and help fill it out.`
4. 12px gap.
5. NeonButton: label `Contribute intel`, icon `mail_outline`. On press (light haptic): opens the in-app **Contact** form (a separate view, menu area) pre-filled with:
   ```
   Contributing intel for the KB article "<TITLE>" (<slug>).

   Section: 
   What I know: 
   ```
   (exact string, note trailing spaces after `Section:` / `What I know:` and the trailing newline structure: `"Contributing intel for the KB article \"${title}\" (${slug}).\n\nSection: \nWhat I know: \n"`). In Flutter it's pushed as a modal page with `initialMessage`; on web, route to the contact page passing this prefill (e.g. router state or query param).
6. 8px gap.
7. A centered tappable row (6px vertical padding): icon `forum_outlined` 16px `accentSecondary` + 6px gap + text `or discuss on Discord` (body, `accentSecondary`). On tap (light haptic): open `https://discord.gg/pGcD92Dm8H` externally. If launch fails: snackbar `Couldn't open Discord — try again` with `accentDanger` background.

### 5.4 States

- Loading → centered spinner; error → centered `accentDanger` body, fallback `Couldn't load this article.`
- Unknown slug → centered caption `Article not found.` (real dead-end, no spinner — required for stale deep links).

### 5.5 Draft detection rule

```dart
bool get isPlaceholder => markdown.contains('Draft in progress');
```
All scaffold articles ship a `> **Draft in progress.** …` blockquote at the top; this single substring check gates the Contribute card. There is no manifest flag.

---

## 6. Component: KBMarkdownView (markdown rendering rules)

File: `lib/features/knowledge/widgets/kb_markdown_view.dart`. Flutter package: `flutter_markdown_plus ^1.0.11` (a maintained fork of flutter_markdown; GitHub-flavored extensions — the KB content uses **headings h1–h3, bold, italics, inline code, fenced/indented code, blockquotes, unordered lists (nested), tables, horizontal rules, images**; no inline hyperlinks exist in current content but the link style/behavior is specified). Web suggestion: `react-markdown` + `remark-gfm` with the style sheet below.

### 6.1 Style sheet (exact)

| Element | Style |
|---|---|
| Paragraph `p` | `body` — Inter 15/400 `#E8F4FF` |
| `h1` | Inter 24/600 `#E8F4FF` (title style at 24) |
| `h2` | Inter 19/600 `#E8F4FF` |
| `h3` | Inter 17/600 `#E8F4FF` (headline) |
| `em` | body + italic |
| `strong` | body + weight 700 |
| Link `a` | body, color `accentPrimary`, underline (decoration color `accentPrimary`) |
| Inline `code` | JetBrainsMono 13/400, color `accentSecondary` `#7AE3FF`, background `bgGlass` |
| Code block | container: background `bgGlass`, border-radius 6, border 1px `borderSubtle`, padding 8 |
| Blockquote text | body, color `textSecondary`, italic |
| Blockquote container | left border 3px solid `accentPrimary` (no background) |
| List bullet | body |
| Tables | package defaults (no explicit style) — render with default borders; keep text `body`; ensure horizontal scroll for wide tables on web |

### 6.2 Link taps

`onTapLink(text, href, title)`: if `href` is null, no-op; else `resolveLink(href)` (§7).

### 6.3 Images

`imageBuilder(uri, title, alt)` logic — reimplement exactly:

```
raw = uri.toString()
if raw starts with 'http://' or 'https://':
    if NOT https://  → render brokenImageTile()          // plain http is rejected outright
    else             → network image:
                         - while loading: 120px-tall box with a centered 20×20 spinner (stroke 2)
                         - on error: log + brokenImageTile()
else:  // relative path from the markdown, e.g. "images/ratropia-map.png"
    clean = raw starts with './' ? raw.substring(2) : raw
    base  = clean starts with 'images/' ? clean : 'images/' + clean
    render bundled asset 'assets/knowledge/' + base
      - decoded at display resolution: cacheWidth = round(cssLayoutWidth × devicePixelRatio), clamped to [1, 4096]
        (memory guard for the 4086×4086 space-station PNG; on web the browser handles decode —
         just serve the file and constrain with max-width:100%; consider `loading="lazy"`)
      - on error: log + brokenImageTile()
```

`brokenImageTile()`: container height 120, background `bgGlass`, border-radius 6, border 1px `borderSubtle`, centered icon `broken_image_outlined` 28px `textSecondary`.

Images display at natural width capped to layout width (no zoom/lightbox in the current app).

---

## 7. Internal & external link handling

Files: `lib/core/internal_link.dart`, `lib/core/external_link.dart`. Used by KB markdown links and by map-zone `link` fields / imported notes.

### 7.1 Internal scheme `underdeck://`

Never registered with the OS; purely resolved in-app to router paths. Pure function `resolveInternalLink(href) → path | null`:

```
parse href (trimmed) as URI; null/parse-failure → null
scheme (lowercased) must be 'underdeck', else null
kind = uri.host.toLowerCase()
segments = non-empty path segments; empty → null
id = urlEncodeComponent(segments[0])

kind == 'kb'  → '/knowledge/article/<id>'
kind == 'map' → zone = uri.queryParameters['zone']
                zone null/empty → '/knowledge/maps/<id>'
                else            → '/knowledge/maps/<id>?zone=<urlencoded zone>'
anything else → null
```

Recognized forms:
- `underdeck://kb/<slug>` → `/knowledge/article/<slug>`
- `underdeck://map/<id>` → `/knowledge/maps/<id>`
- `underdeck://map/<id>?zone=<zone>` → `/knowledge/maps/<id>?zone=<zone>`

A resolved path that points to a removed article/map still lands on a valid route whose view shows a real "not found" state — never a spinner.

### 7.2 `resolveLink(context, href)` — single entry point for content links

```
internal = resolveInternalLink(href)
if internal != null → router.push(internal)
else → launchExternal(href)
```

### 7.3 `launchExternal` — allow-listed external launch

- Allowed schemes: `http`, `https`, `mailto` (case-insensitive) only.
- Unparseable or disallowed scheme (e.g. `javascript:`, `file:`, `tel:`) → **no launch**, show snackbar `Couldn't open that link.` on `accentDanger` background.
- Allowed → open in external application (web: `window.open(url, '_blank', 'noopener,noreferrer')`); if the launch reports failure, same snackbar.

---

## 8. Data models & loading

Files: `lib/features/knowledge/domain/kb_models.dart`, `lib/features/knowledge/data/kb_loader.dart`.

### 8.1 Manifest format — `assets/knowledge/manifest.json`

```jsonc
{
  "categories": [
    {
      "id": "maps",            // string, required — category route id
      "title": "Maps",         // string, required
      "icon": "map.fill",      // string, required — SF-symbol-ish name, mapped per §3.2
      "order": 1,              // int, required — ascending sort
      "articles": [
        {
          "slug": "hideous-dungeon",           // string, required — route id, unique app-wide
          "title": "Hideous Dungeon",          // string, required
          "file": "01-maps/hideous-dungeon.md",// string, required — path relative to assets/knowledge/
          "tags": ["kb:map"],                  // string[], OPTIONAL (defaults to [])
          "order": 1                           // int, required — ascending sort within category
        }
      ]
    }
  ]
}
```

### 8.2 TypeScript models (translation of the Dart)

```ts
interface KBCategory   { id: string; title: string; icon: string; order: number; articles: KBArticleRef[]; }
interface KBArticleRef { slug: string; title: string; file: string; tags: string[] /* default [] */; order: number; }
interface KBArticle {
  slug: string; title: string;
  categoryId: string; categoryTitle: string;   // denormalized from the parent category
  tags: string[]; markdown: string; order: number;
  // isPlaceholder computed: markdown.includes('Draft in progress')
}
interface KBData {
  categories: KBCategory[];                    // sorted by order asc
  articles: Map<string, KBArticle>;            // keyed by slug
  index: KBIndex;                              // §9
}
```

`KBData.articlesIn(categoryId)`: filter `articles.values` by `categoryId`, sort by `order` asc.

### 8.3 Loading procedure (`KBData.load()`)

1. Load `assets/knowledge/manifest.json` (web: `fetch('<base>/knowledge/manifest.json')`), parse, map categories, sort by `order`.
2. For each category, for each article ref (in order): load `assets/knowledge/<file>` as string. **On per-file failure**: log the error and substitute the markdown `# <title>\n\n(Article content missing.)` — the article still appears.
3. Build the `KBArticle` (denormalizing category id/title), insert into the slug map, and add to the search index (§9).
4. Exposed as a memoized async provider (`kbDataProvider`, FutureProvider) — computed once, cached for app lifetime; every KB view and global search awaits the same instance. Web: a module-level memoized promise or a react-query `staleTime: Infinity` query.

If a slug appeared twice, the later article would overwrite the map entry (does not happen in current content).

---

## 9. KB search index — exact algorithm (`KBIndex`)

An in-memory inverted index built at load time and shared by the KB Home search and the global search's KB source.

### 9.1 Indexing

For each article, index these text fields under the article's slug: **title**, **full markdown body**, **each tag**, **category title**. Also record `slug → title` for sorting.

**Tokenizer** (applies to both indexing and queries):
- Lowercase the text.
- Scan character-by-character; a token is a maximal run of **ASCII alphanumerics only** (`0-9`, `A-Z`, `a-z`). Every other character — punctuation, whitespace, and **any non-ASCII letter (accented characters split tokens!)** — is a separator.
- Only tokens with **length ≥ 2** are kept.

Index structure: `Map<token, Set<slug>>`.

### 9.2 Query evaluation `search(query) → slug[]`

```
tokens = tokenize(query)            // same rules; <2-char tokens dropped
if tokens is empty → []

for each query token t:
    matchSet(t) = union of slug-sets of every indexed token k where k.startsWith(t)   // PREFIX match
result = intersection of all matchSets                                               // AND semantics
sort result by article title (string compare, case-sensitive via stored titles), tie/missing → by slug
return result
```

Properties to preserve:
- Prefix matching on **every** token (`rat` matches `ratropia`; `vess perm` matches "Vessel Permissions").
- All tokens must match (AND). No scoring/ranking beyond the final **alphabetical-by-title sort**.
- A query containing only 1-character/no alphanumeric tokens returns `[]` → UI shows the "No matches." / no-results state (KB Home shows the Results section for ANY non-empty raw string, including `"a"`).
- Matching is case-insensitive; markdown syntax characters are separators so words inside `**bold**` etc. are indexed clean.

---

## 10. Favorites system

Files: `lib/features/favorites/data/favorites_repository.dart`, `lib/features/favorites/widgets/favorite_button.dart`, table in `lib/data/database/tables/favorites_table.dart`.

### 10.1 Persistence — Drift (SQLite) table `favorites`

| Column | Type | Notes |
|---|---|---|
| `entity_type` | TEXT | kind key, see below |
| `entity_id` | TEXT | id within the kind |
| `created_at` | DATETIME | set to `now` on insert |

Composite **primary key `(entity_type, entity_id)`** — an entity is favorited at most once. Added in DB schema v3.

Web equivalent: IndexedDB (e.g. Dexie table `favorites` with compound primary key `[entityType+entityId]`), or `localStorage` with a JSON map if IndexedDB is overkill. Must be **reactive** (live queries / event emitter) — the UI observes changes.

### 10.2 Kind keys (string constants, NOT an enum — persisted values must stay stable)

```
'job' | 'kb_article' | 'fishing_zone' | 'tracked_object' | 'map' | 'map_zone'
```
`map_zone` ids are namespaced `mapId/zoneId` by callers. This area only *writes* `kb_article` (id = article slug), but the store is shared app-wide (jobs star, fishing zone star, tracker pin, map/zone favorites).

### 10.3 Repository API (all reads are live/watching)

```ts
watchIds(kind): Observable<Set<string>>          // live set of favorited ids for one kind
watchIsFavorite(kind, id): Observable<boolean>
isFavorite(kind, id): Promise<boolean>
toggle(kind, id): Promise<boolean>               // delete row if present, else insert (createdAt = now); returns new state
```

`favoriteIdsProvider(kind)` — a per-kind live stream of the id set, consumed by FavoriteButton and (elsewhere) jobs filtering.

### 10.4 FavoriteButton widget

Generic icon-button toggle:
- Props: `kind`, `id`, `icon` (default `star_border_rounded`), `activeIcon` (default `star_rounded`), `size` (default 22), `tooltip` (default `Favorite`), `activeColor` (default `accentWarn`).
- Reads the live id set for `kind` (until the stream emits, treated as empty ⇒ shows inactive).
- Renders `activeIcon` in `activeColor` when favorited, else `icon` in `textDim`.
- Tooltip: `Remove favorite` when favorited, else the `tooltip` prop.
- Hit target: compact icon-button, padding 6, min 36×36.
- On press: selection haptic, then `toggle(kind, id)`. On failure: log + snackbar with friendly error, fallback `Couldn't update favorite.`
- No optimistic UI needed — the live stream updates the icon.

KB usage (article app bar): `kind='kb_article'`, `id=slug`, icon `bookmark_border_rounded`, activeIcon `bookmark_rounded`, tooltip `Bookmark article`, activeColor `accentPrimary`.

### 10.5 Export / import (context — implemented in `lib/services/data_export.dart`, another area)

The app-wide JSON backup includes `favorites: [{ entityType, entityId, createdAt: ISO-8601 UTC }]`. On import, rows are validated: `entityType` must be in the whitelist `{'job','kb_article','fishing_zone','tracked_object'}` (**note: `map` and `map_zone` are NOT in the import whitelist** — flagged in Open questions), `entityId` non-empty and ≤ 256 chars; existing rows keep their original `createdAt` (insert-or-ignore idempotence). Malformed rows are skipped with a log, never abort the import.

### 10.6 Where favorites surface

For `kb_article` specifically: **only** as the toggle state on the article screen. There is **no "bookmarked articles" list view anywhere in the app** (verified by searching all consumers). Jobs use their favorites for a "starred" filter; KB currently does not.

---

## 11. View: Global Search (`/menu/search`)

File: `lib/features/search/views/global_search_view.dart`.

### 11.1 App bar & entry

Transparent app bar over content; back arrow `accentPrimary`; title `Search` (headline). Entered from the Menu tab (banner icon-button tooltip `Search`, or menu row `Search` / `Maps, KB, jobs, wallets, notes`).

On mount, the search field is **auto-focused** (keyboard opens immediately).

### 11.2 Layout (top → bottom)

PageScrollView, padding: left/right 12, top `safeTop + 56 + 8`, bottom 32.

1. **Search field** — same visual recipe as KB Home (§3.1.1) plus:
   - Placeholder: `Search maps, jobs, wallets, notes…` (with a real ellipsis character).
   - `textInputAction: search`, autocorrect off.
   - **Clear button**: a `close` icon (`textSecondary`) as suffix, tooltip `Clear search`, shown only when the field is non-empty. On press: cancel pending debounce, clear field and query, re-focus the field.
   - **Debounce 250 ms**: the committed query = trimmed field text, applied 250ms after the last keystroke; pending timer canceled on each change and on unmount.
2. 12px gap.
3. If committed query is empty → **Hint block** (top padding 24, centered column):
   - Icon `travel_explore` 40px, `textDim` @60% alpha.
   - 12px gap; `Search everything` (headline, centered).
   - 4px gap; caption, centered: `Find map zones, knowledge base articles, jobs, wallets, and your own notes — all in one place.`
4. Else → **Results** for the committed query.

### 11.3 Results states

The results provider is an autoDispose async family keyed by the query string — each new committed query gets a fresh async computation (previous one is discarded/cancelled by key change):

- **Loading**: top padding 24, centered spinner. (Shows briefly for each new debounced query.)
- **Error**: top padding 24, `body` text in `accentDanger`, friendly error with fallback `Couldn't run that search.`
- **No hits** (total across all groups == 0): top padding 24, centered column — icon `search_off` 36px `accentWarn`; 8px gap; `No matches` (headline); 4px gap; caption centered: `Nothing matched “<query>”. Try a different term.` (curly quotes around the query).
- **Hits**: a column of groups, 16px between groups.

### 11.4 Group block

For each non-empty source group, in fixed source order (§12.2):

1. `SectionHeader` — title = group title (renders UPPERCASE), subtitle `N result` / `N results` (N = pre-cap total).
2. 8px gap.
3. Up to **5** result rows, 8px apart.
4. If more were found: 2px top padding, caption: `+N more — refine your search to narrow down.` (N = hidden count).

**Result row** — GlassCard, tappable (with a merged accessibility label `"<title>. <subtitle>"` as a button):
- Leading: source icon 20px `accentPrimary`.
- 12px gap.
- Expanded column: title (headline, 1 line ellipsis); if subtitle non-empty: 2px gap, subtitle (caption, 1 line ellipsis).
- Trailing `chevron_right` 20px `textDim`.

### 11.5 Opening a hit (light haptic on tap)

Three target types:
- **RouteTarget(location)** → push the router location (KB article, map+zone, note/link detail).
- **WalletTarget(query)** → push `/tools/wallet?q=<urlencoded query>` (pre-seeds the Wallet Lookup tool).
- **JobTarget(job)** → open the Job detail as a **modal bottom sheet** (transparent barrier background, scroll-controlled; web: a modal dialog/drawer). Jobs have no standalone route.

---

## 12. Global search: sources, federation, business logic

Files: `lib/features/search/domain/global_search_models.dart`, `lib/features/search/data/global_search_providers.dart`.

### 12.1 Hit model

```ts
type GlobalSearchTarget =
  | { kind: 'route'; location: string }
  | { kind: 'job';   job: Job }          // opens modal
  | { kind: 'wallet'; query: string };   // opens wallet tool pre-seeded

interface GlobalSearchHit {
  source: SearchSource;
  title: string;
  subtitle: string;
  icon: string;            // Material icon name, per source below
  target: GlobalSearchTarget;
}
```

### 12.2 Sources — fixed display order, group titles, icons

Enum order defines display order:

| # | `SearchSource` | Group title | Row icon |
|---|---|---|---|
| 1 | `mapZone` | `Map zones` | per-map icon (`mapIconData(mapIcon)`, maps spec) |
| 2 | `kbArticle` | `Knowledge base` | `menu_book_outlined` |
| 3 | `job` | `Jobs` | `work_outline` |
| 4 | `wallet` | `Wallets` | `person_outline` (owner hit) / `account_balance_wallet_outlined` (wallet hit) |
| 5 | `capture` | `Notes & links` | `sticky_note_2_outlined` (note) / `link` (link) |
| 6 | `mapPin` | `My map notes` | `push_pin_outlined` |

### 12.3 Federation constants & pure logic

```
kSearchGroupCap = 5      // per-group visible rows
```

`federateSearchResults(bySource, cap = 5)`:
- Iterate sources in the fixed enum order.
- Skip empty lists.
- Cap each group's `visible` to `cap` items (preserving each source's own hit ordering); keep pre-cap `total`. A non-positive cap disables capping.
- `hiddenCount = max(0, total - visible.length)`; `hasMore = hiddenCount > 0`.

`totalHitCount(groups)` = sum of pre-cap totals — drives the "No matches" empty state.

### 12.4 Query execution

Blank/whitespace query → empty result map immediately (no work). Otherwise (`query = raw.trim()`, `q = query.toLowerCase()`), all sources run **concurrently**; the heavy DB full-text source (map zones) is kicked off first. Local DB streams (notes, links, pins) that haven't emitted yet contribute nothing for that pass but keep results **live** — edits to notes/pins re-emit and recompute. Per-source hit construction:

**1. Map zones** — delegated to `mapZoneSearchProvider(query)` (maps spec): SQLite **FTS5** over zone name/fields; query is sanitized into a `MATCH` expression: split on whitespace, each term double-quoted (embedded `"` doubled), joined with spaces (AND), **last term suffixed `*`** (prefix match while typing); no usable term → skip. Hits whose map is missing, draft, or of unknown type are dropped. Hit → title = zone name, subtitle = map title, target route `/knowledge/maps/<mapId>?zone=<zoneId>` (both URL-encoded).

**2. KB articles** — `kb.index.search(query)` (exact algorithm §9). Hit → title = article title, subtitle = category title, route `/knowledge/article/<slug>` (encoded). Order = the index's alphabetical order.

**3. Jobs** — linear scan of all jobs; haystack = lowercase join with spaces of: `typeRaw`, `description`, ally-faction label (taxonomy lookup of `factionRep`, else ''), rival-faction label (`factionRival`), `requiredSkill ?? ''`, `requiredTag ?? ''`, `'#' + id`. Match = haystack **contains** `q` (substring). Hit → title `'<typeRaw> · #<id>'`; subtitle = join(' · ') of [ally label if any, snippet(description, 60) if description non-blank], or `'Job #<id>'` if both absent.

**4. Wallets** — `wallet.search(query)` (wallet tool's own owner/wallet substring match). Owner hits → title = owner displayName, subtitle `'N wallet'`/`'N wallets'`. Wallet hits whose owner already appeared as an owner hit are skipped; the rest → title = wallet address, subtitle `'Registered to <owner displayName>'`. All wallet hits target the wallet tool pre-seeded with the query.

**5. Captures (notes & links)** — notes: match if `'<title> <body>'.toLowerCase()` contains `q`; title = note title or `'Untitled note'` if blank; subtitle = `snippet(body)`; route `/captures/note/<id>`. Links: match on `'<title> <url> <note>'`; title = link title or the URL if blank; subtitle = URL; route `/captures/link/<id>`.

**6. Map pins (personal zone notes)** — match if `pin.note.toLowerCase()` contains `q`; title = `snippet(note)`; subtitle = `'Pinned zone note'`; route `/knowledge/maps/<mapId>?zone=<zoneId>`.

**Snippet helper** (used above):
```
snippet(text, max = 80):
  flat = text.replaceAll(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : flat.slice(0, max).trimEnd() + '…'
```

No cross-source ranking or scoring — order within a group is whatever the source produced; groups appear in the fixed order; caps at 5.

---

## 13. Assets inventory (`assets/knowledge/`)

All files under `assets/knowledge/` (bundle the whole tree as static files on the web; `.DS_Store` files are junk — exclude):

```
assets/knowledge/manifest.json                      (3,266 B — full content shown in §8.1's structure; 4 categories, 14 articles)
assets/knowledge/01-maps/apms.md                    (183 lines, 4,915 B)
assets/knowledge/01-maps/hideous-dungeon.md         (122 lines, 3,538 B)
assets/knowledge/01-maps/ratropia.md                (339 lines, 7,176 B)
assets/knowledge/02-systems/vessel-permissions.md   ( 83 lines, 2,991 B)
assets/knowledge/02-systems/vessel-recall.md        ( 66 lines, 2,898 B)
assets/knowledge/03-guilds/guards.md                ( 31 lines, 1,014 B)
assets/knowledge/03-guilds/monks.md                 ( 27 lines,   933 B)
assets/knowledge/03-guilds/spies.md                 ( 31 lines, 1,220 B)
assets/knowledge/03-guilds/thieves.md               ( 27 lines,   883 B)
assets/knowledge/04-shires/eastshire.md             ( 27 lines,   886 B)
assets/knowledge/04-shires/northshire.md            ( 27 lines,   887 B)
assets/knowledge/04-shires/southshire.md            ( 27 lines,   887 B)
assets/knowledge/04-shires/upshire.md               ( 27 lines,   884 B)
assets/knowledge/04-shires/westshire.md             ( 27 lines,   886 B)
assets/knowledge/images/hideous-dungeon-map.jpg     (2448×3264, 4,149,119 B)   ← also reused by the maps seed pack
assets/knowledge/images/ratropia-map.png            (1202×1582,   180,095 B)
assets/knowledge/images/rustwinds.png               (1156×1012,   751,060 B)
assets/knowledge/images/space-station-map.png       (4086×4086, 2,561,018 B)   ← the oversized one that motivated decode capping
assets/knowledge/images/vessel-permit.png           ( 600×398,     67,490 B)
```

### 13.1 Manifest content summary (authoritative data — copy `manifest.json` verbatim into the web app)

| Category (id / title / icon / order) | Articles (slug — title — file — tags — order) |
|---|---|
| `maps` / Maps / `map.fill` / 1 | `hideous-dungeon` — Hideous Dungeon — `01-maps/hideous-dungeon.md` — [`kb:map`] — 1; `ratropia` — Ratropia — `01-maps/ratropia.md` — [`kb:map`] — 2; `apms` — APMs — `01-maps/apms.md` — [`kb:map`] — 3 |
| `systems` / Systems / `gearshape.fill` / 2 | `vessel-recall` — Vessel Recall — `02-systems/vessel-recall.md` — [`kb:system`,`kb:vessel`] — 1; `vessel-permissions` — Vessel Permissions — `02-systems/vessel-permissions.md` — [`kb:system`,`kb:vessel`,`kb:passengers`] — 2 |
| `guilds` / Guilds / `person.3.fill` / 3 | `spies` — Spies Guild — `03-guilds/spies.md` — [`kb:guild`,`kb:draft`] — 1; `guards` — Guards Guild — … — 2; `monks` — Monks Guild — … — 3; `thieves` — Thieves Guild — … — 4 (all tagged [`kb:guild`,`kb:draft`]) |
| `shires` / Shires / `map.circle.fill` / 4 | `northshire` — Northshire — `04-shires/northshire.md` — 1; `southshire` — Southshire — 2; `eastshire` — Eastshire — 3; `westshire` — Westshire — 4; `upshire` — Upshire — 5 (all tagged [`kb:shire`,`kb:draft`]) |

### 13.2 Article markdown format conventions (do not copy article bodies here — ship the files as-is)

- Each file starts with a single `# Title` h1. (The h1 duplicates the manifest title in content — the article view ALSO renders the title above the markdown, so the h1 appears again inside the body. Reproduce faithfully.)
- **Draft/scaffold articles** (guilds ×4, shires ×5): after the h1, a blockquote beginning `> **Draft in progress.** …` (varying continuation text per article) — this exact substring drives `isPlaceholder`. Then an intro paragraph, `---` rules, `## Section` headings whose bodies are one-line italic `_Placeholder — …_` paragraphs.
- **Map walk-through articles** (hideous-dungeon, ratropia): intro, a bullet legend, one `![alt](images/xxx)` image near the top, credit line, `---` separators, `## <path>` sections with `### Room (timer)` subsections, each with `- **Timer:** …` / `- **Exits:**` nested bullet lists. Inline code for game commands (`` `!d` ``).
- **APMs**: numbered-location reference with `##` sections per planet band, inline-code APM patterns, two images (`space-station-map.png`, `rustwinds.png`), and pipe **tables**.
- **Systems articles**: command documentation with blockquote caveats, inline code (`` `!permit` ``, `` `!recall` ``), one image in vessel-permissions, and pipe tables (e.g. Goal/Command examples with `| :--- | :--- |` alignment rows).
- No inline hyperlinks (`[text](url)`) and **no `underdeck://` links exist in the current content** — but both must be supported per §6.2/§7.
- All image references are relative `images/<file>` form.
- Quirk to know: the shire drafts' h1 titles differ from manifest titles (`# Unorth Shire`, `# Usouth Shire`, `# Ueast Shire`, `# Uwest Shire`, `# Uup Shire` — apparent typos). Manifest titles ("Northshire" etc.) are what appear in lists/app bar; the odd h1 shows inside the body. Ship as-is.

### 13.3 Fonts (bundled assets, referenced by the typography)

`assets/fonts/Inter-Variable.ttf`, `assets/fonts/JetBrainsMono-Variable.ttf`, `assets/fonts/Quicksand-Variable.ttf` (+ OFL license texts `Inter-OFL.txt`, `JetBrainsMono-OFL.txt`, `Quicksand-OFL.txt` — keep shipping the licenses). Web: self-host woff2 equivalents; do not use fonts.gstatic.com (privacy/offline requirement).

---

## 14. Platform features → web equivalents

| Flutter feature | Where used | Web equivalent |
|---|---|---|
| `rootBundle.loadString` (bundled assets) | manifest + markdown loading | `fetch()` of static files under the site base path; memoize |
| Drift/SQLite (`favorites` table) | favorites persistence | IndexedDB (Dexie) with compound key `[entityType+entityId]` and live queries; or localStorage JSON with an event bus |
| SQLite FTS5 | map-zone search source | maps-area concern; e.g. MiniSearch/FlexSearch or a simple index (see maps spec) |
| go_router push / query params | all navigation | react-router (`HashRouter` for GitHub Pages), `useNavigate().push`-like history push |
| `url_launcher` (external app) | Discord link, external markdown links | `window.open(url, '_blank', 'noopener,noreferrer')` after the same scheme allow-list (`http/https/mailto`) |
| Custom `underdeck://` scheme | internal content links | keep the same string format inside markdown; resolver maps to SPA routes (§7.1) — no browser protocol registration needed |
| Haptics (light impact / selection click) | favorite toggle, buttons, hit taps | `navigator.vibrate(10)` where available, or **drop** (respect the app's haptics setting if ported) |
| SnackBar | favorite errors, blocked links, Discord failure | toast component (bottom, ~4s), `accentDanger` background for the error ones |
| Modal bottom sheet | job detail from search | modal dialog / bottom drawer |
| `Image.asset` with `cacheWidth` decode capping | KB images | plain `<img>` with `max-width:100%`; `loading="lazy"`; browser handles decode (no cap needed) |
| Keyboard auto-focus + dismiss-on-drag | search screens | `autoFocus` on input; nothing needed for dismiss on desktop; on mobile web, `blur()` on scroll if desired |
| Tooltips on icon buttons | bookmark, clear search | `title` attribute / tooltip component |
| Scanlines/hex-grid/pulsing-dot ambience | AppBackground, banner | CSS overlays + keyframe pulse, or simplify/drop |
| Data export/import of favorites | services layer (other spec) | part of the app-wide JSON backup — keep field shape `{entityType, entityId, createdAt}` |

---

## 15. Full copy-string compendium (this area)

Banner / headers:
- `ESSI · Archive & Doctrine` (KB home banner label; displayed uppercase)
- `Library`, `Results`, `Tags`, `Contribute intel` (SectionHeaders; displayed uppercase)
- `INTERACTIVE MAPS`, `View all`, `See all maps (N more)` (maps block on KB home)

Search fields:
- `Search articles` (KB home placeholder)
- `Search maps, jobs, wallets, notes…` (global search placeholder)
- `Clear search` (clear-button tooltip)
- `Search` (global search app-bar title; also Menu row title and banner icon tooltip)
- `Maps, KB, jobs, wallets, notes` (Menu row subtitle for Search)

Counts / group titles:
- `N article` / `N articles` (category card)
- `N result` / `N results` (search group subtitle)
- `N wallet` / `N wallets` (wallet owner hit subtitle)
- `Map zones`, `Knowledge base`, `Jobs`, `Wallets`, `Notes & links`, `My map notes` (group titles)
- `+N more — refine your search to narrow down.`

Empty / not-found states:
- `No matches.` (KB home search, with period)
- `No articles yet in this category.`
- `Article not found.`
- `Search everything` + `Find map zones, knowledge base articles, jobs, wallets, and your own notes — all in one place.` (global search hint)
- `No matches` (global search, no period) + `Nothing matched “<query>”. Try a different term.`

Errors (fallbacks passed to the friendly-error mapper):
- `Couldn't load the knowledge base.`
- `Couldn't load this category.`
- `Couldn't load this article.`
- `Couldn't run that search.`
- `Couldn't update favorite.` (favorite toggle failure snackbar)
- `Couldn't open Discord — try again` (snackbar, accentDanger)
- `Couldn't open that link.` (blocked/failed external link snackbar, accentDanger)
- Generic mapper (`friendlyError`): DioException connection/timeout → `No network connection. Check your signal and try again.`; cancel → `Request cancelled.`; bad response/certificate/unknown → `Couldn't reach the server. Please try again.`; FormatException → its own message; anything else → the per-call fallback (default `Something went wrong. Please try again.`). For this mostly-offline area the fallback is what users would ever see.

Drafts banner:
- `Drafts in progress`
- `Every article here is a working draft. Writing takes time, so expect missing sections, light tables, and updates over the next builds.`

Contribute intel card:
- `Contribute intel` (header + button label)
- `This article is still a draft. If you have first-hand info, corrections or screenshots, send them in and help fill it out.`
- `or discuss on Discord`
- Contact prefill: `Contributing intel for the KB article "<TITLE>" (<slug>).\n\nSection: \nWhat I know: \n`

Favorites:
- `Favorite` (default tooltip), `Bookmark article` (KB tooltip), `Remove favorite` (active-state tooltip)

Fallback article body (missing file): `# <title>\n\n(Article content missing.)`

Maps seed failure card (rendered on KB home; maps area copy): `Interactive maps`, `Storage is full, so offline maps could not be set up. Free up some space and try again.`, `Couldn't set up offline maps.`, `Retry`.

Constants: Discord invite `https://discord.gg/pGcD92Dm8H`; internal scheme `underdeck`.

Icons used in this area (Material names): `search`, `close`, `menu_book`, `menu_book_outlined`, `map`, `settings`, `star`, `groups`, `public`, `bookmark`, `chevron_right`, `edit_note`, `tag`, `volunteer_activism`, `mail_outline`, `forum_outlined`, `bookmark_border_rounded`, `bookmark_rounded`, `star_border_rounded`, `star_rounded`, `work_outline`, `person_outline`, `account_balance_wallet_outlined`, `sticky_note_2_outlined`, `link`, `push_pin_outlined`, `travel_explore`, `search_off`, `broken_image_outlined`, `arrow_upward`, `grid_view_rounded`, `refresh`, `sd_card_alert`, `map_outlined`.

---

## 16. Open questions

1. **No bookmarked-articles list**: KB articles can be bookmarked but no screen lists them (unlike jobs, which filter by star). Parity says ship the toggle only; confirm whether the web app should add a "Bookmarks" surface.
2. **Category icon mapping gap**: `KBCategoryView` maps only maps/systems/books icons, so Guilds and Shires article rows fall back to the `bookmark` icon while their home cards show `groups`/`public`. Reproduce or unify?
3. **Import whitelist omits `map`/`map_zone`**: backup import silently drops map/map-zone favorites while export includes them. Bug or deliberate? Affects the shared backup format, not this UI.
4. **Unknown category id falls back to the first category** (no not-found state) on `/knowledge/category/:id` — acceptable to keep, or add a proper not-found like the article view has?
5. **Shire draft h1 typos** (`# Unorth Shire` etc.) — ship as-is or fix content when porting?
6. **Markdown dialect edge cases**: the Flutter package's exact GFM-subset behavior (e.g. autolinks, HTML passthrough) isn't pinned by content today; current articles only need headings, emphasis, code, blockquotes, lists, tables, hr, images. Recommend `react-markdown` + `remark-gfm` with raw HTML disabled.
7. **Sector code / scanlines / hex grid ambience**: decorative; confirm whether to reproduce exactly (spec'd in §1.6–1.7) or simplify for web.
8. **KB search result ordering** is plain alphabetical-by-title with AND-of-prefixes matching — confirm no relevance ranking is desired on web.

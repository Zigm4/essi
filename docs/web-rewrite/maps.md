# Underdeck — Maps Module Specification (area: `maps`)

Source of truth: `lib/features/knowledge/maps/` (data/, domain/, render/, views/, widgets/), `assets/maps_seed/`, plus the shared infrastructure they reference (design system, Drift tables, settings, router, share/haptics services). This document is written so the module can be re-implemented from scratch as a Vite + React + TypeScript web app (Canvas 2D / WebGL rendering) hosted on GitHub Pages, with **no access to the Flutter code**.

---

## Table of contents

1. [Overview](#1-overview)
2. [Routes & navigation](#2-routes--navigation)
3. [Design-system tokens used by this module](#3-design-system-tokens)
4. [Content delivery protocol (pointer → manifest → blobs)](#4-content-delivery-protocol)
5. [Validation rules & hard limits](#5-validation-rules--hard-limits)
6. [Data models (wire schema)](#6-data-models)
7. [Theme system & sanitization (WCAG math)](#7-theme-system--sanitization)
8. [Persistence (blob store, DB tables, prefs keys)](#8-persistence)
9. [Seed pack import (offline-first bootstrap)](#9-seed-pack-import)
10. [Update lifecycle (check, install, GC, clear)](#10-update-lifecycle)
11. [Full-text zone search](#11-full-text-zone-search)
12. [Views](#12-views)
13. [Flat 2D map viewer (render + interaction)](#13-flat-2d-map-viewer)
14. [Globe (3D sphere) viewer — full rendering math](#14-globe-viewer)
15. [Grid table view (grid-sphere text twin)](#15-grid-table-view)
16. [Zone sheet, fields renderer, pin editor, share card](#16-zone-sheet-and-friends)
17. [Settings integration](#17-settings-integration)
18. [State management summary](#18-state-management)
19. [Platform features & web equivalents](#19-platform-features--web-equivalents)
20. [Assets inventory](#20-assets-inventory)
21. [Copy-string inventory](#21-copy-string-inventory)
22. [Open questions](#22-open-questions)

---

## 1. Overview

"Interactive maps" is a dynamic-content module inside the Knowledge section. Maps are **content, not code**: JSON documents (geometry + schema-driven field data) plus image assets, authored in a public GitHub repository (`underpunks55/underdeck-content`) and delivered as plain data. Key properties:

- **Offline-first**: a seed pack (4 maps) is bundled with the app and imported into a local content-addressed blob store on first use. Rendering *always* reads from the local store, never the network.
- **Pull-only pipeline**: a tiny mutable "pointer" JSON is polled (≤1/24h, ETag-conditional); it points at an immutable tag-pinned manifest on jsDelivr; every file is sha256-pinned and verified before it is stored. Nothing about the user is ever uploaded.
- Two-and-a-half map renderers:
  - **flat** — 2D pan/zoom viewer over a background image with polygon/marker zones;
  - **sphere** — an orthographic, quaternion-oriented, stylized "neon globe" (no texture) with spherical polygon/cap zones and an optional uniform lon/lat **grid** (grid-sphere documents also get a pan/zoomable "grid table" text view).
- Per-zone user notes ("pins"), favorites, PNG share cards, FTS5 zone search, enum filter chips, deep links (`/knowledge/maps/:id?zone=…` and `underdeck://map/<id>?zone=<zone>`).

---

## 2. Routes & navigation

go_router routes (inside the `/knowledge` shell branch):

| Route | View | Notes |
|---|---|---|
| `/knowledge` | Knowledge home; contains the `MapsHomeSection` block near the top | seed-import trigger point |
| `/knowledge/maps` | `MapsGalleryView` | full map gallery + zone search |
| `/knowledge/maps/:id` | `MapDetailView(id)` | query param `?zone=<zoneId>` pre-selects + centers a zone |

Sub-pages pushed imperatively (Navigator.push, i.e. plain stacked pages, not routes):

- **Zone list** — `MapZoneListView` from the detail app bar ("List of zones").
- **My map notes** — `MapNotesListView` from the detail app bar.
- **How it works** — `MapsHowItWorksView`, a modal bottom sheet from the gallery app bar.
- **Zone sheet / pin editor** — overlays / modal bottom sheets (see §16).

Internal deep links (`lib/core/internal_link.dart`):

- Scheme constant: `underdeck` (`kInternalLinkScheme`). Never registered with the OS; resolved in-app only.
- `underdeck://map/<id>` → `/knowledge/maps/<id>`
- `underdeck://map/<id>?zone=<zone>` → `/knowledge/maps/<id>?zone=<encoded zone>`
- `underdeck://kb/<slug>` → `/knowledge/article/<slug>` (other module)
- Unknown host/scheme → `null` → handed to the external-link launcher (allow-listed: http(s)/mailto open externally; anything else shows a friendly "couldn't open" and is a no-op).
- `MapRef.toInternalLink()` produces `underdeck://map/{encodeURIComponent(mapId)}` and appends `?zone={encodeURIComponent(zoneId)}` when a zone is present.

`MapRef` (cross-link from other content — jobs, fishing zones — to a map): `{ mapId: string (required, trimmed non-empty), zoneId?: string (trimmed; blank → null) }`. `MapRef.tryParse` is fully tolerant: absent/malformed → `null` (no "View on map" affordance rendered). Currently no shipped content carries one; it is a forward-compat reading capability.

A stale deep link (map removed / draft) must land on a **real "not found" pane**, never an infinite spinner.

Web adaptation note: GitHub Pages needs an SPA fallback (404.html redirect trick or hash routing) for `/knowledge/maps/:id?zone=` deep links to work on refresh.

---

## 3. Design-system tokens

(Shared app-wide; the exact values this module uses.)

### 3.1 Colors (`AppColors`)

| Token | Hex |
|---|---|
| `bgDeepest` | `#03060B` |
| `bgElevated` | `#0A1220` |
| `bgGlass` | `#0F1C30` at 55 % alpha |
| `bgCard` | `#111E30` (opaque sibling of bgGlass) |
| `accentPrimary` | `#4FC3FF` |
| `accentSecondary` | `#7AE3FF` |
| `accentDanger` | `#FF5577` |
| `accentWarn` | `#FFB347` |
| `accentSuccess` | `#5FE8A0` |
| `textPrimary` | `#E8F4FF` |
| `textSecondary` | `#8AA4C2` |
| `textDim` | `#6E8AAB` |
| `borderSubtle` | `#7AE3FF` at 12 % alpha |
| `borderGlow` | `#4FC3FF` at 45 % alpha |

### 3.2 Typography (`AppTypography`)

Bundled font families (variable TTFs, no network fonts): `Inter` (fontSans), `JetBrainsMono` (fontMono), `Quicksand` (fontRounded). Files: `assets/fonts/Inter-Variable.ttf`, `assets/fonts/JetBrainsMono-Variable.ttf`, `assets/fonts/Quicksand-Variable.ttf`.

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

`AppSpacing`: xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48 (logical px).
`AppRadius`: sm 8, md 14, lg 22.

### 3.4 Shared components used

- **GlassCard**: container, fill `bgCard`, 1 px border `borderSubtle`, radius `AppRadius.md` (14), default padding 12; optional glow (accentPrimary 18 % alpha, blur 14). No backdrop blur by default.
- **AppBackground**: full-bleed stack — solid `bgDeepest`; radial gradient from top-left (`accentPrimary` 10 % alpha → transparent, center (-1,-1), radius 1.2); hex-grid pattern at 6 % opacity; content; scanlines overlay. Tapping empty space unfocuses inputs.
- **PageScrollView**: scroll wrapper with a floating "back to top" button after one screen height; broadcasts scroll offset.
- **InfoCard**: width 100 %, fill `bgGlass`, radius 14, border `borderSubtle`, padding 16. Used by How-it-works cards.
- **SectionHeader**: optional 18 px `accentPrimary` icon + UPPERCASED title in mono 12/600, letter-spacing 2, `accentPrimary`; optional caption subtitle.
- **TransmissionHeader**: opaque banner row — pulsing green dot, UPPERCASED label mono 10/600 letter-spacing 2 accentPrimary, right-aligned scroll-driven `ESSI//NNN` counter mono 10 textDim, bottom border borderSubtle.
- **KvRow**: two-column row — label mono 11/600 `accentPrimary` at fixed width (default 110, maps sheet uses 96), value mono 11 `textSecondary`, 2 px vertical padding.
- **NeonButton**: gradient pill (accentPrimary→accentSecondary; danger: accentDanger→accentWarn), 1 px borderGlow border, radius 14, min-height 50, glow shadow (tint 45 % alpha, blur 14), press scale 0.97 over 200 ms easeOut, optional leading icon, haptic tap.
- **TagChip**: pill radius 20, padding 10×5; unselected: fill accentPrimary 15 % alpha, border accentPrimary 40 % alpha, text accentPrimary 12/500; selected: fill accentPrimary solid, text `bgDeepest`. Tap → selection haptic.
- **HowItWorksSheet**: DraggableScrollableSheet initial 0.92, min 0.5, max 0.97; top-rounded (radius 22); own AppBar with left "Close" text button (width 80) and centered title "How it works" (headline); scrollable card list, 16 px gaps, page bg `bgDeepest`.
- **FavoriteButton**: star toggle for `FavoriteKind` string keys. This module uses `FavoriteKind.map` (`'map'`, id = mapId) and `FavoriteKind.mapZone` (`'map_zone'`, id = `'{mapId}/{zoneId}'` — namespaced so the same zone id in two maps never collides). Optional `activeColor` override (the zone sheet passes `theme.accent`).

### 3.5 Error copy helper

`friendlyError(error, fallback)`: DioException connection/timeout types → `"No network connection. Check your signal and try again."`; cancel → `"Request cancelled."`; badResponse/badCertificate/unknown → `"Couldn't reach the server. Please try again."`; FormatException with non-empty message → that message; everything else → the caller-provided fallback. Default fallback: `"Something went wrong. Please try again."`

---

## 4. Content delivery protocol

### 4.1 Endpoints

```
kMapsContentRepo        = 'underpunks55/underdeck-content'          // owner/repo slug
kMapsContentBase        = 'https://underpunks55.github.io/underdeck-content'
kMapsPointerUrl         = kMapsContentBase + '/pointer/latest-v1.json'
kMapsPointerFallbackUrl = 'https://raw.githubusercontent.com/underpunks55/underdeck-content/main/pointer/latest-v1.json'

mapsJsDelivrUrl(tag, path) = 'https://cdn.jsdelivr.net/gh/underpunks55/underdeck-content@' + tag + '/' + path
mapsRawUrl(tag, path)      = 'https://raw.githubusercontent.com/underpunks55/underdeck-content/' + tag + '/' + path
```

Design rule: *everything mutable is tiny and lives on GitHub Pages; everything large is immutable and tag-pinned on jsDelivr.* `raw.githubusercontent.com` is a **fallback only** (it was rate-limit-hardened in May 2025; 429s behind CGNAT).

Fetch targets:

| File | Primary | Fallback | Size cap |
|---|---|---|---|
| pointer (`latest-v1.json`) | GitHub Pages URL, conditional GET with `If-None-Match` | raw GitHub `main` branch | 64 KB |
| manifest | `mapsJsDelivrUrl(pointer.tag, pointer.manifest.path)` | `mapsRawUrl(pointer.tag, pointer.manifest.path)` | 256 KB |
| map document | `{manifest.cdnBase}/{descriptor.document.path}` | `mapsRawUrl(tag, path)` | 2 MB |
| image asset | `{manifest.cdnBase}/{asset.path}` | `mapsRawUrl(tag, path)` | 8 MB |

### 4.2 HTTP client behavior

Shared Dio instance: connect timeout **10 s**, receive timeout **30 s**, plus a bounded retry interceptor for idempotent GET/HEAD: max **2 retries**, backoff delays **500 ms, 1500 ms**, retried only on transient failures (connection errors/timeouts and 5xx), never on cancel and never on 404/429 — which is exactly why the jsDelivr→raw fallback is implemented at the maps layer, not the retry layer.

Downloads are **streamed with a byte cap**:

1. `GET` with `validateStatus: s == 200 || s == 304`. A transport failure throws `MapTransportException('<type> on <url>')`.
2. Status 304 → "not modified" marker (only meaningful when `If-None-Match` was sent; a 304 on an unconditional `fetchVerified` is treated as a transport error: `'unexpected 304 (no conditional request)'`).
3. If the `Content-Length` header exists and exceeds the cap → `MapTooLargeException('Content-Length {n} > {cap} cap on {url}')` (no body read).
4. Stream chunks into a buffer; the moment the accumulated length crosses the cap → abort the stream with `MapTooLargeException('stream exceeded {cap} cap on {url}')`.
5. Capture the response `etag` header.

`fetchPointer({etag})`: sends `If-None-Match: <etag>` when non-empty; on any primary failure **except** `MapTooLargeException` (an oversized body is the same on both hosts — do not retry), retries the fallback URL with the same headers. Returns `{notModified}` or `{bytes, etag, byteLength}`.

`fetchVerified({primaryUrl, fallbackUrl, expectedSha256, maxBytes})`: primary → fallback on transport failure (rethrows `MapTooLargeException` immediately; missing/empty fallback → `MapTransportException('primary failed, no fallback')`); then verifies `sha256(bytes) == expectedSha256`. Mismatch → `MapFetchIntegrityException('sha256 mismatch (expected {hash})')` — a **hard reject** (the content is immutable and identical across CDNs; a fallback can't fix a hash mismatch).

Exception hierarchy (all extend `MapFetchException(message)`): `MapTooLargeException`, `MapFetchIntegrityException`, `MapTransportException`. Any of these ⇒ keep the locally installed pack untouched.

### 4.3 Integrity chain

- `sha256Hex(bytes)` — lowercase hex SHA-256.
- `verifyBytes(bytes, expectedHex)` — compares against `expectedHex.trim().toLowerCase()`, length-checked, **constant-time** over the digest (XOR-accumulate all code units; return `diff == 0`). Web equivalent: `crypto.subtle.digest('SHA-256', bytes)`.
- Chain: pointer pins the manifest hash; the manifest pins each document/asset hash; the blob store refuses to write bytes that do not hash to their content address.
- **ed25519 signature — NOT implemented (intentional seam)**: a signature over the *pointer* is what actually defends against repo/account compromise (sha256 alone is theatre there). When added it must be a `verifyPointerSignature(bytes, sig, publicKeys)` guard that runs BEFORE any sha256 checks, with the private key kept off-GitHub and two embedded public keys for rotation. The web port should keep this same seam (do not implement the signing ceremony now).

### 4.4 Version comparison (`compareContentVersions`)

Semver-ish dotted numeric compare used for both content anti-rollback and the `minAppVersion` gate:

```ts
function compareContentVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/), pb = b.split(/[.\-+]/);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const va = i < pa.length ? (parseInt(pa[i], 10) || 0) : 0;  // non-numeric → 0
    const vb = i < pb.length ? (parseInt(pb[i], 10) || 0) : 0;
    if (va !== vb) return va < vb ? -1 : 1;
  }
  return 0;
}
```

Consequence: seed versions like `'0-seed-2'` split into `['0','seed','2']` → `[0, 0, 2]`, so any real version (e.g. `'1.0.0'`) sorts above every seed. (Note `parseInt('seed')||0 → 0`; the Dart original uses `int.tryParse(...) ?? 0` — pure-numeric parse. In TS use a strict `/^\d+$/` check to match Dart, since `parseInt('2abc')` differs from Dart's `tryParse`.) App version fallback when unknown: `0.2.0`.

---

## 5. Validation rules & hard limits

All of these are **reject** conditions (the file is refused wholesale). This is distinct from *must-ignore* parsing of unknown enum values (which degrade gracefully — see §6.1).

`MapLimits` constants:

| Constant | Value |
|---|---|
| `pointerMaxBytes` | 64 × 1024 (65 536) |
| `manifestMaxBytes` | 256 × 1024 (262 144) |
| `documentMaxBytes` | 2 × 1024 × 1024 (2 097 152) |
| `maxMaps` | 60 |
| `maxZonesPerMap` | 500 |
| `maxZonesPerGridMap` | 2600 (absolute ceiling for grid docs) |
| `maxVerticesPerZone` | 5000 |
| `maxFieldsSchema` | 25 |
| `maxOptionsPerField` | 20 |
| `minGridCols` / `maxGridCols` | 2 / 72 |
| `minGridRows` / `maxGridRows` | 2 / 36 |
| `maxImageBytes` | 8 × 1024 × 1024 (8 388 608) |
| `maxImageDimension` | 4096 px per side |
| `renderedImageKinds` | `{'background','background_hd','texture'}` |
| `maxIdLength` | 64 |
| `maxTitleLength` | 160 |
| `maxSubtitleLength` | 240 |
| `maxTagLength` | 40 |
| `maxTags` | 32 |
| `maxZoneNameLength` | 160 |
| `maxFieldKeyLength` | 64 |
| `maxFieldLabelLength` | 120 |
| `maxOptionLength` | 60 |
| `maxUnitLength` | 24 |
| `maxStyleLength` | 32 |
| `maxPathLength` | 256 |
| `maxSha256Length` | 64 |
| `maxVersionStringLength` | 40 |
| `maxCdnBaseLength` | 512 |
| `maxTextureAssetLength` | 64 |

Validation error codes (`MapValidationCode`): `tooLarge`, `malformedStructure` (wraps any parse exception), `tooManyMaps`, `tooManyZones`, `tooManyVertices`, `tooManyFields`, `tooManyOptions`, `stringTooLong`, `imageTooLarge`, `imageDimensionsTooLarge`, `imageDimensionsMissing`, `invalidBounds`.

Validator result type: `MapParseOk<T>{value}` | `MapParseError<T>{code, message}` — never throws.

### Per-document checks (in order)

**validatePointer(json, byteLength)**: byte cap → parse → string caps on `contentVersion`, `tag`, `minAppVersion` (each ≤ 40) → file-ref check on `manifest` (bytes ≥ 0, path ≤ 256, sha256 ≤ 64).

**validateManifest(json, byteLength)**: byte cap → parse → `maps.length ≤ 60` → string caps (`contentVersion`, `minAppVersion` ≤ 40, `cdnBase` ≤ 512) → per descriptor: id ≤ 64, title ≤ 160, subtitle ≤ 240 (nullable), tags (count ≤ 32, each ≤ 40), document file-ref check **plus** `document.bytes ≤ documentMaxBytes`; per asset: file-ref check, `bytes ≤ 8 MB`, and `pixelSize`:
- If `pixelSize` missing **and** `kind ∈ renderedImageKinds` → `imageDimensionsMissing` (rendered images MUST pre-declare pixel size so decode bounds are enforceable before download; thumbnails et al. stay lenient).
- If present and either side > 4096 → `imageDimensionsTooLarge`.

**validateDocument(json, byteLength)**: byte cap → parse → `fieldsSchema.length ≤ 25` → grid bounds (if `grid` present: cols ∈ [2,72], rows ∈ [2,36], else `invalidBounds`) → zone cap: `grid == null ? 500 : min(cols*rows, 2600)` → id ≤ 64 → canvas bounds (if present: width/height finite and > 0, else `invalidBounds`) → `sphere.textureAsset ≤ 64` → per field spec: key ≤ 64, label ≤ 120, unit ≤ 24 (nullable), style ≤ 32 (nullable), options count ≤ 20, each option ≤ 60 → per zone: id ≤ 64, name ≤ 160, vertex count ≤ 5000 (a grid zone without explicit geometry counts as an implicit 4-vertex quad) → per grid zone: `gridPos` in range (`col < cols && row < rows`) and **no duplicate cell** (key `row*cols + col`), else `invalidBounds`.

---

## 6. Data models

### 6.1 Must-ignore parsing philosophy

Closed enums parse *tolerantly*: any unrecognized wire value maps to the enum's `unknown` member instead of throwing, so content authored against a **future** schema still parses; the offending map/zone/field surfaces as "update required" rather than crashing. Only structural/bounds violations reject a file.

`kSupportedMapSchemaVersion = 2`. A document with `schemaVersion > 2` is not openable (renders "Update required"), is excluded from the FTS index, and is dropped from search results. Schema 2 added grid-sphere documents (`grid` + per-zone `gridPos`/`cellNum`, implicit cell geometry); schema-1-only builds can't parse a zone without geometry, so a grid doc correctly degrades there.

### 6.2 Enums (wire values)

```
MapType:       'flat' | 'sphere' | (anything else → unknown)
MapIcon:       'map' | 'dungeon' | 'station' | 'sphere' | 'sector' | (else → unknown)
ZoneFieldType: 'text' | 'longText' | 'number' | 'enum' | 'stringList' | 'link' | (else → unknown)
```

Icon → Material glyph mapping (`mapIconData`): map→`Icons.map`, dungeon→`Icons.castle`, station→`Icons.hub`, sphere→`Icons.public`, sector→`Icons.grid_on`, unknown→`Icons.travel_explore`.

The v1 field-type contract is frozen — new behavioural types require a MAJOR schema increment.

### 6.3 Pointer (`pointer/latest-v1.json`)

```jsonc
{
  "schemaVersion": 1,            // int, required
  "contentVersion": "1.4.0",     // string, required — semver-ish
  "tag": "v1.4.0",               // string, required — the immutable git tag
  "minAppVersion": "0.1.0",      // string, required — app gate
  "manifest": {                  // MapFileRef, required
    "path": "manifest.json",     // repo-relative under the tag
    "sha256": "<64 lowercase hex>",
    "bytes": 12345,
    "kind": "manifest"           // optional
  }
}
```

### 6.4 MapFileRef / MapAssetRef

```jsonc
{
  "path": "maps/foo.map.json",   // string, required; joined onto cdnBase or the tag
  "sha256": "…",                 // string, required; lowercase hex; pins exact bytes
  "bytes": 4096,                 // int, required; declared size for pre-download bound
  "kind": "background",          // string?, optional role hint: 'document','background','background_hd','thumbnail','texture',…
  "pixelSize": [2448, 3264]      // [int,int]?, optional; REQUIRED for renderedImageKinds
}
```

`MapAssetRef` is structurally identical; the distinct type just lets the validator apply image bounds.

### 6.5 Manifest

```jsonc
{
  "schemaVersion": 1,               // int
  "contentVersion": "1.4.0",        // string
  "minAppVersion": "0.1.0",         // string
  "cdnBase": "https://cdn.jsdelivr.net/gh/underpunks55/underdeck-content@v1.4.0",  // string
  "maps": [ MapDescriptor, … ],     // default []
  "changelog": …                    // optional, must-ignore (see below)
}
```

**MapDescriptor**:

```jsonc
{
  "id": "venus",              // string, required
  "type": "sphere",           // MapType, must-ignore
  "title": "Venus",           // string, required
  "subtitle": "60×30 grid …", // string?, optional
  "icon": "sphere",           // MapIcon, must-ignore
  "order": 3,                 // int, default 0 — gallery sort key ascending
  "version": 1,               // int, default 1
  "draft": false,             // bool, default false — drafts are listed but not installed/openable
  "tags": ["planet"],         // string[], default []
  "document": MapFileRef,     // required
  "assets": [ MapAssetRef ]   // default []
}
```

**Changelog** (`parseChangelog`, AUDIT §6.3): accepts a single string (one entry), or a list whose items are strings or `{version?, notes}` objects. Each entry: `version: string|null` (trimmed; blank → null), `notes: string` (trimmed; empty → entry dropped). Absent/malformed → `[]` (never breaks old content).

`shouldShowMapsChangelog({contentVersion, lastSeenVersion, hasChangelog})` = `hasChangelog && contentVersion !== '' && contentVersion !== lastSeenVersion` (pure; the once-per-version state lives in prefs).

### 6.6 Map document (`*.map.json`)

```jsonc
{
  "schemaVersion": 1|2,                 // int, required
  "id": "hideous-dungeon",              // string, required
  "type": "flat" | "sphere",            // must-ignore
  "canvas": { "width": 2448, "height": 3264 },   // flat maps only (doubles, required >0 finite)
  "sphere": {                           // sphere maps only
    "textureAsset": "texture",          // which asset kind supplies the (future) surface texture
    "initialOrientation": { "lat": 8.0, "lon": 0.0 },   // degrees; each defaults 0.0
    "autoRotateDegPerSec": 3.0          // default 0.0 (0 = no autorotation)
  },
  "grid": { "cols": 17, "rows": 10 },   // grid-sphere docs (schema 2) — must-ignore parse; bad shape → no grid
  "theme": { … },                        // 9 tokens, per-token tolerant (see §7)
  "fieldsSchema": [ ZoneFieldSpec, … ],  // default []
  "zones": [ MapZone, … ]                // default []
}
```

**ZoneFieldSpec**:

```jsonc
{
  "key": "threat",             // string, required — key into zone.fields
  "label": "Threat",           // string, required — display label
  "type": "enum",              // ZoneFieldType (wire 'enum' == enumeration), must-ignore
  "options": ["low","high"],   // string[]?, for enum
  "unit": "g",                 // string?, appended to number values
  "style": "badge",            // string?, free-form hint (currently unused by renderers)
  "searchable": false,         // bool, default false — contributes to FTS fields_text
  "filterable": false          // bool, default false — RULE: only honoured when type == enum;
                               // silently forced to false for any other type at parse time
}
```

**MapZone**:

```jsonc
{
  "id": "z-entrance",              // string, required
  "name": "Collapsed Entrance",    // string, required (may be '' — then no label)
  "geometry": ZoneGeometry,        // see below. May be OMITTED only in a grid document
                                   // when a usable gridPos is present; otherwise a
                                   // structural error (FormatException → malformedStructure).
  "gridPos": [col, row],           // grid docs: 0-based cell address; must-ignore parse
                                   // (non-int / negative / wrong shape → null)
  "cellNum": 42,                   // int?, purely presentational cell number
  "labelAnchor": [x, y],           // [double,double]? canvas px — label center override
  "themeOverride": { … },          // parsed then RESTRICTED to {zoneFill, zoneStroke, glow};
                                   // empty-after-restriction → null
  "fields": { "threat": "low" }    // free-form values keyed by fieldsSchema key; default {}
}
```

**ZoneGeometry** (sealed; keyed by `"kind"`; unknown kind → `UnknownGeometry` — the zone exists but can't be drawn/picked; a *known* kind with broken coordinates throws → structural reject):

| kind | Payload | Space | Notes |
|---|---|---|---|
| `polygon` | `rings: [[x,y],…][]` | canvas px | ring 0 = outline, rest = holes; even-odd fill |
| `marker` | `at: [x,y]`, `hitRadius: double` | canvas px | POI point; hitRadius is a screen-space tap tolerance |
| `sphericalPolygon` | `rings: [[lon,lat],…][]` | degrees, GeoJSON order (lon,lat) | edges = great-circle arcs, CI pre-densified |
| `sphericalCap` | `center: [lon,lat]`, `radiusDeg: double` | degrees | circle by angular distance; used for pole-covering zones (a polygon must never contain a pole) |

`vertexCount` per geometry: polygon/sphericalPolygon = sum of ring lengths; marker/cap = 1; unknown = 0.

`GeoPoint` = `{lon, lat}` in **degrees**, deliberately a distinct type from canvas-px points so the two spaces are never mixed.

### 6.7 MapGrid & GridPos (grid-sphere)

`MapGrid{cols, rows}` — a uniform lon/lat grid. Derived values:

```
lonStep = 360 / cols
latStep = 180 / rows
kGridPoleClampLat = 89.5   // degrees; pole clamp for numeric robustness

cellBounds(col, row):
  lonWest  = -180 + col * lonStep
  lonEast  = lonWest + lonStep
  latNorth = clamp( 90 - row     * latStep, -89.5, +89.5)
  latSouth = clamp( 90 - (row+1) * latStep, -89.5, +89.5)

cellCenter(col, row) = GeoPoint((lonWest+lonEast)/2, (latNorth+latSouth)/2)
```

`GridPos.tryParse`: must be a `[col,row]` array of non-negative integers (fractional → null). Col 0 starts at lon −180; row 0 at the north edge.

---

## 7. Theme system & sanitization

### 7.1 Tokens

A `MapTheme` has 9 closed tokens, all resolved (no nulls): `background`, `surface`, `zoneFill`, `zoneStroke`, `zoneSelectedFill`, `glow`, `label`, `accent` (Colors) and `fontFamily` (string).

Defaults (from AppColors):

| Token | Default |
|---|---|
| background | `#03060B` (bgDeepest) |
| surface | `#111E30` (bgCard) |
| zoneFill | `#0A1220` (bgElevated) |
| zoneStroke | `#4FC3FF` (accentPrimary) |
| zoneSelectedFill | `#7AE3FF` (accentSecondary) |
| glow | `#7AE3FF` (accentSecondary) |
| label | `#E8F4FF` (textPrimary) |
| accent | `#FFB347` (accentWarn) |
| fontFamily | `Inter` |

Color parsing (`parseHexColor`): accepts `#RRGGBB` or `#AARRGGBB`, leading `#` optional, case-insensitive; 6-digit gets `FF` alpha prefixed; anything else → null → token falls back to its default (per-token tolerant).

Font whitelist: `{'Inter', 'JetBrainsMono', 'Quicksand'}`; anything else → default family.

### 7.2 Per-zone overrides

`MapZone.themeOverride` parses all 9 tokens but is immediately **restricted** to `{zoneFill, zoneStroke, glow}` (`zoneRestricted()`); a zone can never repaint the map's background/surface/label/font (that would bypass the map-level dark-guard/contrast sanitization). Empty-after-restriction → treated as no override.

`zoneTheme(base, override)`: `override == null ? base : base.withOverride(override).sanitize()` — the merged theme is re-sanitized so a per-zone standout colour still clears contrast/selection guards. `sanitize` is idempotent.

### 7.3 WCAG math (sRGB)

```
linearize(c) = c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4        // c in 0..1
relLuminance(color) = 0.2126*linearize(r) + 0.7152*linearize(g) + 0.0722*linearize(b)
                      // alpha ignored
contrastRatio(a,b)  = (max(La,Lb)+0.05) / (min(La,Lb)+0.05)          // in [1,21]
deltaL(a,b)         = |La - Lb|
```

### 7.4 `sanitize()` algorithm

Tuning constants:

```
kMapMaxSurfaceLuminance = 0.22   // dark-guard ceiling for background/surface
kMapLabelMinContrast    = 4.5    // WCAG AA body text
kMapStrokeMinContrast   = 3.0    // WCAG AA non-text/UI
kMapMinSelectionDeltaL  = 0.06   // min luminance delta selected vs base fill
```

Steps (order matters; result is idempotent):

1. **Dark-guard**: `background` and `surface` whose relative luminance > 0.22 are replaced by their app defaults (the glass/neon design assumes dark surfaces).
2. **Font whitelist**: non-whitelisted `fontFamily` → `Inter`.
3. **Stroke contrast**: if `contrastRatio(zoneStroke, guardedBackground) < 3.0` → `zoneStroke = #4FC3FF` (default).
4. **Selection visibility**: if `deltaL(zoneSelectedFill, zoneFill) < 0.06`, first try the default `#7AE3FF`; if still too close, `pushLuminance(zoneFill, 0.06)`:
   - target = white if `L(fill) < 0.5` else black; for `t = 0.15, 0.30, …, < 1.0` (step 0.15) lerp fill→target and return the first colour whose |ΔL| ≥ 0.06; else return the target itself.
5. **Label contrast**: label must reach contrast ≥ 4.5 against ALL of `[surface, zoneFill, selectedFill]`; if not, replace it with whichever of `[#E8F4FF, #03060B]` maximises the **worst-case** contrast across those surfaces.
6. `zoneFill`, `glow`, `accent` pass through unchanged.

Note for renderers: label token guards are belt-and-suspenders. The *real* legibility guarantee is the **systematic scrim/halo drawn behind every label by the rendering engine** (non-bypassable by content) — see §13/§14/§15.

---

## 8. Persistence

### 8.1 Content-addressed blob store

- Location: `<application-support-dir>/maps_store/blobs/<sha256>` (filename IS the lowercase hex hash).
- `write(bytes, expectedSha256)`: verify hash first (`BlobIntegrityException` on mismatch, nothing written), then atomic write: unique temp file `<target>.tmp.<pid>.<micros>` → `flush` → `rename` (atomic within a filesystem). Losing a rename race to an existing final file is a no-op win for the other writer. Already-present blob → skip (trusted by content address).
- `writeTrusted(bytes, sha256)`: same atomic write but **no re-verify** — only for the bundled seed whose hash was just computed in-process (authenticated by the app-store signature over the binary).
- `read(sha256)` → bytes or null. `exists(sha256)`.
- `gc({keep})`: delete every file in the blobs dir whose basename ∉ keep (this also collects stale `.tmp` leftovers); returns count. `keep` = all sha256s referenced by installed `MapPacks`/`MapPackFiles` rows + manifest hashes + caller pins. Local-only; never touches server state; never deletes pinned blobs.
- `totalBytes()`: sum of file sizes (best-effort; files vanishing mid-scan are skipped). Drives Settings "Downloaded maps: X".

Web equivalent: OPFS (`navigator.storage.getDirectory()`) or IndexedDB keyed by sha256; "atomic" via write-then-put semantics of IDB transactions.

### 8.2 Drift (SQLite) tables

**MapPacks** (one row per installed content version; PK `contentVersion`):

| Column | Type | Notes |
|---|---|---|
| contentVersion | TEXT PK | e.g. `'0-seed-2'` or `'1.4.0'` |
| tag | TEXT | git tag; seed uses `'seed'` |
| manifestSha256 | TEXT | content address of the manifest blob |
| installedAt | DATETIME | |
| state | TEXT | `'installed' | 'downloading' | 'failed'` (only `'installed'` is used today) |

**MapPackFiles** (one row per file of a pack; PK `(contentVersion, logicalPath)`):

| Column | Type | Notes |
|---|---|---|
| contentVersion | TEXT | |
| logicalPath | TEXT | manifest path, or `'manifest.json'` for the manifest row |
| sha256 | TEXT | content address; doubles as the GC reference set |
| bytes | INT | declared size |
| kind | TEXT NULL | `'manifest','document','background','thumbnail','texture',…` |

**MapPins** (personal per-zone notes; local user content, not part of any pack; PK `id`):

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | client-generated UUID v4 |
| mapId | TEXT | not a FK — a pin must outlive a temporarily-uninstalled pack |
| zoneId | TEXT | |
| note | TEXT DEFAULT '' | free text; import cap 20 000 chars |
| createdAt | DATETIME | |
| updatedAt | DATETIME | |

**FTS5 virtual table** `map_zone_fts`:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS map_zone_fts USING fts5(
  zone_id UNINDEXED,
  map_id UNINDEXED,
  name,
  fields_text,
  tokenize = 'unicode61 remove_diacritics 2');
```

### 8.3 SharedPreferences keys

| Key | Type | Meaning |
|---|---|---|
| `maps.pointerEtag` | string | last pointer ETag; sent as `If-None-Match` |
| `maps.lastCheckAt` | int (ms epoch) | last update-check timestamp (throttle) |
| `maps.seedImported` | bool | LEGACY seed guard (true ⇒ treated as `'0-seed'` imported) |
| `maps.seedImportedVersion` | string | seed contentVersion last imported/covered |
| `settings.mapsNetworkEnabled` | bool (default **true**) | master maps-network switch |
| `settings.mapsAutoUpdate` | bool (default **true**) | gates the ≤1/24h auto check |
| `settings.mapsLastSeenChangelogVersion` | string? (default null) | changelog banner ack |

---

## 9. Seed pack import

Constants: `kMapSeedContentVersion = '0-seed'` (first-ever seed; every seed sorts below every real version), `kMapSeedTag = 'seed'`, `kMapSeedManifestAsset = 'assets/maps_seed/manifest.json'`. Isolate hashing threshold: blobs ≥ **256 KB** are hashed off the UI thread (web: Web Worker), smaller inline.

`MapSeedImporter.ensureImported()` — runs lazily at first Knowledge entry (watched by `MapsHomeSection`, also by the gallery). Never throws; returns:

- `MapSeedImported(mapCount)` — imported now; count of non-draft maps.
- `MapSeedSkipped(alreadyImported | contentAlreadyInstalled)`.
- `MapSeedFailed(error, diskFull)` — `diskFull` = POSIX ENOSPC (`osError.errorCode == 28`). The guard is NOT set, so a retry (`invalidate` the provider) re-runs it.

Algorithm:

1. Load + JSON-decode the bundled seed manifest. Its `contentVersion` (currently `'0-seed-2'`) IS the import guard: if it equals the recorded imported version (`maps.seedImportedVersion`, or `'0-seed'` mapped from the legacy bool) → skip `alreadyImported`. A **changed** bundled version (app update shipping new seed maps) re-imports over the old seed.
2. If any installed pack has `tag != 'seed'` (real content), record the bundled version as covered and skip `contentAlreadyInstalled`. (An installed *seed* pack does NOT count — that's exactly the pack a version bump replaces.)
3. Import: for each map in the manifest (drafts skipped for blobs), load document/asset bytes from the asset bundle, compute sha256 locally, and **patch** the manifest JSON's `sha256`/`bytes` in place (the bundled file ships `0000…`/0 placeholders — the seed is trusted, not wire-verified). Re-encode + validate the patched manifest; validate every non-draft document; build FTS rows; write all blobs with `writeTrusted`; then in ONE DB transaction: delete any older seed pack (tag `'seed'`, different contentVersion) and its files; upsert the new `MapPacks` row (`state:'installed'`); replace this version's `MapPackFiles`; `DELETE FROM map_zone_fts` and re-insert all rows.
4. Record the imported version in prefs.

Failure UX contract (M1): render a real empty state, never a mystery blank — disk-full: "Storage full — free up space and retry" + Retry; otherwise: "Couldn't set up offline maps." + Retry (details logged). Exact strings in §12.

`resetMapSeedImportGuard(prefs)` removes both seed prefs keys — used by Settings › Clear so the baseline re-imports at the next Knowledge entry.

---

## 10. Update lifecycle

Orchestrated by `MapContentRepository`. All render-time reads come from the store — **never the network**.

### 10.1 `checkForUpdate({networkEnabled, appVersion, force=false})` → outcome

Sealed outcomes: `MapUpdateDisabled`, `MapUpdateThrottled`, `MapUpToDate`, `MapUpdateBlockedByAppVersion(minAppVersion)`, `MapUpdateCheckFailed(error)`, `MapUpdateAvailable(pointer, manifest, manifestBytes)`.

1. `!networkEnabled` → **Disabled**.
2. Throttle: unless `force`, if `now − maps.lastCheckAt < 24h` → **Throttled** (`checkInterval = 24 hours`).
3. Fetch pointer conditionally with the stored ETag. Record `maps.lastCheckAt = now` **regardless of the result** (the check ran).
4. 304 → **UpToDate**.
5. Validate the pointer (§5). Invalid → **CheckFailed**.
6. **Anti-rollback / already-have-it**: if an installed version exists and `compareContentVersions(pointer.contentVersion, installed) <= 0` → persist the new ETag (so the next poll 304s cheaply) and return **UpToDate**.
7. **App gate**: if `compareContentVersions(appVersion, pointer.minAppVersion) < 0` → **BlockedByAppVersion**.
8. Fetch + validate the manifest (jsDelivr primary, raw fallback, 256 KB cap, sha256 = pointer.manifest.sha256). Invalid → **CheckFailed**.
9. Persist the ETag only now (after the whole chain validated — a partial failure must re-fetch next time rather than 304 into a broken state). → **UpdateAvailable**.

Never throws — transport/parse failures land in **CheckFailed** (logged).

### 10.2 `install(available, {pins})`

1. Store the manifest blob (verified against the pointer's pinned hash).
2. For every **non-draft** map: `_ensureBlob` the document (`{cdnBase}/{path}` → raw fallback; 2 MB cap) — if already on disk it's trusted by content address and returned with **no network hit** (differential reuse); validate the document (invalid → `MapInstallException('map {id}: invalid document (…)')` — transaction not committed, previous pack intact); build its FTS rows; `_ensureBlob` every asset (8 MB cap).
3. One DB transaction: upsert the `MapPacks` row (`contentVersion`, `tag`, `manifestSha256`, `installedAt`, `state:'installed'`); replace this version's `MapPackFiles` rows (manifest row uses logicalPath `'manifest.json'`, kind `'manifest'`; documents kind `'document'`; assets `asset.kind ?? 'asset'`); wipe + repopulate `map_zone_fts` (single-installed-version index).
4. `gc(pins)` — collect orphaned blobs. `pins` = sha256s that must survive regardless (blobs of a currently-open document).

### 10.3 Offline reads

- `installedContentVersion()` — newest `state='installed'` pack row (ordered by installedAt desc, limit 1) → contentVersion or null.
- `loadInstalledManifest()` — read the pack's manifest blob, re-validate; null if missing/invalid.
- `loadDocument(mapId)` — find descriptor in the installed manifest, read + validate its document blob; null if absent.
- `loadMapAssetBytes(mapId, {kind})` — bytes of the first asset with that `kind` (e.g. `'background'`), or null.

### 10.4 `clearAllContent()`

One transaction: delete all `MapPackFiles`, all `MapPacks`, `DELETE FROM map_zone_fts`; then `gc()` with empty keep (everything collected); then remove `maps.pointerEtag` + `maps.lastCheckAt`. Does NOT re-import the seed — callers (Settings) additionally call `resetMapSeedImportGuard` and invalidate the seed provider.

### 10.5 Activation policy (critical UX invariant)

A freshly installed pack is **never swapped under the user's feet**. Providers are invalidated only *at screen entry*:

- Gallery `initState` (post-frame): invalidate `mapsManifestProvider`, then fire a non-blocking `checkForUpdate` (guarded by `mapsNetworkEnabled && mapsAutoUpdate`); on `MapUpdateAvailable` install silently and show the "New maps ready" banner (content appears on the NEXT entry); on `BlockedByAppVersion` show the "Update Underdeck" banner. Install errors are logged, no UI.
- Detail `initState` (post-frame): invalidate `mapDocumentProvider(id)` + `mapBackgroundBytesProvider(id)`.
- Home section / gallery: when the seed import completes with `MapSeedImported`, invalidate `mapsManifestProvider` once (guarded by a local flag).

---

## 11. Full-text zone search

### 11.1 Index build (`buildZoneFtsRows(doc)`)

- Excluded entirely: docs with `type == unknown` OR `schemaVersion > 2` (they render "update required" and must not lead search to a dead end).
- Searchable keys: fields whose schema entry has `searchable == true` AND a known type.
- One row per zone: `{zone_id, map_id, name, fields_text}` where `fields_text` = space-joined stringified values of the searchable keys. Stringify: string → itself; num/bool → toString; list → recursively stringified elements space-joined; null/objects → '' (maps are not a v1 field type). Zone `name` is always indexed.

### 11.2 Query building (`ftsMatchExpression`)

Split the raw input on whitespace; drop empties; if none → `null` (caller skips the query — a blank/operator-only query yields no hits, never a syntax error). Each term is wrapped in double quotes with internal `"` doubled (neutralises every FTS operator); terms joined by space (implicit AND); the **last** term gets a trailing `*` (prefix match so results appear while typing).

Example: `pel"e vol` → `"pel""e" "vol"*`.

### 11.3 Query

```sql
SELECT zone_id, map_id, name FROM map_zone_fts
WHERE map_zone_fts MATCH ? ORDER BY rank LIMIT ?   -- limit default 50
```

`rank` = bm25 relevance. Any SQL error is caught defensively → empty results (never crash the search box).

### 11.4 UI join (`mapZoneSearchProvider(query)`)

FutureProvider.autoDispose.family, keyed by the query string. Blank query → `[]`. Joins hits against the installed manifest; drops hits whose map is missing, `draft`, or `type == unknown` (only openable maps surface). Result rows: `{mapId, mapTitle, mapIcon, zoneId, zoneName}`. **Debouncing is the caller's job** — the gallery debounces keystrokes at **280 ms**.

The federated global search (outside this area) also consumes `mapZoneSearchProvider` and opens hits via `/knowledge/maps/{id}?zone={zoneId}`.

---

## 12. Views

All screens: `Scaffold` with `backgroundColor: #03060B`, `extendBodyBehindAppBar: true`, transparent AppBar (elevation 0), AppBar icons tinted `accentPrimary`, body wrapped in `AppBackground`, scrollable content in `PageScrollView` with padding `LTRB(12, topSafeArea + 56(toolbar) + 8, 12, 32)`.

### 12.1 MapsHomeSection (block on the Knowledge home)

- Watches the seed import; on `MapSeedImported` (first time) invalidates the manifest provider. This is the **seed-import trigger point**.
- Maps sorted by `order` ascending.
- If no maps: if the seed failed → `_SeedFailureCard` (GlassCard):
  - Header row: icon `Icons.sd_card_alert` (disk full) or `Icons.map_outlined`, 18 px, `accentWarn`; text "Interactive maps" (headline).
  - Message (caption): disk-full → `Storage is full, so offline maps could not be set up. Free up some space and try again.`; otherwise → `Couldn't set up offline maps.`
  - `Retry` text-button (refresh icon 18 px accentPrimary) → invalidates the seed provider.
  - Otherwise (still importing) → renders nothing (avoid an empty header flash).
- With maps: header row (whole row tappable → `/knowledge/maps`): icon `Icons.map` 18 px accentPrimary; `INTERACTIVE MAPS` mono 12/600 letter-spacing 2 accentPrimary; right side "View all" caption textSecondary + chevron_right 18 px textDim. Semantics: "Interactive maps, {n} available. Open gallery".
- Up to **3** `MapGalleryCard`s (`_kHomeMaxCards = 3`), 12 px gaps.
- If more: `_SeeAllRow` — container radius 8, border borderSubtle, fill bgGlass, padding 12×10; `Icons.grid_view_rounded` 18 px accentPrimary; text `See all maps ({remaining} more)` (body); spacer; chevron_right textDim. → `/knowledge/maps`.

### 12.2 MapsGalleryView (`/knowledge/maps`)

AppBar: title `Interactive maps` (headline). Action: `IconButton` `Icons.info_outline`, tooltip `How interactive maps work` → modal bottom sheet `MapsHowItWorksView` (isScrollControlled, transparent background).

On entry (post-frame): invalidate manifest; kick the guarded background update check (§10.5).

Body states (`mapsManifestProvider`):

- loading → centered `CircularProgressIndicator` (top padding 32).
- error → centered `friendlyError(e, fallback: "Couldn't load maps.")` in body style, color accentDanger.
- data → column:
  1. **Changelog banner** (once per content version; hidden after tap-dismiss this session or when `settings.mapsLastSeenChangelogVersion == manifest.contentVersion`): accent `#7AE3FF`; DecoratedBox fill accent 10 % alpha, radius 8, border accent 45 % alpha; padding 12×8; `Icons.auto_awesome` 20 px accent; title `What's new` (body 600, accent); per entry: optional version line (mono 10, letter-spacing 1.2, w700, textSecondary) + notes (caption), 4 px gaps; dismiss `Icons.close` 18 px textSecondary (tooltip `Dismiss`) → persists `markMapsChangelogSeen(contentVersion)` + hides immediately. Semantics liveRegion: "What's new in maps. {version}: {notes}. …".
  2. **Update banner** (session state from the background check):
     - `ready`: accent accentPrimary, icon `Icons.download_done`, title `New maps ready`, message `Updated map content was downloaded and will appear the next time you open Interactive maps.`
     - `updateApp`: accent accentWarn, icon `Icons.system_update`, title `Update Underdeck`, message `Newer map content is available but needs a newer version of Underdeck. Update the app to get it.`
     - Same visual container as the changelog banner; dismiss X clears it. Semantics liveRegion "{title}. {message}".
  3. **Zone search field** (only when ≥1 map installed): `TextField`, hint `Search zones across maps` (body, textDim), prefix `Icons.search` textSecondary, suffix clear `Icons.close` (tooltip `Clear search`) only when non-empty, filled bgGlass, content padding horizontal 12, radius 8 borders (enabled borderSubtle / focused borderGlow), `textInputAction: search`. Keystrokes debounced **280 ms** into the provider query.
  4. If query non-empty → **search results**; else → **map cards**.

**Search results** (`mapZoneSearchProvider(query)`): loading → spinner; error → `friendlyError(e, fallback: "Couldn't run that search.")` accentDanger; empty → `No zones match “{query}”.` (caption; note the curly quotes); data → rows (8 px gaps). Row = GlassCard, tap → `/knowledge/maps/{encode(mapId)}?zone={encode(zoneId)}`: map icon 20 px accentPrimary; column: map title UPPERCASED (mono 10/600, letter-spacing 1.4, textSecondary) above zone name (headline); chevron_right 20 px textDim. Semantics "{zoneName}, in {mapTitle}".

**Map cards body**: maps sorted by `order`; if empty:
- Seed failed → `_EmptyState` GlassCard (top padding 24): icon `Icons.sd_card_alert`/`Icons.map_outlined` 20 px accentWarn; title `Storage full` / `Couldn't set up maps` (headline); message `Offline maps could not be set up because storage is full. Free up some space and try again.` / `The offline map set could not be prepared.` (caption); `Retry` TextButton.icon (refresh 18 px accentPrimary, body accentPrimary) → invalidate seed provider.
- Otherwise → same empty-state layout, icon `Icons.map_outlined`, title `No maps yet`, message `Interactive maps will appear here once they are installed.` (no retry).

### 12.3 MapGalleryCard

GlassCard row, tap → `/knowledge/maps/{descriptor.id}` (push). Semantics "{title}" or "{title}, draft".

- **Thumb** 48×48: rounded 8, fill bgElevated, border borderSubtle. Content: the map's `background` asset bytes from the offline store (`mapBackgroundBytesProvider`) rendered cover-fit and **decoded at display size** (`cacheWidth/Height = round(48 × devicePixelRatio)` clamped 1..256 — never the intrinsic up-to-4096² resolution); fallback while loading / no background / decode error: the `mapIconData(icon)` glyph 26 px accentPrimary.
- Title (headline, 1 line ellipsis) + optional `DRAFT` badge: padding 6×2, fill accentWarn 14 % alpha, radius 4, border accentWarn 45 % alpha, text mono 9/700 letter-spacing 1.5 accentWarn.
- Subtitle if non-empty (caption, 2 lines ellipsis).
- Trailing chevron_right 20 px textDim.

### 12.4 MapsHowItWorksView — FULL copy

`HowItWorksSheet` with cards (in order). Header: `TransmissionHeader(label: 'INTERACTIVE MAPS · how this works')`.

**Overview** (SectionHeader 'Overview', icon `Icons.map_outlined`)
Body: `Interactive maps are content — JSON geometry, field data, and images — not code. They are authored in a public GitHub repository and delivered to the app as plain data. The app ships with a small bundled set so maps work on first launch with no network at all; anything newer is fetched on top of that baseline.`
Caption: `Nothing about your game state, identity, or usage is ever sent. The map pipeline only ever pulls public files down.`

**Where maps come from** (icon `Icons.link`)
Body: `Two layers. A tiny mutable pointer says "the current maps are at tag X". The actual content lives at that immutable, tag-pinned tag and is served from a multi-CDN mirror of the GitHub repo.`
KvRows (labelWidth 96):
- `Pointer` → `GitHub Pages (fronted by Fastly). Small JSON, polled with an ETag so an unchanged pointer is a 304 with no body.`
- `Content` → `jsDelivr — a multi-CDN (Cloudflare / Fastly / Bunny) mirror of the repo, pinned to an exact tag so bytes never change under a version.`
- `Fallback` → `raw.githubusercontent.com, used only if jsDelivr fails.`

**Integrity** (icon `Icons.verified_user`)
Body: `Every document and image is pinned to a sha256 hash in the manifest. A downloaded file is verified against that hash before it is written to disk — a mismatch is rejected and the previously installed maps are kept untouched.`
Caption: `Downloads are size-capped and streamed, so an oversized file is aborted mid-transfer rather than buffered whole. Because files are stored by their hash, an unchanged image across versions is reused for free — never re-downloaded.`

**How often it checks** (icon `Icons.schedule`)
KvRows: `Cadence` → `At most once every 24 hours, and only when you open the maps gallery.`; `Trigger` → `Opening Interactive maps. No background timers, no push, no polling while the app is closed.`; `Apply` → `A newer pack installs quietly and appears the next time you open maps — never swapped out mid-view.`

**Works offline** (icon `Icons.wifi_off`)
Body: `A seed set of maps is bundled inside the app binary and imported locally on first use — no network required. Rendering always reads from the on-device store, never the network, so maps stay fully usable on a plane, underground, or with downloads turned off.`

**What leaves the device** (icon `Icons.lock`)
KvRows: `Sent` → `Plain HTTP GET requests for public map files. No account, no device id, no analytics, no game data.`; `Visible` → `Your IP address — the same thing any web request exposes — to the CDNs serving the files (GitHub / Fastly / jsDelivr).`; `Stored remotely` → `Nothing. There is no Underdeck server.`; `Stored locally` → `The downloaded map files, in the app support directory. Clear them any time from Settings.`

**Your control** (icon `Icons.tune`)
Body: `Map downloads are on by default so you get the latest content. You can turn them off entirely.`
KvRows: `Off-switch` → `Settings → Interactive maps → "Download interactive maps". Off keeps only what is already on your device.`; `Auto-update` → `A separate toggle for the once-a-day background check; turn it off to update only when you choose.`; `Storage` → `Settings shows the installed version and size, with a Clear action that keeps the bundled seed usable.`

### 12.5 MapDetailView (`/knowledge/maps/:id`)

State: `_filters: Map<fieldKey, Set<option>>` (canvas filter), `_dimmed: ValueNotifier<Set<zoneId>>`, `_gridMode: bool` (grid-sphere docs only; default false = globe).

AppBar: background `#03060B` at 55 % alpha (scrim over the map), title = descriptor title ?? doc.id ?? `Map` (headline). Actions (only when the doc loaded):

1. `FavoriteButton(kind: map, id: mapId)`.
2. **My notes** button: `Icons.push_pin_outlined` with a count badge when >0 pins on this map (badge: fill accentPrimary, radius 7, minWidth 14, padding 4×1, text caption 9/700 color bgDeepest, positioned right −6 / top −4). Tooltip `My map notes`. → push `MapNotesListView`.
3. Grid-sphere docs only: toggle `Icons.public` (tooltip `Globe view`, shown while in grid mode) / `Icons.grid_view` (tooltip `Grid view`) — flips `_gridMode`. Selection is shared between representations via `selectedZoneProvider`, so toggling keeps the open zone.
4. If the doc has zones: `Icons.format_list_bulleted`, tooltip `List of zones` → push `MapZoneListView(document, title, initialFilters: _filters)` (the list hides exactly the zones the canvas dims).

Body dispatch (`mapDocumentProvider(id)`):

- loading → centered spinner.
- error → `_MessagePane(Icons.error_outline, "Couldn't open this map", friendlyError(e, fallback: 'The map failed to load.'))`.
- doc == null:
  - descriptor.draft → `_MessagePane(Icons.edit_note, 'Draft map', 'This map is still a draft and is not available to open yet. It will unlock in a future content update.')`
  - else → `_MessagePane(Icons.map_outlined, 'Map not found', 'This map is no longer available. It may have been removed in a content update. Go back to the gallery to see current maps.')`
- `doc.schemaVersion > 2` → `_MessagePane(Icons.system_update, 'Update required', 'This map needs a newer version of Underdeck to open. Update the app from your app store to view it.')`
- `type == flat`: `canvas == null` → `_MessagePane(Icons.warning_amber, 'Update required', 'This map needs a newer app version to display.')`; else `_FlatPane` (wrapped `_withFilters`).
- `type == sphere`: `sphere == null` → `_MessagePane(Icons.warning_amber, 'Update required', 'This globe needs a newer app version to display.')`; else `_GridPane` when `grid != null && _gridMode`, otherwise `_SpherePane` (both `_withFilters`).
- `type == unknown` → `_MessagePane(Icons.warning_amber, 'Update required', 'This map uses a format this app version does not understand yet. Update the app to view it.')`

`_MessagePane`: centered GlassCard (padding 24 around): header row icon 22 px accentPrimary + title (title style); message (body, textSecondary, height 1.5).

**Filter bar** (`_withFilters`): only when the doc has filterable fields (enum + non-empty options; the validator already forces filterable=false elsewhere). Stack overlay pinned at `top = safeTop + toolbar`, full width: a top-to-bottom gradient `bgDeepest 85 % → 0 %`; horizontally scrolling row (padding LTRB 12,8,12,12) of `TagChip`s — one chip per option of every filterable field (6 px right gaps), selected = option in `_filters[key]`.

**Filter logic**: toggling a chip adds/removes the option; the dimmed set is recomputed: a zone is dimmed when it fails ANY active field (**AND across fields, OR within a field**): for each active field, `zone.fields[key]` must be a string contained in the selected set. No active filter → empty dimmed set. The dimmed set is pushed through the ValueNotifier so painters repaint without rebuilding the viewport (transform preserved).

Semantics wrappers (a11y): flat pane — "Interactive map. Tap a zone for details, or use the List of zones button in the top bar."; sphere — "Interactive globe. Drag to rotate, pinch to zoom, tap a region for details, or use the List of zones button in the top bar."; grid — "Map grid. Pan and zoom the table, tap a cell for details, or use the List of zones button in the top bar." The zone LIST is the screen-reader path (canvases are not touch-explorable).

### 12.6 MapZoneListView (pushed page)

Accessible, non-spatial alternative to the canvas: searchable / filterable / sortable list. AppBar title `Zones · {mapTitle}`; action: sort toggle — icon `Icons.arrow_downward` when ascending (tooltip `Sort Z to A`), `Icons.arrow_upward` when descending (tooltip `Sort A to Z`).

Content column:

1. Search `TextField` — hint `Search zones`, same styling as the gallery field (no clear button, no debounce; filters as-you-type by `zone.name.toLowerCase().contains(query)`).
2. One `_FilterGroup` per filterable field: label UPPERCASED (mono 10/600 letter-spacing 1.5 textSecondary), then a Wrap (6 px gaps) of `_FilterChip`s: padding 12×6, radius 8; active: fill accentPrimary 16 % alpha, border borderGlow, leading check icon 14 px accentPrimary, caption text accentPrimary; inactive: fill bgGlass, border borderSubtle, caption textSecondary. Seeded from the canvas filters (copied on init; local edits do NOT propagate back).
3. Count line: `{n} zone`/`{n} zones` (caption), vertical padding 8.
4. Empty → `No zones match.` (caption, padding 12). Else zone rows (8 px gaps).

Filtering: name substring AND the same enum AND/OR logic as the canvas. Sorting: by `name.toLowerCase()`, ascending or descending (toggle).

Zone row: GlassCard; name (headline), kind line (caption): polygon/sphericalPolygon → `Region`; marker → `Marker`; sphericalCap → `Area`; unknown → `Unavailable`; null geometry → `Region` if gridPos else `Unavailable`. Chevron. Semantics "{name}, {kind}". Tap → the shared `ZoneSheet` as a modal bottom sheet (theme = `zoneTheme(doc.theme.sanitize(), zone.themeOverride)`).

### 12.7 MapNotesListView (pushed page)

AppBar title `My notes · {mapTitle}`. Watches `mapPinsForMapProvider(mapId)` (live).

- loading → spinner; error → `Couldn't load your notes.` (body, centered, padding 24).
- Pins joined against the doc's zones; pins whose zone no longer exists (removed by a content update) are skipped.
- Count line `{n} note`/`{n} notes` (caption).
- Empty → `No notes yet. Open a zone and tap "Add note / pin".` (caption, padding 12).
- Note row (GlassCard, 8 px gaps): leading `Icons.push_pin` 18 px accentPrimary (top-aligned +2); zone name (headline); note text (body, textSecondary, 3 lines ellipsis); trailing delete `IconButton` `Icons.delete_outline` 20 px textDim, tooltip `Delete note` → selection haptic + delete pin (list updates live). Row tap → shared `ZoneSheet`. Semantics "Note on {zoneName}".

Ordering: newest-edited first (`updatedAt` DESC).

---

## 13. Flat 2D map viewer

### 13.1 Render model (`buildFlatMapRender(doc)`) — built once per document

- `theme = doc.theme.sanitize()`.
- `canvasSize = doc.canvas ?? Size(1024, 1024)` (defensive default).
- **Label font size** (canvas px): `clamp(canvasSize.shortestSide * 0.018, 22.0, 96.0)`.
- **Marker visual radius**: `fontSize * 0.65`.
- **Label LOD scale**: labels are hidden below viewport scale `labelLodScale = 12.0 / fontSize` (i.e. a label must render ≥ `kMinLabelScreenPx = 12` screen px tall).
- Per zone → `ZoneRenderItem`:
  - `theme` = `zoneTheme(base, zone.themeOverride)` (resolved + sanitized).
  - polygon → even-odd `Path` from the rings (rings with < 3 points skipped; first ring outline, rest holes); `bounds` = path bounds.
  - marker → `markerCenter = at`, `bounds` = square of radius `markerRadius` around it.
  - spherical / unknown / null geometry → nothing drawable on a flat canvas (`bounds = Rect.zero`).
  - **Label layout** (if `name` non-empty): text laid out center-aligned, max 2 lines, ellipsis `…`, `maxWidth = fontSize * 12`; style: family = theme.fontFamily, size = fontSize, height 1.05, weight 600, color = theme.label. Anchor = `zone.labelAnchor ?? markerCenter ?? bounds.center`; `topLeft = anchor − (w/2, h/2)`. **Scrim** RRect: `padX = 0.45·fontSize`, `padY = 0.28·fontSize`, corner radius `0.5·fontSize`, rect = label box inflated by the pads.

### 13.2 Layered paint tree

The canvas child (sized to `canvasSize`) hosts 4 independent layers (each its own RepaintBoundary — on the web: stacked `<canvas>` elements), so pan/zoom transforms the composite without repainting anything:

1. **Background** (`FlatBackground` + `FlatBackgroundPainter`): flat fill `theme.background` under the image (covers pre-decode gap and transparent edges), then the decoded image stretched over the full canvas rect, `FilterQuality.medium` (bilinear).
2. **Zones** (`ZonePainter`): every zone's fill/glow/stroke (or marker glyph) + (when labels visible) each label's scrim. Repaints only on LOD flip or the dimmed set changing.
3. **Selection** (`SelectionPainter`): ONLY the selected zone, drawn highlighted. Cheap layer; repaints on selection change only.
4. **Labels** (`LabelPainter`): glyphs only (scrims are layer 2), LOD-gated, dim-aware.

### 13.3 Zone paint ops (shared with globe & grid)

**Stroke width** (canvas space — zooms with the map): `zoneStrokeWidth(canvas) = clamp(canvas.shortestSide * 0.003, 2.0, 14.0)`.

**paintPolygonZone(path, theme, strokeWidth, selected)**:
1. Fill: `selected ? zoneSelectedFill : zoneFill` at alpha `selected ? 0.60 : 0.42`.
2. Neon glow: blurred stroke UNDER the crisp one — width `strokeWidth × (selected ? 1.8 : 1.3)`, color `glow` at alpha `selected ? 0.90 : 0.50`, gaussian blur sigma `strokeWidth × (selected ? 2.4 : 1.5)`.
3. Crisp outline: width `strokeWidth × (selected ? 1.4 : 1.0)`, round joins, color `zoneStroke`, opaque.

**paintMarkerZone(center, radius, theme, selected)**:
1. Glow disc: radius `r × (selected ? 1.5 : 1.2)`, color `glow` alpha `selected ? 0.90 : 0.50`, blur sigma `r × 0.6`.
2. Solid disc radius r: `selected ? zoneSelectedFill : accent`.
3. Ring stroke: width `r × 0.18`, color `zoneStroke`.
4. Inner cut-out disc radius `r × 0.30`, color `background`.

**Dimming** (zones failing the active filter): the whole glyph (fill+glow+stroke+scrim) fades together via a 30 % opacity compositing layer (`saveLayer` with white at alpha 0.30) whose bounds inflate by `strokeWidth*4 + markerRadius + 8` so the glow isn't clipped. Labels likewise (bounds = scrim rect inflate 8).

**Label scrim fill** (layer 2, and everywhere labels appear): `theme.background` at alpha **0.72** — the engine-guaranteed legibility scrim.

### 13.4 Viewport & gestures (`FlatMapViewport`)

- `InteractiveViewer` in canvas coordinates: `constrained: false` (child = canvas size), `minScale = fitScale`, `maxScale = max(8.0, fitScale)`, `boundaryMargin = max(viewportW, viewportH)` on all sides. `fitScale = min(vw/cw, vh/ch)`.
- The controller's max-axis scale is mirrored into a `scale` notifier; `labelsVisible = scale >= labelLodScale`.
- **Initial transform** (first layout only):
  - Plain open: scale = fit, translation centers the canvas: `tx = (vw − cw·fit)/2`, `ty = (vh − ch·fit)/2`.
  - Deep-linked zone (`?zone=` with drawable bounds): frame the zone at ~**55 %** of the viewport: `target = min(vw / (b.width/0.55), vh / (b.height/0.55))`, `scale = clamp(target, fit, max(8, fit))`, `tx = vw/2 − b.center.x·scale`, `ty = vh/2 − b.center.y·scale`. Matrix = `T(tx,ty) · S(scale)`. Applied post-frame.
  - Deep-linked zone id is also pre-selected (post-frame) if it exists.
- **Tap** (tap-up, local position already in canvas space because the child is inside the transform): `hitIndex.hitTest(canvasPoint, scale)` → selection (`selectedZoneProvider(mapId)`); a hit fires a **selection haptic**; a miss sets selection to null (dismisses the sheet).
- Selected zone → the `ZoneSheet` overlay in screen space over the viewport, with a full-screen tap-catcher behind it that clears the selection.

### 13.5 Flat hit-testing (`ZoneHitIndex`)

Precomputed from zones in draw order; **topmost (last drawn) wins** (iterate reversed).

- Polygon: even-odd `Path.contains` guarded by a bounds pre-check; degenerate polygons (empty bounds) are skipped so they can't swallow taps. A tap inside a hole misses the zone.
- Marker: distance check with a **scale-compensated radius**: `effective = scale <= 0 ? hitRadius : hitRadius / scale` (constant physical tap-target size at every zoom); hit iff `distSq(p, at) <= effective²`.
- Spherical/unknown/null geometries: never hit on a flat map.

### 13.6 Background decode strategy (jank/OOM guard)

Never decode the source at intrinsic resolution.

```
kBackgroundBaseDecodeCap = 2048   // px width at normal zoom
kBackgroundMaxDecodeCap  = 4096   // hard ceiling at any zoom

backgroundDecodeWidth(canvasWidth, scale):
  desired = ceil(canvasWidth * scale)        // on-screen px actually needed
  capped  = clamp(desired, 1, 4096)
  target  = max(capped, 2048)                // base cap at normal zoom
  bounded = min(target, ceil(canvasWidth))   // never above the source
  return max(bounded, 1)
```

The stateful layer re-decodes when the live scale demands a *higher* width — **monotonic** (never steps back down, so panning at high zoom doesn't thrash the decoder), single decode in flight, disposes the old image. Decode failure → logged, flat theme fill remains. Web: `createImageBitmap(blob, {resizeWidth: target, resizeQuality: 'medium'})`.

---

## 14. Globe viewer

No 3D engine, no texture, no shaders: a **closed-form orthographic projection** with quaternion orientation, drawn as a stylized "neon globe" on a 2D canvas. All math below is exact and unit-testable.

### 14.1 Coordinate conventions

- **World space**: right-handed unit sphere. `GeoPoint(lon, lat)` in degrees →

  ```
  worldVec(g) = ( cos(lat)·cos(lon), cos(lat)·sin(lon), sin(lat) )
  ```
  +z = north pole, +x pierces (lon 0, lat 0).

  Inverse: `lat = asin(clamp(z,−1,1))·180/π`, `lon = atan2(y, x)·180/π` (normalize first).
- **Orientation**: a unit quaternion `q` mapping world → view: `view = rotate(q, world)`.
- **View space**: camera on the +z view axis looking at the origin ⇒ `view.z >= 0` is the near (front) hemisphere. View +x = screen right, view +y = screen up.
- **Screen space**: y grows down ⇒ negate view-y when projecting.

Because everything is vectors, the antimeridian needs no special handling in the picking path.

### 14.2 Projection & picking

```
project(g, q, radius, center):
  v = rotate(q, worldVec(g))
  screen = ( center.x + radius·v.x, center.y − radius·v.y )
  front  = v.z >= 0

kLimbPickLimit = 0.95            // fraction of R beyond which taps are REJECTED
unproject(tap, q, radius, center):        // → GeoPoint | null
  if radius <= 0: null
  x = (tap.x − center.x) / radius
  y = (center.y − tap.y) / radius        // screen-down → view-up
  r2 = x² + y²
  if r2 > 0.95²: null                     // the limb is ill-conditioned; refuse
  z = sqrt(1 − r2)                        // near hemisphere
  world = rotate(inverse(q), (x, y, z))
  return geoFromVec(world)
```

### 14.3 Orientation construction & gestures

**IMPORTANT vector_math quirks encoded in the signs** (a faithful port must reproduce the *behaviour*, not the library quirks): in vector_math, `Quaternion.rotated(v)` applies the **conjugate** rotation (`q̄·v·q`), i.e. `axisAngle(axis, θ).rotated(v)` turns `v` by **−θ** about `axis`; and composition satisfies `(a*b).rotated(v) == b.rotated(a.rotated(v))` (left operand runs first). With a standard `q·v·q⁻¹` quaternion library, flip the negations accordingly. The observable behaviours to preserve:

- `GlobeOrientation.fromLatLon({lat, lon, rollDeg=0})` — centres (lon,lat) on screen with **north up**:
  ```
  z  = worldVec(lon,lat)                    // toward camera (screen centre)
  up = (0,0,1) − z·z.z                      // world-north projected ⟂ z
  if |up|² < 1e-12:                          // centred on a pole
      up = (−cos lon, −sin lon, 0)           // stable fallback
  up = normalize(up)
  x  = normalize(up × z)                    // screen-right = up × forward
  R  = matrix with ROWS (x, up, z)          // view = R · world
  q  = quaternionFromRotationMatrix(R)
  if rollDeg ≠ 0: post-compose a roll of rollDeg about the view z-axis (clockwise on screen)
  ```
- `dragBy(dxPixels, dyPixels, radius)` — content **follows the finger** (Google-Earth style): horizontal drag = rotation about the **view-up** axis by angle `dx/radius` radians; vertical drag = rotation about the **view-right** axis by `dy/radius`; both view-space increments applied **after** the current orientation. Dragging right pulls the surface right; dragging down pulls it down.
- `autoRotate(deltaDeg)` — decorative spin about the globe's own **polar (world z) axis**: a world-space pre-rotation (applied **before** the view mapping).
- Quaternions are re-normalized on construction.

### 14.4 Viewport (`GlobeViewport`)

```
kGlobeFillFactor = 0.92
globeRadius(size, zoom) = min(size.w, size.h)/2 × 0.92 × zoom
globeCenter(size)       = (size.w/2, size.h/2)
```

- `zoom` clamp: **0.6 … 4.0**. Pinch: `zoom = clamp(zoomStart × gestureScale, 0.6, 4.0)`.
- One combined scale-gesture handler: `focalPointDelta` drives `dragBy`; `scale != 1` drives zoom. `interacting` flag suspends autorotation during a gesture.
- **Autorotation**: per-frame ticker; `orientation = orientation.autoRotate(degPerSec × dt)` where `degPerSec = doc.sphere.autoRotateDegPerSec` (0 disables). Gated OFF when reduce-motion is on (app setting `reduceAnimations` OR the OS `disableAnimations` — web: `prefers-reduced-motion`). Functional pan/zoom always works; only the decorative spin stops. After a gesture ends the tick clock resets (no spin jump after a long drag).
- **Initial orientation**: deep-linked zone → `fromLatLon` at that zone's centroid (grid zones use the cell center); else the document's `sphere.initialOrientation` (`lat/lon`, default 0/0). Deep-linked zone id also pre-selected post-frame.
- Orientation / zoom / selection / dimmed all live in ValueNotifiers the painter listens to — frames advance with **zero widget rebuilds** (web: rAF-driven redraw of one canvas).
- **Tap**: `geo = unproject(tap, orientation, radius, center)`.
  - Grid document: analytic O(1) pick — `geo == null` (off-disc/limb) → clear selection; else `cell = gridCellAt(geo)`, `id = gridZoneIdByCell[row*cols+col]` (may be null if no zone occupies that cell).
  - Non-grid: `id = sphereHitIndex.hitTest(geo)` (null geo → null).
  - Hit → selection haptic; selection state drives the highlight + `ZoneSheet` overlay (with tap-catcher to dismiss), identical to flat.

### 14.5 Render model (`buildSphereRender(doc)`) — built once per document

- `theme = doc.theme.sanitize()`; label font size = **26.0** (screen px; labels do NOT scale with zoom).
- Labels: same TextPainter recipe as flat (family theme.fontFamily, size 26, height 1.05, w600, color theme.label, center, 2 lines, ellipsis, maxWidth 26×12).
- **Placeholder-name rule**: `^Zone\s+\d+$` (trimmed) — authoring placeholders for unexplored grid cells. `isLabelWorthyGridZone(z) = z.themeOverride != null || (name non-empty && !placeholder)`.
- **Non-grid documents**: one `SphereRenderItem` per zone with spherical geometry:
  - sphericalPolygon → rings densified by `tessellateRing` (see 14.7);
  - sphericalCap → a single boundary ring: the circle of angular radius `radiusDeg` around `center`, sampled at **48** segments (`_kCapSegments`), constructed in the cap's tangent basis: `p(t) = c·cos r + (u·cos t + v·sin t)·sin r` where `u = normalize(c × ẑ)` (fallback `c × x̂` near poles), `v = normalize(c × u)`;
  - flat/unknown geometry → skipped.
  - `centroid` = normalized mean of the outline ring's world vectors (used for front-culling + label anchor). `label` if name non-empty.
- **Grid documents** (e.g. Venus 60×30 = 1800 cells, only ~46 explored): bodies are built ONLY for zones with a theme override (`hasBody`); labels only for label-worthy zones; a zone with neither is skipped entirely (graticule shows its cell). But **every** `gridPos` is recorded in `gridPosById` so picking/selection covers all cells. A grid doc may still carry hand-authored spherical shapes (explicit geometry wins for that zone). Body ring = `gridCellRing` (14.7). Centroid = `grid.cellCenter`.
- **Graticule** (grid docs): precomputed polylines — one meridian per column boundary (`cols` lines; the ±180 seam is one line), sampled from −89.5° to +89.5° every **4°** (`_kGraticuleStepDeg`); plus `rows − 1` interior parallels sampled every 4° of longitude closing at the seam.

### 14.6 GlobePainter — paint passes (in order)

Let `R = globeRadius(size, zoom)`, `C = center`, `theme` = map-level sanitized theme. Zone stroke width: `clamp(R × 0.012, 1.5, 6.0)`.

1. **Atmosphere** (under the disc, bleeds outward):
   - Halo ring: circle radius `1.035R`, stroke width `0.075R`, color `glow` α 0.16, gaussian blur σ `0.08R`.
   - Tighter ring: radius `1.012R`, stroke `0.028R`, `glow` α 0.22, blur σ `0.035R`.
2. **Disc** (radial-shaded sphere body, lit from upper-left):
   - `body = lerp(zoneFill, surface, 0.35)`; `lit = lerp(body, glow, 0.30)`; `dark = lerp(body, #000000, 0.72)`.
   - Radial gradient centred at alignment **(−0.42, −0.46)** (fractions of the disc rect; the fake light source), radius 1.30, colors `[lit, body, dark]`, stops `[0.0, 0.48, 1.0]`.
   - *(TEXTURE SEAM: an equirectangular texture sampler would slot in here — inverse-orientation lookup per pixel. MVP intentionally ships without one; zone/label passes are texture-agnostic.)*
3. `save` + **clip to the disc circle** (trims limb overflow):
   4. **Graticule** (grid docs): one path; per polyline, project each sample; back-hemisphere samples lift the pen (moveTo on the next front sample). Stroke width `clamp(R×0.0035, 0.6, 1.4)`, color `zoneStroke` α 0.14.
   5. **Zones**: for each item with a body (selected item deferred): cull if the **centroid** projects back-hemisphere; else build one even-odd path over all rings, projecting each vertex with **limb clamping** — a back-hemisphere vertex is clamped onto the limb circle along its screen direction (`center + dir·(R/|dir|)`) so straddling polygons keep a sane silhouette. Paint with `paintPolygonZone` (§13.3) at this globe stroke width, `selected:false`, dimmed via the 30 % saveLayer (bounds inflated `strokeWidth*4 + 8`).
   6. **Selected zone** drawn last/on top (`selected:true`; never dimmed — selection wins over filter). If the selected id has **no prebuilt body** (unexplored/label-only grid cell): densify its implicit `gridCellRing` on demand and paint it with the base theme as selected.
   7. **Limb darkening** over the zones: radial gradient on the disc — transparent to `0.62R`, then `background` α 0.55 at the rim (stops `[0, 0.62, 1.0]`, alphas `[0, 0, 0.55]`) — makes fills appear to curve away.
   `restore`.
8. **Rim** (over everything):
   - Neon rim: circle radius R, stroke `0.02R`, `glow` α 0.55, blur σ `0.03R`; plus crisp ring stroke `0.006R`, `glow` α 0.35.
   - Inner rim light: arc on radius `0.965R`, start angle `−3π/4 − 0.42π`, sweep `0.84π` (centred on the upper-left light), stroke `0.035R`, color `lerp(glow, #FFFFFF, 0.55)` α 0.18, blur σ `0.05R`.
9. **Labels** — only when `R ≥ 120` px (`_kLabelMinRadius`, LOD): per item with a label, project the centroid; skip if back-hemisphere or `|screen − C| > 0.82R` (limb crowding). Scrim RRect (same pad recipe as flat: padX `0.45·26`, padY `0.28·26`, radius `0.5·26`), fill `item.theme.background` α 0.72; then the glyphs centered at the projection. Dimmed labels via a 30 % saveLayer.

Repaint triggers: orientation / zoom / selection / dimmed notifiers (merged repaint listenable); the render model itself only changes with the document.

### 14.7 Sphere geometry algorithms (exact)

**tessellateRing(ring, maxSegmentDeg = 2.0)** — defensive densification (content CI pre-densifies; the app never tessellates polygons from scratch):
- Drop a trailing duplicate of the first vertex (rings are treated as implicitly closed; output is open).
- For each edge (a,b) (wrapping): emit `a`; if the angular separation `ω = acos(clamp(a·b,−1,1))` exceeds `2°` and `< π − 1e-9`, insert `n−1` intermediate points at fractions `k/n` (`n = ceil(ω/maxSeg)`) via **slerp**:
  `slerp(a,b,t,ω) = (a·sin((1−t)ω) + b·sin(tω)) / sin(ω)`, normalized (if `sin ω < 1e-9`, return a).

**pointInSphericalPolygon(point, rings)** — even-odd crossing test in lon/lat with local antimeridian unwrapping:
- Cast the meridian arc from the point **up to the north pole** and count edge crossings over all rings (holes come free via even-odd). Valid because pole-covering zones are always caps, never polygons ⇒ a polygon never contains the pole (the "outside" reference).
- Rings are `tessellateRing`-densified first so the linear per-edge test tracks the great-circle arc.
- Per edge a→b (ring closed, <3 vertices ⇒ 0 crossings):
  ```
  wrap180(d) = d − 360·round(d/360)                  // into (−180, 180]
  lonB = a.lon + wrap180(b.lon − a.lon)              // unwrap around a (edges span <180° post-densify)
  lonQ = a.lon + wrap180(q.lon − a.lon)
  if (a.lon > lonQ) == (lonB > lonQ): no crossing    // half-open span (shared vertex counted once)
  t = (lonQ − a.lon) / (lonB − a.lon)
  latCross = a.lat + t·(b.lat − a.lat)
  crossing iff latCross > q.lat
  ```
- Inside iff total crossings is odd.

**pointInSphericalCap(point, center, radiusDeg)**: `acos(clamp(worldVec(p)·worldVec(c),−1,1)) <= radiusDeg·π/180 + 1e-9` (inclusive, fp-tolerant; pole-safe).

**gridCellRing(col,row,cols,rows, maxLonStepDeg = 3.0)** — implicit quad boundary of a grid cell:
- Bounds as in §6.7 (lat clamped ±89.5).
- The two constant-latitude edges are **small circles** — they must be *sampled*, not slerped: subdivide the cell's longitude span into `n = max(1, ceil(lonStep/3°))` steps. The meridian edges are great circles (2 endpoints suffice).
- Emit: south edge west→east (`n+1` points), then north edge east→west (`n+1` points); the east/west meridians are the implicit connections. Ring is open.

**gridCellAt(point, cols, rows)** — O(1) analytic pick (never polygon tests):
```
col = clamp(floor((lon + 180) / (360/cols)), 0, cols−1)
row = clamp(floor((90 − lat) / (180/rows)), 0, rows−1)
```

### 14.8 SphereHitIndex (non-grid picking)

Built from zones in draw order; iterate reversed so the **topmost wins**, matching the painter. Indexed shapes: sphericalPolygon (first ring ≥ 3 vertices; `contains` = pointInSphericalPolygon) and sphericalCap (radiusDeg > 0). Flat/marker/unknown/grid zones are never indexed (grid picking is analytic in the viewport). `hitTest(null) = null` (rejected limb/off-disc taps pass through).

---

## 15. Grid table view

`MapGridView` — the "text map" twin of a grid-sphere globe (like the community spreadsheet). Same architecture as the flat viewport: `InteractiveViewer` over a synthetic canvas, layered painters, shared selection provider (selection survives toggling globe⇄grid).

Constants:

```
kGridCellWidth  = 96.0   // canvas px
kGridCellHeight = 64.0
nameFontSize    = 13.0
numFontSize     = 10.0
minNameScreenPx = 12.0   → nameLodScale = 12/13
dimAlpha        = 0.30
```

Canvas size = `cols×96 × rows×64`. Cells built for every zone with a valid in-range `gridPos`:

- `explored = zone.themeOverride != null`.
- `numPainter` (if `cellNum != null`): text `'{cellNum}'`, size 10, height 1.1, w600, color `theme.label` α 0.55, 1 line, maxWidth `96−8`, family = base theme font.
- `namePainter` (if name non-empty and NOT `^Zone\s+\d+$`): size 13, color `theme.label`, 2 lines ellipsis, maxWidth `96−12`.

Painters:

1. **Table** (repaints on name-LOD / dimmed changes):
   - Cell fills: explored → `cell.theme.zoneFill` α 0.42 (dimmed: `0.42×0.30`); unexplored → map `zoneFill` α 0.08 (dimmed: `0.08×0.30`). (Dim by direct alpha math, not layers — flat colors make it equivalent and cheap.)
   - Grid lines: one path of all `cols+1` verticals + `rows+1` horizontals, stroke 1.0, `zoneStroke` α 0.18.
   - Texts: normal cells directly; ALL dimmed cells' texts through one shared 30 % saveLayer (never a layer per cell). Cell number pinned top-left at `rect.topLeft + (4, 3)`. Name (only when `scale ≥ nameLodScale`) centered, shifted down by `numFontSize·0.35`, behind a scrim RRect (padX `13·0.35`, padY `13·0.2`, radius `13·0.4`, fill `cell.theme.background` α 0.72).
2. **Selection**: `paintPolygonZone(rectPath(cell.rect), cell.theme, strokeWidth: 2.5, selected: true)` — same visual system as the globe.

Viewport: identical config to flat (`minScale = fit`, `maxScale = max(8, fit)`, boundaryMargin `max(vw,vh)`, fit-centered initial transform). Deep-linked cell: `scale = clamp(max(nameLodScale·1.1, fit), fit, max(8, fit))` centered on the cell (frame it name-readable). Tap: `col = floor(x/96)`, `row = floor(y/64)` (clamped); id from `zoneIdByCell[row*cols+col]`; hit → haptic + select; miss → clear. Selected cell opens the shared `ZoneSheet`.

---

## 16. Zone sheet and friends

### 16.1 ZoneSheet

The single zone-detail surface used by ALL entry points (flat/globe/grid canvas overlays, zone list, notes list). Two hosting modes: inside the canvas it's an inline `DraggableScrollableSheet` overlay; from lists it's a modal bottom sheet.

- DraggableScrollableSheet: `initialChildSize 0.42, min 0.22, max 0.9, expand:false, snap:true, snapSizes [0.42, 0.9]`.
- Surface: fill `theme.surface`; top corners radius 22; top border `zoneStroke` α 0.35; box-shadow `glow` α 0.18, blur 24, offset (0, −6); content clipped to the rounded shape.
- Publishes the zone's resolved `MapTheme` via an inherited `MapThemeScope` (fields renderer reads it; default fallback `MapTheme.defaults`).
- Body (ListView, padding LTRB 16, 8, 16, 24):
  1. Drag handle: centered 40×4, radius 2, `label` α 0.25, bottom margin 12.
  2. Header row: zone name (title style 22/600, family = theme.fontFamily, color theme.label, expanded) + `FavoriteButton(kind: mapZone, id: '{mapId}/{zoneId}', activeColor: theme.accent)` + share `IconButton` (`Icons.ios_share` 20 px theme.accent, tooltip `Share zone`) + close `IconButton` (`Icons.close_rounded`, label α 0.7, tooltip `Close`) when hosted with an onClose.
  3. **Pin section** (`_PinSection`): full-width container, fill bgGlass, radius 8, border = `theme.accent` α 0.5 when a note exists else borderSubtle; leading icon `Icons.push_pin` (accent) / `Icons.push_pin_outlined` (label α 0.5); content: with note → label `MY NOTE` (mono 10/600 letter-spacing 1.5 accent) + note text (body, theme.label, height 1.4); without → `Add note / pin` (body, label α 0.75); trailing `Icons.edit_outlined` / `Icons.add` 18 px label α 0.6. Tap → `MapPinEditor.show(...)`. Semantics: "Edit your note for this zone" / "Add a note to this zone". Live pin via `zonePinProvider(MapZoneRef(mapId, zoneId))`.
  4. `ZoneFieldsRenderer(fieldsSchema, zone.fields)`.

**Share flow**: tap haptic → `ShareCardCapture.share` renders `MapZoneShareCard` off-screen at width **380** and pixelRatio **3.0** (text scaling pinned to 1.0 so system font size can't clip the PNG), waits two frames, snapshots to PNG, opens the OS share sheet with `fileName 'underdeck-zone-{mapId}-{zoneId}.png'` and `text 'Underdeck map · {zoneName}'` (iPad anchor rect passed). Failure → a share-failure snackbar helper.

### 16.2 ZoneFieldsRenderer

Renders `zone.fields` strictly in `fieldsSchema` order (order/type/style come from content, never hard-coded). A field absent from `fields` or with a non-renderable value is skipped; blocks are separated by 16 px. Each block: label UPPERCASED (caption style, `theme.label` α 0.55, letter-spacing 1.1, size 11) + 4 px + value widget.

| Type | Presentation |
|---|---|
| `enum` | tinted badge: padding 10×5, fill `theme.accent` α 0.15, radius 20, border accent α 0.5; text family theme.fontFamily 12/600 accent |
| `number` | mono text `'{value}'` or `'{value} {unit}'`, color theme.label |
| `stringList` | bulleted list: 5×5 accent circle at top 6, right gap 8; item text body theme.label; 4 px between items |
| `longText` | body paragraph, theme.label, line-height 1.4 |
| `text` | single-line body, theme.label |
| `link` | left-aligned `NeonButton(title: spec.label, icon: open_in_new_rounded)` → `resolveLink(context, url)` (internal `underdeck://` → in-app route; external → allow-listed launcher) |
| `unknown` | must-ignore: scalar → plain body text; structured → nothing |

Scalar coercion: string (empty → null), num/bool → toString, everything else → null. String list: list items coerced likewise, non-scalars dropped.

### 16.3 MapPinEditor

Modal bottom sheet on top of the zone sheet, tinted by the zone theme (surface fill, top radius 22, top border zoneStroke α 0.35). Keyboard-avoiding (bottom inset padding).

- Header: `Icons.push_pin_outlined` 18 px accent; title `Note · {zoneName}` (headline, theme font/label, 1-line ellipsis); `Cancel` text button (body, textSecondary).
- TextField: autofocus, minLines 3, maxLines 8, **maxLength 20 000** (counter hidden; matches the note import cap so round-trips never truncate), sentence capitalization, text body theme.label; hint `Your note for this zone…` (label α 0.4); fill bgGlass; padding 12; radius 8; borders borderSubtle / focused = theme.accent.
- `Save` FilledButton (right-aligned): bg theme.accent, fg `#03060B`, disabled bg accent α 0.25; **enabled only when dirty** (text ≠ initial).
- Unsaved-changes guard (PopScope): attempting to close while dirty shows an AlertDialog (bg bgElevated): title `Discard changes?` (headline), content `You have unsaved changes.` (body), actions `Keep editing` (textSecondary) / `Discard` (accentDanger).
- Save: `savePin(mapId, zoneId, note)` — **trimmed empty note ⇒ delete the pin**; else create (uuid v4, createdAt=updatedAt=now) or update in place (one pin per (mapId, zoneId)). Success → medium-impact haptic + pop. Error → logged + snackbar `friendlyError(e, fallback: "Couldn't save — please try again.")` (sheet stays open).

### 16.4 MapZoneShareCard (380 px wide export card)

Container padding 16; fill `theme.background` + top-left→bottom-right gradient `accent α 0.10 → transparent`; 1 px border `zoneStroke` α 0.5. Content (game data only — never the personal note, no PII):

1. `UNDERDECK · MAP` — mono 11/700 letter-spacing 2, accent.
2. Map title — caption, label α 0.7.
3. 1 px divider `zoneStroke` α 0.4 (12 px margins).
4. Zone name — headline, theme.fontFamily, label.
5. Up to **5** field rows: schema order; `longText` and `link` types skipped (too verbose); empty values skipped; lists joined `', '`; numbers get `' {unit}'`. Row: label at fixed width 110 (caption, label α 0.55) + value (mono 13/600, label); 2 px vertical padding.
6. Divider; footer row: `Icons.map_outlined` 9 px label α 0.5 + `Generated by Underdeck · Interactive maps` (mono 9, label α 0.5).

---

## 17. Settings integration

Card "Interactive maps" in Settings (`SectionHeader` icon `Icons.map`):

1. Toggle `Download interactive maps` — subtitle `Fetch new and updated maps from GitHub (Pages/Fastly + jsDelivr), at most once a day. Off keeps only what is already on your device.` → `settings.mapsNetworkEnabled` (default ON).
2. Toggle `Auto-update maps` — subtitle `Automatically check for newer map content in the background. Turn off to update only when you choose.` → `settings.mapsAutoUpdate` (default ON); **disabled** while the master switch is off.
3. Info line `Installed version: {version|'none'}` (value in mono, accentSecondary).
4. Row `Downloaded maps: {size}` + bordered `Clear` button (border accentDanger α 0.5, radius 8, padding 12×8, text body accentDanger). Size shown as `…` while loading.
   - Byte formatting: `none` for ≤0; units B/KB/MB/GB ÷1024; 1 decimal below 10 in units > B, else 0 decimals (e.g. `3.4 MB`, `12 MB`).
   - Clear → confirm dialog (bg bgElevated): title `Clear downloaded maps?`, content `This frees up space by removing downloaded map content. The built-in sample map is restored, and maps re-download the next time you open them (if downloads are on).`, actions `Cancel` / `Clear` (accentDanger). On confirm: `clearAllContent()` → `resetMapSeedImportGuard` → invalidate store-size, installed-version, manifest, seed providers. Failure → snackbar `Could not clear maps. Try again.`

---

## 18. State management

Riverpod graph (web: React Query / Zustand equivalents):

| Provider | Kind | Purpose / invalidation |
|---|---|---|
| `mapBlobStoreProvider` | Future | resolves the blob dir |
| `mapFetcherProvider` | plain | Dio wrapper |
| `mapContentRepositoryProvider` | Future | repo façade |
| `mapsManifestProvider` | Future<MapsManifest?> | installed manifest; invalidated at gallery/home entry & after seed/clear |
| `mapDocumentProvider(mapId)` | Future.family | one doc; invalidated at detail entry |
| `mapBackgroundBytesProvider(mapId)` | Future.family<Uint8List?> | raw `background` asset bytes from the store (render layer decodes constrained) |
| `mapsStoreSizeProvider` | Future<int> | Settings size; returns 0 on error |
| `mapsInstalledVersionProvider` | Future<String?> | Settings version line |
| `mapZoneSearchProvider(query)` | Future.autoDispose.family | FTS + manifest join (§11.4) |
| `mapSeedImporterProvider` / `mapSeedImportProvider` | Future | one-time seed import; invalidate = Retry |
| `mapPinsRepositoryProvider` | plain | pins CRUD |
| `mapPinsForMapProvider(mapId)` | Stream.family | live pins per map (updatedAt DESC) |
| `allMapPinsProvider` | Stream | live pins across all maps |
| `zonePinProvider(MapZoneRef(mapId,zoneId))` | Stream.family | the single pin of one zone |
| `pinnedZoneIdsProvider(mapId)` | Stream.family<Set<String>> | pin indicators |
| `selectedZoneProvider(mapId)` | StateProvider.autoDispose.family<String?> | current selection; auto-dropped when the screen closes; keyed per map |

Loading/error/empty state rules are specified per view in §12. Search debounce: 280 ms, cancel-on-retype (Timer reset). The globe's per-frame state (orientation/zoom) deliberately bypasses widget state — port as refs + requestAnimationFrame.

---

## 19. Platform features & web equivalents

| Feature (Flutter) | Where used | Web equivalent |
|---|---|---|
| `path_provider` app-support dir + `dart:io` files | blob store | **OPFS** (preferred) or IndexedDB keyed by sha256; atomic-enough via IDB transactions |
| Drift/SQLite + **FTS5** (`unicode61 remove_diacritics 2`, bm25 rank) | pack index, pins, zone search | wa-sqlite/sql.js WASM with FTS5, or reimplement search with MiniSearch/FlexSearch (must keep: diacritic-insensitive, AND terms, last-term prefix, relevance order, limit 50) |
| SharedPreferences | ETag, throttle, seed guard, settings | `localStorage` |
| Dio streaming GET with byte cap + ETag/If-None-Match + 2-retry backoff | fetcher | `fetch` + `ReadableStream` reader (abort past cap via AbortController), manual `If-None-Match` header, manual retry with 500/1500 ms backoff. **CORS**: GitHub Pages/raw/jsDelivr all send `Access-Control-Allow-Origin: *` — OK from a browser |
| `crypto` sha256 | integrity | `crypto.subtle.digest('SHA-256', …)` |
| `compute` isolate (hash ≥ 256 KB) | seed import | Web Worker (or accept main-thread for the small seed) |
| `share_plus` + off-screen PNG capture | zone share card | render the card to a hidden DOM node → `html2canvas`/OffscreenCanvas → `navigator.share({files})` with download-`<a>` fallback; keep filename & text patterns |
| Haptics (selection/tap/success) | taps, saves | `navigator.vibrate(10)` where supported, else **drop** (keep the setting no-op) |
| `HapticFeedback`, reduce-motion (`disableAnimationsOf`) | autorotation gate | `matchMedia('(prefers-reduced-motion: reduce)')` + the in-app setting |
| `InteractiveViewer` pan/zoom | flat & grid viewers | custom pointer-events pan/pinch + wheel-zoom (or `d3-zoom`/`panzoom`); preserve minScale=fit, maxScale=max(8,fit), transform-not-repaint layering |
| `Ticker` per-frame autorotate | globe | `requestAnimationFrame` with dt from timestamps |
| `ui.instantiateImageCodec(targetWidth)` constrained decode | background, thumbnails | `createImageBitmap(blob, {resizeWidth})` |
| `RepaintBoundary` layers | flat/grid viewers | stacked `<canvas>` elements (background/zones/selection/labels) inside one CSS-transformed container |
| Material icons | throughout | Material Symbols font or inline SVGs (names listed per view) |
| `url_launcher` (via allow-listed `launchExternal`) | zone `link` fields | `window.open(url, '_blank', 'noopener')` restricted to http(s)/mailto |
| go_router deep links | routes | react-router; GH Pages SPA fallback for `/knowledge/maps/:id?zone=` |
| App-store binary signature (seed trust) | seed import | moot on web — treat bundled seed JSON as same-origin static assets; still hash them locally to feed the content-addressed store |
| `AlertDialog` / modal bottom sheets / DraggableScrollableSheet | dialogs, zone sheet, how-it-works | custom modal + a draggable bottom-sheet component (keep snap sizes 0.42/0.9) |

---

## 20. Assets inventory

Declared under `pubspec.yaml` → `assets/maps_seed/` (whole dir) plus one reused KB image:

| File | Role |
|---|---|
| `assets/maps_seed/manifest.json` | bundled seed manifest — `schemaVersion 1`, `contentVersion "0-seed-2"`, `minAppVersion "0.1.0"`, `cdnBase "asset:///seed"`; sha256/bytes fields are `0000…`/0 **placeholders** patched at import time |
| `assets/maps_seed/hideous-dungeon.map.json` | flat sample: canvas 2448×3264, 3 field specs (threat enum filterable/searchable, loot stringList searchable, notes longText), 4 zones (3 polygons — one with a hole ring — + 1 marker with hitRadius 90); themed `#05070D/#101B2E/#1E3A55/#4FC3FF/#7AE3FF/#7AE3FF/#E8F4FF/#FFB347/Inter`; two zones carry restricted themeOverrides (`z-flooded-crypt`: fill `#3A1E2E`, stroke/glow `#FF5577`; `z-treasure-cache`: glow `#FFB347`) |
| `assets/maps_seed/keth-9.map.json` | sphere sample: `initialOrientation lat 8, lon 0`, `autoRotateDegPerSec 3.0`; theme `#03060B/#08221B/#0E3A2E/#5FE8A0/#1C6A50/#5FE8A0/#EAFFF6/#FFB347/JetBrainsMono`; fields: faction enum (Ferrous Pact/Rustwinds/Neutral, searchable+filterable), gravity number unit `g`, brief longText searchable; 4 sphericalPolygons + 1 sphericalCap (`center [0,90], radiusDeg 20` — polar zone) |
| `assets/maps_seed/io.map.json` | grid-sphere: `grid 17×10` (170 zones, all explored w/ per-region tinted overrides), `autoRotateDegPerSec 1.5`, initial lat 12/lon 0; theme sulfur-yellow (`#070502/#201607/#C9B24A/#F0E08A/#FFE87A/#FFD966/#FFF8DC/#FF8C3A/JetBrainsMono`); fields: region enum (17 options, style `badge`, searchable+filterable), coordinates text |
| `assets/maps_seed/venus.map.json` | grid-sphere: `grid 60×30` (1800 zones; ~46 explored with overrides + `look`/`firstSeen` fields, rest `Zone N` placeholders), `autoRotateDegPerSec 1.2`, initial lat 45/lon 147; theme `#0A0705/#1C130B/#C9A25E/#F0DCAE/#F5DFA8/#F5D08C/#FFF4E0/#FFB347/JetBrainsMono`; fields: status enum (Explored/Uncharted, filterable, NOT searchable), coordinates text, look longText searchable ("Survey log"), firstSeen text |
| `assets/knowledge/images/hideous-dungeon-map.jpg` | the flat map's `background` asset (kind `background`, pixelSize `[2448, 3264]`) — reused from the KB images, not duplicated |
| `assets/fonts/Inter-Variable.ttf`, `JetBrainsMono-Variable.ttf`, `Quicksand-Variable.ttf` | the three whitelisted families |

Seed docs' `_comment` keys are ignored by the parser (unknown JSON keys are simply not read).

---

## 21. Copy-string inventory

(Exact strings; those already embedded above are repeated here for quick lookup.)

**Gallery**: `Interactive maps` · tooltip `How interactive maps work` · `Search zones across maps` · tooltip `Clear search` · `No zones match “{query}”.` · `Couldn't load maps.` · `Couldn't run that search.` · banner `New maps ready` / `Updated map content was downloaded and will appear the next time you open Interactive maps.` · banner `Update Underdeck` / `Newer map content is available but needs a newer version of Underdeck. Update the app to get it.` · `What's new` · tooltip `Dismiss` · empty `No maps yet` / `Interactive maps will appear here once they are installed.` · seed-fail `Storage full` / `Offline maps could not be set up because storage is full. Free up some space and try again.` · `Couldn't set up maps` / `The offline map set could not be prepared.` · `Retry`.

**Home section**: `INTERACTIVE MAPS` · `View all` · `See all maps ({n} more)` · `Interactive maps` (fail card) · `Couldn't set up offline maps.` · `Storage is full, so offline maps could not be set up. Free up some space and try again.` · `Retry` · semantics `Interactive maps, {n} available. Open gallery` / `See all maps, {n} more`.

**Gallery card**: `DRAFT` · semantics `{title}, draft`.

**Detail**: fallback title `Map` · tooltips `My map notes`, `Globe view`, `Grid view`, `List of zones` · panes: `Couldn't open this map`/`The map failed to load.` · `Draft map`/`This map is still a draft and is not available to open yet. It will unlock in a future content update.` · `Map not found`/`This map is no longer available. It may have been removed in a content update. Go back to the gallery to see current maps.` · `Update required`/`This map needs a newer version of Underdeck to open. Update the app from your app store to view it.` · `Update required`/`This map needs a newer app version to display.` · `Update required`/`This globe needs a newer app version to display.` · `Update required`/`This map uses a format this app version does not understand yet. Update the app to view it.` · semantics strings in §12.5.

**Zone list**: `Zones · {title}` · tooltips `Sort Z to A` / `Sort A to Z` · `Search zones` · `{n} zone(s)` · `No zones match.` · kinds `Region`/`Marker`/`Area`/`Unavailable`.

**Notes list**: `My notes · {title}` · `Couldn't load your notes.` · `{n} note(s)` · `No notes yet. Open a zone and tap "Add note / pin".` · tooltip `Delete note` · semantics `Note on {zoneName}`.

**Zone sheet**: tooltips `Share zone`, `Close` · `MY NOTE` · `Add note / pin` · semantics `Edit your note for this zone` / `Add a note to this zone` · share text `Underdeck map · {zoneName}` · share file `underdeck-zone-{mapId}-{zoneId}.png`.

**Pin editor**: `Note · {zoneName}` · `Cancel` · `Your note for this zone…` · `Save` · `Discard changes?` · `You have unsaved changes.` · `Keep editing` · `Discard` · `Couldn't save — please try again.`

**Share card**: `UNDERDECK · MAP` · `Generated by Underdeck · Interactive maps`.

**Settings**: `Interactive maps` · `Download interactive maps` (+subtitle) · `Auto-update maps` (+subtitle) · `Installed version` · `Downloaded maps` · `Clear` · `Clear downloaded maps?` (+content) · `Cancel` · `Could not clear maps. Try again.`

**How it works**: full text in §12.4.

---

## 22. Open questions

1. **ed25519 pointer signature** — documented as an intentional seam, not implemented. The web port should keep the seam (a `verifyPointerSignature` hook before any sha256 checks) but must not invent the key ceremony.
2. **`MapPacks.state`** supports `'downloading'`/`'failed'` but only `'installed'` is ever written — port as a single-state column or drop the enum.
3. **`ZoneFieldSpec.style`** (`'badge'` in seed data) is parsed and capped (≤32 chars) but no renderer reads it today — reserved hint.
4. **Sphere texture rendering** — `sphere.textureAsset` and the `'texture'` asset kind exist in the schema (with pre-decode pixelSize gating), but the MVP globe is deliberately texture-less (stylized neon). The painter documents the seam (sample an equirectangular texture into the disc via inverse-orientation lookup). Whether the web build should implement the texture path (easy in WebGL) or match the MVP is a product decision.
5. **`background_hd` asset kind** is in `renderedImageKinds` (validation) but no code loads it — presumably a future high-zoom background tier.
6. **`MapRef` cross-links** ("View on map" from jobs/fishing) are parse-ready but no shipped content uses them; the rendering affordance lives in the other modules.
7. **Draft maps in the gallery**: descriptors with `draft:true` are listed (with the DRAFT badge) but their documents are never installed, so opening one lands on the "Draft map" pane. Confirm the web app should keep listing drafts rather than hiding them.
8. **Grid-mode toggle state** (`_gridMode`) is per-screen-instance and not persisted, and the deep-link initial transform runs once per mount; toggling globe→grid after entry re-centers the grid on the deep-linked zone only if it was the initial one. Match or improve.
9. **Web storage quota** — the ENOSPC (`errorCode 28`) disk-full detection maps loosely to `QuotaExceededError` on the web; the "Storage full" empty-state copy should key off that.
10. **App version for the minAppVersion gate** on web: the Flutter build reads its own package version (fallback `0.2.0`); the web app needs an equivalent build-injected version string.

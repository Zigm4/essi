# Underdeck — Spec: Local/Offline Tools ("tools-local")

Target: recode from scratch as a plain web app (Vite + React + TypeScript, GitHub Pages).
Source: Flutter app `underdeck-app` (companion app for the game Underpunks55).
Scope of this document — the five fully-offline tools plus their catalog data:

| Tool | Route | Entry view (Flutter) |
|---|---|---|
| Jobs browser | `/tools/jobs` | `lib/features/tools/jobs/views/jobs_view.dart` |
| Fishing map | `/tools/fishing` and `/tools/fishing/:roomId` | `lib/features/tools/fishing/views/fishing_map_view.dart` |
| Mars Express (train) | `/tools/mars-express` | `lib/features/tools/train/views/mars_express_view.dart` |
| Wallet lookup | `/tools/wallet` (optional `?q=`) | `lib/features/tools/wallet/views/wallet_lookup_view.dart` |
| Asteroid analyzer | `/tools/asteroid` | `lib/features/tools/asteroid/views/asteroid_analyzer_view.dart` |

All five tools are reached from the "Tools" home screen (`/tools`, a list of `ToolCard`s). The relevant entries there (title / subtitle / Material icon / tint):

- **Asteroid Analyzer** — "Decode 9-digit asteroid IDs" — `fingerprint` — accentPrimary
- **Fishing Map** — "96 zones + 4 map rooms, depths & poles" — `set_meal_outlined` — accentSecondary
- **Mars Express** — "Live schedule + zone alerts" — `tram_outlined` — accentWarn
- **Wallet Lookup** — "Find a wallet from a name, or vice versa" — `wallet` — accentSuccess
- **Jobs** — "Search 371 jobs by faction, reward, skill, location" — `work_outline` — accentSecondary

Navigation model: go_router with a bottom-tab shell; the tools above are pushed onto the "tools" tab stack. Each tool screen has a system back affordance (AppBar back arrow tinted `accentPrimary`, except Jobs which draws its own back button — see §3.3).

---

## 1. Shared design system (needed to render these screens faithfully)

### 1.1 Colors (`lib/design_system/colors.dart`)

| Token | Value |
|---|---|
| `bgDeepest` | `#03060B` (page background) |
| `bgElevated` | `#0A1220` (bottom sheets) |
| `bgGlass` | `#0F1C30` at 55% alpha (chips, inputs) |
| `bgCard` | `#111E30` (opaque card fill) |
| `accentPrimary` | `#4FC3FF` |
| `accentSecondary` | `#7AE3FF` |
| `accentDanger` | `#FF5577` |
| `accentWarn` | `#FFB347` |
| `accentSuccess` | `#5FE8A0` |
| `textPrimary` | `#E8F4FF` |
| `textSecondary` | `#8AA4C2` |
| `textDim` | `#6E8AAB` |
| `borderSubtle` | `#7AE3FF` at 12% alpha |
| `borderGlow` | `#4FC3FF` at 45% alpha |

### 1.2 Typography (`lib/design_system/typography.dart`)

Bundled font families (no network fetch — for web, self-host WOFF2):
- Sans: **Inter**
- Mono: **JetBrains Mono**
- Rounded: **Quicksand** (not used in this area)

Named styles (family / size / weight / color):
- `title` — Inter 22 / 600 / textPrimary
- `headline` — Inter 17 / 600 / textPrimary
- `body` — Inter 15 / 400 / textPrimary
- `caption` — Inter 12 / 500 / textSecondary
- `mono` — JetBrainsMono 14 / 400 / textPrimary
- `terminal` — JetBrainsMono 13 / 500 / accentPrimary

Screens frequently override `mono` down to 9–13px with letter-spacing (specified per widget below).

### 1.3 Spacing & radii (`lib/design_system/spacing.dart`)

`AppSpacing`: xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48 (px).
`AppRadius`: sm 8, md 14, lg 22 (px).

### 1.4 Shared components used by this area

**AppBackground** — every screen: base fill `bgDeepest`; radial gradient centered top-left (alignment (-1,-1), radius 1.2) from `accentPrimary` @10% to transparent; a hex-grid pattern overlay at 6% opacity; a scanlines overlay at 55% opacity drawn *over* content (pointer-events: none). Tapping empty background dismisses the keyboard/focus.

**GlassCard** — the standard card: fill `bgCard`, 1px border `borderSubtle`, radius 14 (`AppRadius.md`), default padding 12. Optional glow (box-shadow `accentPrimary` @18%, blur 14) — not used in this area. No backdrop blur by default.

**TransmissionHeader** — opaque banner strip: background `bgDeepest`, horizontal padding 12, vertical 6, 1px bottom border `borderSubtle`. Left: a 6px pulsing dot (`accentSuccess`, opacity oscillates 1.0↔0.35 every 800ms, ease-in-out). Then the label uppercased in mono 10 / 600 / letter-spacing 2 / `accentPrimary`, ellipsized. Right: a fake "sector code" text `ESSI//NNN` in mono 10 / 500 / `textDim`, where NNN = `100 + ((randomSeed + floor(scrollOffsetPx / 4)) % 900)` — i.e. it counts up as the page scrolls (pure decoration; a per-mount random seed). Optional trailing action icons.

**SectionHeader** — optional 18px icon in `accentPrimary` + title uppercased in mono 12 / 600 / letter-spacing 2 / `accentPrimary`; optional caption subtitle underneath.

**NeonButton** — primary CTA: min-height 50, radius 14, horizontal gradient `accentPrimary→accentSecondary` (danger variant: `accentDanger→accentWarn`), 1px border `borderGlow`, box-shadow tint @45% blur 14. Content centered: optional 18px icon + label, both in `bgDeepest` color, label 16 / 600. Press animation: scale to 0.97 over 200ms ease-out. Disabled: whole button at 40% opacity, no interaction.

**TerminalNotes** — terminal-style notes card (GlassCard): header row `> {title}` in `terminal` style + right-aligned 6px `accentSuccess` dot; 1px divider (`borderSubtle` @40%); then each line as `[01]`-indexed rows: index in mono 11 / 600 / `accentPrimary` (28px column), text in body/`textSecondary`; final row `[NN]` (next index, index color at 55% alpha) followed by a blinking `▋` cursor (opacity animates 0↔1, 600ms, ease-in-out, reverse repeat).

**PageScrollView** — scroll container that (a) broadcasts scroll offset (drives TransmissionHeader counter), (b) shows a floating back-to-top button once scrolled more than one viewport height: 44px circle, `bgDeepest` fill, 1px border `accentPrimary`@60%, glow `accentPrimary`@40% blur 10, `arrow_upward` icon 22 `accentPrimary`, bottom/right 16px; appears/disappears with a 200ms scale+fade.

**FavoriteButton** — star toggle: `star_border_rounded` (inactive, `textDim`) ↔ `star_rounded` (active, `accentWarn`), icon-button hit area min 36×36. Tooltip "Favorite" (or per-call override) / "Remove favorite" when active. On tap: toggles the favorite in the DB; on failure shows snackbar "Couldn't update favorite.". Persisted in the `Favorites` table (see §1.5).

**Bottom sheets** — modal sheets slide up over a transparent barrier; content container `bgElevated` with top corners rounded (radius 20 or 22 per screen), a centered drag-handle bar 36×4 (`textDim` or `borderSubtle`, radius 2). Draggable/resizable between the fractions listed per sheet. On the web: a fixed-position dialog/sheet with these snap heights, or simply max-height panels; drag-resize optional.

**Error display convention** — every async loader shows a centered `CircularProgressIndicator` while loading; on error a centered message in body style colored `accentDanger`. Error text comes from `friendlyError(e, fallback)` which maps network errors to friendly copy and otherwise returns the screen-specific fallback (never the raw exception). Fallbacks used in this area:
- Jobs: `"Couldn't load jobs."`
- Fishing: `"Couldn't load the fishing data."`
- Train: `"Couldn't load the schedule."`
- Wallet: `"Couldn't load wallet data."`
- Asteroid: `"Couldn't load the asteroid tables."`

### 1.5 Shared persistence

Flutter uses Drift (SQLite) + SharedPreferences. Web equivalents: `localStorage`/IndexedDB.

**Favorites table** (`lib/data/database/tables/favorites_table.dart`):
```
Favorites { entityType: text, entityId: text, createdAt: datetime }  PK (entityType, entityId)
```
Kinds used in this area: `'job'` (id = job id stringified), `'fishing_zone'` (id = zone id stringified).

**JobStatus table**:
```
JobStatus { jobId: text PK, status: text ('in_progress'|'done'), updatedAt: datetime }
```
A job with no row is implicitly `todo`; setting a job back to `todo` **deletes** the row. Reads are reactive (drift `watch()`) — in React, any shared store (zustand/jotai/context) persisted to localStorage works.

**SharedPreferences keys** (train alerts, see §5.6):
- `trainAlert.zones` — JSON array of armed-zone entries.
- `trainAlert.armed` — legacy single-zone format, migrated then removed.
- `trainAlert.didLegacyCleanup` — bool, one-shot legacy notification-id sweep flag.

### 1.6 Shared services & platform features (web adaptation flags)

| Feature | Flutter impl | Where used | Web equivalent |
|---|---|---|---|
| Haptics | `HapticFeedback.*`, gated by a settings toggle | every tap/selection in this area | **Drop** (or `navigator.vibrate` on Android Chrome; purely decorative) |
| Share as PNG | `ShareCardCapture`: renders a fixed-width 380px widget off-screen, snapshots at 3× pixel ratio, writes temp PNG, `share_plus` OS share sheet | Job detail, fishing zone, wallet results | Render share-card DOM → canvas (e.g. `html-to-image`), then Web Share API Level 2 (`navigator.share({files})`) with download-`<a>` fallback. Failure snackbar copy: `"Couldn't create the share image — try again"` (red `accentDanger` background) |
| Clipboard | `Clipboard.setData` | Job detail "copy #ID" | `navigator.clipboard.writeText` |
| Local scheduled notifications | `flutter_local_notifications` (+timezone, Android exact alarms) | Mars Express alerts | **Needs redesign** — see §5.9 |
| Markdown rendering | `flutter_markdown_plus` | Job description / onComplete | any MD renderer (react-markdown); only bold `**…**` and inline code `` `…` ``/` ``…`` ` appear in the data |
| Asset bundling | `rootBundle.loadString('assets/catalog/…')` | all five tools | static JSON fetched from the site (or imported at build time) |
| Background parse isolate | `compute(parseJobsJson, raw)` for the 337KB jobs.json | Jobs | Web Worker, or just async parse (fine on desktop) |

---

## 2. Catalog assets (exact files consumed by this area)

- `assets/catalog/jobs.json` — 337,348 bytes, JSON array of **371** job objects (370 unique ids — id `30107301` appears twice; see Open Questions).
- `assets/catalog/fishing_zones.json` — 16,984 bytes, JSON array of **100** zone objects.
- `assets/catalog/train_schedule.json` — 4,046 bytes, JSON array of **60** stop objects (one per minute 0–59).
- `assets/catalog/wallets.json` — 93,164 bytes, JSON array of **769** owner objects, **785** wallet strings total. **GDPR-sensitive** — see §6.5.
- `assets/catalog/asteroid_tables.json` — 3,669 bytes, JSON object with 6 lookup tables (full contents reproduced in §7.2).

(Other files in `assets/catalog/` — `ship_catalog.json`, `ship_locations.json`, `tracked_objects.json` — belong to other areas and are NOT read by these tools.)

---

## 3. JOBS BROWSER (`/tools/jobs`)

### 3.1 Data model — `Job` (`domain/job.dart`)

`jobs.json` is an array of objects. Fields the app parses (everything else ignored):

| JSON key | Type | Nullable | Default | Model field |
|---|---|---|---|---|
| `id` | number | no | — | `id: int` |
| `factionRep` | string | yes | null | allied faction key, e.g. `"rep_proq"` |
| `factionRival` | string | yes | null | rival faction key |
| `requiredRep` | number | yes | 0 | `requiredRep: int` |
| `requiredSkill` | string | yes | null | e.g. `"stealth"` |
| `requiredSkillAmt` | number | yes | 0 | `requiredSkillAmt: int` |
| `requiredTag` | string | yes | null | e.g. `"NorthSquire"` |
| `type` | string | yes | `"???"` | stored twice: `typeRaw` (original casing, for display) and `type` (lowercased, canonical for filtering) |
| `risk` | number | yes | 0 | 0–14 in data |
| `bonus` | number | yes | 0 | −2740…500 in data; **11 jobs have negative bonus** |
| `pickupLocation` | object | no | — | `JobLocation` |
| `dropoffLocation` | object | no | — | `JobLocation` |
| `reward` | string | yes | `''` | canonicalised (below) |
| `rewardFunction` | string | yes | null | source of truth for reward canonicalisation |
| `allyFunction` | string | yes | null | displayed nowhere; kept in model |
| `rivalFunction` | string | yes | null | kept in model |
| `capacity` | number | yes | 0 | 0–5000 in data |
| `ship` | string | yes | null | one of `oort, prqc, ratr, solt, solv, sosm` |
| `description` | string | yes | `''` | markdown |
| `onComplete` | string | yes | `''` | markdown |
| `mapRef` | object | yes | null | `{mapId: string, zoneId?: string}` — **dormant**: current data carries none; when present, renders a "View on map" button linking to `underdeck://map/{mapId}?zone={zoneId}` (the dynamic-maps area) |

`JobLocation`: `{ astnum: int, zone: int, name?: string }` — a name that is empty/whitespace-only parses to null. Equality is by `(astnum, zone)` only (name ignored).
- `coordsLabel` = `"{astnum} · z{zone}"` (e.g. `355 · z35`)
- `label` = name == null ? coordsLabel : `"{name} ({astnum} · z{zone})"`

Derived flags:
- `isCargoJob` = `capacity > 0` (28 jobs)
- `isOnSite` = pickup == dropoff (same astnum+zone) (1 job)
- `hasRival` = `factionRival != null` (325 jobs)
- `isPlaceholderType` = `type == '???'` (8 jobs)

**Reward canonicalisation** (`Job._canonicalReward(raw, rewardFunction)`): first map by `rewardFunction`:

| rewardFunction | canonical reward |
|---|---|
| `addCoinAmt`, `addCarryCoinAmt` | `coin` |
| `addScrpAmt` | `scrap` |
| `addEnergyAmt` | `energy` |
| `addTitaniumAmt` | `titanium` |
| `addRocksAmt` | `rocks` |
| `addMalaAmt` | `mala` |
| `addWackoAmt` | `wackos` |
| `addMapDataAmt` | `data` |
| `addOilAmt` | `oil` |
| `addKryptonAmt` | `krypton` |
| `addStarTarAmt` | `star_tar` |
| `addStimnxAmt` | `stimnx` |
| `addSuppliesAmt` | `supplies` |
| `addTungstenAmt` | `wolfram` |
| `addUnobtainiumAmt` | `unobtainium` |
| `addGoldAmt` | `aurum` |

If the function is unknown/null, fall back to `raw.trim().toLowerCase()` with fixups: `scrp→scrap`, `enrgy→energy`, `nrg→energy`.

Raw `reward` values present in data: `DATA, NRG, WACKOS, aurum, coin, energy, enrgy, krypton, mala, rocks, scrap, scrp, star_tar, stimnx, supplies, titanium, unobtainium, wolfram`.

**Parsing rules** (`parseJobsJson`): the file must be a JSON array; each element must be an object; each row is parsed independently and **malformed rows are silently skipped** (one bad entry must not kill the tool). Parse runs off the UI thread (Flutter isolate → web: worker or async chunking; the ~337KB parse is fast enough on modern browsers to just do inline).

Additional JSON keys that exist in the data but are **ignored** by the app (do not model, but don't crash on them): `damage, followerKeyword, requiredAssetId, requiredAssetTemplate, requiredResource, requiredResourceAmt, resourceAdd, resourceAddAmt, resourceReceiverId, resourceRemoval, resourceRemovalAmt`.

**Sample entry** (first in file):
```json
{
  "id": 35511202,
  "factionRep": "rep_proq",
  "factionRival": null,
  "requiredRep": 0,
  "requiredSkill": "strength",
  "requiredSkillAmt": 0,
  "requiredTag": "NorthSquire",
  "type": "beginner",
  "risk": 1,
  "bonus": 0,
  "pickupLocation": { "astnum": 355, "zone": 35, "name": "Northshire" },
  "dropoffLocation": { "astnum": 355, "zone": 112, "name": "Queens Quarry" },
  "reward": "rocks",
  "rewardFunction": "addRocksAmt",
  "allyFunction": "addProqAmt",
  "rivalFunction": null,
  "capacity": 0,
  "ship": null,
  "description": "**PRQ BEGINNER STR** [gain STRENGTH]: Break rocks in the Queens Quarry into smaller, manageable stones.",
  "onComplete": "Standing in the dusty Quarry, where magical SHARDS can sometimes be unearthed using ``!work``, you feel a small surge of strength (STR + 0.001). ..."
}
```

Sample cargo job with rival + resource side-fields (kept only partially by the model):
```json
{
  "id": 30100701, "factionRep": "rep_proq", "factionRival": "rep_lycnx",
  "requiredSkill": "oil", "requiredSkillAmt": 100, "type": "report", "risk": 1, "bonus": 500,
  "pickupLocation": {"astnum": 355, "zone": 54, "name": "Imperious Falls (ratropia)"},
  "dropoffLocation": {"astnum": 301, "zone": 7, "name": "Luna Mesa Mart (shop)"},
  "reward": "coin", "rewardFunction": "addCarryCoinAmt", "capacity": 100, "ship": "prqc", ...
}
```

### 3.2 Taxonomies (`domain/job_taxonomies.dart`) — labels & tints

**Allied factions** (keys appear as `factionRep`):

| key | label | tint |
|---|---|---|
| `rep_chat` | Chattery | `#B377FF` |
| `rep_clst` | Celestyn | `#E6E6FF` |
| `rep_hex` | Hex | `#FF77AA` |
| `rep_king` | King | `#FFD15C` |
| `rep_lycnx` | Lycanox | `#9DDCFF` |
| `rep_mrtn` | Martian | `#FF7755` |
| `rep_mschf` | Mischief | `#FFC766` |
| `rep_pearl` | Pearl | `#FFE9A8` |
| `rep_proq` | Proquinox | `#9C9C9C` |
| `rep_rsa` | RSA | `#FF5577` |
| `rep_rts` | Rustwind | `#C58A4F` |
| `rep_rvnts` | Revenants | `#8B6FFF` |
| `rep_tfi` | TFI | `#5FE8A0` |
| `rep_uurt` | Uurt | `#3FBFA0` |
| `rep_zcorp` | Z-Corp | `#4FC3FF` |

**Rival-only factions** (appear only as `factionRival`):

| key | label | tint |
|---|---|---|
| `rep_55imp` | 55 Imperials | `#FF7777` |
| `rep_co8` | Co8 | `#8B7BFF` |
| `rep_mschn` | Mischen | `#FF8844` |
| `rep_oort` | Oortians | `#AACCFF` |
| `rep_qnxs` | Qnexus | `#66E0DD` |

Lookup covers both lists; an unknown key renders the raw key with a default tint.

**Tags** (`requiredTag` → label): `NorthSquire→North Squire`, `EastSquire→East Squire`, `WestSquire→West Squire`, `SouthSquire→South Squire`, `UpSquire→Up Squire`, `DownSquire→Down Squire`, `VERIFIED→Verified`. (Data actually contains only the six *Squire values; `VERIFIED` is defined but unused.)

**Skills** (key → tint): strength `#FF7755`, stealth `#8B6FFF`, knowledge `#4FC3FF`, fortitude `#FFB347`, panache `#FF77AA`, tech `#7AE3FF`, astro `#B377FF`, singing `#FFE9A8`, medicine `#5FE8A0`, magic `#E6E6FF`, leadership `#FFD15C`, corrupt `#FF5577`, carryCoin `#FFD15C`, stamina `#C58A4F`, wood `#8B6F47`, unobtainium `#B377FF`, oil `#3F4F6F`. Unknown skill → `accentSecondary`.

**Rewards** (canonical key → label, tint): coin `Coin #FFD15C`, rocks `Rocks #8AA4C2`, scrap `Scrap #C58A4F`, titanium `Titanium #9DDCFF`, energy `Energy #5FE8A0`, mala `Mala #B377FF`, wackos `Wackos #FF77AA`, data `Map Data #4FC3FF`, oil `Oil #3F4F6F`, krypton `Krypton #AACCFF`, star_tar `Star Tar #8B6FFF`, stimnx `Stimnx #FF5577`, supplies `Supplies #7AE3FF`, wolfram `Wolfram #9C9C9C`, unobtainium `Unobtainium #B377FF`, aurum `Aurum #FFE9A8`. Unknown key → label = key uppercased, tint = `textSecondary`.

**Type buckets** (used to group type chips in the filter sheet; matching is on the *lowercased* type):
- `Beginner`: beginner
- `Skill gain`: strength, stealth, knowledge, fortitude, panache, singing, medical, magic, manipulation, observation, corruption, cleaning, engineering, dock, comms, performance
- `Regular`: transport, navigation, aid, repair, maintenance, research, report, leadership, escort, sabotage, supply run, late shift, long distance recon, deliver cargo, teaching, science, puzzle, judge, hauler, compose, challenge, audition, salvage, tech salvage, vip transport
- `Expansion`: mrt expansion, lyc expansion, rsa expansion
- `Event`: rsa betrayal, martian war, king, king2prv, queen
- `Unknown`: ???
- anything else → bucket `Other`

Distinct raw `type` values in the shipped data (49): `???`, `Engineering`, `KING2PRV`, `LYC Expansion`, `MRT Expansion`, `Martian War`, `RSA Betrayal`, `RSA Expansion`, `Research`, `Salvage`, `Tech Salvage`, `VIP transport`, `aid`, `audition`, `beginner`, `challenge`, `cleaning`, `comms`, `compose`, `corruption`, `deliver cargo`, `dock`, `engineering`, `escort`, `fortitude`, `hauler`, `judge`, `late shift`, `leadership`, `long distance recon`, `magic`, `maintenance`, `manipulation`, `medical`, `navigation`, `observation`, `panache`, `performance`, `puzzle`, `repair`, `report`, `research`, `sabotage`, `science`, `singing`, `stealth`, `supply run`, `teaching`, `transport`.

### 3.3 Jobs list screen (`JobsView`)

Layout, top to bottom (all inside `AppBackground`, page bg `bgDeepest`, zero-height app bar):

1. **TransmissionHeader** — label `ESSI · Job Allocation Desk` (rendered uppercase). Trailing action: an `info_outline` icon (18px, `accentPrimary`) that opens the "About this dataset" sheet (§3.8).
2. **Search row** — padding LTRB (8, 8, 12, 4):
   - Back button: `arrow_back_ios_new` 20px `accentPrimary`, min 32×32, pops the route.
   - **Search field** (expands): container height 40, `bgGlass` fill, radius 14, 1px `borderSubtle`. Leading `search` icon 18 `accentPrimary`. Placeholder: `Search description, on-complete, or #ID` (caption style 12px). Input text 13px body. When non-empty, trailing `close` icon 16 `textDim` clears it. Enter key = "search" action (no-op besides keyboard). **No debounce** — filter state updates on every keystroke.
   - **Filters button**: pill (padding 12×9, radius 14). Idle: `bgGlass` fill, `borderSubtle` border, `tune` icon 16 + label `Filters` mono 11/700, both `textSecondary`. When ≥1 filter active: fill `accentPrimary`@18%, border `accentPrimary`@70%, icon/label `accentPrimary`, plus a count badge — solid `accentPrimary` rounded pill (radius 10, padding 6×1) with the count in mono 10/800 colored `bgDeepest`. Opens the filter sheet (§3.5).
   - **Sort button**: square-ish pill (padding 10×9, radius 14, `bgGlass`, `borderSubtle`) with `sort` icon 18 `accentPrimary`. Opens a popup menu (background `bgElevated`) listing all 7 sort options; the current one is tinted `accentPrimary`, others `textPrimary`. Tooltip "Sort".
3. **Quick-filter chips row** — horizontal scroll, height 32, padding (12, 4, 12, 0). Four toggle chips (pill radius 999, padding 10×6, 13px icon + mono 11/700 label; idle `bgGlass`+`borderSubtle`+`textSecondary`; active: tint@18% fill, tint@70% border, tint-colored icon+label):
   - `Starred` — icon `star_rounded`, tint `accentWarn` → toggles `starredOnly`
   - `Not done` — icon `radio_button_unchecked`, tint `accentSecondary` → toggles `todo` in `statuses`
   - `In progress` — icon `pending_outlined`, tint `accentWarn` → toggles `inProgress`
   - `Done` — icon `check_circle_outline`, tint `accentSuccess` → toggles `done`
4. **Active-filter chips row** — horizontal scroll, height 36 (hidden entirely when no removable chips), 6px gaps, horizontal padding 12. One removable chip per active criterion, in this order and with these exact label formats (chip pill: tint@18% fill, tint@70% border, label mono 11/600 in tint + trailing `close` 12px). Tapping a chip removes that criterion:
   - per selected type: `type: {type}` (tint accentPrimary)
   - per allied faction: `ally: {label}` (faction tint)
   - per rival faction: `rival: {label}` (faction tint)
   - per reward: `reward: {label}` (reward tint)
   - per skill: `skill: {key}` (skill tint)
   - per tag: `tag: {label}` (accentSuccess)
   - narrowed skill range: `skill ≥{start}..{end}` (accentSecondary) — removing resets to 0..100
   - narrowed rep range: `rep {start}..{end}` (accentSecondary) — reset 0..8
   - narrowed risk range: `risk {start}..{end}` (accentWarn) — reset 0..14
   - narrowed bonus range: `bonus {start}..{end}` (accentWarn) — reset to full data extent
   - `pickup ast {n}`, `pickup z{n}`, `dropoff ast {n}`, `dropoff z{n}` (accentPrimary)
   - `on-site only` (accentSuccess), `cargo only` (accentWarn), `rival impact` (accentDanger), `hide ???` (textDim)
5. **Result list** — `ListView` padding (12, 4, 12, 32), 8px separators. First row is a summary line (mono 11 `textDim`, 4px horizontal padding): `"{n} job{s} · sorted by {sortLabel}"` e.g. `142 jobs · sorted by Risk ↓`. Then one `JobCard` per job (§3.4), virtualized (only visible cards rendered — with 371 cards this matters). Tapping a card opens the detail sheet (§3.6).
6. **Empty state** (replaces the list): centered `search_off` icon 48 `accentWarn`; headline `No jobs match these filters.` when any filter active, else `No jobs.`; when filtered, caption `Loosen the criteria or reset everything.` + tonal button `Reset filters` that clears the whole filter.

State behavior: the filter lives in an app-lifetime store (not reset on navigation away/back within a session). The search text field is initialized from the stored query on mount.

### 3.4 Job card (`JobCard`)

GlassCard. Contents top-to-bottom:

1. **Badge row** (wraps; 6px gaps):
   - Type badge: `typeRaw` uppercased, mono 9.5/700/letter-spacing 1 in `accentPrimary`; pill padding 8×3, radius 6, fill `accentPrimary`@12%, border `accentPrimary`@50%.
   - Allied faction pill (if any): label mono 9/700 in faction tint, padding 6×2, radius 4, fill tint@16%, border tint@70% (0.7px).
   - Rival (if any): a `gpp_bad` icon 11px in rival tint@90% followed by the rival faction pill in "hostile" style — fill tint@6%, border tint@50%.
   - Right side: status pill only when progress ≠ todo — `DONE` (accentSuccess) or `WIP` (accentWarn): mono 9/700/ls 0.5 + 10px icon (`check_circle_outline`/`pending_outlined`), fill tint@14%, border tint@60%, radius 4, padding 6×2. Then `#{id}` mono 10 `textDim`, then a FavoriteButton (18px, kind `job`).
2. **Description teaser** — the markdown stripped of `**` and backticks, max 2 lines with ellipsis, body 13px, line-height 1.25.
3. **Stats wrap** (12px column gap, 4px run gap; each stat = 12px icon in tint + mono 10.5 `textSecondary` label, max-width 240px, single line ellipsis):
   - if `requiredSkill`: icon `bolt`, tint = skill tint; label `{skill}` or `{skill} ≥{amt}` when amt > 0
   - always: icon `warning_amber`, label `risk {n}`; tint: risk ≥ 7 → `accentDanger`, risk ≥ 3 → `accentWarn`, else `accentSuccess`
   - always: icon `local_atm`, tint = reward tint; label `{RewardLabel} {bonusText}` where bonusText = `?` if bonus == 0, `+{bonus}` if > 0, `{bonus}` if < 0
   - always: icon `place`, tint accentPrimary; label = `pickup.label` when on-site, else `{pickup.label} → {dropoff.label}`
   - if cargo: icon `local_shipping`, tint accentWarn; label `cap {capacity}` or `cap {capacity} · {ship}`
   - if tag: icon `shield_outlined`, tint accentSuccess; label = tag human label

### 3.5 Filter sheet (`JobsFilterSheet`)

Modal bottom sheet, `DraggableScrollableSheet` initial 0.85 / min 0.5 / max 0.95 of viewport, container `bgElevated`, top radius 22. Structure:

- Drag handle 36×4 (`textDim`).
- Header row (padding lg×sm): `Filters` headline; right-aligned text button `Reset` colored `accentDanger`. Reset restores the pristine filter (bonus range snapped to the full data extent) and clears the four location text inputs.
- Scrollable body (padding lg, bottom xxl). Every section has a heading: title uppercased, mono 11/700/ls 1.4 `accentPrimary`, 8px below, 16px bottom margin per section. Sections in exact order:

1. **TYPE** — chips grouped by bucket (bucket sub-heading: caption 11 `textDim` ls 0.6; buckets sorted alphabetically by name: Beginner, Event, Expansion, Other, Regular, Skill gain, Unknown — only buckets present). Chip list = all distinct canonical types present in the data, each with a count suffix. Multi-select.
2. **ALLIED FACTION** — all 15 allied factions as chips (labels + tints from §3.2), multi-select. No counts.
3. **RIVAL FACTION** — chips = 15 allied + 5 rival-only factions (20 options), multi-select.
4. **REWARD** — chips = distinct canonical rewards in the data (sorted), labels/tints per taxonomy, with counts.
5. **BONUS** — range slider. Min/max = *actual data extent* computed from loaded jobs (currently −2740…500); if data were empty, 0…1. Guard: if max ≤ min, max = min+1. **50 divisions**. Above the slider: `"{start} – {end}"` (rounded) in mono 11 `accentSecondary`. Slider theme: active track `accentPrimary`, inactive `accentPrimary`@18%, thumb `accentPrimary`, overlay @20%, value bubbles on `bgElevated`, track height 3.
6. **REQUIRED SKILL** — chips = distinct `requiredSkill` values present (sorted; label = raw key), tints per taxonomy, with counts.
7. **SKILL AMOUNT REQUIRED** — range slider 0–100, 20 divisions.
8. **REQUIRED REPUTATION** — range slider 0–8, 8 divisions.
9. **REQUIRED TAG** — chips = the 7 taxonomy tags (human labels), tint accentSuccess, multi-select.
10. **RISK** — range slider 0–14, 14 divisions.
11. **LOCATION** — two labelled input rows (`Pickup`, `Dropoff`; 64px label column, caption/600): each has two numeric text fields — flexible-width `astnum` and 90px-wide `zone` — digits only, mono 12, dense outline inputs (radius 8; enabled border `borderSubtle`, focused `accentPrimary`), placeholder `astnum` / `zone` in mono 11 `textDim`. Below: toggle row **`On-site only (pickup = dropoff)`** with a switch (active thumb accentSuccess).
12. **MORE** — three switch rows: `Cargo jobs only`, `Has rival impact`, `Hide “???” type`.

Chips (all selectors): pill radius 999, padding 10×6, animated 160ms; unselected `bgGlass` fill + `borderSubtle`, label mono 11/600 `textSecondary`; selected tint@18% fill, tint@80% border, tint label. Count suffix `· N` in mono 10 `textDim`. A chip whose count is 0 is non-interactive and its label renders `textDim`.

- **Footer** (pinned): container `bgDeepest`@92%, 1px top border `borderSubtle`, padding lg×sm. Left: live result count — `"{n} result{s}"` body/`textSecondary` — recomputed on every draft change **using only the job-intrinsic predicate** (`accepts`, §3.7; the starred/status companion filters are NOT applied to this count). Uncommitted location text inputs are included in the live count. Right: filled button `Apply` (bg accentPrimary, fg `bgDeepest`, padding 24×10) — commits the draft (parsing the four location inputs: blank/invalid → null) and closes the sheet.

The sheet edits a **draft** copy; nothing applies to the list until Apply. Opening the sheet snapshots the current filter as the draft, and computes the bonus extent from all jobs (clamping any previously-set finite bonus range into the extent; an untouched/unbounded range collapses to the full extent).

### 3.6 Job detail sheet (`JobDetailSheet`)

Modal bottom sheet 0.78 / 0.4 / 0.95, `bgElevated`, top radius 22, padding (16, 8, 16, 32). Content top-to-bottom:

1. Drag handle 36×4.
2. **Header row**: type (`typeRaw` uppercased, mono 11/700/ls 1.5 `accentPrimary`, expands) · FavoriteButton (22, kind `job`) · share icon-button (`ios_share` 20 `accentPrimary`, tooltip "Share job") · **copy-ID chip**: bordered pill (bgGlass, `borderSubtle`, radius 6, padding 8×4) with `copy` icon 12 + `#{id}` mono 11 in `accentPrimary`; tapping copies the id to clipboard and shows snackbar `Copied #{id}`.
3. **Status control** — 3 equal segments in a row (6px gaps): `Not done` / `In progress` / `Done`. Segment: padding-y 9, radius 8; selected = tint@18% fill + tint@80% border + tint mono 11/700 label; unselected `bgGlass` + `borderSubtle` + `textSecondary`. Tints: Not done `textSecondary`, In progress `accentWarn`, Done `accentSuccess`. Writes to the JobStatus store immediately (todo deletes the row).
4. **Description card** — GlassCard containing the `description` rendered as markdown. Markdown style: paragraphs body 13/1.4; `**bold**` → weight 800 in `accentPrimary`; inline code mono 12 `accentSecondary` on `bgDeepest`; code blocks on `bgDeepest`, radius 8.
5. **Facts card** — GlassCard, key/value rows (key column 130px, mono 11 `textDim`; value body, optionally tinted):
   - `Allied faction` → label or `—` (value in faction tint)
   - `Rival faction` → label, or the raw key if unknown, or `—` (rival tint)
   - `Required tag` → human label / raw / `—`
   - `Required skill` → `—`, or `{skill}`, or `{skill} ≥{amt}` when amt > 0
   - `Required reputation` → number
   - `Risk` → number
   - `Reward` → `{RewardLabel} · {bonus}` where bonus renders `amount unknown` when 0, `+{n}` when positive, `{n}` when negative (value in reward tint)
   - `Pickup` → `pickup.label`
   - `Dropoff` → `dropoff.label`
   - `Cargo` (only if isCargoJob) → `capacity {n}` (+ ` · ship {ship}` when ship set), tinted accentWarn
6. **"View on map"** NeonButton (icon `map_outlined`) — only when `mapRef` present (currently never; keep the capability).
7. **On-complete card** — GlassCard: heading `ON COMPLETE` (mono 11/700/ls 1.5 `accentSuccess`), then `onComplete` markdown (same style).
8. **Data-quality warning** — shown ONLY when `pickup.astnum == 355 && pickup.zone == 70` (a known-broken source comment): a box (accentWarn@8% fill, accentWarn@40% border, radius 8, padding 12×8) with `info_outline` 14 accentWarn and caption: `Source data may contain inconsistent zone comments. Verify locations in-game before travelling.`

**Share** produces a PNG of the JobShareCard (below), file name `underdeck-job-{id}.png`, share text `Underdeck job #{id}`.

### 3.7 Filtering & sorting logic (exact)

`JobFilter` fields and defaults:

```ts
{
  query: '',                     // free text
  types: Set<string> = {},      // canonical (lowercased) types
  alliedFactions: Set<string> = {},
  rivalFactions: Set<string> = {},
  rewards: Set<string> = {},    // canonical rewards
  skills: Set<string> = {},
  tags: Set<string> = {},       // raw tag keys
  skillAmt: [0, 100],
  requiredRep: [0, 8],
  risk: [0, 14],
  bonus: [-Infinity, +Infinity], // collapsed to data extent when sheet opens
  bonusMin: -Infinity, bonusMax: +Infinity, // real data extent once known
  pickupAstnum?: number, pickupZone?: number,
  dropoffAstnum?: number, dropoffZone?: number,
  onSiteOnly: false, cargoJobsOnly: false,
  rivalImpactOnly: false, hidePlaceholder: false,
  starredOnly: false,            // companion filter
  statuses: Set<'todo'|'in_progress'|'done'> = {}, // companion filter
  sort: 'idAsc',
}
```

`accepts(job)` predicate (all conditions ANDed; any failure rejects):
1. Query: lowercase `query`; haystack = `description + "\n" + onComplete + "\n" + id + "\n" + typeRaw`, lowercased; must `contain` the query.
2. `types` non-empty → must contain `job.type`.
3. `alliedFactions` non-empty → `job.factionRep` non-null and in the set.
4. `rivalFactions` non-empty → `job.factionRival` non-null and in the set.
5. `rewards` non-empty → contains `job.reward`.
6. `skills` non-empty → `job.requiredSkill` non-null and in set.
7. `tags` non-empty → `job.requiredTag` non-null and in set.
8. `skillAmt.start ≤ job.requiredSkillAmt ≤ skillAmt.end`.
9. `requiredRep.start ≤ job.requiredRep ≤ requiredRep.end`.
10. `risk.start ≤ job.risk ≤ risk.end`.
11. `bonus.start ≤ job.bonus ≤ bonus.end`.
12. pickup/dropoff astnum/zone equality when the respective filter value is set.
13. `onSiteOnly` → job.isOnSite; `cargoJobsOnly` → job.isCargoJob; `rivalImpactOnly` → job.hasRival; `hidePlaceholder` → NOT job.isPlaceholderType.

`acceptsCompanion({isStarred, status})` (evaluated with external state):
- `starredOnly` → must be starred.
- `statuses` non-empty → must contain the job's progress (absent row = `todo`).

The visible list = all jobs where `accepts(j) && acceptsCompanion(starred.has(String(j.id)), statusMap[String(j.id)] ?? 'todo')`, then sorted.

`activeCount` (drives the Filters-button badge; excludes sort): +1 for each of — non-empty query; each non-empty set (types, allied, rival, rewards, skills, tags); skillAmt narrowed from [0,100]; requiredRep narrowed from [0,8]; risk narrowed from [0,14]; bonus narrowed strictly inside [bonusMin, bonusMax]; each non-null location field (up to 4); each true boolean (onSite, cargo, rivalImpact, hidePlaceholder, starredOnly); non-empty statuses (counts once).

**Sorts** (`JobSort`) — labels and comparators:

| value | label | comparator |
|---|---|---|
| `idAsc` (default) | `ID ↑` | a.id − b.id |
| `riskAsc` | `Risk ↑` | a.risk − b.risk |
| `riskDesc` | `Risk ↓` | b.risk − a.risk |
| `bonusDesc` | `Bonus ↓` | b.bonus − a.bonus |
| `bonusAsc` | `Bonus ↑` | a.bonus − b.bonus |
| `skillAmtDesc` | `Skill req ↓` | b.requiredSkillAmt − a.requiredSkillAmt |
| `skillAmtAsc` | `Skill req ↑` | a.requiredSkillAmt − b.requiredSkillAmt |

### 3.8 "About this dataset" sheet

Bottom sheet 0.45 / 0.3 / 0.85, `bgElevated`, top radius 20, top border `borderSubtle`, padding (16, 12, 16, 16). Content:

- Drag handle 36×4 (`borderSubtle`).
- Headline: `About this dataset`
- Body (line-height 1.4): `The 371 jobs listed here come from an extract Lama shared directly with the project. The numbers, locations, factions and reward functions are passed through as-is.`
- Boxed callout (bgGlass, radius 8, `borderSubtle`, padding 12): header row `flag_outlined` 16 accentWarn + headline-14 `Spotted a wrong value?`; caption (1.4): `If a job is missing, mislabelled, or has a reward that looks off (negative bonus, weird amount, wrong faction), send the correction through the in-app Contact form or drop it in the project Discord. Every fix lands in the next build.`
- Footer caption in `textDim` (1.4): `Some fields read "amount unknown" — that means the source extract had a zero bonus for that job, so the actual reward count is either dynamic or simply not recorded yet.`

### 3.9 Job share card (`JobShareCard`) — 380px-wide PNG

Container: fill `bgDeepest` + diagonal gradient (top-left `accentPrimary`@8% → transparent bottom-right), 1px `borderSubtle`, padding 16. Content:
1. `UNDERDECK · JOB` — mono 11/700/ls 2 `accentPrimary`
2. `Contract #{id}` — caption
3. divider 1px `borderSubtle`@50%
4. `{typeRaw}` uppercased — headline
5. Rows (label column 110px caption; value mono 13/600, tinted):
   - `Allied faction` → label or `—` (faction tint or textPrimary)
   - `Rival faction` (only when set) → label (tint)
   - `Reward` → `{label} · {bonusText}` (`amount unknown` / `+n` / `n`), reward tint
   - `Required skill` → `—` or `{skill}` / `{skill} ≥{amt}`
   - `Risk` → number, accentWarn
   - `Pickup` / `Dropoff` → **coords only** (`{astnum} · z{zone}`)
6. divider; footer row: `work_outline` 9px `textDim` + `Generated by Underdeck · Job board` mono 9 `textDim`.

---

## 4. FISHING MAP (`/tools/fishing`, `/tools/fishing/:roomId`)

### 4.1 Data — `fishing_zones.json`

Array of 100 zone objects:

| key | type | nullable | notes |
|---|---|---|---|
| `id` | int | no | zone number; 1–96 for the river grid; 996–999 for map rooms |
| `name` | string | no | `"Unknown"` for un-catalogued zones (29 of them) |
| `accessible` | bool | no | `false` (14 zones) means an inaccessible "Reef" cell |
| `depth` | string | yes | one of `Pond, Shore, Harbour, Grove, Deep, Void, Wreck, Lair, Unknown` (also `null`, and the literal `"None"` occurs — treated same as unknown) |
| `pole` | string | yes | one of `Black, Blue, Brown, Green, Pink, Purple, Red, White, Unknown, None` (display raw; `null → 'n/a'`) |
| `room` | string | no | slug: `rankle-river` (96 zones), `west-shire`, `east-shire`, `imperious-falls`, `event-arena` (1 each) |
| `isMapRoom` | bool | default false | true for the four 99x rooms; parsed but not used by any current UI |
| `mapRef` | object | optional | dormant "View on map" cross-link, same shape as jobs |

Samples:
```json
{ "id": 22, "name": "Serpent's Sway", "accessible": true, "depth": "Unknown", "pole": "Unknown", "room": "rankle-river", "isMapRoom": false }
{ "id": 16, "name": "Reef", "accessible": false, "depth": null, "pole": null, "room": "rankle-river", "isMapRoom": false }
{ "id": 999, "name": "West Shire", "accessible": true, "depth": "Pond", "pole": "Brown", "room": "west-shire", "isMapRoom": true }
```

**Room assembly logic** (`FishingData.load`): group zones by `room`; order rooms `west-shire, east-shire, imperious-falls, event-arena, rankle-river` (any unexpected extra slugs appended after, alphabetically); zones inside a room sorted by `id` ascending. Display names: `rankle-river→Rankle River`, `west-shire→West Shire`, `east-shire→East Shire`, `imperious-falls→Imperious Falls`, `event-arena→Event Arena`; fallback: title-case the slug on `-`. `room.isSolo` = exactly 1 zone.

**Depth enum** (label / legend symbol / color):

| depth | symbol | color |
|---|---|---|
| Unknown | `?` | `#4F6A87` |
| Pond | `■` | `#B07A3A` |
| Shore | `■` | `#9B5BD9` |
| Harbour | `■` | `#E07AA8` |
| Grove | `■` | `#4FB36A` |
| Deep | `■` | `#3F88E8` |
| Void | `■` | `#E25470` |
| Wreck | `■` | `#CFD8E3` |
| Lair | `■` | `#4A2D6E` |

`FishingDepth.fromName(name)` matches by exact label; `null`, `"None"`, or anything else → no depth (null).

### 4.2 Rooms list (`FishingMapView`)

- AppBar: transparent, title `Fishing Map` (headline), back icon `accentPrimary`. Content scrolls behind it (top padding = safe-area + toolbar + 8).
- SectionHeader `Map rooms` with icon `map`.
- One tappable GlassCard per room (12px gaps): left a 48px circle filled with (first zone's depth color, else accentPrimary) at 35% alpha containing a 22px `accentPrimary` icon — `place` for solo rooms, `grid_view` for multi; middle: room name (headline) over caption `Single zone` or `{n} zones`; right `chevron_right` in `textDim`. Tap → navigate to `/tools/fishing/{room.id}`.

### 4.3 Room view (`FishingRoomView`)

- AppBar title = room display name (empty while loading). Unknown roomId → centered caption `Room not found`.
- **Solo room** (the four map rooms): page shows a single Zone summary card (§4.4) with `showsZoneNumber=false`.
- **Multi-zone room** (Rankle River, 96 zones):
  1. **Segmented filter** — a 3-way control in a bordered container (bgGlass, radius 8, 2px padding): options `All` / `Known` / `Unknown` (labels are capitalized enum names). Selected segment: accentPrimary@16% fill, accentPrimary border, label body/600 accentPrimary; others transparent, `textSecondary`. Semantics:
     - All: everything.
     - Known: `accessible && name != 'Unknown'`.
     - Unknown: `name == 'Unknown' && accessible`.
  2. **Depth chip row** — horizontal scroll, 38px high, 8px gaps: one chip per FishingDepth value (all 9, order as the table above). Chip: padding 10×5, radius 20, 1px border in depth color; unselected fill = depth color @18%, label 12/500 in depth color; selected fill = solid depth color, label black. Multi-select set; ANDed with the segment filter (`zone depth must parse to a selected depth`; zones with null/None depth never match a depth selection).
  3. **Zone grid** — 6 columns, square cells, 4px gaps. Cell: radius 4; accessible → fill depthColor@55% + 1px depthColor border, label = zone id (mono 11/600 white); not accessible → fill bgGlass + `borderSubtle`, label `×` in `textDim`. Tap any cell (including reefs) → bottom sheet (bgElevated, top radius 20, padding 12) containing the Zone summary card with `showsZoneNumber=true`.

### 4.4 Zone summary card (`_ZoneSummaryCard`)

GlassCard:
- Header row: (optional `Zone {id}` caption above) zone name in `title` style; FavoriteButton (kind `fishing_zone`, id = zone id, tooltip `Star zone`); share icon (`ios_share` 18 accentPrimary, tooltip `Share zone`); a 56px circle filled with depth color @55% (only when depth known).
- Divider 1px `borderSubtle`.
- Detail rows (label caption left, value body right-aligned):
  - `Accessible` → `Yes` or `No (Reef)`
  - `Depth` → raw depth string or `n/a`
  - `Pole` → raw pole string or `n/a`
- Optional `View on map` NeonButton when `mapRef` set (dormant).

Share: PNG `underdeck-fishing-zone-{id}.png`, text `Underdeck fishing zone`.

### 4.5 Fishing share card (`FishingShareCard`)

Same frame as the job card (380px, bgDeepest + tint@8% gradient where tint = depth color or accentPrimary, `borderSubtle`):
1. `UNDERDECK · FISHING` mono 11/700/ls2 accentPrimary
2. room label caption
3. divider
4. row: 40px circle (tint@55%) + zone name (headline) over `Zone {id}` (mono 11 textSecondary)
5. rows (caption label / mono 14/600 value): `Room` → room label; `Depth` → depth or `n/a` (in tint); `Pole` → pole or `n/a`; `Access` → `Accessible` (accentSuccess) or `No (Reef)` (accentDanger)
6. divider; footer `set_meal` 9px + `Generated by Underdeck · Fishing map` mono 9 textDim.

---

## 5. MARS EXPRESS (`/tools/mars-express`)

A live view of the in-game train that loops the same route **every hour**, keyed purely on the wall-clock minute.

### 5.1 Data — `train_schedule.json`

Array of exactly 60 objects, one per minute 0–59:

```json
{ "minute": 0, "zone": 259, "name": "New Haven" }
{ "minute": 4, "zone": 307, "name": null }
```

| key | type | nullable |
|---|---|---|
| `minute` | int 0–59 | no |
| `zone` | int | no |
| `name` | string | yes (null = unnamed transit stop) |

Full shipped schedule (minute → zone, name):

```
00 259 New Haven          01 259 New Haven          02 283 Stellar Nexus
03 283 Stellar Nexus      04 307 —                  05 306 —
06 305 —                  07 304 —                  08 303 —
09 302 —                  10 301 Redwater Junction  11 300 —
12 299 —                  13 323 —                  14 322 Redwater Junction
15 322 Redwater Junction  16 346 —                  17 345 —
18 344 —                  19 320 —                  20 319 —
21 318 —                  22 294 Solara Vein        23 294 Solara Vein
24 294 Solara Vein        25 318 —                  26 319 —
27 320 —                  28 344 —                  29 345 —
30 346 —                  31 322 Redwater Junction  32 322 Redwater Junction
33 301 —                  34 302 —                  35 303 —
36 304 —                  37 305 —                  38 306 —
39 282 Aurelia Mines      40 282 Aurelia Mines      41 282 Aurelia Mines
42 282 Aurelia Mines      43 282 Aurelia Mines      44 258 Blackshore District
45 258 Blackshore District 46 258 Blackshore District 47 258 Blackshore District
48 258 Blackshore District 49 234 Olympia Docks     50 234 Olympia Docks
51 234 Olympia Docks      52 234 Olympia Docks      53 234 Olympia Docks
54 234 Olympia Docks      55 234 Olympia Docks      56 234 Olympia Docks
57 235 Martropolis        58 235 Martropolis        59 235 Martropolis
```

Note zone 301 is named "Redwater Junction" at minute 10 but unnamed at minute 33; `nameFor(zone)` returns the **first non-null** name found for the zone, so zone 301 resolves to "Redwater Junction" everywhere it's displayed by name lookup. Zones in schedule: 234, 235, 258, 259, 282, 283, 294, 299–307, 318–320, 322, 323, 344–346.

On load, entries are sorted by minute ascending. `currentStop(minute)` = the entry whose minute equals the current wall-clock minute (linear scan), or null.

### 5.2 Schedule math (`MarsExpressService`) — port exactly

```
nextArrivals(zone, currentMinute, stops) -> int[]
  future = [s.minute for s in stops if s.zone == zone and s.minute > currentMinute]
  if future empty:
      future = [s.minute + 60 for s in stops if s.zone == zone]   // wrap to next hour
  return sorted(future)
// Used for "Next arrival in N min": N = arrivals[0] - now.minute (can exceed 59)
```

```
alertsForArrival(arrival: DateTime) -> [arrival - 2min, arrival - 1min, arrival]
```

```
nextOccurrences(zone, stops, count, now) -> DateTime[]
  if count <= 0: []
  minutes = sorted(unique minutes at which the train is at `zone`)
  if empty: []
  result = []
  anchor = start of the current hour (now truncated to hour)
  guard = 0
  while result.length < count and guard <= count + 2:
      for m in minutes:
          dt = anchor + m minutes
          if dt > now: result.push(dt); if full: break
      anchor += 1 hour; guard++
  return result
// strictly-after `now`: arming exactly on an arrival rolls to the next cycle.
// A zone visited at k minutes/hour yields k occurrences per hour.
```

```
consolidated(currentMinute, stops) -> ScheduleEntry[]
  // Groups CONSECUTIVE minutes at the same zone into ranges, starting from the
  // current minute and wrapping. Two passes:
  //   pass 1: minutes currentMinute..59  (nextHour = false)
  //   pass 2: minutes 0..currentMinute-1 (nextHour = true)
  // Within a pass, extend the open entry while the zone matches AND the
  // nextHour flag matches; else flush and open a new entry. A group keeps the
  // first non-null name seen. NOTE: consecutive-minute check is implicit —
  // every minute has a stop in the shipped data, so groups are contiguous.
ScheduleEntry { startMinute, endMinute, zone, name?, nextHour }
rangeText: ":SS"           when start == end       (2-digit zero-padded)
           ":SS–EE"        otherwise (en dash)
           + trailing "+"  when nextHour            (e.g. ":02–03+")
```

### 5.3 Main screen layout (`MarsExpressView`)

AppBar: transparent, title `Mars Express` (headline), back tint accentPrimary. Content: PageScrollView, top padding = safe-area + toolbar + 8.

1. **TransmissionHeader** — `ESSI · transit operations`.
2. **LIVE card** (GlassCard): left column — overline `LIVE` (mono 10/700/ls2 accentSuccess); if a current stop exists: `Zone {zone}` (title) + caption (stop name or `Transit route`); else title `Idle`. Right column (right-aligned): `:{MM}` — the current minute, zero-padded, mono 30 / w900 / `accentSecondary`; below it the wall time `HH:mm` in caption.
3. **Schedule card** (GlassCard): SectionHeader `Schedule (next hour)` icon `schedule`; caption `Tap a row for zone details and to set alerts.`; then the consolidated entries as rows separated by 1px lines (`borderSubtle`@30%):
   - Row (85% opacity unless it's the current range, then 100%): 70px column with `rangeText` (mono 13/600; `accentSecondary` when current else `textSecondary`); a 16px icon — `tram` in accentPrimary for named stops, `swap_horiz` in textDim for unnamed transit; middle: `Zone {zone}` (body) over caption (name or `Transit`); if that zone has an armed alert, a `notifications_active` 16 accentWarn; trailing `chevron_right` 18 textDim. "Is current" = `!nextHour && startMinute <= minute <= endMinute`.
   - Tap → Zone detail sheet (§5.4).
4. **Armed alerts card** (only when ≥1 armed zone): SectionHeader `Armed alert` (1 zone) or `Armed alerts ({n})`, icon `notifications_active`; when n > 1 a right-aligned text-button `Cancel all` (caption, accentDanger). Then one row per armed zone: `notifications_active` 18 accentWarn; `Zone {zone}` body (+ a `repeat` 14 accentPrimary icon when the entry repeats); caption below: `Next arrival {HH:mm}` (live-computed) — fallback `Recurring alert` (repeat) or `Alert armed`; when exact alarms are unavailable (Android-only concept) an extra hint line — `schedule` 12 accentWarn + caption `Approximate timing` in accentWarn; trailing cancel icon-button (`cancel`, accentDanger) → cancel that zone.

**Refresh cadence**: a 5-second interval updates `now` (so the LIVE minute, current-row highlight, and consolidation stay fresh) and calls the alert controller's `refresh(stops)` (prunes expired one-shots / tops up repeating zones). On window refocus (app resume): reset `now`, re-check exact-alarm capability, refresh alerts. On first frame: one-shot legacy notification-id cleanup (§5.7).

### 5.4 Zone detail sheet (`ZoneDetailSheet`)

Bottom sheet 0.55 / 0.4 / 0.92, `bgElevated`, top radius 22, padding (16, 12, 16, 24). Own 5-second ticker for `now`.

1. Drag handle.
2. **Zone card** (GlassCard): `Zone {zone}` overline (mono 11/ls1.6/700 accentPrimary); headline = zone name via `nameFor(zone)` or `Transit route`; if there is a next arrival: row — `tram` icon accentPrimary, caption `Next arrival in`, then `{N} min` in mono 22/700 accentSecondary, where `N = nextArrivals(zone, now.minute)[0] − now.minute` (§5.2 — may exceed 60 when wrapped).
3. **Alerts card** (GlassCard):
   - Header: `notifications_outlined` 18 accentPrimary + headline `Alert armed` (if this zone is armed) else `Local alerts`.
   - Caption: `You'll get 3 notifications per arrival: 2 min before, 1 min before, and on arrival. You can arm several zones at once.`
   - **Repeat toggle row**: body `Repeat every hour` with caption below: `Schedules the next 6 arrivals (up to ~6 h ahead). Reopen the app to extend further — alerts can only be scheduled while the app is running.` (the "6" comes from `TrainAlertIds.repeatOccurrences`); right: a switch (active thumb accentPrimary). Toggle pre-set from the armed entry when re-opening an armed zone.
   - Buttons: if armed — NeonButton `Update alert` (icon `notifications_active`) then NeonButton `Cancel alerts` (icon `notifications_off`); else NeonButton `Set alert` (icon `notifications_active`).

**Arm outcomes and their exact UI reactions** (snackbar unless noted):
- `armed` → close sheet (success haptic), no message.
- `armedTruncated` → close sheet + snackbar: `Alert armed, but some later occurrences were skipped — too many zones are armed at once. Cancel a zone to cover them.`
- `permissionDenied` → snackbar: `Notifications are turned off. Enable them for Underdeck in system settings to arm alerts.`
- `bandFull` → snackbar: `Too many zones are armed. Cancel one before arming another.`
- `budgetFull` → snackbar: `The notification limit is full. Cancel an armed zone to make room.`
- `nothingToSchedule` → snackbar: `The next arrival is too soon to schedule alerts. Try again once there's more time before it.`

Cancel (from sheet or armed list) → cancel that zone's notifications, remove entry, close sheet.

### 5.5 Notification-id allocation (`TrainAlertIds`) — pure constants/algorithms

```
bandMin = 70000, bandMax = 70999          // reserved id band for train alerts
alertsPerOccurrence = 3                   // −2min, −1min, on-arrival
repeatOccurrences = 6                     // horizon for repeating zones
slotSize = 20                             // ids reserved per armed zone
slotCount = floor((bandMax−bandMin+1)/slotSize) = 50
pendingBudget = 60                        // global cap (iOS keeps only nearest-64 pending)
slotBase(slot) = bandMin + slot*slotSize
slotIds(slot) = slotBase..slotBase+19
occurrenceIds(slot, o) = [slotBase + o*3 + a for a in 0..2]
alertId(slot, o, a) = slotBase(slot) + o*3 + a
lowestFreeSlot(usedSet) = first s in 0..slotCount-1 not in usedSet, else null
legacyPrePlanIds() = [70000 + zone*10 + i for zone in 234..346 for i in 0..9]  // pre-P2 scheme, swept once
```

### 5.6 Armed-zone persistence

`TrainAlertEntry` JSON (stored as a JSON array under prefs key `trainAlert.zones`):
```json
{ "zone": 322, "slot": 0, "repeat": true, "lastArrival": 1720712340000 }
```
(`lastArrival` = epoch-ms of the farthest occurrence currently scheduled.)

Load rules: parse the array; entries missing zone/slot/lastArrival are dropped; **expired one-shots are dropped** (an entry with `repeat=false` whose `lastArrival` is more than 10 seconds in the past); repeating entries are always kept (refresh re-arms them). Legacy single-zone format under `trainAlert.armed` (`{"armedZone": int, "arrival": epochMs}`) migrates to `[{zone, slot:0, repeat:false, lastArrival}]` if fresh, then the legacy key is deleted on next persist. Persist: remove legacy key; empty list → remove key; else write JSON.

### 5.7 Alert controller behavior (`TrainAlertController`)

All mutators (`arm`, `cancelZone`, `cancelAll`, `refresh`, legacy cleanup) run **serialized** on a single promise queue so their awaits never interleave (a cancel landing during a refresh must win).

**arm(zone, stops, repeat, now)**:
1. Request notification permission → `permissionDenied` if refused.
2. slot = existing entry's slot, else `lowestFreeSlot(otherZones' slots)` → `bandFull` if none.
3. Budget check: count *actually pending* notification ids inside the band excluding this slot's range (`othersPending`); candidate instants = `plannedAlertInstants(zone, stops, repeat, now)`; `plan = planWithinBudget(candidate, othersPending, budget=60)`; `budgetFull` if remaining ≤ 0.
4. Cancel all pending ids in this slot; schedule each allowed instant (see notification content below); dedup instants (two arrivals < 3 min apart can share an alert instant → schedule once); skip any instant less than 2 s in the future.
5. If nothing got scheduled → drop any stale entry for the zone → `nothingToSchedule`. Else save `{zone, slot, repeat, lastArrival = last occurrence actually scheduled}` (replacing any prior entry for the zone) and return `armed` or `armedTruncated` (if the budget dropped the farthest instants).

`plannedAlertInstants(zone, stops, repeat, now)`: take `nextOccurrences(count = repeat ? 6 : 1)`, expand to the 3 alert instants each, drop those < 2 s away, dedup by instant, preserve order.

`planWithinBudget(candidate, othersPending, budget=60)`: remaining = budget − othersPending; if ≤ 0 → keep nothing, `full`; if candidate fits → keep all; else keep the `remaining` **nearest-in-time** instants (preserving schedule order), flag `truncated`.

**refresh(stops)** (5-second ticker / resume; exceptions swallowed+logged):
- For each armed entry: one-shots — keep if `lastArrival` still within 10 s grace, else drop. Repeating — recompute `nextOccurrences(count=6)`; if the last occurrence equals the stored `lastArrival`, nothing to do; else (horizon shifted) re-plan within the budget, cancel the slot's ids, reschedule, update `lastArrival` (or drop if nothing schedulable).
- Commit by **merging results onto the state as it is at commit time**: entries the user cancelled mid-pass stay cancelled; zones re-armed to a different slot keep the newer state; untouched zones keep as-is. Persist only when something changed.

**cancelZone(zone)**: cancel all 20 ids of the entry's slot, remove entry, persist.
**cancelAll()**: cancel every pending id in 70000–70999, clear state, persist.
**cleanupLegacyIdsOnce()**: if `trainAlert.didLegacyCleanup` not set, cancel any pending id in `legacyPrePlanIds()`, then set the flag (retry next launch on failure).

### 5.8 Notification content (exact strings)

- Title (all alerts): `Mars Express → Zone {zone}`
- Body: `Train arriving at Zone {zone} in 2 minutes.` / `Train arriving at Zone {zone} in 1 minute.` / `Train arriving at Zone {zone} now.`
- Android channel: id `mars_express`, name `Mars Express alerts`, description `Train arrival reminders`, high importance/priority, monochrome status icon `ic_stat_underdeck`. iOS: time-sensitive interruption level. Notifications scheduled at absolute local wall-clock instants; anything already in the past is silently skipped.

### 5.9 WEB ADAPTATION — notifications (must be redesigned)

The Flutter implementation relies on **OS-scheduled local notifications that fire with the app closed**. A GitHub-Pages web app has no server, so Web Push is unavailable; options, in order of fidelity:
1. **In-page alerts while the tab is open** (recommended baseline): keep the exact arm/cancel/repeat UX and schedule with `setTimeout` + the Notification API (`new Notification(title, {body})` after `Notification.requestPermission()`). Map `permissionDenied` to the permission prompt result. The slot/band/budget machinery (§5.5) exists purely to manage OS notification-id limits — it can be dropped on web (keep `repeatOccurrences = 6` messaging or simplify) or kept as-is for parity.
2. Service-worker `showNotification` + the (Chromium-only, experimental) Notification Triggers API — not portable; not recommended.
3. Drop alerts entirely, keep the live schedule + "next arrival in N min" countdown.
Document in-app that alerts only fire while the tab is open. The "Approximate timing" / exact-alarm concept is Android-only → **drop on web**.

### 5.10 Next-arrival snapshot & Live Activity bridge (`next_arrival_provider.dart`, `live_activity_bridge.dart`)

Infrastructure for a native lock-screen widget; the shipped sink is a deliberate **no-op**. Logic worth keeping (e.g. for a tab-title countdown or PWA badge), otherwise **drop**:
- `focusedZone` = first armed zone, else the zone the train is at right now, else null.
- Snapshot = `{zone, zoneName, arrivalMinute, minutesUntil, arrival, isArmed, generatedAt}` where `minutesUntil` = ceil(secondsUntil / 60), min 0 (a 30-second gap reads "1 min", never "0 min").
- Recomputed on a 20-second clock while the surface is visible.

---

## 6. WALLET LOOKUP (`/tools/wallet`)

### 6.1 Data — `wallets.json`

Array of **769** owner entries; **785** wallet strings total; every entry has ≥1 wallet; exactly 1 entry has a null `discord_username`.

| key | type | nullable |
|---|---|---|
| `display_name` | string | no |
| `discord_username` | string | yes |
| `wallets` | string[] | effectively no (missing → `[]`) |

Wallets are WAX cloud-wallet style names, 8–14 chars, mostly `xxxxx.wam` (also custom accounts). Sample:
```json
{ "display_name": "! Cruzified", "discord_username": "cruzified999", "wallets": ["jnyrg.wam"] }
```
Entry identity (`id`) = `discord_username ?? display_name` (used to dedupe owner-vs-wallet hits).

### 6.2 Search algorithm

`search(query)`:
- `q = query.trim().toLowerCase()`; empty → no results (overview shown instead).
- **ownerHits**: entries where `display_name` OR `discord_username` contains `q` (case-insensitive substring).
- **walletHits**: every `(wallet, owner)` pair where the wallet string contains `q`.
An owner can appear in both; the results section removes wallet hits whose owner is already an owner hit.

### 6.3 Screen layout (`WalletLookupView`)

AppBar: transparent, title `Wallet Lookup`. PageScrollView (top padding = safe-area + toolbar + 8):

1. **TransmissionHeader** — `ESBE · blockchain analysis`.
2. **Search card** (GlassCard): SectionHeader `Search owner or wallet`; caption `Find a wallet from an owner handle, or an owner from a wallet.`; TextField — underline style (border `borderGlow`; focused 2px), placeholder `Search…` (mono, textDim), input mono 16/500 textPrimary, autocorrect/suggestions off. Updates on every keystroke (no debounce).
3. If query blank → **Overview card** (GlassCard): SectionHeader `Database overview` icon `bar_chart`; stat rows (caption label left; value right in mono 14/600 accentSecondary):
   - `Owners` → `769`
   - `Wallets` → `785`
   - `Avg per owner` → totalWallets / totalOwners to 1 decimal (`1.0`)
4. Else → **Results section**:
   - No matches → GlassCard: `search` icon accentWarn + headline `No matches`; caption `Try a different name, Discord handle, or wallet substring.`
   - Otherwise: header row — SectionHeader `"{total} result{s}"` icon `list` (total = ownerHits + deduped walletHits) + share icon-button (`ios_share` 18 accentPrimary, tooltip `Share results`).
   - **Cap: 50 visible items** — owner cards first (up to 50), then deduped wallet-hit cards fill the remainder. If anything is hidden: caption `Showing {shown} of {total} matches — refine your search to narrow down.`
   - **Owner card** (GlassCard): row — `person` icon accentPrimary; display name (headline) with `@{discord_username}` beneath in mono 12 accentSecondary **only when it differs case-insensitively from the display name**; right-aligned `"{n} wallet{s}"` caption. Divider; then one row per wallet: `wallet` icon 16 accentSecondary + the wallet string as **selectable text** (mono 13).
   - Sub-header `Wallet matches` (icon `wallet`) before the wallet-hit cards. **Wallet-hit card**: `wallet` icon accentSecondary + wallet as selectable mono 14/600; below: `Registered to ` caption + owner name (caption/600 accentPrimary) + optional ` (@{discord})` mono 12 accentSecondary.

### 6.4 Deep link & state

- Route accepts `?q=…` (used by global search) which pre-fills the input and seeds the query after first render.
- The query state is **reset when leaving the screen** (autoDispose provider) — re-entering starts on the overview.

### 6.5 GDPR / privacy concern — FLAG FOR THE WEB BUILD

`wallets.json` contains **personal data**: 769 real Discord display names + usernames linked to their blockchain wallet addresses. In the mobile app this ships inside the binary; on GitHub Pages it becomes a **publicly crawlable static JSON** and the tool a public people-search. Before publishing: (a) confirm the dataset was collected with consent for public listing, (b) provide a removal/contact route, (c) consider `noindex` and/or not shipping the raw file (e.g. hashed lookups or on-demand loading), (d) document the data source. This is a policy decision for the site owner — the spec only flags it.

### 6.6 Wallet share card (`WalletShareCard`)

380px frame (bgDeepest, accentPrimary@8% gradient, borderSubtle):
1. `UNDERDECK · WALLET LOOKUP` mono 11/700/ls2 accentPrimary
2. `Query: "{query}"` mono 12 textSecondary
3. divider
4. Up to **6** owner blocks (`person` 14 + name in body + optional `@discord` mono 11 accentSecondary; each wallet on its own line, indented 20px, mono 10). Then, if present, `WALLET MATCHES` (mono 10/700/ls1.5 accentSecondary) and up to **8 + unusedOwnerSlots** deduped wallet-hit blocks (`wallet` 14 + wallet mono 11/600; `Registered to {name}` caption below).
5. `No matches.` caption when both lists empty. A `+{hidden} more` caption is coded but its arithmetic only counts hidden *owners* (`ownerHits.length − shownOwners`) — reproduce or fix at your discretion.
6. divider; footer `wallet` 9px + `Generated by Underdeck · ESBE blockchain analysis` mono 9 textDim.
File name: `underdeck-wallet-{epochMs}.png`, share text `Underdeck wallet lookup`.

---

## 7. ASTEROID ANALYZER (`/tools/asteroid`)

Decodes a 9-digit asteroid ID into characteristics using pure lookup tables. Fully offline.

### 7.1 ID format & validation (`AsteroidDecoder`)

Digit positions (1-based) of the 9-digit ID `d1 d2 d3 d4 d5 d6 d7 d8 d9`:

| pos | meaning | table |
|---|---|---|
| 1 | type (must be `1` = Asteroid) | `type` |
| 2 | size | `size` |
| 3 | structure | `structure` |
| 4 | salvage | `salvage` |
| 5 | wealth (raw digit 0–9, used as a number) | — |
| 6 | law | `law` |
| 7,8,9 | resources 1–3 | `resource` |

**Validation checklist** (each rule id / label / predicate; all must pass to enable Analyze):
1. `digits` — `Digits only (0–9)` — non-empty and `/^[0-9]+$/`
2. `length` — `Exactly 9 digits` — digits-only AND length == 9
3. `type` — `Position 1 = 1 (Asteroid)` — char[0] == '1'
4. `size` — `Position 2 (size) is 1–9` — char[1] exists, is a digit, ≠ '0'
5. `wealth` — `Position 5 (wealth) is 1–9` — char[4] ≠ '0'
6. `rss` — `Positions 7–9 (resources) are 1–9` — chars[6..8] all present and ≠ '0'

`analyze(raw, tables)` throws typed errors (surfaced verbatim in the error card):
- length ≠ 9 → `Asteroid ID must be exactly 9 digits.`
- non-digits → `Asteroid ID must contain digits only.`
Any lookup miss falls back to the `Unknown` entry `{name:'Unknown', emoji:'?'}` (no throw). Unexpected exceptions → error text `Unknown error.`

**Resource value formula**:
```
resourceValue = (value(d7) + value(d8) + value(d9)) × sizeMultiplier(d2) × wealth(d5)
// missing values count as 0; missing multiplier counts as 1.0
```
Display: integer when whole, else 1 decimal (same formatter used for the size multiplier suffix).

**Alerts** (appended in this exact order when their condition holds):

| condition | level | emoji | message |
|---|---|---|---|
| structure digit ≥ 5 | info | 🏗 | `This asteroid has significant infrastructure.` |
| any resource digit == 9 | high | 💎 | `Rare gas deposits detected!` |
| law digit == 0 AND any resource digit == 6 | critical | ⚠ | `Star-Tar deposits detected! Estimated harvest rate: {count}-{wealth}` where count = how many of the 3 resource digits equal 6 |
| law entry has `pvp == true` (only law 0) | warning | ⚔ | `Combat enabled zone, proceed with caution.` |

Alert tint by level: info → accentPrimary; warning/high → accentWarn; critical → accentDanger.

### 7.2 Lookup tables — `asteroid_tables.json` (complete)

```json
{
  "type": { "1": { "name": "Asteroid", "emoji": "🌑" } },
  "size": {
    "1": { "name": "Small",        "emoji": "▫️", "multiplier": 1.0 },
    "2": { "name": "Moderate",     "emoji": "◽", "multiplier": 1.5 },
    "3": { "name": "Large",        "emoji": "⬜", "multiplier": 2.0 },
    "4": { "name": "Huge",         "emoji": "🟦", "multiplier": 2.5 },
    "5": { "name": "Enormous",     "emoji": "🟨", "multiplier": 3.0 },
    "6": { "name": "Massive",      "emoji": "🟧", "multiplier": 3.5 },
    "7": { "name": "Colossal",     "emoji": "🟥", "multiplier": 4.0 },
    "8": { "name": "Titanic",      "emoji": "🟪", "multiplier": 4.5 },
    "9": { "name": "Hypermassive", "emoji": "⬛", "multiplier": 5.0 }
  },
  "structure": {
    "0": { "name": "No structure", "emoji": "❌",  "risk": 0 },
    "1": { "name": "Niche",        "emoji": "🕳️", "risk": 1 },
    "2": { "name": "Cave",         "emoji": "🌑",  "risk": 1 },
    "3": { "name": "Debris",       "emoji": "🌠",  "risk": 2 },
    "4": { "name": "Probe",        "emoji": "🛸",  "risk": 2 },
    "5": { "name": "Shelter",      "emoji": "🏠",  "risk": 3 },
    "6": { "name": "Workshop",     "emoji": "🏭",  "risk": 3 },
    "7": { "name": "Trading post", "emoji": "🏪",  "risk": 4 },
    "8": { "name": "Hangar",       "emoji": "🚀",  "risk": 4 },
    "9": { "name": "Bunker",       "emoji": "🏰",  "risk": 5 }
  },
  "salvage": {
    "0": { "name": "No salvage",       "emoji": "❌",  "value": 0 },
    "1": { "name": "Oxygen reserve",   "emoji": "💨",  "value": 1 },
    "2": { "name": "Hydrogen reserve", "emoji": "💧",  "value": 1 },
    "3": { "name": "Scrap",            "emoji": "🔧",  "value": 2 },
    "4": { "name": "Supplies",         "emoji": "📦",  "value": 2 },
    "5": { "name": "OORT tools",       "emoji": "⚒️", "value": 3 },
    "6": { "name": "OORT blaster",     "emoji": "🔫",  "value": 3 },
    "7": { "name": "OORT cannon",      "emoji": "💥",  "value": 4 },
    "8": { "name": "OORT tech",        "emoji": "🔮",  "value": 4 },
    "9": { "name": "OORT vessel",      "emoji": "🛸",  "value": 5 }
  },
  "law": {
    "0": { "name": "No law",      "emoji": "🏴‍☠️", "pvp": true  },
    "1": { "name": "Drones",      "emoji": "🤖",   "pvp": false },
    "2": { "name": "Drones",      "emoji": "🤖",   "pvp": false },
    "3": { "name": "Drones",      "emoji": "🤖",   "pvp": false },
    "4": { "name": "Drones",      "emoji": "🤖",   "pvp": false },
    "5": { "name": "Drones",      "emoji": "🤖",   "pvp": false },
    "6": { "name": "Manned ship", "emoji": "👮",   "pvp": false },
    "7": { "name": "Manned ship", "emoji": "👮",   "pvp": false },
    "8": { "name": "PvP",         "emoji": "⚔️",  "pvp": false },
    "9": { "name": "PvP",         "emoji": "⚔️",  "pvp": false }
  },
  "resource": {
    "1": { "name": "Hydrogen", "symbol": "H2",          "emoji": "💧",  "value": 1 },
    "2": { "name": "Oxygen",   "symbol": "O",           "emoji": "💨",  "value": 1 },
    "3": { "name": "Helium",   "symbol": "He",          "emoji": "🎈",  "value": 2 },
    "4": { "name": "Nitrogen", "symbol": "N",           "emoji": "❄️", "value": 2 },
    "5": { "name": "Carbon",   "symbol": "C",           "emoji": "⚫",  "value": 3 },
    "6": { "name": "Methane",  "symbol": "CH4",         "emoji": "🔥",  "value": 3 },
    "7": { "name": "Ethane",   "symbol": "C2H6",        "emoji": "🌡️", "value": 4 },
    "8": { "name": "Argon",    "symbol": "Ar",          "emoji": "✨",  "value": 4 },
    "9": { "name": "RareGas",  "symbol": "Kr/Ne/Rn/Xe", "emoji": "💎",  "value": 5 }
  }
}
```
Entry schema: `{ name: string (default 'Unknown'), emoji: string (default '?'), multiplier?: number, risk?: int, value?: int, pvp?: bool, symbol?: string }`.
Note: law digits 8/9 are named "PvP" but have `pvp: false` — the combat alert only fires for law 0. Reproduce as-is.

### 7.3 Screen layout (`AsteroidAnalyzerView`)

AppBar: transparent, title `Asteroid Analyzer`. PageScrollView (top padding = safe-area + toolbar + 8):

1. **TransmissionHeader** — `ESSI · Asteroid Analysis Division`.
2. **TerminalNotes** — title `asteroid.notes`, lines (exact):
   1. `This tool is for players who own a UFO, the type of ship that can mine multiple resources directly from asteroids.`
   2. `Some players own several UFOs, you can ask them to grant you pilot rights if you want to try the gameplay.`
   3. `Decomposing an asteroid's ID reveals its quality: resource composition, hazard level, size and other key characteristics.`
3. **Input card** (GlassCard): caption `Enter a 9-digit asteroid ID`; big numeric TextField — mono 26/600 textPrimary; placeholder `e.g. 195016321` (mono 24/600 textDim); numeric keyboard, digits-only, max length 9 (input sanitized on change: strip non-digits, clip to 9); underline border — `borderGlow` normally, **switches to `accentSuccess` when all validation rules pass** (focused: 2px). Any edit clears a previous result/error. Below (16px): NeonButton `Analyze` icon `graphic_eq`, **enabled only when all 6 rules pass**.
4. **"ID format" checklist card** — shown only while input is non-empty AND invalid: GlassCard with SectionHeader `ID format` icon `checklist`, then one row per rule (§7.1): `check_circle` in accentSuccess when satisfied / `cancel` in accentDanger when not; label 13/500, textPrimary when satisfied else textSecondary.
5. **Error card** — when analyze threw: GlassCard row `warning` icon accentDanger + message body.
6. **Report** (after successful analyze):
   - Terminal lines: `> decoding asteroid {id}…` and `> match found ✓` (terminal style).
   - **Alert boxes** (one per alert, in order): padding 12, radius 8, fill tint@12%, border tint@50%; emoji at 20px + message body.
   - **Wealth / value card** (GlassCard): left — caption `Wealth`, then 9 icons: `attach_money` (accentWarn) for i < wealth else `money_off` (textDim), 18px; caption `{wealth}/9`. Right (right-aligned) — caption `Resource value`, then the formatted number in mono 22/600 accentSecondary.
   - **Primary characteristics card**: SectionHeader `Primary characteristics`; rows (80px caption label / 18px emoji / name body / right-aligned caption suffix):
     - `Type` — no suffix
     - `Size` — suffix `×{multiplier}` (formatted, e.g. `×2.5`)
     - `Structure` — suffix `risk {n}`
     - `Salvage` — suffix `value {n}`
     - `Law` — no suffix
   - **Resources card**: SectionHeader `Resources`; one row per resource digit (3 rows, duplicates repeated): 22px emoji, name (body) over optional symbol (mono 11 textSecondary), right-aligned `{value} pts` caption (missing value → `0 pts`).

No share/favorite on this screen. Analyze blurs the input. Haptics: success on analyze, error on failure (web: drop).

---

## 8. Loading / error / empty-state matrix

| Screen | Loading | Error | Empty |
|---|---|---|---|
| Jobs | centered spinner (repo), inner spinner for list | centered "Couldn't load jobs." in accentDanger | §3.3 empty state (filtered vs unfiltered) |
| Filter sheet | opens only after data loads (counts precomputed) | n/a | footer shows `0 results` |
| Fishing rooms/room | spinner | "Couldn't load the fishing data." | `Room not found` for bad roomId; grid can be empty after filters (renders nothing) |
| Mars Express | spinner | "Couldn't load the schedule." | LIVE card shows `Idle` when no stop matches the minute (never happens with shipped data) |
| Wallet | spinner | "Couldn't load wallet data." | blank query → overview card; no hits → `No matches` card |
| Asteroid | spinner (tables) | "Couldn't load the asteroid tables." | n/a (input-driven) |

No pull-to-refresh anywhere in this area; all data is static. No request cancellation (no network). No debounce on any search input.

---

## 9. Open questions / porting notes

1. **Duplicate job id**: `jobs.json` has 371 entries but only 370 unique ids — id `30107301` appears twice. Favorites/status key on the stringified id, so both duplicates share stars/status; React list keys must not assume uniqueness.
2. **Filter-sheet live count vs list count**: the sheet's footer count ignores the starred/status companion filters, so after Apply the visible list can be smaller than the promised count when quick-filters are active. Reproduced behavior — confirm whether to fix.
3. **Bonus slider granularity**: 50 divisions over −2740…500 gives non-integer steps (64.8). Labels round to integers. Decide whether to keep divisions or use step=1 on web.
4. **`mapRef` cross-links** (jobs + fishing zones) point at the dynamic-maps area via `underdeck://map/{mapId}?zone={zoneId}` — dormant in shipped data but the "View on map" button must exist; coordinate the URL scheme with the maps-area spec.
5. **Mars Express web notifications**: no server ⇒ no push; see §5.9 for the recommended tab-open-only design. Decide how much of the slot/budget machinery to keep.
6. **wallets.json GDPR exposure** on a public static site (§6.5) — needs an owner decision before launch.
7. **Wallet share card `+N more`** arithmetic only counts hidden owners (likely a bug) — reproduce or fix.
8. **Fishing `isMapRoom`** is parsed but unused by the UI; retain in the type for parity.
9. **Job filter state lifetime**: in-memory for the app session (survives route changes, lost on reload). Decide whether to persist to URL params/localStorage on web.
10. The jobs "about" sheet references the **in-app Contact form** and **project Discord** — those live in the menu area; link targets needed from that spec.

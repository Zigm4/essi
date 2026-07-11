# Underdeck — Data & Platform Layer Specification

Area: `data-layer`
Source paths covered:
- `lib/data/database/` (app_database.dart + tables/)
- `lib/services/` (data_export.dart, backup_reminder.dart, backup_controller.dart, app_settings.dart, notifications.dart, notifications/, haptics.dart, share_card.dart)
- `lib/core/platform/` (device_label, disk_full, file_saver, xfile_image — io/web splits)
- `lib/core/logging.dart`, `lib/core/error_text.dart`
- Maps persistence that lives on this layer: `lib/features/knowledge/maps/data/` (map_blob_store.dart, map_seed_importer.dart, map_content_repository.dart — prefs keys + Drift tables), `lib/features/favorites/data/favorites_repository.dart`, `lib/features/knowledge/maps/data/map_pins_repository.dart`, `lib/features/tools/history/history_repository.dart`
- All SharedPreferences keys across `lib/`

This document is the ONLY source for re-implementing the persistence & platform layer as a Vite + React + TypeScript web app on GitHub Pages. Where behavior is mobile-specific, a web equivalent is proposed and flagged.

---

## 1. Architecture overview

The app is **local-only**: all user data lives on-device. There is no account, no server sync. Three storage mechanisms exist:

1. **Drift (SQLite)** relational database, file name `underdeck` (opened via `driftDatabase(name: 'underdeck')` from `drift_flutter`, i.e. `underdeck.sqlite` in the app-support directory). 15 relational tables + 1 FTS5 virtual table. Schema version **5**.
2. **SharedPreferences** for settings, small flags, and the armed-train-alert state (JSON string).
3. **Filesystem** for:
   - the content-addressed **map blob store** (`<appSupport>/maps_store/blobs/<sha256>`),
   - **auto-backup JSON files** (`<Documents>/backups/underdeck-backup-<stamp>.json`),
   - temp share files (`<temp>/underdeck-export.json`, temp PNGs).

State management is Riverpod. All DB reads that back lists use drift `watch()` streams so UI updates live. The database provider:

```dart
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});
```

`SharedPreferences` is loaded once in `main()` and injected via `sharedPreferencesProvider` (throws `UnimplementedError` if not overridden — override happens in `main()` with `sharedPreferencesProvider.overrideWithValue(prefs)`).

### Proposed web mapping (summary)

| Flutter mechanism | Web equivalent |
|---|---|
| Drift/SQLite `underdeck` DB | **IndexedDB** (one DB `underdeck`, object stores per table; see §10 for full schema proposal). Alternative: sql.js/wa-sqlite + OPFS if FTS-quality search is needed. |
| SharedPreferences | `localStorage` (same key names; see §6) |
| Map blob store (files by sha256) | IndexedDB object store `map_blobs` keyed by sha256 (Blob values), or Cache API |
| Documents auto-backup | **Drop** (no silent file writes on web) — the Settings toggle is hidden on web by product decision |
| Share sheet (JSON/PNG) | Browser download (Blob + object URL + `<a download>` click) — this is exactly what the existing `file_saver_web.dart` does |
| Local notifications (train alerts) | **Drop** (product decision for the existing web build: Mars Express hides arm/repeat/cancel behind `kIsWeb` and shows a "mobile app only" note) |
| Haptics | `navigator.vibrate()` best-effort or drop |
| File picker (import) | `<input type="file" accept="application/json">` |

---

## 2. Drift database

### 2.1 Opening & pragmas

- File/database name: `underdeck`.
- `schemaVersion = 5`.
- `beforeOpen`: executes `PRAGMA foreign_keys = ON` on **every** connection (SQLite does not persist it). In debug builds it additionally runs `PRAGMA foreign_key_check` and asserts zero violations.
- `onCreate`: `createAll()` for the 15 registered tables + raw creation of the FTS5 table (below).

### 2.2 Column type storage conventions (drift defaults; no build.yaml overrides)

- `TextColumn` → SQLite `TEXT`.
- `IntColumn` → `INTEGER`.
- `BoolColumn` → `INTEGER` 0/1.
- `DateTimeColumn` → `INTEGER`, **unix epoch seconds** (drift default). All timestamps in the DB are second-precision.

For the web rewrite: store dates as epoch milliseconds or ISO strings in IndexedDB — but preserve the export format (ISO-8601 UTC strings, see §4).

### 2.3 Tables (exhaustive)

All primary keys are explicit; there are no autoincrement ids anywhere. All ids of user content are client-generated **UUID v4** strings (package `uuid`).

#### `notes` (class `Notes`, file `tables/notes_table.dart`)
| column | type | null | default | notes |
|---|---|---|---|---|
| id | TEXT | no | — | PK, uuid v4 |
| title | TEXT | no | `''` | |
| body | TEXT | no | `''` | |
| createdAt | DATETIME | no | — | |
| updatedAt | DATETIME | no | — | |

#### `links` (class `Links`)
| column | type | null | default |
|---|---|---|---|
| id | TEXT | no | — (PK) |
| title | TEXT | no | `''` |
| url | TEXT | no | `''` |
| note | TEXT | no | `''` |
| createdAt | DATETIME | no | — |
| updatedAt | DATETIME | no | — |

#### `tags` (class `Tags`)
| column | type | null | default | notes |
|---|---|---|---|---|
| id | TEXT | no | — | PK |
| displayName | TEXT | no | — | as typed by user |
| name | TEXT no | — | | **UNIQUE** — the lowercase dedupe key (F44). Same tag can't exist twice under different ids. |
| colorHex | TEXT | yes | — | e.g. `#4FC3FF`-style string or null |

#### `note_tags` (class `NoteTags`) / `link_tags` (`LinkTags`) / `ship_tags` (`ShipTags`)
Join tables, all identical in shape:
| column | type | constraint |
|---|---|---|
| noteId / linkId / shipId | TEXT | FK → parent table `id`, **ON DELETE CASCADE** |
| tagId | TEXT | FK → `tags.id`, **ON DELETE CASCADE** |
Composite PK: `(parentId, tagId)`. Requires `PRAGMA foreign_keys=ON` (set in beforeOpen).

#### `ships` (class `Ships`) — the Hangar feature
| column | type | null | default |
|---|---|---|---|
| id | TEXT | no | — (PK) |
| name | TEXT | no | `''` |
| modelKey | TEXT | yes | — |
| customModelLabel | TEXT | yes | — |
| registered | BOOL | no | `false` |
| locationKey | TEXT | yes | — |
| customLocation | TEXT | yes | — |
| locationZone | INT | yes | — |
| locationSector | TEXT | yes | — |
| locationSL | INT | yes | — |
| hull | INT | yes | — |
| pilotName | TEXT | yes | — |
| gunnerName | TEXT | yes | — |
| cartographerName | TEXT | yes | — |
| prospectorName | TEXT | yes | — |
| signallerName | TEXT | yes | — |
| technicianName | TEXT | yes | — |
| sentryName | TEXT | yes | — |
| fabricatorName | TEXT | yes | — |
| medicName | TEXT | yes | — |
| quartermasterName | TEXT | yes | — |
| chefName | TEXT | yes | — |
| alchemistName | TEXT | yes | — |
| note | TEXT | no | `''` |
| createdAt | DATETIME | no | — |
| updatedAt | DATETIME | no | — |

(The 12 crew-name columns correspond to the game's 12 crew roles.)

#### `scan_history` / `tracker_history` / `discovery_history` (classes `ScanHistory`, `TrackerHistory`, `DiscoveryHistory`)
Three tables, identical shape:
| column | type | null | default | notes |
|---|---|---|---|---|
| id | TEXT | no | — | PK, uuid v4 |
| date | DATETIME | no | — | when the run happened |
| mode | TEXT | no | — | scan: `'light'`/`'full'`; tracker: `'asteroid'`/`'comet'` (CelestialKind.id); discovery: `'asteroid'`/`'comet'` |
| payloadJson | TEXT | no | — | JSON blob, schemas in §3 |
| errored | BOOL | no | `false` | run finished with partial errors |

Shared read behavior (`HistoryRepository`, `lib/features/tools/history/history_repository.dart`):
- `kHistoryLimit = 100`: every history list query is `ORDER BY date DESC LIMIT 100`. Older rows stay on disk but are never loaded.
- Payload is decoded **lazily** per row (`detail` getter caches after first decode); a corrupt payload degrades a single tile, never the whole list (the stream maps a row-level `entryFromRow` failure to skipping that row, with logging).
- `delete(id)` deletes a single row; `clear()` deletes all rows of that table.

#### `favorites` (class `Favorites`) — schema v3
| column | type | null | notes |
|---|---|---|---|
| entityType | TEXT | no | one of the `FavoriteKind` constants below |
| entityId | TEXT | no | id within the kind |
| createdAt | DATETIME | no | |
Composite PK `(entityType, entityId)` — an entity is favorited at most once.

`FavoriteKind` string constants (`lib/features/favorites/data/favorites_repository.dart`):
- `'job'`
- `'kb_article'`
- `'fishing_zone'`
- `'tracked_object'`
- `'map'` (dynamic map favorited from the maps gallery)
- `'map_zone'` (a single zone; entityId namespaced as `mapId/zoneId`)

Repository behavior: `toggle(kind, id)` — delete if present, else `insertOrReplace` with `createdAt = now`; returns new boolean state. `watchIds(kind)` → live `Set<String>`; `watchIsFavorite(kind, id)` → live bool.

#### `job_status` (class `JobStatus`) — schema v3
| column | type | null | notes |
|---|---|---|---|
| jobId | TEXT | no | PK — stringified job id |
| status | TEXT | no | one of `'todo'`, `'in_progress'`, `'done'` |
| updatedAt | DATETIME | no | |
A job with no row is implicitly `'todo'`.

#### `map_packs` (class `MapPacks`) — schema v4
Index over installed dynamic-map content packs (blob bytes live in the blob store).
| column | type | null | notes |
|---|---|---|---|
| contentVersion | TEXT | no | PK — semver-ish content string from the pointer |
| tag | TEXT | no | upstream git tag; the bundled seed uses `'seed'` |
| manifestSha256 | TEXT | no | pins the manifest blob so it can be re-read/validated offline |
| installedAt | DATETIME | no | |
| state | TEXT | no | one of `'installed'`, `'downloading'`, `'failed'` |

#### `map_pack_files` (class `MapPackFiles`) — schema v4
| column | type | null | notes |
|---|---|---|---|
| contentVersion | TEXT | no | PK part 1 |
| logicalPath | TEXT | no | PK part 2 — repo-relative path (`manifest.json`, map docs, images) |
| sha256 | TEXT | no | content address into the blob store; doubles as the GC reference set |
| bytes | INT | no | |
| kind | TEXT | yes | manifest hint: `'manifest'`, `'document'`, `'background'`, `'thumbnail'`, `'texture'`, `'asset'`, … nullable for forward compat |

A blob with no `map_pack_files` row for any installed pack is garbage-collectable.

#### `map_pins` (class `MapPins`) — schema v5
Personal per-zone notes on dynamic maps. Purely local user content (not part of any pack).
| column | type | null | default | notes |
|---|---|---|---|---|
| id | TEXT | no | — | PK, uuid v4 (survives export/import) |
| mapId | TEXT | no | — | deliberately NOT an FK (map content lives in the blob store; a pin must outlive a temporarily-uninstalled pack) |
| zoneId | TEXT | no | — | |
| note | TEXT | no | `''` | free text |
| createdAt | DATETIME | no | — | |
| updatedAt | DATETIME | no | — | |

`MapPinsRepository` semantics:
- UI invariant: **at most one pin per (mapId, zoneId)** — `savePin` creates-or-updates.
- `savePin(mapId, zoneId, note)`: trims the note; **empty/whitespace note = delete** the existing pin (a blank pin is never persisted). Insert sets `createdAt = updatedAt = now`; update only writes `note` + `updatedAt = now`.
- `watchForMap(mapId)` and `watchAll()` order by `updatedAt DESC` (newest-edited first).
- `watchPinnedZoneIds(mapId)` → live `Set<String>` of zoneIds for pin badges.

#### `map_zone_fts` — FTS5 virtual table (raw SQL, not in drift's table list)
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS map_zone_fts USING fts5(
  zone_id UNINDEXED,
  map_id UNINDEXED,
  name,
  fields_text,
  tokenize = 'unicode61 remove_diacritics 2'
);
```
- `zone_id`/`map_id` are stored but not tokenized (a match maps straight back to a zone without a join).
- Tokenizer `unicode61 remove_diacritics 2` → accent-insensitive, non-ASCII-capable search.
- Rebuilt wholesale (DELETE all + reinsert) on every pack install / seed import — it indexes exactly the single installed content version.
- Query: `SELECT zone_id, map_id, name FROM map_zone_fts WHERE map_zone_fts MATCH ? ORDER BY rank LIMIT ?` (default limit 50, bm25 relevance via `rank`).
- Match-expression sanitizer `ftsMatchExpression(query)`:
  - split on whitespace, drop empties; if no terms → return `null` (caller skips query entirely — a blank/operator-only query never errors);
  - each term wrapped in double quotes with internal `"` doubled (`t.replaceAll('"', '""')`) to neutralize FTS operators;
  - terms joined with a space (implicit AND);
  - the **last** term gets a `*` suffix (prefix match) so results appear while typing.
  - Any residual FTS syntax error is caught and returns `[]` (never a crash).

**Web note:** IndexedDB has no FTS. Options: (a) client-side index (e.g. MiniSearch/FlexSearch) rebuilt from installed zone data with a diacritics-stripping normalizer + prefix matching on the last token — this reproduces the behavior; or (b) wa-sqlite with FTS5 in a worker. (a) is recommended; the corpus is small (zones of installed maps).

### 2.4 Migrations (v1 → v5)

For the web rewrite these matter only if you version your IndexedDB schema; documented for completeness and for the merge-rule intent they encode.

- **v1 → v2** (F44/F46): adds `UNIQUE(tags.name)` and ON DELETE CASCADE FKs on the three join tables. Data cleanup before the constraint-adding table rebuild:
  1. Dedupe tags sharing the same lowercase `name`: first-seen id becomes canonical; join rows on duplicate tag ids are repointed to the canonical id (insertOrIgnore; collisions dropped as redundant); duplicate tag rows deleted.
  2. Delete orphan join rows (parent note/link/ship or tag missing).
  3. Rebuild `tags`, `note_tags`, `link_tags`, `ship_tags` via drift `TableMigration` (copies rows into the new schema).
- **v2 → v3** (P3/22): additive — create `favorites` + `job_status`.
- **v3 → v4** (maps M0): additive — create `map_packs` + `map_pack_files` + the `map_zone_fts` FTS5 virtual table (idempotent `IF NOT EXISTS`).
- **v4 → v5** (Phase E §6.1): additive — create `map_pins`.

---

## 3. History payload JSON schemas

Stored in `payloadJson` (TEXT) and validated at import time by round-tripping through the same `fromJson` used at read time.

### 3.1 scanHistory payload (mode `'light'` | `'full'`)
```jsonc
{
  "snapshots": [           // array of PlanetPosition
    {
      "name": "string",
      "emoji": "string",
      "sector": 1,          // int
      "distanceSL": 42,     // int
      "timestamp": "2026-01-01T12:00:00.000Z", // ISO-8601 UTC
      "nextChange": {       // optional (omitted when null)
        "date": "2026-01-02T00:00:00.000Z",
        "toSector": 2
      }
    }
  ]
}
```

### 3.2 trackerHistory payload (mode = CelestialKind.id: `'asteroid'` | `'comet'`)
Single `TrackerResult` object:
```jsonc
{
  "mpcID": "string",
  "displayName": "string",
  "kind": "asteroid",      // 'asteroid' | 'comet'
  "xAU": 1.23, "yAU": 4.56, "zAU": 0.78,   // doubles
  "sector": 3,             // int
  "distanceAU": 2.5,       // double
  "slExact": 123.4, "slRounded": 123.0,     // doubles
  "slFloor": 123,          // int
  "timestamp": "ISO-8601 UTC"
}
```

### 3.3 discoveryHistory payload (mode `'asteroid'` | `'comet'`)
```jsonc
{
  "startDate": "ISO-8601 UTC",
  "endDate": "ISO-8601 UTC",
  "results": [             // array of DiscoveredObject
    {
      "designation": "string",
      "fullName": "string",
      "firstObs": "string|null",   // date-ish string
      "lastObs": "string|null",
      "isHazardous": false,        // default false
      "diameterMeters": 140.0,     // double|null
      "albedo": 0.15,              // double|null
      "kind": "asteroid"
    }
  ]
}
```

---

## 4. Export / import (`lib/services/data_export.dart`)

### 4.1 Export format — `formatVersion = 1`

Top-level:
```jsonc
{
  "version": 1,
  "app": "Underdeck",
  "exportedAt": "<ISO-8601 UTC of DateTime.now().toUtc()>",
  "data": {
    "notes":            [ { "id", "title", "body", "createdAt", "updatedAt" } ],
    "links":            [ { "id", "title", "url", "note", "createdAt", "updatedAt" } ],
    "tags":             [ { "id", "displayName", "name", "colorHex" } ],   // colorHex may be null
    "noteTags":         [ { "noteId", "tagId" } ],
    "linkTags":         [ { "linkId", "tagId" } ],
    "shipTags":         [ { "shipId", "tagId" } ],
    "ships":            [ { ...all 26 ship fields, createdAt, updatedAt } ],
    "scanHistory":      [ { "id", "date", "mode", "payloadJson", "errored" } ],
    "trackerHistory":   [ { "id", "date", "mode", "payloadJson", "errored" } ],
    "discoveryHistory": [ { "id", "date", "mode", "payloadJson", "errored" } ],
    "favorites":        [ { "entityType", "entityId", "createdAt" } ],
    "jobStatus":        [ { "jobId", "status", "updatedAt" } ],
    "mapPins":          [ { "id", "mapId", "zoneId", "note", "createdAt", "updatedAt" } ]
  }
}
```
- Every DateTime is serialized `**.toUtc().toIso8601String()`.
- `payloadJson` is the raw stored JSON **string** (double-encoded inside the export).
- `favorites`, `jobStatus`, `mapPins` are **additive** arrays; old importers ignore unknown keys, old files simply lack them (treated as empty). `formatVersion` stays 1.
- Ship map field order (for byte-compat, not required): id, name, modelKey, customModelLabel, registered, locationKey, customLocation, locationZone, locationSector, locationSL, hull, pilotName, gunnerName, cartographerName, prospectorName, signallerName, technicianName, sentryName, fabricatorName, medicName, quartermasterName, chefName, alchemistName, note, createdAt, updatedAt.

### 4.2 Export file paths / names

- **Share export** (`exportToFile` + `shareExport`): a **single stable filename** `underdeck-export.json` in the temp dir, overwritten each time (R6 — plaintext exports must not accumulate). Shared via the OS share sheet with `mimeType: application/json` and intentionally **no share text** (E1 — user composes their own message). Returns the `ShareResult` so callers only mark "backed up" when the share wasn't dismissed.
- **Documents auto-backup** (`exportToDocuments`): writes `<Documents>/backups/underdeck-backup-<stamp>.json` then prunes to the newest `keep` files (default `BackupReminder.autoBackupKeep = 3`), matching prefix `underdeck-backup-`. Pruning = list files, sort by path descending (timestamped names sort lexically → newest first), delete everything after index `keep` (best-effort; deletion failures ignored).
- **Timestamp stamp** (`_stamp()`): `DateTime.now().toIso8601String()` with `:` and `.` → `-`, truncated to 19 chars (`YYYY-MM-DDTHH-MM-SS`), then `-<milliseconds, 3 digits>-<per-run sequence in base36, 4 digits zero-padded>`. Example: `2026-07-11T14-03-59-042-0001`. The monotonic per-run sequence guarantees two backups in the same millisecond get distinct, still lexically-ordered names (E10).

Web equivalent: share export → browser download of the JSON (already implemented in `file_saver_web.dart`: Blob → `URL.createObjectURL` → hidden `<a download>` click → revoke). Return a synthetic success so the "mark backed up" contract still fires. Documents auto-backup → **drop** (Settings toggle hidden on web).

### 4.3 Import — file picking

`importFromUserPick()` opens a file picker limited to JSON:
```dart
XTypeGroup(label: 'JSON', extensions: ['json'],
  mimeTypes: ['application/json'], uniformTypeIdentifiers: ['public.json'])
```
(uniformTypeIdentifiers is an iOS quirk — web just needs `accept="application/json,.json"`.) Cancelling returns `ImportSummary.empty()` (all-zero, no error).

### 4.4 Import — envelope validation

1. Read file text; `jsonDecode`. Parse failure → `FormatException("This file isn't a valid Underdeck export")` (F60 — never a raw parser dump).
2. Root must be a JSON object, else same message.
3. `version` must be an `int` and `<= 1`, else `FormatException("Unsupported export version: $version (expected ≤ 1)")` (note the `≤` character).
4. `data` must be an object, else the invalid-file message.
5. Any `TypeError` during record casting inside the import → the invalid-file message.

### 4.5 Import — merge rules (the whole import runs in ONE DB transaction)

Two tolerant date parsers:
- `parseDate(v)` (used for `createdAt` on INSERT): `DateTime.tryParse` if string, else **`DateTime.now()`** fallback — a malformed date never aborts the file.
- `parseUpdatedAt(v)` (used for newer-wins comparisons): `DateTime.tryParse` if string, else **epoch 0** fallback (E5 — an unreadable date must LOSE, never win; otherwise a corrupt row would always overwrite a newer local one).

Per-section rules:

**tags** (processed first):
- Per-row try/catch: a malformed row is logged (`data import: skipped malformed tag row`) and skipped (E8).
- `id` defaults to a fresh uuid v4 when missing. Key = `name` lowercased (missing name → `''`).
- If a local tag already has that `name` key → **skip the insert but remap** importedId → existing local id (H3 — join rows are preserved, not dropped).
- Else insertOrIgnore with `displayName` (defaults to the key when missing) and `colorHex`; record importedId → importedId in the remap; count it.
- `ensureTagId(id)`: resolve through the remap, then verify the tag row actually exists locally; returns null when it doesn't.

**notes / links / ships** (`insertSimple`, per-row try/catch, skipped rows logged `data import: skipped malformed row`):
- `id` defaults to uuid v4.
- If a row with the id exists locally: **newer-wins** — overwrite only when imported `updatedAt` is **strictly after** the local `updatedAt` (`!updatedAt.isAfter(exists.updatedAt) → return false`, not counted). The UPDATE **omits `createdAt`** (original creation timestamp preserved — F43).
- Else insertOrIgnore with `createdAt = parseDate(...)`, `updatedAt = parseUpdatedAt(...)`. Counted.
- Missing string fields default to `''`; missing `registered` → false; nullable ship fields pass through as null.

**noteTags / linkTags / shipTags** (`insertJoin`, per-row try/catch, log `data import: skipped malformed join row`):
- Skip when either id is missing.
- Skip when `ensureTagId(tagId)` is null (tag doesn't exist locally).
- Skip when the parent (note/link/ship) doesn't exist locally (F44 — hard FKs would otherwise abort the transaction).
- insertOrIgnore `(parentId, resolvedLocalTagId)`. Join rows are NOT counted in the summary.

**scanHistory / trackerHistory / discoveryHistory** (`insertHistory`, per-row try/catch covering cast+validate+write, logged):
- Validate the payload by round-tripping through the real `fromJson` path (F16):
  - scan: decode `payloadJson` (default `'{}'`); must be an object; every element of `snapshots` must parse as `PlanetPosition`.
  - tracker: decoded object must parse as `TrackerResult`.
  - discovery: `DateTime.parse(startDate)` and `endDate` must succeed; every `results` element must parse as `DiscoveredObject`.
- Invalid → skip row (a poisoned payload can never brick `watchAll()` later).
- Id exists locally → skip (histories are immutable; **no** newer-wins here), not counted (F36/F42 — count only genuinely new rows).
- Insert with `mode` defaults if absent: scan `'light'`, tracker `'asteroid'`, discovery `'comet'`; `payloadJson` default `'{}'`; `errored` default false; `date = parseDate(...)`.

**favorites** (per-row try/catch, log `data import: skipped malformed favorite row`):
- Whitelist `entityType` against `{job, kb_article, fishing_zone, tracked_object}` — note: `map` and `map_zone` are **NOT** in the import whitelist (they post-date it; likely an oversight — flag as an open question).
- `entityId` must be non-null, non-empty, and ≤ **256** chars (`maxEntityIdLength`).
- Existing `(entityType, entityId)` → skip (idempotent; original createdAt kept). Else insertOrIgnore, counted.

**jobStatus** (NOT wrapped per-row — a malformed row here would throw a TypeError, caught by the envelope handler → whole import fails with the invalid-file message; replicate or improve):
- `jobId` non-null/non-empty; `status` whitelisted against `{'todo','in_progress','done'}` else skip.
- Newer-wins on `updatedAt` (strictly after) — a stale imported row never regresses a locally-advanced job. Write mode: insertOrReplace. Counted on every accepted write.

**mapPins** (per-row try/catch, log `data import: skipped malformed map pin row`):
- `id` non-empty and ≤ **128** chars (`maxMapPinIdLength`); `mapId`, `zoneId` non-null/non-empty.
- `note` defaults `''`; **truncated to 20000 chars** (`maxMapPinNoteLength`).
- Newer-wins on `updatedAt` (strictly after). insertOrReplace, counted.

### 4.6 `ImportSummary`

Fields (all int, default 0): `notes, links, tags, ships, scanHistory, trackerHistory, discoveryHistory, favorites, jobStatus, mapPins`. `isEmpty` = sum == 0.

`describe()` copy — shown in a SnackBar after import:
- Empty: `Nothing imported.`
- Else comma-joined parts, each only when > 0, with these exact pluralizations:
  - `{n} note` / `{n} notes`
  - `{n} link(s)`
  - `{n} tag(s)`
  - `{n} ship(s)`
  - `{n} scan(s)`
  - `{n} track(s)`
  - `{n} discoveries` (always plural form used)
  - `{n} favorite(s)`
  - `{n} job status` / `{n} job statuses`
  - `{n} map note(s)`

Error copy on import failure (Settings view): if the exception is a `FormatException` show its `.message`, else `Import failed`.
Error copy on export failure: `friendlyError(e, fallback: 'Export failed. Please try again.')` (see §9.4).

---

## 5. Backup reminder & auto-backup

### 5.1 Pure decision logic (`lib/services/backup_reminder.dart`)

Constants:
- `reminderThreshold = 30 days` — nag once data is older than this since last backup.
- `snoozeDuration = 7 days` — how long "Later"/dismiss hides the banner.
- `autoBackupChangeThreshold = 20` — DB write **batches** (not rows) after which auto-backup fires.
- `autoBackupKeep = 3` — auto-backup files kept in Documents.

`BackupStatus { bool hasData; DateTime? lastChangedAt; }` — computed by `DataExportService.backupStatus()` using cheap `COUNT(*)`/`MAX(ts)` aggregates over: notes.updatedAt, links.updatedAt, ships.updatedAt, scanHistory.date, trackerHistory.date, discoveryHistory.date, favorites.createdAt, jobStatus.updatedAt, mapPins.updatedAt. `hasData` = total count > 0; `lastChangedAt` = max timestamp across all (null when empty).

`daysSinceBackup({now, lastBackupAt})` → whole days, `null` if never backed up, clamped ≥ 0 (backwards clock → 0).

`shouldShowReminder({now, hasData, lastBackupAt, lastChangedAt, snoozedUntil, threshold=30d})`:
```
if (!hasData) return false;
if (snoozedUntil != null && now < snoozedUntil) return false;
changedSinceBackup = lastBackupAt == null || (lastChangedAt?.isAfter(lastBackupAt) ?? true);
if (!changedSinceBackup) return false;
if (lastBackupAt == null) return true;
return now - lastBackupAt >= threshold;
```

`lastBackupLabel({now, lastBackupAt})` exact strings:
- never → `never backed up`
- 0 days → `backed up today`
- 1 day → `last backup yesterday`
- else → `last backup {days} days ago`

### 5.2 Reminder banner (`lib/features/captures/widgets/backup_reminder_banner.dart`)

Rendered at the top of the Captures home view. Renders nothing unless `shouldShowReminder` is true (and while `backupStatusProvider` is loading).

Visuals:
- Container margin: LTRB (12, 8, 12, 0); padding 12 all sides.
- Background `accentWarn` `#FFB347` at 10% alpha; border 1px `accentWarn` at 45% alpha; radius 14 (`AppRadius.md`).
- Leading icon `Icons.backup_outlined`, 20px, color `#FFB347`.
- Title: `Back up your data` — body style (Inter 15) w600.
- Body (caption style, Inter 12 w500, color `#8AA4C2`): `Everything lives on this device only — {label}. Export a copy so an uninstall can't wipe it.` where `{label}` is `lastBackupLabel`.
- Buttons row: primary `Export now` (icon `Icons.upload`, 16px; label switches to `Exporting…` and disables while in flight; warn-tinted: border `#FFB347`@55%, fill `#FFB347`@12%, text `#FFB347` caption w600, padding h12 v8, radius 8) and subtle `Later` (transparent fill, border `borderSubtle` = `#7AE3FF`@12%, text `textSecondary` `#8AA4C2`). Disabled state = 50% opacity.
- Trailing close `Icons.close` 18px `textDim` `#6E8AAB`, semantics label `Dismiss backup reminder`.

Behavior:
- Export: haptic tap → `shareExport` anchored at the banner's rect → if `ShareResult.status != dismissed` → `markBackedUp()` + invalidate `backupStatusProvider`. (E1: platforms often report `unavailable` even on success, so anything that isn't an explicit dismissal counts as done.) Error → SnackBar `friendlyError(e, fallback: 'Export failed. Please try again.')`.
- Dismiss/Later: haptic tap → snooze until `now + 7 days`.

### 5.3 Auto-backup controller (`lib/services/backup_controller.dart`)

- `backupStatusProvider` = `FutureProvider.autoDispose<BackupStatus>` → `dataExportService.backupStatus()`; invalidated after any export/auto-backup.
- `AutoBackupController` is instantiated once at app root (`ref.watch(autoBackupControllerProvider)` in `UnderdeckApp.build`) and subscribes to `db.tableUpdates()` (one event per committed write batch).
- On each event: if `autoBackupEnabled` is off → reset counter to 0 and return. Else counter++. When counter ≥ 20:
  - if an export is already running → return **without resetting** (E7 — changes accruing mid-export stay counted and re-trigger after it finishes);
  - else reset counter, set running, `exportToDocuments()` (keep 3), then `markBackedUp()` (an auto-backup counts as a backup — keeps the banner quiet), invalidate `backupStatusProvider`. Failures logged (`Auto-backup to Documents failed: …`), never surfaced to UI.

Web: **drop** the whole auto-backup feature (hidden toggle), keep the reminder banner + manual export.

---

## 6. SharedPreferences — complete key registry

All keys, exact names, types, defaults, meaning. Proposed web storage: `localStorage` with identical keys (JSON-encode non-primitives; store dates as epoch-ms numbers stringified).

### 6.1 `lib/services/app_settings.dart` (AppSettingsNotifier)

| key | type | default | meaning |
|---|---|---|---|
| `settings.hapticsEnabled` | bool | `true` | vibrations on tap/save/selection |
| `settings.reduceAnimations` | bool | `false` | reduce-motion master switch (UI shows it inverted as "Animations") |
| `settings.fastBoot` | bool | `false` | skip the boot intro on launch |
| `settings.onboardingSeen` | bool | `false` | onboarding/intro completed once |
| `settings.lastBackupAt` | int (epoch **ms**) | absent (null) | when the user last exported/backed up by any path |
| `settings.backupReminderSnoozedUntil` | int (epoch ms) | absent (null) | banner hidden while now < this |
| `settings.autoBackupEnabled` | bool | `false` | opt-in Documents auto-export |
| `settings.mapsNetworkEnabled` | bool | **`true`** | master off-switch for ALL maps network access (fetch-by-default per owner decision) |
| `settings.mapsAutoUpdate` | bool | **`true`** | gates the throttled ≤1/24h pointer poll (inert when network disabled) |
| `settings.mapsLastSeenChangelogVersion` | string | absent (null) | maps contentVersion whose "What's new" banner was dismissed (once-per-version gate) |

State mutations of note:
- `markBackedUp([at])`: sets `lastBackupAt = at ?? now` (ms) AND **removes** `settings.backupReminderSnoozedUntil` (snooze cleared so the timer restarts from the new backup point).
- `snoozeBackupReminder(until)`: writes the ms value.
- `markMapsChangelogSeen(v)`: no-op when `v` empty or unchanged.

### 6.2 `lib/services/notifications.dart` (TrainAlertController)

| key | type | meaning |
|---|---|---|
| `trainAlert.zones` | string (JSON array) | current multi-zone armed state; see shape below. Removed when no zones armed. |
| `trainAlert.armed` | string (JSON object) | LEGACY single-zone shape `{"armedZone": int, "arrival": epochMs}` — migrated on load, removed on first persist |
| `trainAlert.didLegacyCleanup` | bool | one-shot sweep of pre-P2 notification ids completed (only set true on success, so failures retry next launch) |

`trainAlert.zones` element (`TrainAlertEntry.toJson`):
```json
{ "zone": 251, "slot": 0, "repeat": true, "lastArrival": 1767100000000 }
```
Load-time hygiene: entries parsed tolerantly (invalid → dropped; whole-string parse error → empty state, logged). Expired **one-shot** entries (lastArrival older than now−10s) are dropped; **repeating** entries are kept even when expired (refresh re-arms them).

### 6.3 Maps module

| key | type | meaning |
|---|---|---|
| `maps.pointerEtag` (`_kEtag`) | string | HTTP ETag of the last validated content pointer; persisted only after the whole pointer+manifest chain validated (so a partial failure re-fetches instead of 304-ing into a broken state). Removed by "Clear downloaded maps". |
| `maps.lastCheckAt` (`_kLastCheckAt`) | int (epoch ms) | last pointer check; enforces `checkInterval = 24h` throttle (bypassed by `force`). Recorded whenever a check actually ran, regardless of result. Removed on clear. |
| `maps.seedImported` | bool | LEGACY: seed imported/skipped once (maps to seed version `'0-seed'`) |
| `maps.seedImportedVersion` | string | contentVersion of the bundled seed last imported (or covered by real content). Import re-runs whenever the bundled manifest's contentVersion differs. `resetMapSeedImportGuard` removes both seed keys (Settings › Clear downloaded maps). |

### 6.4 Feature flags elsewhere

| key | type | meaning |
|---|---|---|
| `hangar.evilIntroSeen` | bool (default false) | the Hangar "evil ship" intro animation has been shown once |

---

## 7. Notification service (train alerts)

> **Web: DROP.** Product decision already made for the existing Flutter-web build: `lib/services/notifications/app_notifications_web.dart` is all no-ops (`requestPermissions` → false, `pendingIDs` → `[]`), and the Mars Express view hides arm/repeat/cancel controls on web, showing a "mobile app only" note instead. The React app should do the same. The full mobile behavior is documented below in case a future PWA wants Notification API + service-worker scheduling (note: the web Notifications API cannot schedule future local notifications reliably; that is why it was dropped).

### 7.1 Plugin surface (`AppNotifications`, static)

- Plugin: `flutter_local_notifications` ^18. `initialize()` (idempotent): timezone db init; Android init icon `ic_stat_underdeck` (white-on-transparent monochrome status-bar icon — F57: the full launcher icon renders as a gray square because Android masks to the alpha channel); iOS Darwin init with all permission prompts deferred (`requestAlertPermission/Badge/Sound: false`).
- `requestPermissions()`: iOS → request alert+sound (deny → false). Android → `requestNotificationsPermission()` (deny → false) then best-effort `requestExactAlarmsPermission()` (Android 12+; method absent on older versions → ignored). Returns true otherwise.
- `canScheduleExactAlarms()`: Android → `canScheduleExactNotifications() ?? true` (older Androids schedule exactly); non-Android → true. Backs the UI "approximate timing" hint.
- `schedule({id, title, body, when})`: converts to local TZ; **silently returns if the instant is already past**. Notification details:
  - Android channel id `mars_express`, name `Mars Express alerts`, description `Train arrival reminders`, importance high, priority high, icon `ic_stat_underdeck`;
  - iOS interruption level `timeSensitive`.
  - Schedule mode `exactAllowWhileIdle`, downgraded to `inexactAllowWhileIdle` when exact alarms unavailable (F25); a `PlatformException` on the exact attempt is logged and retried inexact (OEM policy safety) — arming never throws.
- `cancel(id)`, `pendingIDs()`, `cancelGroup({idMin,idMax})` (cancels pending ids in range), `cancelIds(ids)` (only ids actually pending).

### 7.2 Id allocation (`TrainAlertIds`, pure — `lib/features/tools/train/domain/mars_express_models.dart`)

- Reserved band: `bandMin = 70000` … `bandMax = 70999`.
- `alertsPerOccurrence = 3` (2 min before, 1 min before, on arrival).
- `repeatOccurrences = 6` — a repeating zone schedules the next 6 hourly occurrences ahead (no background execution: topped up when the app is open/resumed).
- `slotSize = 20` ids per slot → `slotCount = 1000 ~/ 20 = 50` slots.
- `slotBase(slot) = 70000 + slot*20`; `alertId(slot, occurrence, alertIndex) = slotBase + occurrence*3 + alertIndex`.
- `pendingBudget = 60` — global cap on pending notifications across all armed zones (iOS silently keeps only the nearest 64 pending; staying under it means the farthest alerts are never dropped without notice).
- `lowestFreeSlot(used)` → first slot index 0..49 not in use, else null (band full).
- Legacy pre-P2 ids: `70000 + zone*10 + i` for zones 234–346, i 0–9 — outside the band; swept once per install (`trainAlert.didLegacyCleanup`).

### 7.3 Controller behavior (`TrainAlertController`)

- All mutators (arm / cancelZone / cancelAll / refresh / legacy cleanup) are **serialized on a single chained future** (E2) so their many awaits can't interleave (a concurrent cancel must win; a cancelled zone must never be resurrected).
- **arm(zone, stops, repeat)** outcomes (`ArmOutcome` enum) and the exact UI copy they trigger (SnackBars in Mars Express view):
  - `armed` — success haptic, sheet closes, no message.
  - `armedTruncated` — success haptic + SnackBar: `Alert armed, but some later occurrences were skipped — too many zones are armed at once. Cancel a zone to cover them.`
  - `permissionDenied` — error haptic + `Notifications are turned off. Enable them for Underdeck in system settings to arm alerts.`
  - `bandFull` — `Too many zones are armed. Cancel one before arming another.`
  - `budgetFull` — `The notification limit is full. Cancel an armed zone to make room.`
  - `nothingToSchedule` — `The next arrival is too soon to schedule alerts. Try again once there's more time before it.`
- Arm algorithm: request permissions → reuse the zone's existing slot or claim lowest free → compute the zone's planned alert instants (dedup by DateTime; drop instants < 2s away) → budget them against the OTHER zones' **actual OS-pending** ids in the band (`planWithinBudget`: keep the nearest-in-time `budget - othersPending` instants, farthest dropped; `full` when remaining ≤ 0) → cancel this slot's ids → schedule the kept instants → persist entry `{zone, slot, repeat, lastArrival}`. If nothing was schedulable, drop any stale entry and report honestly (E4).
- Notification copy: title `Mars Express → Zone {zone}`; body `Train arriving at Zone {zone} in 2 minutes.` / `… in 1 minute.` / `Train arriving at Zone {zone} now.`
- **refresh(stops)** — fire-and-forget from a 5-second UI ticker and on app resume; errors swallowed+logged. Drops expired one-shots; for repeating zones whose occurrence horizon shifted, cancels + reschedules the slot within budget and updates `lastArrival`. Results are merged onto the **current** state at commit time (`mergeRefresh` — a zone cancelled or re-armed mid-pass keeps the current state; zones added concurrently are kept). State persisted only when actually changed.
- Occurrence math (`MarsExpressService.nextOccurrences`): schedule minutes for the zone recur hourly; returns the next `count` instants strictly after `now`, anchored at the top of the current hour, guard-capped at `count+2` hour cycles.

---

## 8. Platform abstraction layer (`lib/core/platform/`)

Each facade uses Dart conditional exports: `export 'x_io.dart' if (dart.library.js_interop) 'x_web.dart';`. The React app needs only the web behavior; io behavior documented for parity.

### 8.1 `device_label.dart` — `platformDeviceLabel()`
- io: `'{Platform.operatingSystem} {Platform.operatingSystemVersion}'` (e.g. `ios 18.2 …`). Used by the Contact view's auto-included "Device:" line.
- web: returns the literal `'Web'`.
- React: return `'Web'` (or `navigator.userAgentData?.platform` if you want more).

### 8.2 `disk_full.dart` — `isDiskFullError(Object e)`
- io: true when `FileSystemException` with POSIX `ENOSPC` (osError.errorCode == 28). Used by the maps seed importer to show the dedicated "Storage full — free up space and retry." empty state.
- web: always false.
- React: catch `DOMException` `QuotaExceededError` from IndexedDB writes if you want the equivalent state; otherwise always false.

### 8.3 `file_saver.dart` — three functions
- `shareJsonExport({json, fileName, sharePositionOrigin}) → ShareResult`
  - io: write to `<temp>/<fileName>` (stable name, overwritten), OS share sheet, mimeType `application/json`, no prefilled text.
  - web: browser download (Blob → object URL → hidden anchor with `download=fileName` → click → remove → revokeObjectURL); returns synthetic success (`ShareResult('web-download', success)`) so "mark backed up" fires. `sharePositionOrigin` ignored.
- `sharePngBytes({bytes, fileName, text, sharePositionOrigin})`
  - io: temp PNG + share sheet with `text`.
  - web: browser download of the PNG; the share `text` is dropped (no equivalent).
- `saveJsonBackupToDocuments({json, fileName, prunePrefix, keep})`
  - io: `<Documents>/backups/<fileName>` + prune to newest `keep` by `prunePrefix` (reverse lexical path sort).
  - web: `throw UnsupportedError('Documents auto-backup is not supported on web')` — unreachable because the feature is hidden on web.
- React: implement the download helper once:
  ```ts
  function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string) {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  ```
  Optionally offer `navigator.share({files})` (Web Share API Level 2) when available, falling back to download.

### 8.4 `xfile_image.dart` — `xfileImage(file, {width,height,fit,errorBuilder})`
- io: `Image.file(File(path))`; web: `Image.network(path)` (the web picker's XFile path is a blob URL). Attachments are mobile-only today.
- React: `<img src={URL.createObjectURL(file)}>`.

---

## 9. Other services

### 9.1 Haptics (`lib/services/haptics.dart`)
Gated by `settings.hapticsEnabled`. Mapping: `tap()` → lightImpact; `selection()` → selectionClick; `success()`/`warning()` → mediumImpact; `error()` → heavyImpact. Fired around: taps on action rows, save success, arm/cancel alerts, banner actions, toggles.
Web: `navigator.vibrate(10/20/40)` best-effort behind the same setting, or drop entirely (desktop browsers ignore it). Suggested: **drop**, keep the setting hidden.

### 9.2 Share card (`lib/services/share_card.dart`)
Captures an arbitrary widget offscreen into a PNG (width 380 logical px default, pixelRatio 3.0, text scaling pinned to 1.0 so large system fonts don't bake clipped text — F69) and shares it with default text `Underdeck capture`. Failure SnackBar copy: `Couldn't create the share image — try again` on `accentDanger` `#FF5577` background. iPad share popover requires an anchor rect (`originRectFor` — the tapped widget's global rect, fallback 1×1 at screen center).
Web equivalent: render the share card as a hidden DOM node → `html2canvas`-style rasterization or SVG `foreignObject` → canvas → `canvas.toBlob('image/png')` → download (or Web Share API). PixelRatio 3 ≈ `canvas.scale(3)`.

### 9.3 Logging (`lib/core/logging.dart`)
`logError(error, [stack])` — single sink: debug-print in debug builds + pluggable `ErrorReporter` seam (`setErrorReporter`, no-op by default; intended single wiring point in main for Sentry etc.). All caught/uncaught errors flow through it (`runZonedGuarded`, `FlutterError.onError`, `PlatformDispatcher.onError`).
React: a `logError(e, stack?)` util wrapping `console.error` + optional reporter; wire `window.onerror`/`onunhandledrejection`.

### 9.4 Friendly errors (`lib/core/error_text.dart`)
`friendlyError(error, {fallback = 'Something went wrong. Please try again.'})`:
- Dio transport errors (connectionError/connectionTimeout/sendTimeout/receiveTimeout) → `No network connection. Check your signal and try again.`
- Dio cancel → `Request cancelled.`
- Dio badResponse/badCertificate/unknown → `Couldn't reach the server. Please try again.`
- `FormatException` with non-empty message → that message (curated, user-facing).
- Anything else → the fallback. Raw exception text never reaches the UI.
React: same function keyed on fetch/AbortError/HTTP status.

### 9.5 App boot wiring relevant to this layer (`lib/main.dart`)
- `AppNotifications.initialize()` is attempted before `runApp`; a failure is logged and boot continues (never a blank screen).
- `SharedPreferences.getInstance()` awaited before `runApp`; injected via provider override.
- Font OFL licenses registered from assets (see §11).
- System nav bar color `#03060B` (bgDeepest).

---

## 10. Proposed IndexedDB schema (web)

Database `underdeck`, version 1 (bump for future migrations):

| object store | keyPath | indexes | mirrors |
|---|---|---|---|
| `notes` | `id` | `updatedAt` | Notes |
| `links` | `id` | `updatedAt` | Links |
| `tags` | `id` | `name` (unique) | Tags |
| `noteTags` | `[noteId, tagId]` | `noteId`, `tagId` | NoteTags |
| `linkTags` | `[linkId, tagId]` | `linkId`, `tagId` | LinkTags |
| `shipTags` | `[shipId, tagId]` | `shipId`, `tagId` | ShipTags |
| `ships` | `id` | `updatedAt` | Ships |
| `scanHistory` | `id` | `date` | ScanHistory |
| `trackerHistory` | `id` | `date` | TrackerHistory |
| `discoveryHistory` | `id` | `date` | DiscoveryHistory |
| `favorites` | `[entityType, entityId]` | `entityType` | Favorites |
| `jobStatus` | `jobId` | — | JobStatus |
| `mapPacks` | `contentVersion` | `state` | MapPacks |
| `mapPackFiles` | `[contentVersion, logicalPath]` | `sha256` | MapPackFiles |
| `mapPins` | `id` | `[mapId+zoneId]`, `updatedAt` | MapPins |
| `map_blobs` | `sha256` | — | filesystem blob store (values: Blob) |

Notes:
- **Cascade deletes must be done manually** (IndexedDB has no FKs): deleting a note/link/ship/tag must delete its join rows in the same transaction; deleting a tag must delete rows in all three join stores.
- Tag-name uniqueness: enforce via the unique index on `tags.name` (lowercased before write) and replicate the import remap logic.
- Reactive reads: wrap stores in a small pub/sub (or use Dexie's `liveQuery`) to reproduce drift `watch()` semantics — every list in the app expects live updates.
- The 100-row history cap is a query-level LIMIT, not a storage cap — replicate with a cursor that stops at 100 (ordered by the `date` index descending).
- FTS: see §2.3 (`map_zone_fts`) — use an in-memory search index rebuilt on install.
- `tableUpdates()`-equivalent for auto-backup is unnecessary (feature dropped), but the same pub/sub can drive the backup-status invalidation.

localStorage keys: identical names to §6. Booleans as `'true'|'false'`, dates as stringified epoch-ms, `trainAlert.zones` unnecessary (feature dropped).

---

## 11. Maps persistence internals (blob store, seed, updates)

Included here because it is persistence; the maps UI belongs to the knowledge area spec.

### 11.1 Blob store (`map_blob_store.dart`)
- Location: `<appSupport>/maps_store/blobs/<sha256>` (lowercase hex sha256 IS the filename).
- `write(bytes, expectedSha256)`: verifies hash (mismatch → `BlobIntegrityException`, nothing written), then atomic write (`.tmp.<pid>.<micros>` + rename; losing a rename race to an existing target is a no-op). Already-present blob → skip (content address = trust).
- `writeTrusted(bytes, sha256)`: skips re-verification — only for the bundled seed (already hashed in-process; authenticated by the app-store signature).
- `gc({keep})`: delete every file whose name is not in `keep` (union of manifestSha256s + all mapPackFiles sha256s of installed packs + caller pins). Returns count. Stale `.tmp` files are collected too.
- `totalBytes()`: best-effort sum of file sizes (drives Settings "Downloaded maps: X").
- Web: object store `map_blobs` (sha256 → Blob). Verify hashes with `crypto.subtle.digest('SHA-256', …)`. Large hash offload: the Flutter app hashes blobs ≥ 256 KiB (`_kIsolateHashThreshold = 256*1024`) on a background isolate; on web use a Worker or just `crypto.subtle` (already async).

### 11.2 Content endpoints & update check (`map_content_repository.dart`)
- Repo slug: `underpunks55/underdeck-content`.
- URLs: primary jsDelivr `https://cdn.jsdelivr.net/gh/underpunks55/underdeck-content@{tag}/{path}`; fallback `https://raw.githubusercontent.com/underpunks55/underdeck-content/{tag}/{path}`.
- `compareContentVersions(a, b)`: split on `[.\-+]`, numeric compare component-wise, non-numeric/missing → 0 (sorts low).
- `checkForUpdate({networkEnabled, appVersion, force})` outcomes: `MapUpdateDisabled` (network off), `MapUpdateThrottled` (< 24h since `maps.lastCheckAt` and not forced), `MapUpToDate` (ETag 304, or pointer version ≤ installed — anti-rollback), `MapUpdateBlockedByAppVersion(minAppVersion)` (pointer requires newer app), `MapUpdateCheckFailed(error)` (never throws), `MapUpdateAvailable(pointer, manifest, manifestBytes)`.
- ETag (`maps.pointerEtag`) persisted only after the full pointer+manifest chain validates.
- `install(...)`: manifest blob stored (hash pinned by pointer); for each non-draft map, document + assets fetched with sha256 verification and size caps (`MapLimits.documentMaxBytes` / `maxImageBytes` / `manifestMaxBytes`), skipping blobs already on disk (differential reuse); transactional commit of `mapPacks` (insertOnConflictUpdate, state `'installed'`), full `mapPackFiles` replacement for that contentVersion, FTS wholesale rebuild; then `gc`.
- `clearAllContent()` (Settings › Clear): delete all mapPackFiles + mapPacks rows + FTS rows in one transaction, GC everything, remove `maps.pointerEtag` + `maps.lastCheckAt`. Caller also calls `resetMapSeedImportGuard` + invalidates providers so the bundled seed re-imports.

### 11.3 Seed import (`map_seed_importer.dart`)
- Bundled seed manifest asset: `assets/maps_seed/manifest.json`; its background image reuses `assets/knowledge/images/hideous-dungeon-map.jpg` (no duplicate binary).
- Seed contentVersion sorts below every real version (leading `0`, e.g. `'0-seed'`, `'0-seed-2'`) so real content always supersedes and anti-rollback never lets the seed clobber it.
- Guard: `maps.seedImportedVersion` (versioned; legacy bool `maps.seedImported` maps to `'0-seed'`). Re-imports when the bundled manifest's contentVersion differs (app update shipping new seed maps).
- Skips when real (non-`'seed'`-tag) content is installed (records the version, `contentAlreadyInstalled`).
- On failure the guard is NOT set (Retry re-runs). Failure UX contract: `diskFull` → "Storage full — free up space and retry." + Retry; otherwise → "Couldn't set up offline maps." + Retry.
- Import: loads each non-draft map's document/assets from the asset bundle, computes real sha256s and patches the manifest's placeholders, validates manifest + every document, writes blobs with `writeTrusted`, transactionally installs (dropping any older seed pack in the same transaction), rebuilds FTS.

---

## 12. Assets referenced by this layer

| asset path | used by |
|---|---|
| `assets/catalog/train_schedule.json` | `MarsExpressSchedule.load()` — array of `{minute: int, zone: int, name?: string}`, sorted by minute after load |
| `assets/catalog/tracked_objects.json` | `TrackerCatalog.load()` — array of `{name, identifier, type}`; load failure → empty catalog (logged) |
| `assets/maps_seed/manifest.json` | seed importer (plus every `path` it references inside `assets/…`) |
| `assets/knowledge/images/hideous-dungeon-map.jpg` | seed map background (referenced from the seed manifest) |
| `assets/fonts/Inter-Variable.ttf`, `JetBrainsMono-Variable.ttf`, `Quicksand-Variable.ttf` | bundled fonts (families `Inter`, `JetBrainsMono`, `Quicksand`) — nothing fetched from fonts.gstatic.com at runtime |
| `assets/fonts/Inter-OFL.txt`, `JetBrainsMono-OFL.txt`, `Quicksand-OFL.txt` | license texts registered in `main()` |
| Android drawable `ic_stat_underdeck` | notification status-bar icon (white-on-transparent monochrome) — drop on web |

---

## 13. Copy strings quick reference (this layer)

- Invalid import file: `This file isn't a valid Underdeck export`
- Version gate: `Unsupported export version: {version} (expected ≤ 1)`
- Import empty: `Nothing imported.`
- Import summary parts: see §4.6.
- Import generic failure: `Import failed`
- Export failure fallback: `Export failed. Please try again.`
- Share-image failure: `Couldn't create the share image — try again`
- Backup banner: `Back up your data` / `Everything lives on this device only — {never backed up|backed up today|last backup yesterday|last backup N days ago}. Export a copy so an uninstall can't wipe it.` / buttons `Export now`, `Exporting…`, `Later` / a11y `Dismiss backup reminder`
- Settings Data card: header `Data`, blurb `Backup or move your data between devices using a JSON file.`, rows `Export…`, `Import…`, toggle `Auto-backup` — `After you make a batch of changes, quietly save a timestamped safety copy inside the app and keep the latest few. For a file you control, use Export above to share the JSON somewhere durable.`
- Maps settings: `Interactive maps`, `Download interactive maps` — `Fetch new and updated maps from GitHub (Pages/Fastly + jsDelivr), at most once a day. Off keeps only what is already on your device.`; `Auto-update maps` — `Automatically check for newer map content in the background. Turn off to update only when you choose.`; `Installed version: {v|none}`; `Downloaded maps: {size|none|…}` + `Clear`; dialog `Clear downloaded maps?` — `This frees up space by removing downloaded map content. The built-in sample map is restored, and maps re-download the next time you open them (if downloads are on).` buttons `Cancel` / `Clear` (danger); failure `Could not clear maps. Try again.`
- Byte formatting (`_formatBytes`): 0 or less → `none`; units B/KB/MB/GB (1024 steps); <10 in-unit and unit≠B → 1 decimal, else 0 decimals (e.g. `9.5 MB`, `12 MB`).
- Train alert notifications & arm errors: see §7.3.
- Friendly network errors: see §9.4.

---

## 14. Open questions

1. **Favorites import whitelist omits `'map'` and `'map_zone'`** (`validFavoriteKinds` in data_export.dart only has job/kb_article/fishing_zone/tracked_object) while the app writes those kinds and exports them. Imported map/map-zone favorites are silently dropped. Bug or intent? Recommend adding both to the web import whitelist.
2. **`jobStatus` import rows are not per-row guarded** — a mistyped row (e.g. `updatedAt: 5`) throws a TypeError, which the envelope handler converts into the whole-file "isn't a valid Underdeck export" error, unlike every other section which skips per row. Replicate exactly or fix?
3. `lib/services/notifications/app_notifications_io.dart` / `_web.dart` exist (a platform split of the plugin surface for the web port) but nothing imports them yet — `notifications.dart` still contains its own identical `AppNotifications` and imports the plugin directly. Treat the split files as the authoritative web contract (all no-ops) — confirmed by their doc comments.
4. Similarly, `DataExportService` still uses `dart:io` directly rather than the `file_saver.dart` facade; the facade's io implementations are documented as byte-identical. The web app should follow the facade behavior.
5. Web storage durability: GitHub Pages + IndexedDB is evictable by the browser. The backup reminder (30-day nag) becomes MORE important on web; consider asking for `navigator.storage.persist()` and surfacing the result.
6. Exact behavior of `MapLimits` byte caps (manifestMaxBytes, documentMaxBytes, maxImageBytes) lives in the maps domain files (`map_models.dart`) — covered by the knowledge/maps area spec; values not duplicated here.
7. The export's `payloadJson` is a JSON **string** field (double-encoded). Keep it that way for cross-compatibility with mobile exports — the web app must be able to import files produced by the Flutter app and vice versa (same `formatVersion: 1`, same key names, same date encodings).

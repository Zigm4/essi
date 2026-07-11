# Audit digest — Underdeck web rewrite

**Area:** audit-digest
**Sources read (all in full):**
- `/Users/overthecloud/development/underdeck-app/AUDIT.md` (v1, 2026-07-09, 32.5 KB, French)
- `/Users/overthecloud/development/underdeck-app/AUDIT-V2.md` (v2, 2026-07-10, 61.4 KB, French, base HEAD `d74ff66`)
- `/Users/overthecloud/development/underdeck-app/docs/MIGRATION.md`
- `/Users/overthecloud/development/underdeck-app/docs/LIVE_ACTIVITY_PLAN.md`
- `/Users/overthecloud/development/underdeck-app/docs/content-repo/CONTRIBUTING-MAPS.md`
- `/Users/overthecloud/development/underdeck-app/docs/content-repo/content-ci.yml`
- `/Users/overthecloud/development/underdeck-app/docs/content-repo/schemas/pointer.schema.json`
- `/Users/overthecloud/development/underdeck-app/docs/content-repo/schemas/manifest.schema.json`
- `/Users/overthecloud/development/underdeck-app/docs/content-repo/schemas/map.schema.json`

**Purpose of this document:** the Flutter app is being recoded from scratch as a plain web app (Vite + React + TypeScript, GitHub Pages). This digest extracts from the two audits and docs/ everything the web team must know WITHOUT reading the Flutter code: (1) every known bug / design flaw the rewrite must NOT reproduce, with the audit-recommended fix; (2) architectural decisions already made; (3) product decisions still open; (4) the exact design of the planned GitHub content repository.

**Reading key.** AUDIT v1 IDs: `H*` = HIGH blockers, `F*` = confirmed findings. AUDIT v2 IDs: `R*` = residual debt, `P*` = iOS/Android parity, `E*` = fresh-eyes bugs in recent modules. Severity in v2: red = blocker, orange = serious, yellow = medium, blue = low. Most v1 findings were **fixed between v1 and v2** (v2 states: "78/78 tests green", "the bulk of v1's 74 findings has been corrected and verified by tests") — but for a from-scratch rewrite EVERY one of them is a trap the new code must not re-dig, so all are listed.

---

## 1. Context: what the audits say about the app

- **Underdeck** is an unofficial companion app (currently iOS + Android, Flutter) for the game/community **Underpunks55**. Identity: cyberpunk "ESSI terminal" (glass cards, scanlines, hex grid, neon, haptics everywhere). Philosophy: **local-first, zero backend, zero telemetry, JSON export/import**, dark-only.
- Codebase at v2: 140 Dart files, 38,263 lines (8,654 generated). Feature-first layout `features/<x>/{data,domain,state,views,widgets}`; Riverpod; Drift/SQLite (schema v3 with tested migrations at v2 time; v4 planned for maps); go_router `StatefulShellRoute.indexedStack` with **5 tabs, ~20 routes**; dio (shared client, timeouts + bounded retry after v1 fixes); flutter_local_notifications + timezone; flutter_markdown (upstream-discontinued — see R3).
- **Feature inventory** (v1 §3 maturity table): Boot screen; Tools hub (8 tools: System Scan, Tracker, Discoveries/celestial, Asteroid Analyzer, Fishing Map, Mars Express (train), Jobs board, Wallet Lookup); Captures (notes + links, markdown, shared tags); Hangar (ship registry, 12 crew roles, EVIL-01 easter egg); Knowledge base (14 embedded markdown articles, 9 of which were placeholders); Menu/Settings (about, FAQ, disclaimer, contact, data export/import). Post-v1 additions verified in v2: favorites, onboarding, backup reminder, multi-zone Mars Express alerts, generic history layer.
- **Database:** `underdeck.sqlite`; tables: notes, links, tags, 3 composite-PK join tables (noteTags/linkTags/shipTags), ships (12 denormalized role columns), 3 structurally-identical history tables (opaque `payload_json`); client-side UUID v4 ids; reactive reads via `watch()`.
- **Network:** 3 JPL/NASA public endpoints, unauthenticated: Horizons (text API), SBDB (tracker), SBDB (celestial/discoveries). Scan is strictly sequential Mercury→Pluto with 200 ms spacing (deliberate rate-limit citizenship). Distances displayed in "SL" where **1 SL = 3 million miles**; sector = `atan2(y, x)` bucketed in **12 slices of 30°**.
- **Numbers that appear in copy/logic:** "371 jobs" hardcoded count (will drift — derive from data); fishing map: **96 zones, 92 of them "Unknown"**; asteroid alert threshold **140 m** diameter; SBDB query truncation at `limit=1000`; boot sequence 8–10 s; tracker catalogue of ~15 well-known bodies (copy wrongly said "About 60"); Mars Express train loops over **60 real minutes**, `train_schedule.json` = 60 minute→zone entries, real zone numbers range **234–346**; alerts at T-2 min / T-1 min / arrival.

### 1.1 Verdicts to keep in mind

- v1 verdict: "The project is good and must NOT be redone" — architecture healthy, real design system, exemplary user transparency ("how it works" sheets documenting endpoints, math, privacy). The **transparency posture is the brand** — every copy claim about network/storage must stay true in the web app.
- v2 §5 stack verdict: stay on Flutter, do not migrate (weighted 8.4–8.5/10 vs alternatives). **The user has since decided to rewrite as a web app anyway** — note that v2 §5 explicitly observes that in 2026 **the web stack is AHEAD of all native mobile bindings for interactive globes** ("MapLibre GL JS v5 with globe projection, globe.gl, three.js"), which strongly favors the web rewrite for the maps module: the audit's "Plan B" (bundled globe.gl/three.js in a WebView) becomes the *native* approach on the web.
- v2 App Store analysis (moot for GitHub Pages but explains the design): remote **content** (JSON, images, geometry) is data, not code — the rule adopted is "JS/HTML always bundled, only JSON travels".

---

## 2. KNOWN BUGS & DESIGN FLAWS the web rewrite must NOT reproduce

Grouped by domain. Each entry: what went wrong → the fix the audit recommends → web-rewrite note. Flutter-only items are marked **[drop/web-N/A]** but still listed for completeness.

### 2.1 Export / import pipeline (the single data-safety net — highest-value section)

The app is local-first with no backend; the JSON export/import IS the backup story. v1 found 6 confirmed defects, two destructive; v2 found more hostile-input holes even after the fixes.

1. **H3 — tag associations silently destroyed across devices.** When an imported tag's *name* already exists locally under a different UUID, the tag was skipped **without ID remap**, so every noteTags/linkTags/shipTags row referencing the imported UUID was silently dropped; the success snackbar still showed. Fix (implemented in Flutter, must exist in web): build `remap[importedId] = existingLocalTagId` at skip time and resolve `b = remap[b] ?? b` when inserting join rows. Web rule: **import must remap tag IDs by case-insensitive name match, never drop join rows silently.**
2. **F16/F30 — one corrupt history row bricks the whole feature.** `payloadJson` was accepted without validation (with a guaranteed-unparseable `'{}'` fallback pattern); a single corrupt row made the whole reactive `watchAll()` stream fail, history sheets showed "Error: …" and **hid the purge button** — permanently bricked, only fix was reinstalling. Web rules: validate payload JSON by round-trip at import; make history row parsing per-row tolerant (skip + log bad rows); **the purge/clear-history button must remain visible in the error state.**
3. **F43 — insert-only import.** Original import never applied newer edits from a backup ("Nothing imported" read as "already synced"). Fixed to newer-wins updates — but see E5.
4. **E5 — forged/damaged dates beat local data.** In the newer-wins logic, an unreadable date fell back to `DateTime.now()`, so a forged or corrupted file **always overwrote** newer local content. Fix: on the *update* path, unreadable date falls back to **epoch (loses)**; `now` is reserved for `createdAt` of fresh *inserts*.
5. **E8 — inconsistent tolerance + unbounded enums.** One malformed tag rejected the entire file (while history rows were skipped line-by-line). Favorites `entityType` was not whitelisted. Fix: try/skip per row everywhere; whitelist favorite kinds (`FavoriteKind` string enum) and bound all values.
6. **F36/F42 — lying import counters.** Rows ignored by insert-or-ignore were still counted as imported. Fix: count only rows actually written; distinguish inserted / updated / skipped in the result summary.
7. **F60 — raw runtime errors shown to users** (e.g. `type 'Null' is not a subtype of type 'String' in type cast`). Fix: human-readable error messages everywhere (`friendlyError` mapping layer exists in the Flutter app).
8. **E1 — the ghost backup.** `shareExport()` discarded the share result; both callers called `markBackedUp()` unconditionally. Canceling the OS share sheet still set `lastBackupAt`, silencing the backup reminder banner for **30 days** with no backup existing. Fix: return the share result and only mark backed-up on `status == success`. **Web note:** with a plain `<a download>` you cannot detect cancel; either treat the download-triggered event as best signal, use the File System Access API's success path (`showSaveFilePicker` resolves only on save), or mark backup only after explicit user confirmation.
9. **E7 — auto-backup threshold swallowed.** If the change-counter threshold (a batch of **20 changes**) was reached *while an export was running*, the counter reset ate the pending trigger. Fix: don't reset while running / keep a `pending` flag.
10. **E10 — export filename collision.** Timestamp at second resolution: two exports in the same second overwrite each other. Fix: millisecond suffix or counter.
11. **F71/R6 — plaintext export accumulation.** Full-data JSON exports accumulated forever in the temp directory after sharing. Fix: stable name (overwrite), delete after share, or sweep at boot. **Web note:** N/A for downloads, but if the web app caches exports in OPFS/IndexedDB, apply the same hygiene.
12. **Positive invariants to preserve (verified in v2):** import is **transactional** with a format-version gate (`formatVersion: 1` envelope covering all tables, "additive, never overwrite" for inserts + newer-wins for updates after fixes); exporting **must not itself count as a data change** (in Flutter, `lastBackupAt` lives in SharedPreferences precisely so exports don't retrigger the change counter — "never move it into the DB"); no auto-backup feedback loop.

### 2.2 Notifications / Mars Express alerts

13. **F6 — cancel that never cancels.** Notification ID scheme `70000 + zone*10 + i` assumed `zone < 100`, but real zones are 234–346 → IDs 72340–73462 fell outside the `cancelGroup` range [70000–70999]; "Cancel alerts" never removed anything; arming a second zone stacked both. Root lesson for web: **derive ID/key ranges from real data, never assumptions.**
14. **F35/E4 — misattributed failures.** `arm()` returned `false` both for permission-denied AND for "all 3 dates already past/too close", so the UI wrongly accused permissions. Later variant E4: `arm()` destroyed the existing slot first, then failed silently when the arrival was < 2 s away or the cached `now` was up to 5 s stale → phantom "armed" state + wrong error message. Fixes: use a real `DateTime.now()` at decision time; roll back / remove the slot entry on failure; **differentiated error messages** (permission vs. timing).
15. **E2 — refresh/arm/cancel race.** A periodic `refresh()` (every 5 s, un-awaited) iterated a copy of state across ~20 awaits then **replaced the whole state**: a concurrent cancel got resurrected, a concurrent arm got lost. Fix: serialize arm/cancel/refresh (mutex/queue) and **merge into current state at commit, never replace.** Directly applicable to any async React store.
16. **P2/E6 — pending-notification budget.** One repeating zone = 18 pending notifications; iOS silently drops beyond **64 pending**. Fix: global budget ≤ **60**, sorted by temporal proximity; refuse/warn at arm time. **[web: largely N/A — no scheduled OS notifications on GitHub Pages; see §6]**
17. **P3 — silent inexact fallback.** Android could deliver "2 min before" *after* the train (Doze drift ~15 min) with no disclosure. Fix: show a "timing is approximate" badge when exact scheduling is unavailable. Web analogue: if the web app can only fire notifications while the tab is open, **say so explicitly in the UI** — honesty about timing is a hard requirement.
18. **Armed state not persisted** (v1): after an app restart the UI forgot which zone was armed while OS notifications still fired. Fixed via persisted prefs. Web: persist armed zones in localStorage.
19. **E9 — legacy ID cleanup:** one-shot cleanup of out-of-band notification ids at first launch after a scheme change. Lesson: version your persisted scheduling state.
20. **E3 — the frozen countdown.** A memoized provider was documented as a "fresh countdown" — it would have frozen the Live Activity. Fix pattern (landed, see docs/LIVE_ACTIVITY_PLAN.md): a pure resolver `resolveNextArrival({schedule, armedZones, required now})` with a caller-supplied clock + an auto-disposing **minute-cadence clock** driving recomputation. Web: derive countdowns from `Date.now()` in a ticking hook, not from a value captured at mount.

### 2.3 Network clients (JPL/NASA)

21. **F17 — no connect timeout.** Zombie networks (captive Wi-Fi, half-dead VPN) blocked on OS defaults (~75 s iOS, 2 min+ Android); a full scan could grind 10+ minutes. The error branches for `connectionTimeout` were dead code. Fix adopted: single shared HTTP client, `connectTimeout: 10 s`, injected everywhere. Web: `fetch` + `AbortController` timeout (10 s) on every request; never leave a request without a timeout.
22. **F48 — no retry/backoff.** JPL endpoints are notoriously flaky; a transient 503 = a planet in error for the whole scan. Fix adopted: bounded retry (2×, backoff) on 5xx/connection errors, **CancelToken-safe** (a canceled request must not be retried).
23. **F18 — HTTP 300 and 503 both read as "no match".** SBDB signals multiple matches via **HTTP 300**, which dio rejected by default → "Halley" → "Couldn't resolve an MPC ID"; JPL maintenance 503s were also converted to "no match". Fix: accept 300 as a valid response carrying the candidate list; surface 5xx as HTTP errors distinct from "not found". Web: `fetch` does not throw on 300 — but you must explicitly branch on it and parse the multi-match body.
24. **F47 — fragile Horizons text parsing.** Parsing scanned raw lines (`'A.D.'`, `'X ='`) without anchoring on the `$$SOE`/`$$EOE` delimiters; units were never pinned (`OUT_UNITS` absent from the query); in-band error messages (rate-limit, "API SERVER BUSY") were silently converted to "No data returned". Fixes: anchor parsing between `$$SOE`/`$$EOE`; pass `OUT_UNITS='KM-S'`; detect and surface in-band server messages as errors.
25. **F9 — km stored as m.** SBDB `diameter` is in **kilometres** but was stored/displayed as metres ("Ceres: 939.4 m"); the **140 m** alert threshold could then never trigger (verified against the live API). Fix: convert km→m at parse time; unit-test with a real payload.
26. **F10 — timezone drift on date queries.** Local midnights from the date picker were treated as UTC instants: in Vienna the query covered the previous day; west of UTC picking "today" (allowed) threw "Pick a date no later than today." Fix: work in calendar dates (YYYY-MM-DD) end-to-end, never `toUtc()` a local midnight. Web: format date-picker values as plain calendar dates, no `Date` round-trip through UTC.
27. **F15 — silent truncation at 1000.** SBDB queries used `limit=1000` and never read the response's `count` field: tens of thousands of discoveries in a year were presented/persisted/shared as a "complete" list of 1000. Fix: read `count`; display an explicit truncation indicator.
28. **F37 — stop button destroys results.** Stopping a celestial request cleared previous results and showed a red error card "Request cancelled." Fix: cancellation keeps prior results and is not styled as an error.
29. **F12/F20/F19/F34/F7 — generation-guard family.** Stale async completions overwrote newer state; canceled scans wrote to disposed notifiers and **recorded a partial scan in history marked "no errors"**, indistinguishable from a complete one; the tracker controller was recreated mid-request because it watched the catalogue future ("Track this object live" from Discoveries failed on first use). Fixes: every async controller keeps a generation counter incremented on start/cancel/dispose and drops stale completions; a canceled/partial scan must be flagged as partial in history; don't tie a controller's lifetime to an async dependency's readiness. Direct React analogues: effect-cleanup + AbortController + request-id guard on every setState-after-await.
30. **R16 — footgun default fallbacks.** Client constructors with `({Dio? dio}) : _dio = dio ?? Dio()` silently bypassed timeouts/retry when the default fired. Web: make the configured HTTP client a **required** dependency of every API module.
31. **R13/R14 — time subtleties, documented:** `tz.local` was UTC (benign because scheduling used absolute instants — a trap only if recurring-components matching is added); Horizons timestamps are **TDB** labeled as UTC (~69 s offset — cosmetic at "SL" game precision; document it).
32. **Web-specific flag (not in audits): CORS.** The audits assume native HTTP. The web app must verify that `ssd-api.jpl.nasa.gov` (SBDB) and `ssd.jpl.nasa.gov/api/horizons.api` send CORS headers usable from a GitHub Pages origin; if not, the scan/tracker/discoveries tools need a proxy (which would contradict the zero-backend posture) or must be rescoped. **Open question — test before committing to feature parity.**

### 2.4 Data layer

33. **F44/F45/F46 — schema discipline.** v1 schema had **no foreign keys, no secondary indexes, no UNIQUE on `tags.name`, no MigrationStrategy** (schemaVersion 1); multi-statement mutations (tag resolve + join delete/reinsert + orphan prune) were **not transactional** — a kill mid-save lost the tag taxonomy; orphan rows made some tags impossible to purge. All fixed by v2 (transactions everywhere; tested migration chain v1→v2→v3). Web rules: enforce name-uniqueness for tags (case-insensitive), wrap multi-step mutations in transactions (IndexedDB transactions / Dexie), and **version the persisted store from day one with an upgrade path**.
34. **F51/R9 — orphan-tag pruning cost.** `pruneOrphanTags` ran 3 COUNT queries **per tag** after every save/delete (300 queries for 100 tags). Fix: single `DELETE … WHERE id NOT IN (SELECT tagId FROM noteTags UNION SELECT … UNION SELECT …)`.
35. **F23 — unbounded histories.** History tables unbounded; every row JSON-decoded on the UI thread on every emission; providers never disposed; all cards rendered eagerly. Fixes adopted: auto-dispose + `LIMIT` + deferred decode + virtualized lists. Web: paginate/limit history queries; virtualize long lists; parse lazily.
36. **R9b/F52 — big JSON on the UI thread.** `jobs.json` (332–337 KB) decoded synchronously during route transition. Web: `fetch().json()` is already async; for bigger payloads consider a worker. Don't hardcode derived counts ("371 jobs") — compute them.

### 2.5 UI / UX correctness

37. **F11 — jobs invisible forever.** Bonus filter defaulted to `[0, 500]` while **11 of 371 jobs have negative bonuses (down to −2740)**; the slider was floor-bounded at 0 so no setting could reveal them, and the UI claimed "0 active filters". Fix: derive filter bounds from the data; a default that filters nothing must actually match everything.
38. **F14 — dismissible editors destroy drafts.** Note/link/ship editors were bottom sheets dismissible by tap-outside/swipe with no guard and no draft — 10+ fields lost. Fix: unsaved-changes guard (PopScope in Flutter; in web: route-block + `beforeunload` + confirm dialog) on all editors.
39. **F38 — uncommitted tag text lost.** Tag text typed but not yet committed (no comma/Enter) was silently dropped on Save. Fix: commit the pending tag-input text as part of Save.
40. **Ship editor bugs (v1 §9):** inverted condition on `customModelLabel` (custom label thrown away for models without prefix; hidden residual text persisted for prefixed models); model/location picker sheets: dismissing without choosing **reset the selection to "none"** (dismissal `null` indistinguishable from an explicit "No model" choice). Fix: distinguish "dismissed" from "picked null"; test the label logic.
41. **Ghost searches (×4).** `notesSearch/linksSearch/kbSearch/walletQuery` were global state providers not bound to the TextFields → an empty field displayed the previous query's results after navigation. Fix: bind query state to the input (controlled components), reset on route leave, or rehydrate the field from the state.
42. **kb_category_view:** unknown categoryId silently fell back to the first category; icon mapping diverged between home and category views. Fix: unknown id = explicit not-found state; one icon mapping source of truth.
43. **F13/F61/F68 — share pipeline.** `sharePositionOrigin` missing → **all card sharing threw on iPad** without showing the sheet **[web: N/A]**; share-card capture failed 100% silently (muted catch + ignored bool at 6 call sites, success haptic already fired); success haptics fired BEFORE the DB write with no try/catch, so write failures felt like success. Rules: fire success feedback only after the operation succeeded; every capture/share failure needs visible feedback.
44. **F67 — hardcoded version strings.** "v0.2.0" hardcoded in 3 views (including bug-report email bodies). Fix: single source (in web: inject from package.json at build).
45. **Boot screen friction.** Played 8–10 s at EVERY launch, skippable only after typing finished. v1 P2 prescription: **instantly skippable + a "fast boot" setting.**
46. **Lying copy (v1 §9 — transparency is the brand, keep copy true):**
    - "This is the only feature in Underdeck that talks to a network" (Scan) — contradicted by Tracker/Discoveries and the FAQ.
    - "Stored: Nothing" — contradicted by local history.
    - "1 to 4 GET requests" — worst case is 5.
    - "About 60 well-known bodies" — catalogue has 15.
    - v2 adds: once the maps module ships, the onboarding claim "the only outbound network is …" becomes false again → **update onboarding/FAQ/about in the same release as the maps module (M1, not M4)**, naming real endpoints (GitHub Pages/Fastly; jsDelivr = multi-CDN Cloudflare/Fastly/Bunny), the poll cadence (≤ 1/24 h), plus a Tracker-style "how it works" sheet for maps.
47. **P8/P9 — one platform, one idiom.** The only `Platform.isIOS` branch (Celestial date picker: Cupertino wheel vs Material calendar since 1800) and a mixed Switch family were parity smells. Web: single date-picker and single switch component everywhere — this inconsistency dissolves.

### 2.6 Security / privacy

48. **R1 (v1 F33) — the wallets dataset. The only red-level blocker left in v2, legal not technical.** `assets/catalog/wallets.json` (93 KB) embeds **769 real Discord handles mapped to their WAX crypto-wallet addresses** in every binary, rendered into shareable PNG cards. De-anonymizing pairing = personal data under GDPR (developer is EU-based); no documented consent, no removal mechanism; every erasure request would need a store release per shipped version. Options given: pure removal / hash the handles + provenance doc / **move to the remote content repo with an opt-in download, consent documentation, and a removal process** (the only option preserving the feature AND compliance; audit says the content repo "is precisely the exit door", to be resolved in maps milestones M0–M1). **Web-rewrite rule: do NOT bundle wallets.json into the web bundle** — a public GitHub Pages site is even more exposed than an app binary. Also blocks making any repo public while the file is in history.
49. **F70/R4 — URL scheme allowlist.** `launchUrl` accepted any scheme from **importable** content (exports circulate on Discord by design): `tel:`, `sms:`, custom app schemes hideable behind innocent link text. Fix (single helper, ~20 lines): allowlist `{http, https, mailto}`; blocked attempt shows snackbar **"Blocked link type."** Web: same allowlist before `window.open`/anchor rendering of any user-imported or remote-content link; also applies to the maps `link` field type.
50. **F73/F58 — silent debug signing fallback [drop/web-N/A]** — lesson: builds must fail loudly on missing release credentials.
51. **F74/F21 — runtime font fetching.** google_fonts fetched from fonts.gstatic.com at first launch — undisclosed traffic contradicting "local-first", and broken offline rendering. Decision made: **bundle the 3 font families (Inter, JetBrainsMono, Quicksand), no runtime font fetch.** Web: self-host the fonts in the bundle; do NOT use Google Fonts CDN (both for privacy-copy truth and GitHub Pages self-containment).
52. **H4/R7 — unbounded image decode.** KB images decoded at full resolution: `space-station-map.png` **4086×4086 (~67 MB decoded RGBA)** + `hideous-dungeon-map.jpg` (~32 MB) for a ~380 px display; realistic OOM on 1.5–2 GB devices; 4086 px grazes the 4096 texture cap of old GPUs. Fixes: decode at constrained size (the maps design mandates an **absolute decode cap of ~2048 px** — explicitly NOT "2× viewport", which constrains nothing on a 1080×2400 screen); resize/compress assets (nothing justifies > 2000 px); WebP. Web: serve pre-downscaled assets; use `<img srcset>`/canvas downscaling; enforce the content-repo pixelSize gate before fetch.
53. **F29 — no global error net.** No `FlutterError.onError`/zone guard/crash reporting/logging (21 mute `catch (_)`), and an unprotected notifications init could white-screen the app forever before first frame. Fixes: global error handler wired to a logger; guard all init steps; never allow a non-critical init failure to block startup. v2 R5 additionally: **zero CI and no git remote existed** — the web repo must have CI (lint + typecheck + tests) from day one.
54. **F28/R15 — asset loaders that swallow everything.** 7+ embedded-catalog loaders did `catch (_) { return empty; }` — a corrupt asset shipped as an empty tool with zero diagnostics, making the views' error branches dead code. Fix: let loader failures propagate to the views' error states; log them.

### 2.7 Performance (Flutter-specific mechanics, portable lessons)

55. **F22** 18 infinite animation tickers + per-frame blurs on the Scan page, no repaint isolation → full-page re-rasterization at 60–120 fps. **F24** EVIL portal: 6 gaussian blur layers (sigma up to 70) recomputed every frame by a **never-stopped ticker** after the animation ended. **F49** boot particles: per-frame setState + ~200-path hex grid re-tessellated per frame. **F53** a decorative 6 px pulsing dot kept the whole app from ever reaching idle on **every** screen. **F50** typography getters re-resolved fonts on every access (564 call sites). Web equivalents: prefer CSS animations/transforms (compositor-only) over rAF-driven JS state; stop/pause animations when finished or off-screen (`prefers-reduced-motion`, IntersectionObserver); never drive React state per frame for decoration; memoize style objects.
56. **R8** non-virtualized single-child scrolling across 22 views (hangar worst). Web: virtualize unbounded lists.
57. **Reduce-motion is respected at double level** (in-app setting + OS) on every animation in the Flutter app — preserve this: in-app toggle OR `prefers-reduced-motion` disables auto-rotation, inertia, decorative pulses; pan/zoom stays.

### 2.8 Accessibility

58. **F31 — zero Semantics in 121 files.** Tab bar, primary CTA (NeonButton), ToolCards, settings rows were bare gesture detectors with no role/state; icon buttons without tooltips. Web: native `<button>`, `role="tab"`/`aria-selected`, tooltips — do not rebuild interactive elements out of bare `<div>`s.
59. **F32 — contrast token failure.** `textDim` = **#4F6A87** at ~3.0–3.6:1 contrast (WCAG AA needs 4.5:1), used 63 times including 10 px informational text, and baked into shared PNGs. Fix at one token. Web: fix the token value; run contrast checks on the palette.
60. **F69 — font scaling defeated.** Nav labels under FittedBox canceled the OS font-size setting; share cards inherited the text scaler → PNGs with baked overflow at 200%. Web: respect browser font scaling (rem-based sizing); render share cards at fixed internal scale.
61. **Maps a11y amendment (v2 §4.8, "elevated", scheduled in MVP not hardening):** both map canvases (2D and globe) are invisible to screen readers → require a semantics layer per zone **and a "zone list" view per map** (sortable/filterable, opens the same ZoneSheet). This one view also solves tiny zones and limb-picking. Web: the zone-list is trivial in HTML — build it first-class.

### 2.9 i18n

62. **F62/R10 — 537 (v2: ~500–800) hardcoded English strings, zero l10n infra.** Both audits: acceptable ONLY as an explicit documented decision; the maps module's schema-driven remote content adds a *content* language dimension (design examples were in French while the app is English — "there must be a policy, not an accident"). **Still an open product decision** (see §5). Web practical default: EN-only, documented, with strings centralized in one module so the door stays open.

---

## 3. Architectural decisions ALREADY MADE (adopt in the web rewrite)

These were decided by the audits/amendments and partially implemented in Flutter; the web app should treat them as settled unless the user overrides.

### 3.1 Content distribution ("GitHub as CMS") — decided pattern

- **Golden rule: everything mutable is tiny; everything voluminous is immutable.**
- **Channels and roles** (facts verified live in 2026 by the audit):
  - **GitHub Pages** → hosts ONLY the tiny mutable pointer `latest-v1.json` (< 2 KB target, 64 KB hard cap) (+ its `.sig`). Soft quota 100 GB/month; at the assumed 5,000 installs / 800 DAU the pointer costs ≈ 36 MB/month (0.04%).
  - **jsDelivr `/gh/<org>/<repo>@<tag>/…`** → serves the manifest, map documents, and images, **pinned by git tag** (tag-pinned = immutable forever, S3-copied). `@main` has 12 h/7 d staleness → **forbidden**. Limits: 20 MB/file, 150 MB/repo, no rate limit.
  - **raw.githubusercontent.com** → **fallback only**, never primary (per-IP throttling hardened May 2025; real 429s behind CGNAT).
  - **GitHub REST API** → never from clients (60 req/h/IP unauthenticated; an embedded PAT is extractable and auto-revoked). CI tooling only.
  - **GitHub Releases** (immutable since GA 10/2025, no documented bandwidth limit, 2 GiB/file) → growth path: zip packs when the repo grows.
  - Escape hatch: a **tested runbook** for migrating to an object host (Cloudflare R2 etc.) — the sha256+manifest design makes the move trivial, but the runbook must be exercised once, not assumed.
- **Poll policy:** GET the pointer with `If-None-Match` (ETag), **≤ once per 24 h, with ±2–3 h jitter, and ONLY if the user opted in** to maps networking.
- **Update protocol (client):** GET pointer → **verify ed25519 signature** (unsigned/bad = ignore, keep local pack) → **anti-rollback gate** (refuse any `contentVersion` < installed) → `minAppVersion` gate → GET manifest (jsDelivr, fallback raw) → diff by sha256 (content-addressed store dedupes across versions) → download each needed file with **streaming hash verification** + byte-count cut-off at declared `bytes`/Content-Length → transactional commit + search-index rebuild → GC. **Rendering reads exclusively from the local store — never the network at render time.**
- Post-tag CI check: verify the CDN URLs actually serve the tagged content **before** publishing the pointer.

### 3.2 Integrity & signatures — decided, mandatory

- sha256 chain (pointer → manifest → files) protects **transport only**; against repo/account compromise it is "theater". Therefore:
  - **ed25519 signature of the pointer is REQUIRED from the MVP** (~1 day cost). Pointer file + detached `.sig`.
  - **Key ceremony:** private key NEVER lives in GitHub (else compromising the repo = obtaining signatures); signing is done locally on the maintainer's machine (pointer < 2 KB, ~20-line script); **2 public keys embedded in the app** for rotation; RFC 8032 test vectors in the test suite; a `beta-v1.json` channel is signed identically.
  - **Anti-rollback:** client refuses `contentVersion` older than installed. Editorial rollbacks become **roll-forwards** (publish version N+1 pointing at the old tag — free thanks to content addressing). Residual accepted threat: a pure "freeze" (replaying an old signed pointer forever) — documented in the threat model.
  - **Channel end-of-life:** the last `latest-v1.json` ever published on a channel is a **tombstone** (raised `minAppVersion` → upgrade banner), otherwise old apps freeze silently forever. Written CI rule.
  - Crypto dependency: evaluate freshness; vendoring just the ed25519 *verification* is acceptable (web: WebCrypto has **Ed25519** in modern browsers — verify coverage; else a small vendored verify function, pinned + test vectors).

### 3.3 Content compatibility rules — decided

- Three levels (pointer / manifest / map document), each with its own integer `schemaVersion`. **Additive change = same major, unknown fields ignored. Breaking change = new major + a NEW pointer filename/channel** (e.g. `latest-v2.json`).
- Old app × newer content (same major): unknown fields ignored; a map with unknown `type` renders as an **"update required" card, not openable, and EXCLUDED from search** (else search leads to dead ends).
- **First launch offline = bundled seed pack** (current maps converted to the format). Seed limited to @2048 assets (the @4096 variant is download-only). Seed import is **lazy** (on first Knowledge access) and skips re-hashing (bundle assets are already authenticated by the app-store/site signature). Long-term: dedupe KB article images with the maps store.
- Pack **activation happens at screen entry** — never invalidate a map document out from under the user mid-view.
- **GC** operates on locally-installed pack rows (never on server state) and never collects blobs of an open document.

### 3.4 Local content store — decided shape (translate to web)

- **Content-addressed blob store**: `<app-support>/maps_store/blobs/<sha256>` with atomic write (`.tmp` + rename after hash verification). Web equivalent: OPFS or IndexedDB keyed by sha256; keep the verify-then-commit discipline.
- DB additions (Drift v4 in Flutter): tables `MapPacks`, `MapPackFiles`, plus **FTS5 table `map_zone_fts` (unicode tokenizer)** — deliberately also fixing the old KB index's ASCII-only limitation. Web: a JS full-text index (e.g. MiniSearch/FlexSearch) with unicode normalization; index "Map › Zone" entries; searchable fields per `fieldsSchema.searchable`.
- Hashing/parsing off the main thread (Flutter: isolate; web: Web Worker + `crypto.subtle.digest` streaming).

### 3.5 Maps rendering — decided (re-map for web)

- **2D: no third-party map engine.** Decision was `InteractiveViewer` + `CustomPaint` + ~50 lines of custom hit-testing; rejected: flutter_map (LatLng tax buys nothing at 50–500 zones in own pixel space), interactive SVG packages (not production-grade), cached_network_image (23 months stale; and bytes-on-disk needed). Web translation: an HTML canvas (or SVG) viewport with pan/zoom, drawing layers (background decoded at constrained size / zones / selection / labels with level-of-detail), pointer hit-testing via inverse view transform + polygon containment (even-odd with holes) / marker distance with **zoom-independent hit radius**. Backgrounds are **raster only** in MVP (no remote SVG = parser attack surface removed).
- **3D globe:** Flutter Plan A was a pure-Dart orthographic globe (projection of pre-tessellated arcs ≤ 2°, quaternion drag, closed-form picking: reconstruct z = √(R²−x²−y²), inverse-rotate, lat/lon, spherical winding; refuse picks beyond ~0.95R at the limb or rotate-to-zone on tap; ~3–4 weeks). Plan B was WebView + **bundled** globe.gl/three.js (~1.5–2 weeks). **On the web, Plan B's tech is native: use globe.gl/three.js (or MapLibre GL JS v5 globe projection) directly, bundled, no CDN** (v2 §5 explicitly rates the web stack ahead of all mobile options here). Keep Plan B's security rules where meaningful: only JSON content flows in; libraries are bundled; CSP as strict as GitHub Pages allows.
- **The data contract is renderer-independent** — switching renderers must only touch one viewport component. The app **never tessellates**: sphere polygons arrive pre-resampled (arcs ≤ 2°) from content CI. Zones containing a pole use `sphericalCap` (angular-distance test) to dodge degenerate winding; antimeridian handled by a spherical winding test.
- **Interaction pattern:** tap → haptic → glow highlight → **ZoneSheet** (glass card) rendered by a `ZoneFieldsRenderer` driven by `fieldsSchema`: enum→tag chip, number+unit→mono text, stringList→bullet chips, longText→paragraph, link→**allowlisted** button, unknown type→plain text. Favorite button with kind `map_zone` (string-kind; export/import already carries favorites).
- Gallery: "Interactive maps" section at top of KB home (glass cards + thumbnails); routes `/knowledge/maps` and `/knowledge/maps/:id`; deep links `underdeck://map/<id>` planned (web: plain routes; give route-level error UI for a missing/unknown map id — the v1 "refuted" infinite-spinner finding becomes reachable once deep links exist).
- Filters: chips generated from `enum` fields with `filterable: true`. Search: FTS "Map › Zone" results open the map pre-centered on the zone.
- Reduce-motion: auto-rotation and inertia off; pan/zoom preserved.

### 3.6 Map theming — decided

- `MapTheme` = **closed whitelist of 9 tokens**: `background`, `surface`, `zoneFill`, `zoneStroke`, `zoneSelectedFill`, `glow`, `label`, `accent`, `fontFamily`. All optional; each missing/malformed token falls back to the app default (derived from the app's color tokens).
- `sanitize()` at parse time: strict hex (`#RRGGBB` or `#AARRGGBB`, leading `#` optional, case-insensitive); **dark-only guard: background/surface luminance ≤ 0.22** (glass/neon components assume dark canvases — light values ignored); WCAG contrast guards; `fontFamily` ∈ {Inter, JetBrainsMono, Quicksand} (bundled) only.
- Amendment (binding): the verified contrast pair isn't the rendered one — labels paint over the background image → the renderer must apply a **systematic halo/scrim behind labels** (an engine property content cannot disable); add label↔zoneFill/zoneSelectedFill contrast guards and a minimum ΔL between `zoneSelectedFill` and `zoneFill` (else selection is invisible); golden-test a hostile theme.
- Per-zone `themeOverride` restricted to `zoneFill` / `zoneStroke` / `glow`; any other token dropped (a zone cannot repaint map-level surfaces).
- Themes are **advisory**: hostile/low-contrast palettes are clamped to legible defaults rather than breaking the UI. Enables "seasonal event theme packs" as pure content (v2 §6 feature #9).

### 3.7 fieldsSchema contract — decided (frozen)

- The v1 type set is **closed**: `text`, `longText`, `number`, `enum`, `stringList`, `link` (see §7 for exact shapes). Any new type or behavioral attribute = major schema increment + explicit decision — the descriptor must not drift into an unmaintained form framework.
- `filterable: true` honored **only** for `enum` (bounded chip cardinality); dropped otherwise. `searchable: true` puts the field's value into the full-text index.
- `link` values: `underdeck://…` internal links or an allowlisted URL (same {http, https, mailto} gate).

### 3.8 Networking policy / privacy posture — decided

- **Local-first, zero backend, zero telemetry** stays the identity. All game-content freshness comes from the public content repo.
- **Maps networking is opt-in**: first access shows an explicit screen stating the **real download size read from the seed/live manifest** (never a hardcoded "~12 MB"); settings expose `mapsNetworkEnabled` and `mapsAutoUpdate` toggles (defaults = open decision); download UI has **progress + cancel + wi-fi-only option** (web: probably drop wifi-only, `navigator.connection` is unreliable — flag) and a storage screen "Maps downloaded: X MB — Clear".
- Poll cadence ≤ 1/24 h + jitter; disclosure copy names actual hosts (GitHub Pages/Fastly, jsDelivr multi-CDN Cloudflare/Fastly/Bunny) and cadence; a maps "how it works" page in the Tracker style ships with the MVP.
- If crash reporting is ever added (v2 recommends Sentry for the Flutter app), it must be added to the about/privacy disclosure. For the web app this is again a product decision — default posture is zero telemetry.
- **Fonts bundled** (no fonts.gstatic.com). No third-party CDN references from the app bundle itself.
- Changelog surfaced in-app: manifest `changelog` → discreet "What's new" banner on first display after a content update (v2 §6 feature #3).

### 3.9 Mars Express glanceable surface — decided data contract (docs/LIVE_ACTIVITY_PLAN.md)

Native Live Activity/widgets are **[drop]** for web, but the **single-source-of-truth pattern is binding**: the schedule math lives in exactly one pure resolver, and any glanceable surface consumes a flat snapshot:

`NextArrivalSnapshot.toBridgeMap()` keys: `zone` (int), `zoneName` (string?), `arrivalMinute` (int 0–59 wall-clock), `minutesUntil` (int, rounded up, ≥ 0), `arrivalEpochMs` (int, absolute), `isArmed` (bool), `generatedAtEpochMs` (int, staleness detection). Example payload: `{"zone":400,"zoneName":"Olympus","arrivalMinute":20,"minutesUntil":20,"arrivalEpochMs":1783080000000,"isArmed":true,"generatedAtEpochMs":1783078800000}`.

Focused-zone rule: first **armed** zone wins; else the zone the train is at right now; else nothing (idle → no surface). Countdown is driven off `arrivalEpochMs` with a self-updating timer, refreshed on app resume and on armed-set changes; on arrival, advance via the schedule's next-occurrence function (wraps into the next hour). Web analogues: document title/tab badge countdown, PWA badging, or simply the in-page view — but keep one pure `resolveNextArrival({schedule, armedZones, now})`.

### 3.10 Migration/handoff lessons (docs/MIGRATION.md)

- The Android applicationId rename (`xyz.overthecloud.underdeck_app` → `xyz.overthecloud.underdeck`) taught: identity changes orphan local data; the documented recovery is **export from old → import into new** (Settings → Data → Export…/Import…). Web equivalent trap: **changing the GitHub Pages origin/path or the IndexedDB/localStorage naming scheme silently orphans user data** — treat storage keys/DB names as versioned identity, and keep export/import as the universal handoff. Existing Flutter users moving to the web app will also migrate via this JSON export → **the web app's import MUST accept the Flutter export format (formatVersion 1 envelope)**.
- iOS Time-Sensitive entitlement details **[drop]**.

---

## 4. Web-app risk notes derived from the audits (not in the audits, but direct consequences)

1. **CORS on JPL APIs** (see §2.3 item 32) — verify before promising Scan/Tracker/Discoveries parity.
2. **No OS-scheduled notifications on a plain GitHub Pages app** — Mars Express alerts (the app's flagship retention feature per both audits) need honest rescoping: in-tab alarms + Notification API while open, or explicit "keep this tab open" messaging (P3's honesty rule applies doubly).
3. **wallets.json must never enter the public web repo/bundle** (R1). If Wallet Lookup ships at all, it fetches from the content repo behind opt-in + consent documentation.
4. **GitHub Pages hosting the app AND the content pointer** are two different sites/repos; the CSP/self-containment rules for the app bundle (no external CDNs) do not forbid the *data* fetches to Pages/jsDelivr — those are the disclosed endpoints.

---

## 5. Product decisions STILL OPEN (v2 §8 + gaps found while digesting)

1. **Wallets (R1):** was the list built with member consent (opt-in Discord post?)? Pure removal vs hashed handles + provenance doc vs move to the content repo with a removal process?
2. **Language policy (R10):** EN-only assumed and documented, or l10n infra now? And the language of maps *content* (design examples were FR, app is EN) — needs a policy.
3. **Maps network opt-in defaults:** `mapsAutoUpdate` on or off by default? Is the bundled seed a sufficient no-network experience?
4. **Content signing key custody:** who holds the ed25519 private key, where does it live (personal machine? secrets manager?), who may publish a pointer?
5. **App repo publication:** public (open-source fan app) or private? Conditioned by R1 and residual local paths in git history.
6. **iOS floor / iPad / date-picker idiom (R2/P6/P8):** platform questions that mostly dissolve on web, but the underlying audience question (phone vs tablet layouts) becomes "responsive breakpoints" — undecided.
7. **Crash reporting for web:** v2 recommends Sentry for Flutter; adopting any telemetry contradicts the zero-telemetry copy unless disclosed — decision + disclosure needed.
8. **Backup-success detection on web** (E1): which mechanism counts as a confirmed backup (File System Access API save vs blob download)?
9. **Content repo org/name:** the mission references `underpunks55/underdeck-content`; the docs only ever say `<org>/underdeck-content` (AUDIT-V2 §4.3) — the concrete org is not written anywhere in the audited files.
10. **Spec inconsistencies to resolve** (see §7.6): enum options cap 12 vs 20; "7 field types" (audit) vs 6 (schema); pointer path root vs `pointer/` subdirectory; tag naming `maps-v1.4.0` + `maps-manifest.json` (audit example) vs `content-2026.07.0` + `manifest.json` (starter kit — newer, treat as authoritative).

---

## 6. Platform features inventory (from audits/docs) with web adaptation

| Flutter feature | Where used | Web equivalent |
|---|---|---|
| flutter_local_notifications + timezone (`zonedSchedule`, exact alarms, T-2/T-1/arrival) | Mars Express alerts | Notification API while page open + in-page countdown; **no reliable closed-tab scheduling without a push server** → rescope + honest copy (P3 rule). Consider PWA + Badging API. |
| Haptics service (success/selection feedback, respects reduce-motion settings) | everywhere | `navigator.vibrate` (Android Chrome only) or **drop**; keep visual feedback. Fire only AFTER the operation succeeds (F68). |
| share_plus (`sharePositionOrigin`, `ShareResult`) + share-card PNG capture | wallet/scan/tracker cards, export | Web Share API (`navigator.share`/`canShare` with files) with download fallback; check the promise result before `markBackedUp` (E1); visible failure feedback (F61). |
| file_selector / image_picker (`XTypeGroup`, `pickMultiImage`) | import JSON, note images | `<input type="file" accept="application/json">` / accept images; File System Access API where available. |
| url_launcher (`launchExternal` allowlist {http,https,mailto}, snackbar "Blocked link type.") | markdown links, link detail, maps `link` fields | Anchor/`window.open` behind the same allowlist helper. |
| SharedPreferences (settings, `lastBackupAt`, onboarding flag, armed zones) | services | localStorage (versioned keys). Keep `lastBackupAt` OUT of the DB (no backup feedback loop). |
| Drift/SQLite (10 tables → v4 with MapPacks/MapPackFiles/FTS5) | all persistence | IndexedDB (Dexie) or wa-sqlite; transactions on multi-step mutations; versioned migrations from day one. |
| google_fonts | typography | **Bundle** Inter/JetBrainsMono/Quicksand as self-hosted woff2 (decision made; no CDN). |
| Live Activity / Dynamic Island / home widgets (home_widget, live_activities, Glance, WorkManager) | Mars Express plan | **Drop**; optionally tab-title countdown / PWA badge; keep the single pure resolver + flat snapshot contract (§3.9). |
| Boot orientation lock, status bar styling, predictive back, splash | app chrome | Drop / CSS theme-color meta; browser back handled by router with unsaved-changes guards (F14). |
| dio + RetryInterceptor + CancelToken | JPL clients, content fetch | fetch + AbortController; 10 s timeout; 2 retries with backoff on 5xx/network, never on user cancel; **required** shared client injection (R16). |
| Isolates / `compute()` | JSON parse, hashing | Web Workers; `crypto.subtle.digest` for sha256 (streaming). |
| ed25519 verification (planned, vendored/pinned) | pointer signature | WebCrypto Ed25519 (check browser support) or a small vendored verify (e.g. tweetnacl), pinned, RFC 8032 vectors in tests. |
| WebView + bundled globe.gl (Plan B) | 3D maps | **Native on web**: bundle globe.gl/three.js (or MapLibre GL JS globe) directly; no external CDN script tags. |
| Reduce-motion (in-app + OS) | all animations | `prefers-reduced-motion` + in-app toggle; disable auto-rotate/inertia, keep pan/zoom. |
| package_info_plus (version string) | about, bug-report email | Inject version from package.json at build (F67). |

---

## 7. The content repository (`<org>/underdeck-content`) — exact specification

Everything below comes from `docs/content-repo/` (the authoritative "drop-in starter kit" for the content repo — explicitly NOT used by the app build) plus AUDIT-V2 §4. The web app is a **consumer** of this exact protocol.

### 7.1 Repository layout

```
content-repo/
├─ latest-v1.json                  # the ONLY mutable file (the pointer)
├─ manifest.json                   # catalogue at the current tag (immutable once tagged)
├─ maps/
│  └─ <map-id>/
│     ├─ map.json                  # the map document
│     ├─ background.webp           # flat maps
│     └─ texture.webp              # sphere maps (equirectangular)
├─ schemas/
│  ├─ pointer.schema.json
│  ├─ manifest.schema.json
│  └─ map.schema.json
└─ .github/workflows/
   └─ content-ci.yml
```

Note: AUDIT-V2 §4.3's example placed the pointer at `https://<org>.github.io/underdeck-content/pointer/latest-v1.json` (+ `.sig`) with tag names like `maps-v1.4.0` and a `maps-manifest.json`; the newer starter kit uses repo-root `latest-v1.json`, `manifest.json`, and `content-YYYY.MM.N` tags. Treat the starter kit as authoritative; the pointer URL on Pages is wherever the published file lands (plus a detached `.sig` next to it, per §3.2).

### 7.2 The content chain

```
latest-v1.json (pointer, mutable)  ──▶  manifest.json (tag-pinned, immutable)
        │ tag: "content-2026.07.0"          ├─▶ maps/<id>/map.json   (document)
        ▼                                   └─▶ maps/<id>/*.png|webp (assets)
   names the manifest for the           each referenced by path + sha256 + bytes
   current release tag                  (+ pixelSize for rendered images)
```

The app polls ONLY the pointer. Every file is pinned by sha256 — the app rejects any byte not matching the manifest. **Never edit a released tag — cut a new one.**

### 7.3 Pointer (`latest-v1.json`) — schema `pointer.schema.json`

- File cap **64 KB** (enforced by CI, not expressible in JSON Schema). `additionalProperties: false`.
- Required: `schemaVersion` (int ≥ 1; 1 for the current app), `contentVersion` (string 1–40 chars, e.g. "2026.07.0"; drives the "What's new" banner), `tag` (string 1–40, the immutable git tag), `minAppVersion` (string 1–40; older apps ignore the pointer), `manifest` (a fileRef).
- **fileRef** shape (shared with manifest): required `path` (repo-relative, 1–256 chars, joined onto `cdnBase`), `sha256` (lowercase hex, `^[0-9a-f]{64}$`), `bytes` (int ≥ 0, pre-download size gate); optional `kind` (string ≤ 64, free-form role hint), `pixelSize` (`[w, h]`, ints ≥ 1, images only).
- AUDIT-V2 example (older naming, structure identical):

```json
{
  "schemaVersion": 1,
  "contentVersion": "1.4.0",
  "tag": "maps-v1.4.0",
  "minAppVersion": "0.3.0",
  "manifest": {
    "url": "https://cdn.jsdelivr.net/gh/<org>/underdeck-content@maps-v1.4.0/maps-manifest.json",
    "fallbackUrl": "https://raw.githubusercontent.com/<org>/underdeck-content/maps-v1.4.0/maps-manifest.json",
    "sha256": "9f2ac41d0be7…", "bytes": 31248
  }
}
```
(The starter-kit schema replaces `url`/`fallbackUrl` with a repo-relative `path` resolved against the manifest's `cdnBase`; the client constructs jsDelivr primary + raw fallback URLs itself.)

### 7.4 Manifest (`manifest.json`) — schema `manifest.schema.json`

- File cap **256 KB**. `additionalProperties: false`.
- Required: `schemaVersion` (int ≥ 1), `contentVersion` (must match the pointer's), `minAppVersion`, `cdnBase` (string 1–512; base URL every fileRef path joins onto — e.g. the tag's raw/jsDelivr URL), `maps` (array, **max 60** descriptors).
- Optional `changelog`: a bare string, OR an array whose items are strings or `{ "version"?: string, "notes": string }` objects (`additionalProperties: false`, `notes` required). **Malformed items are ignored by the app.**
- **descriptor** (`additionalProperties: false`): required `id` (slug 1–64; used in `underdeck://map/<id>` deep links; must never change once released), `type` (enum `"flat" | "sphere"`; unknown values render as "update required"), `title` (1–160), `document` (documentRef). Optional: `subtitle` (≤ 240), `icon` (enum **`map` | `dungeon` | `station` | `sphere` | `sector`**; unknown → generic glyph), `order` (int, gallery sort key, default 0), `version` (int ≥ 1, per-map content version, default 1), `draft` (bool, default false — **hidden from release builds when true**), `tags` (≤ 32 items, each 1–40 chars), `assets` (array of assetRef).
- **documentRef** = fileRef with `bytes` ≤ **2,097,152** (2 MB).
- **assetRef** = fileRef with `bytes` ≤ **8,388,608** (8 MB); `pixelSize` items capped at 4096; **if `kind` ∈ {`background`, `background_hd`, `texture`} then `pixelSize` is REQUIRED** (so the decode bound is a real pre-fetch gate). `thumbnail` is another used kind (AUDIT-V2 example) but doesn't require pixelSize.
- AUDIT-V2 §4.3 example entries (abridged): flat map `hideous-dungeon` with `background` bg@2048.png `pixelSize [1536, 2048]` + `thumbnail` thumb.png `[480, 640]`; sphere map `keth-9` with `texture` surface@2048.jpg `[2048, 1024]`.

### 7.5 Map document (`maps/<id>/map.json`) — schema `map.schema.json`

- File cap **2 MB**. `additionalProperties: false`. Required: `schemaVersion`, `id` (must match the manifest descriptor id), `type` (`flat` | `sphere`).
- `schemaVersion` semantics (from the schema description): **1** = current; **2 adds grid-sphere documents** (`grid` + zone `gridPos`/`cellNum`); a higher value renders as "update required".
- Conditionals: `type == "flat"` ⇒ `canvas` required; `type == "sphere"` ⇒ `sphere` required.
- **`canvas`** (flat): `{ width, height }`, numbers, exclusiveMinimum 0 (finite, > 0). Flat geometry is authored in **image pixel space** `[x, y]` of the background image.
- **`sphere`**: required `textureAsset` (string 1–64 — the manifest asset **kind** supplying the equirectangular surface texture, e.g. `"texture"`); optional `initialOrientation` `{ lat?, lon? }` (numbers); optional `autoRotateDegPerSec` (number).
- **`grid`** (sphere docs only, schemaVersion 2): required `cols` (int 2–72), `rows` (int 2–36). A grid cell's implicit geometry: `lonWest = -180 + col*(360/cols)`, `latNorth = 90 - row*(180/rows)`, **latitudes clamped to ±89.5**.
- **`theme`**: the 9-token closed object of §3.6. hexColor pattern: `^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$` (i.e. `#RRGGBB` or `#AARRGGBB`, `#` optional). fontFamily enum: `Inter`, `JetBrainsMono`, `Quicksand`.
- **`fieldsSchema`**: array, **max 25 items**. Each fieldSpec (`additionalProperties: false`): required `key` (1–64, stable; zone `fields` keyed by it), `label` (1–120), `type` (enum `text` | `longText` | `number` | `enum` | `stringList` | `link` — note wire name for enumeration is `"enum"`). Optional: `options` (enum options; **schema cap 20 items**, each 1–60 chars — CONTRIBUTING/audit say **≤ 12**, see §7.6), `unit` (≤ 24), `style` (≤ 32; audit example uses `"badge"`), `searchable` (bool, default false — include value in FTS), `filterable` (bool, default false — **honored only for type `"enum"`, dropped otherwise**).
- **`zones`**: array, schema maxItems **2600** (absolute ceiling for grid docs = cols×rows; **non-grid docs are app-capped at 500**). Each zone (`additionalProperties: false`): required `id` (1–64), `name` (1–160); `geometry` OR `gridPos` required (anyOf) — a zone MAY omit geometry iff the doc has a `grid` AND the zone has `gridPos` (implicit cell quad); **duplicate gridPos cells are rejected by the app**. Optional: `gridPos` (`[col, row]`, 0-based ints, col < cols, row < rows), `cellNum` (int ≥ 0 — display number matching the community spreadsheet, purely presentational), `labelAnchor` (point2d), `themeOverride` (zoneFill/zoneStroke/glow only), `fields` (free-form object keyed by fieldsSchema keys; `additionalProperties: true`; interpretation driven by the field's declared type).
- **Geometry kinds** (oneOf; **unknown `kind` is retained but not drawn/picked**):
  - `polygon` — `rings: [[[x,y],…],…]`; first ring = outline, rest = holes, **even-odd fill**; each ring ≥ 3 points; total vertices per zone ≤ 5000 (CI-checked).
  - `marker` — `{ at: [x,y], hitRadius: number > 0 }`; hit-tested by pixel distance **regardless of zoom**.
  - `sphericalPolygon` — `rings: [[[lon,lat],…],…]` degrees, **GeoJSON order [lon, lat]**; long edges pre-resampled into short arcs (≤ 2°) at author/CI time; **the app never tessellates**.
  - `sphericalCap` — `{ center: [lon,lat], radiusDeg: number in (0, 180] }`; use for pole-containing zones (angular-distance test avoids degenerate winding).
- Full flat-map and sphere-map examples exist in CONTRIBUTING-MAPS.md §3/§4 and AUDIT-V2 §4.3 (with `theme`, `fieldsSchema` `threat`/`loot`/`brief` and `faction`/`gravity`, and zones "Hall of Chains" (polygon), "Sealed Shrine" (marker, hitRadius 48), "Crucible Sector" (sphericalPolygon), "Glass Cap" (sphericalCap center [0, 90] radius 18)).

### 7.6 Hard bounds (enforced by schemas + CI + the app's `MapContentValidator`; tripping any bound rejects the whole file)

| bound | value |
|---|---|
| pointer file | ≤ 64 KB |
| manifest file | ≤ 256 KB |
| map document | ≤ 2 MB |
| image asset | ≤ 8 MB |
| image dimension (per side) | ≤ 4096 px |
| maps per manifest | ≤ 60 |
| zones per map | ≤ 500 (non-grid) / cols×rows up to 2600 (grid docs, app-enforced) |
| vertices per zone | ≤ 5000 |
| fields per map | ≤ 25 |
| options per enum field | ≤ 12 (CONTRIBUTING + audit amendment) / 20 (map.schema.json) — **inconsistency, resolve; safer: 12** |
| tags per map | ≤ 32 |

Additional client-side gates: stream cut-off beyond declared `bytes`/Content-Length; decode cap ~2048 px absolute; pointer signature; anti-rollback; minAppVersion.

### 7.7 Contributor PR flow (CONTRIBUTING-MAPS.md §2)

1. Branch off `main`. 2. Create `maps/<id>/` (stable lowercase slug ≤ 64 chars — appears in deep links, never changes). 3. Author `map.json`; validate locally: `npx ajv-cli validate -s schemas/map.schema.json -d "maps/<id>/map.json" --spec=draft2020 --strict=false`. 4. Add a `maps[]` entry to `manifest.json` with placeholder hashes. 5. Open PR — CI validates everything and **posts the real sha256/bytes/pixelSize**. 6. Paste CI's values back; push; CI goes green. 7. Merge (nothing live yet — pointer still names the previous tag). 8. Release by tagging. `"draft": true` lets a map land across several PRs while release builds hide it.

### 7.8 Release flow (tag-pin; CONTRIBUTING-MAPS.md §8)

1. Merge all content PRs with matching sha256s. 2. Bump manifest `contentVersion` (+ add a `changelog` entry for the in-app "What's new" banner). 3. `git tag content-2026.07.0 && git push --tags` (freezes manifest+documents+assets under the tag). 4. Point manifest `cdnBase` at the tag's raw URL. 5. Update `latest-v1.json`: new `tag`, matching `contentVersion`, new manifest fileRef (path under tag + sha256/bytes). 6. Commit **only** `latest-v1.json` to main. Devices see it at next poll; devices below `minAppVersion` ignore it. Rollback = point the pointer at the previous tag (bytes still frozen) — but note the app-side **anti-rollback** rule means editorial rollbacks are published as roll-*forwards* (N+1 pointing at the old tag).

### 7.9 CI (`content-ci.yml`, template — goes in the CONTENT repo, does nothing in the app repo)

- Triggers: `pull_request`, `push` to `main`, tags `content-*`. Ubuntu; Python 3.12; `jsonschema` (Draft 2020-12) + `Pillow`.
- Steps: (1) size caps on `latest-v1.json` (64 KB) and `manifest.json` (256 KB); (2) schema-validate pointer + manifest + every referenced map document; (3) for every `document`/`asset` fileRef: file exists; declared sha256/bytes match actual bytes; document ≤ 2 MB; image ≤ 8 MB and ≤ 4096 px/side; rendered kinds (`background`, `background_hd`, `texture`) must declare `pixelSize`, and declared pixelSize must equal actual; (4) manifest ≤ 60 maps; per document ≤ 500 zones; per zone vertex count ≤ 5000 (`polygon`/`sphericalPolygon` = sum of ring lengths; `marker`/`sphericalCap` = 1); (5) emits a copy-pasteable integrity table (path | sha256 | bytes | pixelSize) to the job summary; exits 1 with `::error::` annotations on any violation.
- AUDIT-V2 M0 additions: ed25519 signing ceremony, and a **post-tag verification that the CDN URLs serve the tagged content before the pointer is published**.

### 7.10 Theming (contributor-facing summary, CONTRIBUTING-MAPS.md §6)

Themes are advisory; the app clamps hostile palettes ("author for a dark canvas"). Map-level: all 9 tokens optional. Colors `#RRGGBB`/`#AARRGGBB` (# optional); `background`/`surface` held below a max luminance (light values ignored). `fontFamily`: Inter | JetBrainsMono | Quicksand only. Per-zone `themeOverride` restricted to `zoneFill`/`zoneStroke`/`glow`; any other token dropped.

### 7.11 Delivery milestones for the maps module (AUDIT-V2 §4.9 — useful sizing reference)

M0 socle (repo+CI+signature+app models/validator/blob store/DB/seed, + 3-day 3D spike in parallel): 1.5 wk · M1 flat MVP (viewport, hit-test, ZoneSheet, fields renderer, gallery, opt-in, **zone-list a11y view**, **transparency copy update**): 2 wk · M2 sphere: 3–4 wk (pure) / 1.5–2 wk (globe.gl — the web path) · M3 theming + advanced fields + filters + FTS + deep links: 1.5 wk · M4 hardening (GC, update/tombstone banners, storage management, memory passes): 1 wk.
Test plan: hostile-fixture validators (oversized, 501 zones, invalid colors, wrong sha256); sphere math (antimeridian, polar cap, inverse rotation); polygon/hole/marker hit-tests; theme sanitize; **contract test with a prod-manifest snapshot fixture** (app/content divergence breaks the build, not users); mocked network (304, 429→fallback, sha256 mismatch→rollback, interruption→resume); ed25519 RFC 8032 vectors; golden/visual tests of painters + ZoneSheet in 2 themes.

### 7.12 Community features already envisioned on top of the repo (AUDIT-V2 §6)

Personal pins/notes on maps (long-press → tagged note linked to (mapId, zoneId, coords), rides the existing export); community map contributions by PR (the repo IS the CMS; contributor credits in the ZoneSheet); in-app content changelog; unified global search (KB + map zones + jobs + wallets, via the unicode FTS); offline "Field kit" (pack status + pre-download all + storage screen); cross-links jobs/fishing → maps ("View on map" via (mapId, zoneId)); zone share cards; seasonal theme packs.

---

## 8. Assets referenced by the audited documents

- `assets/catalog/wallets.json` — 769 entries, 93 KB — **must not ship in the web bundle** (R1).
- `assets/catalog/jobs.json` — 332–337 KB, 371 jobs (11 with negative bonuses to −2740).
- `assets/knowledge/images/space-station-map.png` — 4086×4086 (~67 MB decoded) and `hideous-dungeon-map.jpg` (~32 MB decoded) — must be downscaled/compressed (≤ 2000 px justified; WebP suggested) before reuse.
- `train_schedule.json` — 60 minute→zone entries (Mars Express); real zone ids 234–346.
- `assets/knowledge/` markdown KB — 14 articles, 9 placeholders at v1; categories incl. `03-guilds/`, `04-shires/`.
- Fonts: Inter, JetBrainsMono, Quicksand (bundled; OFL licenses must be registered/attributed — the Flutter app registers them manually at startup).
- `docs/content-repo/schemas/*.json` + `content-ci.yml` — to be copied into the content repo, not the app.

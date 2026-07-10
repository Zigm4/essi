# Contributing maps to Underdeck

Underdeck's interactive maps are **content, not code**. They live in a separate
public *content repository* and are shipped to the app as signed, tag-pinned
JSON + images over a CDN — the app binary never has to change to add or edit a
map. This guide is for contributors adding or editing a map via pull request.

> These files (`docs/content-repo/`) are a **drop-in starter kit** for that
> content repo: the three JSON Schemas the app validates against, a sample CI
> workflow, and this guide. Copy them into the content repo — they are not used
> by the app build.

---

## 1. The content chain (how a map reaches a device)

```
latest-v1.json (pointer, mutable)  ──▶  manifest.json (tag-pinned, immutable)
        │                                        │
        │ tag: "content-2026.07.0"               ├─▶ maps/<id>/map.json   (document)
        ▼                                        └─▶ maps/<id>/*.png|webp  (assets)
   points at the manifest for                 each referenced by path + sha256 + bytes
   the current release tag
```

1. **Pointer** (`latest-v1.json`) — tiny, *mutable*. The only file the app polls.
   It names the git **tag** for the current release and the manifest inside it.
2. **Manifest** (`manifest.json`) — the catalogue of every map at that tag, with
   `sha256` + `bytes` (+ `pixelSize` for images) for every document and asset.
   Immutable: it lives under the tag and never changes once released.
3. **Map documents** (`maps/<id>/map.json`) — one per map: canvas/sphere config,
   theme, field schema, and zones.
4. **Assets** (`maps/<id>/…`) — background images and sphere textures.

Because every file is pinned by `sha256`, the app rejects any byte that does not
match what the manifest declared. **Never edit a released tag** — cut a new one.

### Repository layout

```
content-repo/
├─ latest-v1.json
├─ manifest.json
├─ maps/
│  └─ <map-id>/
│     ├─ map.json
│     ├─ background.webp        # flat maps
│     └─ texture.webp           # sphere maps
├─ schemas/                      # copied from this kit
│  ├─ pointer.schema.json
│  ├─ manifest.schema.json
│  └─ map.schema.json
└─ .github/workflows/
   └─ content-ci.yml            # copied from this kit
```

---

## 2. Add or edit a map — the PR flow

1. **Branch** off `main`.
2. **Create `maps/<id>/`** with `map.json` and its image(s). Pick a stable,
   lowercase-slug `id` (`≤ 64` chars) — it appears in `underdeck://map/<id>`
   deep links, so it must not change once released.
3. **Author `map.json`** (see §3 / §4). Validate locally:
   ```bash
   npx ajv-cli validate -s schemas/map.schema.json -d "maps/<id>/map.json" \
     --spec=draft2020 --strict=false
   ```
4. **Add the map to `manifest.json`** — a new entry in `maps[]` with the
   document + asset refs. Leave `sha256`/`bytes` as placeholders; CI computes and
   reports the correct values (see §6).
5. **Open the PR.** `content-ci.yml` validates every file against the schemas,
   checks image bounds, and posts the real `sha256`/`bytes` for each file.
6. **Paste CI's reported hashes** back into `manifest.json` and push. CI now goes
   green: declared hashes match the bytes.
7. **Merge.** Nothing is live yet — the pointer still names the previous tag.
8. **Release** by tagging (§5). Only then does the pointer flip.

Set `"draft": true` on a descriptor to land a map that release builds hide — good
for staging a map across several PRs.

---

## 3. `map.json` — flat maps

A flat map is authored in **image pixel space**. Zone coordinates are `[x, y]`
pixels on the background image; `canvas` declares that image's size.

```json
{
  "schemaVersion": 1,
  "id": "redwater-station",
  "type": "flat",
  "canvas": { "width": 2048, "height": 1536 },
  "theme": { "zoneStroke": "#38F9D7", "glow": "#38F9D7" },
  "fieldsSchema": [
    { "key": "line", "label": "Line", "type": "enum",
      "options": ["Red", "Blue"], "filterable": true, "searchable": true },
    { "key": "depth", "label": "Depth", "type": "number", "unit": "m" }
  ],
  "zones": [
    {
      "id": "platform-3",
      "name": "Platform 3",
      "geometry": {
        "kind": "polygon",
        "rings": [[[820, 410], [1180, 410], [1180, 640], [820, 640]]]
      },
      "labelAnchor": [1000, 525],
      "fields": { "line": "Red", "depth": 18 }
    }
  ]
}
```

**Flat geometry kinds**

- `polygon` — `rings: [[[x,y], …], …]`. First ring is the outline; the rest are
  holes (even-odd fill). Each ring needs `≥ 3` points.
- `marker` — `{ "at": [x,y], "hitRadius": <px> }`. A point-of-interest, hit-tested
  by pixel distance regardless of zoom.

---

## 4. `map.json` — sphere maps

A sphere (globe) map is authored in **degrees**, GeoJSON order `[lon, lat]`. The
surface texture is an equirectangular image referenced by asset `kind`.

```json
{
  "schemaVersion": 1,
  "id": "mars-globe",
  "type": "sphere",
  "sphere": {
    "textureAsset": "texture",
    "initialOrientation": { "lat": 0, "lon": 40 },
    "autoRotateDegPerSec": 3
  },
  "theme": { "zoneStroke": "#FF6B6B" },
  "zones": [
    {
      "id": "olympus",
      "name": "Olympus Mons",
      "geometry": {
        "kind": "sphericalPolygon",
        "rings": [[[-134, 18], [-132, 20], [-130, 18], [-132, 16]]]
      }
    },
    {
      "id": "north-cap",
      "name": "North Polar Cap",
      "geometry": { "kind": "sphericalCap", "center": [0, 90], "radiusDeg": 12 }
    }
  ]
}
```

**Spherical geometry kinds**

- `sphericalPolygon` — `rings: [[[lon,lat], …], …]`. **Pre-resample** long edges
  into short arcs at author/CI time; the app never tessellates.
- `sphericalCap` — `{ "center": [lon,lat], "radiusDeg": <deg> }`. Use for
  pole-containing zones to avoid degenerate winding.

---

## 5. Fields

`fieldsSchema` declares the columns; each zone's `fields` object supplies values
keyed by `key`. Types (`≤ 25` fields per map):

| `type`       | value shape        | notes                                          |
| ------------ | ------------------ | ---------------------------------------------- |
| `text`       | string             | short, one line                                |
| `longText`   | string             | multi-line / markdown-ish                      |
| `number`     | number             | pair with `unit`                               |
| `enum`       | string             | must be one of `options` (`≤ 12`, `≤ 60` chars); the **only** type that may set `filterable: true` |
| `stringList` | array of string    | chips                                          |
| `link`       | string             | `underdeck://…` internal or an allow-listed URL |

Set `searchable: true` to include a field's value in the in-app full-text index.

---

## 6. Theming tokens

Themes are **advisory** — the app runs every content colour through a dark-only
WCAG guard (§4.6 of the app audit), so a hostile or low-contrast palette is
clamped back to legible defaults rather than breaking the UI. Author for a
**dark** canvas.

Map-level `theme` (all 9 tokens optional; each falls back to the app default):

`background`, `surface`, `zoneFill`, `zoneStroke`, `zoneSelectedFill`, `glow`,
`label`, `accent`, `fontFamily`.

- **Colours**: `#RRGGBB` or `#AARRGGBB` (leading `#` optional). `background` and
  `surface` are held below a max luminance — light values are ignored.
- **`fontFamily`**: one of `Inter`, `JetBrainsMono`, `Quicksand` only.

Per-zone `themeOverride` is **restricted to `zoneFill`, `zoneStroke`, `glow`** —
a zone cannot repaint the map background/surface/label/font. Any other token in
an override is dropped.

---

## 7. Integrity: `sha256` + `bytes` + `pixelSize`

Every `document` and `asset` ref carries:

- **`path`** — repo-relative, joined onto the manifest `cdnBase` (`≤ 256` chars).
- **`sha256`** — lowercase hex SHA-256 of the exact bytes (`64` chars).
- **`bytes`** — the declared byte length (the app's pre-download size gate).
- **`pixelSize`** — `[w, h]`, **required** for rendered images whose `kind` is
  `background`, `background_hd`, or `texture` (so the decode bound is enforced
  before the image is fetched).

You do not compute these by hand — `content-ci.yml` emits them (§8 of the
workflow). Paste its values in and push.

**Hard bounds enforced by both the schemas and the app** (`MapContentValidator`):

| bound                     | value    |
| ------------------------- | -------- |
| pointer file              | ≤ 64 KB  |
| manifest file             | ≤ 256 KB |
| map document              | ≤ 2 MB   |
| image asset               | ≤ 8 MB   |
| image dimension (per side)| ≤ 4096 px|
| maps per manifest         | ≤ 60     |
| zones per map             | ≤ 500    |
| vertices per zone         | ≤ 5000   |
| fields per map            | ≤ 25     |
| options per enum field    | ≤ 12     |
| tags per map              | ≤ 32     |

Tripping any bound **rejects the whole file** — CI fails, and so would the app.

---

## 8. Releasing (tag-pin flow)

The pointer is the only mutable file; releasing is flipping it to a fresh,
immutable tag.

1. Merge all content PRs for the release into `main` with matching `sha256`s.
2. Bump `manifest.json` `contentVersion` (and add a `changelog` entry — a string
   or `{ "version", "notes" }` object — to surface the in-app "What's new"
   banner).
3. **Tag** the release commit, e.g. `git tag content-2026.07.0 && git push --tags`.
   The manifest + documents + assets are now frozen under that tag.
4. Point `cdnBase` (in the manifest) at the tag's raw URL so every `path`
   resolves under the tag.
5. Update `latest-v1.json`: set `tag` to `content-2026.07.0`, `contentVersion` to
   match, and the `manifest` ref (`path` under the tag + its `sha256`/`bytes`).
6. Commit **only** `latest-v1.json` to `main`. The next time each device polls,
   it sees the new tag and downloads the release. Devices below `minAppVersion`
   ignore it.

To roll back, point `latest-v1.json` at the previous tag — the old bytes are
still frozen and intact.

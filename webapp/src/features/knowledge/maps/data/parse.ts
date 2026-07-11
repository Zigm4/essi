/**
 * Wire → domain parsing and validation (maps spec §5, §6). Validators NEVER
 * throw: structural/parse failures become `malformedStructure`, bounds/size
 * failures become their specific code. Unknown enum values degrade to
 * `'unknown'` (must-ignore, §6.1) rather than rejecting.
 */

import type { GeoPoint } from '../model/geo';
import { parseGridPos } from '../model/geo';
import {
  MapLimits,
  RENDERED_IMAGE_KINDS,
  parseError,
  parseOk,
  type MapParseResult,
  type MapValidationCode,
} from '../model/limits';
import { parseTheme, parseZoneOverride } from '../model/theme';
import {
  parseMapIcon,
  parseMapType,
  parseZoneFieldType,
  vertexCount,
  type CanvasPoint,
  type CanvasSize,
  type ChangelogEntry,
  type MapDescriptor,
  type MapDocument,
  type MapFileRef,
  type MapPointer,
  type MapZone,
  type MapsManifest,
  type SphereConfig,
  type ZoneFieldSpec,
  type ZoneGeometry,
} from '../model/types';

class ValidationFail extends Error {
  readonly code: MapValidationCode;
  constructor(code: MapValidationCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ValidationFail';
  }
}

function struct(message: string): never {
  throw new ValidationFail('malformedStructure', message);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function reqObject(v: unknown, what: string): Record<string, unknown> {
  if (!isRecord(v)) struct(`${what}: expected object`);
  return v;
}

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string') struct(`missing string "${key}"`);
  return v;
}

function optString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' ? v : null;
}

function reqNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) struct(`missing number "${key}"`);
  return v;
}

function optBool(obj: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = obj[key];
  return typeof v === 'boolean' ? v : fallback;
}

function optInt(obj: Record<string, unknown>, key: string, fallback: number): number {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function cap(s: string, max: number, label: string): string {
  if (s.length > max) throw new ValidationFail('stringTooLong', `${label} exceeds ${max}`);
  return s;
}

function parsePixelSize(raw: unknown): readonly [number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const a = raw[0];
  const b = raw[1];
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return [a, b];
}

function parseFileRef(raw: unknown, what: string): MapFileRef {
  const obj = reqObject(raw, what);
  const path = cap(reqString(obj, 'path'), MapLimits.maxPathLength, `${what}.path`);
  const sha256 = cap(reqString(obj, 'sha256'), MapLimits.maxSha256Length, `${what}.sha256`);
  const bytes = reqNumber(obj, 'bytes');
  if (bytes < 0) struct(`${what}.bytes < 0`);
  return { path, sha256, bytes, kind: optString(obj, 'kind'), pixelSize: parsePixelSize(obj.pixelSize) };
}

function wrap<T>(fn: () => T): MapParseResult<T> {
  try {
    return parseOk(fn());
  } catch (e) {
    if (e instanceof ValidationFail) return parseError(e.code, e.message);
    return parseError('malformedStructure', e instanceof Error ? e.message : 'parse error');
  }
}

// --- Pointer -----------------------------------------------------------------

export function validatePointer(json: unknown, byteLength: number): MapParseResult<MapPointer> {
  return wrap(() => {
    if (byteLength > MapLimits.pointerMaxBytes) {
      throw new ValidationFail('tooLarge', 'pointer too large');
    }
    const obj = reqObject(json, 'pointer');
    const schemaVersion = reqNumber(obj, 'schemaVersion');
    const contentVersion = cap(
      reqString(obj, 'contentVersion'),
      MapLimits.maxVersionStringLength,
      'contentVersion',
    );
    const tag = cap(reqString(obj, 'tag'), MapLimits.maxVersionStringLength, 'tag');
    const minAppVersion = cap(
      reqString(obj, 'minAppVersion'),
      MapLimits.maxVersionStringLength,
      'minAppVersion',
    );
    const manifest = parseFileRef(obj.manifest, 'pointer.manifest');
    return { schemaVersion, contentVersion, tag, minAppVersion, manifest };
  });
}

// --- Changelog (must-ignore, §6.5) ------------------------------------------

export function parseChangelog(raw: unknown): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const pushEntry = (version: string | null, notes: unknown): void => {
    if (typeof notes !== 'string') return;
    const trimmed = notes.trim();
    if (trimmed.length === 0) return;
    const v = version === null ? null : version.trim();
    entries.push({ version: v !== null && v.length > 0 ? v : null, notes: trimmed });
  };
  if (typeof raw === 'string') {
    pushEntry(null, raw);
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') pushEntry(null, item);
      else if (isRecord(item)) {
        const version = typeof item.version === 'string' ? item.version : null;
        pushEntry(version, item.notes);
      }
    }
  }
  return entries;
}

/** Pure banner gate (§6.5). */
export function shouldShowMapsChangelog(args: {
  contentVersion: string;
  lastSeenVersion: string | null;
  hasChangelog: boolean;
}): boolean {
  return (
    args.hasChangelog &&
    args.contentVersion !== '' &&
    args.contentVersion !== args.lastSeenVersion
  );
}

// --- Manifest ----------------------------------------------------------------

function parseDescriptor(raw: unknown): MapDescriptor {
  const obj = reqObject(raw, 'descriptor');
  const id = cap(reqString(obj, 'id'), MapLimits.maxIdLength, 'map.id');
  const title = cap(reqString(obj, 'title'), MapLimits.maxTitleLength, 'map.title');
  const subtitleRaw = optString(obj, 'subtitle');
  const subtitle = subtitleRaw === null ? null : cap(subtitleRaw, MapLimits.maxSubtitleLength, 'map.subtitle');
  const tagsRaw = Array.isArray(obj.tags) ? obj.tags : [];
  if (tagsRaw.length > MapLimits.maxTags) {
    throw new ValidationFail('stringTooLong', 'too many tags');
  }
  const tags: string[] = [];
  for (const t of tagsRaw) {
    if (typeof t === 'string') tags.push(cap(t, MapLimits.maxTagLength, 'tag'));
  }
  const document = parseFileRef(obj.document, 'map.document');
  if (document.bytes > MapLimits.documentMaxBytes) {
    throw new ValidationFail('tooLarge', `document ${id} exceeds size cap`);
  }
  const assetsRaw = Array.isArray(obj.assets) ? obj.assets : [];
  const assets: MapFileRef[] = [];
  for (const a of assetsRaw) {
    const ref = parseFileRef(a, 'asset');
    if (ref.bytes > MapLimits.maxImageBytes) {
      throw new ValidationFail('imageTooLarge', `asset ${ref.path} exceeds image cap`);
    }
    const rendered = ref.kind !== null && RENDERED_IMAGE_KINDS.has(ref.kind);
    if (ref.pixelSize === null) {
      if (rendered) {
        throw new ValidationFail('imageDimensionsMissing', `asset ${ref.path} missing pixelSize`);
      }
    } else if (ref.pixelSize[0] > MapLimits.maxImageDimension || ref.pixelSize[1] > MapLimits.maxImageDimension) {
      throw new ValidationFail('imageDimensionsTooLarge', `asset ${ref.path} too large`);
    }
    assets.push(ref);
  }
  return {
    id,
    type: parseMapType(obj.type),
    title,
    subtitle,
    icon: parseMapIcon(obj.icon),
    order: optInt(obj, 'order', 0),
    version: optInt(obj, 'version', 1),
    draft: optBool(obj, 'draft', false),
    tags,
    document,
    assets,
  };
}

export function validateManifest(json: unknown, byteLength: number): MapParseResult<MapsManifest> {
  return wrap(() => {
    if (byteLength > MapLimits.manifestMaxBytes) {
      throw new ValidationFail('tooLarge', 'manifest too large');
    }
    const obj = reqObject(json, 'manifest');
    const schemaVersion = reqNumber(obj, 'schemaVersion');
    const contentVersion = cap(
      reqString(obj, 'contentVersion'),
      MapLimits.maxVersionStringLength,
      'contentVersion',
    );
    const minAppVersion = cap(
      reqString(obj, 'minAppVersion'),
      MapLimits.maxVersionStringLength,
      'minAppVersion',
    );
    const cdnBase = cap(reqString(obj, 'cdnBase'), MapLimits.maxCdnBaseLength, 'cdnBase');
    const mapsRaw = Array.isArray(obj.maps) ? obj.maps : [];
    if (mapsRaw.length > MapLimits.maxMaps) {
      throw new ValidationFail('tooManyMaps', 'too many maps');
    }
    const maps = mapsRaw.map(parseDescriptor);
    return {
      schemaVersion,
      contentVersion,
      minAppVersion,
      cdnBase,
      maps,
      changelog: parseChangelog(obj.changelog),
    };
  });
}

// --- Document geometry -------------------------------------------------------

function parseXY(raw: unknown): CanvasPoint {
  if (!Array.isArray(raw) || raw.length < 2) struct('point: expected [x,y]');
  const x = raw[0];
  const y = raw[1];
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    struct('point: non-numeric coordinate');
  }
  return { x, y };
}

function parseLonLat(raw: unknown): GeoPoint {
  if (!Array.isArray(raw) || raw.length < 2) struct('geo point: expected [lon,lat]');
  const lon = raw[0];
  const lat = raw[1];
  if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    struct('geo point: non-numeric coordinate');
  }
  return { lon, lat };
}

function parseRings<T>(raw: unknown, point: (r: unknown) => T): T[][] {
  if (!Array.isArray(raw)) struct('rings: expected array');
  return raw.map((ring) => {
    if (!Array.isArray(ring)) struct('ring: expected array');
    return ring.map(point);
  });
}

function parseGeometry(raw: unknown): ZoneGeometry | null {
  if (raw === null || raw === undefined) return null;
  const obj = reqObject(raw, 'geometry');
  switch (obj.kind) {
    case 'polygon':
      return { kind: 'polygon', rings: parseRings(obj.rings, parseXY) };
    case 'marker':
      return { kind: 'marker', at: parseXY(obj.at), hitRadius: reqNumber(obj, 'hitRadius') };
    case 'sphericalPolygon':
      return { kind: 'sphericalPolygon', rings: parseRings(obj.rings, parseLonLat) };
    case 'sphericalCap':
      return {
        kind: 'sphericalCap',
        center: parseLonLat(obj.center),
        radiusDeg: reqNumber(obj, 'radiusDeg'),
      };
    default:
      return { kind: 'unknown' };
  }
}

function parseFieldSpec(raw: unknown): ZoneFieldSpec {
  const obj = reqObject(raw, 'field');
  const key = cap(reqString(obj, 'key'), MapLimits.maxFieldKeyLength, 'field.key');
  const label = cap(reqString(obj, 'label'), MapLimits.maxFieldLabelLength, 'field.label');
  const type = parseZoneFieldType(obj.type);
  let options: string[] | null = null;
  if (Array.isArray(obj.options)) {
    if (obj.options.length > MapLimits.maxOptionsPerField) {
      throw new ValidationFail('tooManyOptions', `field ${key} has too many options`);
    }
    options = [];
    for (const o of obj.options) {
      if (typeof o === 'string') options.push(cap(o, MapLimits.maxOptionLength, 'option'));
    }
  }
  const unitRaw = optString(obj, 'unit');
  const unit = unitRaw === null ? null : cap(unitRaw, MapLimits.maxUnitLength, 'field.unit');
  const styleRaw = optString(obj, 'style');
  const style = styleRaw === null ? null : cap(styleRaw, MapLimits.maxStyleLength, 'field.style');
  const searchable = optBool(obj, 'searchable', false);
  const filterableRaw = optBool(obj, 'filterable', false);
  return {
    key,
    label,
    type,
    options,
    unit,
    style,
    searchable: type === 'unknown' ? false : searchable,
    filterable: type === 'enum' ? filterableRaw : false,
  };
}

function parseZone(
  raw: unknown,
  grid: { cols: number; rows: number } | null,
  seenCells: Set<number>,
): MapZone {
  const obj = reqObject(raw, 'zone');
  const id = cap(reqString(obj, 'id'), MapLimits.maxIdLength, 'zone.id');
  const name = cap(reqString(obj, 'name'), MapLimits.maxZoneNameLength, 'zone.name');
  const gridPos = parseGridPos(obj.gridPos);
  const geometry = parseGeometry(obj.geometry);
  if (geometry === null && gridPos === null) {
    struct(`zone ${id}: geometry required`);
  }
  // Vertex cap (implicit grid quad counts as 4).
  const vc = geometry === null ? 4 : vertexCount(geometry);
  if (vc > MapLimits.maxVerticesPerZone) {
    throw new ValidationFail('tooManyVertices', `zone ${id} exceeds vertex cap`);
  }
  if (grid !== null && gridPos !== null) {
    if (gridPos.col >= grid.cols || gridPos.row >= grid.rows) {
      throw new ValidationFail('invalidBounds', `zone ${id}: gridPos out of range`);
    }
    const cellKey = gridPos.row * grid.cols + gridPos.col;
    if (seenCells.has(cellKey)) {
      throw new ValidationFail('invalidBounds', `zone ${id}: duplicate cell`);
    }
    seenCells.add(cellKey);
  }
  const cellNumRaw = obj.cellNum;
  const cellNum =
    typeof cellNumRaw === 'number' && Number.isInteger(cellNumRaw) ? cellNumRaw : null;
  let labelAnchor: CanvasPoint | null = null;
  if (Array.isArray(obj.labelAnchor) && obj.labelAnchor.length >= 2) {
    const x = obj.labelAnchor[0];
    const y = obj.labelAnchor[1];
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      labelAnchor = { x, y };
    }
  }
  return {
    id,
    name,
    geometry,
    gridPos,
    cellNum,
    labelAnchor,
    themeOverride: parseZoneOverride(obj.themeOverride),
    fields: isRecord(obj.fields) ? obj.fields : {},
  };
}

function parseGrid(raw: unknown): { cols: number; rows: number } | null {
  if (!isRecord(raw)) return null;
  const cols = raw.cols;
  const rows = raw.rows;
  if (typeof cols !== 'number' || typeof rows !== 'number') return null; // must-ignore bad shape
  const c = Math.trunc(cols);
  const r = Math.trunc(rows);
  if (c < MapLimits.minGridCols || c > MapLimits.maxGridCols || r < MapLimits.minGridRows || r > MapLimits.maxGridRows) {
    throw new ValidationFail('invalidBounds', 'grid bounds out of range');
  }
  return { cols: c, rows: r };
}

function parseSphere(raw: unknown): SphereConfig | null {
  if (!isRecord(raw)) return null;
  const textureAsset = cap(
    typeof raw.textureAsset === 'string' ? raw.textureAsset : 'texture',
    MapLimits.maxTextureAssetLength,
    'sphere.textureAsset',
  );
  const io = isRecord(raw.initialOrientation) ? raw.initialOrientation : {};
  const lat = typeof io.lat === 'number' && Number.isFinite(io.lat) ? io.lat : 0;
  const lon = typeof io.lon === 'number' && Number.isFinite(io.lon) ? io.lon : 0;
  const spin =
    typeof raw.autoRotateDegPerSec === 'number' && Number.isFinite(raw.autoRotateDegPerSec)
      ? raw.autoRotateDegPerSec
      : 0;
  return { textureAsset, initialOrientation: { lat, lon }, autoRotateDegPerSec: spin };
}

export function validateDocument(json: unknown, byteLength: number): MapParseResult<MapDocument> {
  return wrap(() => {
    if (byteLength > MapLimits.documentMaxBytes) {
      throw new ValidationFail('tooLarge', 'document too large');
    }
    const obj = reqObject(json, 'document');
    const schemaVersion = reqNumber(obj, 'schemaVersion');
    const fieldsRaw = Array.isArray(obj.fieldsSchema) ? obj.fieldsSchema : [];
    if (fieldsRaw.length > MapLimits.maxFieldsSchema) {
      throw new ValidationFail('tooManyFields', 'too many fields');
    }
    const grid = parseGrid(obj.grid);
    const zonesRaw = Array.isArray(obj.zones) ? obj.zones : [];
    const zoneCap = grid === null ? MapLimits.maxZonesPerMap : Math.min(grid.cols * grid.rows, MapLimits.maxZonesPerGridMap);
    if (zonesRaw.length > zoneCap) {
      throw new ValidationFail('tooManyZones', 'too many zones');
    }
    const id = cap(reqString(obj, 'id'), MapLimits.maxIdLength, 'doc.id');
    let canvas: CanvasSize | null = null;
    if (isRecord(obj.canvas)) {
      const width = obj.canvas.width;
      const height = obj.canvas.height;
      if (
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      ) {
        throw new ValidationFail('invalidBounds', 'invalid canvas bounds');
      }
      canvas = { width, height };
    }
    const sphere = parseSphere(obj.sphere);
    const fieldsSchema = fieldsRaw.map(parseFieldSpec);
    const seenCells = new Set<number>();
    const zones = zonesRaw.map((z) => parseZone(z, grid, seenCells));
    return {
      schemaVersion,
      id,
      type: parseMapType(obj.type),
      canvas,
      sphere,
      grid,
      theme: parseTheme(obj.theme),
      fieldsSchema,
      zones,
    };
  });
}

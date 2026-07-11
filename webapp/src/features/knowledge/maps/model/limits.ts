/** Hard limits & validation codes (maps spec §5). */

export const MapLimits = {
  pointerMaxBytes: 64 * 1024,
  manifestMaxBytes: 256 * 1024,
  documentMaxBytes: 2 * 1024 * 1024,
  maxMaps: 60,
  maxZonesPerMap: 500,
  maxZonesPerGridMap: 2600,
  maxVerticesPerZone: 5000,
  maxFieldsSchema: 25,
  maxOptionsPerField: 20,
  minGridCols: 2,
  maxGridCols: 72,
  minGridRows: 2,
  maxGridRows: 36,
  maxImageBytes: 8 * 1024 * 1024,
  maxImageDimension: 4096,
  maxIdLength: 64,
  maxTitleLength: 160,
  maxSubtitleLength: 240,
  maxTagLength: 40,
  maxTags: 32,
  maxZoneNameLength: 160,
  maxFieldKeyLength: 64,
  maxFieldLabelLength: 120,
  maxOptionLength: 60,
  maxUnitLength: 24,
  maxStyleLength: 32,
  maxPathLength: 256,
  maxSha256Length: 64,
  maxVersionStringLength: 40,
  maxCdnBaseLength: 512,
  maxTextureAssetLength: 64,
} as const;

export const RENDERED_IMAGE_KINDS = new Set(['background', 'background_hd', 'texture']);

/** Content note import cap (§8.2 / §16.3). */
export const MAX_PIN_NOTE_LENGTH = 20_000;

/** Highest map document schema version this build can open (§6.1). */
export const SUPPORTED_MAP_SCHEMA_VERSION = 2;

export type MapValidationCode =
  | 'tooLarge'
  | 'malformedStructure'
  | 'tooManyMaps'
  | 'tooManyZones'
  | 'tooManyVertices'
  | 'tooManyFields'
  | 'tooManyOptions'
  | 'stringTooLong'
  | 'imageTooLarge'
  | 'imageDimensionsTooLarge'
  | 'imageDimensionsMissing'
  | 'invalidBounds';

export interface MapParseOk<T> {
  readonly ok: true;
  readonly value: T;
}
export interface MapParseError {
  readonly ok: false;
  readonly code: MapValidationCode;
  readonly message: string;
}
export type MapParseResult<T> = MapParseOk<T> | MapParseError;

export function parseOk<T>(value: T): MapParseOk<T> {
  return { ok: true, value };
}
export function parseError(code: MapValidationCode, message: string): MapParseError {
  return { ok: false, code, message };
}

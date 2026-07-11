/**
 * Domain types for parsed map content (maps spec §6). Closed enums parse
 * tolerantly — an unrecognized wire value maps to `'unknown'` instead of
 * throwing (§6.1), so content authored against a future schema still parses.
 */

import type { GeoPoint } from './geo';
import type { MapTheme, ZoneThemeOverride } from './theme';

export type MapType = 'flat' | 'sphere' | 'unknown';
export type MapIcon = 'map' | 'dungeon' | 'station' | 'sphere' | 'sector' | 'unknown';
export type ZoneFieldType =
  | 'text'
  | 'longText'
  | 'number'
  | 'enum'
  | 'stringList'
  | 'link'
  | 'unknown';

export function parseMapType(v: unknown): MapType {
  return v === 'flat' || v === 'sphere' ? v : 'unknown';
}

export function parseMapIcon(v: unknown): MapIcon {
  return v === 'map' || v === 'dungeon' || v === 'station' || v === 'sphere' || v === 'sector'
    ? v
    : 'unknown';
}

export function parseZoneFieldType(v: unknown): ZoneFieldType {
  return v === 'text' ||
    v === 'longText' ||
    v === 'number' ||
    v === 'enum' ||
    v === 'stringList' ||
    v === 'link'
    ? v
    : 'unknown';
}

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

// --- Geometry (sealed; keyed by "kind") -------------------------------------

export interface PolygonGeometry {
  readonly kind: 'polygon';
  readonly rings: readonly (readonly CanvasPoint[])[];
}
export interface MarkerGeometry {
  readonly kind: 'marker';
  readonly at: CanvasPoint;
  readonly hitRadius: number;
}
export interface SphericalPolygonGeometry {
  readonly kind: 'sphericalPolygon';
  readonly rings: readonly (readonly GeoPoint[])[];
}
export interface SphericalCapGeometry {
  readonly kind: 'sphericalCap';
  readonly center: GeoPoint;
  readonly radiusDeg: number;
}
export interface UnknownGeometry {
  readonly kind: 'unknown';
}
export type ZoneGeometry =
  | PolygonGeometry
  | MarkerGeometry
  | SphericalPolygonGeometry
  | SphericalCapGeometry
  | UnknownGeometry;

export function vertexCount(g: ZoneGeometry): number {
  switch (g.kind) {
    case 'polygon':
    case 'sphericalPolygon':
      return g.rings.reduce((sum, r) => sum + r.length, 0);
    case 'marker':
    case 'sphericalCap':
      return 1;
    case 'unknown':
      return 0;
  }
}

// --- Document -----------------------------------------------------------------

export interface ZoneFieldSpec {
  readonly key: string;
  readonly label: string;
  readonly type: ZoneFieldType;
  readonly options: readonly string[] | null;
  readonly unit: string | null;
  readonly style: string | null;
  readonly searchable: boolean;
  /** RULE: only honoured when type == 'enum' (forced false otherwise). */
  readonly filterable: boolean;
}

export interface MapZone {
  readonly id: string;
  readonly name: string;
  /** May be UnknownGeometry, or null in a grid doc with a usable gridPos. */
  readonly geometry: ZoneGeometry | null;
  readonly gridPos: { readonly col: number; readonly row: number } | null;
  readonly cellNum: number | null;
  readonly labelAnchor: CanvasPoint | null;
  readonly themeOverride: ZoneThemeOverride | null;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface SphereConfig {
  readonly textureAsset: string;
  readonly initialOrientation: { readonly lat: number; readonly lon: number };
  readonly autoRotateDegPerSec: number;
}

export interface MapDocument {
  readonly schemaVersion: number;
  readonly id: string;
  readonly type: MapType;
  readonly canvas: CanvasSize | null;
  readonly sphere: SphereConfig | null;
  readonly grid: { readonly cols: number; readonly rows: number } | null;
  /** Parsed but NOT sanitized; the render layer sanitizes. */
  readonly theme: MapTheme;
  readonly fieldsSchema: readonly ZoneFieldSpec[];
  readonly zones: readonly MapZone[];
}

// --- Pointer & manifest -------------------------------------------------------

export interface MapFileRef {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly kind: string | null;
  readonly pixelSize: readonly [number, number] | null;
}

export interface MapPointer {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly tag: string;
  readonly minAppVersion: string;
  readonly manifest: MapFileRef;
}

export interface MapDescriptor {
  readonly id: string;
  readonly type: MapType;
  readonly title: string;
  readonly subtitle: string | null;
  readonly icon: MapIcon;
  readonly order: number;
  readonly version: number;
  readonly draft: boolean;
  readonly tags: readonly string[];
  readonly document: MapFileRef;
  readonly assets: readonly MapFileRef[];
}

export interface ChangelogEntry {
  readonly version: string | null;
  readonly notes: string;
}

export interface MapsManifest {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly minAppVersion: string;
  readonly cdnBase: string;
  readonly maps: readonly MapDescriptor[];
  readonly changelog: readonly ChangelogEntry[];
}

/**
 * Geographic point (degrees) ⇄ unit-sphere world vector and the uniform
 * lon/lat grid math (maps spec §14.1, §6.7).
 *
 * World space is right-handed: +z is the north pole; +x pierces (lon 0, lat 0).
 */

import { vec3, type Vec3 } from './quaternion';

export interface GeoPoint {
  readonly lon: number;
  readonly lat: number;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function geoPoint(lon: number, lat: number): GeoPoint {
  return { lon, lat };
}

/** worldVec(g) = (cos lat cos lon, cos lat sin lon, sin lat). */
export function worldVec(g: GeoPoint): Vec3 {
  const lat = g.lat * DEG;
  const lon = g.lon * DEG;
  const cl = Math.cos(lat);
  return vec3(cl * Math.cos(lon), cl * Math.sin(lon), Math.sin(lat));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Inverse of worldVec; the vector is normalized first. */
export function geoFromVec(v: Vec3): GeoPoint {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-12) return { lon: 0, lat: 0 };
  const x = v.x / len;
  const y = v.y / len;
  const z = v.z / len;
  const lat = Math.asin(clamp(z, -1, 1)) * RAD;
  const lon = Math.atan2(y, x) * RAD;
  return { lon, lat };
}

/** Angular separation between two geo points, in degrees (great-circle). */
export function angularDistanceDeg(a: GeoPoint, b: GeoPoint): number {
  const va = worldVec(a);
  const vb = worldVec(b);
  const d = clamp(va.x * vb.x + va.y * vb.y + va.z * vb.z, -1, 1);
  return Math.acos(d) * RAD;
}

// --- Uniform lon/lat grid (§6.7) --------------------------------------------

export const GRID_POLE_CLAMP_LAT = 89.5;

export interface MapGrid {
  readonly cols: number;
  readonly rows: number;
}

export interface CellBounds {
  readonly lonWest: number;
  readonly lonEast: number;
  readonly latNorth: number;
  readonly latSouth: number;
}

export function cellBounds(grid: MapGrid, col: number, row: number): CellBounds {
  const lonStep = 360 / grid.cols;
  const latStep = 180 / grid.rows;
  const lonWest = -180 + col * lonStep;
  const lonEast = lonWest + lonStep;
  const latNorth = clamp(90 - row * latStep, -GRID_POLE_CLAMP_LAT, GRID_POLE_CLAMP_LAT);
  const latSouth = clamp(90 - (row + 1) * latStep, -GRID_POLE_CLAMP_LAT, GRID_POLE_CLAMP_LAT);
  return { lonWest, lonEast, latNorth, latSouth };
}

export function cellCenter(grid: MapGrid, col: number, row: number): GeoPoint {
  const b = cellBounds(grid, col, row);
  return { lon: (b.lonWest + b.lonEast) / 2, lat: (b.latNorth + b.latSouth) / 2 };
}

/** O(1) analytic cell pick - never runs a polygon test (§14.7). */
export function gridCellAt(point: GeoPoint, grid: MapGrid): { col: number; row: number } {
  const col = clamp(Math.floor((point.lon + 180) / (360 / grid.cols)), 0, grid.cols - 1);
  const row = clamp(Math.floor((90 - point.lat) / (180 / grid.rows)), 0, grid.rows - 1);
  return { col, row };
}

/** [col,row] of non-negative integers (fractional/negative/wrong-shape → null). */
export function parseGridPos(raw: unknown): { col: number; row: number } | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const col = raw[0];
  const row = raw[1];
  if (typeof col !== 'number' || typeof row !== 'number') return null;
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
  if (col < 0 || row < 0) return null;
  return { col, row };
}

/**
 * Exact spherical-geometry algorithms (maps spec §14.7): great-circle ring
 * densification (slerp), even-odd spherical point-in-polygon, spherical caps,
 * and implicit grid-cell rings. All pure and unit-testable.
 */

import { geoFromVec, worldVec, type GeoPoint, type MapGrid, cellBounds } from './geo';
import { add, cross, dot, normalize, scale, vec3, type Vec3 } from './quaternion';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** slerp(a,b,t,ω) between two unit vectors; degenerate ω → a. */
function slerpVec(a: Vec3, b: Vec3, t: number, omega: number): Vec3 {
  const s = Math.sin(omega);
  if (s < 1e-9) return a;
  const wa = Math.sin((1 - t) * omega) / s;
  const wb = Math.sin(t * omega) / s;
  return normalize(add(scale(a, wa), scale(b, wb)));
}

/**
 * Defensive great-circle densification. Drops a trailing duplicate of the
 * first vertex (rings are implicitly closed; output is open) and inserts
 * slerped points on any edge wider than `maxSegmentDeg`.
 */
export function tessellateRing(ring: readonly GeoPoint[], maxSegmentDeg = 2.0): GeoPoint[] {
  if (ring.length === 0) return [];
  let pts = ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length > 1 && first.lon === last.lon && first.lat === last.lat) {
    pts = ring.slice(0, ring.length - 1);
  }
  const n = pts.length;
  if (n === 0) return [];
  const worlds = pts.map(worldVec);
  const out: GeoPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const av = worlds[i];
    const bv = worlds[(i + 1) % n];
    out.push(a);
    const omega = Math.acos(clamp(dot(av, bv), -1, 1));
    const omegaDeg = omega * RAD;
    if (omegaDeg > maxSegmentDeg && omega < Math.PI - 1e-9) {
      const steps = Math.max(1, Math.ceil(omegaDeg / maxSegmentDeg));
      for (let k = 1; k < steps; k++) {
        out.push(geoFromVec(slerpVec(av, bv, k / steps, omega)));
      }
    }
  }
  return out;
}

function wrap180(d: number): number {
  return d - 360 * Math.round(d / 360);
}

/**
 * Even-odd crossing test: cast the meridian arc from the point up to the north
 * pole and count edge crossings over all rings. Rings are densified first so
 * the linear per-edge test tracks the great-circle arc.
 */
export function pointInSphericalPolygon(
  point: GeoPoint,
  rings: readonly (readonly GeoPoint[])[],
): boolean {
  let crossings = 0;
  for (const raw of rings) {
    const ring = tessellateRing(raw);
    const m = ring.length;
    if (m < 3) continue;
    for (let i = 0; i < m; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % m];
      const lonB = a.lon + wrap180(b.lon - a.lon);
      const lonQ = a.lon + wrap180(point.lon - a.lon);
      if (a.lon > lonQ === lonB > lonQ) continue; // half-open span
      const t = (lonQ - a.lon) / (lonB - a.lon);
      const latCross = a.lat + t * (b.lat - a.lat);
      if (latCross > point.lat) crossings++;
    }
  }
  return (crossings & 1) === 1;
}

/** Angular-distance test for a spherical cap (inclusive, fp-tolerant). */
export function pointInSphericalCap(point: GeoPoint, center: GeoPoint, radiusDeg: number): boolean {
  const p = worldVec(point);
  const c = worldVec(center);
  const ang = Math.acos(clamp(dot(p, c), -1, 1));
  return ang <= radiusDeg * DEG + 1e-9;
}

const CAP_SEGMENTS = 48;

/** Boundary ring of a spherical cap, sampled at 48 segments (open ring). */
export function capRing(center: GeoPoint, radiusDeg: number, segments = CAP_SEGMENTS): GeoPoint[] {
  const c = worldVec(center);
  const zHat = vec3(0, 0, 1);
  let u = cross(c, zHat);
  if (u.x * u.x + u.y * u.y + u.z * u.z < 1e-12) u = cross(c, vec3(1, 0, 0));
  u = normalize(u);
  const v = normalize(cross(c, u));
  const r = radiusDeg * DEG;
  const cosR = Math.cos(r);
  const sinR = Math.sin(r);
  const out: GeoPoint[] = [];
  for (let k = 0; k < segments; k++) {
    const t = (2 * Math.PI * k) / segments;
    const p = add(
      scale(c, cosR),
      scale(add(scale(u, Math.cos(t)), scale(v, Math.sin(t))), sinR),
    );
    out.push(geoFromVec(p));
  }
  return out;
}

/**
 * Implicit quad boundary of a grid cell. The two constant-latitude edges are
 * small circles and must be sampled (not slerped); the meridian edges are
 * great circles (implicit). Open ring: south W→E then north E→W.
 */
export function gridCellRing(
  grid: MapGrid,
  col: number,
  row: number,
  maxLonStepDeg = 3.0,
): GeoPoint[] {
  const b = cellBounds(grid, col, row);
  const lonSpan = b.lonEast - b.lonWest;
  const n = Math.max(1, Math.ceil(lonSpan / maxLonStepDeg));
  const step = lonSpan / n;
  const out: GeoPoint[] = [];
  for (let i = 0; i <= n; i++) out.push({ lon: b.lonWest + i * step, lat: b.latSouth });
  for (let i = 0; i <= n; i++) out.push({ lon: b.lonEast - i * step, lat: b.latNorth });
  return out;
}

/** Normalized mean of a ring's world vectors — the spherical centroid. */
export function ringCentroid(ring: readonly GeoPoint[]): GeoPoint {
  let acc = vec3(0, 0, 0);
  for (const g of ring) acc = add(acc, worldVec(g));
  return geoFromVec(normalize(acc));
}

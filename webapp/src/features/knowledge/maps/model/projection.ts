/**
 * Orthographic globe projection & inverse picking (maps spec §14.2, §14.4).
 * The camera sits on the +z view axis looking at the origin, so `view.z >= 0`
 * is the near (front) hemisphere. Screen y grows down, so view-y is negated.
 */

import { geoFromVec, worldVec, type GeoPoint } from './geo';
import { quatInverse, rotate, vec3, type Quat } from './quaternion';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface Projected {
  readonly x: number;
  readonly y: number;
  /** true when the point is on the near (front) hemisphere. */
  readonly front: boolean;
}

export const GLOBE_FILL_FACTOR = 0.92;

/** kLimbPickLimit - fraction of R beyond which taps are rejected. */
export const LIMB_PICK_LIMIT = 0.95;

export function globeRadius(width: number, height: number, zoom: number): number {
  return (Math.min(width, height) / 2) * GLOBE_FILL_FACTOR * zoom;
}

export function globeCenter(width: number, height: number): ScreenPoint {
  return { x: width / 2, y: height / 2 };
}

/** project(g, q, radius, center) → screen point + front-hemisphere flag. */
export function project(
  g: GeoPoint,
  q: Quat,
  radius: number,
  center: ScreenPoint,
): Projected {
  const v = rotate(q, worldVec(g));
  return {
    x: center.x + radius * v.x,
    y: center.y - radius * v.y,
    front: v.z >= 0,
  };
}

/** Project an already-computed world vector (avoids re-deriving worldVec). */
export function projectVec(
  v: { x: number; y: number; z: number },
  q: Quat,
  radius: number,
  center: ScreenPoint,
): Projected {
  const r = rotate(q, v);
  return {
    x: center.x + radius * r.x,
    y: center.y - radius * r.y,
    front: r.z >= 0,
  };
}

/**
 * unproject(tap, q, radius, center) → GeoPoint | null. Taps outside the
 * 0.95·R limb are rejected (the limb is numerically ill-conditioned).
 */
export function unproject(
  tap: ScreenPoint,
  q: Quat,
  radius: number,
  center: ScreenPoint,
): GeoPoint | null {
  if (radius <= 0) return null;
  const x = (tap.x - center.x) / radius;
  const y = (center.y - tap.y) / radius; // screen-down → view-up
  const r2 = x * x + y * y;
  if (r2 > LIMB_PICK_LIMIT * LIMB_PICK_LIMIT) return null;
  const z = Math.sqrt(Math.max(0, 1 - r2)); // near hemisphere
  const world = rotate(quatInverse(q), vec3(x, y, z));
  return geoFromVec(world);
}

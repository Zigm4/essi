/**
 * Globe orientation construction & gesture increments (maps spec §14.3).
 * An orientation is a unit quaternion mapping world → view (`view = rotate(q, world)`).
 *
 * Behaviours reproduced (standard `q·v·q⁻¹` convention):
 *  - fromLatLon centres (lon,lat) on screen with north up;
 *  - dragBy makes the surface follow the finger (Google-Earth style);
 *  - autoRotate spins about the globe's own polar (world-z) axis.
 */

import { worldVec, type GeoPoint } from './geo';
import {
  axisAngle,
  cross,
  normalize,
  quatFromRotationRows,
  quatMul,
  quatNormalize,
  scale,
  sub,
  vec3,
  type Quat,
  type Vec3,
} from './quaternion';

const DEG = Math.PI / 180;

const VIEW_RIGHT: Vec3 = { x: 1, y: 0, z: 0 };
const VIEW_UP: Vec3 = { x: 0, y: 1, z: 0 };
const VIEW_Z: Vec3 = { x: 0, y: 0, z: 1 };
const WORLD_Z: Vec3 = { x: 0, y: 0, z: 1 };

/** Centre (lon,lat) on screen with north up; optional screen-space roll. */
export function orientationFromLatLon(g: GeoPoint, rollDeg = 0): Quat {
  const z = worldVec(g); // toward camera (screen centre)
  let up = sub(WORLD_Z, scale(z, z.z)); // world-north projected ⟂ z
  if (up.x * up.x + up.y * up.y + up.z * up.z < 1e-12) {
    // Centred on a pole - stable fallback.
    const lonRad = g.lon * DEG;
    up = vec3(-Math.cos(lonRad), -Math.sin(lonRad), 0);
  }
  up = normalize(up);
  const x = normalize(cross(up, z)); // screen-right = up × forward
  let q = quatFromRotationRows(x, up, z);
  if (rollDeg !== 0) {
    q = quatNormalize(quatMul(axisAngle(VIEW_Z, rollDeg * DEG), q));
  }
  return q;
}

/**
 * Content follows the finger: horizontal drag rotates about view-up, vertical
 * drag about view-right, both applied AFTER the current orientation.
 */
export function dragBy(q: Quat, dxPixels: number, dyPixels: number, radius: number): Quat {
  if (radius <= 0) return q;
  const theta = dxPixels / radius; // about view-up
  const phi = dyPixels / radius; // about view-right
  const delta = quatMul(axisAngle(VIEW_RIGHT, phi), axisAngle(VIEW_UP, theta));
  return quatNormalize(quatMul(delta, q));
}

/** Decorative spin about the globe's own polar (world-z) axis. */
export function autoRotate(q: Quat, deltaDeg: number): Quat {
  if (deltaDeg === 0) return q;
  return quatNormalize(quatMul(q, axisAngle(WORLD_Z, deltaDeg * DEG)));
}

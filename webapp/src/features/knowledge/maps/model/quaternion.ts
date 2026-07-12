/**
 * Pure quaternion + 3-vector math for the globe renderer (maps spec §14.1-14.3).
 *
 * Convention: a unit quaternion `q` rotates a vector by the STANDARD
 * `v' = q · v · q⁻¹` map, i.e. `rotate(axisAngle(axis, θ), v)` turns `v` by
 * `+θ` about `axis` (right-hand rule). The spec's math is written for the
 * Flutter `vector_math` library, whose `Quaternion.rotated` applies the
 * CONJUGATE rotation; we reproduce the *observable behaviours* it lists
 * (§14.3) under the standard convention rather than mirroring its sign quirks.
 *
 * Composition: `rotate(mul(a, b), v) === rotate(a, rotate(b, v))` - the RIGHT
 * operand runs first (standard Hamilton order).
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

/** Normalize; a zero vector is returned unchanged (callers guard degeneracy). */
export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len < 1e-12) return a;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

export const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

export function quatNormalize(q: Quat): Quat {
  const n = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (n < 1e-12) return IDENTITY_QUAT;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

/** Conjugate; for a unit quaternion this is the inverse rotation. */
export function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function quatInverse(q: Quat): Quat {
  return quatConjugate(quatNormalize(q));
}

/** Hamilton product a·b (right operand applied first when rotating). */
export function quatMul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** Unit quaternion for a `+angle` (radians) rotation about `axis` (RH rule). */
export function axisAngle(axis: Vec3, angleRad: number): Quat {
  const a = normalize(axis);
  const half = angleRad / 2;
  const s = Math.sin(half);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(half) };
}

/** Rotate `v` by unit quaternion `q` (v' = q·v·q⁻¹). */
export function rotate(q: Quat, v: Vec3): Vec3 {
  // t = 2·(q_xyz × v); v' = v + q_w·t + q_xyz × t
  const qx = q.x;
  const qy = q.y;
  const qz = q.z;
  const tx = 2 * (qy * v.z - qz * v.y);
  const ty = 2 * (qz * v.x - qx * v.z);
  const tz = 2 * (qx * v.y - qy * v.x);
  return {
    x: v.x + q.w * tx + (qy * tz - qz * ty),
    y: v.y + q.w * ty + (qz * tx - qx * tz),
    z: v.z + q.w * tz + (qx * ty - qy * tx),
  };
}

/**
 * Build the unit quaternion for a proper rotation matrix supplied as ROWS
 * `[rowX, rowY, rowZ]`, such that `rotate(q, v) === m · v`. Shepperd's method.
 */
export function quatFromRotationRows(rowX: Vec3, rowY: Vec3, rowZ: Vec3): Quat {
  const m00 = rowX.x;
  const m01 = rowX.y;
  const m02 = rowX.z;
  const m10 = rowY.x;
  const m11 = rowY.y;
  const m12 = rowY.z;
  const m20 = rowZ.x;
  const m21 = rowZ.y;
  const m22 = rowZ.z;
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    q = {
      w: 0.25 / s,
      x: (m21 - m12) * s,
      y: (m02 - m20) * s,
      z: (m10 - m01) * s,
    };
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = {
      w: (m21 - m12) / s,
      x: 0.25 * s,
      y: (m01 + m10) / s,
      z: (m02 + m20) / s,
    };
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = {
      w: (m02 - m20) / s,
      x: (m01 + m10) / s,
      y: 0.25 * s,
      z: (m12 + m21) / s,
    };
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = {
      w: (m10 - m01) / s,
      x: (m02 + m20) / s,
      y: (m12 + m21) / s,
      z: 0.25 * s,
    };
  }
  return quatNormalize(q);
}

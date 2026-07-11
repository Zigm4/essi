/**
 * The core game-grid conversions (tools-live spec §4.8 and §6.6).
 *
 * Heliocentric (X, Y) in kilometres → a sector 1..12 and a distance in "SL"
 * (1 SL = 3,000,000 miles, a game convention from the East-Shire Utilities
 * bot). Z is ignored for sector/distance: the game map is 2D in the ecliptic.
 */

const MILES_PER_KM = 0.621371;
const MILES_PER_SL = 3_000_000;
const TWO_PI = Math.PI * 2;
/** IAU 2012 astronomical unit, exact (km). */
const KM_PER_AU = 149_597_870.7;
const AU_PER_KM = 1 / KM_PER_AU;

/**
 * Sector 1..12, counter-clockwise from the +X axis. The `+12 % 12` guards the
 * θ==2π floating-point boundary case.
 */
export function computeSector(x: number, y: number): number {
  let theta = Math.atan2(y, x);
  if (theta < 0) theta += TWO_PI;
  const raw = Math.floor((theta * 12) / TWO_PI);
  return (((raw + 12) % 12) + 1);
}

/** Whole-SL distance used by System Scan (floored). */
export function computeDistanceSL(x: number, y: number): number {
  const distanceKm = Math.sqrt(x * x + y * y);
  const distanceMiles = distanceKm * MILES_PER_KM;
  return Math.floor(distanceMiles / MILES_PER_SL);
}

export interface ScanMetrics {
  sector: number;
  distanceSL: number;
}

export function computeScanMetrics(x: number, y: number): ScanMetrics {
  return { sector: computeSector(x, y), distanceSL: computeDistanceSL(x, y) };
}

export interface TrackerMetrics {
  xAU: number;
  yAU: number;
  zAU: number;
  sector: number;
  distanceAU: number;
  slExact: number;
  slRounded: number;
  slFloor: number;
}

/**
 * Full Tracker conversion (spec §6.6): AU vector (Z preserved for display),
 * sector from raw km, and the three SL flavours (exact / rounded-3dp / floored).
 */
export function computeTrackerMetrics(x: number, y: number, z: number): TrackerMetrics {
  const xAU = x * AU_PER_KM;
  const yAU = y * AU_PER_KM;
  const zAU = z * AU_PER_KM;
  const distanceAU = Math.sqrt(xAU * xAU + yAU * yAU);
  const distanceMiles = (distanceAU / AU_PER_KM) * MILES_PER_KM;
  const slExact = distanceMiles / MILES_PER_SL;
  const slRounded = Math.round(slExact * 1000) / 1000;
  const slFloor = Math.floor(slExact);
  return {
    xAU,
    yAU,
    zAU,
    sector: computeSector(x, y),
    distanceAU,
    slExact,
    slRounded,
    slFloor,
  };
}

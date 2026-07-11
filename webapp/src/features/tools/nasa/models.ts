import type { ObjectKind } from './sbdb';

/**
 * Result domain models + payload (de)serializers for the three tools.
 * History payload schemas: Scan §4.10, Tracker §6.7, Discoveries §5.8.
 */

export interface NextSectorChange {
  date: Date;
  toSector: number;
}

/** A single planet's live position (System Scan). */
export interface PlanetPosition {
  name: string;
  emoji: string;
  sector: number;
  distanceSL: number;
  timestamp: Date;
  nextChange?: NextSectorChange;
}

export type ScanMode = 'light' | 'full';

export function planetPositionToJson(p: PlanetPosition): Record<string, unknown> {
  const json: Record<string, unknown> = {
    name: p.name,
    emoji: p.emoji,
    sector: p.sector,
    distanceSL: p.distanceSL,
    timestamp: p.timestamp.toISOString(),
  };
  if (p.nextChange !== undefined) {
    json.nextChange = {
      date: p.nextChange.date.toISOString(),
      toSector: p.nextChange.toSector,
    };
  }
  return json;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function planetPositionFromJson(json: unknown): PlanetPosition {
  if (typeof json !== 'object' || json === null) throw new Error('bad snapshot');
  const o = json as Record<string, unknown>;
  const position: PlanetPosition = {
    name: typeof o.name === 'string' ? o.name : '',
    emoji: typeof o.emoji === 'string' ? o.emoji : '',
    sector: num(o.sector),
    distanceSL: num(o.distanceSL),
    timestamp: new Date(typeof o.timestamp === 'string' ? o.timestamp : NaN),
  };
  const nc = o.nextChange;
  if (typeof nc === 'object' && nc !== null) {
    const ncr = nc as Record<string, unknown>;
    if (typeof ncr.date === 'string') {
      position.nextChange = { date: new Date(ncr.date), toSector: num(ncr.toSector) };
    }
  }
  return position;
}

/** A single body's live track (Object Tracker). */
export interface TrackerResult {
  mpcID: string;
  displayName: string;
  kind: ObjectKind;
  xAU: number;
  yAU: number;
  zAU: number;
  sector: number;
  distanceAU: number;
  slExact: number;
  slRounded: number;
  slFloor: number;
  timestamp: Date;
}

export function trackerResultToJson(r: TrackerResult): Record<string, unknown> {
  return {
    mpcID: r.mpcID,
    displayName: r.displayName,
    kind: r.kind,
    xAU: r.xAU,
    yAU: r.yAU,
    zAU: r.zAU,
    sector: r.sector,
    distanceAU: r.distanceAU,
    slExact: r.slExact,
    slRounded: r.slRounded,
    slFloor: r.slFloor,
    timestamp: r.timestamp.toISOString(),
  };
}

export function trackerResultFromJson(json: unknown): TrackerResult {
  if (typeof json !== 'object' || json === null) throw new Error('bad track');
  const o = json as Record<string, unknown>;
  return {
    mpcID: typeof o.mpcID === 'string' ? o.mpcID : '',
    displayName: typeof o.displayName === 'string' ? o.displayName : '',
    kind: o.kind === 'comet' ? 'comet' : 'asteroid',
    xAU: num(o.xAU),
    yAU: num(o.yAU),
    zAU: num(o.zAU),
    sector: num(o.sector),
    distanceAU: num(o.distanceAU),
    slExact: num(o.slExact),
    slRounded: num(o.slRounded),
    slFloor: num(o.slFloor),
    timestamp: new Date(typeof o.timestamp === 'string' ? o.timestamp : NaN),
  };
}

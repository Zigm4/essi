/**
 * Share content for the three NASA tools: the Discord message, the PNG card
 * (layout from tools-live spec §7, ESSI-branded) and the link.
 *
 * Links: Tracker and System Scan positions change every day, so their link
 * carries a snapshot of the shared values (`?snap=`, base64url JSON) and the
 * tool shows it as "shared, as of …" with a Refresh button. Discoveries
 * searches a past date window, so its link carries the query
 * (`?kind=&from=&to=`) and re-runs it; `&focus=` opens one object's detail.
 */

import type { CardBlock, CardSpec } from '../shared/shareCard';
import { appLink, discordLink, DISCORD_MAX, type ShareContent } from '../shared/shareActions';
import { ymdLocal } from './discoveriesClient';
import type { PlanetPosition, ScanMode, TrackerResult } from './models';
import { PLANETS } from './planets';
import {
  computeStatus,
  displayNameOf,
  KIND_EMOJI,
  statusEmoji,
  statusLabel,
  trackingPeriodDays,
  type DiscoveredObject,
  type ObjectKind,
} from './sbdb';
import { dMonthYear, dMonthYearHm, scanShareDateTime } from './ui/format';

const SITE = 'zigm4.github.io/essi';

// --- Snapshot encoding (base64url JSON, URL-safe and compact) ----------------

export function encodeSnapshot(data: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSnapshot(param: string): unknown {
  try {
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function capDiscord(lines: string[], tail: string[]): string {
  // Keep the tail (link) and drop body lines until it fits Discord's limit.
  const body = [...lines];
  const join = () => [...body, ...tail].join('\n');
  while (join().length > DISCORD_MAX && body.length > 1) body.pop();
  return join();
}

// --- Tracker -----------------------------------------------------------------

interface TrackerSnap {
  v: 1;
  n: string;
  k: 'a' | 'c';
  m: string;
  t: number;
  s: number;
  sl: number;
  slf: number;
  au: number;
  x: number;
  y: number;
  z: number;
}

export function trackerSnapshotParam(r: TrackerResult): string {
  const snap: TrackerSnap = {
    v: 1,
    n: r.displayName,
    k: r.kind === 'comet' ? 'c' : 'a',
    m: r.mpcID,
    t: r.timestamp.getTime(),
    s: r.sector,
    sl: round(r.slExact, 4),
    slf: r.slFloor,
    au: round(r.distanceAU, 5),
    x: round(r.xAU, 5),
    y: round(r.yAU, 5),
    z: round(r.zAU, 5),
  };
  return encodeSnapshot(snap);
}

/** The shared track, or null when the snapshot is missing or malformed. */
export function trackerFromSnapshot(param: string | null): TrackerResult | null {
  if (param === null || param.length === 0) return null;
  const o = decodeSnapshot(param) as Partial<TrackerSnap> | null;
  if (o === null || typeof o !== 'object' || o.v !== 1) return null;
  if (typeof o.n !== 'string' || typeof o.m !== 'string' || (o.k !== 'a' && o.k !== 'c')) return null;
  const nums = [o.t, o.s, o.sl, o.slf, o.au, o.x, o.y, o.z];
  if (!nums.every(finite)) return null;
  const sector = o.s as number;
  if (!Number.isInteger(sector) || sector < 1 || sector > 12) return null;
  const slExact = o.sl as number;
  return {
    displayName: o.n.slice(0, 120),
    kind: o.k === 'c' ? 'comet' : 'asteroid',
    mpcID: o.m.slice(0, 60),
    timestamp: new Date(o.t as number),
    sector,
    slExact,
    slRounded: round(slExact, 3),
    slFloor: o.slf as number,
    distanceAU: o.au as number,
    xAU: o.x as number,
    yAU: o.y as number,
    zAU: o.z as number,
  };
}

export function trackerShare(r: TrackerResult): ShareContent {
  const link = appLink(`/tools/tracker?snap=${trackerSnapshotParam(r)}`);
  const emoji = KIND_EMOJI[r.kind];
  const discordText = capDiscord(
    [
      `🛰️ **ESSI Tracker** · ${emoji} **${r.displayName}** (MPC ${r.mpcID})`,
      `**Sector ${r.sector}** · ${r.slRounded.toFixed(3)} SL · ${r.distanceAU.toFixed(3)} AU`,
      `X ${r.xAU.toFixed(3)} · Y ${r.yAU.toFixed(3)} · Z ${r.zAU.toFixed(3)} AU`,
      `📅 Position on ${dMonthYearHm(r.timestamp)}`,
    ],
    [discordLink(link)],
  );
  const blocks: CardBlock[] = [
    { kind: 'hero', emoji, title: r.displayName, caption: `MPC ${r.mpcID}` },
    { kind: 'space', height: 8 },
    { kind: 'kv', label: 'Sector', value: String(r.sector), valueColor: '#4FC3FF', large: true },
    { kind: 'kv', label: 'Distance', value: `${r.slRounded.toFixed(3)} SL`, valueColor: '#7AE3FF' },
    { kind: 'kv', label: 'AU', value: r.distanceAU.toFixed(3) },
    { kind: 'kv', label: 'X (AU)', value: r.xAU.toFixed(3) },
    { kind: 'kv', label: 'Y (AU)', value: r.yAU.toFixed(3) },
    { kind: 'kv', label: 'Z (AU)', value: r.zAU.toFixed(3) },
    { kind: 'space', height: 6 },
    { kind: 'divider' },
  ];
  const card: CardSpec = {
    title: 'ESSI · Tracker',
    subtitle: dMonthYearHm(r.timestamp),
    blocks,
    footer: `ESSI · real-time tracking · ${SITE}`,
  };
  return { title: 'ESSI tracker', discordText, link, card, fileName: `essi-track-${r.timestamp.getTime()}.png` };
}

// --- System Scan -------------------------------------------------------------

/** [planet index, sector, distance SL, next change epoch ms?, next sector?] */
type ScanSnapPlanet = [number, number, number] | [number, number, number, number, number];

interface ScanSnap {
  v: 1;
  t: number;
  md: 'l' | 'f';
  p: ScanSnapPlanet[];
}

export interface SharedScan {
  date: Date;
  mode: ScanMode;
  snapshots: PlanetPosition[];
}

export function scanSnapshotParam(date: Date, mode: ScanMode, snapshots: readonly PlanetPosition[]): string {
  const p: ScanSnapPlanet[] = [];
  for (const s of snapshots) {
    const index = PLANETS.findIndex((spec) => spec.name === s.name);
    if (index < 0) continue;
    p.push(
      s.nextChange === undefined
        ? [index, s.sector, round(s.distanceSL, 3)]
        : [index, s.sector, round(s.distanceSL, 3), s.nextChange.date.getTime(), s.nextChange.toSector],
    );
  }
  const snap: ScanSnap = { v: 1, t: date.getTime(), md: mode === 'full' ? 'f' : 'l', p };
  return encodeSnapshot(snap);
}

export function scanFromSnapshot(param: string | null): SharedScan | null {
  if (param === null || param.length === 0) return null;
  const o = decodeSnapshot(param) as Partial<ScanSnap> | null;
  if (o === null || typeof o !== 'object' || o.v !== 1 || !finite(o.t) || !Array.isArray(o.p)) return null;
  const date = new Date(o.t);
  const snapshots: PlanetPosition[] = [];
  for (const row of o.p) {
    if (!Array.isArray(row) || row.length < 3 || !row.every(finite)) continue;
    const spec = PLANETS[row[0] as number];
    const sector = row[1] as number;
    if (spec === undefined || !Number.isInteger(sector) || sector < 1 || sector > 12) continue;
    const position: PlanetPosition = {
      name: spec.name,
      emoji: spec.emoji,
      sector,
      distanceSL: row[2] as number,
      timestamp: date,
    };
    if (row.length >= 5) position.nextChange = { date: new Date(row[3] as number), toSector: row[4] as number };
    snapshots.push(position);
  }
  if (snapshots.length === 0) return null;
  return { date, mode: o.md === 'f' ? 'full' : 'light', snapshots };
}

function nextChangeText(p: PlanetPosition): string | null {
  if (p.nextChange === undefined) return null;
  return `→ sector ${p.nextChange.toSector} on ${dMonthYear(p.nextChange.date)}`;
}

export function scanShare(date: Date, mode: ScanMode, snapshots: readonly PlanetPosition[]): ShareContent {
  const link = appLink(`/tools/scan?snap=${scanSnapshotParam(date, mode, snapshots)}`);
  const lines = [`🪐 **ESSI System Scan** · ${scanShareDateTime(date)} · ${mode.toUpperCase()}`];
  for (const p of snapshots) {
    const next = nextChangeText(p);
    lines.push(`${p.emoji} **${p.name}** · Sector ${p.sector} · ${p.distanceSL} SL${next === null ? '' : ` · ${next}`}`);
  }
  const blocks: CardBlock[] = [];
  snapshots.forEach((p, i) => {
    const spec = PLANETS.find((s) => s.name === p.name) ?? PLANETS[0]!;
    if (i > 0) blocks.push({ kind: 'divider', alpha: 0.25 });
    blocks.push({
      kind: 'planet',
      name: p.name,
      glyph: { light: spec.glyph.light, dark: spec.glyph.dark, hasRing: spec.hasRing },
      line: nextChangeText(p) ?? dMonthYearHm(p.timestamp),
      lineColor: p.nextChange === undefined ? '#6E8AAB' : '#FFB347',
      sector: p.sector,
      sl: `${p.distanceSL} SL`,
    });
  });
  blocks.push({ kind: 'space', height: 6 }, { kind: 'divider' });
  const card: CardSpec = {
    title: 'ESSI · System scan',
    subtitle: scanShareDateTime(date),
    pill: mode.toUpperCase(),
    blocks,
    footer: `ESSI · deep space monitoring · ${SITE}`,
  };
  return {
    title: 'ESSI system scan',
    discordText: capDiscord(lines, [discordLink(link)]),
    link,
    card,
    fileName: `essi-scan-${date.getTime()}.png`,
  };
}

// --- Discoveries -------------------------------------------------------------

export interface DiscoveriesQuery {
  kind: ObjectKind;
  start: Date;
  end: Date;
}

function parseYmd(value: string | null): Date | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export function discoveriesRoute(q: DiscoveriesQuery, focus?: string): string {
  const params = new URLSearchParams({ kind: q.kind, from: ymdLocal(q.start), to: ymdLocal(q.end) });
  if (focus !== undefined) params.set('focus', focus);
  return `/tools/discoveries?${params.toString()}`;
}

/** The query in a Discoveries link, or null when absent / invalid. */
export function parseDiscoveriesParams(
  search: URLSearchParams,
): (DiscoveriesQuery & { focus: string | null }) | null {
  const kind = search.get('kind');
  const start = parseYmd(search.get('from'));
  const end = parseYmd(search.get('to'));
  if ((kind !== 'comet' && kind !== 'asteroid') || start === null || end === null) return null;
  if (start.getTime() > end.getTime() || start.getFullYear() < 1800) return null;
  return { kind, start, end, focus: search.get('focus') };
}

function kindPlural(kind: ObjectKind): string {
  return kind === 'comet' ? 'Comets' : 'Asteroids';
}

const LIST_CARD_MAX = 30;
const LIST_DISCORD_MAX = 15;

export function discoveriesListShare(
  q: DiscoveriesQuery,
  objects: readonly DiscoveredObject[],
  truncated: boolean,
): ShareContent {
  const link = appLink(discoveriesRoute(q));
  const range = `${dMonthYear(q.start)} → ${dMonthYear(q.end)}`;
  const count = `${objects.length}${truncated ? '+' : ''} found`;
  const lines = [`${KIND_EMOJI[q.kind]} **ESSI Discoveries** · ${kindPlural(q.kind)} · ${range} · ${count}`];
  for (const o of objects.slice(0, LIST_DISCORD_MAX)) {
    lines.push(`${statusEmoji(computeStatus(o))} ${displayNameOf(o)} · first obs ${o.firstObs ?? '?'}`);
  }
  const hidden = objects.length - Math.min(objects.length, LIST_DISCORD_MAX);
  const more = hidden > 0 ? [`…and ${hidden} more`] : [];

  const blocks: CardBlock[] = [];
  if (objects.length === 0) blocks.push({ kind: 'caption', text: 'No matches in this window.' });
  for (const o of objects.slice(0, LIST_CARD_MAX)) {
    blocks.push({
      kind: 'listRow',
      emoji: statusEmoji(computeStatus(o)),
      text: displayNameOf(o),
      trailing: o.firstObs ?? '?',
    });
  }
  if (objects.length > LIST_CARD_MAX) {
    blocks.push({ kind: 'caption', text: `+${objects.length - LIST_CARD_MAX} more` });
  }
  blocks.push({ kind: 'space', height: 6 }, { kind: 'divider' });
  const card: CardSpec = {
    title: 'ESSI · Discoveries',
    subtitle: range,
    pill: kindPlural(q.kind).toUpperCase(),
    blocks,
    footer: `ESSI · deep space discovery · ${SITE}`,
  };
  return {
    title: 'ESSI discoveries',
    discordText: capDiscord([...lines, ...more], [discordLink(link)]),
    link,
    card,
    fileName: `essi-discoveries-${q.start.getTime()}-${q.end.getTime()}.png`,
  };
}

function objectFacts(o: DiscoveredObject): [string, string][] {
  const facts: [string, string][] = [
    ['Kind', o.kind === 'comet' ? 'Comet' : 'Asteroid'],
    ['Designation', o.designation],
  ];
  if (o.firstObs !== undefined) facts.push(['First obs.', o.firstObs]);
  if (o.lastObs !== undefined) facts.push(['Last obs.', o.lastObs]);
  const days = trackingPeriodDays(o);
  if (days !== null) facts.push(['Tracking', `${days} ${days === 1 ? 'day' : 'days'}`]);
  if (o.kind === 'asteroid') {
    if (o.diameterMeters !== undefined) facts.push(['Diameter', `${o.diameterMeters.toFixed(0)} m`]);
    if (o.albedo !== undefined) facts.push(['Albedo', o.albedo.toFixed(3)]);
    facts.push(['PHA flag', o.isHazardous ? 'Yes' : 'No']);
  }
  return facts;
}

export function discoveryObjectShare(o: DiscoveredObject, q: DiscoveriesQuery): ShareContent {
  const name = displayNameOf(o);
  const status = computeStatus(o);
  const link = appLink(discoveriesRoute(q, o.designation));
  const facts = objectFacts(o);
  const discordText = capDiscord(
    [
      `${KIND_EMOJI[o.kind]} **ESSI Discovery** · **${name}** (MPC ${o.designation})`,
      `${statusEmoji(status)} ${statusLabel(status)}`,
      facts
        .slice(2)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · '),
    ].filter((l) => l.length > 0),
    [discordLink(link)],
  );
  const card: CardSpec = {
    title: 'ESSI · Discovery',
    blocks: [
      { kind: 'hero', emoji: KIND_EMOJI[o.kind], title: name, caption: `MPC ${o.designation}` },
      { kind: 'divider' },
      { kind: 'status', emoji: statusEmoji(status), text: statusLabel(status), color: '#E8F4FF' },
      ...facts.map(([label, value]): CardBlock => ({ kind: 'kv', label, value })),
      { kind: 'space', height: 6 },
      { kind: 'divider' },
    ],
    footer: `ESSI · deep space discovery · ${SITE}`,
  };
  return {
    title: 'ESSI discovery',
    discordText,
    link,
    card,
    fileName: `essi-discovery-${o.designation.replace(/[^A-Za-z0-9]+/g, '-')}.png`,
  };
}

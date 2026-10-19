/**
 * Full-text zone search (maps spec §11). SQLite FTS5 is unavailable on web, so
 * this is an in-memory reimplementation that preserves the required semantics:
 * diacritic-insensitive tokenization, implicit AND across terms, a trailing
 * prefix match on the LAST term, relevance ordering and a default limit of 50.
 * Web addition: the zone number shown on the grid (`cellNum`) is searchable,
 * and a query naming a number (`35`, `#35`, `zone 35`) lists that zone first.
 */

import { SUPPORTED_MAP_SCHEMA_VERSION } from '../model/limits';
import type { MapDescriptor, MapDocument, MapIcon } from '../model/types';

export interface ZoneFtsRow {
  readonly zoneId: string;
  readonly mapId: string;
  readonly name: string;
  readonly fieldsText: string;
  /** The number painted on the grid and in the zone sheet, if any. */
  readonly cellNum: number | null;
}

function stringifyValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(stringifyValue).filter((s) => s.length > 0).join(' ');
  return ''; // null / object
}

/** One FTS row per zone; excluded docs (unknown type / future schema) → []. */
export function buildZoneFtsRows(doc: MapDocument): ZoneFtsRow[] {
  if (doc.type === 'unknown' || doc.schemaVersion > SUPPORTED_MAP_SCHEMA_VERSION) return [];
  const searchableKeys = doc.fieldsSchema
    .filter((f) => f.searchable && f.type !== 'unknown')
    .map((f) => f.key);
  return doc.zones.map((zone) => {
    const parts: string[] = [];
    for (const key of searchableKeys) {
      const s = stringifyValue(zone.fields[key]);
      if (s.length > 0) parts.push(s);
    }
    return {
      zoneId: zone.id,
      mapId: doc.id,
      name: zone.name,
      fieldsText: parts.join(' '),
      cellNum: zone.cellNum,
    };
  });
}

// --- FTS MATCH expression (kept for parity + tests, §11.2) -------------------

/** Builds the FTS5 MATCH expression; blank/operator-only input → null. */
export function ftsMatchExpression(input: string): string | null {
  const terms = input.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return null;
  const quoted = terms.map((t) => `"${t.replace(/"/g, '""')}"`);
  quoted[quoted.length - 1] = `${quoted[quoted.length - 1]}*`;
  return quoted.join(' ');
}

// --- In-memory index --------------------------------------------------------

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

/** `35`, `035`, `#35`, `z35`, `zone 35` → 35. */
const ZONE_NUMBER_RE = /^(?:z|zone\s*|#)?0*(\d{1,5})$/i;

/** The zone number a query names (`35`, `035`, `#35`, `z35`, `zone 35`), or null. */
export function parseZoneNumber(query: string): number | null {
  const match = ZONE_NUMBER_RE.exec(query.trim());
  return match === null ? null : Number(match[1]);
}

/** Name order for equal scores: case-insensitive, `Zone 9` before `Zone 10`. */
const NAME_ORDER = new Intl.Collator(undefined, { numeric: true, sensitivity: 'accent' });

interface IndexEntry extends ZoneFtsRow {
  readonly mapTitle: string;
  readonly mapIcon: MapIcon;
  readonly order: number;
  readonly nameTokens: readonly string[];
  readonly fieldTokens: readonly string[];
  /** `String(cellNum)` (unpadded, as painted), or none. */
  readonly numberTokens: readonly string[];
}

export interface MapSearchIndex {
  readonly entries: readonly IndexEntry[];
}

export interface SearchHit {
  readonly mapId: string;
  readonly mapTitle: string;
  readonly mapIcon: MapIcon;
  readonly zoneId: string;
  readonly zoneName: string;
}

/** Build the search index from installed, openable maps. */
export function buildSearchIndex(
  maps: readonly { descriptor: MapDescriptor; doc: MapDocument }[],
): MapSearchIndex {
  const entries: IndexEntry[] = [];
  for (const { descriptor, doc } of maps) {
    if (descriptor.draft || doc.type === 'unknown' || doc.schemaVersion > SUPPORTED_MAP_SCHEMA_VERSION) {
      continue;
    }
    for (const row of buildZoneFtsRows(doc)) {
      entries.push({
        ...row,
        mapTitle: descriptor.title,
        mapIcon: descriptor.icon,
        order: descriptor.order,
        nameTokens: tokenize(row.name),
        fieldTokens: tokenize(row.fieldsText),
        numberTokens: row.cellNum !== null ? [String(row.cellNum)] : [],
      });
    }
  }
  return { entries };
}

/** Score an entry against terms; returns null when any term fails to match. */
function scoreEntry(entry: IndexEntry, terms: string[]): number | null {
  let score = 0;
  const lastIndex = terms.length - 1;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const prefix = i === lastIndex;
    let best = 0;
    const consider = (tokens: readonly string[], weight: number): void => {
      for (const tok of tokens) {
        if (tok === term) best = Math.max(best, 3 * weight);
        else if (prefix && tok.startsWith(term)) best = Math.max(best, 2 * weight);
      }
    };
    consider(entry.nameTokens, 2); // name matches weigh more (bm25-ish)
    consider(entry.numberTokens, 2); // the cell number reads as part of the name
    consider(entry.fieldTokens, 1);
    if (best === 0) return null; // AND: every term must match
    score += best;
  }
  return score;
}

/**
 * Zones matching `query`, best first. The zone whose number the query names
 * (`35`, `035`, `#35`, `z35`, `zone 35`) comes first even when its name doesn't
 * match (Io's numbered cells all have names; Mars pads `Zone 035`); then the
 * text matches, number prefixes included (`35` → 350…359).
 */
export function searchZones(index: MapSearchIndex, query: string, limit = 50): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const number = parseZoneNumber(query);
  const scored: { entry: IndexEntry; exact: boolean; score: number }[] = [];
  for (const entry of index.entries) {
    const exact = number !== null && entry.cellNum === number;
    const s = scoreEntry(entry, terms);
    if (exact || s !== null) scored.push({ entry, exact, score: s ?? 0 });
  }
  scored.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return NAME_ORDER.compare(a.entry.name, b.entry.name);
  });
  return scored.slice(0, limit).map(({ entry }) => ({
    mapId: entry.mapId,
    mapTitle: entry.mapTitle,
    mapIcon: entry.mapIcon,
    zoneId: entry.zoneId,
    zoneName: entry.name,
  }));
}

/**
 * Full-text zone search (maps spec §11). SQLite FTS5 is unavailable on web, so
 * this is an in-memory reimplementation that preserves the required semantics:
 * diacritic-insensitive tokenization, implicit AND across terms, a trailing
 * prefix match on the LAST term, relevance ordering and a default limit of 50.
 */

import { SUPPORTED_MAP_SCHEMA_VERSION } from '../model/limits';
import type { MapDescriptor, MapDocument, MapIcon } from '../model/types';

export interface ZoneFtsRow {
  readonly zoneId: string;
  readonly mapId: string;
  readonly name: string;
  readonly fieldsText: string;
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
    return { zoneId: zone.id, mapId: doc.id, name: zone.name, fieldsText: parts.join(' ') };
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

interface IndexEntry extends ZoneFtsRow {
  readonly mapTitle: string;
  readonly mapIcon: MapIcon;
  readonly order: number;
  readonly nameTokens: readonly string[];
  readonly fieldTokens: readonly string[];
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
    consider(entry.fieldTokens, 1);
    if (best === 0) return null; // AND: every term must match
    score += best;
  }
  return score;
}

export function searchZones(index: MapSearchIndex, query: string, limit = 50): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const scored: { entry: IndexEntry; score: number }[] = [];
  for (const entry of index.entries) {
    const s = scoreEntry(entry, terms);
    if (s !== null) scored.push({ entry, score: s });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.name.toLowerCase().localeCompare(b.entry.name.toLowerCase());
  });
  return scored.slice(0, limit).map(({ entry }) => ({
    mapId: entry.mapId,
    mapTitle: entry.mapTitle,
    mapIcon: entry.mapIcon,
    zoneId: entry.zoneId,
    zoneName: entry.name,
  }));
}

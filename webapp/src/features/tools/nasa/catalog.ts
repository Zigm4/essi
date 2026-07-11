import { loadCatalog } from '../shared/catalog';
import type { ObjectKind } from './sbdb';

/**
 * Curated tracker catalog (tools-live spec §6.4/§6.5). Bundled asset at
 * public/catalog/tracked_objects.json; load failure falls back to empty.
 */

export interface TrackedObject {
  name: string;
  identifier: string;
  kind: ObjectKind;
}

interface RawCatalogEntry {
  name: string;
  identifier: string;
  type: string;
}

/** Load and normalise the catalog; never throws (empty on any failure). */
export async function loadTrackedObjects(): Promise<TrackedObject[]> {
  try {
    const raw = await loadCatalog<RawCatalogEntry[]>('tracked_objects.json');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => typeof e?.name === 'string' && typeof e?.identifier === 'string')
      .map((e) => ({
        name: e.name,
        identifier: e.identifier,
        kind:
          typeof e.type === 'string' && e.type.toLowerCase() === 'comet'
            ? ('comet' as const)
            : ('asteroid' as const),
      }));
  } catch {
    return [];
  }
}

/** Case-insensitive exact match on name OR identifier. */
export function findCatalogMatch(
  catalog: readonly TrackedObject[],
  query: string,
): TrackedObject | null {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return null;
  return (
    catalog.find(
      (e) => e.name.toLowerCase() === q || e.identifier.toLowerCase() === q,
    ) ?? null
  );
}

const SUGGESTION_LIMIT = 8;

/**
 * Catalog filtered by kind, name-or-identifier containing the (case-insensitive)
 * query; empty query → first N. Limited to 8, minus any entry whose name equals
 * the current query.
 */
export function catalogSuggestions(
  catalog: readonly TrackedObject[],
  kind: ObjectKind,
  query: string,
): TrackedObject[] {
  const q = query.trim().toLowerCase();
  const byKind = catalog.filter((e) => e.kind === kind);
  const matched =
    q.length === 0
      ? byKind
      : byKind.filter(
          (e) => e.name.toLowerCase().includes(q) || e.identifier.toLowerCase().includes(q),
        );
  return matched.filter((e) => e.name.toLowerCase() !== q).slice(0, SUGGESTION_LIMIT);
}

/** Guess a kind for an unresolved pinned id (spec §6.5). */
export function guessKind(id: string): ObjectKind {
  const upper = id.toUpperCase();
  if (/^[CPDXAI]\//.test(upper) || /^[0-9]+[PDI]$/.test(upper)) return 'comet';
  return 'asteroid';
}

/**
 * Resolve a pinned id to a friendly label + kind via the catalog
 * (case-insensitive match on identifier or name); unresolved → raw id + guess.
 */
export function resolvePin(
  catalog: readonly TrackedObject[],
  id: string,
): { id: string; label: string; kind: ObjectKind } {
  const lower = id.toLowerCase();
  const hit = catalog.find(
    (e) => e.identifier.toLowerCase() === lower || e.name.toLowerCase() === lower,
  );
  if (hit !== undefined) return { id, label: hit.name, kind: hit.kind };
  return { id, label: id, kind: guessKind(id) };
}

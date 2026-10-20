import { useEffect, useRef, useState } from 'react';
import { logError } from '../../core/logging';
import type { FavoriteRow } from '../../data/db';
import { loadKBData } from '../knowledge/data/kbLoader';
import { loadDocument, loadInstalledManifest } from '../knowledge/maps/data/repository';
import { ensureSeedImported } from '../knowledge/maps/data/seedImporter';
import type { MapDocument } from '../knowledge/maps/model/types';
import { buildRooms, parseFishingZones } from '../tools/fishing/fishingData';
import { parseJobsJson } from '../tools/jobs/jobModel';
import { loadTrackedObjects } from '../tools/nasa/catalog';
import { loadCatalog } from '../tools/shared/catalog';
import {
  buildMapLabels,
  fishingSpots,
  jobsById,
  kindsIn,
  zoneMapIds,
  type FavoriteSources,
  type MapLabels,
  type SourceState,
} from './favoritesList';

/**
 * The data the Favorites list names its rows from. Each source loads on its
 * own, and only once a favorite of its kind exists, so one that fails (or is
 * slow) never holds back the others. Catalog and KB files are precached, the
 * maps are in IndexedDB: all of it works offline.
 */

const loadJobs = async () => jobsById(parseJobsJson(await loadCatalog<unknown>('jobs.json')));

const loadArticles = async () => (await loadKBData()).articles;

const loadFishing = async () =>
  fishingSpots(buildRooms(parseFishingZones(await loadCatalog<unknown>('fishing_zones.json'))));

/** Never throws (an empty catalog leaves designations as they are). */
const loadTracked = () => loadTrackedObjects();

/** The installed maps, plus the documents of `mapIdsJson` (the maps that have starred zones). */
async function loadMaps(mapIdsJson: string): Promise<MapLabels> {
  await ensureSeedImported(); // idempotent - the Knowledge tab may never have been opened
  const manifest = await loadInstalledManifest();
  if (manifest === null) return buildMapLabels([], []);
  const docs: { mapTitle: string; doc: MapDocument }[] = [];
  for (const mapId of JSON.parse(mapIdsJson) as string[]) {
    const descriptor = manifest.maps.find((m) => m.id === mapId);
    if (descriptor === undefined) continue;
    try {
      const doc = await loadDocument(mapId);
      if (doc !== null) docs.push({ mapTitle: descriptor.title, doc });
    } catch (error) {
      // Its zones keep their raw id (and still open the map).
      logError(error);
    }
  }
  return buildMapLabels(manifest.maps, docs);
}

/** The last data each source loaded: coming back to the page shows it at once (then refreshes it). */
const lastLoaded = new Map<string, unknown>();

/**
 * Loads once `needed` turns true, and again when `key` changes (keeping the
 * previous data on screen meanwhile). A failure is logged and reported as
 * `failed`; a later key change retries.
 */
function useLazySource<T>(
  name: string,
  needed: boolean,
  key: string,
  load: (key: string) => Promise<T>,
): SourceState<T> {
  const [state, setState] = useState<SourceState<T>>(() =>
    lastLoaded.has(name) ? { status: 'ready', data: lastLoaded.get(name) as T } : { status: 'loading' },
  );
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!needed || loadedKey.current === key) return;
    let alive = true;
    load(key).then(
      (data) => {
        lastLoaded.set(name, data);
        if (!alive) return;
        loadedKey.current = key;
        setState({ status: 'ready', data });
      },
      (error: unknown) => {
        logError(error);
        if (alive) setState({ status: 'failed' });
      },
    );
    return () => {
      alive = false;
    };
    // `load` is a module-level function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, key]);
  return state;
}

/** The sources for the current favorites (`null` while they load). */
export function useFavoriteSources(rows: readonly FavoriteRow[] | null): FavoriteSources {
  const kinds = kindsIn(rows ?? []);
  // Only grows while the page is open: un-starring a map's last zone (then
  // Undo) doesn't reload the documents.
  const zoneMaps = useRef(new Set<string>());
  for (const mapId of zoneMapIds(rows ?? [])) zoneMaps.current.add(mapId);
  const mapKey = JSON.stringify([...zoneMaps.current].sort());

  return {
    jobs: useLazySource('jobs', kinds.has('job'), '', loadJobs),
    articles: useLazySource('articles', kinds.has('kb_article'), '', loadArticles),
    maps: useLazySource('maps', kinds.has('map') || kinds.has('map_zone'), mapKey, loadMaps),
    fishing: useLazySource('fishing', kinds.has('fishing_zone'), '', loadFishing),
    tracked: useLazySource('tracked', kinds.has('tracked_object'), '', loadTracked),
  };
}

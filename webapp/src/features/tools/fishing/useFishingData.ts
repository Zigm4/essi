import { useCatalog } from '../shared/useCatalog';
import { buildRooms, parseFishingZones, type FishingRoom } from './fishingData';

const parseRooms = (raw: unknown) => buildRooms(parseFishingZones(raw));

/** Loads + groups the fishing zones once for a view. */
export function useFishingRooms(): { rooms: FishingRoom[] | null; error: string | null; retry: () => void } {
  const { data, error, retry } = useCatalog('fishing_zones.json', parseRooms, "Couldn't load the fishing data.");
  return { rooms: data, error, retry };
}

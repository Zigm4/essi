import { useEffect, useState } from 'react';
import { friendlyError } from '../../../core/errorText';
import { loadCatalog } from '../shared/catalog';
import { buildRooms, parseFishingZones, type FishingRoom } from './fishingData';

/** Loads + groups the fishing zones once for a view. */
export function useFishingRooms(): { rooms: FishingRoom[] | null; error: string | null } {
  const [rooms, setRooms] = useState<FishingRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadCatalog<unknown>('fishing_zones.json')
      .then((data) => {
        if (alive) setRooms(buildRooms(parseFishingZones(data)));
      })
      .catch((e: unknown) => {
        if (alive) setError(friendlyError(e, "Couldn't load the fishing data."));
      });
    return () => {
      alive = false;
    };
  }, []);
  return { rooms, error };
}

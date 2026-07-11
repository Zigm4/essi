import { create } from 'zustand';
import { showSnackbar } from '../../../core/snackbar';
import { nextOccurrences, type TrainStop } from './marsExpressService';

/**
 * Train-alert controller — WEB ADAPTATION of spec §5.5–5.9.
 *
 * A GitHub-Pages site has no server, so OS-scheduled push is impossible. We
 * keep the exact arm / cancel / repeat UX but schedule in-page with setTimeout
 * + the Notification API — alerts only fire while the tab is open. The
 * slot/band/budget id machinery (§5.5) existed purely to manage OS notification
 * limits and is dropped; `repeatOccurrences = 6` is kept. Armed zones persist
 * to localStorage so they survive a reload (timers are re-established on load).
 */

export const REPEAT_OCCURRENCES = 6;
const GRACE_MS = 10_000;
const MIN_LEAD_MS = 2_000;

const ZONES_KEY = 'underdeck.trainAlert.zones';
const LEGACY_KEY = 'underdeck.trainAlert.armed';
const LEGACY_CLEANUP_KEY = 'underdeck.trainAlert.didLegacyCleanup';

export type ArmOutcome = 'armed' | 'permissionDenied' | 'nothingToSchedule';

export interface TrainAlertEntry {
  zone: number;
  repeat: boolean;
  /** Epoch-ms of the farthest occurrence currently scheduled. */
  lastArrival: number;
}

interface AlertInstant {
  at: number;
  minutesBefore: 0 | 1 | 2;
  arrival: number;
}

/** zone → active setTimeout ids (module-level, outside the reactive store). */
const timers = new Map<number, ReturnType<typeof setTimeout>[]>();

function clearZoneTimers(zone: number): void {
  const ids = timers.get(zone);
  if (ids !== undefined) {
    for (const id of ids) clearTimeout(id);
    timers.delete(zone);
  }
}

function hasTimers(zone: number): boolean {
  return (timers.get(zone)?.length ?? 0) > 0;
}

function fireNotification(zone: number, minutesBefore: 0 | 1 | 2): void {
  const title = `Mars Express → Zone ${zone}`;
  const body =
    minutesBefore === 2
      ? `Train arriving at Zone ${zone} in 2 minutes.`
      : minutesBefore === 1
        ? `Train arriving at Zone ${zone} in 1 minute.`
        : `Train arriving at Zone ${zone} now.`;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
      return;
    } catch {
      // Construction can throw on some platforms — fall through to the toast.
    }
  }
  showSnackbar(`${title} — ${body}`);
}

function buildInstants(occurrences: Date[], now: number): AlertInstant[] {
  const out: AlertInstant[] = [];
  const seen = new Set<number>();
  for (const occ of occurrences) {
    const arrival = occ.getTime();
    for (const mb of [2, 1, 0] as const) {
      const at = arrival - mb * 60_000;
      if (at < now + MIN_LEAD_MS) continue; // too soon to schedule
      if (seen.has(at)) continue; // dedup shared instants
      seen.add(at);
      out.push({ at, minutesBefore: mb, arrival });
    }
  }
  return out;
}

function scheduleInstants(zone: number, instants: AlertInstant[]): void {
  const now = Date.now();
  const ids: ReturnType<typeof setTimeout>[] = [];
  for (const instant of instants) {
    const delay = instant.at - now;
    if (delay < 0) continue;
    ids.push(setTimeout(() => fireNotification(zone, instant.minutesBefore), delay));
  }
  if (ids.length > 0) timers.set(zone, ids);
}

async function ensurePermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// --- Persistence -------------------------------------------------------------

function loadEntries(): TrainAlertEntry[] {
  const now = Date.now();
  const entries: TrainAlertEntry[] = [];
  try {
    const raw = localStorage.getItem(ZONES_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item === null || typeof item !== 'object') continue;
          const obj = item as Record<string, unknown>;
          if (typeof obj.zone !== 'number' || typeof obj.lastArrival !== 'number') continue;
          const repeat = obj.repeat === true;
          if (!repeat && obj.lastArrival < now - GRACE_MS) continue; // expired one-shot
          entries.push({ zone: obj.zone, repeat, lastArrival: obj.lastArrival });
        }
      }
    }
    // Legacy single-zone migration.
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw !== null) {
      const legacy: unknown = JSON.parse(legacyRaw);
      if (legacy !== null && typeof legacy === 'object') {
        const obj = legacy as Record<string, unknown>;
        if (
          typeof obj.armedZone === 'number' &&
          typeof obj.arrival === 'number' &&
          obj.arrival >= now - GRACE_MS &&
          !entries.some((e) => e.zone === obj.armedZone)
        ) {
          entries.push({ zone: obj.armedZone, repeat: false, lastArrival: obj.arrival });
        }
      }
    }
  } catch {
    // Corrupt storage — start empty.
  }
  return entries;
}

function persistEntries(entries: TrainAlertEntry[]): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
    if (entries.length === 0) localStorage.removeItem(ZONES_KEY);
    else localStorage.setItem(ZONES_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures.
  }
}

/** One-shot legacy-cleanup flag (§5.7). No OS ids exist on web, so this only
 *  sets the flag for parity. */
function cleanupLegacyOnce(): void {
  try {
    if (localStorage.getItem(LEGACY_CLEANUP_KEY) === null) {
      localStorage.setItem(LEGACY_CLEANUP_KEY, 'true');
    }
  } catch {
    // ignore
  }
}

// --- Store -------------------------------------------------------------------

interface TrainAlertState {
  entries: TrainAlertEntry[];
  arm: (zone: number, stops: TrainStop[], repeat: boolean) => Promise<ArmOutcome>;
  cancelZone: (zone: number) => void;
  cancelAll: () => void;
  /** Re-establishes timers / tops up repeating zones (5-second ticker). */
  refresh: (stops: TrainStop[]) => void;
}

export const useTrainAlertStore = create<TrainAlertState>((set, get) => {
  cleanupLegacyOnce();
  return {
    entries: loadEntries(),

    arm: async (zone, stops, repeat) => {
      const perm = await ensurePermission();
      if (perm === 'denied') return 'permissionDenied';

      const now = Date.now();
      const occ = nextOccurrences(zone, stops, repeat ? REPEAT_OCCURRENCES : 1, new Date(now));
      const instants = buildInstants(occ, now);
      if (instants.length === 0) {
        // Drop any stale entry for the zone.
        clearZoneTimers(zone);
        const remaining = get().entries.filter((e) => e.zone !== zone);
        if (remaining.length !== get().entries.length) {
          set({ entries: remaining });
          persistEntries(remaining);
        }
        return 'nothingToSchedule';
      }

      clearZoneTimers(zone);
      scheduleInstants(zone, instants);
      const lastArrival = Math.max(...instants.map((i) => i.arrival));
      const next = [
        ...get().entries.filter((e) => e.zone !== zone),
        { zone, repeat, lastArrival },
      ];
      set({ entries: next });
      persistEntries(next);
      return 'armed';
    },

    cancelZone: (zone) => {
      clearZoneTimers(zone);
      const next = get().entries.filter((e) => e.zone !== zone);
      set({ entries: next });
      persistEntries(next);
    },

    cancelAll: () => {
      for (const zone of [...timers.keys()]) clearZoneTimers(zone);
      set({ entries: [] });
      persistEntries([]);
    },

    refresh: (stops) => {
      const now = Date.now();
      const current = get().entries;
      const next: TrainAlertEntry[] = [];
      let changed = false;

      for (const entry of current) {
        const count = entry.repeat ? REPEAT_OCCURRENCES : 1;
        const occ = nextOccurrences(entry.zone, stops, count, new Date(now));
        const instants = buildInstants(occ, now);

        if (entry.repeat) {
          const newLast = instants.length > 0 ? Math.max(...instants.map((i) => i.arrival)) : 0;
          if (instants.length === 0) {
            clearZoneTimers(entry.zone);
            changed = true;
            continue; // nothing schedulable — drop
          }
          if (newLast !== entry.lastArrival || !hasTimers(entry.zone)) {
            clearZoneTimers(entry.zone);
            scheduleInstants(entry.zone, instants);
            next.push({ ...entry, lastArrival: newLast });
            changed = true;
          } else {
            next.push(entry);
          }
        } else {
          // One-shot: keep within grace, re-establish timers after a reload.
          if (entry.lastArrival < now - GRACE_MS) {
            clearZoneTimers(entry.zone);
            changed = true;
            continue;
          }
          if (!hasTimers(entry.zone)) {
            if (instants.length === 0) {
              clearZoneTimers(entry.zone);
              changed = true;
              continue;
            }
            scheduleInstants(entry.zone, instants);
            const newLast = Math.max(...instants.map((i) => i.arrival));
            next.push({ ...entry, lastArrival: newLast });
            changed = true;
          } else {
            next.push(entry);
          }
        }
      }

      if (changed) {
        set({ entries: next });
        persistEntries(next);
      }
    },
  };
});

/**
 * Mars Express schedule math (spec §5.1-5.2), ported exactly. The in-game train
 * loops the same route every hour, keyed on the wall-clock minute.
 */

export interface TrainStop {
  minute: number;
  zone: number;
  name: string | null;
}

/** Parses the raw JSON and sorts stops by minute ascending. Skips bad rows. */
export function parseSchedule(raw: unknown): TrainStop[] {
  if (!Array.isArray(raw)) return [];
  const stops: TrainStop[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    if (typeof obj.minute !== 'number' || typeof obj.zone !== 'number') continue;
    stops.push({
      minute: obj.minute,
      zone: obj.zone,
      name: typeof obj.name === 'string' ? obj.name : null,
    });
  }
  return stops.sort((a, b) => a.minute - b.minute);
}

/** The stop at the given wall-clock minute, or null. */
export function currentStop(minute: number, stops: TrainStop[]): TrainStop | null {
  return stops.find((s) => s.minute === minute) ?? null;
}

/** First non-null name found for a zone (so zone 301 resolves everywhere). */
export function nameFor(zone: number, stops: TrainStop[]): string | null {
  for (const s of stops) {
    if (s.zone === zone && s.name !== null) return s.name;
  }
  return null;
}

/**
 * Future minutes (of this or next hour) at which the train reaches `zone`.
 * Wraps to +60 when there is nothing left this hour. `N = arrivals[0] - now`
 * can exceed 59.
 */
export function nextArrivals(zone: number, currentMinute: number, stops: TrainStop[]): number[] {
  let future = stops.filter((s) => s.zone === zone && s.minute > currentMinute).map((s) => s.minute);
  if (future.length === 0) {
    future = stops.filter((s) => s.zone === zone).map((s) => s.minute + 60);
  }
  return future.sort((a, b) => a - b);
}

function startOfHour(now: Date): Date {
  const d = new Date(now.getTime());
  d.setMinutes(0, 0, 0);
  return d;
}

/** The 3 alert instants for an arrival: −2 min, −1 min, on arrival. */
export function alertsForArrival(arrival: Date): Date[] {
  return [
    new Date(arrival.getTime() - 2 * 60_000),
    new Date(arrival.getTime() - 1 * 60_000),
    new Date(arrival.getTime()),
  ];
}

/**
 * Next `count` absolute arrival instants strictly after `now` (§5.2). A zone
 * visited k minutes per hour yields k occurrences per hour. Arming exactly on
 * an arrival rolls to the next cycle.
 */
export function nextOccurrences(
  zone: number,
  stops: TrainStop[],
  count: number,
  now: Date,
): Date[] {
  if (count <= 0) return [];
  const minutes = [...new Set(stops.filter((s) => s.zone === zone).map((s) => s.minute))].sort(
    (a, b) => a - b,
  );
  if (minutes.length === 0) return [];

  const result: Date[] = [];
  let anchor = startOfHour(now);
  let guard = 0;
  while (result.length < count && guard <= count + 2) {
    for (const m of minutes) {
      const dt = new Date(anchor.getTime() + m * 60_000);
      if (dt.getTime() > now.getTime()) {
        result.push(dt);
        if (result.length >= count) break;
      }
    }
    anchor = new Date(anchor.getTime() + 60 * 60_000);
    guard++;
  }
  return result;
}

export interface ScheduleEntry {
  startMinute: number;
  endMinute: number;
  zone: number;
  name: string | null;
  nextHour: boolean;
}

/**
 * Groups consecutive minutes at the same zone into ranges, starting at the
 * current minute and wrapping (§5.2). Pass 1: currentMinute..59 (nextHour
 * false); pass 2: 0..currentMinute-1 (nextHour true). A group keeps the first
 * non-null name seen.
 */
export function consolidated(currentMinute: number, stops: TrainStop[]): ScheduleEntry[] {
  const byMinute = new Map(stops.map((s) => [s.minute, s]));
  const entries: ScheduleEntry[] = [];
  let open: ScheduleEntry | null = null;

  const process = (minute: number, nextHour: boolean) => {
    const stop = byMinute.get(minute);
    if (stop === undefined) return;
    if (open !== null && open.zone === stop.zone && open.nextHour === nextHour) {
      open.endMinute = minute;
      if (open.name === null && stop.name !== null) open.name = stop.name;
    } else {
      if (open !== null) entries.push(open);
      open = {
        startMinute: minute,
        endMinute: minute,
        zone: stop.zone,
        name: stop.name,
        nextHour,
      };
    }
  };

  for (let m = currentMinute; m <= 59; m++) process(m, false);
  for (let m = 0; m < currentMinute; m++) process(m, true);
  if (open !== null) entries.push(open);
  return entries;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** `:SS`, `:SS-EE`, plus a trailing `+` when the range is in the next hour. */
export function rangeText(entry: ScheduleEntry): string {
  const base =
    entry.startMinute === entry.endMinute
      ? `:${pad2(entry.startMinute)}`
      : `:${pad2(entry.startMinute)}-${pad2(entry.endMinute)}`;
  return entry.nextHour ? `${base}+` : base;
}

/** "Is current" per §5.3: this-hour range covering the current minute. */
export function isCurrentEntry(entry: ScheduleEntry, minute: number): boolean {
  return !entry.nextHour && entry.startMinute <= minute && minute <= entry.endMinute;
}

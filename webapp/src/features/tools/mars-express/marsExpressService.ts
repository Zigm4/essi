/**
 * Mars Express schedule math (spec §5.1-5.2). The in-game train loops the same
 * route every hour, keyed on the wall-clock minute. One deliberate departure
 * from the spec: an arrival is the start of a stay at a zone, not every minute
 * the train spends there.
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

function zoneMinutes(zone: number, stops: TrainStop[]): Set<number> {
  return new Set(stops.filter((s) => s.zone === zone).map((s) => s.minute));
}

/**
 * Minutes (0-59, ascending) at which the train arrives at `zone`: the first
 * minute of each stay, a stay being consecutive minutes at the zone (wrapping
 * across the hour). A train parked at :49-56 arrives once, at :49 - the other
 * minutes of the stay are not arrivals. A zone held all hour has none.
 */
export function arrivalMinutes(zone: number, stops: TrainStop[]): number[] {
  const at = zoneMinutes(zone, stops);
  return [...at].filter((m) => !at.has((m + 59) % 60)).sort((a, b) => a - b);
}

function startOfHour(now: Date): Date {
  const d = new Date(now.getTime());
  d.setMinutes(0, 0, 0);
  return d;
}

function startOfMinute(now: Date): Date {
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  return d;
}

export interface ZoneTiming {
  /** The train is at the zone right now. */
  here: boolean;
  /** While `here`: when it leaves (the end of its last minute there); null otherwise or if it never leaves. */
  leavesAt: Date | null;
  /** The next arrivals strictly after `now`, oldest first; a stay in progress is not one. */
  arrivals: Date[];
}

/**
 * Where the train stands relative to `zone` at `now` (§5.2/§5.4, by stays):
 * whether it is there and until when, plus the next `count` arrival instants.
 * While it is there, the arrivals are the ones after it leaves.
 */
export function zoneTiming(zone: number, stops: TrainStop[], now: Date, count: number): ZoneTiming {
  const at = zoneMinutes(zone, stops);
  const minute = now.getMinutes();
  const here = at.has(minute);

  let leavesAt: Date | null = null;
  if (here) {
    let stay = 1;
    while (stay < 60 && at.has((minute + stay) % 60)) stay++;
    if (stay < 60) leavesAt = new Date(startOfMinute(now).getTime() + stay * 60_000);
  }

  // The stay in progress began at or before the current minute, so "strictly
  // after now" already skips it.
  const starts = arrivalMinutes(zone, stops);
  const arrivals: Date[] = [];
  if (count > 0 && starts.length > 0) {
    for (let anchor = startOfHour(now).getTime(); arrivals.length < count; anchor += 60 * 60_000) {
      for (const m of starts) {
        const dt = new Date(anchor + m * 60_000);
        if (dt.getTime() > now.getTime() && arrivals.length < count) arrivals.push(dt);
      }
    }
  }
  return { here, leavesAt, arrivals };
}

/** Whole minutes from `now` until `target`, rounded up (1 s left reads "1 min"). */
export function minutesUntil(target: Date, now: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60_000));
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

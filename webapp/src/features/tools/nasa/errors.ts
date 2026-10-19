/**
 * Tool-specific error taxonomies with verbatim user-facing messages
 * (tools-live spec §4.9, §5.6, §6.6). Each concrete class carries the exact
 * string shown in the UI, so views render `error.message` directly.
 */

// --- System Scan (§4.9) ------------------------------------------------------

export class ScanError extends Error {}

export class ScanOfflineError extends ScanError {
  constructor() {
    super("Couldn't reach the JPL proxy. Check your connection and try again.");
    this.name = 'ScanOfflineError';
  }
}

export class ScanHttpError extends ScanError {
  readonly status: number;
  constructor(status: number) {
    super(`JPL Horizons returned HTTP ${status}.`);
    this.name = 'ScanHttpError';
    this.status = status;
  }
}

export class ScanUnparseableError extends ScanError {
  constructor() {
    super("Couldn't parse JPL Horizons response.");
    this.name = 'ScanUnparseableError';
  }
}

export class ScanApiMessageError extends ScanError {
  readonly detail: string;
  constructor(detail: string) {
    super(`JPL Horizons returned an unexpected response: ${detail}`);
    this.name = 'ScanApiMessageError';
    this.detail = detail;
  }
}

export class ScanNoDataError extends ScanError {
  constructor() {
    super('JPL Horizons returned no position data.');
    this.name = 'ScanNoDataError';
  }
}

export class ScanCancelledError extends ScanError {
  constructor() {
    super('Scan cancelled.');
    this.name = 'ScanCancelledError';
  }
}

// --- Celestial Discoveries (§5.6) --------------------------------------------

export class CelestialError extends Error {}

export class CelestialDateOutOfRangeError extends CelestialError {
  constructor() {
    super('Pick a date no later than today.');
    this.name = 'CelestialDateOutOfRangeError';
  }
}

export class CelestialHttpError extends CelestialError {
  readonly status: number;
  constructor(status: number) {
    super(`JPL SBDB returned HTTP ${status}.`);
    this.name = 'CelestialHttpError';
    this.status = status;
  }
}

export class CelestialUnparseableError extends CelestialError {
  constructor() {
    super("Couldn't parse JPL SBDB response.");
    this.name = 'CelestialUnparseableError';
  }
}

export class CelestialOfflineError extends CelestialError {
  constructor() {
    super("Couldn't reach the JPL proxy. Check your connection and try again.");
    this.name = 'CelestialOfflineError';
  }
}

export class CelestialTimeoutError extends CelestialError {
  constructor() {
    super('JPL SBDB took too long to answer. Try again, or search a shorter date range.');
    this.name = 'CelestialTimeoutError';
  }
}

export class CelestialCancelledError extends CelestialError {
  constructor() {
    super('Request cancelled.');
    this.name = 'CelestialCancelledError';
  }
}

// --- Object Tracker (§6.6) ---------------------------------------------------

export class TrackerError extends Error {}

export class TrackerOfflineError extends TrackerError {
  constructor() {
    super("Couldn't reach the JPL proxy. Check your connection and try again.");
    this.name = 'TrackerOfflineError';
  }
}

export class TrackerHttpError extends TrackerError {
  readonly status: number;
  constructor(status: number) {
    super(`Upstream returned HTTP ${status}.`);
    this.name = 'TrackerHttpError';
    this.status = status;
  }
}

export class TrackerUnparseableError extends TrackerError {
  constructor() {
    super("Couldn't parse the upstream response.");
    this.name = 'TrackerUnparseableError';
  }
}

export class TrackerMpcLookupError extends TrackerError {
  constructor() {
    super("Couldn't resolve an MPC ID for that target.");
    this.name = 'TrackerMpcLookupError';
  }
}

export class TrackerApiMessageError extends TrackerError {
  readonly detail: string;
  constructor(detail: string) {
    super(`JPL Horizons returned an unexpected response: ${detail}`);
    this.name = 'TrackerApiMessageError';
    this.detail = detail;
  }
}

export class TrackerNoEphemerisError extends TrackerError {
  constructor() {
    super('No ephemeris data available for that object right now.');
    this.name = 'TrackerNoEphemerisError';
  }
}

export class TrackerNotFoundError extends TrackerError {
  constructor() {
    super('No object matches that name. Check the spelling, or try its designation (e.g. 2024 PT5, C/2025 N1).');
    this.name = 'TrackerNotFoundError';
  }
}

/** One object the user can pick when a name matches several. */
export interface TrackChoice {
  label: string;
  mpcID: string;
  kind: 'comet' | 'asteroid';
}

export class TrackerAmbiguousError extends TrackerError {
  readonly choices: readonly TrackChoice[];
  /** Matches beyond `choices` (not listed). */
  readonly more: number;
  constructor(choices: readonly TrackChoice[], more = 0) {
    super('Several objects match that name. Pick one:');
    this.name = 'TrackerAmbiguousError';
    this.choices = choices;
    this.more = more;
  }
}

export class TrackerSunError extends TrackerError {
  constructor() {
    super('The Sun is the centre of the map: 0 SL, no sector.');
    this.name = 'TrackerSunError';
  }
}

export class TrackerCancelledError extends TrackerError {
  constructor() {
    super('Request cancelled.');
    this.name = 'TrackerCancelledError';
  }
}

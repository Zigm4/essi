/**
 * Tool-specific error taxonomies with verbatim user-facing messages
 * (tools-live spec §4.9, §5.6, §6.6). Each concrete class carries the exact
 * string shown in the UI, so views render `error.message` directly.
 */

// --- System Scan (§4.9) ------------------------------------------------------

export class ScanError extends Error {}

export class ScanOfflineError extends ScanError {
  constructor() {
    super("Couldn't reach the JPL proxy. Check the proxy URL in Settings (it must start with https://), or your connection.");
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
    super("Couldn't reach the JPL proxy. Check the proxy URL in Settings (it must start with https://), or your connection.");
    this.name = 'CelestialOfflineError';
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
    super("Couldn't reach the JPL proxy. Check the proxy URL in Settings (it must start with https://), or your connection.");
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

export class TrackerCancelledError extends TrackerError {
  constructor() {
    super('Request cancelled.');
    this.name = 'TrackerCancelledError';
  }
}

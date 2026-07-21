/** Build-time version constants (no async provider needed on web). */

/**
 * Semantic version MAJOR.MINOR.PATCH - bump on every release:
 *  - MAJOR: breaking change or a full milestone (stays 0 until feature-complete).
 *  - MINOR: a new tool or user-facing feature.
 *  - PATCH: bug fix, copy tweak, or data-only catalog update.
 */
export const appVersion = '0.3.3';

/** Release channel shown next to the version (Alpha until feature-complete). */
export const appChannel = 'Alpha';

export const versionShortLabel = `v${appVersion}`;
export const versionFullLabel = `v${appVersion} (${appChannel})`;

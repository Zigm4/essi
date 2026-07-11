/**
 * Maps preference keys (maps spec §8.3), stored in localStorage under the
 * `underdeck.` prefix — the same keys Settings › Clear removes.
 */

const PREFIX = 'underdeck.';

const KEYS = {
  pointerEtag: 'maps.pointerEtag',
  lastCheckAt: 'maps.lastCheckAt',
  seedImported: 'maps.seedImported', // legacy bool guard
  seedImportedVersion: 'maps.seedImportedVersion',
} as const;

function read(key: string): string | null {
  return localStorage.getItem(PREFIX + key);
}
function write(key: string, value: string): void {
  localStorage.setItem(PREFIX + key, value);
}
function remove(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export function getPointerEtag(): string {
  return read(KEYS.pointerEtag) ?? '';
}
export function setPointerEtag(etag: string): void {
  write(KEYS.pointerEtag, etag);
}
export function removePointerEtag(): void {
  remove(KEYS.pointerEtag);
}

export function getLastCheckAt(): number | null {
  const raw = read(KEYS.lastCheckAt);
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}
export function setLastCheckAt(ms: number): void {
  write(KEYS.lastCheckAt, String(ms));
}
export function removeLastCheckAt(): void {
  remove(KEYS.lastCheckAt);
}

/** The seed contentVersion last imported, resolving the legacy bool → '0-seed'. */
export function getSeedImportedVersion(): string | null {
  const explicit = read(KEYS.seedImportedVersion);
  if (explicit !== null) return explicit;
  if (read(KEYS.seedImported) === 'true') return '0-seed';
  return null;
}
export function setSeedImportedVersion(version: string): void {
  write(KEYS.seedImportedVersion, version);
}

/** Settings › Clear: drop the seed guard so the baseline re-imports (§9). */
export function resetSeedImportGuard(): void {
  remove(KEYS.seedImported);
  remove(KEYS.seedImportedVersion);
}

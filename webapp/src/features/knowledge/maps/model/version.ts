/**
 * Semver-ish dotted numeric comparison (maps spec §4.4), used for both content
 * anti-rollback and the minAppVersion gate. Non-numeric parts count as 0 (a
 * strict `^\d+$` check matches Dart's `int.tryParse`, so `'2abc'` → 0, not 2).
 */

function numericOrZero(part: string): number {
  return /^\d+$/.test(part) ? Number.parseInt(part, 10) : 0;
}

export function compareContentVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/);
  const pb = b.split(/[.\-+]/);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const va = i < pa.length ? numericOrZero(pa[i]) : 0;
    const vb = i < pb.length ? numericOrZero(pb[i]) : 0;
    if (va !== vb) return va < vb ? -1 : 1;
  }
  return 0;
}

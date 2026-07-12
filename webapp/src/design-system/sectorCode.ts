/**
 * The ESSI banner's scroll-driven fake sector code, exactly as in the Flutter
 * TransmissionHeader (design-system spec §6.1):
 *
 *   ticks = floor(abs(scrollOffset) / 4)   // changes every 4px scrolled
 *   value = 100 + ((seed + ticks) % 900)   // always 100..999
 *
 * Pure cosmetics - explicitly NOT location data.
 */
export function sectorCodeValue(seed: number, scrollOffset: number): number {
  const ticks = Math.floor(Math.abs(scrollOffset) / 4);
  return 100 + ((seed + ticks) % 900);
}

export function sectorCodeText(seed: number, scrollOffset: number): string {
  return `ESSI//${sectorCodeValue(seed, scrollOffset)}`;
}

/** Per-header random seed 0..899, fixed on mount for the header's lifetime. */
export function randomSectorSeed(): number {
  return Math.floor(Math.random() * 900);
}

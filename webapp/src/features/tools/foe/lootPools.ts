/**
 * Per-faction blueprint loot pools: when a FOE drops a "... BP" category, these
 * are the specific blueprints it can roll. This is a text-only reference shown
 * in the tool for extra context - it is NOT part of the ID decoding, so it lives
 * outside foe_tables.json. Keyed by faction code, then by loot digit
 * (2 = Clothing BP, 3 = Armour BP, 5 = Vessel BP). Incomplete; filled in as data
 * comes in.
 */
export const LOOT_POOLS: Record<string, Record<string, string[]>> = {
  OUT: {
    '2': [
      'DUST RAGS BP',
      'BOOT GUARDS BP',
      'HAND WRAPS BP',
      'SAND PANTS BP',
      'SHIRT BP',
      "SCAVENGER'S COAT BP",
      'BREATHER BP',
    ],
    '3': [
      'SALVAGE CORE BP',
      'TRACK SHOES BP (+2% Headshot)',
      'RUST GAUNTLETS BP',
      'LEG SHIELDS BP',
      'THIGH PLATES BP',
      'ARM BANDS BP',
      'WAIST STRAP BP',
      'SHOULDER GUARDS BP',
      'CHEST RIG BP',
      'HELMET MASK BP',
    ],
    '5': ['DUNE BUGGY BP', 'SAND SKIMMER BP', 'SCRAP WALKER BP', 'RUST TANK BP'],
  },
};

/** Blueprint loot categories (Clothing / Armour / Vessel BP). */
const BLUEPRINT_LOOT_DIGITS = new Set(['2', '3', '5']);

export function isBlueprintLoot(lootDigit: string): boolean {
  return BLUEPRINT_LOOT_DIGITS.has(lootDigit);
}

/** The blueprint pool for a faction + loot digit, or undefined when unknown. */
export function lootPool(factionCode: string | null, lootDigit: string): string[] | undefined {
  if (factionCode === null) return undefined;
  return LOOT_POOLS[factionCode]?.[lootDigit];
}

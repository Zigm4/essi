/**
 * Jobs taxonomies (spec §3.2) - labels & tints for factions, tags, skills,
 * rewards, and the type buckets behind the filter sheet's job categories.
 * Every tint is a #RRGGBB hex so it works both as a CSS color and via
 * withAlpha().
 */

export interface Tinted {
  label: string;
  tint: string;
}

/** Fallback tint for unknown faction / reward keys. */
export const DEFAULT_TINT = '#8AA4C2'; // textSecondary
const ACCENT_SECONDARY = '#7AE3FF';
export const ACCENT_SUCCESS = '#5FE8A0';

interface FactionDef {
  /** The short code the game's bot shows (descriptions read `**MSC & QNX**`, `[PRQ SQUIRE: …]`). */
  code: string;
  /** The faction's name when a source attests it; null = not attested, the code is shown instead. */
  name: string | null;
  tint: string;
}

/**
 * Factions by reputation key (`factionRep`, `factionRival`, and the stems of
 * the rival functions). The game's bot only shows codes; a name is listed only
 * where a source attests it. Names left null (PRQ, MSN, 55th, CO8, TFI, HEX,
 * RSA) are still to be confirmed with the game's developer - earlier labels
 * such as "Proquinox", "Mischen", "55 Imperials" or "Co8" were made up.
 */
const FACTIONS: Record<string, FactionDef> = {
  rep_55imp: { code: '55th', name: null, tint: '#FF7777' },
  rep_chat: { code: 'CHT', name: 'Chattery', tint: '#B377FF' },
  rep_clst: { code: 'CLS', name: 'Celestyn', tint: '#E6E6FF' },
  rep_co8: { code: 'CO8', name: null, tint: '#8B7BFF' },
  rep_hex: { code: 'HEX', name: null, tint: '#FF77AA' },
  rep_king: { code: 'KING', name: 'King', tint: '#FFD15C' },
  rep_lycnx: { code: 'LYC', name: 'Lycanox', tint: '#9DDCFF' },
  rep_mrtn: { code: 'MRT', name: 'Martian', tint: '#FF7755' },
  rep_mschf: { code: 'MSC', name: 'Mischief', tint: '#FFC766' },
  rep_mschn: { code: 'MSN', name: null, tint: '#FF8844' },
  rep_oort: { code: 'ORT', name: 'Oortians', tint: '#AACCFF' },
  rep_pearl: { code: 'PRL', name: 'Pearl', tint: '#FFE9A8' },
  rep_proq: { code: 'PRQ', name: null, tint: '#9C9C9C' },
  rep_qnxs: { code: 'QNX', name: 'Qnexus', tint: '#66E0DD' },
  rep_rsa: { code: 'RSA', name: null, tint: '#FF5577' },
  rep_rts: { code: 'RTS', name: 'Rustwind', tint: '#C58A4F' },
  rep_rvnts: { code: 'PRV', name: 'Revenants', tint: '#8B6FFF' },
  rep_tfi: { code: 'TFI', name: null, tint: '#5FE8A0' },
  rep_uurt: { code: 'URT', name: 'Uurtians', tint: '#3FBFA0' },
  rep_zcorp: { code: 'ZCP', name: 'Z-Corp', tint: '#4FC3FF' },
};

export interface FactionInfo extends Tinted {
  code: string;
  name: string | null;
  /** Short label (cards, chips): the name when attested, else the code. */
  label: string;
  /** Long label (detail sheet, filter sheet): `Name (CODE)` when the name is attested, else the code. */
  fullLabel: string;
}

/** Faction lookup; an unknown key renders raw (as its own code) with the default tint. */
export function factionInfo(key: string): FactionInfo {
  const def = FACTIONS[key] ?? { code: key, name: null, tint: DEFAULT_TINT };
  return {
    code: def.code,
    name: def.name,
    tint: def.tint,
    label: def.name ?? def.code,
    fullLabel: def.name === null ? def.code : `${def.name} (${def.code})`,
  };
}

/** Tags (`requiredTag` → human label). */
export const TAG_LABELS: Record<string, string> = {
  NorthSquire: 'North Squire',
  EastSquire: 'East Squire',
  WestSquire: 'West Squire',
  SouthSquire: 'South Squire',
  UpSquire: 'Up Squire',
  DownSquire: 'Down Squire',
  VERIFIED: 'Verified',
};

export function tagLabel(key: string): string {
  return TAG_LABELS[key] ?? key;
}

/** Skills (key → tint). Unknown skill → accentSecondary. */
const SKILL_TINTS: Record<string, string> = {
  strength: '#FF7755',
  stealth: '#8B6FFF',
  knowledge: '#4FC3FF',
  fortitude: '#FFB347',
  panache: '#FF77AA',
  tech: '#7AE3FF',
  astro: '#B377FF',
  singing: '#FFE9A8',
  medicine: '#5FE8A0',
  magic: '#E6E6FF',
  leadership: '#FFD15C',
  corrupt: '#FF5577',
  carryCoin: '#FFD15C',
  stamina: '#C58A4F',
  wood: '#8B6F47',
  unobtainium: '#B377FF',
  oil: '#3F4F6F',
};

export function skillTint(key: string): string {
  return SKILL_TINTS[key] ?? ACCENT_SECONDARY;
}

/** Skill keys that don't read as words once capitalised. */
const SKILL_LABELS: Record<string, string> = {
  carryCoin: 'Carry coin',
};

/** Human label for a `requiredSkill` key: `Carry coin`, else the key capitalised (`Stealth`). */
export function skillLabel(key: string): string {
  return SKILL_LABELS[key] ?? (key.length > 0 ? key[0]!.toUpperCase() + key.slice(1) : key);
}

/** Rewards (canonical key → label + tint). Unknown → key uppercased, textSecondary. */
const REWARD_INFO: Record<string, Tinted> = {
  coin: { label: 'Coin', tint: '#FFD15C' },
  rocks: { label: 'Rocks', tint: '#8AA4C2' },
  scrap: { label: 'Scrap', tint: '#C58A4F' },
  titanium: { label: 'Titanium', tint: '#9DDCFF' },
  energy: { label: 'Energy', tint: '#5FE8A0' },
  mala: { label: 'Mala', tint: '#B377FF' },
  wackos: { label: 'Wackos', tint: '#FF77AA' },
  data: { label: 'Map Data', tint: '#4FC3FF' },
  oil: { label: 'Oil', tint: '#3F4F6F' },
  krypton: { label: 'Krypton', tint: '#AACCFF' },
  star_tar: { label: 'Star Tar', tint: '#8B6FFF' },
  stimnx: { label: 'Stimnx', tint: '#FF5577' },
  supplies: { label: 'Supplies', tint: '#7AE3FF' },
  wolfram: { label: 'Wolfram', tint: '#9C9C9C' },
  unobtainium: { label: 'Unobtainium', tint: '#B377FF' },
  aurum: { label: 'Aurum', tint: '#FFE9A8' },
};

export function rewardInfo(key: string): Tinted {
  return REWARD_INFO[key] ?? { label: key.toUpperCase(), tint: DEFAULT_TINT };
}

/**
 * Type buckets (§3.2) - grouping is on the lowercased type. Anything unmapped
 * falls into `Other`. The filter sheet never shows buckets directly: it shows
 * the coarser job categories below.
 */
const BUCKET_MEMBERS: Record<string, string[]> = {
  Beginner: ['beginner'],
  'Skill gain': [
    'strength',
    'stealth',
    'knowledge',
    'fortitude',
    'panache',
    'singing',
    'medical',
    'magic',
    'manipulation',
    'observation',
    'corruption',
    'cleaning',
    'engineering',
    'dock',
    'comms',
    'performance',
  ],
  Regular: [
    'transport',
    'navigation',
    'aid',
    'repair',
    'maintenance',
    'research',
    'report',
    'leadership',
    'escort',
    'sabotage',
    'supply run',
    'late shift',
    'long distance recon',
    'deliver cargo',
    'teaching',
    'science',
    'puzzle',
    'judge',
    'hauler',
    'compose',
    'challenge',
    'audition',
    'salvage',
    'tech salvage',
    'vip transport',
  ],
  Expansion: ['mrt expansion', 'lyc expansion', 'rsa expansion'],
  Event: ['rsa betrayal', 'martian war', 'king', 'king2prv', 'queen'],
  Unknown: ['???'],
};

const TYPE_TO_BUCKET: Record<string, string> = {};
for (const [bucket, members] of Object.entries(BUCKET_MEMBERS)) {
  for (const member of members) TYPE_TO_BUCKET[member] = bucket;
}

/** The bucket for a lowercased type; anything unmapped → `Other`. */
function typeBucket(type: string): string {
  return TYPE_TO_BUCKET[type] ?? 'Other';
}

/**
 * Job categories (filter sheet §3.5, section 3) - the type buckets folded into
 * six stable, lowercase keys. `Regular` and `Other` both read as "Standard".
 * Listed in display order.
 */
export const JOB_CATEGORIES: readonly { key: string; label: string }[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'skill-gain', label: 'Skill gain' },
  { key: 'standard', label: 'Standard' },
  { key: 'expansion', label: 'Expansion' },
  { key: 'event', label: 'Event' },
  { key: 'unknown', label: 'Unknown' },
];

const BUCKET_TO_CATEGORY: Record<string, string> = {
  Beginner: 'beginner',
  'Skill gain': 'skill-gain',
  Regular: 'standard',
  Other: 'standard',
  Expansion: 'expansion',
  Event: 'event',
  Unknown: 'unknown',
};

const CATEGORY_LABELS = new Map(JOB_CATEGORIES.map((c) => [c.key, c.label]));

/** The category key for a lowercased type (unmapped types → `standard`). */
export function jobCategory(type: string): string {
  return BUCKET_TO_CATEGORY[typeBucket(type)] ?? 'standard';
}

/** Human label for a category key; unknown keys render raw. */
export function categoryLabel(key: string): string {
  return CATEGORY_LABELS.get(key) ?? key;
}

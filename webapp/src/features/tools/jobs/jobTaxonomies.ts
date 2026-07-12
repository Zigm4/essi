/**
 * Jobs taxonomies (spec §3.2) - labels & tints for factions, tags, skills,
 * rewards, and the type buckets used to group type chips in the filter sheet.
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

/** Allied factions (appear as `factionRep`). */
export const ALLIED_FACTIONS: Record<string, Tinted> = {
  rep_chat: { label: 'Chattery', tint: '#B377FF' },
  rep_clst: { label: 'Celestyn', tint: '#E6E6FF' },
  rep_hex: { label: 'Hex', tint: '#FF77AA' },
  rep_king: { label: 'King', tint: '#FFD15C' },
  rep_lycnx: { label: 'Lycanox', tint: '#9DDCFF' },
  rep_mrtn: { label: 'Martian', tint: '#FF7755' },
  rep_mschf: { label: 'Mischief', tint: '#FFC766' },
  rep_pearl: { label: 'Pearl', tint: '#FFE9A8' },
  rep_proq: { label: 'Proquinox', tint: '#9C9C9C' },
  rep_rsa: { label: 'RSA', tint: '#FF5577' },
  rep_rts: { label: 'Rustwind', tint: '#C58A4F' },
  rep_rvnts: { label: 'Revenants', tint: '#8B6FFF' },
  rep_tfi: { label: 'TFI', tint: '#5FE8A0' },
  rep_uurt: { label: 'Uurt', tint: '#3FBFA0' },
  rep_zcorp: { label: 'Z-Corp', tint: '#4FC3FF' },
};

/** Rival-only factions (appear only as `factionRival`). */
export const RIVAL_ONLY_FACTIONS: Record<string, Tinted> = {
  rep_55imp: { label: '55 Imperials', tint: '#FF7777' },
  rep_co8: { label: 'Co8', tint: '#8B7BFF' },
  rep_mschn: { label: 'Mischen', tint: '#FF8844' },
  rep_oort: { label: 'Oortians', tint: '#AACCFF' },
  rep_qnxs: { label: 'Qnexus', tint: '#66E0DD' },
};

/** Ordered allied faction keys (filter-sheet order = taxonomy order). */
export const ALLIED_FACTION_KEYS = Object.keys(ALLIED_FACTIONS);
/** Ordered keys for the rival filter (15 allied + 5 rival-only = 20). */
export const RIVAL_FACTION_KEYS = [
  ...ALLIED_FACTION_KEYS,
  ...Object.keys(RIVAL_ONLY_FACTIONS),
];

/** Faction lookup across both lists; unknown → raw key + default tint. */
export function factionInfo(key: string): Tinted {
  return ALLIED_FACTIONS[key] ?? RIVAL_ONLY_FACTIONS[key] ?? { label: key, tint: DEFAULT_TINT };
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

/** The 7 taxonomy tag keys, in definition order. */
export const TAG_KEYS = Object.keys(TAG_LABELS);

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
 * Type buckets (§3.2) - grouping is on the lowercased type. Buckets are sorted
 * alphabetically in the filter sheet: Beginner, Event, Expansion, Other,
 * Regular, Skill gain, Unknown (only the present ones render).
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
export function typeBucket(type: string): string {
  return TYPE_TO_BUCKET[type] ?? 'Other';
}

/** Buckets in alphabetical order (used to sort the TYPE section). */
export const BUCKET_ORDER = ['Beginner', 'Event', 'Expansion', 'Other', 'Regular', 'Skill gain', 'Unknown'];

import type { TrackKind } from './models';
import { PLANETS } from './planets';
import { KIND_EMOJI } from './sbdb';

/**
 * The Sun, the planets and every named moon JPL Horizons knows (its major-body
 * list, Oct 2026), so the Tracker can follow them directly instead of looking
 * the name up among asteroids and comets: "Europa" used to land on the main
 * belt asteroid 52 Europa (85 SL) instead of Jupiter's moon (164 SL).
 *
 * A moon is not always where its planet is: the outer ones orbit far out
 * (Megaclite 6.6 SL from Jupiter, Neso 14.7 SL from Neptune, measured Oct
 * 2026), so each body is tracked with its own Horizons id. Daphnis is left out:
 * Horizons has no ephemeris for it after 2018 (it orbits inside Saturn's rings).
 */

export type MajorBodyType = 'star' | 'planet' | 'dwarf planet' | 'moon';

export interface MajorBody {
  /** JPL Horizons / NAIF id (502 = Europa). */
  naif: number;
  name: string;
  type: MajorBodyType;
  /** The planet a moon orbits. */
  parent?: string;
  /** Other names it is found by (catalogue number, French name…). */
  aliases: readonly string[];
}

const PARENT_BY_HUNDREDS: Record<number, string> = {
  3: 'Earth',
  4: 'Mars',
  5: 'Jupiter',
  6: 'Saturn',
  7: 'Uranus',
  8: 'Neptune',
  9: 'Pluto',
};

/** [Horizons id, name, catalogue number (Jupiter II…)] from the Horizons major-body list. */
const MOONS: readonly (readonly [number, string, string?])[] = [
  [301, 'Moon'],
  [401, 'Phobos', 'I'],
  [402, 'Deimos', 'II'],
  [501, 'Io', 'I'],
  [502, 'Europa', 'II'],
  [503, 'Ganymede', 'III'],
  [504, 'Callisto', 'IV'],
  [505, 'Amalthea', 'V'],
  [506, 'Himalia', 'VI'],
  [507, 'Elara', 'VII'],
  [508, 'Pasiphae', 'VIII'],
  [509, 'Sinope', 'IX'],
  [510, 'Lysithea', 'X'],
  [511, 'Carme', 'XI'],
  [512, 'Ananke', 'XII'],
  [513, 'Leda', 'XIII'],
  [514, 'Thebe', 'XIV'],
  [515, 'Adrastea', 'XV'],
  [516, 'Metis', 'XVI'],
  [517, 'Callirrhoe', 'XVII'],
  [518, 'Themisto', 'XVIII'],
  [519, 'Megaclite', 'XIX'],
  [520, 'Taygete', 'XX'],
  [521, 'Chaldene', 'XXI'],
  [522, 'Harpalyke', 'XXII'],
  [523, 'Kalyke', 'XXIII'],
  [524, 'Iocaste', 'XXIV'],
  [525, 'Erinome', 'XXV'],
  [526, 'Isonoe', 'XXVI'],
  [527, 'Praxidike', 'XXVII'],
  [528, 'Autonoe', 'XXVIII'],
  [529, 'Thyone', 'XXIX'],
  [530, 'Hermippe', 'XXX'],
  [531, 'Aitne', 'XXXI'],
  [532, 'Eurydome', 'XXXII'],
  [533, 'Euanthe', 'XXXIII'],
  [534, 'Euporie', 'XXXIV'],
  [535, 'Orthosie', 'XXXV'],
  [536, 'Sponde', 'XXXVI'],
  [537, 'Kale', 'XXXVII'],
  [538, 'Pasithee', 'XXXVIII'],
  [539, 'Hegemone', 'XXXIX'],
  [540, 'Mneme', 'XL'],
  [541, 'Aoede', 'XLI'],
  [542, 'Thelxinoe', 'XLII'],
  [543, 'Arche', 'XLIII'],
  [544, 'Kallichore', 'XLIV'],
  [545, 'Helike', 'XLV'],
  [546, 'Carpo', 'XLVI'],
  [547, 'Eukelade', 'XLVII'],
  [548, 'Cyllene', 'XLVIII'],
  [549, 'Kore', 'XLIX'],
  [550, 'Herse', 'L'],
  [553, 'Dia', 'LIII'],
  [557, 'Eirene', 'LVII'],
  [558, 'Philophrosyne', 'LVIII'],
  [560, 'Eupheme', 'LX'],
  [562, 'Valetudo'],
  [565, 'Pandia', 'LXV'],
  [571, 'Ersa'],
  [601, 'Mimas', 'I'],
  [602, 'Enceladus', 'II'],
  [603, 'Tethys', 'III'],
  [604, 'Dione', 'IV'],
  [605, 'Rhea', 'V'],
  [606, 'Titan', 'VI'],
  [607, 'Hyperion', 'VII'],
  [608, 'Iapetus', 'VIII'],
  [609, 'Phoebe', 'IX'],
  [610, 'Janus', 'X'],
  [611, 'Epimetheus', 'XI'],
  [612, 'Helene', 'XII'],
  [613, 'Telesto', 'XIII'],
  [614, 'Calypso', 'XIV'],
  [615, 'Atlas', 'XV'],
  [616, 'Prometheus', 'XVI'],
  [617, 'Pandora', 'XVII'],
  [618, 'Pan', 'XVIII'],
  [619, 'Ymir', 'XIX'],
  [620, 'Paaliaq', 'XX'],
  [621, 'Tarvos', 'XXI'],
  [622, 'Ijiraq', 'XXII'],
  [623, 'Suttungr', 'XXIII'],
  [624, 'Kiviuq', 'XXIV'],
  [625, 'Mundilfari', 'XXV'],
  [626, 'Albiorix', 'XXVI'],
  [627, 'Skathi', 'XXVII'],
  [628, 'Erriapus', 'XXVIII'],
  [629, 'Siarnaq', 'XXIX'],
  [630, 'Thrymr', 'XXX'],
  [631, 'Narvi', 'XXXI'],
  [632, 'Methone', 'XXXII'],
  [633, 'Pallene', 'XXXIII'],
  [634, 'Polydeuces', 'XXXIV'],
  [636, 'Aegir', 'XXXVI'],
  [637, 'Bebhionn', 'XXXVII'],
  [638, 'Bergelmir', 'XXXVIII'],
  [639, 'Bestla', 'XXXIX'],
  [640, 'Farbauti', 'XL'],
  [641, 'Fenrir', 'XLI'],
  [642, 'Fornjot', 'XLII'],
  [643, 'Hati', 'XLIII'],
  [644, 'Hyrrokkin', 'XLIV'],
  [645, 'Kari', 'XLV'],
  [646, 'Loge', 'XLVI'],
  [647, 'Skoll', 'XLVII'],
  [648, 'Surtur', 'XLVIII'],
  [649, 'Anthe', 'XLIX'],
  [650, 'Jarnsaxa', 'L'],
  [651, 'Greip', 'LI'],
  [652, 'Tarqeq', 'LII'],
  [653, 'Aegaeon', 'LIII'],
  [654, 'Gridr'],
  [655, 'Angrboda'],
  [656, 'Skrymir'],
  [657, 'Gerd'],
  [659, 'Eggther'],
  [661, 'Beli'],
  [662, 'Gunnlod'],
  [663, 'Thiazzi'],
  [665, 'Alvaldi'],
  [666, 'Geirrod'],
  [701, 'Ariel', 'I'],
  [702, 'Umbriel', 'II'],
  [703, 'Titania', 'III'],
  [704, 'Oberon', 'IV'],
  [705, 'Miranda', 'V'],
  [706, 'Cordelia', 'VI'],
  [707, 'Ophelia', 'VII'],
  [708, 'Bianca', 'VIII'],
  [709, 'Cressida', 'IX'],
  [710, 'Desdemona', 'X'],
  [711, 'Juliet', 'XI'],
  [712, 'Portia', 'XII'],
  [713, 'Rosalind', 'XIII'],
  [714, 'Belinda', 'XIV'],
  [715, 'Puck', 'XV'],
  [716, 'Caliban', 'XVI'],
  [717, 'Sycorax', 'XVII'],
  [718, 'Prospero', 'XVIII'],
  [719, 'Setebos', 'XIX'],
  [720, 'Stephano', 'XX'],
  [721, 'Trinculo', 'XXI'],
  [722, 'Francisco', 'XXII'],
  [723, 'Margaret', 'XXIII'],
  [724, 'Ferdinand', 'XXIV'],
  [725, 'Perdita', 'XXV'],
  [726, 'Mab', 'XXVI'],
  [727, 'Cupid', 'XXVII'],
  [801, 'Triton', 'I'],
  [802, 'Nereid', 'II'],
  [803, 'Naiad', 'III'],
  [804, 'Thalassa', 'IV'],
  [805, 'Despina', 'V'],
  [806, 'Galatea', 'VI'],
  [807, 'Larissa', 'VII'],
  [808, 'Proteus', 'VIII'],
  [809, 'Halimede'],
  [810, 'Psamathe'],
  [811, 'Sao'],
  [812, 'Laomedeia', 'XII'],
  [813, 'Neso'],
  [814, 'Hippocamp'],
  [901, 'Charon', 'I'],
  [902, 'Nix', 'II'],
  [903, 'Hydra', 'III'],
  [904, 'Kerberos'],
  [905, 'Styx'],
];

/** Common other names, mostly French (accents and case are ignored when matching). */
const EXTRA_ALIASES: Record<number, readonly string[]> = {
  10: ['Sol', 'Soleil'],
  199: ['Mercure'],
  399: ['Terre', 'Terra'],
  699: ['Saturne'],
  999: ['Pluton', '134340 Pluto'],
  301: ['Luna', 'Lune', 'The Moon', "Earth's Moon"],
  502: ['Europe'],
  602: ['Encelade'],
  608: ['Japet'],
  802: ['Nereide'],
};

function moonEntry([naif, name, roman]: readonly [number, string, string?]): MajorBody {
  const parent = PARENT_BY_HUNDREDS[Math.floor(naif / 100)];
  const aliases = [...(EXTRA_ALIASES[naif] ?? [])];
  if (roman !== undefined && parent !== undefined) aliases.push(`${parent} ${roman}`);
  return { naif, name, type: 'moon', parent, aliases };
}

export const MAJOR_BODIES: readonly MajorBody[] = [
  { naif: 10, name: 'Sun', type: 'star', aliases: EXTRA_ALIASES[10]! },
  ...PLANETS.map(
    (p): MajorBody => ({
      naif: Number(p.code),
      name: p.name,
      type: p.name === 'Pluto' ? 'dwarf planet' : 'planet',
      aliases: EXTRA_ALIASES[Number(p.code)] ?? [],
    }),
  ),
  ...MOONS.map(moonEntry),
];

/** Lower case, no accents (Ganymède → ganymede, Phœbé → phoebe), single spaces, no leading "the". */
export function normalizeBodyName(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

const BY_NAME = new Map<string, MajorBody>();
for (const body of MAJOR_BODIES) {
  for (const key of [body.name, ...body.aliases]) {
    const k = normalizeBodyName(key);
    if (!BY_NAME.has(k)) BY_NAME.set(k, body);
  }
}

/** The planet, moon or Sun a typed name means (exact name or alias), or null. */
export function findMajorBody(text: string): MajorBody | null {
  const k = normalizeBodyName(text);
  if (k.length === 0) return null;
  return BY_NAME.get(k) ?? BY_NAME.get(k.replace(/\s*\((moon|planet)[^)]*\)$/, '')) ?? null;
}

/** Bodies whose name or an alias starts with the typed text (2+ letters), planets first. */
export function majorBodySuggestions(text: string, limit = 6): MajorBody[] {
  const k = normalizeBodyName(text);
  if (k.length < 2) return [];
  return MAJOR_BODIES.filter(
    (b) =>
      normalizeBodyName(b.name) !== k &&
      [b.name, ...b.aliases].some((n) => normalizeBodyName(n).startsWith(k)),
  ).slice(0, limit);
}

// --- Ids stored in history, pins and share links -----------------------------

const ID_PREFIX = 'jpl:';

/** `jpl:502` - kept apart from MPC designations (asteroid 502 is Sigune, not Europa). */
export function majorBodyId(body: MajorBody): string {
  return `${ID_PREFIX}${body.naif}`;
}

export function majorBodyFromId(id: string): MajorBody | null {
  if (!id.startsWith(ID_PREFIX)) return null;
  const naif = Number(id.slice(ID_PREFIX.length));
  return MAJOR_BODIES.find((b) => b.naif === naif) ?? null;
}

/** "Moon of Jupiter", "Planet", "Dwarf planet", "Star". */
export function describeMajorBody(body: MajorBody): string {
  switch (body.type) {
    case 'moon':
      return body.parent === undefined ? 'Moon' : `Moon of ${body.parent}`;
    case 'planet':
      return 'Planet';
    case 'dwarf planet':
      return 'Dwarf planet';
    case 'star':
      return 'Star';
  }
}

/** "moon of Jupiter" - describeMajorBody for the middle of a sentence. */
export function describeMajorBodyInline(body: MajorBody): string {
  const text = describeMajorBody(body);
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** The glyph shown next to it: the planet's own symbol, ☾ for a moon, ☉ for the Sun. */
export function majorBodySymbol(body: MajorBody): string {
  if (body.type === 'moon') return '☾\uFE0E'; // text style, not the yellow emoji
  if (body.type === 'star') return '☉';
  return PLANETS.find((p) => Number(p.code) === body.naif)?.emoji ?? '◯';
}

// --- Display of any tracked body ---------------------------------------------

/** The glyph for a track: ☄ / ◯ for small bodies, the body's own for a planet or moon. */
export function trackSymbol(track: { kind: TrackKind; mpcID: string }): string {
  if (track.kind === 'comet' || track.kind === 'asteroid') return KIND_EMOJI[track.kind];
  const body = majorBodyFromId(track.mpcID);
  return body === null ? '◯' : majorBodySymbol(body);
}

/** "Asteroid · MPC 52", "Comet · MPC 1P", or "Moon of Jupiter · JPL 502". */
export function trackDesignation(track: { kind: TrackKind; mpcID: string }): string {
  const body = majorBodyFromId(track.mpcID);
  if (body === null) return `${track.kind === 'comet' ? 'Comet' : 'Asteroid'} · MPC ${track.mpcID}`;
  return `${describeMajorBody(body)} · JPL ${body.naif}`;
}

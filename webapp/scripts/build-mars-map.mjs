#!/usr/bin/env node
/**
 * build-mars-map.mjs — regenere la seed map Mars depuis la blockchain WAX.
 *
 * Source de verite : collection `underpunks55`, template `848387` (up.deeds).
 * Chaque NFT = une case de la map de Mars. On lit :
 *   - data.zone   -> numero de case (1..576, ligne par ligne)
 *   - owner       -> wallet detenteur  => resolu en nom via public/catalog/wallets.json
 *   - data.title  -> nom de la zone (les "Unnamed NNN" retombent sur "Zone NNN")
 *   - data.tier   -> 2 (standard) / 3 (landmark)
 *   - role Rustwind Gen deduit du titre "Rustwind Generator ..."
 *
 * Le wallet `neftyblocksp` (escrow marketplace NeftyBlocks) est IGNORE comme
 * proprietaire : ces cases sont "On market" (en vente), pas possedees par un joueur.
 *
 * Effets :
 *   - ecrit  public/maps-seed/mars.map.json  (576 cases)
 *   - bumpe  public/maps-seed/manifest.json  contentVersion "0-seed-N" -> N+1
 *            (obligatoire : c'est le guard de reimport de la seed cote app)
 *   - imprime un resume + les wallets inconnus a ajouter dans wallets.json
 *
 * Usage : node scripts/build-mars-map.mjs   (Node 18+, fetch global)
 * Reutilisable tel quel a chaque mise a jour de la map.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const OUT_MAP = join(PUBLIC, 'maps-seed', 'mars.map.json');
const MANIFEST = join(PUBLIC, 'maps-seed', 'manifest.json');
const WALLETS = join(PUBLIC, 'catalog', 'wallets.json');

// --- Config on-chain --------------------------------------------------------
const COLLECTION = 'underpunks55';
const TEMPLATE_ID = '848387';
const API_HOSTS = [
  'https://wax.api.atomicassets.io',
  'https://aa.neftyblocks.com',
  'https://wax-atomic-api.eosphere.io',
  'https://api.wax-aa.bountyblok.io',
];
const IGNORE_OWNERS = new Set(['neftyblocksp']); // escrow marketplace = pas un proprietaire

// Wallets absents de wallets.json (a completer au fil de l'eau).
const WALLET_OVERRIDES = {
  'zigm4.gm': 'Zigm4', // = ZIGMA (toi), plus gros proprietaire, pas dans wallets.json
};

// --- Grille -----------------------------------------------------------------
const COLS = 24;
const ROWS = 24;
const TOTAL = COLS * ROWS; // 576

// --- Theme (rouille martienne) ---------------------------------------------
const THEME = {
  _comment: 'Mars: rouille martienne sur ciel sombre.',
  background: '#0A0503',
  surface: '#1C0E07',
  zoneFill: '#6E3A24',
  zoneStroke: '#C46A3A',
  zoneSelectedFill: '#E89A62',
  glow: '#FF8C50',
  label: '#FFEAD8',
  accent: '#FF7A3A',
  fontFamily: 'JetBrainsMono',
};

// Couleurs de bordure par faction connue (rappel de la legende du jeu). Match par
// token contenu dans le nom normalise ; les proprietaires inconnus recoivent une
// couleur deterministe (hash -> teinte). Ordre = specificite.
const FACTION_COLORS = [
  ['rojostormer', '#7A6AE0'],
  ['lasergeek', '#F0883A'],
  ['lalothen', '#45D6E8'],
  ['makerjay', '#3FA0B0'],
  ['anachron', '#A6B84A'],
  ['qukatt', '#F040A0'],
  ['siisii', '#B8C0C8'],
  ['cigale', '#9B6FE0'],
  ['pawan', '#B07A4A'],
  ['gainz', '#F04438'],
  ['horst', '#EAC24A'],
  ['zigma', '#4A7CF0'],
  ['zigm4', '#4A7CF0'],
  ['roxy', '#40C050'],
  ['greg', '#D060D0'],
  ['laser', '#F0883A'],
  ['maker', '#3FA0B0'],
  ['lalo', '#45D6E8'],
  ['crypto', '#C6E24A'],
  ['bb', '#2FC9B0'],
  // Comptes de jeu / NPC (rose comme la legende "NPC FACTIONS")
  ['lama', '#E0489A'],
  ['[gm]', '#E0489A'],
  ['underpunks', '#E0489A'],
];
// Roles/overlays : listes FIXES fournies par Jimmy (2026-07-23), PAS derivees.
// Le RENDU est fait par le moteur grille (gridRender) a partir des champs :
//  - Medical  -> croix rouge dessinee (pas de fill)
//  - Rustwind -> emoji eolienne (pas de fill)
//  - Railway  -> pointilles qui traversent la case (pas de fill)
//  - NPC      -> case ROSE (le seul overlay qui est un remplissage)
//  - Owner    -> bordure epaisse a la couleur du joueur
const MEDICAL_CELLS = new Set([101, 222, 321, 331, 360, 448]);
const RUSTWIND_CELLS = new Set([279, 328, 333, 349, 370, 422, 456, 462, 468, 479, 506]);
const NPC_CELLS = new Set([
  55, 209, 210, 211, 212, 233, 236, 257, 260, 281, 284, 294, 305, 306, 307, 308,
  322, 367, 420, 472, 473, 474, 496, 497, 498, 508, 509,
]);
const NPC_FILL = '#C0417F'; // rose NPC (remplissage)

// --- Great Martian Railway --------------------------------------------------
// Geographie FIXE de la map (PAS dans la donnee on-chain). Rendu = bande acier
// bleue sur les cases traversees, + filtre "Martian Railway".
// Cases fournies par Jimmy (2026-07-23). NB: le '445' de sa liste est interprete
// comme 345 (place entre 344 et 346 ; 445 serait isole ligne 19) - a confirmer.
// Tracé du train = ARETES explicites (paires de cases reliees), pas un simple
// ensemble : le rendu ne relie QUE ces segments (fini les faux barreaux 258-259 /
// 282-283). La boucle se ferme (282-306). Fourni par Jimmy (2026-07-23).
const RAILWAY_EDGES = [
  [294, 318], [318, 319], [319, 320], [320, 344], [344, 345], [345, 346],
  [346, 322], [322, 323], [323, 299], [299, 300], [300, 301], [301, 302],
  [302, 303], [303, 304], [304, 305], [305, 306], [306, 307], [307, 283],
  [283, 259], [259, 235], [235, 234], [234, 258], [258, 282], [282, 306],
];
const RAILWAY_CELLS = new Set(RAILWAY_EDGES.flat());
const RAILWAY_LINKS = new Map(); // cellNum -> Set des cases reliees
for (const [a, b] of RAILWAY_EDGES) {
  if (!RAILWAY_LINKS.has(a)) RAILWAY_LINKS.set(a, new Set());
  if (!RAILWAY_LINKS.has(b)) RAILWAY_LINKS.set(b, new Set());
  RAILWAY_LINKS.get(a).add(b);
  RAILWAY_LINKS.get(b).add(a);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function ownerColor(name) {
  const norm = name.toLowerCase();
  for (const [token, hex] of FACTION_COLORS) {
    if (norm.includes(token)) return hex;
  }
  // hash deterministe -> teinte
  let h = 0;
  for (let i = 0; i < norm.length; i++) h = (h * 31 + norm.charCodeAt(i)) % 360;
  return hslToHex(h, 62, 60);
}

// --- Fetch on-chain (pagination + fallback d'hotes) -------------------------
async function fetchAllAssets() {
  let lastErr;
  for (const host of API_HOSTS) {
    try {
      const all = [];
      for (let page = 1; ; page++) {
        const url = `${host}/atomicassets/v1/assets?collection_name=${COLLECTION}` +
          `&template_id=${TEMPLATE_ID}&page=${page}&limit=1000&order=asc&sort=asset_id`;
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${host}`);
        const body = await res.json();
        if (!body.success) throw new Error(`API error @ ${host}`);
        all.push(...body.data);
        if (body.data.length < 1000) break;
      }
      console.log(`[on-chain] ${all.length} deeds via ${host}`);
      return all;
    } catch (e) {
      console.warn(`[on-chain] echec ${host}: ${e.message}`);
      lastErr = e;
    }
  }
  throw new Error(`tous les hotes AtomicAssets ont echoue: ${lastErr?.message}`);
}

// Annonces marketplace REELLES (AtomicMarket, ventes actives state=1). Renvoie le
// Set des n° de zone reellement en vente (rien a voir avec le pool neftyblocksp).
async function fetchMarketZones() {
  for (const host of API_HOSTS) {
    try {
      const zones = new Set();
      for (let page = 1; ; page++) {
        const url = `${host}/atomicmarket/v1/sales?collection_name=${COLLECTION}` +
          `&template_id=${TEMPLATE_ID}&state=1&page=${page}&limit=100`;
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!body.success) throw new Error('API error');
        for (const sale of body.data) {
          for (const asset of sale.assets ?? []) {
            const z = Number.parseInt(asset.data?.zone, 10);
            if (Number.isInteger(z)) zones.add(z);
          }
        }
        if (body.data.length < 100) break;
      }
      console.log(`[market] ${zones.size} annonces actives via ${host}`);
      return zones;
    } catch (e) {
      console.warn(`[market] echec ${host}: ${e.message}`);
    }
  }
  console.warn('[market] aucune annonce recuperee -> 0');
  return new Set();
}

// --- wallet -> nom ----------------------------------------------------------
function loadWalletMap() {
  const list = JSON.parse(readFileSync(WALLETS, 'utf-8'));
  const map = new Map();
  for (const it of list) {
    const name = it.display_name || it.discord_username;
    for (const w of it.wallets || []) if (name) map.set(w, name);
  }
  for (const [w, n] of Object.entries(WALLET_OVERRIDES)) map.set(w, n);
  return map;
}

function isNamed(title) {
  return title && title.trim() && !/^unnamed\b/i.test(title.trim());
}

// --- Build ------------------------------------------------------------------
async function main() {
  const [assets, marketZones, walletMap] =
    [await fetchAllAssets(), await fetchMarketZones(), loadWalletMap()];

  // zone -> asset (le plus recent gagne en cas d'improbable doublon)
  const byZone = new Map();
  for (const a of assets) {
    const z = Number.parseInt(a.data?.zone, 10);
    if (Number.isInteger(z) && z >= 1 && z <= TOTAL) byZone.set(z, a);
  }

  const unknownWallets = new Map(); // wallet -> nb zones
  const ownerCounts = new Map();    // nom -> nb zones (proprietaires reels)
  let owned = 0, named = 0, railwayCount = 0, medicalCount = 0, rustwindCount = 0;
  let npcCount = 0, marketCount = 0, poolCount = 0;

  const zones = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = row * COLS + col + 1;
      const a = byZone.get(cell);
      const fields = { coordinates: `row ${row + 1} · col ${col + 1}` };
      const override = {};
      let name = `Zone ${String(cell).padStart(3, '0')}`;

      if (a) {
        const title = a.data?.title ?? '';
        const tier = String(a.data?.tier ?? '');
        if (isNamed(title)) { name = title; named++; }
        if (tier) fields.tier = tier;

        // proprietaire = bordure (zoneStroke). neftyblocksp = pool non reclame (ignore).
        const wallet = a.owner;
        if (IGNORE_OWNERS.has(wallet)) {
          poolCount++;
        } else {
          const resolved = walletMap.get(wallet);
          const label = resolved ?? wallet;
          fields.owner = label;
          override.zoneStroke = ownerColor(label);
          owned++;
          ownerCounts.set(label, (ownerCounts.get(label) ?? 0) + 1);
          if (!resolved) unknownWallets.set(wallet, (unknownWallets.get(wallet) ?? 0) + 1);
        }

        const desc = (a.data?.description ?? '').trim();
        if (desc) fields.description = desc;
      }

      // Annonce marketplace REELLE (source = AtomicMarket, PAS le pool neftyblocksp).
      if (marketZones.has(cell)) { fields.market = 'On market'; marketCount++; }

      // Railway : rendu en pointilles cote moteur (pas de fill). Le champ porte les
      // cases reliees (`railwayLinks`) pour que le moteur trace le tracE exact.
      if (RAILWAY_CELLS.has(cell)) {
        fields.railway = 'On line';
        fields.railwayLinks = [...RAILWAY_LINKS.get(cell)];
        railwayCount++;
      }

      // Roles. NPC = case rose (fill). Medical/Rustwind = icone cote moteur (pas de
      // fill). Le proprietaire reste la bordure. Listes sans recouvrement.
      if (NPC_CELLS.has(cell)) {
        fields.role = 'NPC Faction';
        override.zoneFill = NPC_FILL;
        npcCount++;
      } else if (MEDICAL_CELLS.has(cell)) {
        fields.role = 'Medical Facility';
        medicalCount++;
      } else if (RUSTWIND_CELLS.has(cell)) {
        fields.role = 'Rustwind Gen';
        rustwindCount++;
      }

      const zone = { id: `z${cell}`, name, cellNum: cell, gridPos: [col, row], fields };
      if (Object.keys(override).length) zone.themeOverride = override;
      zones.push(zone);
    }
  }

  // owner enum (chips de filtre) : proprietaires les plus presents, cap 20
  const ownerOptions = [...ownerCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([n]) => n);

  const doc = {
    _comment: 'SEED DATA Mars: 24x24=576 cases. GENERE depuis WAX (underpunks55 / template 848387) ' +
      'par scripts/build-mars-map.mjs. owner=wallet via wallets.json (neftyblocksp=pool non reclame). ' +
      'market=annonces AtomicMarket reelles. railway/medical/rustwind/npc = overlays rendus par gridRender. ' +
      'Ne pas editer a la main : relancer le script.',
    schemaVersion: 1,
    id: 'mars',
    type: 'sphere',
    sphere: { textureAsset: 'texture', initialOrientation: { lat: 0.0, lon: 0.0 }, autoRotateDegPerSec: 1.2 },
    grid: { cols: COLS, rows: ROWS },
    theme: THEME,
    fieldsSchema: [
      { key: 'owner', label: 'Owner', type: 'enum', options: ownerOptions, style: 'badge', searchable: true, filterable: true },
      { key: 'role', label: 'Role', type: 'enum', options: ['Medical Facility', 'NPC Faction', 'Rustwind Gen'], style: 'badge', searchable: true, filterable: true },
      { key: 'railway', label: 'Martian Railway', type: 'enum', options: ['On line'], style: 'badge', searchable: true, filterable: true },
      // Marketplace : UNIQUEMENT les annonces reelles AtomicMarket (state=1).
      { key: 'market', label: 'Market', type: 'enum', options: ['On market'], style: 'badge', searchable: false, filterable: true },
      // Tier: info seulement (badge fiche), NON filtrable.
      { key: 'tier', label: 'Tier', type: 'enum', options: ['2', '3'], style: 'badge', searchable: false, filterable: false },
      { key: 'coordinates', label: 'Coordinates', type: 'text', searchable: false, filterable: false },
      { key: 'description', label: 'Deed log', type: 'longText', searchable: true, filterable: false },
    ],
    zones,
  };

  writeFileSync(OUT_MAP, JSON.stringify(doc, null, 1) + '\n', 'utf-8');

  // bump manifest.contentVersion "0-seed-N" -> N+1 (guard de reimport)
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
  const prev = manifest.contentVersion;
  manifest.contentVersion = prev.replace(/(\d+)$/, (m) => String(Number(m) + 1));
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  // --- resume ---------------------------------------------------------------
  console.log(`\n[mars.map.json] ${zones.length} cases | ${owned} possedees | ${poolCount} pool (neftyblocksp) | ` +
    `${marketCount} en vente (AtomicMarket) | ${TOTAL - byZone.size} non mintees`);
  console.log(`[overlays] Medical: ${medicalCount} | Rustwind: ${rustwindCount} | NPC: ${npcCount} | railway: ${railwayCount} | nommees: ${named}`);
  console.log(`[owners] ${ownerCounts.size} distincts. Top:`);
  for (const [n, c] of [...ownerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`   ${String(c).padStart(3)}  ${n}`);
  }
  console.log(`[manifest] contentVersion ${prev} -> ${manifest.contentVersion}`);
  if (unknownWallets.size) {
    console.log(`\n[!] wallets inconnus de wallets.json (nom = wallet brut, a completer) :`);
    for (const [w, c] of [...unknownWallets.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${w}  (${c} zone${c > 1 ? 's' : ''})`);
    }
    console.log(`    -> ajouter dans WALLET_OVERRIDES ou dans public/catalog/wallets.json.`);
  }
  console.log(`\nRAPPEL: bumper webapp/src/core/version.ts (patch) puis commit + push (=> deploy prod).`);
}

main().catch((e) => { console.error('ECHEC:', e.message); process.exit(1); });

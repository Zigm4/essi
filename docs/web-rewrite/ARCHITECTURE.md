# Underdeck Web — Architecture (draft v1)

## Objectifs
- Réécriture from scratch (pas de Flutter web) de l'app Underdeck en webapp statique.
- Fidélité visuelle maximale au design system Flutter (dark sci-fi terminal, tokens exacts).
- Hébergement : GitHub Pages (site statique, repo public, compte Zigm4).
- Persistance 100% locale : IndexedDB (Dexie) + localStorage. Aucune donnée serveur.
- API JPL (Horizons, SBDB) : live via le Cloudflare Worker personnel de l'utilisateur
  (`worker/` — décision utilisateur du 2026-07-11). URL configurable :
  `VITE_JPL_PROXY_URL` au build + override runtime dans Settings (localStorage).
- Import/export JSON **compatible avec l'app mobile** (même schéma versionné,
  mêmes règles de merge) pour migrer les données du téléphone.
- Outil Wallet porté AVEC wallets.json embarqué (décision utilisateur, risque RGPD assumé).
- Alertes/notifications OS : non portées (concédé par l'utilisateur). Remplacées par
  compteurs/badges in-app + Notification API best-effort si onglet ouvert.

## Stack
| Brique | Choix | Raison |
|---|---|---|
| Build | Vite 6 + TypeScript 5 | statique, rapide, standard |
| UI | React 18 | écosystème, maintenance |
| Routing | react-router (HashRouter) | GitHub Pages sans 404 hack |
| State | zustand + hooks | équivalent léger de Riverpod |
| DB | Dexie 4 (IndexedDB) | miroir des tables Drift |
| Markdown | react-markdown + remark-gfm | KB + captures |
| Tests | vitest | formules, parsers, export |
| PWA | vite-plugin-pwa | installable, offline shell |
| Fonts | Inter / JetBrainsMono / Quicksand (OFL, self-hosted woff2) | identiques à l'app |

## Arborescence (webapp/)
src/
  app/            → router, shell, ESSI banner, nav
  core/           → fetch wrappers, erreurs, dates relatives, liens
  data/           → db.ts (Dexie), import/export, settings (localStorage)
  design-system/  → tokens.css, composants (InfoCard, GlassCard, NeonButton,
                    Scanlines, HexGrid, Particles, TerminalNotes, sheets, chips…)
  features/       → boot, onboarding, menu, knowledge(+maps), search, favorites,
                    hangar, captures, tools/{scan,celestial,tracker,history,jobs,
                    fishing,train,wallet,asteroid}
public/           → fonts, catalog JSON, knowledge content, maps seed, icons

## Réseau
- `jplFetch(path, params)` → `${proxyBase}${path}?${qs}` ; erreurs taxonomisées
  (offline / http / cancelled / unparseable / api-message) comme l'app mobile.
- Contenu maps : raw.githubusercontent + jsDelivr (CORS natif, appels directs).
- Timeouts + retry borné identiques à app_dio.

## Données (finalisé après spec data-layer)
- Dexie db `underdeck`, tables = miroir Drift (hangar, captures, tags, favorites,
  scan history, maps cache, …).
- localStorage : clés settings préfixées `underdeck.` (mapping des clés SharedPreferences).
- Export : Blob download JSON (schéma mobile) ; Import : file input + merge newer-wins
  corrigé (fallback epoch — bug E5 de l'audit à NE PAS reproduire).

## Bugs de l'audit à ne pas reproduire (extraits)
- E1 : export annulé ≠ backup réel.
- E5 : date illisible → epoch (pas `now`) sur le chemin update.
- R4 : allowlist de schémas {http, https, mailto} sur tout lien externe.
- R7 : grandes images → decoding contraint / lazy.
- F9/F10/F15/F18/F47 : déjà corrigés dans les clients — reporter les correctifs.

## Déploiement
- Repo : underdeck-app (existant, branche `webapp` → merge main), dossier webapp/.
- GH Actions : build Vite + deploy Pages (base `/underdeck-app/` ou custom).
- CI : vitest + tsc --noEmit + eslint.

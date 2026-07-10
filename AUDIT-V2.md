# Audit technique v2 — Underdeck

> **Date** : 10 juillet 2026 · **Base** : HEAD `d74ff66` (post-remédiations P0→P3 de l'audit v1, cf. [AUDIT.md](AUDIT.md)) · **Gate au moment de l'audit** : `flutter analyze` propre, **78/78 tests verts** (re-vérifié pendant l'audit) · 140 fichiers Dart, 38 263 lignes (dont 8 654 générées).
>
> **Méthode** : audit multi-agents indépendant — 4 auditeurs code (dette résiduelle, parité iOS/Android, cartographie KB, chasse aux bugs « yeux frais » sur les modules récents), 4 chercheurs web (sources 2025-2026 citées : rendu 3D, GitHub-as-CMS, maps 2D, stacks), 1 architecte (module maps), 1 critique adversarial de la conception. Chaque constat : **constat → preuve (fichier:ligne) → impact → recommandation**. Les hypothèses non prouvées sont marquées comme telles.

---

## 1. Résumé exécutif (TL;DR)

1. **État de santé global : bon et nettement au-dessus de la moyenne d'un projet solo.** L'architecture feature-first est cohérente, le design system est réellement réutilisé, la couche réseau (timeouts + retry borné), les migrations Drift testées, l'import/export transactionnel et 78 tests verts sont des acquis solides. Rien n'est « à refaire ».
2. **Un seul 🔴 bloquant, et il est légal, pas technique** : `assets/catalog/wallets.json` embarque toujours **769 identités Discord → adresses de wallets crypto** dans chaque binaire (RGPD, dé-anonymisation, dev basé UE). À traiter avant toute release publique — et le futur dépôt de contenu GitHub est précisément la bonne porte de sortie.
3. **La promesse de parité iOS/Android tient sur l'UI (~95 % identique) mais PAS sur trois axes opérationnels** : fiabilité des alertes Mars Express (Android peut livrer en retard sans le dire ; iOS jette silencieusement au-delà de 64 notifications pendantes ; le build release iOS dépend d'une capability App ID non activée), la promesse « backup visible dans Files » est **fausse sur les deux OS** pour des raisons différentes, et l'audience (iOS 18 + iPhone-only vs Android 7.0 + tablettes) n'est pas le même droit d'entrée.
4. **Les modules récents contiennent 2 bugs 🟠 prouvés** : un partage d'export **annulé** compte quand même comme sauvegarde (le rappel se tait 30 jours sans backup réel), et une **course** `refresh()`↔`arm()/cancel()` sur les alertes multi-zones peut ressusciter des alertes annulées ou perdre des zones armées.
5. **Avant le chantier maps, 4 prérequis** : allowlist de schémas sur `launchUrl` (du contenu importable peut déclencher `tel:`/`sms:` aujourd'hui), migration hors de `flutter_markdown` (discontinué upstream), plafonnement du décodage d'images (PNG 4086×4086 décodé plein format = OOM Android réaliste), et une CI + crash reporting (aujourd'hui : zéro CI, zéro télémétrie, et **le dépôt n'existe que sur cette machine — aucun remote**).
6. **Module maps dynamiques : faisable, architecture complète fournie (§4), verdict du critique : « adopter avec amendements ».** Patron retenu : dépôt GitHub public + pointeur mutable minuscule (GitHub Pages) + contenu épinglé par tag via jsDelivr + chaîne d'intégrité sha256 **+ signature ed25519 obligatoire dès le MVP** (sans elle, les checksums sont du théâtre face à une compromission du dépôt).
7. **Rendu 2D : natif Flutter sans hésitation** (`InteractiveViewer` + `CustomPaint` + hit-testing maison ; aucun package « image map » n'est production-grade en 2026, flutter_map est le fallback documenté). **Rendu 3D : le vrai point délicat** — le 3D natif Flutter first-party n'est PAS livrable en 2026 (`flutter_scene` = preview sur channel master). Deux voies crédibles : globe orthographique pseudo-3D pur Dart (Plan A, ~3-4 sem, zéro dépendance risquée, golden-testable) ou WebView + globe.gl/three.js **bundlés** (Plan B, ~1,5-2 sem, picking intégré). Spike de 3 jours recommandé pour trancher.
8. **Stack : rester sur Flutter. Ne pas migrer.** Verdict pondéré 8,4-8,5/10 pour Flutter(+WebView éventuel) contre 5,4 (KMP), 5,8 (RN), 4,5 (bi-natif). La seule vraie faiblesse Flutter (3D first-party) se contourne pour ce besoin précis ; une migration = 6-12 mois de réécriture solo pour au mieux retrouver l'existant. Le contenu GitHub est de la **donnée, pas du code** : conforme App Store 2.5.2/4.7 sur toutes les stacks.
9. **Décisions structurantes à prendre** (§8) : sort des wallets (retrait/consentement/distant), plancher iOS (18 → 15/16 ?), politique de langue (EN-only assumé ou infra l10n maintenant — le contenu de maps schema-driven va aggraver le coût), opt-in réseau du module maps et divulgation (« transparence = la marque »), et qui détient la clé de signature du contenu.
10. **Effort réaliste jusqu'à « maps v1 en prod »** : ~1 semaine de quick wins + ~2-3 semaines de refactors préalables + ~8-10 semaines pour le module (M0→M4). Le plan séquencé est en §7.

---

## 2. Tableau des problèmes priorisés

IDs : `R*` = dette résiduelle, `P*` = parité, `E*` = modules récents (yeux frais). Effort : S < 1 j · M = 1-5 j · L > 1 sem.

| ID | Sévérité | Catégorie | Fichier / emplacement | Problème | Recommandation | Effort |
|----|----------|-----------|----------------------|----------|----------------|--------|
| R1 | 🔴 | RGPD / légal | `assets/catalog/wallets.json` + `wallet_lookup_view.dart:75` | 769 identités Discord→wallets crypto embarquées dans chaque binaire, sans base légale ni mécanisme de retrait | Retirer du bundle ; distribution distante opt-in avec consentement (le dépôt de contenu §4 est la porte de sortie) | M |
| P1 | 🟠 | Véracité / perte de données | `settings_view.dart:159` + `data_export.dart:160` + `ios/Runner/Info.plist` | « Auto-backup … reachable from Files » est **faux sur les 2 OS** (iOS : clés plist absentes ; Android : dossier privé invisible) → backups détruits à la désinstallation | iOS : `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` ; Android : SAF/MediaStore ; à défaut corriger le wording | S (iOS) / M (Android) |
| E1 | 🟠 | Correctness | `data_export.dart:234` + `backup_reminder_banner.dart:43` + `settings_view.dart:113` | Un partage d'export **annulé** appelle quand même `markBackedUp()` → rappel muet 30 j sans backup | Retourner `ShareResult` et ne marquer que sur `status == success` | S |
| E2 | 🟠 | Race condition | `notifications.dart:425-471` + `mars_express_view.dart:37-42` | `refresh()` non attendu (toutes les 5 s) écrase `state` entier → zones armées perdues, alertes annulées ressuscitées | Sérialiser arm/cancel/refresh (mutex) + merge sur l'état courant au commit | M |
| P4 | 🟠 | Release-blocker iOS | `Runner.entitlements` + pbxproj:492/682/712 | Entitlement time-sensitive référencé mais capability App ID non activée → signature manuelle/CI **échoue** ; sans lui, Focus avale les alertes iOS | Activer la capability sur l'App ID avant release (documenté dans `docs/MIGRATION.md`) | S (portail) |
| P2/E6 | 🟠 | Parité / fiabilité | `mars_express_models.dart:238-251` | 1 zone répétitive = 18 notifs pendantes ; **iOS plafonne à 64** → dès 4 zones répétitives, pertes silencieuses (Android livre tout) | Budget global ≤ 60 trié par proximité + refus/avertissement à l'armement | M |
| P3 | 🟠 | Parité / honnêteté | `notifications.dart:95-133` + copy `mars_express_view.dart:583` | Fallback inexact Android silencieux : « 2 min before » peut arriver après le train (dérive Doze ~15 min), l'UI ne le dit jamais | Badge « timing approximatif » quand `canScheduleExactNotifications()==false` + lien réglages | S |
| R2/P6 | 🟠 | Distribution | `ios/Podfile:1`, pbxproj ×3, `TARGETED_DEVICE_FAMILY=1` | Plancher iOS 18.0 injustifié + iPhone-only vs Android minSdk 24 + tablettes : audience asymétrique | Abaisser à 15/16 (4 emplacements) + trancher iPad ; décision produit documentée | S |
| R3 | 🟠 | Dépendances | `pubspec.yaml:29` + 3 vues markdown | `flutter_markdown` 0.7.x **discontinué upstream** ; le chantier maps va s'appuyer sur du markdown au moment où le paquet meurt | Migrer vers `flutter_markdown_plus` (fork drop-in) AVANT le module maps | M |
| R4 | 🟠 | Sécurité | `markdown_view.dart:17-21`, `kb_markdown_view.dart:17-21`, `link_detail_view.dart:92` | Tout schéma URI lancé depuis du contenu **importable** (exports partagés entre joueurs) : `tel:`, `sms:`, schémas custom | Helper unique `launchExternal(uri)` avec allowlist `{http, https, mailto}` (~20 lignes) | S |
| R5 | 🟠 | Ops | `.github/` absent, `logging.dart:9-13`, **aucun remote git** | Zéro CI, zéro crash reporting, dépôt sur une seule machine | Remote + GH Actions `analyze&&test` (30 min) + Sentry branché dans `logError`/`onError` | S/M |
| P5 | 🟠 | Parité UI | `main.dart:50-55` | `statusBarBrightness` (clé iOS) absent → heure/batterie potentiellement invisibles sur les écrans sans AppBar en mode clair iOS *(hypothèse mécanique solide, à confirmer device)* | Ajouter `statusBarBrightness: Brightness.dark` au style global | S |
| R7/P7 | 🟡 | Perf / mémoire | `kb_markdown_view.dart:26-30` + `assets/knowledge/images/` | `space-station-map.png` **4086×4086** (~67 Mo décodé) sans `cacheWidth` ; `Image.network` sans `errorBuilder` → OOM Android réaliste, crash asymétrique | `cacheWidth` (largeur écran × dPR) + `errorBuilder` ; downscale des assets ; **prérequis du module maps** | S |
| E4 | 🟡 | Correctness/UX | `notifications.dart:328,366-375` + `mars_express_view.dart:432,457` | `arm()` détruit le slot puis échoue en silence (skip < 2 s, `now` périmé de 5 s) → état « armé » fantôme + message accusant les permissions | `DateTime.now()` réel ; rollback/retrait d'entrée en échec ; messages différenciés | S-M |
| E5 | 🟡 | Entrée hostile | `data_export.dart:295,368,404,470,712` | Date illisible → fallback `now` → *newer-wins* : un fichier forgé/abîmé **écrase toujours** le contenu local plus récent | Fallback « epoch » (perd) sur le chemin update ; `now` réservé au `createdAt` d'insertion | S |
| E3 | 🟡 | Provider lifecycle | `next_arrival_provider.dart:169-178` | `Provider` mémoïsé vendu comme « countdown frais » — gèlerait la future Live Activity (code mort aujourd'hui : 0 consommateur) | Fonction pure avec `now` explicite ou autoDispose+timer, avant tout branchement du bridge | S |
| R6 | 🟡 | Privacy locale | `data_export.dart:152-158,230` | Exports JSON en clair accumulés dans le tmp, jamais supprimés après partage (les PNG, eux, s'écrasent — bornés) | Nom stable (écrasement) ou sweep au boot + delete best-effort post-share | S |
| R8 | 🟡 | Perf | `page_scroll_view.dart:93-97` + `hangar_list_view.dart:109-140` | Scroll single-child non virtualisé (22 vues) — sensible sur le hangar (N vaisseaux) | Variante `PageScrollView.slivers` ; migrer hangar en priorité | M |
| R9 | 🟡 | Perf | `captures_repository.dart:134-156` + `jobs_repository.dart:20-21` | `pruneOrphanTags` = 3 COUNT/tag après **chaque** save ; jobs.json 337 Ko décodé sur l'isolate UI | DELETE unique `NOT IN (SELECT … UNION …)` ; `compute(_parseJobs, raw)` | S |
| R10 | 🟡 | i18n | `lib/**` (~500-800 chaînes) | Anglais en dur, zéro infra l10n ; le contenu maps schema-driven va aggraver le coût | Décision produit explicite : EN-only documenté OU infra ARB posée maintenant | L |
| R11 | 🟡 | Maintenabilité | `ship_editor_view.dart` (1171), `celestial_view.dart` (931), `jobs_filter_sheet.dart` (846), `info_card.dart` (636)… | God files restants (celestial a pourtant déjà son contrôleur extrait) | Extraction mécanique en fichiers (pickers/sheets/widgets déjà en classes séparées) | M |
| R12 | 🟡 | Tests | `horizons_client.dart:65-133`, `tracker_client.dart:80-147`, `asteroid_models.dart:167+` | Le code le plus fragile (parsing texte JPL, ladder de résolution, HTTP 300) est le non-testé | Golden tests parser (payloads réels : nominal, SERVER BUSY, tronqué) + Dio mocké | M |
| P8 | 🟡 | Parité UI | `celestial_view.dart:182-207` | Seule bifurcation `Platform.isIOS` de l'app : Cupertino spinner vs calendrier Material (UX réellement différente depuis 1800) | Trancher et documenter : unifier ou assumer l'exception idiomatique | S |
| P9 | 🟡 | Cohérence UI | `mars_express_view.dart:590` vs 3 `Switch` Material | 1 switch adaptive vs 3 Material : deux styles coexistent sur iOS | Une seule famille partout (Material thémé) | S |
| P10 | 🟡 | Parité UX | manifest Android | Predictive back Android 14+ non activé (`enableOnBackInvokedCallback` absent) ; les PopScope v2 sont pourtant prêts | Ajouter le flag + vérifier les 3 gardes d'éditeur sur device | S |
| P11 | 🟡 | Permissions | `ios/Runner/Info.plist` | `NSCameraUsageDescription` déclaré sans aucun usage caméra (seul `pickMultiImage` est utilisé) | Supprimer la clé (et évaluer la clé photo, PHPicker ne l'exige plus) | S |
| E7 | 🔵 | Logique | `backup_controller.dart:40-45` | Seuil d'auto-backup atteint pendant un export → lot de 20 changements avalé | Ne pas reset si `_running` / flag `pending` | S |
| E8 | 🔵 | Entrée hostile | `data_export.dart:282-285,674-695` | 1 tag mal typé = tout le fichier rejeté (incohérent avec les historiques skippés ligne à ligne) ; `entityType` favorites non whitelisté | try/skip par ligne partout ; whitelist `FavoriteKind` + bornes | S-M |
| E9 | 🔵 | Migration *(hypothèse)* | `notifications.dart` (absence) | Ids de notifications pré-P2 (`70000+zone*10+i`) hors bande → jamais annulables pour les testeurs de l'époque | Cleanup one-shot au premier lancement | S |
| E10 | 🔵 | Filesystem | `data_export.dart:146-150` | Timestamp à la seconde : 2 exports dans la même seconde s'écrasent | Suffixe ms ou compteur | S |
| E11 | 🔵 | Context/async | `history_sheet.dart:189,238` | `ref` utilisé après `await showDialog` sans garde | Garde `context.mounted` | S |
| R13 | 🔵 | Correctness latente | `notifications.dart:23,72` | `tz.local` = UTC (bénin : scheduling en instants absolus) — piège si un jour `matchDateTimeComponents` | `flutter_timezone` + `setLocalLocation`, ou commentaire-garde | S |
| R14 | 🔵 | Précision | `horizons_client.dart:83,119` | Timestamps TDB étiquetés UTC (~69 s d'écart) — cosmétique au niveau « SL » du jeu | Documenter l'offset | S |
| R15 | 🔵 | Observabilité | `kb_loader.dart:42-46` | Catch d'article manquant sans `logError` (le placeholder visible existe) | Ajouter `logError` | S |
| R16 | 🔵 | Hygiène | `data_export.dart:298-299`, `pubspec.yaml:36`, `tracker_client.dart:13` | Dead code `dedupeId` ; `google_fonts` shippé pour se désactiver lui-même ; fallback `?? Dio()` contournant timeouts/retry | Supprimer / supprimer / rendre `dio` requis | S |
| P12-15 | 🔵 | Divers parité | `main.dart:53`, `values/styles.xml`, transitions/scroll adaptatifs | `systemNavigationBarColor` no-op moderne ; `NormalTheme` clair derrière app sombre ; transitions idiomatiques par OS | Nettoyage + fond sombre forcé + documenter les exceptions assumées | S |
| ⚪ | Info | Positif | — | Réseau (Dio partagé + retry CancelToken-safe, HTTP 300 SBDB, erreurs JPL surfacées), transactions + migrations v1→v3 testées, remap de tags à l'import, ladder exact→inexact, fonts bundlées, R8/GSON, `sharePositionOrigin` ×11, splash aligné au pixel, PopScope v2, onboarding kill-safe, pas de boucle d'auto-backup (vérifié) | **À préserver dans tous les refactors** | — |

---

## 3. Analyse détaillée par catégorie

### 3.1 Bugs et fiabilité

Le gros des bugs de l'audit v1 (74 constats) a été corrigé et vérifié par tests. La chasse « yeux frais » sur les modules récents (favoris, onboarding, backup, alertes multi-zones, historiques) n'a trouvé **aucun 🔴**, mais 2 🟠 prouvés et une grappe de 🟡 :

- **E1 — le backup fantôme.** `shareExport()` jette le `ShareResult` (`data_export.dart:234`) et les deux appelants marquent `markBackedUp()` inconditionnellement. Scénario : l'utilisateur tape « Export now », **annule** la share sheet → `lastBackupAt` est posé, la bannière se tait 30 jours, aucun backup n'existe. Correction :
  ```dart
  // data_export.dart
  Future<ShareResult> shareExport({Rect? sharePositionOrigin}) async { …; return SharePlus.instance.share(…); }
  // appelants
  final result = await exportService.shareExport(sharePositionOrigin: origin);
  if (result.status == ShareResultStatus.success) await notifier.markBackedUp();
  ```
- **E2 — la course des alertes.** `refresh()` (tické toutes les 5 s, non attendu) itère une copie de `state.zones` à travers ~20 `await` platform-channel puis **écrase** `state` entier (`notifications.dart:469-471`). Pendant un top-up : un `cancelZone` concurrent est ressuscité ; un `arm` concurrent est perdu de l'état (notifications orphelines, slot réputé libre). Correctif : sérialiser les quatre opérations (chaînage de `Future` ou flag de réentrance) et **merger** sur l'état courant au commit au lieu de remplacer.
- **E4/E5** : voir tableau — l'armement à quelques secondes d'une arrivée détruit puis ment ; une date d'import illisible « gagne » toujours le newer-wins.
- **Cycle de vie** : la discipline `mounted`/gardes de génération posée en P1 est globalement respectée ; restent E11 (deux `ref` après `await showDialog`) et E3 (provider mémoïsé au contrat mensonger — code mort aujourd'hui, à corriger avant le bridge Live Activity).
- **⚪ vérifiés et à préserver** : pas de boucle d'auto-backup (l'export n'écrit ni en DB ni via `tableUpdates()` ; `lastBackupAt` vit en SharedPreferences — **ne jamais le déplacer en DB**) ; chaîne de migration v1→v2→v3 rejouée sur schéma v1 réel ; migration prefs single-zone→multi-zone compatible en ids (slot 0 recouvre les ids legacy 70000-70002) ; onboarding kill-safe (flag écrit à la fin, re-route au boot).

### 3.2 Bonnes pratiques Dart / Flutter

- **Acquis** : `flutter_lints` + **riverpod_lint/custom_lint actifs** + `strict-casts` (posés en P2), analyze propre, immutabilité largement respectée, erreurs typées `sealed` par feature, `const` discipliné.
- **Restes** : R16 — dead code `dedupeId` (`data_export.dart:298`), `google_fonts` shippé uniquement pour `allowRuntimeFetching = false` (supprimable, les licences OFL sont déjà enregistrées manuellement dans `main.dart:39-46`), constructeurs clients `({Dio? dio}) : _dio = dio ?? Dio()` dont le fallback nu contourne timeouts+retry (bénin car les providers injectent `appDioProvider`, mais piège — rendre `dio` requis).
- **P9** : mélange `SwitchListTile.adaptive` (1×) / `Switch` Material (3×) — choisir une famille.

### 3.3 Architecture et structure du projet

- **Verdict : saine, feature-first cohérente** (`features/<x>/{data,domain,state,views,widgets}`), séparation UI/logique respectée là où les contrôleurs existent (scan, tracker, celestial depuis P2, jobs), `core/` (réseau, logging, erreurs, version) et `services/` transverses bien découpés. La couche générique `tools/history/` (posée en P2) a effectivement tué la triplication.
- **Sens des dépendances globalement bon**, une exception héritée : le design system importe `services/app_settings.dart` et `services/haptics.dart` (composants inutilisables sans les providers de l'app) — acceptable pour une app mono-produit, à savoir si extraction en package un jour.
- **Testabilité** : DI par providers Riverpod partout, `AppDatabase.forTesting` exploité par 5 suites — bonne base.

### 3.4 Répartition du code entre fichiers

God files restants (wc -l vérifiés) : `ship_editor_view.dart` **1171**, `celestial_view.dart` **931** (le contrôleur est extrait, la vue reste énorme), `evil_ship_intro.dart` 877, `jobs_filter_sheet.dart` 846 (déjà décomposé en 10 widgets privés — le moins urgent), `jobs_view.dart` 834, `data_export.dart` 798, `info_card.dart` 636 (bibliothèque de 10 widgets sans dépendances croisées — split mécanique).

**Plan de réorganisation cible (risque faible, pur déplacement — analyze/tests couvrent) :**
```
AVANT                                   APRÈS
hangar/views/ship_editor_view.dart      hangar/views/ship_editor/ship_editor_view.dart (~400)
  (1 fichier, 1171 lignes)                ├─ widgets/model_picker.dart, location_picker.dart
                                          ├─ widgets/role_fields.dart, prefix_number_field.dart
                                          └─ state/ship_editor_form.dart (état + validation, testable)
design_system/components/info_card.dart design_system/components/info_card/ (1 fichier par widget)
services/data_export.dart               services/export/{data_export_service, import_mappers, backup_files}.dart
```

### 3.5 Performance

- **Acquis P2** (vérifiés au présent) : RepaintBoundary + `repaint:` sur les painters animés, ticker du portail EVIL stoppé, typographie `static final`, PulsingDot à bas régime, historiques autoDispose+LIMIT+decode différé, jobs list en `ListView.builder`.
- **Restes** : **R7** (images KB 4086² décodées plein format — le plus important, car le futur pipeline maps hériterait de ce code path), **R8** (`PageScrollView` = `ListView(children:[child])`, 22 vues ; hangar en premier), **R9** (`pruneOrphanTags` O(3N+1) après chaque save + `jsonDecode` 337 Ko sur l'isolate UI — aucun `compute()` dans tout lib/).
- Exemple de correctif R7 :
  ```dart
  final dpr = MediaQuery.devicePixelRatioOf(context);
  Image.asset(path, cacheWidth: (config.width ?? MediaQuery.sizeOf(context).width * dpr).toInt(),
      errorBuilder: (_, e, __) { logError(e); return const _BrokenImageTile(); })
  ```

### 3.6 Sécurité

- **R1 🔴 wallets.json** — voir TL;DR. Fait prouvé (fichier lu, 769 entrées, 93 Ko). Trois sorties possibles : retrait pur, hachage des handles + doc de provenance, ou déplacement vers le dépôt de contenu distant (§4) avec procédure de retrait — la troisième est la seule qui préserve la feature ET la conformité.
- **R4 🟠 launchUrl** — fait prouvé. Correctif type :
  ```dart
  const _allowed = {'http', 'https', 'mailto'};
  Future<void> launchExternal(BuildContext context, String href) async {
    final uri = Uri.tryParse(href);
    if (uri == null || !_allowed.contains(uri.scheme)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Blocked link type.')));
      return;
    }
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
  ```
- **R6 🟡** exports plaintext accumulés en tmp (nuance vérifiée : les PNG de partage s'écrasent, seuls les JSON s'accumulent).
- **E5/E8 🟡/🔵** : le pipeline d'import reste la principale surface d'entrée hostile — date illisible qui « gagne », tolérance incohérente (1 tag cassé = fichier rejeté), `entityType` non borné.
- **⚪ acquis à préserver** : aucun secret dans le repo (keystore gitignoré, jamais commité — re-vérifié), HTTPS partout + timeouts, permissions Android minimales et commentées, R8/GSON, import transactionnel avec gate de version, fonts sans fetch runtime. **Obfuscation** : pas de `--obfuscate` configuré — faible enjeu (pas de secret embarqué… précisément parce que R1 doit sortir du binaire).
- **RGPD au-delà de R1** : l'app est par ailleurs exemplaire (local-first, zéro télémétrie) ; le crash reporting recommandé en R5 devra être ajouté à la divulgation about/privacy.

### 3.7 Parité multiplateforme iOS / Android

**Verdict : UI visible identique à ~95 %** — un seul branchement `Platform.isIOS` (date picker Celestial, P8), un switch adaptive isolé (P9), plus les adaptatifs Flutter standard (transitions, physique de scroll — à documenter comme exceptions assumées, P15). Le design system custom est partagé à 100 %, le splash est aligné au pixel près sur les deux OS (vérifié `#FF03060B` ≡ storyboard sRGB).

**Mais « mêmes features » ne tient pas sur trois axes** (détail dans le tableau §2) :
1. **Alertes Mars Express** : P2/E6 (cap iOS 64 pendantes → pertes silencieuses dès 4 zones répétitives), P3 (fallback inexact Android silencieux + détour réglages en plein flux), P4 (entitlement time-sensitive = release-blocker iOS OU alertes avalées par Focus).
2. **Backup** : P1 — la promesse « visible dans Files » est fausse des deux côtés, pour des raisons différentes (iOS : 2 clés plist manquantes = fix trivial ; Android : sandbox privé = fix SAF non trivial). Piège : corriger un seul côté casserait la parité.
3. **Audience** : R2/P6 — iOS 18.0 + `TARGETED_DEVICE_FAMILY=1` (iPad letterboxé) vs Android 7.0 (2016) + tablettes.

À noter aussi : P5 (barre de statut iOS potentiellement illisible sur les écrans sans AppBar — fix 1 ligne, à confirmer sur device), P10 (predictive back Android 14+ non activé alors que les `PopScope` v2 sont prêts), P11 (`NSCameraUsageDescription` sur-déclaré). **⚪** : 15 points de parité bien tenus listés et vérifiés (INTERNET, `sharePositionOrigin` ×11, XTypeGroup triple, icône notif monochrome, init notifications guardée…).

### 3.8 Qualité, tests et outillage

- **Acquis** : 78 tests réels (migrations v2/v3, round-trip export/import avec cas hostiles, scheduling Mars Express, backup reminder, contrôleur celestial, onboarding…), analyze strict, `docs/MIGRATION.md` + `docs/LIVE_ACTIVITY_PLAN.md`.
- **Manques** : **R5** — zéro CI, zéro crash reporting (`logError` = debugPrint ; en release, `PlatformDispatcher.onError` avale tout dans un log invisible), **et aucun remote git** : les 5 commits n'existent que sur cette machine. **R12** — les angles morts de tests sont exactement le code le plus fragile : `HorizonsParser` (parsing texte semi-structuré JPL), ladder de résolution Tracker (dont HTTP 300), `AsteroidDecoder`, `RetryInterceptor`, index KB. Pur Dart, golden-testable à faible coût.

### 3.9 Accessibilité, i18n, UX

- **A11y** : les surfaces principales ont été équipées en P2 (Semantics tab bar/NeonButton/ToolCard, contraste textDim, text scaling nav + share cards). **Vigilance** : le module maps introduira deux surfaces 100 % CustomPaint — l'amendement a11y du critique (§4.8) doit être dans le MVP, pas en durcissement.
- **i18n (R10)** : ~500-800 chaînes anglaises en dur, zéro infra. Décision à prendre **avant** le module maps (les `fieldsSchema` distants posent en plus la question de la langue du contenu — l'exemple du design est en français alors que l'app est anglaise ; il faut une politique, pas un accident).
- **UX** : états chargement/erreur/vide systématiques via `friendlyError`, haptique cohérente, reduce-motion respecté partout — solide. P3 (honnêteté du timing des alertes) est le principal trou UX.

### 3.10 Dépendances et dette technique

| Dépendance | État 2026 (sourcé) | Action |
|---|---|---|
| `flutter_markdown` 0.7.x | **Discontinué upstream** | 🟠 migrer `flutter_markdown_plus` avant le module maps (R3) |
| `google_fonts` | Vivant mais inutile ici (fetch désactivé, fonts bundlées) | 🔵 supprimer (R16b) |
| `cached_network_image` | 23 mois sans release, ~300 issues | ⚪ ne PAS l'adopter pour les maps (le design §4 utilise un cache fichiers maison) |
| `flutter_local_notifications` 18, drift 2.28, dio 5.9, riverpod 2.x, go_router 14 | Sains | ⚪ riverpod 3 / go_router récents : montées non urgentes |
| `flutter_scene`, `flutter_gl`/`three_dart`, `model_viewer_plus` | Preview master-channel / abandonnés / wrapper WebView sans picking | ⚪ écartés du module maps (§4) |

Cartographie de la dette par gravité = tableau §2. Les cinq dettes « de fond » : R1 (légal), R10 (i18n), R11 (god files), R12 (tests parser), P1/P2-P4 (fiabilité alertes+backup).

---

## 4. Module « maps dynamiques » (knowledge base)

*Conception complète produite par l'architecte, puis passée au critique adversarial — verdict : **« adopter avec amendements »**. Ce qui suit intègre déjà les 16 amendements (les 5 majeurs sont signalés ⚠️). Le détail d'implémentation vit dans les fichiers de travail ; ceci est la version décisionnelle.*

### 4.0 État des lieux (ce que le module remplace)

La KB actuelle est 100 % `rootBundle` : manifest minimal (`categories[].articles[]`, pas de version, pas de checksum, icônes SF-Symbols dupliquées dans 2 switches dont un incomplet), chargement eager de tous les articles en mémoire, index de recherche ASCII-only, **maps = images statiques dans le markdown, zéro interactivité** (aucun `InteractiveViewer` dans lib/), et le hasard mémoire 4086×4086 (R7). Infra réutilisable vérifiée : `appDioProvider`+retry, Drift v3 + pattern de migration testé, `friendlyError`/`logError`, design system complet, `FavoriteKind` extensible (string-kinds), export/import, settings pattern. **Le critique a validé point par point que la conception réutilise cette infra sans système parallèle.**

### 4.1 Patron « GitHub comme CMS » (recherche sourcée + décision)

Faits 2026 vérifiés (curl live + docs, sources dans le brief de recherche) :

| Canal | Faits clés | Rôle retenu |
|---|---|---|
| `raw.githubusercontent.com` | CDN Fastly, TTL 5 min, ETag+Range OK, **mais throttling par IP durci en mai 2025** (429 réels derrière NAT/CGNAT — le public d'une app communautaire) | **Fallback du pointeur uniquement**, jamais chemin primaire |
| API REST `contents` | 60 req/h/IP sans auth ; un PAT embarqué est extractible, à quota partagé, auto-révoqué par le secret scanning | **Jamais côté client** (outillage CI seulement) |
| **GitHub Releases** (immutables GA 10/2025) | « no bandwidth limit » documenté, 2 GiB/fichier, attestations Sigstore | Chemin de croissance : packs zip quand le dépôt grossit |
| **GitHub Pages** | Soft 100 GB/mois, CDN, custom domain (+Cloudflare gratuit en escape hatch) | **Pointeur mutable `latest-v1.json` (<2 Ko)** uniquement |
| **jsDelivr `/gh/@tag`** | Gratuit, multi-CDN, **pas de limite de débit**, 20 Mo/fichier, 150 Mo/dépôt, tag-pinné = immuable pour toujours (copie S3) ; `@main` = staleness 12 h/7 j → **interdit** | **Manifeste + JSON de maps + images**, épinglés par tag |

**Règle d'or : tout ce qui est mutable est minuscule, tout ce qui est volumineux est immuable.** Charge vérifiée : à 5 000 installs/800 DAU, le pointeur ≈ 36 Mo/mois sur Pages (0,04 % du quota) ; le contenu passe par jsDelivr (pas de limite). ⚠️ *Amendement (faible)* : écrire l'hypothèse DAU dans le calcul, jitter ±2-3 h sur le poll 24 h, et **runbook testé** de migration vers un object host (R2/Cloudflare) — le filet du pari multi-services-gratuits.

### 4.2 Intégrité — ⚠️ signature obligatoire, pas optionnelle (amendement critique)

La chaîne sha256 (pointeur → manifeste → fichiers) ne protège que le **transport**. Contre la menace n°1 (compromission du dépôt/compte GitHub), elle est du **théâtre** : qui réécrit le pointeur réécrit ses hashes. Donc :
- **Signature ed25519 du pointeur exigée par le client dès le MVP** (pointeur non signé/mal signé = ignoré, pack local conservé). Coût ~1 jour.
- **Cérémonie définie** : la clé privée ne vit PAS dans GitHub (sinon compromettre le dépôt = obtenir des signatures) — signature locale sur la machine du mainteneur (le pointeur fait <2 Ko, script de 20 lignes), 2 clés publiques embarquées pour la rotation, vecteurs RFC 8032 dans les tests, `beta-v1.json` signé pareil.
- **Anti-rollback** ⚠️ : le client refuse tout `contentVersion` < installé. Les rollbacks éditeur deviennent des **roll-forwards** (version N+1 pointant l'ancien tag — gratuit grâce au store adressé par contenu). Le « freeze » pur (rejouer indéfiniment un vieux pointeur signé) reste possible — l'écrire dans le modèle de menace.
- **Fin de vie de canal** ⚠️ : la dernière publication `latest-v1.json` est une **pierre tombale** (minAppVersion relevé → bannière upgrade), sinon les vieilles apps gèlent silencieusement pour toujours. Règle CI écrite.
- Dépendance crypto : appliquer le même critère de fraîcheur qu'ailleurs (⚠️ amendement : `package:cryptography` a une cadence lente — évaluer `pointycastle` ou vendorer la seule vérification ed25519, version épinglée + vecteurs de test).

### 4.3 Schéma de données (exemples concrets)

Trois niveaux, chacun avec son `schemaVersion` (additif = mineur, champs inconnus ignorés ; rupture = majeur + nouveau fichier pointeur).

**Pointeur** — `https://<org>.github.io/underdeck-content/pointer/latest-v1.json` (+ `.sig`) :
```json
{
  "schemaVersion": 1,
  "contentVersion": "1.4.0",
  "tag": "maps-v1.4.0",
  "minAppVersion": "0.3.0",
  "manifest": {
    "url": "https://cdn.jsdelivr.net/gh/<org>/underdeck-content@maps-v1.4.0/maps-manifest.json",
    "fallbackUrl": "https://raw.githubusercontent.com/<org>/underdeck-content/maps-v1.4.0/maps-manifest.json",
    "sha256": "9f2ac41d0be7…", "bytes": 31248
  }
}
```

**Manifeste** (extrait — corrige toutes les lacunes du manifest KB actuel : versionné, draft explicite, icônes en enum fermé, checksums, tailles) :
```json
{
  "schemaVersion": 1, "contentVersion": "1.4.0", "minAppVersion": "0.3.0",
  "cdnBase": "https://cdn.jsdelivr.net/gh/<org>/underdeck-content@maps-v1.4.0",
  "maps": [
    { "id": "hideous-dungeon", "type": "flat", "title": "Hideous Dungeon", "icon": "dungeon",
      "version": 7, "draft": false,
      "document": { "path": "maps/hideous-dungeon/map.json", "sha256": "b41c…", "bytes": 40210 },
      "assets": [
        { "kind": "background", "path": "maps/hideous-dungeon/bg@2048.png", "sha256": "77ae…", "bytes": 1310720, "pixelSize": [1536, 2048] },
        { "kind": "thumbnail",  "path": "maps/hideous-dungeon/thumb.png",   "sha256": "13f0…", "bytes": 45120,  "pixelSize": [480, 640] } ] },
    { "id": "keth-9", "type": "sphere", "title": "Keth-9", "icon": "sphere", "version": 3, "draft": false,
      "document": { "path": "maps/keth-9/map.json", "sha256": "e5a2…", "bytes": 88450 },
      "assets": [ { "kind": "texture", "path": "maps/keth-9/surface@2048.jpg", "sha256": "0c4b…", "bytes": 980134, "pixelSize": [2048, 1024] } ] }
  ]
}
```

**Map plate** (`map.json`, coordonnées = pixels de l'image de fond ; `fieldsSchema` = champs propres **sans redéploiement de l'app**) :
```json
{
  "schemaVersion": 1, "id": "hideous-dungeon", "type": "flat",
  "canvas": { "width": 3072, "height": 4096 },
  "theme": { "background": "#0A0612", "surface": "#161022", "zoneFill": "#3A1E4E",
             "zoneStroke": "#C77DFF", "zoneSelectedFill": "#5B2E7A", "glow": "#E0AAFF",
             "label": "#F3E8FF", "accent": "#FFB347", "fontFamily": "JetBrainsMono" },
  "fieldsSchema": [
    { "key": "threat", "label": "Threat", "type": "enum", "options": ["low","medium","high","critical"], "style": "badge", "filterable": true },
    { "key": "loot",   "label": "Notable loot", "type": "stringList", "searchable": true },
    { "key": "brief",  "label": "Briefing", "type": "longText", "searchable": true } ],
  "zones": [
    { "id": "z-entry", "name": "Hall of Chains",
      "geometry": { "kind": "polygon", "rings": [[[210,388],[842,361],[901,918],[455,1040],[188,812]]] },
      "labelAnchor": [520, 660],
      "fields": { "threat": "low", "loot": ["Rusted key"], "brief": "Single entry point…" } },
    { "id": "m-shrine", "name": "Sealed Shrine",
      "geometry": { "kind": "marker", "at": [2540, 3300], "hitRadius": 48 },
      "fields": { "threat": "medium", "brief": "Requires the Broken Seal item." } }
  ]
}
```
(`rings` : 1er anneau = contour, suivants = trous, règle even-odd ; markers = hit-test par distance à rayon **indépendant du zoom**.)

**Map sphère** (coordonnées `[lon, lat]` degrés, convention GeoJSON ; **la tessellation vit dans la CI du dépôt de contenu** — Voronoi sphérique ou tracés main, arêtes ré-échantillonnées en arcs ≤ 2° — l'app ne tessèle jamais) :
```json
{
  "schemaVersion": 1, "id": "keth-9", "type": "sphere",
  "sphere": { "textureAsset": "texture", "initialOrientation": { "lat": 12.0, "lon": -40.0 }, "autoRotateDegPerSec": 2.0 },
  "theme": { "background": "#03060B", "zoneFill": "#0E3A2E", "zoneStroke": "#5FE8A0", "…": "…" },
  "fieldsSchema": [
    { "key": "faction", "label": "Faction", "type": "enum", "options": ["Ferrous Pact","Rustwinds","Neutral"], "style": "badge", "filterable": true },
    { "key": "gravity", "label": "Gravity", "type": "number", "unit": "g" } ],
  "zones": [
    { "id": "s-01", "name": "Crucible Sector",
      "geometry": { "kind": "sphericalPolygon", "rings": [[[-12.0,8.0],[-10.1,8.0],[-8.2,8.1],[…]]] },
      "fields": { "faction": "Ferrous Pact", "gravity": 1.4 } },
    { "id": "s-02", "name": "Glass Cap",
      "geometry": { "kind": "sphericalCap", "center": [0.0, 90.0], "radiusDeg": 18.0 },
      "fields": { "faction": "Neutral", "gravity": 1.4 } }
  ]
}
```
(Les zones contenant un pôle s'expriment en `sphericalCap` — test = distance angulaire — pour esquiver le winding dégénéré au pôle ; l'antiméridien est géré par un test de winding **sphérique** côté app.)

⚠️ *Amendement fieldsSchema (moyen)* : `filterable` **réservé au type `enum`** (l'exemple originel avait `boss: text+filterable` = chips à cardinalité non bornée), cap `options ≤ 12`, **gel du contrat** : les 7 types v1 sont fermés, tout nouveau type/attribut de comportement = incrément majeur + décision explicite — sinon ce descripteur devient un mini-framework de formulaires non maintenu. Trancher la langue des labels (politique, pas accident).

### 4.4 Rendu 2D — décision : natif Flutter, zéro dépendance risquée

Recherche 2026 : `flutter_map` 8.3.1 est sain et supporte les maps non géographiques (`CrsSimple`, `PolygonLayer.hitValue`), **mais** la taxe LatLng n'achète rien à 50-500 zones dans notre propre espace pixel ; `flutter_svg` n'a **pas de hit-testing par path** production-grade (`interactive_svg` = 0.0.2 hobby) ; aucun package « image map » mûr n'existe.

**Choix : `InteractiveViewer` + `CustomPaint` + hit-testing maison** (~50 lignes testables) :
```
lib/features/knowledge/maps/
├── data/    map_content_repository, map_fetcher, map_blob_store, map_validator
├── domain/  map_models, map_theme, zone_hit_index, sphere_math, map_icons
├── render/  flat_background_painter, zone_painter, selection_painter, label_painter, globe_painter
├── views/   maps_home_section, map_detail_view (dispatch flat/sphere), zone_sheet
└── widgets/ flat_map_viewport, globe_viewport, zone_fields_renderer, map_update_banner
```
Couches sous `RepaintBoundary` (fond décodé **à taille contrainte** — le correctif de R7 ; zones ; sélection ; labels LOD), tap → inversion de la matrice du `TransformationController` → bounds-check puis `path.contains()`. Fonds **raster uniquement** en MVP (pas de SVG distant = surface parseur supprimée). `flutter_map` reste le fallback documenté si tuilage/rotation un jour.

### 4.5 Rendu 3D — le point délicat, traité franchement

**Faits 2026** (sourcés) : `flutter_scene` 0.18.1 = « early preview », exige **Flutter GPU preview + channel master** → non livrable ; Thermion (Filament) = capable mais pub stale 9 mois, pré-1.0, meshes sphériques par zone à générer soi-même ; `flutter_gl`/`three_dart` abandonnés ; `model_viewer_plus` = wrapper WebView **sans picking** ; `three_js` (port Dart) vivant mais 0.x — reconstruire globe.gl à la main. Côté web : **globe.gl fait exactement ce besoin** (polygones GeoJSON, `onPolygonClick`, `polygonCapColor`) et `webview_flutter` 4.14.1 (flutter.dev, juillet 2026) sert des assets **bundlés** via `loadFlutterAsset`. Aucune app Flutter en prod avec un globe cliquable natif n'a émergé des recherches — signal en soi.

**Plan A (recommandé) — globe orthographique pur Dart** (`GlobePainter` + `FragmentProgram` optionnel pour la texture) : projection orthographique des polygones (arêtes déjà tessellées ≤ 2° par la CI), drag = quaternion, **picking en forme fermée** (reconstruire z = √(R²−x²−y²), inverser le quaternion, lat/lon, winding sphérique — exact, offline, unitaire-testable, antiméridien inclus). Style néon = exactement l'esthétique de l'app, golden tests possibles. **Effort honnête : 3-4 semaines.** Preuve de faisabilité : `flutter_earth_globe` 2.2.1 (pur Dart, 60 fps) — mais sans couche polygones, d'où le travail maison. ⚠️ *Amendements 3D* : refuser les picks au-delà de ~0,95R (mal conditionné au limbe) ou rotation-vers-la-zone au tap ; lint CI de taille angulaire minimale de zone ; **le spike doit tester le FragmentProgram sur un Android bas de gamme réel (Impeller ET fallback), pas seulement les polygones ; l'avancer en parallèle de M0** pour décider A/B avec 3,5 semaines d'avance.

**Plan B (fallback) — WebView + globe.gl/three.js bundlés en assets** : même `map.json` poussé via `runJavaScript`, taps remontés par `JavaScriptChannel`, la sheet de détail reste **Flutter**. Effort 1,5-2 semaines. ⚠️ *Amendement sécurité (élevé)* : le proposal initial surestimait `NavigationDelegate` — il n'intercepte **pas** les sous-ressources (fetch/XHR/img) ; la seule barrière est la **CSP** `default-src 'none'` du HTML bundlé → l'affirmer par un **test d'intégration** (un `fetch()` doit échouer) ; désactiver **Safe Browsing Android** (`EnableSafeBrowsing=false` — sinon le WebView téléphone à Google, inacceptable non divulgué pour une app « zéro télémétrie ») ; couper file/content access ; interdire `window.open` ; règle écrite : JS/HTML **toujours** bundlés, seul du JSON transite (c'est ce qui rend le module conforme App Store 2.5.2/4.7).

Le contrat de données étant identique, basculer A→B ne touche que `globe_viewport.dart`.

### 4.6 Théming par map

Type valeur `MapTheme` = **whitelist fermée de 9 jetons** (background, surface, zoneFill, zoneStroke, zoneSelectedFill, glow, label, accent, fontFamily), défauts dérivés d'`AppColors`. `sanitize()` au parse : hex strict, **garde dark-only** (luminance ≤ 0,22 — les composants glass/néon supposent des fonds sombres), gardes de contraste WCAG, `fontFamily` ∈ {Inter, JetBrainsMono, Quicksand} (bundlées). ⚠️ *Amendement contraste (moyen)* : la paire vérifiée n'est pas celle rendue — les labels se peignent sur l'image de fond ; imposer un **halo/scrim systématique** derrière les labels (propriété du moteur de rendu, non contournable par le contenu), ajouter les gardes label↔zoneFill/zoneSelectedFill et un ΔL minimal zoneSelectedFill↔zoneFill (sinon sélection invisible) ; golden test sur thème hostile.

### 4.7 Cache, offline, versioning

- **Store de blobs adressé par contenu** : `ApplicationSupport/maps_store/blobs/<sha256>` (écriture atomique `.tmp`+rename après vérif hash) + **Drift v4** (`MapPacks`, `MapPackFiles`, + table **FTS5** `map_zone_fts` unicode — règle au passage la limite ASCII du `KBIndex`, sans le toucher).
- **Protocole** : GET pointeur avec `If-None-Match` (≤ 1×/24 h, uniquement si opt-in réseau) → vérif signature → gate `minAppVersion` → GET manifeste (jsDelivr, fallback raw) → **diff gratuit par sha256** (le store déduplique entre versions) → téléchargements vérifiés → commit transactionnel + rebuild FTS → GC. Toute lecture de rendu se fait **exclusivement depuis le store** — jamais de réseau au rendu.
- **Compatibilité** : app ancienne × contenu récent (même majeur) = champs inconnus ignorés, type inconnu = carte « mise à jour requise » non ouvrable (⚠️ et **exclue du FTS**, sinon la recherche mène à des impasses) ; nouveau majeur = nouveau canal pointeur + pierre tombale (§4.2) ; **premier lancement hors ligne = pack graine bundlé** (les maps actuelles converties au format).
- ⚠️ *Amendements cache (moyens)* : GC défini **sur les lignes `MapPacks` locales** (jamais l'état serveur) et jamais sur les blobs d'un document ouvert ; activation d'un nouveau pack **à l'entrée d'écran** (pas de `ref.invalidate` sous les pieds de l'utilisateur) ; rebuild FTS dans la transaction de commit ; hachage **en streaming** pendant le téléchargement + parse sur isolate (pas de jank d'installation) ; seed limité au @2048 (le @4096 est download-only), import **paresseux** au premier accès Knowledge, sans re-hashage (les assets bundlés sont déjà authentifiés par la signature du store d'apps) — et à terme dé-dupliquer les images des articles KB avec le store (aujourd'hui le binaire embarquerait deux fois les mêmes maps).
- *Correction technique du critique* : l'API citée est `ui.instantiateImageCodecWithSize`/`ImageDescriptor.instantiateCodec(targetWidth:)` (pas `…WithTargetSize`), et le plafond de décodage doit être un **absolu** (~2048 px hors zoom profond), pas « 2× le viewport » (qui ne contraint rien sur un écran 1080×2400).

### 4.8 Interaction, UX, accessibilité

- Galerie « Interactive maps » en tête de `KBHomeView` (GlassCards + vignettes), routes `/knowledge/maps` et `/knowledge/maps/:id`, deep-links KB↔maps (⚠️ l'infra `underdeck://` n'existe pas — la chiffrer dans M3, avec `errorBuilder` de route pour cible manquante ; un constat « réfuté » de l'audit v1 — spinner infini sur cible supprimée — redevient atteignable à ce moment-là).
- **Opt-in réseau** (posture vie privée) : premier accès = écran explicite + taille réelle (lue du manifest seed puis confirmée — pas de « ~12 MB » codé en dur ⚠️), toggles `mapsNetworkEnabled`/`mapsAutoUpdate` (défaut à trancher), **progression + annulation + option wifi-only + écran « Maps téléchargées : X Mo — Effacer »** ⚠️. **La copy de transparence existante devient mensongère au merge** (l'onboarding dit « the only outbound network is… ») → mise à jour onboarding/FAQ/about **dans M1, pas M4**, nommant les endpoints réels (GitHub Pages/Fastly, jsDelivr = multi-CDN Cloudflare/Fastly/Bunny), la cadence (≤ 1/24 h) et une fiche « how it works » du module dans le style Tracker ⚠️.
- Sélection : tap → haptique → glow → `ZoneSheet` (GlassCard) rendue par `ZoneFieldsRenderer` piloté par `fieldsSchema` (enum→TagChip, number+unit→mono, stringList→puces, longText→paragraphe, link→bouton **whitelisté**, inconnu→texte brut). `FavoriteButton(kind: map_zone)` — 2 constantes, l'export les embarque déjà.
- **A11y ⚠️ (amendement élevé, à faire en M1)** : les deux canvases sont invisibles pour TalkBack/VoiceOver tels que conçus — ajouter une couche Semantics par zone **et** une **vue « liste des zones »** par map (tri/filtre, ouvre la même ZoneSheet) qui règle d'un coup l'accessibilité 2D+3D, les zones minuscules et le picking au limbe.
- Recherche FTS unicode « Carte › Zone » ouvrant la map pré-centrée ; filtres = chips générés des fields `enum filterable` ; états chargement/erreur/vide/`minAppVersion` cohérents avec l'app ; reduce-motion : auto-rotation et inerties coupées, pan/zoom conservés.

### 4.9 Plan de livraison et tests

| Jalon | Contenu | Durée |
|---|---|---|
| **M0 — Socle contenu** | Dépôt `underdeck-content` + CI (ajv sur JSON Schemas, sha256, manifeste, tag, **vérif post-tag des URLs CDN avant publication du pointeur**), signature ed25519 + cérémonie ; côté app : modèles, validateur (bornes dures : manifeste ≤ 256 Ko, map ≤ 2 Mo, image ≤ 8 Mo/4096², ≤ 500 zones, ≤ 5 000 sommets, coupure de flux au-delà du Content-Length), blob store, repository, Drift v4, seed. **+ spike 3D de 3 j en parallèle** ⚠️ | 1,5 sem |
| **M1 — MVP flat** | Viewport 2D + painters + hit-test + ZoneSheet + fields renderer + galerie + opt-in + **vue liste zones (a11y)** + **mise à jour des copys de transparence** ⚠️ | 2 sem |
| **M2 — Sphère** | Go/no-go A/B (déjà éclairé par le spike M0) → GlobeViewport + picking sphérique | 3-4 sem (A) / 1,5-2 (B) |
| **M3 — Théming + fields avancés** | sanitize complet, overrides par zone, filtres, FTS, deep-links (+ infra plateforme) | 1,5 sem |
| **M4 — Durcissement** | GC, bannières update/tombstone, gestion stockage, passes mémoire devtools | 1 sem |

**Tests** : unitaires (validateurs sur fixtures hostiles — oversized, 501 zones, couleurs invalides, sha256 faux ; math sphérique — antiméridien, calotte polaire, inverse quaternion ; hit-test polygones/trous/markers ; sanitize), migration v3→v4, **test de contrat** (un snapshot du manifeste de prod en fixture — toute divergence app/contenu casse le build avant les users), golden tests painters + ZoneSheet ×2 thèmes (argument concret pro-Plan A : impossible en WebView), réseau mocké (304, 429→fallback, sha256 mismatch→rollback, coupure→reprise), vecteurs ed25519 RFC 8032.

### 4.10 Recommandation techno du module

**2D : natif Flutter (InteractiveViewer + CustomPaint maison). 3D : Plan A pur Dart avec spike avancé et bascule Plan B (WebView + globe.gl bundlé) bornée et préparée — le contrat de données rend la bascule locale à un seul widget.** Distribution : GitHub public + pointeur Pages signé ed25519 + jsDelivr tag-pinné + chaîne sha256 + anti-rollback ; store de blobs + Drift v4 + FTS5. Dépendances ajoutées : `crypto` (+ lib ed25519 à sélectionner selon le critère de fraîcheur, ou vendorée) — et `webview_flutter` seulement si Plan B. Écartés avec raisons : flutter_map (taxe inutile ici), flutter_svg interactif (pas production-grade), cached_network_image (23 mois sans release, et il faut des *octets* sur disque), flutter_scene/Thermion/three_js/model_viewer_plus (§4.5). **Trade-offs assumés** : Plan A coûte 2× le WebView mais zéro dépendance risquée + golden tests + cohérence privacy ; deux jambes de la distribution sont des services gratuits sans SLA — accepté car le design sha256+manifeste rend la migration vers tout object host triviale *à condition d'en tester le runbook une fois* ; le contenu est public par construction (aucun secret de jeu n'y transite — propriété du patron, pas un oubli).

---

## 5. Recommandation de stack

**Question préalable réglée (App Store)** : la guideline 2.5.2 interdit le *code* téléchargé qui change les fonctionnalités ; la 4.7 encadre les mini-apps HTML/JS. Votre besoin — du **contenu** (JSON, images, géométries) depuis GitHub — est de la **donnée, pas du code** : conforme sur toutes les stacks. Un WebView rendant votre propre JS **bundlé** est également en territoire sûr ; le seul schéma à éviter est le téléchargement de JS pilotant du natif (pattern CodePush-features).

| Critère (pondéré solo dev) | Flutter | KMP + Compose MP | React Native | Bi-natif Kotlin+Swift | **Flutter + WebView globe** |
|---|---|---|---|---|---|
| Parité UI pixel-identique | **9** (renderer propre) | 8 (renderer propre, plus jeune) | 5 (widgets natifs, dérive) | 3 (deux toolkits) | **9** |
| Capacité 3D globe | 3 (flutter_scene = preview) | 3 (aucune partagée ; 2× interop) | 5 (WebGPU prometteur, pré-1.0) | **9** (Filament/RealityKit) | **8** (globe.gl/MapLibre GL JS) |
| Écosystème maps 2D | 8 (flutter_map v8) | 5 (maplibre-compose pré-stable) | 8 | 9 | 8-9 |
| Contenu dynamique store-safe | 9 (+ Shorebird si OTA Dart) | 8 | 7 (OTA JS = zone grise) | 8 | 9 |
| Performance | 8 (Impeller) | 8 | 7 | 10 | 7 (surface WebView) |
| Vitesse de dev à UNE personne | **9** | 6 | 6 | 2 | **8** |
| Maintenabilité solo | 9 | 7 | 7 | 3 | 8 |
| Recrutement | 7 | 5 | **9** | 8 | 7 |
| Pérennité | 7 (Google-dépendant ; données 2025-26 rassurantes : cadence trimestrielle, Impeller, roadmap consolidation) | 7 (stable iOS depuis 05/2025 seulement) | 9 (Meta+Expo) | 10 | 7 |
| **Coût de migration des 30k lignes** | **10** (zéro) | 1 (réécriture totale) | 1 (réécriture totale) | 0 (deux réécritures) | **9** (additif) |
| **Verdict pondéré** | **8,4** | 5,4 | 5,8 | 4,5 | **8,5** |

**Verdict : rester sur Flutter — et régler le globe soit en pur Dart (Plan A), soit par un micro-module WebView (Plan B). Ne pas migrer.**
- **Le calcul de migration tue les options 2-4** : 30k lignes polies (DB locale, notifications, théming profond, 78 tests) = 6-12 mois de réécriture solo pendant lesquels rien ne ship, pour au mieux retrouver la parité. Ni KMP (14 mois de stable iOS, lib maps pré-stable, pas de 3D partagé — vous écririez le globe **deux fois**), ni RN (parité pixel structurellement plus dure, écosystème 3D en transition expo-gl cassé → WebGPU pré-1.0) n'offrent une capacité inaccessible depuis Flutter.
- **Fait notable de la recherche** : la stack **web** (MapLibre GL JS v5 avec projection globe, globe.gl, three.js) est en 2026 **en avance sur tous les bindings mobiles natifs** pour les globes interactifs — y compris ceux que vous obtiendriez en migrant. L'hybride « Flutter + WebView pour ce seul écran » n'est pas un pis-aller, c'est l'état de l'art mobile.
- **Risques assumés en restant** : la 3D first-party Flutter reste préview (réévaluer flutter_scene en 2027) ; la dépendance à Google est réelle mais les données 2025-2026 (8 releases stables en 2025, roadmap 2026 de consolidation) indiquent une plateforme à 5+ ans — au-delà de l'horizon d'une app compagnon.

---

## 6. Nouvelles fonctionnalités suggérées (valeur/effort, alignées KB + maps)

| # | Feature | Valeur | Effort | Notes |
|---|---|---|---|---|
| 1 | **Pins/notes personnels sur les maps** (flat + sphère) | ★★★★★ | M | Le pont naturel maps ↔ Captures : long-press → note taggée liée à (mapId, zoneId, coords) ; transite par l'export existant. Transforme la consultation en outil de session. |
| 2 | **Contribution communautaire de maps par PR** | ★★★★★ | S (doc+CI) | Le dépôt de contenu EST le CMS : template de PR + validation ajv en CI + preview HTML auto. Prolonge la boucle « Contribute intel » déjà shippée. Crédits contributeurs dans la ZoneSheet. |
| 3 | **Changelog de contenu in-app** (« Nouveautés des maps ») | ★★★★ | S | Un `changelog` dans le manifeste, bannière discrète au premier affichage post-update — rend la fraîcheur du contenu visible, récompense la boucle communautaire. |
| 4 | **Recherche globale unifiée** (KB + zones de maps + jobs + wallets) | ★★★★ | M | Le FTS5 du module maps est le cheval de Troie : y indexer aussi les articles KB (règle la limite ASCII) puis fédérer. |
| 5 | **Mode terrain hors-ligne** (« Field kit ») | ★★★ | S | Indicateur d'état des packs (versions, tailles, dernière MàJ) + bouton « tout pré-télécharger » — pour les joueurs en mobilité, cohérent avec l'écran de gestion du stockage (amendement §4.8). |
| 6 | **Liens croisés jobs/fishing → maps** | ★★★ | M | Un job ou une zone de pêche référencent (mapId, zoneId) → bouton « Voir sur la carte » pré-centré. Dépend des deep-links M3. |
| 7 | **Live Activity / widget Mars Express** | ★★★★ | L (natif) | Déjà planifié (`docs/LIVE_ACTIVITY_PLAN.md`, `nextArrivalProvider` prêt après correctif E3) — nécessite du travail device. |
| 8 | **Partage d'une zone en share card** | ★★ | S | L'infra ShareCardCapture existe ; carte brandée « Map › Zone + fields » pour Discord. |
| 9 | **Thème par événement communautaire** | ★★ | S | Le théming par map (§4.6) permet des packs saisonniers sans release — pur contenu. |

---

## 7. Plan d'action séquencé (roadmap)

### Quick wins (jours) — dans l'ordre
1. **Créer le remote git + CI GitHub Actions** (`analyze` + `test`) — le projet n'existe que sur une machine (R5). *Dépendance : décision publique/privé — le code contient encore wallets.json (R1), donc **privé** tant que R1 n'est pas réglé.*
2. **R4** allowlist `launchExternal` (3 sites) · **E1** `ShareResult` avant `markBackedUp` · **P5** `statusBarBrightness` · **R7** `cacheWidth`+`errorBuilder` KB · **R6** sweep des exports tmp · **E5** fallback epoch à l'import · **P11** retirer `NSCameraUsageDescription` · **R15/R16** logError + dead code + retirer google_fonts · **E7/E10/E11** micro-fixes.
3. **R2/P6** : abaisser le plancher iOS (4 emplacements) + trancher iPad — après décision (§8).
4. **P4** : activer la capability Time-Sensitive sur l'App ID (portail Apple) — sinon retirer l'entitlement et documenter.

### Refactors (semaines)
5. **Fiabilité alertes en un chantier** : E2 (sérialisation refresh/arm/cancel) + E4 (`now` réel + rollback + messages) + P2/E6 (budget global ≤ 60 pendantes) + P3 (badge « timing approximatif ») + E9 (cleanup ids legacy). C'est LA feature d'accroche de l'app — elle doit être irréprochable.
6. **R3** migration `flutter_markdown_plus` (3 vues) — **prérequis maps**.
7. **P1** backup : clés plist iOS + SAF Android (ou wording honnête en attendant) ; ShareResult déjà fait en quick win.
8. **R5b** crash reporting (Sentry) branché dans `logError`/`onError` + divulgation privacy.
9. **R12** tests golden HorizonsParser + TrackerClient mocké · **R9** prune 1-requête + `compute()` · **R8** `PageScrollView.slivers` (hangar) · **R11** split ship_editor/info_card · **P8/P9/P10** décisions parité (picker, switches, predictive back).

### Chantiers de fond (mois)
10. **Module maps dynamiques** (§4) : M0 (socle contenu + signature + spike 3D avancé) → M1 (flat MVP + a11y + transparence) → M2 (sphère A/B) → M3 (théming/fields/deep-links) → M4 (durcissement). **R1 se règle dans M0-M1** : wallets déplacés dans le dépôt de contenu avec consentement/processus de retrait, retirés du binaire.
11. **R10 i18n** : décision puis, si l10n, infra ARB + migration opportuniste (avant que le contenu maps n'ajoute sa propre couche de langues).
12. **Live Activity / widget** (plan existant) après correctif E3 — nécessite device + entitlements.

**Dépendances clés** : R1 → avant toute release publique ET avant de rendre le repo public ; R3+R4+R7 → avant M1 ; spike 3D → pendant M0 ; P4 → avant toute release iOS ; E3 → avant le bridge Live Activity.

---

## 8. Questions ouvertes & hypothèses

**Décisions qui vous appartiennent (bloquantes à des degrés divers) :**
1. **Wallets (R1)** : la liste a-t-elle été constituée avec le consentement des membres (post Discord opt-in ?) ? Retrait pur, hachage+doc, ou déplacement vers le dépôt de contenu avec processus de retrait ?
2. **Plancher iOS** : 15.0/16.0 (recommandé) ou 18.0 assumé et documenté ? Et iPad (family 2) vs tablettes Android ?
3. **Langue** : EN-only assumé (documenté, on n'y pense plus) ou infra l10n maintenant ? Et la langue du contenu de maps (les exemples produits sont en FR, l'app est en EN) ?
4. **Opt-in réseau du module maps** : `mapsAutoUpdate` on ou off par défaut ? Le seed bundlé suffit-il comme expérience sans réseau ?
5. **Clé de signature du contenu** : qui la détient, où vit-elle (machine perso ? gestionnaire de secrets ?), qui peut publier un pointeur ?
6. **Publication du dépôt app** : public (open source fan-app, courant) ou privé ? — conditionné par R1 et par les chemins locaux résiduels dans l'historique git.
7. **Date picker Celestial (P8)** : l'écart Cupertino/Material est-il un choix assumé à documenter, ou à unifier ?

**Hypothèses posées (à confirmer) :**
- **P5** (barre de statut iOS) : mécanisme prouvé dans le code, rendu à confirmer sur device réel en mode clair.
- **E6/P2** (cap 64 iOS) : arithmétique prouvée, comportement de troncature iOS documenté mais non testé à l'exécution ici.
- **E9** (ids legacy hors bande) : dépend de ce que les testeurs ont réellement installé (builds pré-P2) — cleanup one-shot recommandé par précaution.
- **Charge CMS** : les calculs supposent ~5 000 installs / 800 DAU et 1 publication de contenu/mois ; à re-vérifier si la communauté est plus grande.
- **jsDelivr/Pages** : services gratuits sans SLA — la permanence « pour toujours » des tags jsDelivr est best-effort ; le runbook de bascule vers un object host doit être **testé une fois**, pas supposé.
- **Perf du Plan A 3D** : faisabilité démontrée par l'écosystème, mais le FragmentProgram sur Android bas de gamme (minSdk 24) est le composant le plus incertain — c'est l'objet du spike M0.
- **Accès device** : plusieurs vérifications de cet audit (H2 ProGuard en release, entitlement iOS, rendu des polices variables, predictive back, haptique Android) restent à valider sur appareils réels — hors de portée d'un audit statique.

---

*Rapport généré par audit multi-agents (workflow `underdeck-audit-v2` : 4 auditeurs code indépendants, 4 chercheurs web à sources datées, 1 architecte, 1 critique adversarial). Constats code vérifiés sur HEAD `d74ff66` ; faits web vérifiés au 2026-07-10 (curl live sur raw.githubusercontent.com, cdn.jsdelivr.net, release-assets.githubusercontent.com ; versions pub.dev citées). L'audit v1 et ses 74 constats corrigés : [AUDIT.md](AUDIT.md).*

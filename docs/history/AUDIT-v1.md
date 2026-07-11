# Audit complet — Underdeck (0.2.0+5, alpha)

> **Date** : 9 juillet 2026 · **Méthode** : audit multi-agents (10 cartographes de sous-systèmes, 7 chasseurs de bugs par dimension, vérification adversariale de chaque constat contre le code réel, revue produit, critique de complétude). 95 agents, ~4,4 M tokens. **76 constats bruts → 74 confirmés, 2 réfutés.**
>
> **Usage prévu** : ce document sert de cahier des charges à un agent (Opus) pour fiabiliser puis enrichir l'app. Les sections 5 (bloquants) et 10 (plan d'action) sont priorisées ; chaque constat cite le fichier et propose un correctif.

---

## 1. Verdict global

**Le projet est bon et ne doit PAS être refait.** L'architecture est saine, le design system est réel (pas décoratif), l'hygiène de code est largement au-dessus de la moyenne d'un projet solo, et la transparence utilisateur (fiches « how it works » documentant endpoints, maths et vie privée) est exemplaire.

**Mais il n'est PAS fiable pour une release aujourd'hui**, pour quatre raisons structurantes :

1. **Deux bugs tueurs invisibles en debug** : la permission `INTERNET` est absente du manifest Android release (tous les outils réseau morts en production — vérifié dans l'AAB compilé) et il n'existe aucune règle ProGuard/R8 pour GSON (les alertes programmées plantent en release Android). L'app fonctionne parfaitement depuis l'IDE et ship cassée.
2. **Le pipeline export/import — l'unique filet de sauvegarde des données utilisateur — a 6 défauts confirmés**, dont deux destructeurs : perte silencieuse des associations de tags entre appareils, et une ligne corrompue qui brique définitivement les historiques sans récupération possible dans l'app.
3. **Zéro test réel** (`expect(1+1, 2)`) pour 25 000+ lignes contenant du parsing de texte NASA, des maths de secteurs, un décodeur d'astéroïdes et un pipeline de backup — exactement le code qui régresse silencieusement.
4. **L'état git est dangereux** : 37 fichiers d'un rename Xcode abandonné sont stagés mais supprimés du disque, le `MainActivity.kt` stagé déclare le mauvais package, et `scripts/` + les nouveaux assets référencés par le pbxproj ne sont pas trackés. **Tout `git commit` naïf produit un arbre cassé.** Aucun remote n'existe : tout le projet vit sur une seule machine.

Sévérités confirmées : **5 HIGH · 28 MEDIUM · 41 LOW.**

---

## 2. Vue d'ensemble et architecture

**Underdeck** est une app compagnon non officielle (iOS + Android, Flutter) pour le jeu/communauté Underpunks55. Identité « terminal ESSI » cyberpunk (glass cards, scanlines, grille hexagonale, néon, haptique partout). Philosophie : local-first, zéro backend, zéro télémétrie, export/import JSON.

**Stack** : Riverpod (mixte codegen/manuel), Drift/SQLite (isolate arrière-plan via drift_flutter), go_router (`StatefulShellRoute.indexedStack`, 5 onglets, ~20 routes), dio, flutter_local_notifications + timezone, flutter_markdown (⚠️ package abandonné upstream), google_fonts (fetch runtime), share_plus, file_selector, image_picker.

**Structure** (121 fichiers Dart, ~25 000 lignes hors généré) :

```
lib/
├── main.dart              # init séquentielle : orientation → notifs → prefs → runApp
├── app/                   # router (20 routes), shell 5 onglets custom, thème dark-only
├── core/                  # 2 fichiers seulement (constantes, dates relatives)
├── design_system/         # tokens + 12 composants + 3 CustomPainters (vraie réutilisation)
├── data/database/         # Drift : 10 tables, schemaVersion 1, AUCUNE migration/FK
├── services/              # settings, notifications, export/import, share cards, haptique
└── features/
    ├── boot/              # séquence de boot animée (8-10 s, non skippable en cours)
    ├── captures/          # notes + liens markdown avec tags partagés (Drift)
    ├── hangar/            # registre de vaisseaux (12 rôles d'équipage) + easter egg EVIL-01
    ├── knowledge/         # KB markdown embarquée (14 articles dont 9 placeholders)
    ├── menu/              # settings, about, FAQ, disclaimer, contact
    └── tools/             # 8 outils : scan, tracker, discoveries (celestial), asteroid,
                           #   fishing, train (mars express), jobs, wallet
```

**Base de données** (`underdeck.sqlite` dans Documents) : notes, links, tags (+3 tables de jointure à PK composite), ships (12 colonnes de rôles dénormalisées), et 3 tables d'historique structurellement identiques (`payload_json` opaque). IDs = UUID v4 côté client. Lectures réactives via `watch()` + rxdart. **Aucune clé étrangère, aucun index secondaire, aucune contrainte UNIQUE sur `tags.name`, aucune `MigrationStrategy`.**

**Réseau** : 3 clients dio nus (Horizons, SBDB tracker, SBDB celestial) vers les APIs publiques JPL/NASA, sans authentification. Scan strictement séquentiel avec 200 ms d'espacement (bonne citoyenneté rate-limit). Parsing du texte brut Horizons par balayage de lignes (`'A.D.'`, `'X ='`).

**Points forts observés** (à préserver) :
- Découpage features propre (`domain/data/state/views/widgets`) là où il est appliqué (scan, tracker, jobs).
- Hiérarchies d'erreurs `sealed` par feature, mappées depuis les types d'exception dio.
- Hygiène de disposal quasi parfaite (contrôleurs, tickers, streams) — vérifiée par cartographe dédié.
- Reduce-motion respecté à double niveau (réglage in-app + OS) sur chaque animation.
- Import DB transactionnel et versionné ; export couvrant 100 % du schéma.
- GlassCard documente un vrai post-mortem perf (BackdropFilter retiré après chauffe Android).

---

## 3. Fonctionnalités et maturité (revue produit)

| Feature | Maturité | Notes |
|---|---|---|
| Boot screen | complet | Joue à CHAQUE démarrage (8-10 s), skip seulement après la fin du typing → friction quotidienne |
| Hub Tools (8 outils) | complet | Compte « 371 jobs » hardcodé qui va dériver |
| Asteroid Analyzer | complet | Offline, validation par règle, solide |
| Fishing Map | complet | 96 zones dont 92 « Unknown » ; aucune couche perso (notes/favoris de zone) |
| Mars Express | **fonctionnel-brut** | La feature la plus habituante mais : état armé non persisté, annulation cassée (F6), 1 seule zone, pas de widget/Live Activity |
| Wallet Lookup | complet | ⚠️ mais problème RGPD majeur du dataset (F33) |
| System Scan | complet | Excellente transparence ; copy « seul outil qui parle au réseau » contredit par Tracker/Discoveries |
| Discoveries | complet | Handoff Discoveries→Tracker avec auto-track = très bon design produit |
| Tracker | complet | Fiche « how it works » exceptionnelle ; échelle de résolution MPC à 5 niveaux intelligente |
| Jobs board | complet | Filtres riches ; manque favoris/suivi « fait / en cours » |
| Captures (Notes+Liens) | complet | CRUD solide ; pas de pin, pas d'images, delete par appui long peu découvrable |
| Hangar | complet | Modèle riche (12 rôles, coque, localisation) ; MàJ de coque exige d'ouvrir tout l'éditeur |
| Knowledge base | **partiel** | Infrastructure complète mais 9/14 articles sont des placeholders — un onglet sur 5 sous-livre |
| Menu/Settings | complet | Posture vie privée exemplaire ; export manuel uniquement (pas de rappel de backup) |
| Design system | complet | Identité visuelle réelle, dark-only assumé |

**Manques transverses** : aucun widget/Live Activity (criant pour Mars Express, qui est littéralement un compte à rebours), pas d'onboarding, aucun favoris/épinglage nulle part, contenu 100 % compilé dans le binaire (toute MàJ de données de jeu = release stores), pas de recherche globale, pas de cross-linking entre features, pas de rappel de sauvegarde (une désinstallation détruit tout silencieusement).

---

## 4. Fonctionnement détaillé (résumé par sous-système)

- **Démarrage** : `main()` séquentiel (orientation → `AppNotifications.initialize()` avec chargement complet de la base timezone → SharedPreferences → `runApp`). L'init des notifications est **non protégée** : si le plugin jette (catégorie connue sur certains OEM Android), l'app ne démarre jamais (écran blanc, F29). Route initiale `/boot`, remplacée par `/tools`.
- **Navigation** : shell 5 branches à piles indépendantes ; tab bar custom « capsule de verre » avec pilule BackdropFilter animée. Aucun `errorBuilder`, redirect ni guard sur le router.
- **Captures** : `_resolveTags` charge tous les tags en mémoire, déduplique par nom lowercased, insère les nouveaux ; jointures delete-then-reinsert ; `pruneOrphanTags` (3 COUNT par tag) après CHAQUE mutation. **Rien n'est transactionnel** (F45).
- **Scan** : séquentiel Mercure→Pluton, mode Light (1 requête/planète) ou Full (2 requêtes : balayage large puis raffinement de la prochaine transition de secteur, fenêtres accordées aux périodes orbitales — bien conçu). Secteur = `atan2(y,x)` en 12 tranches de 30°, distance en « SL » (1 SL = 3 M miles). Garde `_generation` présente mais **pas incrémentée par `cancel()`/`dispose()`** (F12/F20).
- **Tracker** : échelle de résolution MPC (prefill → catalogue embarqué → numérique direct → SBDB ×2 → passthrough), puis Horizons VECTORS sur 3 dates candidates. **Aucune garde de génération** contrairement au scan (F19).
- **Mars Express** : le train boucle sur 60 minutes réelles ; `train_schedule.json` = 60 entrées minute→zone. Maths pures et testables (`MarsExpressService` statique). Alertes = 3 notifications exactes (T-2, T-1, arrivée) via `zonedSchedule`. **Le schéma d'IDs (70000 + zone×10 + i) suppose zone < 100 alors que les zones réelles vont de 234 à 346** → annulation à jamais inopérante (F6).
- **Export/import** : enveloppe JSON versionnée (formatVersion 1) couvrant les 10 tables, import transactionnel additif (jamais d'overwrite). Détails piégés : voir F1, F16, F36, F43, F60.
- **Assets** : 7+ loaders de catalogues embarqués font tous `catch (_) { return vide; }` — un asset corrompu ship comme un outil vide sans aucun diagnostic, et les branches d'erreur des vues sont du code mort (F28).

---

## 5. BLOQUANTS RELEASE (sévérité HIGH — à corriger avant toute distribution)

### H1. Permission INTERNET absente du manifest Android principal
`android/app/src/main/AndroidManifest.xml:3` — Seules les permissions de notification sont déclarées ; `INTERNET` n'existe que dans les manifests debug/profile. **Vérifié dans l'artefact compilé** (`build/.../release/AndroidManifest.xml` et l'AAB : pas de INTERNET). En release, Tracker/Scan/Discoveries jettent `SocketException` sur chaque appel, et google_fonts échoue. Invisible en debug.
**Fix** : ajouter `<uses-permission android:name="android.permission.INTERNET"/>` au manifest main. *(1 ligne)*

### H2. Aucune règle ProGuard/R8 → GSON de flutter_local_notifications cassé en release
`android/app/build.gradle.kts:57` — Flutter active `minifyEnabled` par défaut en release ; R8 full mode strippe les signatures génériques dont GSON (via `TypeToken`) a besoin dans le chemin `zonedSchedule`/boot-receiver du plugin (qui ne ship aucune règle consumer). Armer une alerte en release → `RuntimeException: Missing type parameter` ; crash du receiver au reboot.
**Fix** : créer `android/app/proguard-rules.pro` avec les règles GSON du plugin (`-keepattributes Signature`, keep `TypeToken` et sous-classes, `-keep class com.dexterous.flutterlocalnotifications.** { *; }`), puis **tester l'armement d'une alerte sur un build `--release`**.

### H3. Import : associations de tags silencieusement détruites entre appareils
`lib/services/data_export.dart:196` — Quand un tag importé porte un nom déjà existant localement (UUID différent), il est sauté **sans remap d'ID** ; toutes les lignes `noteTags/linkTags/shipTags` référençant l'UUID importé échouent `ensureTagId` et sont jetées en silence. Le scénario nominal « déplacer mes données vers un nouvel appareil » perd précisément les tags que l'utilisateur emploie le plus (ceux recréés sur les deux appareils). La snackbar annonce un succès.
**Fix** : construire `remap[importedId] = existingLocalTagId` au moment du skip, et résoudre `b = remap[b] ?? b` dans `insertJoin`.

### H4. Images KB décodées à pleine résolution (jusqu'à 4086×4086, ~67 Mo décodés)
`lib/features/knowledge/widgets/kb_markdown_view.dart:30` — `Image.asset` nu sans `cacheWidth`. `space-station-map.png` (4086², ~67 Mo RGBA) + `hideous-dungeon-map.jpg` (~32 Mo) remplissent quasiment l'ImageCache à eux deux, pour un affichage à ~380 px. OOM réaliste sur Android 1,5-2 Go ; 4086 px frôle la taille de texture max (4096) des vieux GPU.
**Fix** : `cacheWidth` sur le builder d'images + redimensionner/compresser les assets (rien ne justifie > 2000 px), envisager WebP.

*(H1 et un doublon de H1 trouvé indépendamment par la dimension sécurité comptent pour 2 des 5 HIGH.)*

---

## 6. Bugs fonctionnels confirmés (MEDIUM — l'app ment ou perd des données)

**Notifications / Mars Express**
- **F6** `notifications.dart:131` — IDs réels (72340–73462) hors plage `cancelGroup` [70000-70999] → « Cancel alerts » ne supprime jamais rien ; armer une 2ᵉ zone empile les notifications des deux. Fix simple : 3 IDs fixes (une seule zone armable).
- **F35** `notifications.dart:143` — `arm()` retourne `false` aussi quand les 3 dates sont passées/trop proches → l'UI accuse à tort « permission refusée ».
- **F25** `AndroidManifest.xml:6` — `USE_EXACT_ALARM` déclaré : risque de rejet Google Play (réservé alarmes/calendriers) ; aucun fallback inexact si l'exact est refusé (PlatformException non catchée).
- **F26** `notifications.dart:76` — `InterruptionLevel.timeSensitive` sans entitlement iOS → silencieusement dégradé : les alertes sont supprimées par Focus/DND, exactement le scénario qu'elles visent.
- État armé non persisté (StateNotifier mémoire) : après restart, l'UI oublie la zone armée mais les notifications OS tirent quand même.

**Tracker / Scan / Discoveries**
- **F7** `tracker_controller.dart:149` — le contrôleur `watch` le FutureProvider du catalogue → recréé quand l'asset arrive, annulant la requête en vol et vidant l'état. Le flux « Track this object live » depuis Discoveries échoue au premier usage (paraît flaky).
- **F19/F34** `tracker_controller.dart:103` — aucune garde de génération : le handler d'annulation de l'ancienne requête écrase le Loading de la nouvelle ; écriture d'état après dispose (crash debug).
- **F12/F20** `scan_controller.dart:80,131` — `cancel()`/`dispose()` n'incrémentent pas `_generation` : scan annulé/abandonné → écriture sur notifier disposé (crash debug) + **enregistrement en historique d'un scan partiel marqué « sans erreur »**, indiscernable d'un scan complet.
- **F9** `celestial_client.dart:150` — le champ SBDB `diameter` est en **kilomètres** mais stocké/affiché en mètres (Cérès : « 939.4 m ») ; le seuil d'alerte 140 m ne se déclenche jamais (vérifié contre l'API live).
- **F10** `celestial_client.dart:23` — minuits **locaux** du date-picker traités comme instants UTC : à Vienne les requêtes portent sur J-1 (résultats décalés d'un jour) ; à l'ouest d'UTC, choisir « aujourd'hui » (pourtant autorisé) jette « Pick a date no later than today ».
- **F15** `celestial_client.dart:44` — troncature silencieuse à `limit=1000` (le champ `count` de la réponse n'est jamais lu) : une année d'astéroïdes = dizaines de milliers de découvertes présentées, persistées et partagées comme « 1000 objets » complets.
- **F37** `celestial_view.dart:114` — le bouton stop efface les résultats précédents et affiche une carte d'erreur rouge « Request cancelled. ».

**Jobs / Captures / Partage**
- **F11** `job_filter.dart:217` — filtre bonus par défaut `[0, 500]` alors que 11 jobs sur 371 ont un bonus négatif (jusqu'à −2740) : **invisibles à jamais**, aucun réglage ne peut les révéler (slider borné à 0), UI dit « 0 filtre actif ».
- **F14** éditeurs note/lien/vaisseau : bottom sheets dismissibles sans garde `PopScope` ni brouillon — un glissement/tap hors sheet détruit 10+ champs saisis.
- **F38** `tag_input_field.dart:61` — le texte de tag non « commité » (pas de virgule/entrée) est silencieusement perdu au Save.
- **F13** `share_card.dart:75` — `sharePositionOrigin` absent : sur iPad (ciblé `TARGETED_DEVICE_FAMILY 1,2`), share_plus 11.1.0 **jette une FlutterError sans afficher la share sheet** → tout partage de carte échoue sur iPad.

**Import/Export (en plus de H3)**
- **F16/F30** `data_export.dart:387-415` — `payloadJson` accepté sans validation (fallback `'{}'` garanti imparsable) : une ligne corrompue fait échouer `watchAll()` entier ; les sheets d'historique affichent « Error: … » et **masquent le bouton de purge** → feature briquée définitivement, seule issue = réinstallation.
- **F43** — import insert-only : les éditions plus récentes d'un backup ne sont jamais appliquées (« Nothing imported » lit comme « déjà synchronisé »).
- **F36/F42** — compteurs d'import mensongers (lignes ignorées par `insertOrIgnore` quand même comptées).
- **F60** — erreurs brutes Dart montrées à l'utilisateur (« type 'Null' is not a subtype of type 'String' in type cast »).

**Réseau (résilience)**
- **F17** — **aucun `connectTimeout`** sur les 3 clients dio : sur réseau zombie (Wi-Fi captif, VPN semi-mort), la phase connexion bloque sur les défauts OS (~75 s iOS, 2 min+ Android) ; un scan complet peut moudre 10+ minutes. Les branches `connectionTimeout` gérées partout sont du **code mort** (le type ne peut jamais être émis).
- **F18** `tracker_client.dart:157` — SBDB signale les multi-correspondances par **HTTP 300** que dio rejette par défaut → le code de gestion de liste (lignes 148-155) est inaccessible ; « Halley » → « Couldn't resolve an MPC ID ». Les 503 de maintenance JPL sont aussi convertis en « no match ».
- **F48** — aucun retry/backoff contre des endpoints JPL notoirement instables : un 503 transitoire = planète en erreur pour tout le scan (seule récupération : tout relancer, plusieurs minutes).
- **F47** — parsing Horizons sans ancrage `$$SOE/$$EOE`, unités jamais épinglées (`OUT_UNITS` absent), messages d'erreur in-band (rate-limit, « API SERVER BUSY ») silencieusement convertis en « No data returned ».

---

## 7. Sécurité & vie privée

- **F33 (le plus sérieux)** `assets/catalog/wallets.json` — **769 pseudos Discord réels mappés à leurs adresses de wallet WAX, embarqués dans chaque binaire** et rendus en cartes PNG partageables. C'est un appariement dé-anonymisant (donnée personnelle RGPD, développeur basé UE). Toute demande d'effacement exige un cycle de release par version passée ; aucune trace de consentement. **Recommandation : documenter la provenance/consentement, ou servir la liste depuis un hôte distant (suppressions sans release), + mention de retrait dans l'app.** Impacte aussi les déclarations privacy App Store/Play.
- **F70** `markdown_view.dart:21` (+ kb_markdown_view, link_detail_view) — `launchUrl` sans allowlist de schémas sur du contenu **importable** (les exports circulent sur Discord par design) : un backup trafiqué peut cacher `tel:`, `sms:`, schémas d'apps derrière un texte de lien innocent. Fix : allowlist http/https/mailto.
- **F71** `data_export.dart:129` — les exports JSON complets (toutes les données) s'accumulent en clair dans le répertoire temporaire, jamais supprimés après partage. Fix : supprimer après la share sheet ou balayer au démarrage.
- **F73/F58** `build.gradle.kts:59` — fallback **silencieux** sur la signature debug quand `keystore.properties` manque : un build release signé debug peut partir en distribution (rejet Play, ou artefact non upgradable). Fix : `GradleException` si keystore absent en release.
- **F74/F21** — google_fonts fetch runtime : trafic vers fonts.gstatic.com au premier lancement (non déclaré, contredit le positionnement « local-first » et la copy du Scan), et rendu en polices fallback hors-ligne. Fix : bundler les 3 familles + `allowRuntimeFetching = false`.
- **F72/F56** — 5 fichiers doublons Finder («  2 ») trackés dans git, contenant des chemins absolus locaux ; contournent le .gitignore (noms exacts).
- Points sains vérifiés : aucun secret/API key dans le repo, keystore correctement gitignoré et jamais commité, HTTPS partout, permissions Android minimales et justifiées, descriptions d'usage iOS présentes pour image_picker.

---

## 8. Performance

- **F22** `planet_glyph.dart:173` — page Scan : 9 glyphes × 2 AnimationControllers infinis = 18 tickers, 2 `MaskFilter.blur` par glyphe par frame, **aucun RepaintBoundary dans toute l'app** (hors share cards) → toute la page re-rasterise à 60-120 fps tant qu'elle est ouverte (y compris pendant un scan Full de plusieurs minutes). Fix : RepaintBoundary par glyphe + `CustomPainter(repaint:)` au lieu d'AnimatedBuilder.
- **F24** `evil_ship_intro.dart:607` — portail EVIL : 6 couches de blur gaussien (sigma jusqu'à 70) recalculées chaque frame par un ticker **jamais arrêté** une fois l'animation finie — drain batterie/thermique tant que l'utilisateur ne touche pas l'écran.
- **F23** `scan_repository.dart:64` (+ tracker, celestial) — historiques : tables non bornées, `jsonDecode` de chaque ligne sur l'isolate UI à chaque émission, StreamProviders **non-autoDispose** (watch vivant à vie après première ouverture), rendu eager de toutes les cartes (PageScrollView désamorce la virtualisation — le même piège déjà corrigé et documenté dans jobs_view).
- **F53** `transmission_header.dart:79` — la PulsingDot décorative de 6 px empêche l'app d'atteindre l'idle : une frame est produite à la fréquence d'affichage sur **tous** les écrans, en permanence.
- **F49** particules du boot : `setState` par frame + grille hexagonale (~200 chemins) re-tessellée chaque frame faute de RepaintBoundary.
- **F50** `typography.dart` — tous les styles sont des **getters** qui re-traversent google_fonts à chaque accès (564 sites d'appel, souvent dans des builders par frame). Fix : `static final`.
- **F51** `pruneOrphanTags` : 3 COUNT séquentiels **par tag** après chaque save/delete (300 requêtes pour 100 tags).
- **F52** jobs.json (332 Ko) décodé synchrone sur l'isolate UI pendant la transition de route.

---

## 9. Qualité, accessibilité, maintenabilité

- **F27** — un seul test : `expect(1+1, 2)`. Tests à plus fort levier, dans l'ordre : round-trip export/import contre `AppDatabase.forTesting` (existe déjà, inutilisé) > fixtures HorizonsParser (réponse réelle capturée) > maths secteur/SL > résolution de noms TrackerClient > AsteroidDecoder > fenêtres MarsExpressService/TrainAlert.
- **F29** — aucun `FlutterError.onError`/`runZonedGuarded`/crash reporting/log (zéro `debugPrint` dans tout lib/), 21 `catch (_)` muets ; `AppNotifications.initialize()` non protégé avant `runApp` (écran blanc permanent possible).
- **F28** — 7+ loaders d'assets avalent toute erreur → outils vides silencieux, branches d'erreur des vues mortes.
- **F31** — **zéro Semantics dans 121 fichiers** : tab bar, NeonButton (CTA principal), ToolCard, lignes de settings = GestureDetectors nus sans rôle bouton/tab ni état sélectionné/désactivé ; IconButtons sans tooltip.
- **F32** — `textDim` (#4F6A87) à ~3,0-3,6:1 de contraste (WCAG AA exige 4,5:1), utilisé 63 fois dont du contenu informatif à 10 px, aussi cuit dans les PNG partagés. Fix à un token.
- **F69** — nav labels sous `FittedBox` qui annule le réglage de taille de police système ; share cards héritant du textScaler → PNG avec overflow cuit à 200 %.
- **F62** — 537 strings anglaises en dur, aucune infra l10n (choix acceptable si documenté, mais porte à sens unique).
- **F63** — riverpod_lint/custom_lint installés mais **jamais activés** (pas de section `analyzer: plugins:`), aucune strictness ; les casts non vérifiés de data_export passent en silence.
- **F64** — triplication (~700 lignes) : 3 repositories d'historique clones, 3 sheets clones, 3 mappers d'erreurs dio clones. Toute correction (ex. la récupération du F16) doit être appliquée 3 fois.
- **F65** — god files : ship_editor_view (995 lignes, logique métier dans la vue), celestial_view (982 lignes, tout le cycle réseau dans le State du widget, contrairement à scan/tracker qui ont des contrôleurs).
- **F66** — code mort avéré (`_CaptureCompleter`, `dedupeId`, primitives animées sans call-site, `AppMotion` jamais référencé).
- **F67** — version « v0.2.0 » en dur dans 3 vues (dont le corps des emails de bug) ; fix : package_info_plus + un provider.
- **F68** — haptique de succès tirée AVANT l'écriture DB, sans try/catch : un échec d'écriture ressemble à un succès.
- **F61** — capture de share card : échec 100 % silencieux (catch muet + bool ignoré aux 6 call-sites, haptique déjà tirée).
- **F44/F45/F46** — schéma sans FK/UNIQUE (orphelins rendant des tags impossibles à purger), mutations multi-statements non transactionnelles (kill mid-save = taxonomie de tags perdue), `schemaVersion 1` sans MigrationStrategy (le premier changement de schéma cassera les installs existantes d'une des deux façons par défaut de drift).

**Bugs signalés par la cartographie (cohérents avec le code cité, non passés par la contre-vérification) :**
- `ship_editor_view.dart:190` — condition **inversée** sur `customModelLabel` : le libellé custom saisi est jeté pour les modèles sans préfixe, et du texte résiduel caché est persisté pour les modèles à préfixe.
- Pickers modèle/localisation : fermer la sheet sans choisir **réinitialise la sélection à « aucun »** (le `null` de dismissal est indistinguable du choix explicite « No model »).
- Recherches « fantômes » : `notesSearch/linksSearch/kbSearch/walletQuery` sont des StateProviders globaux non liés aux TextFields → champ vide affichant les résultats de l'ancienne requête après navigation (4 occurrences du même pattern, la variante wallet confirmée en F40).
- `kb_category_view.dart` — categoryId inconnu → retombe silencieusement sur la première catégorie ; `requireValue` dans un orElse ; mapping d'icônes SF Symbols divergent entre home et catégorie.
- Copy mensongère : « This is the only feature in Underdeck that talks to a network » (Scan) contredit par Tracker/Discoveries et la FAQ ; « Stored: Nothing » contredit par l'historique local ; « 1 to 4 GET requests » alors que le pire cas est 5 ; « About 60 well-known bodies » pour un catalogue de 15.

---

## 10. Plan d'action priorisé (pour Opus)

### P0 — Avant tout commit / toute distribution (1 journée)
1. **Assainir git** : dé-stager le rename iOS abandonné (`git restore --staged ios/Underdeck*`), re-stager le bon `MainActivity.kt`, tracker `scripts/` + `assets/knowledge/03-guilds/ 04-shires/` + `assets/catalog/jobs.json`, supprimer les 5 fichiers «  2 », commit propre, **créer un remote**.
2. **H1** : permission INTERNET (1 ligne).
3. **H2** : proguard-rules.pro + test d'une alerte sur build `--release`.
4. **F73** : échouer bruyamment si keystore absent en release.
5. **F6** : IDs de notifications fixes (l'annulation d'alertes fonctionne enfin).

### P1 — Fiabilité des données et du réseau (le cœur du travail)
6. **H3 + F16 + F36 + F43 + F60** : refonte ciblée de `data_export.dart` — remap d'IDs de tags, validation `payloadJson` par round-trip, comptages exacts, messages humains ; rendre les `fromRow` d'historique tolérants et garder le bouton de purge visible en état d'erreur. **Écrire le test de round-trip en premier** (`AppDatabase.forTesting`).
7. **Réseau partagé** : un Dio injecté unique avec `BaseOptions(connectTimeout: 10 s)`, retry borné (2×, backoff) sur 5xx/connexion (F17, F48) ; `validateStatus` acceptant 300 + rethrow des 5xx en erreurs HTTP dans le SBDB lookup (F18) ; ancrage `$$SOE/$$EOE` + `OUT_UNITS='KM-S'` (F47).
8. **Gardes de génération/mounted** : cancel()/dispose() de ScanController (F12/F20), TrackerController (F19), CelestialView (F37) ; ne plus watch le catalogue dans le provider du tracker (F7).
9. **Corrections unités/dates/filtres** : diamètre km→m (F9), dates calendaires sans toUtc() (F10), bornes du filtre bonus dérivées des données (F11), indicateur de troncature à 1000 (F15).
10. **Base** : transactions sur toutes les mutations multi-statements (F45), `MigrationStrategy` + snapshots de schéma drift (F46), FK/UNIQUE avec bump de version (F44).
11. **Filet global** : `runZonedGuarded` + `FlutterError.onError`, try/catch autour de l'init notifications, logger les 21 catch muets (F29) ; laisser les loaders d'assets échouer vers les branches d'erreur existantes (F28).
12. **RGPD wallets** (F33) : décision produit à prendre — provenance documentée ou distribution distante.

### P2 — Expérience, perf, accessibilité
13. PopScope + garde « modifications non enregistrées » sur les 3 éditeurs (F14) ; commit du tag en attente au save (F38) ; fix condition inversée + dismissal des pickers du ship editor.
14. `sharePositionOrigin` partout (F13) + feedback d'échec de partage (F61) ; haptique après le write (F68).
15. Perf : RepaintBoundary + `repaint:` sur les painters animés (F22, F49), arrêt du ticker du portail (F24), autoDispose + LIMIT + decode différé sur les historiques (F23), `static final` typographie (F50), polices bundlées (F21/F74), PulsingDot à bas régime (F53).
16. Accessibilité : Semantics sur tab bar/NeonButton/ToolCard (F31), token textDim (F32), text scaling (F69).
17. Notifications : retirer USE_EXACT_ALARM + fallback inexact (F25), entitlement time-sensitive (F26), icône de statut monochrome (F57), persister l'état armé.
18. UX : boot instantanément skippable + réglage « fast boot », recherche liée aux contrôleurs (les 4 stale-search), messages d'erreur humains, unifier la triplication historique (F64), extraire CelestialController (F65), package_info_plus (F67), activer riverpod_lint + strict-casts (F63), corriger les copys mensongères (transparence = la marque de l'app).
19. Décision iOS : abaisser le floor 18.0 → 15/16 sauf justification (F55) ; documenter la migration de l'applicationId (F41).

### P3 — Produit (issu de la revue produit, par levier décroissant)
20. **Live Activity / Dynamic Island + widget home-screen pour Mars Express** (le hook de rétention naturel — la feature est un compte à rebours).
21. **Alertes train persistées, multi-zones, récurrentes** (petit effort, gros gain de confiance).
22. **Favoris + suivi de progression** (jobs faits/en cours, articles KB, zones de pêche, objets trackés) — le pas décisif de « app de consultation » vers « compagnon ».
23. **Onboarding 3 cartes « incoming transmission »** (vocabulaire ESSI/SL/secteurs).
24. **Packs de contenu distants opt-in** (JSON versionné sur hôte statique : jobs, wallets, schedule — découple la fraîcheur des releases, garde la posture privacy, et résout une partie du problème RGPD wallets).
25. **Rappel de backup + auto-export** (« Dernier backup : il y a 34 jours ») — le pire scénario actuel est un joueur fidèle perdant tout à un changement de téléphone.
26. Share cards Jobs/pêche (infra existante, acquisition organique via Discord) ; stepper de coque sur la carte Hangar ; boucle de contribution communautaire pour les 9 articles KB placeholders.

---

## 11. Constats réfutés par la vérification (pour mémoire)

- « Le chemin historique 50 000 lignes de Discoveries perd des données par ordre serveur non documenté » — réfuté empiriquement contre l'API SBDB live.
- « Spinner infini sur note/lien supprimé via deep link » — le code existe mais aucun deep link n'est configuré : scénario inatteignable aujourd'hui (à retenir si des deep links sont ajoutés).

---

*Rapport généré par audit multi-agents Claude (workflow `underdeck-full-audit`). Chaque constat des sections 5-9 a survécu à une contre-vérification adversariale menée sur le code réel (et pour H1/F9, contre l'artefact compilé et l'API live respectivement).*

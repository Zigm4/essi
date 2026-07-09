import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' as drift;
import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:uuid/uuid.dart';

import '../data/database/app_database.dart';
import '../features/tools/celestial/domain/celestial_models.dart';
import '../features/tools/scan/domain/scan_models.dart';
import '../features/tools/tracker/domain/tracker_models.dart';

class DataExportService {
  DataExportService(this._db);
  final AppDatabase _db;
  static const _uuid = Uuid();
  static const formatVersion = 1;

  /// Test/diagnostic hook: builds the same export payload that
  /// [exportToFile] writes, without touching the filesystem or plugins.
  @visibleForTesting
  Future<Map<String, dynamic>> collect() => _collect();

  Future<Map<String, dynamic>> _collect() async {
    final notes = await _db.select(_db.notes).get();
    final links = await _db.select(_db.links).get();
    final tags = await _db.select(_db.tags).get();
    final noteTags = await _db.select(_db.noteTags).get();
    final linkTags = await _db.select(_db.linkTags).get();
    final shipTags = await _db.select(_db.shipTags).get();
    final ships = await _db.select(_db.ships).get();
    final scanHistory = await _db.select(_db.scanHistory).get();
    final trackerHistory = await _db.select(_db.trackerHistory).get();
    final discoveryHistory = await _db.select(_db.discoveryHistory).get();

    Map<String, dynamic> noteMap(Note n) => {
      'id': n.id,
      'title': n.title,
      'body': n.body,
      'createdAt': n.createdAt.toUtc().toIso8601String(),
      'updatedAt': n.updatedAt.toUtc().toIso8601String(),
    };
    Map<String, dynamic> linkMap(Link l) => {
      'id': l.id,
      'title': l.title,
      'url': l.url,
      'note': l.note,
      'createdAt': l.createdAt.toUtc().toIso8601String(),
      'updatedAt': l.updatedAt.toUtc().toIso8601String(),
    };
    Map<String, dynamic> tagMap(Tag t) => {
      'id': t.id,
      'displayName': t.displayName,
      'name': t.name,
      'colorHex': t.colorHex,
    };
    Map<String, dynamic> shipMap(Ship s) => {
      'id': s.id,
      'name': s.name,
      'modelKey': s.modelKey,
      'customModelLabel': s.customModelLabel,
      'registered': s.registered,
      'locationKey': s.locationKey,
      'customLocation': s.customLocation,
      'locationZone': s.locationZone,
      'locationSector': s.locationSector,
      'locationSL': s.locationSL,
      'hull': s.hull,
      'pilotName': s.pilotName,
      'gunnerName': s.gunnerName,
      'cartographerName': s.cartographerName,
      'prospectorName': s.prospectorName,
      'signallerName': s.signallerName,
      'technicianName': s.technicianName,
      'sentryName': s.sentryName,
      'fabricatorName': s.fabricatorName,
      'medicName': s.medicName,
      'quartermasterName': s.quartermasterName,
      'chefName': s.chefName,
      'alchemistName': s.alchemistName,
      'note': s.note,
      'createdAt': s.createdAt.toUtc().toIso8601String(),
      'updatedAt': s.updatedAt.toUtc().toIso8601String(),
    };

    return {
      'version': formatVersion,
      'app': 'Underdeck',
      'exportedAt': DateTime.now().toUtc().toIso8601String(),
      'data': {
        'notes': notes.map(noteMap).toList(),
        'links': links.map(linkMap).toList(),
        'tags': tags.map(tagMap).toList(),
        'noteTags': noteTags.map((nt) => {'noteId': nt.noteId, 'tagId': nt.tagId}).toList(),
        'linkTags': linkTags.map((lt) => {'linkId': lt.linkId, 'tagId': lt.tagId}).toList(),
        'shipTags': shipTags.map((st) => {'shipId': st.shipId, 'tagId': st.tagId}).toList(),
        'ships': ships.map(shipMap).toList(),
        'scanHistory': scanHistory.map((s) => {
          'id': s.id,
          'date': s.date.toUtc().toIso8601String(),
          'mode': s.mode,
          'payloadJson': s.payloadJson,
          'errored': s.errored,
        }).toList(),
        'trackerHistory': trackerHistory.map((t) => {
          'id': t.id,
          'date': t.date.toUtc().toIso8601String(),
          'mode': t.mode,
          'payloadJson': t.payloadJson,
          'errored': t.errored,
        }).toList(),
        'discoveryHistory': discoveryHistory.map((d) => {
          'id': d.id,
          'date': d.date.toUtc().toIso8601String(),
          'mode': d.mode,
          'payloadJson': d.payloadJson,
          'errored': d.errored,
        }).toList(),
      },
    };
  }

  Future<File> exportToFile() async {
    final payload = await _collect();
    final tempDir = await getTemporaryDirectory();
    final stamp = DateTime.now()
        .toIso8601String()
        .replaceAll(':', '-')
        .replaceAll('.', '-')
        .substring(0, 19);
    final file = File(p.join(tempDir.path, 'underdeck-export-$stamp.json'));
    await file.writeAsString(jsonEncode(payload));
    return file;
  }

  Future<void> shareExport({Rect? sharePositionOrigin}) async {
    final file = await exportToFile();
    // Intentionally no `text` — share-sheet should not auto-fill a body so
    // the user can compose their own message (or none).
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'application/json')],
        sharePositionOrigin: sharePositionOrigin,
      ),
    );
  }

  Future<ImportSummary> importFromUserPick() async {
    // iOS requires `uniformTypeIdentifiers` to enable JSON files in the
    // document picker; mimeTypes/extensions alone leave them disabled.
    const typeGroup = XTypeGroup(
      label: 'JSON',
      extensions: ['json'],
      mimeTypes: ['application/json'],
      uniformTypeIdentifiers: ['public.json'],
    );
    final picked = await openFile(acceptedTypeGroups: [typeGroup]);
    if (picked == null) return ImportSummary.empty();
    return importFromFile(File(picked.path));
  }

  /// Human-facing message for any file that isn't a well-formed export.
  static const _invalidFileMessage = "This file isn't a valid Underdeck export";

  Future<ImportSummary> importFromFile(File file) async {
    final raw = await file.readAsString();
    final dynamic j;
    try {
      j = jsonDecode(raw);
    } on FormatException {
      // F60: unparseable JSON → fixed human string, not a raw parser dump.
      throw const FormatException(_invalidFileMessage);
    }
    if (j is! Map<String, dynamic>) {
      throw const FormatException(_invalidFileMessage);
    }
    final version = j['version'];
    if (version is! int || version > formatVersion) {
      throw FormatException(
          'Unsupported export version: $version (expected ≤ $formatVersion)');
    }
    final data = j['data'];
    if (data is! Map<String, dynamic>) {
      throw const FormatException(_invalidFileMessage);
    }
    try {
      return await _import(data);
    } on TypeError {
      // F60: a required field was missing/mistyped when casting a record.
      throw const FormatException(_invalidFileMessage);
    }
  }

  Future<ImportSummary> _import(Map<String, dynamic> data) async {
    int notes = 0, links = 0, tags = 0, ships = 0;
    int scan = 0, tracker = 0, discovery = 0;

    // Tolerant: a malformed/absent date must never throw and abort the whole
    // import (a single poisoned row would otherwise take the file down).
    DateTime parseDate(dynamic v) =>
        (v is String ? DateTime.tryParse(v) : null) ?? DateTime.now();

    String dedupeId(String fallback) => _uuid.v4();
    final unused = dedupeId; // ignore: unused_local_variable

    await _db.transaction(() async {
      // Tags first (to satisfy foreign-key-like checks even though we don't have hard FKs)
      final existingTags = await _db.select(_db.tags).get();
      final tagsByKey = {for (final t in existingTags) t.name: t.id};

      // H3: translate every imported tag id to the id actually used locally.
      // When an imported tag collides by NAME with a pre-existing local tag
      // (different uuid), we skip the insert but still remap the imported id
      // onto the existing local id so join rows are preserved, not dropped.
      final tagRemap = <String, String>{};

      for (final t in (data['tags'] as List<dynamic>? ?? const [])) {
        final m = t as Map<String, dynamic>;
        final importedId = (m['id'] as String?) ?? _uuid.v4();
        final key = (m['name'] as String? ?? '').toLowerCase();
        if (tagsByKey.containsKey(key)) {
          // Name collision: reuse the existing local tag id.
          tagRemap[importedId] = tagsByKey[key]!;
          continue;
        }
        await _db.into(_db.tags).insert(
          TagsCompanion.insert(
            id: importedId,
            displayName: (m['displayName'] as String?) ?? key,
            name: key,
            colorHex: drift.Value(m['colorHex'] as String?),
          ),
          mode: drift.InsertMode.insertOrIgnore,
        );
        tagsByKey[key] = importedId;
        tagRemap[importedId] = importedId;
        tags++;
      }

      // Resolves an imported tag id to a real local tag id (via the remap for
      // collisions/fresh inserts, else by direct id lookup), or null if the
      // referenced tag doesn't exist locally.
      Future<String?> ensureTagId(String idCandidate) async {
        final mapped = tagRemap[idCandidate] ?? idCandidate;
        final exists = await (_db.select(_db.tags)
              ..where((t) => t.id.equals(mapped)))
            .getSingleOrNull();
        return exists?.id;
      }

      Future<int> insertSimple<T>({
        required Iterable items,
        required Future<bool> Function(Map<String, dynamic>) insertFn,
      }) async {
        var count = 0;
        for (final raw in items) {
          if (await insertFn(raw as Map<String, dynamic>)) count++;
        }
        return count;
      }

      notes = await insertSimple(
        items: (data['notes'] as List<dynamic>? ?? const []),
        insertFn: (m) async {
          final id = m['id'] as String? ?? _uuid.v4();
          final updatedAt = parseDate(m['updatedAt']);
          final exists = await (_db.select(_db.notes)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) {
            // F43: newer-wins — overwrite the local row only when the imported
            // copy is strictly newer; otherwise leave it and don't count it.
            if (!updatedAt.isAfter(exists.updatedAt)) return false;
            await (_db.update(_db.notes)..where((t) => t.id.equals(id))).write(
              // createdAt intentionally omitted: an update must preserve the
              // original creation timestamp, not overwrite it (F43 regression).
              NotesCompanion(
                title: drift.Value(m['title'] as String? ?? ''),
                body: drift.Value(m['body'] as String? ?? ''),
                updatedAt: drift.Value(updatedAt),
              ),
            );
            return true;
          }
          await _db.into(_db.notes).insert(
            NotesCompanion.insert(
              id: id,
              title: drift.Value(m['title'] as String? ?? ''),
              body: drift.Value(m['body'] as String? ?? ''),
              createdAt: parseDate(m['createdAt']),
              updatedAt: updatedAt,
            ),
            mode: drift.InsertMode.insertOrIgnore,
          );
          return true;
        },
      );

      links = await insertSimple(
        items: (data['links'] as List<dynamic>? ?? const []),
        insertFn: (m) async {
          final id = m['id'] as String? ?? _uuid.v4();
          final updatedAt = parseDate(m['updatedAt']);
          final exists = await (_db.select(_db.links)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) {
            // F43: newer-wins update.
            if (!updatedAt.isAfter(exists.updatedAt)) return false;
            await (_db.update(_db.links)..where((t) => t.id.equals(id))).write(
              // createdAt intentionally omitted (see notes update above): an
              // update must preserve the original creation timestamp (F43).
              LinksCompanion(
                title: drift.Value(m['title'] as String? ?? ''),
                url: drift.Value(m['url'] as String? ?? ''),
                note: drift.Value(m['note'] as String? ?? ''),
                updatedAt: drift.Value(updatedAt),
              ),
            );
            return true;
          }
          await _db.into(_db.links).insert(
            LinksCompanion.insert(
              id: id,
              title: drift.Value(m['title'] as String? ?? ''),
              url: drift.Value(m['url'] as String? ?? ''),
              note: drift.Value(m['note'] as String? ?? ''),
              createdAt: parseDate(m['createdAt']),
              updatedAt: updatedAt,
            ),
            mode: drift.InsertMode.insertOrIgnore,
          );
          return true;
        },
      );

      ships = await insertSimple(
        items: (data['ships'] as List<dynamic>? ?? const []),
        insertFn: (m) async {
          final id = m['id'] as String? ?? _uuid.v4();
          final updatedAt = parseDate(m['updatedAt']);
          final values = ShipsCompanion(
            id: drift.Value(id),
            name: drift.Value(m['name'] as String? ?? ''),
            modelKey: drift.Value(m['modelKey'] as String?),
            customModelLabel: drift.Value(m['customModelLabel'] as String?),
            registered: drift.Value(m['registered'] as bool? ?? false),
            locationKey: drift.Value(m['locationKey'] as String?),
            customLocation: drift.Value(m['customLocation'] as String?),
            locationZone: drift.Value(m['locationZone'] as int?),
            locationSector: drift.Value(m['locationSector'] as String?),
            locationSL: drift.Value(m['locationSL'] as int?),
            hull: drift.Value(m['hull'] as int?),
            pilotName: drift.Value(m['pilotName'] as String?),
            gunnerName: drift.Value(m['gunnerName'] as String?),
            cartographerName: drift.Value(m['cartographerName'] as String?),
            prospectorName: drift.Value(m['prospectorName'] as String?),
            signallerName: drift.Value(m['signallerName'] as String?),
            technicianName: drift.Value(m['technicianName'] as String?),
            sentryName: drift.Value(m['sentryName'] as String?),
            fabricatorName: drift.Value(m['fabricatorName'] as String?),
            medicName: drift.Value(m['medicName'] as String?),
            quartermasterName: drift.Value(m['quartermasterName'] as String?),
            chefName: drift.Value(m['chefName'] as String?),
            alchemistName: drift.Value(m['alchemistName'] as String?),
            note: drift.Value(m['note'] as String? ?? ''),
            createdAt: drift.Value(parseDate(m['createdAt'])),
            updatedAt: drift.Value(updatedAt),
          );
          final exists = await (_db.select(_db.ships)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) {
            // F43: newer-wins update.
            if (!updatedAt.isAfter(exists.updatedAt)) return false;
            // Preserve the original createdAt on update (F43): the shared
            // `values` companion carries it for the insert path only.
            await (_db.update(_db.ships)..where((t) => t.id.equals(id)))
                .write(values.copyWith(createdAt: const drift.Value.absent()));
            return true;
          }
          await _db.into(_db.ships).insert(
            values,
            mode: drift.InsertMode.insertOrIgnore,
          );
          return true;
        },
      );

      Future<void> insertJoin({
        required Iterable items,
        required String idA,
        required String idB,
        required Future<bool> Function(String) parentExists,
        required Future<void> Function(String, String) insertFn,
      }) async {
        for (final raw in items) {
          final m = raw as Map<String, dynamic>;
          final a = m[idA] as String?;
          final b = m[idB] as String?;
          if (a == null || b == null) continue;
          final tagOK = await ensureTagId(b);
          if (tagOK == null) continue;
          // F44: the join tables now enforce foreign keys, so inserting a row
          // whose parent doesn't exist locally would abort the whole import.
          // Skip such orphan rows instead.
          if (!await parentExists(a)) continue;
          // H3: use the resolved local tag id, not the raw imported one.
          await insertFn(a, tagOK);
        }
      }
      await insertJoin(
        items: (data['noteTags'] as List<dynamic>? ?? const []),
        idA: 'noteId',
        idB: 'tagId',
        parentExists: (a) async =>
            await (_db.select(_db.notes)..where((t) => t.id.equals(a)))
                .getSingleOrNull() !=
            null,
        insertFn: (a, b) async {
          await _db.into(_db.noteTags).insert(
            NoteTagsCompanion.insert(noteId: a, tagId: b),
            mode: drift.InsertMode.insertOrIgnore,
          );
        },
      );
      await insertJoin(
        items: (data['linkTags'] as List<dynamic>? ?? const []),
        idA: 'linkId',
        idB: 'tagId',
        parentExists: (a) async =>
            await (_db.select(_db.links)..where((t) => t.id.equals(a)))
                .getSingleOrNull() !=
            null,
        insertFn: (a, b) async {
          await _db.into(_db.linkTags).insert(
            LinkTagsCompanion.insert(linkId: a, tagId: b),
            mode: drift.InsertMode.insertOrIgnore,
          );
        },
      );
      await insertJoin(
        items: (data['shipTags'] as List<dynamic>? ?? const []),
        idA: 'shipId',
        idB: 'tagId',
        parentExists: (a) async =>
            await (_db.select(_db.ships)..where((t) => t.id.equals(a)))
                .getSingleOrNull() !=
            null,
        insertFn: (a, b) async {
          await _db.into(_db.shipTags).insert(
            ShipTagsCompanion.insert(shipId: a, tagId: b),
            mode: drift.InsertMode.insertOrIgnore,
          );
        },
      );

      // F16: validate a history payload by round-tripping it through the same
      // fromJson path the repositories use at read time. Unparseable/malformed
      // payloads are skipped at import so they can never brick watchAll().
      bool validScanPayload(Map<String, dynamic> m) {
        final decoded = jsonDecode(m['payloadJson'] as String? ?? '{}');
        if (decoded is! Map<String, dynamic>) return false;
        for (final j in (decoded['snapshots'] as List<dynamic>? ?? const [])) {
          PlanetPosition.fromJson(j as Map<String, dynamic>);
        }
        return true;
      }

      bool validTrackerPayload(Map<String, dynamic> m) {
        final decoded = jsonDecode(m['payloadJson'] as String? ?? '{}');
        if (decoded is! Map<String, dynamic>) return false;
        TrackerResult.fromJson(decoded);
        return true;
      }

      bool validDiscoveryPayload(Map<String, dynamic> m) {
        final decoded = jsonDecode(m['payloadJson'] as String? ?? '{}');
        if (decoded is! Map<String, dynamic>) return false;
        DateTime.parse(decoded['startDate'] as String);
        DateTime.parse(decoded['endDate'] as String);
        for (final e in (decoded['results'] as List<dynamic>? ?? const [])) {
          DiscoveredObject.fromJson(e as Map<String, dynamic>);
        }
        return true;
      }

      Future<int> insertHistory(
        String key, {
        required bool Function(Map<String, dynamic>) validate,
        required Future<bool> Function(Map<String, dynamic>) write,
      }) async {
        var count = 0;
        for (final raw in (data[key] as List<dynamic>? ?? const [])) {
          final m = raw as Map<String, dynamic>;
          try {
            if (!validate(m)) continue; // F16: malformed shape → skip
          } catch (_) {
            continue; // F16: unparseable payload → skip
          }
          // F36/F42: count a row only when it is actually newly inserted.
          if (await write(m)) count++;
        }
        return count;
      }

      scan = await insertHistory(
        'scanHistory',
        validate: validScanPayload,
        write: (m) async {
          final id = m['id'] as String? ?? _uuid.v4();
          final exists = await (_db.select(_db.scanHistory)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) return false;
          await _db.into(_db.scanHistory).insert(
            ScanHistoryCompanion.insert(
              id: id,
              date: parseDate(m['date']),
              mode: m['mode'] as String? ?? 'light',
              payloadJson: m['payloadJson'] as String? ?? '{}',
              errored: drift.Value(m['errored'] as bool? ?? false),
            ),
            mode: drift.InsertMode.insertOrIgnore,
          );
          return true;
        },
      );

      tracker = await insertHistory(
        'trackerHistory',
        validate: validTrackerPayload,
        write: (m) async {
          final id = m['id'] as String? ?? _uuid.v4();
          final exists = await (_db.select(_db.trackerHistory)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) return false;
          await _db.into(_db.trackerHistory).insert(
            TrackerHistoryCompanion.insert(
              id: id,
              date: parseDate(m['date']),
              mode: m['mode'] as String? ?? 'asteroid',
              payloadJson: m['payloadJson'] as String? ?? '{}',
              errored: drift.Value(m['errored'] as bool? ?? false),
            ),
            mode: drift.InsertMode.insertOrIgnore,
          );
          return true;
        },
      );

      discovery = await insertHistory(
        'discoveryHistory',
        validate: validDiscoveryPayload,
        write: (m) async {
          final id = m['id'] as String? ?? _uuid.v4();
          final exists = await (_db.select(_db.discoveryHistory)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) return false;
          await _db.into(_db.discoveryHistory).insert(
            DiscoveryHistoryCompanion.insert(
              id: id,
              date: parseDate(m['date']),
              mode: m['mode'] as String? ?? 'comet',
              payloadJson: m['payloadJson'] as String? ?? '{}',
              errored: drift.Value(m['errored'] as bool? ?? false),
            ),
            mode: drift.InsertMode.insertOrIgnore,
          );
          return true;
        },
      );
    });

    return ImportSummary(
      notes: notes,
      links: links,
      tags: tags,
      ships: ships,
      scanHistory: scan,
      trackerHistory: tracker,
      discoveryHistory: discovery,
    );
  }
}

@immutable
class ImportSummary {
  final int notes;
  final int links;
  final int tags;
  final int ships;
  final int scanHistory;
  final int trackerHistory;
  final int discoveryHistory;

  const ImportSummary({
    required this.notes,
    required this.links,
    required this.tags,
    required this.ships,
    required this.scanHistory,
    required this.trackerHistory,
    required this.discoveryHistory,
  });

  factory ImportSummary.empty() => const ImportSummary(
    notes: 0,
    links: 0,
    tags: 0,
    ships: 0,
    scanHistory: 0,
    trackerHistory: 0,
    discoveryHistory: 0,
  );

  bool get isEmpty =>
      notes + links + tags + ships + scanHistory + trackerHistory + discoveryHistory == 0;

  String describe() {
    if (isEmpty) return 'Nothing imported.';
    final parts = <String>[];
    if (notes > 0) parts.add('$notes note${notes == 1 ? '' : 's'}');
    if (links > 0) parts.add('$links link${links == 1 ? '' : 's'}');
    if (tags > 0) parts.add('$tags tag${tags == 1 ? '' : 's'}');
    if (ships > 0) parts.add('$ships ship${ships == 1 ? '' : 's'}');
    if (scanHistory > 0) parts.add('$scanHistory scan${scanHistory == 1 ? '' : 's'}');
    if (trackerHistory > 0) parts.add('$trackerHistory track${trackerHistory == 1 ? '' : 's'}');
    if (discoveryHistory > 0) parts.add('$discoveryHistory discoveries');
    return parts.join(', ');
  }
}

final dataExportServiceProvider = Provider<DataExportService>((ref) {
  return DataExportService(ref.watch(appDatabaseProvider));
});

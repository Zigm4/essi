import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' as drift;
import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:uuid/uuid.dart';

import '../data/database/app_database.dart';

class DataExportService {
  DataExportService(this._db);
  final AppDatabase _db;
  static const _uuid = Uuid();
  static const formatVersion = 1;

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

  Future<void> shareExport() async {
    final file = await exportToFile();
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: 'application/json')],
        text: 'Underdeck data export',
      ),
    );
  }

  Future<ImportSummary> importFromUserPick() async {
    final typeGroup = const XTypeGroup(
      label: 'JSON',
      extensions: ['json'],
      mimeTypes: ['application/json'],
    );
    final picked = await openFile(acceptedTypeGroups: [typeGroup]);
    if (picked == null) return ImportSummary.empty();
    return importFromFile(File(picked.path));
  }

  Future<ImportSummary> importFromFile(File file) async {
    final raw = await file.readAsString();
    final j = jsonDecode(raw);
    if (j is! Map<String, dynamic>) {
      throw const FormatException('Expected a JSON object');
    }
    final version = j['version'];
    if (version is! int || version > formatVersion) {
      throw FormatException(
          'Unsupported export version: $version (expected ≤ $formatVersion)');
    }
    final data = j['data'];
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Missing data object');
    }
    return _import(data);
  }

  Future<ImportSummary> _import(Map<String, dynamic> data) async {
    int notes = 0, links = 0, tags = 0, ships = 0;
    int scan = 0, tracker = 0, discovery = 0;

    DateTime parseDate(dynamic v) =>
        v is String ? DateTime.parse(v) : DateTime.now();

    String dedupeId(String fallback) => _uuid.v4();
    final unused = dedupeId; // ignore: unused_local_variable

    await _db.transaction(() async {
      // Tags first (to satisfy foreign-key-like checks even though we don't have hard FKs)
      final existingTags = await _db.select(_db.tags).get();
      final tagsByKey = {for (final t in existingTags) t.name: t.id};

      for (final t in (data['tags'] as List<dynamic>? ?? const [])) {
        final m = t as Map<String, dynamic>;
        final key = (m['name'] as String? ?? '').toLowerCase();
        if (tagsByKey.containsKey(key)) continue;
        final id = (m['id'] as String?) ?? _uuid.v4();
        await _db.into(_db.tags).insert(
          TagsCompanion.insert(
            id: id,
            displayName: m['displayName'] as String,
            name: key,
            colorHex: drift.Value(m['colorHex'] as String?),
          ),
          mode: drift.InsertMode.insertOrIgnore,
        );
        tagsByKey[key] = id;
        tags++;
      }

      Future<String?> ensureTagId(String idCandidate) async {
        final exists = await (_db.select(_db.tags)
              ..where((t) => t.id.equals(idCandidate)))
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
          final exists = await (_db.select(_db.notes)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) return false;
          await _db.into(_db.notes).insert(
            NotesCompanion.insert(
              id: id,
              title: drift.Value(m['title'] as String? ?? ''),
              body: drift.Value(m['body'] as String? ?? ''),
              createdAt: parseDate(m['createdAt']),
              updatedAt: parseDate(m['updatedAt']),
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
          final exists = await (_db.select(_db.links)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) return false;
          await _db.into(_db.links).insert(
            LinksCompanion.insert(
              id: id,
              title: drift.Value(m['title'] as String? ?? ''),
              url: drift.Value(m['url'] as String? ?? ''),
              note: drift.Value(m['note'] as String? ?? ''),
              createdAt: parseDate(m['createdAt']),
              updatedAt: parseDate(m['updatedAt']),
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
          final exists = await (_db.select(_db.ships)
                ..where((t) => t.id.equals(id)))
              .getSingleOrNull();
          if (exists != null) return false;
          await _db.into(_db.ships).insert(
            ShipsCompanion.insert(
              id: id,
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
              createdAt: parseDate(m['createdAt']),
              updatedAt: parseDate(m['updatedAt']),
            ),
            mode: drift.InsertMode.insertOrIgnore,
          );
          return true;
        },
      );

      Future<void> insertJoin({
        required Iterable items,
        required String idA,
        required String idB,
        required Future<void> Function(String, String) insertFn,
      }) async {
        for (final raw in items) {
          final m = raw as Map<String, dynamic>;
          final a = m[idA] as String?;
          final b = m[idB] as String?;
          if (a == null || b == null) continue;
          final tagOK = await ensureTagId(b);
          if (tagOK == null) continue;
          await insertFn(a, b);
        }
      }
      await insertJoin(
        items: (data['noteTags'] as List<dynamic>? ?? const []),
        idA: 'noteId',
        idB: 'tagId',
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
        insertFn: (a, b) async {
          await _db.into(_db.shipTags).insert(
            ShipTagsCompanion.insert(shipId: a, tagId: b),
            mode: drift.InsertMode.insertOrIgnore,
          );
        },
      );

      Future<int> insertHistory(
        String key,
        Future<void> Function(Map<String, dynamic>) write,
      ) async {
        var count = 0;
        for (final raw in (data[key] as List<dynamic>? ?? const [])) {
          final m = raw as Map<String, dynamic>;
          await write(m);
          count++;
        }
        return count;
      }

      scan = await insertHistory('scanHistory', (m) async {
        final id = m['id'] as String? ?? _uuid.v4();
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
      });

      tracker = await insertHistory('trackerHistory', (m) async {
        final id = m['id'] as String? ?? _uuid.v4();
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
      });

      discovery = await insertHistory('discoveryHistory', (m) async {
        final id = m['id'] as String? ?? _uuid.v4();
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
      });
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

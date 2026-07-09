import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../celestial/domain/celestial_kind.dart';

@immutable
class TrackTarget {
  final String name;
  final CelestialKind kind;
  final String? mpcID;

  const TrackTarget({required this.name, required this.kind, this.mpcID});

  String get id => '${kind.id}|$name|${mpcID ?? ""}';
}

@immutable
class TrackedObjectEntry {
  final String name;
  final String identifier;
  final String typeRaw;

  const TrackedObjectEntry({
    required this.name,
    required this.identifier,
    required this.typeRaw,
  });

  CelestialKind get kind =>
      typeRaw.toLowerCase() == 'comet' ? CelestialKind.comet : CelestialKind.asteroid;

  factory TrackedObjectEntry.fromJson(Map<String, dynamic> j) =>
      TrackedObjectEntry(
        name: j['name'] as String,
        identifier: j['identifier'] as String,
        typeRaw: j['type'] as String,
      );
}

class TrackerCatalog {
  final List<TrackedObjectEntry> all;
  const TrackerCatalog(this.all);

  List<TrackedObjectEntry> suggestions(
    String query, {
    int limit = 25,
    CelestialKind? kind,
  }) {
    final q = query.trim().toLowerCase();
    final pool = kind == null
        ? all
        : all.where((e) => e.kind == kind).toList();
    if (q.isEmpty) return pool.take(limit).toList();
    return pool
        .where((e) =>
            e.name.toLowerCase().contains(q) ||
            e.identifier.toLowerCase().contains(q))
        .take(limit)
        .toList();
  }

  TrackedObjectEntry? matchExact(String name) {
    final q = name.trim().toLowerCase();
    if (q.isEmpty) return null;
    for (final e in all) {
      if (e.name.toLowerCase() == q || e.identifier.toLowerCase() == q) {
        return e;
      }
    }
    return null;
  }

  static Future<TrackerCatalog> load() async {
    try {
      final raw =
          await rootBundle.loadString('assets/catalog/tracked_objects.json');
      final list = (jsonDecode(raw) as List<dynamic>)
          .map((e) => TrackedObjectEntry.fromJson(e as Map<String, dynamic>))
          .toList();
      return TrackerCatalog(list);
    } catch (_) {
      return const TrackerCatalog([]);
    }
  }
}

final trackerCatalogProvider = FutureProvider<TrackerCatalog>((ref) {
  return TrackerCatalog.load();
});

@immutable
class TrackerResult {
  final String mpcID;
  final String displayName;
  final CelestialKind kind;
  final double xAU;
  final double yAU;
  final double zAU;
  final int sector;
  final double distanceAU;
  final double slExact;
  final double slRounded;
  final int slFloor;
  final DateTime timestamp;

  const TrackerResult({
    required this.mpcID,
    required this.displayName,
    required this.kind,
    required this.xAU,
    required this.yAU,
    required this.zAU,
    required this.sector,
    required this.distanceAU,
    required this.slExact,
    required this.slRounded,
    required this.slFloor,
    required this.timestamp,
  });

  bool get hasFloorWarning => slFloor < slRounded;

  Map<String, dynamic> toJson() => {
    'mpcID': mpcID,
    'displayName': displayName,
    'kind': kind.id,
    'xAU': xAU,
    'yAU': yAU,
    'zAU': zAU,
    'sector': sector,
    'distanceAU': distanceAU,
    'slExact': slExact,
    'slRounded': slRounded,
    'slFloor': slFloor,
    'timestamp': timestamp.toUtc().toIso8601String(),
  };

  factory TrackerResult.fromJson(Map<String, dynamic> j) => TrackerResult(
    mpcID: j['mpcID'] as String,
    displayName: j['displayName'] as String,
    kind: CelestialKindX.fromId(j['kind'] as String?),
    xAU: (j['xAU'] as num).toDouble(),
    yAU: (j['yAU'] as num).toDouble(),
    zAU: (j['zAU'] as num).toDouble(),
    sector: (j['sector'] as num).toInt(),
    distanceAU: (j['distanceAU'] as num).toDouble(),
    slExact: (j['slExact'] as num).toDouble(),
    slRounded: (j['slRounded'] as num).toDouble(),
    slFloor: (j['slFloor'] as num).toInt(),
    timestamp: DateTime.parse(j['timestamp'] as String),
  );
}

@immutable
sealed class TrackerError implements Exception {
  const TrackerError();
  String get message;
}

class TrackerOfflineError extends TrackerError {
  const TrackerOfflineError();
  @override
  String get message => 'No network connection. Check your signal.';
}

class TrackerHttpError extends TrackerError {
  final int status;
  const TrackerHttpError(this.status);
  @override
  String get message => 'Upstream returned HTTP $status.';
}

class TrackerUnparseableError extends TrackerError {
  const TrackerUnparseableError();
  @override
  String get message => "Couldn't parse the upstream response.";
}

class TrackerMpcLookupError extends TrackerError {
  const TrackerMpcLookupError();
  @override
  String get message => "Couldn't resolve an MPC ID for that target.";
}

class TrackerNoEphemerisError extends TrackerError {
  const TrackerNoEphemerisError();
  @override
  String get message =>
      'No ephemeris data available for that object right now.';
}

class TrackerCancelledError extends TrackerError {
  const TrackerCancelledError();
  @override
  String get message => 'Request cancelled.';
}

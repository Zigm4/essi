import 'package:flutter/foundation.dart';

import 'celestial_kind.dart';

@immutable
class DiscoveredObject {
  final String designation;
  final String fullName;
  final String? firstObs;
  final String? lastObs;
  final bool isHazardous;
  final double? diameterMeters;
  final double? albedo;
  final CelestialKind kind;

  const DiscoveredObject({
    required this.designation,
    required this.fullName,
    this.firstObs,
    this.lastObs,
    required this.isHazardous,
    this.diameterMeters,
    this.albedo,
    required this.kind,
  });

  String get displayName {
    var s = fullName.trim();
    if (s.startsWith('(') && s.endsWith(')')) {
      s = s.substring(1, s.length - 1).trim();
    }
    return s.isEmpty ? designation : s;
  }

  int? get trackingPeriodDays {
    if (firstObs == null || lastObs == null) return null;
    DateTime? p(String s) {
      try {
        return DateTime.parse(s);
      } catch (_) {
        return null;
      }
    }
    final f = p(firstObs!);
    final l = p(lastObs!);
    if (f == null || l == null) return null;
    return l.difference(f).inDays;
  }

  DiscoveryStatus get status {
    final days = trackingPeriodDays ?? 0;
    if (isHazardous) return DiscoveryStatus.danger;
    switch (kind) {
      case CelestialKind.asteroid:
        if ((diameterMeters ?? 0) > 140) return DiscoveryStatus.caution;
        if (days < 3) return DiscoveryStatus.caution;
        return DiscoveryStatus.ok;
      case CelestialKind.comet:
        if (days < 3) return DiscoveryStatus.caution;
        return DiscoveryStatus.ok;
    }
  }

  Map<String, dynamic> toJson() => {
    'designation': designation,
    'fullName': fullName,
    'firstObs': firstObs,
    'lastObs': lastObs,
    'isHazardous': isHazardous,
    'diameterMeters': diameterMeters,
    'albedo': albedo,
    'kind': kind.id,
  };

  factory DiscoveredObject.fromJson(Map<String, dynamic> j) =>
      DiscoveredObject(
        designation: j['designation'] as String,
        fullName: j['fullName'] as String,
        firstObs: j['firstObs'] as String?,
        lastObs: j['lastObs'] as String?,
        isHazardous: j['isHazardous'] as bool? ?? false,
        diameterMeters: (j['diameterMeters'] as num?)?.toDouble(),
        albedo: (j['albedo'] as num?)?.toDouble(),
        kind: CelestialKindX.fromId(j['kind'] as String?),
      );
}

/// Outcome of a single SBDB search: the parsed objects plus whether the API
/// capped the reply at its row limit (so the list is incomplete). [truncated]
/// lets the UI warn the user instead of presenting a partial list as the whole
/// result set (F15).
@immutable
class DiscoverySearchResult {
  final List<DiscoveredObject> objects;
  final bool truncated;

  const DiscoverySearchResult({
    required this.objects,
    this.truncated = false,
  });
}

enum DiscoveryStatus { ok, caution, danger, unknown }

@immutable
sealed class CelestialError implements Exception {
  const CelestialError();
  String get message;
}

class CelestialDateOutOfRangeError extends CelestialError {
  const CelestialDateOutOfRangeError();
  @override
  String get message => 'Pick a date no later than today.';
}

class CelestialHttpError extends CelestialError {
  final int status;
  const CelestialHttpError(this.status);
  @override
  String get message => 'JPL SBDB returned HTTP $status.';
}

class CelestialUnparseableError extends CelestialError {
  const CelestialUnparseableError();
  @override
  String get message => "Couldn't parse JPL SBDB response.";
}

class CelestialOfflineError extends CelestialError {
  const CelestialOfflineError();
  @override
  String get message => 'No network connection. Check your signal.';
}

class CelestialCancelledError extends CelestialError {
  const CelestialCancelledError();
  @override
  String get message => 'Request cancelled.';
}

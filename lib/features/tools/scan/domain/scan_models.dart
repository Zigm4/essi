import 'package:flutter/foundation.dart';

enum ScanMode { light, full }

extension ScanModeX on ScanMode {
  String get id => name;

  String get label {
    switch (this) {
      case ScanMode.light:
        return 'Light';
      case ScanMode.full:
        return 'Full';
    }
  }

  String get summary {
    switch (this) {
      case ScanMode.light:
        return 'Current sector and distance for each planet.';
      case ScanMode.full:
        return 'Light data plus the next sector change for each planet (more API calls).';
    }
  }

  String get latencyHint {
    switch (this) {
      case ScanMode.light:
        return '≈ 10 to 20 seconds';
      case ScanMode.full:
        return '≈ 45 to 120 seconds';
    }
  }

  static ScanMode fromId(String? id) {
    return ScanMode.values.firstWhere(
      (m) => m.name == id,
      orElse: () => ScanMode.light,
    );
  }
}

@immutable
class NextSectorChange {
  final DateTime date;
  final int toSector;

  const NextSectorChange({required this.date, required this.toSector});

  Map<String, dynamic> toJson() => {
    'date': date.toUtc().toIso8601String(),
    'toSector': toSector,
  };

  static NextSectorChange? fromJson(Map<String, dynamic>? j) {
    if (j == null) return null;
    return NextSectorChange(
      date: DateTime.parse(j['date'] as String),
      toSector: j['toSector'] as int,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is NextSectorChange &&
      other.date == date &&
      other.toSector == toSector;

  @override
  int get hashCode => Object.hash(date, toSector);
}

@immutable
class PlanetPosition {
  final String name;
  final String emoji;
  final int sector;
  final int distanceSL;
  final DateTime timestamp;
  final NextSectorChange? nextChange;

  const PlanetPosition({
    required this.name,
    required this.emoji,
    required this.sector,
    required this.distanceSL,
    required this.timestamp,
    this.nextChange,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'emoji': emoji,
    'sector': sector,
    'distanceSL': distanceSL,
    'timestamp': timestamp.toUtc().toIso8601String(),
    if (nextChange != null) 'nextChange': nextChange!.toJson(),
  };

  factory PlanetPosition.fromJson(Map<String, dynamic> j) => PlanetPosition(
    name: j['name'] as String,
    emoji: j['emoji'] as String,
    sector: j['sector'] as int,
    distanceSL: j['distanceSL'] as int,
    timestamp: DateTime.parse(j['timestamp'] as String),
    nextChange: NextSectorChange.fromJson(
      j['nextChange'] as Map<String, dynamic>?,
    ),
  );
}

@immutable
sealed class ScanError implements Exception {
  const ScanError();
  String get message;
}

class ScanOfflineError extends ScanError {
  const ScanOfflineError();
  @override
  String get message => 'No internet connection.';
}

class ScanHttpError extends ScanError {
  final int status;
  const ScanHttpError(this.status);
  @override
  String get message => 'JPL Horizons returned HTTP $status.';
}

class ScanUnparseableError extends ScanError {
  const ScanUnparseableError();
  @override
  String get message => "Couldn't parse JPL Horizons response.";
}

class ScanNoDataError extends ScanError {
  const ScanNoDataError();
  @override
  String get message => 'JPL Horizons returned no position data.';
}

class ScanCancelledError extends ScanError {
  const ScanCancelledError();
  @override
  String get message => 'Scan cancelled.';
}

@immutable
sealed class PlanetRowStatus {
  const PlanetRowStatus();
}

class PlanetRowPending extends PlanetRowStatus {
  const PlanetRowPending();
}

class PlanetRowOk extends PlanetRowStatus {
  final PlanetPosition position;
  const PlanetRowOk(this.position);
}

class PlanetRowErrored extends PlanetRowStatus {
  final ScanError error;
  const PlanetRowErrored(this.error);
}

@immutable
class PlanetRow {
  final String name;
  final String emoji;
  final PlanetRowStatus status;

  const PlanetRow({
    required this.name,
    required this.emoji,
    required this.status,
  });

  PlanetRow copyWith({PlanetRowStatus? status}) =>
      PlanetRow(name: name, emoji: emoji, status: status ?? this.status);
}

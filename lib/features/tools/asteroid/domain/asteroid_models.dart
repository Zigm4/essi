import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:underdeck_app/core/logging.dart';

@immutable
class AsteroidEntry {
  final String name;
  final String emoji;
  final double? multiplier;
  final int? risk;
  final int? value;
  final bool? pvp;
  final String? symbol;

  const AsteroidEntry({
    required this.name,
    required this.emoji,
    this.multiplier,
    this.risk,
    this.value,
    this.pvp,
    this.symbol,
  });

  factory AsteroidEntry.fromJson(Map<String, dynamic> j) => AsteroidEntry(
    name: (j['name'] ?? 'Unknown') as String,
    emoji: (j['emoji'] ?? '?') as String,
    multiplier: (j['multiplier'] as num?)?.toDouble(),
    risk: (j['risk'] as num?)?.toInt(),
    value: (j['value'] as num?)?.toInt(),
    pvp: j['pvp'] as bool?,
    symbol: j['symbol'] as String?,
  );

  static const unknown = AsteroidEntry(name: 'Unknown', emoji: '?');
}

class AsteroidTables {
  final Map<String, AsteroidEntry> type;
  final Map<String, AsteroidEntry> size;
  final Map<String, AsteroidEntry> structure;
  final Map<String, AsteroidEntry> salvage;
  final Map<String, AsteroidEntry> law;
  final Map<String, AsteroidEntry> resource;

  const AsteroidTables({
    required this.type,
    required this.size,
    required this.structure,
    required this.salvage,
    required this.law,
    required this.resource,
  });

  static AsteroidTables _parse(Map<String, dynamic> j) {
    Map<String, AsteroidEntry> table(String key) {
      final m = <String, AsteroidEntry>{};
      final raw = j[key] as Map<String, dynamic>? ?? const {};
      raw.forEach((k, v) {
        m[k] = AsteroidEntry.fromJson(v as Map<String, dynamic>);
      });
      return m;
    }
    return AsteroidTables(
      type: table('type'),
      size: table('size'),
      structure: table('structure'),
      salvage: table('salvage'),
      law: table('law'),
      resource: table('resource'),
    );
  }

  static Future<AsteroidTables> load() async {
    try {
      final raw = await rootBundle.loadString('assets/catalog/asteroid_tables.json');
      return _parse(jsonDecode(raw) as Map<String, dynamic>);
    } catch (e, st) {
      logError('Failed to load assets/catalog/asteroid_tables.json: $e', st);
      rethrow;
    }
  }
}

final asteroidTablesProvider = FutureProvider<AsteroidTables>((ref) {
  return AsteroidTables.load();
});

enum AsteroidAlertLevel { info, warning, high, critical }

@immutable
class AsteroidAlert {
  final AsteroidAlertLevel level;
  final String message;
  final String emoji;
  const AsteroidAlert({
    required this.level,
    required this.message,
    required this.emoji,
  });
}

class AsteroidResource {
  final AsteroidEntry entry;
  final String key;
  const AsteroidResource(this.entry, this.key);
}

@immutable
class AsteroidAnalysis {
  final String id;
  final AsteroidEntry type;
  final String typeKey;
  final AsteroidEntry size;
  final String sizeKey;
  final AsteroidEntry structure;
  final String structureKey;
  final AsteroidEntry salvage;
  final String salvageKey;
  final int wealth;
  final AsteroidEntry law;
  final String lawKey;
  final List<AsteroidResource> resources;
  final double resourceValue;
  final List<AsteroidAlert> alerts;

  const AsteroidAnalysis({
    required this.id,
    required this.type,
    required this.typeKey,
    required this.size,
    required this.sizeKey,
    required this.structure,
    required this.structureKey,
    required this.salvage,
    required this.salvageKey,
    required this.wealth,
    required this.law,
    required this.lawKey,
    required this.resources,
    required this.resourceValue,
    required this.alerts,
  });
}

@immutable
class AsteroidValidationRule {
  final String id;
  final String label;
  final bool isSatisfied;
  const AsteroidValidationRule({
    required this.id,
    required this.label,
    required this.isSatisfied,
  });
}

class AsteroidDecodeException implements Exception {
  final String message;
  const AsteroidDecodeException(this.message);
}

class AsteroidDecoder {
  AsteroidDecoder._();

  static List<AsteroidValidationRule> validationRules(String raw) {
    final allDigits = raw.isNotEmpty && RegExp(r'^[0-9]+$').hasMatch(raw);
    final length9 = raw.length == 9;

    String? at(int idx) {
      if (idx >= raw.length) return null;
      final c = raw[idx];
      if (RegExp(r'[0-9]').hasMatch(c)) return c;
      return null;
    }

    bool nonZero(int idx) {
      final c = at(idx);
      if (c == null) return false;
      return c != '0';
    }

    return [
      AsteroidValidationRule(
        id: 'digits',
        label: 'Digits only (0–9)',
        isSatisfied: allDigits,
      ),
      AsteroidValidationRule(
        id: 'length',
        label: 'Exactly 9 digits',
        isSatisfied: allDigits && length9,
      ),
      AsteroidValidationRule(
        id: 'type',
        label: 'Position 1 = 1 (Asteroid)',
        isSatisfied: at(0) == '1',
      ),
      AsteroidValidationRule(
        id: 'size',
        label: 'Position 2 (size) is 1–9',
        isSatisfied: nonZero(1),
      ),
      AsteroidValidationRule(
        id: 'wealth',
        label: 'Position 5 (wealth) is 1–9',
        isSatisfied: nonZero(4),
      ),
      AsteroidValidationRule(
        id: 'rss',
        label: 'Positions 7–9 (resources) are 1–9',
        isSatisfied: nonZero(6) && nonZero(7) && nonZero(8),
      ),
    ];
  }

  static bool isFullyValid(String raw) =>
      validationRules(raw).every((r) => r.isSatisfied);

  static AsteroidAnalysis analyze(String raw, AsteroidTables tables) {
    if (raw.length != 9) {
      throw const AsteroidDecodeException('Asteroid ID must be exactly 9 digits.');
    }
    if (!RegExp(r'^[0-9]+$').hasMatch(raw)) {
      throw const AsteroidDecodeException('Asteroid ID must contain digits only.');
    }
    final c = raw.split('');
    final typeKey = c[0];
    final sizeKey = c[1];
    final structureKey = c[2];
    final salvageKey = c[3];
    final wealth = int.tryParse(c[4]) ?? 0;
    final lawKey = c[5];
    final r1 = c[6];
    final r2 = c[7];
    final r3 = c[8];

    final type = tables.type[typeKey] ?? AsteroidEntry.unknown;
    final size = tables.size[sizeKey] ?? AsteroidEntry.unknown;
    final structure = tables.structure[structureKey] ?? AsteroidEntry.unknown;
    final salvage = tables.salvage[salvageKey] ?? AsteroidEntry.unknown;
    final law = tables.law[lawKey] ?? AsteroidEntry.unknown;
    final res1 = tables.resource[r1] ?? AsteroidEntry.unknown;
    final res2 = tables.resource[r2] ?? AsteroidEntry.unknown;
    final res3 = tables.resource[r3] ?? AsteroidEntry.unknown;

    final mult = size.multiplier ?? 1.0;
    final resourceValue =
        ((res1.value ?? 0) + (res2.value ?? 0) + (res3.value ?? 0)) *
            mult *
            wealth;

    final alerts = <AsteroidAlert>[];
    final structInt = int.tryParse(structureKey) ?? 0;
    if (structInt >= 5) {
      alerts.add(const AsteroidAlert(
        level: AsteroidAlertLevel.info,
        message: 'This asteroid has significant infrastructure.',
        emoji: '🏗',
      ));
    }
    final rssKeys = [r1, r2, r3];
    if (rssKeys.contains('9')) {
      alerts.add(const AsteroidAlert(
        level: AsteroidAlertLevel.high,
        message: 'Rare gas deposits detected!',
        emoji: '💎',
      ));
    }
    if (lawKey == '0' && rssKeys.contains('6')) {
      final count = rssKeys.where((k) => k == '6').length;
      alerts.add(AsteroidAlert(
        level: AsteroidAlertLevel.critical,
        message:
            'Star-Tar deposits detected! Estimated harvest rate: $count-$wealth',
        emoji: '⚠',
      ));
    }
    if (law.pvp == true) {
      alerts.add(const AsteroidAlert(
        level: AsteroidAlertLevel.warning,
        message: 'Combat enabled zone, proceed with caution.',
        emoji: '⚔',
      ));
    }

    return AsteroidAnalysis(
      id: raw,
      type: type, typeKey: typeKey,
      size: size, sizeKey: sizeKey,
      structure: structure, structureKey: structureKey,
      salvage: salvage, salvageKey: salvageKey,
      wealth: wealth,
      law: law, lawKey: lawKey,
      resources: [
        AsteroidResource(res1, r1),
        AsteroidResource(res2, r2),
        AsteroidResource(res3, r3),
      ],
      resourceValue: resourceValue.toDouble(),
      alerts: alerts,
    );
  }
}

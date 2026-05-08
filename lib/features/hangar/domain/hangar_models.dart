import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../captures/domain/captures_models.dart';

enum ShipRight {
  pilot,
  gunner,
  cartographer,
  prospector,
  signaller,
  technician,
  sentry,
  fabricator,
  medic,
  quartermaster,
  chef,
  alchemist,
}

extension ShipRightX on ShipRight {
  String get displayName {
    switch (this) {
      case ShipRight.pilot:
        return 'Pilot';
      case ShipRight.gunner:
        return 'Gunner';
      case ShipRight.cartographer:
        return 'Cartographer';
      case ShipRight.prospector:
        return 'Prospector';
      case ShipRight.signaller:
        return 'Signaller';
      case ShipRight.technician:
        return 'Technician';
      case ShipRight.sentry:
        return 'Sentry';
      case ShipRight.fabricator:
        return 'Fabricator';
      case ShipRight.medic:
        return 'Medic';
      case ShipRight.quartermaster:
        return 'Quartermaster';
      case ShipRight.chef:
        return 'Chef';
      case ShipRight.alchemist:
        return 'Alchemist';
    }
  }

  String get placeholder => "$displayName's name";
}

const shipSeatOrder = ShipRight.values;

@immutable
class ShipCatalogEntry {
  final String key;
  final String displayName;
  final String? category;
  final String? prefix;
  final int? crewSize;
  final int? hullMax;

  const ShipCatalogEntry({
    required this.key,
    required this.displayName,
    this.category,
    this.prefix,
    this.crewSize,
    this.hullMax,
  });

  bool get hasPrefix => (prefix ?? '').trim().isNotEmpty;

  List<ShipRight> get availableRoles {
    if (crewSize == null) return shipSeatOrder;
    if (crewSize! <= 0) return const [];
    return shipSeatOrder.take(crewSize!).toList();
  }

  factory ShipCatalogEntry.fromJson(Map<String, dynamic> j) =>
      ShipCatalogEntry(
        key: j['key'] as String,
        displayName: j['displayName'] as String,
        category: j['category'] as String?,
        prefix: j['prefix'] as String?,
        crewSize: (j['crewSize'] as num?)?.toInt(),
        hullMax: (j['hullMax'] as num?)?.toInt(),
      );
}

enum LocationParamKind { zone, spaceCoordinate }

@immutable
class ShipLocation {
  final String key;
  final String displayName;
  final String group;
  final String? subtitle;
  final LocationParamKind? paramKind;
  final int? defaultZone;
  final bool isSpacecraftDefault;

  const ShipLocation({
    required this.key,
    required this.displayName,
    required this.group,
    this.subtitle,
    this.paramKind,
    this.defaultZone,
    this.isSpacecraftDefault = false,
  });

  bool get supportsZone => paramKind == LocationParamKind.zone;
  bool get supportsSpaceCoordinate =>
      paramKind == LocationParamKind.spaceCoordinate;

  factory ShipLocation.fromJson(Map<String, dynamic> j) {
    final kindRaw = j['paramKind'] as String?;
    LocationParamKind? kind;
    if (kindRaw == 'zone') kind = LocationParamKind.zone;
    if (kindRaw == 'spaceCoordinate') kind = LocationParamKind.spaceCoordinate;
    return ShipLocation(
      key: j['key'] as String,
      displayName: j['displayName'] as String,
      group: j['group'] as String,
      subtitle: j['subtitle'] as String?,
      paramKind: kind,
      defaultZone: (j['defaultZone'] as num?)?.toInt(),
      isSpacecraftDefault: (j['isSpacecraftDefault'] as bool?) ?? false,
    );
  }
}

class HangarCatalogs {
  final List<ShipCatalogEntry> ships;
  final List<ShipLocation> locations;
  const HangarCatalogs({required this.ships, required this.locations});

  static const customLocationKey = 'other';
  static const craftCategoriesInOrder = ['landcraft', 'watercraft', 'spacecraft'];

  ShipCatalogEntry? shipForKey(String? key) {
    if (key == null) return null;
    try {
      return ships.firstWhere((s) => s.key == key);
    } catch (_) {
      return null;
    }
  }

  List<ShipCatalogEntry> shipsIn(String category) {
    final list = ships.where((s) => s.category == category).toList();
    list.sort((a, b) => a.displayName.compareTo(b.displayName));
    return list;
  }

  ShipLocation? locationForKey(String? key) {
    if (key == null) return null;
    try {
      return locations.firstWhere((l) => l.key == key);
    } catch (_) {
      return null;
    }
  }

  String? get spacecraftDefaultKey {
    try {
      return locations.firstWhere((l) => l.isSpacecraftDefault).key;
    } catch (_) {
      return null;
    }
  }

  Map<String, List<ShipLocation>> get grouped {
    final groupOrder = <String>[
      'landmarks',
      'stations',
      'bodies',
      'special',
      'custom',
    ];
    final m = <String, List<ShipLocation>>{};
    for (final l in locations) {
      m.putIfAbsent(l.group, () => []).add(l);
    }
    final ordered = <String, List<ShipLocation>>{};
    for (final key in groupOrder) {
      if (m.containsKey(key)) ordered[key] = m[key]!;
    }
    return ordered;
  }

  static Future<HangarCatalogs> load() async {
    Future<List<T>> loadList<T>(
      String name,
      T Function(Map<String, dynamic>) factory,
    ) async {
      try {
        final raw = await rootBundle.loadString('assets/catalog/$name.json');
        return (jsonDecode(raw) as List<dynamic>)
            .map((e) => factory(e as Map<String, dynamic>))
            .toList();
      } catch (_) {
        return const [];
      }
    }
    final ships = await loadList<ShipCatalogEntry>(
      'ship_catalog',
      ShipCatalogEntry.fromJson,
    );
    final locations = await loadList<ShipLocation>(
      'ship_locations',
      ShipLocation.fromJson,
    );
    return HangarCatalogs(ships: ships, locations: locations);
  }
}

final hangarCatalogsProvider = FutureProvider<HangarCatalogs>((ref) {
  return HangarCatalogs.load();
});

@immutable
class ShipModel {
  final String id;
  final String name;
  final String? modelKey;
  final String? customModelLabel;
  final bool registered;
  final String? locationKey;
  final String? customLocation;
  final int? locationZone;
  final String? locationSector;
  final int? locationSL;
  final int? hull;
  final Map<ShipRight, String?> roles;
  final String note;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<TagModel> tags;

  const ShipModel({
    required this.id,
    required this.name,
    this.modelKey,
    this.customModelLabel,
    this.registered = false,
    this.locationKey,
    this.customLocation,
    this.locationZone,
    this.locationSector,
    this.locationSL,
    this.hull,
    this.roles = const {},
    this.note = '',
    required this.createdAt,
    required this.updatedAt,
    this.tags = const [],
  });

  String? roleName(ShipRight role) {
    final raw = roles[role]?.trim();
    if (raw == null || raw.isEmpty) return null;
    return raw;
  }

  List<MapEntry<ShipRight, String>> get assignedRoles {
    final out = <MapEntry<ShipRight, String>>[];
    for (final r in shipSeatOrder) {
      final n = roleName(r);
      if (n != null) out.add(MapEntry(r, n));
    }
    return out;
  }

  String? locationDisplay(HangarCatalogs cat) {
    if (locationKey == null) return null;
    if (locationKey == HangarCatalogs.customLocationKey) {
      final s = (customLocation ?? '').trim();
      return s.isEmpty ? null : s;
    }
    final entry = cat.locationForKey(locationKey);
    if (entry == null) return null;
    switch (entry.paramKind) {
      case LocationParamKind.zone:
        final z = locationZone ?? entry.defaultZone ?? 55;
        return '${entry.displayName} · zone $z';
      case LocationParamKind.spaceCoordinate:
        final sec = (locationSector ?? '').trim();
        final sl = locationSL?.toString() ?? '?';
        if (sec.isEmpty) return '${entry.displayName} · ? SL';
        return '${entry.displayName} · $sec, $sl SL';
      case null:
        return entry.displayName;
    }
  }
}

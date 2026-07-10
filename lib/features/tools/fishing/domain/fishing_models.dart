import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:underdeck_app/core/logging.dart';
import 'package:underdeck_app/features/knowledge/maps/domain/map_ref.dart';

@immutable
class FishingZone {
  final int id;
  final String name;
  final bool accessible;
  final String? depth;
  final String? pole;
  final String room;
  final bool isMapRoom;

  /// Optional cross-link to a place on a dynamic map (AUDIT-V2 §6.6). Dormant
  /// capability: current fishing data carries none, so this stays `null` for
  /// shipped data — content can start populating `mapRef` with no app change.
  final MapRef? mapRef;

  const FishingZone({
    required this.id,
    required this.name,
    required this.accessible,
    this.depth,
    this.pole,
    required this.room,
    required this.isMapRoom,
    this.mapRef,
  });

  factory FishingZone.fromJson(Map<String, dynamic> j) => FishingZone(
    id: (j['id'] as num).toInt(),
    name: j['name'] as String,
    accessible: j['accessible'] as bool,
    depth: j['depth'] as String?,
    pole: j['pole'] as String?,
    room: j['room'] as String,
    isMapRoom: (j['isMapRoom'] as bool?) ?? false,
    mapRef: MapRef.tryParse(j['mapRef']),
  );
}

enum FishingDepth {
  unknown('Unknown', '?', Color(0xFF4F6A87)),
  pond('Pond', '■', Color(0xFFB07A3A)),
  shore('Shore', '■', Color(0xFF9B5BD9)),
  harbour('Harbour', '■', Color(0xFFE07AA8)),
  grove('Grove', '■', Color(0xFF4FB36A)),
  deep('Deep', '■', Color(0xFF3F88E8)),
  voidD('Void', '■', Color(0xFFE25470)),
  wreck('Wreck', '■', Color(0xFFCFD8E3)),
  lair('Lair', '■', Color(0xFF4A2D6E));

  const FishingDepth(this.label, this.symbol, this.color);
  final String label;
  final String symbol;
  final Color color;

  static FishingDepth? fromName(String? name) {
    if (name == null) return null;
    for (final d in values) {
      if (d.label == name) return d;
    }
    return null;
  }
}

@immutable
class FishingRoom {
  final String id;
  final String displayName;
  final List<FishingZone> zones;

  const FishingRoom({
    required this.id,
    required this.displayName,
    required this.zones,
  });

  bool get isSolo => zones.length == 1;
}

class FishingData {
  final List<FishingRoom> rooms;
  const FishingData(this.rooms);

  static const _knownLabels = {
    'rankle-river': 'Rankle River',
    'west-shire': 'West Shire',
    'east-shire': 'East Shire',
    'imperious-falls': 'Imperious Falls',
    'event-arena': 'Event Arena',
  };

  static const _roomOrder = [
    'west-shire',
    'east-shire',
    'imperious-falls',
    'event-arena',
    'rankle-river',
  ];

  static String _titleCase(String slug) {
    return slug
        .split('-')
        .map((s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1))
        .join(' ');
  }

  static Future<FishingData> load() async {
    try {
      final raw =
          await rootBundle.loadString('assets/catalog/fishing_zones.json');
      final list = (jsonDecode(raw) as List<dynamic>)
          .map((e) => FishingZone.fromJson(e as Map<String, dynamic>))
          .toList();
      final byRoom = <String, List<FishingZone>>{};
      for (final z in list) {
        byRoom.putIfAbsent(z.room, () => []).add(z);
      }
      final rooms = <FishingRoom>[];
      for (final slug in _roomOrder) {
        final zones = byRoom.remove(slug);
        if (zones != null) {
          zones.sort((a, b) => a.id.compareTo(b.id));
          rooms.add(FishingRoom(
            id: slug,
            displayName: _knownLabels[slug] ?? _titleCase(slug),
            zones: zones,
          ));
        }
      }
      final extras = byRoom.keys.toList()..sort();
      for (final slug in extras) {
        final zones = byRoom[slug]!..sort((a, b) => a.id.compareTo(b.id));
        rooms.add(FishingRoom(
          id: slug,
          displayName: _knownLabels[slug] ?? _titleCase(slug),
          zones: zones,
        ));
      }
      return FishingData(rooms);
    } catch (e, st) {
      logError('Failed to load assets/catalog/fishing_zones.json: $e', st);
      rethrow;
    }
  }
}

final fishingDataProvider = FutureProvider<FishingData>((ref) {
  return FishingData.load();
});

import 'package:flutter/foundation.dart';

import '../../../knowledge/maps/domain/map_ref.dart';

/// Pickup or dropoff coordinate inside the Underpunks galaxy.
@immutable
class JobLocation {
  final int astnum;
  final int zone;
  final String? name; // human-readable label from the source JS comments.
  const JobLocation({required this.astnum, required this.zone, this.name});

  factory JobLocation.fromJson(Map<String, dynamic> j) => JobLocation(
        astnum: (j['astnum'] as num).toInt(),
        zone: (j['zone'] as num).toInt(),
        name: (j['name'] as String?)?.trim().isEmpty == true
            ? null
            : j['name'] as String?,
      );

  @override
  bool operator ==(Object other) =>
      other is JobLocation && other.astnum == astnum && other.zone == zone;

  @override
  int get hashCode => Object.hash(astnum, zone);

  /// Compact coords-only label, e.g. `355 · z35`. Useful when space is tight.
  String get coordsLabel => '$astnum · z$zone';

  /// Friendly label: prefer the name, then add coords in parentheses.
  String get label =>
      name == null ? coordsLabel : '$name ($astnum · z$zone)';
}

@immutable
class Job {
  final int id;
  final String? factionRep; // e.g. "rep_proq"
  final String? factionRival; // e.g. "rep_qnxs"
  final int requiredRep;
  final String? requiredSkill; // e.g. "stealth"
  final int requiredSkillAmt;
  final String? requiredTag; // e.g. "NorthSquire"
  final String type; // canonical, lowercased
  final String typeRaw; // original casing for display
  final int risk;
  final int bonus;
  final JobLocation pickup;
  final JobLocation dropoff;
  final String reward; // canonical (coin, scrap, energy, ...)
  final String? rewardFunction;
  final String? allyFunction;
  final String? rivalFunction;
  final int capacity;
  final String? ship;
  final String description;
  final String onComplete;

  /// Optional cross-link to a place on a dynamic map (AUDIT-V2 §6.6). Dormant
  /// capability: current jobs.json carries none, so this is `null` for shipped
  /// data — content can start populating `mapRef` with no app change.
  final MapRef? mapRef;

  const Job({
    required this.id,
    required this.factionRep,
    required this.factionRival,
    required this.requiredRep,
    required this.requiredSkill,
    required this.requiredSkillAmt,
    required this.requiredTag,
    required this.type,
    required this.typeRaw,
    required this.risk,
    required this.bonus,
    required this.pickup,
    required this.dropoff,
    required this.reward,
    required this.rewardFunction,
    required this.allyFunction,
    required this.rivalFunction,
    required this.capacity,
    required this.ship,
    required this.description,
    required this.onComplete,
    this.mapRef,
  });

  bool get isCargoJob => capacity > 0;
  bool get isOnSite => pickup == dropoff;
  bool get hasRival => factionRival != null;
  bool get isPlaceholderType => type == '???';

  /// Canonicalise inconsistent reward labels (COIN→coin, scrp→scrap,
  /// enrgy/NRG→energy). The `rewardFunction` is the source of truth when
  /// the label is ambiguous.
  static String _canonicalReward(String raw, String? fn) {
    final lower = raw.trim().toLowerCase();
    switch (fn) {
      case 'addCoinAmt':
      case 'addCarryCoinAmt':
        return 'coin';
      case 'addScrpAmt':
        return 'scrap';
      case 'addEnergyAmt':
        return 'energy';
      case 'addTitaniumAmt':
        return 'titanium';
      case 'addRocksAmt':
        return 'rocks';
      case 'addMalaAmt':
        return 'mala';
      case 'addWackoAmt':
        return 'wackos';
      case 'addMapDataAmt':
        return 'data';
      case 'addOilAmt':
        return 'oil';
      case 'addKryptonAmt':
        return 'krypton';
      case 'addStarTarAmt':
        return 'star_tar';
      case 'addStimnxAmt':
        return 'stimnx';
      case 'addSuppliesAmt':
        return 'supplies';
      case 'addTungstenAmt':
        return 'wolfram';
      case 'addUnobtainiumAmt':
        return 'unobtainium';
      case 'addGoldAmt':
        return 'aurum';
    }
    // Fallback: tidy up the literal value.
    switch (lower) {
      case 'scrp':
        return 'scrap';
      case 'enrgy':
      case 'nrg':
        return 'energy';
      default:
        return lower;
    }
  }

  factory Job.fromJson(Map<String, dynamic> j) {
    final rewardFn = j['rewardFunction'] as String?;
    final rawType = (j['type'] as String?) ?? '???';
    return Job(
      id: (j['id'] as num).toInt(),
      factionRep: j['factionRep'] as String?,
      factionRival: j['factionRival'] as String?,
      requiredRep: ((j['requiredRep'] as num?) ?? 0).toInt(),
      requiredSkill: j['requiredSkill'] as String?,
      requiredSkillAmt: ((j['requiredSkillAmt'] as num?) ?? 0).toInt(),
      requiredTag: j['requiredTag'] as String?,
      type: rawType.toLowerCase(),
      typeRaw: rawType,
      risk: ((j['risk'] as num?) ?? 0).toInt(),
      bonus: ((j['bonus'] as num?) ?? 0).toInt(),
      pickup: JobLocation.fromJson(j['pickupLocation'] as Map<String, dynamic>),
      dropoff:
          JobLocation.fromJson(j['dropoffLocation'] as Map<String, dynamic>),
      reward: _canonicalReward(j['reward'] as String? ?? '', rewardFn),
      rewardFunction: rewardFn,
      allyFunction: j['allyFunction'] as String?,
      rivalFunction: j['rivalFunction'] as String?,
      capacity: ((j['capacity'] as num?) ?? 0).toInt(),
      ship: j['ship'] as String?,
      description: (j['description'] as String?) ?? '',
      onComplete: (j['onComplete'] as String?) ?? '',
      mapRef: MapRef.tryParse(j['mapRef']),
    );
  }
}

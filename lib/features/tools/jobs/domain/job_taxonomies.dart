import 'package:flutter/material.dart';

import '../../../../design_system/colors.dart';

/// Human-readable label + tint for a faction key (`rep_proq`, `rep_qnxs`, …).
class FactionInfo {
  const FactionInfo({
    required this.key,
    required this.label,
    required this.tint,
  });
  final String key;
  final String label;
  final Color tint;
}

class JobTaxonomies {
  JobTaxonomies._();

  /// Allied factions: keys that appear as `factionRep`.
  static const alliedFactions = <FactionInfo>[
    FactionInfo(key: 'rep_chat', label: 'Chattery', tint: Color(0xFFB377FF)),
    FactionInfo(key: 'rep_clst', label: 'Celestyn', tint: Color(0xFFE6E6FF)),
    FactionInfo(key: 'rep_hex', label: 'Hex', tint: Color(0xFFFF77AA)),
    FactionInfo(key: 'rep_king', label: 'King', tint: Color(0xFFFFD15C)),
    FactionInfo(key: 'rep_lycnx', label: 'Lycanox', tint: Color(0xFF9DDCFF)),
    FactionInfo(key: 'rep_mrtn', label: 'Martian', tint: Color(0xFFFF7755)),
    FactionInfo(key: 'rep_mschf', label: 'Mischief', tint: Color(0xFFFFC766)),
    FactionInfo(key: 'rep_pearl', label: 'Pearl', tint: Color(0xFFFFE9A8)),
    FactionInfo(key: 'rep_proq', label: 'Proquinox', tint: Color(0xFF9C9C9C)),
    FactionInfo(key: 'rep_rsa', label: 'RSA', tint: Color(0xFFFF5577)),
    FactionInfo(key: 'rep_rts', label: 'Rustwind', tint: Color(0xFFC58A4F)),
    FactionInfo(key: 'rep_rvnts', label: 'Revenants', tint: Color(0xFF8B6FFF)),
    FactionInfo(key: 'rep_tfi', label: 'TFI', tint: Color(0xFF5FE8A0)),
    FactionInfo(key: 'rep_uurt', label: 'Uurt', tint: Color(0xFF3FBFA0)),
    FactionInfo(key: 'rep_zcorp', label: 'Z-Corp', tint: Color(0xFF4FC3FF)),
  ];

  /// Rival-only factions: appear as `factionRival` but never as `factionRep`.
  static const rivalOnlyFactions = <FactionInfo>[
    FactionInfo(key: 'rep_55imp', label: '55 Imperials', tint: Color(0xFFFF7777)),
    FactionInfo(key: 'rep_co8', label: 'Co8', tint: Color(0xFF8B7BFF)),
    FactionInfo(key: 'rep_mschn', label: 'Mischen', tint: Color(0xFFFF8844)),
    FactionInfo(key: 'rep_oort', label: 'Oortians', tint: Color(0xFFAACCFF)),
    FactionInfo(key: 'rep_qnxs', label: 'Qnexus', tint: Color(0xFF66E0DD)),
  ];

  /// Lookup that covers both rep + rival keys.
  static FactionInfo? lookup(String? key) {
    if (key == null) return null;
    for (final f in alliedFactions) {
      if (f.key == key) return f;
    }
    for (final f in rivalOnlyFactions) {
      if (f.key == key) return f;
    }
    return null;
  }

  /// Human label for the `requiredTag` enum.
  static const tags = <String, String>{
    'NorthSquire': 'North Squire',
    'EastSquire': 'East Squire',
    'WestSquire': 'West Squire',
    'SouthSquire': 'South Squire',
    'UpSquire': 'Up Squire',
    'DownSquire': 'Down Squire',
    'VERIFIED': 'Verified',
  };

  /// Skills + their tint.
  static const skills = <String, Color>{
    'strength': Color(0xFFFF7755),
    'stealth': Color(0xFF8B6FFF),
    'knowledge': Color(0xFF4FC3FF),
    'fortitude': Color(0xFFFFB347),
    'panache': Color(0xFFFF77AA),
    'tech': Color(0xFF7AE3FF),
    'astro': Color(0xFFB377FF),
    'singing': Color(0xFFFFE9A8),
    'medicine': Color(0xFF5FE8A0),
    'magic': Color(0xFFE6E6FF),
    'leadership': Color(0xFFFFD15C),
    'corrupt': Color(0xFFFF5577),
    'carryCoin': Color(0xFFFFD15C),
    'stamina': Color(0xFFC58A4F),
    'wood': Color(0xFF8B6F47),
    'unobtainium': Color(0xFFB377FF),
    'oil': Color(0xFF3F4F6F),
  };

  /// Reward labels & tints. The keys here are the *canonicalised* reward
  /// values from `Job.reward`.
  static const rewards = <String, _Reward>{
    'coin': _Reward('Coin', Color(0xFFFFD15C)),
    'rocks': _Reward('Rocks', Color(0xFF8AA4C2)),
    'scrap': _Reward('Scrap', Color(0xFFC58A4F)),
    'titanium': _Reward('Titanium', Color(0xFF9DDCFF)),
    'energy': _Reward('Energy', Color(0xFF5FE8A0)),
    'mala': _Reward('Mala', Color(0xFFB377FF)),
    'wackos': _Reward('Wackos', Color(0xFFFF77AA)),
    'data': _Reward('Map Data', Color(0xFF4FC3FF)),
    'oil': _Reward('Oil', Color(0xFF3F4F6F)),
    'krypton': _Reward('Krypton', Color(0xFFAACCFF)),
    'star_tar': _Reward('Star Tar', Color(0xFF8B6FFF)),
    'stimnx': _Reward('Stimnx', Color(0xFFFF5577)),
    'supplies': _Reward('Supplies', Color(0xFF7AE3FF)),
    'wolfram': _Reward('Wolfram', Color(0xFF9C9C9C)),
    'unobtainium': _Reward('Unobtainium', Color(0xFFB377FF)),
    'aurum': _Reward('Aurum', Color(0xFFFFE9A8)),
  };

  static String rewardLabel(String key) =>
      rewards[key]?.label ?? key.toUpperCase();

  static Color rewardTint(String key) =>
      rewards[key]?.tint ?? AppColors.textSecondary;

  /// Type bucketing for the type chip section (kept loose — types are noisy).
  static const typeBuckets = <String, List<String>>{
    'Beginner': ['beginner'],
    'Skill gain': [
      'strength', 'stealth', 'knowledge', 'fortitude', 'panache',
      'singing', 'medical', 'magic', 'manipulation', 'observation',
      'corruption', 'cleaning', 'engineering', 'dock', 'comms',
      'performance',
    ],
    'Regular': [
      'transport', 'navigation', 'aid', 'repair', 'maintenance',
      'research', 'report', 'leadership', 'escort', 'sabotage',
      'supply run', 'late shift', 'long distance recon', 'deliver cargo',
      'teaching', 'science', 'puzzle', 'judge', 'hauler', 'compose',
      'challenge', 'audition', 'salvage', 'tech salvage',
      'vip transport',
    ],
    'Expansion': [
      'mrt expansion', 'lyc expansion', 'rsa expansion',
    ],
    'Event': [
      'rsa betrayal', 'martian war', 'king', 'king2prv', 'queen',
    ],
    'Unknown': ['???'],
  };

  /// Returns the bucket a normalised type belongs to (Beginner, Skill gain, …).
  /// "Other" if not catalogued.
  static String bucketFor(String type) {
    for (final entry in typeBuckets.entries) {
      if (entry.value.contains(type)) return entry.key;
    }
    return 'Other';
  }
}

class _Reward {
  const _Reward(this.label, this.tint);
  final String label;
  final Color tint;
}

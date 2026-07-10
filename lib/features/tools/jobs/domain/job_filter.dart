import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show RangeValues;

import 'job.dart';
import 'job_progress.dart';

export 'package:flutter/material.dart' show RangeValues;

enum JobSort {
  idAsc,
  riskAsc,
  riskDesc,
  bonusDesc,
  bonusAsc,
  skillAmtDesc,
  skillAmtAsc,
}

extension JobSortX on JobSort {
  String get label {
    switch (this) {
      case JobSort.idAsc:
        return 'ID ↑';
      case JobSort.riskAsc:
        return 'Risk ↑';
      case JobSort.riskDesc:
        return 'Risk ↓';
      case JobSort.bonusDesc:
        return 'Bonus ↓';
      case JobSort.bonusAsc:
        return 'Bonus ↑';
      case JobSort.skillAmtDesc:
        return 'Skill req ↓';
      case JobSort.skillAmtAsc:
        return 'Skill req ↑';
    }
  }

  int Function(Job, Job) get comparator {
    switch (this) {
      case JobSort.idAsc:
        return (a, b) => a.id.compareTo(b.id);
      case JobSort.riskAsc:
        return (a, b) => a.risk.compareTo(b.risk);
      case JobSort.riskDesc:
        return (a, b) => b.risk.compareTo(a.risk);
      case JobSort.bonusDesc:
        return (a, b) => b.bonus.compareTo(a.bonus);
      case JobSort.bonusAsc:
        return (a, b) => a.bonus.compareTo(b.bonus);
      case JobSort.skillAmtDesc:
        return (a, b) => b.requiredSkillAmt.compareTo(a.requiredSkillAmt);
      case JobSort.skillAmtAsc:
        return (a, b) => a.requiredSkillAmt.compareTo(b.requiredSkillAmt);
    }
  }
}

@immutable
class JobFilter {
  final String query;
  final Set<String> types;
  final Set<String> alliedFactions;
  final Set<String> rivalFactions;
  final Set<String> rewards;
  final Set<String> skills;
  final Set<String> tags;
  final RangeValues skillAmt; // 0..100
  final RangeValues requiredRep; // 0..8
  final RangeValues risk; // 0..14
  final RangeValues bonus; // full data extent by default; see bonusMin/bonusMax
  // Real min/max bonus of the loaded dataset. Until the filter sheet resolves
  // them from the jobs they stay ±infinity, which makes the default [bonus]
  // range accept every job — including the 11 negative-bonus jobs (F11).
  final double bonusMin;
  final double bonusMax;
  final int? pickupAstnum;
  final int? pickupZone;
  final int? dropoffAstnum;
  final int? dropoffZone;
  final bool onSiteOnly;
  final bool cargoJobsOnly;
  final bool rivalImpactOnly;
  final bool hidePlaceholder;
  // P3/22: companion filters. [starredOnly] keeps only favorited jobs;
  // [statuses] (when non-empty) keeps only jobs whose progress is in the set.
  // Both are applied outside [accepts] because they depend on external state
  // (favorites set + status map) rather than the Job itself.
  final bool starredOnly;
  final Set<JobProgress> statuses;
  final JobSort sort;

  const JobFilter({
    this.query = '',
    this.types = const {},
    this.alliedFactions = const {},
    this.rivalFactions = const {},
    this.rewards = const {},
    this.skills = const {},
    this.tags = const {},
    this.skillAmt = const RangeValues(0, 100),
    this.requiredRep = const RangeValues(0, 8),
    this.risk = const RangeValues(0, 14),
    this.bonus = bonusUnbounded,
    this.bonusMin = double.negativeInfinity,
    this.bonusMax = double.infinity,
    this.pickupAstnum,
    this.pickupZone,
    this.dropoffAstnum,
    this.dropoffZone,
    this.onSiteOnly = false,
    this.cargoJobsOnly = false,
    this.rivalImpactOnly = false,
    this.hidePlaceholder = false,
    this.starredOnly = false,
    this.statuses = const {},
    this.sort = JobSort.idAsc,
  });

  static const empty = JobFilter();

  /// Default [bonus] range: spans the whole real line so that, before the data
  /// extent is known, every job (negative bonuses included) passes the filter.
  static const bonusUnbounded =
      RangeValues(double.negativeInfinity, double.infinity);

  JobFilter copyWith({
    String? query,
    Set<String>? types,
    Set<String>? alliedFactions,
    Set<String>? rivalFactions,
    Set<String>? rewards,
    Set<String>? skills,
    Set<String>? tags,
    RangeValues? skillAmt,
    RangeValues? requiredRep,
    RangeValues? risk,
    RangeValues? bonus,
    double? bonusMin,
    double? bonusMax,
    int? pickupAstnum,
    bool clearPickupAstnum = false,
    int? pickupZone,
    bool clearPickupZone = false,
    int? dropoffAstnum,
    bool clearDropoffAstnum = false,
    int? dropoffZone,
    bool clearDropoffZone = false,
    bool? onSiteOnly,
    bool? cargoJobsOnly,
    bool? rivalImpactOnly,
    bool? hidePlaceholder,
    bool? starredOnly,
    Set<JobProgress>? statuses,
    JobSort? sort,
  }) =>
      JobFilter(
        query: query ?? this.query,
        types: types ?? this.types,
        alliedFactions: alliedFactions ?? this.alliedFactions,
        rivalFactions: rivalFactions ?? this.rivalFactions,
        rewards: rewards ?? this.rewards,
        skills: skills ?? this.skills,
        tags: tags ?? this.tags,
        skillAmt: skillAmt ?? this.skillAmt,
        requiredRep: requiredRep ?? this.requiredRep,
        risk: risk ?? this.risk,
        bonus: bonus ?? this.bonus,
        bonusMin: bonusMin ?? this.bonusMin,
        bonusMax: bonusMax ?? this.bonusMax,
        pickupAstnum:
            clearPickupAstnum ? null : (pickupAstnum ?? this.pickupAstnum),
        pickupZone: clearPickupZone ? null : (pickupZone ?? this.pickupZone),
        dropoffAstnum:
            clearDropoffAstnum ? null : (dropoffAstnum ?? this.dropoffAstnum),
        dropoffZone:
            clearDropoffZone ? null : (dropoffZone ?? this.dropoffZone),
        onSiteOnly: onSiteOnly ?? this.onSiteOnly,
        cargoJobsOnly: cargoJobsOnly ?? this.cargoJobsOnly,
        rivalImpactOnly: rivalImpactOnly ?? this.rivalImpactOnly,
        hidePlaceholder: hidePlaceholder ?? this.hidePlaceholder,
        starredOnly: starredOnly ?? this.starredOnly,
        statuses: statuses ?? this.statuses,
        sort: sort ?? this.sort,
      );

  /// Number of *meaningfully active* filters — excludes sort and ranges that
  /// are still at their full extent.
  int get activeCount {
    var c = 0;
    if (query.isNotEmpty) c++;
    if (types.isNotEmpty) c++;
    if (alliedFactions.isNotEmpty) c++;
    if (rivalFactions.isNotEmpty) c++;
    if (rewards.isNotEmpty) c++;
    if (skills.isNotEmpty) c++;
    if (tags.isNotEmpty) c++;
    if (skillAmt.start > 0 || skillAmt.end < 100) c++;
    if (requiredRep.start > 0 || requiredRep.end < 8) c++;
    if (risk.start > 0 || risk.end < 14) c++;
    // Bonus is only an active filter when narrowed inside the real data
    // extent; the full-extent (or still-unbounded) range counts as off (F11).
    if (bonus.start > bonusMin || bonus.end < bonusMax) c++;
    if (pickupAstnum != null) c++;
    if (pickupZone != null) c++;
    if (dropoffAstnum != null) c++;
    if (dropoffZone != null) c++;
    if (onSiteOnly) c++;
    if (cargoJobsOnly) c++;
    if (rivalImpactOnly) c++;
    if (hidePlaceholder) c++;
    if (starredOnly) c++;
    if (statuses.isNotEmpty) c++;
    return c;
  }

  /// Companion predicate for the favorites/status filters, evaluated with
  /// external state (a job's starred flag + its progress) since [accepts]
  /// only sees the Job itself.
  bool acceptsCompanion({required bool isStarred, required JobProgress status}) {
    if (starredOnly && !isStarred) return false;
    if (statuses.isNotEmpty && !statuses.contains(status)) return false;
    return true;
  }

  bool accepts(Job j) {
    if (query.isNotEmpty) {
      final q = query.toLowerCase();
      final hay =
          '${j.description}\n${j.onComplete}\n${j.id}\n${j.typeRaw}'.toLowerCase();
      if (!hay.contains(q)) return false;
    }
    if (types.isNotEmpty && !types.contains(j.type)) return false;
    if (alliedFactions.isNotEmpty &&
        (j.factionRep == null || !alliedFactions.contains(j.factionRep))) {
      return false;
    }
    if (rivalFactions.isNotEmpty) {
      if (j.factionRival == null) return false;
      if (!rivalFactions.contains(j.factionRival)) return false;
    }
    if (rewards.isNotEmpty && !rewards.contains(j.reward)) return false;
    if (skills.isNotEmpty &&
        (j.requiredSkill == null || !skills.contains(j.requiredSkill))) {
      return false;
    }
    if (tags.isNotEmpty &&
        (j.requiredTag == null || !tags.contains(j.requiredTag))) {
      return false;
    }
    if (j.requiredSkillAmt < skillAmt.start ||
        j.requiredSkillAmt > skillAmt.end) {
      return false;
    }
    if (j.requiredRep < requiredRep.start || j.requiredRep > requiredRep.end) {
      return false;
    }
    if (j.risk < risk.start || j.risk > risk.end) return false;
    if (j.bonus < bonus.start || j.bonus > bonus.end) return false;
    if (pickupAstnum != null && j.pickup.astnum != pickupAstnum) return false;
    if (pickupZone != null && j.pickup.zone != pickupZone) return false;
    if (dropoffAstnum != null && j.dropoff.astnum != dropoffAstnum) {
      return false;
    }
    if (dropoffZone != null && j.dropoff.zone != dropoffZone) return false;
    if (onSiteOnly && !j.isOnSite) return false;
    if (cargoJobsOnly && !j.isCargoJob) return false;
    if (rivalImpactOnly && !j.hasRival) return false;
    if (hidePlaceholder && j.isPlaceholderType) return false;
    return true;
  }
}


import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The currently selected zone id for a given map (family key = map id), or
/// `null` when nothing is selected.
///
/// `autoDispose` so selection state is dropped when the map screen closes;
/// keyed by map id so two open maps (unlikely, but possible via navigation)
/// never share a selection. The [SelectionPainter] and the zone sheet both read
/// this — a selection change repaints only the selection layer.
final selectedZoneProvider =
    StateProvider.autoDispose.family<String?, String>((ref, mapId) => null);

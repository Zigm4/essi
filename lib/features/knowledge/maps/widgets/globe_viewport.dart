import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/app_settings.dart';
import '../../../../services/haptics.dart';
import '../domain/map_geometry.dart' show GeoPoint;
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import '../render/flat_map_providers.dart';
import '../render/globe_painter.dart';
import '../render/sphere_hit_index.dart';
import '../render/sphere_math.dart';
import 'zone_sheet.dart';

/// The interactive globe surface (AUDIT-V2 §4.5 Plan A): a stylized neon sphere
/// whose orientation is a drag-driven quaternion and whose radius is pinch-zoom.
/// Frames advance through a [ValueNotifier] the [GlobePainter] listens to — no
/// per-frame `setState`. Optional auto-rotation is gated on reduce-motion
/// (functional pan/zoom is always on; only decorative spin stops).
///
/// Taps are inverse-projected by [unproject] (which rejects ill-conditioned limb
/// taps), picked through a [SphereHitIndex], and open the very same [ZoneSheet]
/// as the flat map.
class GlobeViewport extends ConsumerStatefulWidget {
  const GlobeViewport({
    super.key,
    required this.document,
    this.mapTitle = '',
    this.dimmed,
    this.initialZoneId,
  });

  final MapDocument document;

  /// Title of the owning map, forwarded to the [ZoneSheet] share card.
  final String mapTitle;

  /// Zone ids failing the active filter — drawn dimmed on the globe. `null` (or
  /// empty) means no filter is active.
  final ValueListenable<Set<String>>? dimmed;

  /// Zone to pre-select + orient toward on entry (from search / a deep link).
  final String? initialZoneId;

  @override
  ConsumerState<GlobeViewport> createState() => _GlobeViewportState();
}

class _GlobeViewportState extends ConsumerState<GlobeViewport>
    with SingleTickerProviderStateMixin {
  late final ValueNotifier<GlobeOrientation> _orientation;
  final ValueNotifier<double> _zoom = ValueNotifier<double>(1.0);

  /// Mirrors [selectedZoneProvider] as a [ValueListenable] so the [GlobePainter]
  /// (driven by a repaint listenable, not widget rebuilds) repaints the highlight
  /// on selection changes. Kept in sync from the provider in [build].
  final ValueNotifier<String?> _selected = ValueNotifier<String?>(null);

  /// Stand-in when no external filter set is supplied, so the painter always has
  /// a real notifier to listen to.
  final ValueNotifier<Set<String>> _noDimmed =
      ValueNotifier<Set<String>>(const {});
  late final Ticker _ticker;

  late SphereRender _render;
  late SphereHitIndex _hitIndex;
  late Map<String, MapZone> _zonesById;
  late Map<String, MapTheme> _themeById;
  late Map<String, GeoPoint> _centroidById;

  /// Grid documents only: zone id per cell, keyed `row * cols + col`. Drives
  /// the O(1) analytic pick (unproject → cell → id) — no polygon tests.
  Map<int, String> _gridZoneIdByCell = const {};

  Size _viewSize = Size.zero;
  double _zoomStart = 1.0;
  bool _interacting = false;
  Duration _lastTick = Duration.zero;
  double _degPerSec = 0;

  String get _mapId => widget.document.id;

  @override
  void initState() {
    super.initState();
    _rebuildModel();
    _orientation = ValueNotifier<GlobeOrientation>(_initialOrientation());
    _ticker = createTicker(_onTick);
    _scheduleInitialSelection();
  }

  /// Pre-selects the deep-linked zone once mounted (the globe is already oriented
  /// toward it by [_initialOrientation]).
  void _scheduleInitialSelection() {
    final zoneId = widget.initialZoneId;
    if (zoneId == null || !_zonesById.containsKey(zoneId)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(selectedZoneProvider(_mapId).notifier).state = zoneId;
    });
  }

  @override
  void didUpdateWidget(GlobeViewport old) {
    super.didUpdateWidget(old);
    if (!identical(old.document, widget.document)) {
      _rebuildModel();
      _orientation.value = _initialOrientation();
      _zoom.value = 1.0;
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _orientation.dispose();
    _zoom.dispose();
    _selected.dispose();
    _noDimmed.dispose();
    super.dispose();
  }

  void _rebuildModel() {
    _render = buildSphereRender(widget.document);
    _hitIndex = SphereHitIndex.fromZones(widget.document.zones);
    _zonesById = {for (final z in widget.document.zones) z.id: z};
    _themeById = {for (final i in _render.items) i.zoneId: i.theme};
    _centroidById = {for (final i in _render.items) i.zoneId: i.centroid};
    final grid = widget.document.grid;
    _gridZoneIdByCell = grid == null
        ? const {}
        : {
            for (final z in widget.document.zones)
              if (z.gridPos != null)
                z.gridPos!.row * grid.cols + z.gridPos!.col: z.id,
          };
    // Grid zones have no explicit centroid-bearing render item when they are
    // unexplored; deep links still need an orientation target.
    if (grid != null) {
      for (final z in widget.document.zones) {
        final pos = z.gridPos;
        if (pos != null) {
          _centroidById.putIfAbsent(
              z.id, () => grid.cellCenter(pos.col, pos.row));
        }
      }
    }
    _degPerSec = widget.document.sphere?.autoRotateDegPerSec ?? 0.0;
  }

  GlobeOrientation _initialOrientation() {
    // Deep-linked to a zone: orient the globe so that zone faces the camera.
    final focusId = widget.initialZoneId;
    final focus = focusId == null ? null : _centroidById[focusId];
    if (focus != null) {
      return GlobeOrientation.fromLatLon(lat: focus.lat, lon: focus.lon);
    }
    final o = widget.document.sphere?.initialOrientation;
    return GlobeOrientation.fromLatLon(lat: o?.lat ?? 0.0, lon: o?.lon ?? 0.0);
  }

  double get _radius => globeRadiusFor(_viewSize, _zoom.value);
  Offset get _center => globeCenterFor(_viewSize);

  // --- decorative auto-rotation (gated) --------------------------------------

  void _onTick(Duration elapsed) {
    if (_lastTick == Duration.zero) {
      _lastTick = elapsed;
      return;
    }
    final dt = (elapsed - _lastTick).inMicroseconds / 1e6;
    _lastTick = elapsed;
    if (_interacting) return;
    _orientation.value = _orientation.value.autoRotate(_degPerSec * dt);
  }

  void _syncTicker({required bool reduceMotion}) {
    final shouldRun = !reduceMotion && _degPerSec != 0;
    if (shouldRun && !_ticker.isActive) {
      _lastTick = Duration.zero;
      _ticker.start();
    } else if (!shouldRun && _ticker.isActive) {
      _ticker.stop();
    }
  }

  // --- gestures --------------------------------------------------------------

  void _onScaleStart(ScaleStartDetails d) {
    _interacting = true;
    _zoomStart = _zoom.value;
  }

  void _onScaleUpdate(ScaleUpdateDetails d) {
    final delta = d.focalPointDelta;
    if (delta != Offset.zero) {
      _orientation.value = _orientation.value.dragBy(delta.dx, delta.dy, _radius);
    }
    if (d.scale != 1.0) {
      _zoom.value = (_zoomStart * d.scale).clamp(0.6, 4.0);
    }
  }

  void _onScaleEnd(ScaleEndDetails d) {
    _interacting = false;
    _lastTick = Duration.zero; // avoid a spin jump after a long drag
  }

  void _onTapUp(TapUpDetails d) {
    final geo = unproject(d.localPosition, _orientation.value, _radius, _center);
    final grid = widget.document.grid;
    final String? id;
    if (grid != null) {
      // Grid docs pick analytically: unproject → cell → O(1) lookup. A null
      // geo (off-disc / limb tap) clears the selection like everywhere else.
      if (geo == null) {
        id = null;
      } else {
        final cell = gridCellAt(geo, cols: grid.cols, rows: grid.rows);
        id = _gridZoneIdByCell[cell.row * grid.cols + cell.col];
      }
    } else {
      id = _hitIndex.hitTest(geo); // null geo (off-disc / limb) → no hit
    }
    if (id != null) Haptics.of(ref).selection();
    ref.read(selectedZoneProvider(_mapId).notifier).state = id;
  }

  void _clearSelection() {
    ref.read(selectedZoneProvider(_mapId).notifier).state = null;
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        ref.watch(appSettingsProvider.select((s) => s.reduceAnimations)) ||
            MediaQuery.disableAnimationsOf(context);
    _syncTicker(reduceMotion: reduceMotion);

    // Mirror the provider into the painter's repaint listenable.
    final selectedId = ref.watch(selectedZoneProvider(_mapId));
    _selected.value = selectedId;
    final selectedZone = selectedId == null ? null : _zonesById[selectedId];

    return LayoutBuilder(
      builder: (context, constraints) {
        _viewSize = Size(constraints.maxWidth, constraints.maxHeight);
        return Stack(
          children: [
            Positioned.fill(
              child: ColoredBox(
                color: _render.theme.background,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onScaleStart: _onScaleStart,
                  onScaleUpdate: _onScaleUpdate,
                  onScaleEnd: _onScaleEnd,
                  onTapUp: _onTapUp,
                  child: RepaintBoundary(
                    child: CustomPaint(
                      size: Size.infinite,
                      isComplex: true,
                      painter: GlobePainter(
                        render: _render,
                        orientation: _orientation,
                        zoom: _zoom,
                        selected: _selected,
                        dimmed: widget.dimmed ?? _noDimmed,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            // Selection sheet overlay (screen space, above the globe).
            if (selectedZone != null)
              Positioned.fill(
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _clearSelection,
                        child: const SizedBox.expand(),
                      ),
                    ),
                    ZoneSheet(
                      zone: selectedZone,
                      fieldsSchema: widget.document.fieldsSchema,
                      theme: _themeById[selectedId] ?? _render.theme,
                      mapId: _mapId,
                      mapTitle: widget.mapTitle,
                      onClose: _clearSelection,
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

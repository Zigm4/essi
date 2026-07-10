import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/haptics.dart';
import '../domain/map_models.dart';
import '../render/flat_background_painter.dart';
import '../render/flat_map_providers.dart';
import '../render/flat_map_render_model.dart';
import '../render/label_painter.dart';
import '../render/selection_painter.dart';
import '../render/zone_hit_index.dart';
import '../render/zone_painter.dart';
import 'zone_sheet.dart';

/// The interactive flat-map surface: a pan/zoom [InteractiveViewer] over the map
/// in **map-pixel space**, with the background, zones, selection, and labels each
/// on their own [RepaintBoundary] layer. Taps hit-test zones and drive the
/// [selectedZoneProvider]; the matching [ZoneSheet] is shown as an overlay.
///
/// The viewport works in canvas coordinates: `constrained: false` sizes the child
/// to the canvas, `minScale` fits it to the viewport, `maxScale` = 8. Because the
/// child is transformed as a single layer, the static layers never repaint on
/// pan/zoom — only the LOD flag (labels) and the selection change trigger paints.
class FlatMapViewport extends ConsumerStatefulWidget {
  const FlatMapViewport({
    super.key,
    required this.document,
    required this.backgroundBytes,
    this.mapTitle = '',
    this.dimmed,
    this.initialZoneId,
  });

  final MapDocument document;

  /// Title of the owning map, forwarded to the [ZoneSheet] share card.
  final String mapTitle;

  /// Raw background image bytes, decoded at a constrained size by the layer.
  final Uint8List? backgroundBytes;

  /// Zone ids failing the active filter — drawn dimmed on the canvas. `null`
  /// (or empty) means no filter is active.
  final ValueListenable<Set<String>>? dimmed;

  /// Zone to pre-select + center on first layout (from search / a deep link).
  final String? initialZoneId;

  @override
  ConsumerState<FlatMapViewport> createState() => _FlatMapViewportState();
}

class _FlatMapViewportState extends ConsumerState<FlatMapViewport> {
  final TransformationController _controller = TransformationController();
  final ValueNotifier<double> _scale = ValueNotifier<double>(1);
  final ValueNotifier<bool> _labelsVisible = ValueNotifier<bool>(false);

  /// Stand-in when no external filter set is supplied, so [_MapLayers] can always
  /// listen to a real notifier.
  final ValueNotifier<Set<String>> _noDimmed =
      ValueNotifier<Set<String>>(const {});

  late FlatMapRender _render;
  late ZoneHitIndex _hitIndex;
  late Map<String, ZoneRenderItem> _itemsById;
  late Map<String, MapZone> _zonesById;
  bool _initialized = false;

  String get _mapId => widget.document.id;

  @override
  void initState() {
    super.initState();
    _rebuildModel();
    _controller.addListener(_syncFromController);
    _scheduleInitialSelection();
  }

  /// Pre-selects the deep-linked zone once the tree is mounted (the centering is
  /// handled by [_ensureInitialTransform] on first layout).
  void _scheduleInitialSelection() {
    final zoneId = widget.initialZoneId;
    if (zoneId == null || !_zonesById.containsKey(zoneId)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(selectedZoneProvider(_mapId).notifier).state = zoneId;
    });
  }

  @override
  void didUpdateWidget(FlatMapViewport old) {
    super.didUpdateWidget(old);
    if (!identical(old.document, widget.document)) {
      _initialized = false;
      _rebuildModel();
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_syncFromController);
    _controller.dispose();
    _scale.dispose();
    _labelsVisible.dispose();
    _noDimmed.dispose();
    super.dispose();
  }

  void _rebuildModel() {
    _render = buildFlatMapRender(widget.document);
    _hitIndex = ZoneHitIndex.fromZones(widget.document.zones);
    _itemsById = {for (final i in _render.items) i.zoneId: i};
    _zonesById = {for (final z in widget.document.zones) z.id: z};
  }

  void _syncFromController() {
    final s = _controller.value.getMaxScaleOnAxis();
    _scale.value = s;
    _labelsVisible.value = s >= _render.labelLodScale;
  }

  double _fitScale(double vw, double vh) {
    final cw = _render.canvasSize.width;
    final ch = _render.canvasSize.height;
    if (cw <= 0 || ch <= 0) return 1;
    return math.min(vw / cw, vh / ch);
  }

  void _ensureInitialTransform(double vw, double vh) {
    if (_initialized || vw <= 0 || vh <= 0) return;
    _initialized = true;
    final fit = _fitScale(vw, vh);
    final cw = _render.canvasSize.width;
    final ch = _render.canvasSize.height;

    // Deep-linked to a zone: zoom in and center on it instead of fitting the
    // whole canvas. Otherwise fit + center the canvas as usual.
    final focus = _focusItem();
    double scale;
    double tx;
    double ty;
    if (focus != null && focus.bounds.width > 0 && focus.bounds.height > 0) {
      final b = focus.bounds;
      // Frame the zone at ~55% of the viewport, clamped to a sane zoom band.
      final target = math.min(vw / (b.width / 0.55), vh / (b.height / 0.55));
      scale = target.clamp(fit, math.max(8.0, fit));
      tx = vw / 2 - b.center.dx * scale;
      ty = vh / 2 - b.center.dy * scale;
    } else {
      scale = fit;
      tx = (vw - cw * fit) / 2;
      ty = (vh - ch * fit) / 2;
    }
    // Scale about the origin, then translate to center — T * S.
    final m = Matrix4.translationValues(tx, ty, 0)
      ..multiply(Matrix4.diagonal3Values(scale, scale, 1));
    // Mutating the controller fires listeners → setState-free notifier updates;
    // defer to after this build so we never mutate during layout.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _controller.value = m;
      _syncFromController();
    });
  }

  /// The render item for the deep-linked zone, if it has drawable bounds.
  ZoneRenderItem? _focusItem() {
    final id = widget.initialZoneId;
    if (id == null) return null;
    return _itemsById[id];
  }

  void _onTap(Offset canvasPoint) {
    final id = _hitIndex.hitTest(canvasPoint, scale: _scale.value);
    final notifier = ref.read(selectedZoneProvider(_mapId).notifier);
    if (id != null) Haptics.of(ref).selection();
    notifier.state = id;
  }

  void _clearSelection() {
    ref.read(selectedZoneProvider(_mapId).notifier).state = null;
  }

  @override
  Widget build(BuildContext context) {
    final theme = _render.theme;
    return LayoutBuilder(
      builder: (context, constraints) {
        final vw = constraints.maxWidth;
        final vh = constraints.maxHeight;
        _ensureInitialTransform(vw, vh);
        final fit = _fitScale(vw, vh);
        return Stack(
          children: [
            Positioned.fill(
              child: ColoredBox(
                color: theme.background,
                child: InteractiveViewer(
                  transformationController: _controller,
                  constrained: false,
                  minScale: fit,
                  maxScale: math.max(8.0, fit),
                  boundaryMargin: EdgeInsets.all(math.max(vw, vh)),
                  child: SizedBox(
                    width: _render.canvasSize.width,
                    height: _render.canvasSize.height,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapUp: (d) => _onTap(d.localPosition),
                      child: _MapLayers(
                        render: _render,
                        backgroundBytes: widget.backgroundBytes,
                        scale: _scale,
                        labelsVisible: _labelsVisible,
                        dimmed: widget.dimmed ?? _noDimmed,
                        mapId: _mapId,
                        itemsById: _itemsById,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            // Selection sheet overlay (screen space, above the transformed map).
            Consumer(
              builder: (context, ref, _) {
                final id = ref.watch(selectedZoneProvider(_mapId));
                final zone = id == null ? null : _zonesById[id];
                final item = id == null ? null : _itemsById[id];
                if (zone == null || item == null) {
                  return const SizedBox.shrink();
                }
                return Positioned.fill(
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
                        zone: zone,
                        fieldsSchema: widget.document.fieldsSchema,
                        theme: item.theme,
                        mapId: _mapId,
                        mapTitle: widget.mapTitle,
                        onClose: _clearSelection,
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

/// The stacked, per-layer paint tree inside the transformed canvas. Split out so
/// it is not rebuilt when the selection changes (selection is a sibling overlay).
class _MapLayers extends StatelessWidget {
  const _MapLayers({
    required this.render,
    required this.backgroundBytes,
    required this.scale,
    required this.labelsVisible,
    required this.dimmed,
    required this.mapId,
    required this.itemsById,
  });

  final FlatMapRender render;
  final Uint8List? backgroundBytes;
  final ValueNotifier<double> scale;
  final ValueNotifier<bool> labelsVisible;
  final ValueListenable<Set<String>> dimmed;
  final String mapId;
  final Map<String, ZoneRenderItem> itemsById;

  @override
  Widget build(BuildContext context) {
    final size = render.canvasSize;
    return Stack(
      children: [
        // 1. Background image (constrained decode).
        RepaintBoundary(
          child: FlatBackground(
            bytes: backgroundBytes,
            canvasSize: size,
            scale: scale,
            fill: render.theme.background,
          ),
        ),
        // 2. Zone fills / strokes / glow (+ label scrims, LOD-gated). Repaints on
        //    LOD (labels) or the active filter (dimming) changing.
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: Listenable.merge([labelsVisible, dimmed]),
            builder: (context, _) => CustomPaint(
              size: size,
              isComplex: true,
              painter: ZonePainter(
                render: render,
                labelsVisible: labelsVisible.value,
                dimmed: dimmed.value,
              ),
            ),
          ),
        ),
        // 3. Selection highlight (repaints only on selection change).
        RepaintBoundary(
          child: Consumer(
            builder: (context, ref, _) {
              final id = ref.watch(selectedZoneProvider(mapId));
              return CustomPaint(
                size: size,
                painter: SelectionPainter(
                  selected: id == null ? null : itemsById[id],
                  canvasSize: size,
                ),
              );
            },
          ),
        ),
        // 4. Labels (LOD-gated), dimmed to match filtered-out zones.
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: Listenable.merge([labelsVisible, dimmed]),
            builder: (context, _) => CustomPaint(
              size: size,
              painter: LabelPainter(
                render: render,
                visible: labelsVisible.value,
                dimmed: dimmed.value,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

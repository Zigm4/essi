import 'dart:math' as math;

import 'package:flutter/foundation.dart' show ValueListenable, setEquals;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/haptics.dart';
import '../domain/map_models.dart';
import '../domain/map_theme.dart';
import '../render/flat_map_providers.dart';
import '../render/zone_paint_ops.dart';
import 'zone_sheet.dart';

/// Canvas-space size of one grid cell (px). The whole table lives in this
/// synthetic "grid canvas" space, pan/zoomed exactly like the flat map's
/// image space.
const double kGridCellWidth = 96.0;
const double kGridCellHeight = 64.0;

/// Canvas-space font sizes for the two cell texts.
const double _kNameFontSize = 13.0;
const double _kNumFontSize = 10.0;

/// Minimum on-screen height (screen px) for a readable zone name; below the
/// derived scale threshold names are hidden (LOD), mirroring the flat map.
const double _kMinNameScreenPx = 12.0;

/// Alpha multiplier for cells failing the active filter, matching the ~30 %
/// fade used by the flat map and the globe.
const double _kDimAlpha = 0.30;

/// The "text map" of a grid-sphere document: a pan/zoomable table of
/// `cols × rows` cells — the tabular twin of the globe, like the community
/// spreadsheet. Each cell shows its `cellNum` (always) and its zone name (once
/// zoomed to a readable scale); explored cells are tinted with their theme
/// override's `zoneFill`. Tapping a cell drives the very same
/// [selectedZoneProvider] and opens the very same [ZoneSheet] as the globe, so
/// selection survives switching representations.
///
/// Structure mirrors [FlatMapViewport]: an [InteractiveViewer] in canvas
/// space over layered [CustomPaint]s on their own [RepaintBoundary]s.
class MapGridView extends ConsumerStatefulWidget {
  const MapGridView({
    super.key,
    required this.document,
    this.mapTitle = '',
    this.dimmed,
    this.initialZoneId,
  });

  final MapDocument document;

  /// Title of the owning map, forwarded to the [ZoneSheet] share card.
  final String mapTitle;

  /// Zone ids failing the active filter — drawn faded. `null` (or empty)
  /// means no filter is active.
  final ValueListenable<Set<String>>? dimmed;

  /// Zone to pre-select + center on first layout (from search / a deep link).
  final String? initialZoneId;

  @override
  ConsumerState<MapGridView> createState() => _MapGridViewState();
}

class _MapGridViewState extends ConsumerState<MapGridView> {
  final TransformationController _controller = TransformationController();
  final ValueNotifier<double> _scale = ValueNotifier<double>(1);
  final ValueNotifier<bool> _namesVisible = ValueNotifier<bool>(false);
  final ValueNotifier<Set<String>> _noDimmed =
      ValueNotifier<Set<String>>(const {});

  late _GridTableRender _render;
  bool _initialized = false;

  String get _mapId => widget.document.id;

  @override
  void initState() {
    super.initState();
    _rebuildModel();
    _controller.addListener(_syncFromController);
    _scheduleInitialSelection();
  }

  void _scheduleInitialSelection() {
    final zoneId = widget.initialZoneId;
    if (zoneId == null || !_render.cellsByZoneId.containsKey(zoneId)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(selectedZoneProvider(_mapId).notifier).state = zoneId;
    });
  }

  @override
  void didUpdateWidget(MapGridView old) {
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
    _namesVisible.dispose();
    _noDimmed.dispose();
    super.dispose();
  }

  void _rebuildModel() {
    _render = _buildGridTableRender(widget.document);
  }

  void _syncFromController() {
    final s = _controller.value.getMaxScaleOnAxis();
    _scale.value = s;
    _namesVisible.value = s >= _render.nameLodScale;
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

    // Deep-linked to a zone: zoom in and center on its cell; otherwise fit.
    final focus = widget.initialZoneId == null
        ? null
        : _render.cellsByZoneId[widget.initialZoneId!];
    double scale;
    double tx;
    double ty;
    if (focus != null) {
      final b = focus.rect;
      // Frame the cell readable: at least the name LOD scale.
      scale = math
          .max(_render.nameLodScale * 1.1, fit)
          .clamp(fit, math.max(8.0, fit));
      tx = vw / 2 - b.center.dx * scale;
      ty = vh / 2 - b.center.dy * scale;
    } else {
      scale = fit;
      tx = (vw - cw * fit) / 2;
      ty = (vh - ch * fit) / 2;
    }
    final m = Matrix4.translationValues(tx, ty, 0)
      ..multiply(Matrix4.diagonal3Values(scale, scale, 1));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _controller.value = m;
      _syncFromController();
    });
  }

  void _onTap(Offset canvasPoint) {
    final grid = _render.grid;
    final col = (canvasPoint.dx ~/ kGridCellWidth).clamp(0, grid.cols - 1);
    final row = (canvasPoint.dy ~/ kGridCellHeight).clamp(0, grid.rows - 1);
    final id = _render.zoneIdByCell[row * grid.cols + col];
    if (id != null) Haptics.of(ref).selection();
    ref.read(selectedZoneProvider(_mapId).notifier).state = id;
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
                      child: Stack(
                        children: [
                          // 1. The table: fills, grid lines, numbers, names.
                          RepaintBoundary(
                            child: AnimatedBuilder(
                              animation: Listenable.merge(
                                  [_namesVisible, widget.dimmed ?? _noDimmed]),
                              builder: (context, _) => CustomPaint(
                                size: _render.canvasSize,
                                isComplex: true,
                                painter: _GridTablePainter(
                                  render: _render,
                                  namesVisible: _namesVisible.value,
                                  dimmed:
                                      (widget.dimmed ?? _noDimmed).value,
                                ),
                              ),
                            ),
                          ),
                          // 2. Selection highlight (repaints on selection only).
                          RepaintBoundary(
                            child: Consumer(
                              builder: (context, ref, _) {
                                final id =
                                    ref.watch(selectedZoneProvider(_mapId));
                                return CustomPaint(
                                  size: _render.canvasSize,
                                  painter: _GridSelectionPainter(
                                    render: _render,
                                    selectedId: id,
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            // Selection sheet overlay (screen space, above the table) — the
            // exact same ZoneSheet the globe opens.
            Consumer(
              builder: (context, ref, _) {
                final id = ref.watch(selectedZoneProvider(_mapId));
                final cell = id == null ? null : _render.cellsByZoneId[id];
                if (id == null || cell == null) return const SizedBox.shrink();
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
                        zone: cell.zone,
                        fieldsSchema: widget.document.fieldsSchema,
                        theme: cell.theme,
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

// --- render model --------------------------------------------------------------

/// Precomputed paint data for one occupied grid cell.
class _GridCellRender {
  final MapZone zone;
  final Rect rect;

  /// Resolved theme (base + restricted override), sanitized.
  final MapTheme theme;

  /// Whether the cell is "explored" (carries a theme override) and is tinted
  /// with its own zoneFill rather than the subtle empty tint.
  final bool explored;

  /// The cell number glyphs (`cellNum`), or `null` when the zone has none.
  final TextPainter? numPainter;

  /// The zone-name glyphs, or `null` for a placeholder-named cell.
  final TextPainter? namePainter;

  const _GridCellRender({
    required this.zone,
    required this.rect,
    required this.theme,
    required this.explored,
    required this.numPainter,
    required this.namePainter,
  });
}

/// Fully precomputed render model for the grid table. Built once per document
/// (it lays out every cell's text); the painters only re-read it.
class _GridTableRender {
  final MapGrid grid;
  final MapTheme theme;
  final Size canvasSize;
  final List<_GridCellRender> cells;
  final Map<int, String> zoneIdByCell; // row * cols + col → zone id
  final Map<String, _GridCellRender> cellsByZoneId;

  /// Viewport scale at/above which zone names are drawn (LOD).
  final double nameLodScale;

  const _GridTableRender({
    required this.grid,
    required this.theme,
    required this.canvasSize,
    required this.cells,
    required this.zoneIdByCell,
    required this.cellsByZoneId,
    required this.nameLodScale,
  });
}

/// Builds the [_GridTableRender] for a grid document. Callers must ensure
/// `doc.grid != null`. Must run with a live Flutter binding (text layout).
_GridTableRender _buildGridTableRender(MapDocument doc) {
  final grid = doc.grid!;
  final base = doc.theme.sanitize();
  final cells = <_GridCellRender>[];
  final zoneIdByCell = <int, String>{};
  final cellsByZoneId = <String, _GridCellRender>{};

  for (final z in doc.zones) {
    final pos = z.gridPos;
    if (pos == null || pos.col >= grid.cols || pos.row >= grid.rows) continue;
    final theme = zoneTheme(base, z.themeOverride);
    final rect = Rect.fromLTWH(
      pos.col * kGridCellWidth,
      pos.row * kGridCellHeight,
      kGridCellWidth,
      kGridCellHeight,
    );
    final showName = z.name.isNotEmpty && !_isPlaceholderCellName(z.name);
    final cell = _GridCellRender(
      zone: z,
      rect: rect,
      theme: theme,
      explored: z.themeOverride != null,
      numPainter: z.cellNum == null
          ? null
          : _layoutText(
              '${z.cellNum}',
              fontSize: _kNumFontSize,
              color: theme.label.withValues(alpha: 0.55),
              fontFamily: base.fontFamily,
              maxWidth: kGridCellWidth - 8,
              maxLines: 1,
            ),
      namePainter: !showName
          ? null
          : _layoutText(
              z.name,
              fontSize: _kNameFontSize,
              color: theme.label,
              fontFamily: base.fontFamily,
              maxWidth: kGridCellWidth - 12,
              maxLines: 2,
            ),
    );
    cells.add(cell);
    zoneIdByCell[pos.row * grid.cols + pos.col] = z.id;
    cellsByZoneId[z.id] = cell;
  }

  return _GridTableRender(
    grid: grid,
    theme: base,
    canvasSize:
        Size(grid.cols * kGridCellWidth, grid.rows * kGridCellHeight),
    cells: cells,
    zoneIdByCell: zoneIdByCell,
    cellsByZoneId: cellsByZoneId,
    nameLodScale: _kMinNameScreenPx / _kNameFontSize,
  );
}

/// `Zone <n>` placeholder names add nothing over the drawn cellNum.
final RegExp _kPlaceholderCellName = RegExp(r'^Zone\s+\d+$');
bool _isPlaceholderCellName(String name) =>
    _kPlaceholderCellName.hasMatch(name.trim());

TextPainter _layoutText(
  String text, {
  required double fontSize,
  required Color color,
  required String fontFamily,
  required double maxWidth,
  required int maxLines,
}) {
  return TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(
        fontFamily: fontFamily,
        fontSize: fontSize,
        height: 1.1,
        fontWeight: FontWeight.w600,
        color: color,
        decoration: TextDecoration.none,
      ),
    ),
    textAlign: TextAlign.center,
    textDirection: TextDirection.ltr,
    maxLines: maxLines,
    ellipsis: '…',
  )..layout(maxWidth: maxWidth);
}

// --- painters --------------------------------------------------------------------

/// Paints the whole table: cell fills, thin grid lines, cell numbers, and
/// (LOD-gated) zone names over their legibility scrims. Dimmed (filtered-out)
/// cells fade fills by direct alpha math and route their glyphs through one
/// shared ~30 % saveLayer — never a layer per cell.
class _GridTablePainter extends CustomPainter {
  final _GridTableRender render;
  final bool namesVisible;
  final Set<String> dimmed;

  const _GridTablePainter({
    required this.render,
    required this.namesVisible,
    required this.dimmed,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final theme = render.theme;
    final emptyTint = theme.zoneFill.withValues(alpha: 0.08);
    final fillPaint = Paint();

    // 1. Cell fills (dimmed cells by direct alpha reduction — fills are flat
    //    colors, so this equals a compositing fade at a fraction of the cost).
    for (final cell in render.cells) {
      final isDim = dimmed.contains(cell.zone.id);
      final Color color = cell.explored
          ? cell.theme.zoneFill.withValues(alpha: isDim ? 0.42 * _kDimAlpha : 0.42)
          : (isDim
              ? emptyTint.withValues(alpha: 0.08 * _kDimAlpha)
              : emptyTint);
      fillPaint.color = color;
      canvas.drawRect(cell.rect, fillPaint);
    }

    // 2. Thin grid lines over the fills.
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..color = theme.zoneStroke.withValues(alpha: 0.18);
    final gridPath = Path();
    for (var c = 0; c <= render.grid.cols; c++) {
      final x = c * kGridCellWidth;
      gridPath.moveTo(x, 0);
      gridPath.lineTo(x, size.height);
    }
    for (var r = 0; r <= render.grid.rows; r++) {
      final y = r * kGridCellHeight;
      gridPath.moveTo(0, y);
      gridPath.lineTo(size.width, y);
    }
    canvas.drawPath(gridPath, line);

    // 3. Texts — normal cells directly, dimmed cells through a single shared
    //    fade layer (text color is baked into the laid-out glyphs).
    _paintTexts(canvas, dimmedPass: false);
    if (dimmed.isNotEmpty) {
      canvas.saveLayer(
        Offset.zero & size,
        Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: _kDimAlpha),
      );
      _paintTexts(canvas, dimmedPass: true);
      canvas.restore();
    }
  }

  void _paintTexts(Canvas canvas, {required bool dimmedPass}) {
    for (final cell in render.cells) {
      if (dimmed.contains(cell.zone.id) != dimmedPass) continue;
      final numText = cell.numPainter;
      final name = namesVisible ? cell.namePainter : null;
      if (numText != null) {
        // Number pinned top-left with a small inset (spreadsheet style).
        numText.paint(canvas, cell.rect.topLeft + const Offset(4, 3));
      }
      if (name != null) {
        final topLeft = cell.rect.center -
            Offset(name.width / 2, name.height / 2 - _kNumFontSize * 0.35);
        // Systematic legibility scrim behind the name (engine guarantee,
        // matching the globe/flat-map label rule).
        final padX = _kNameFontSize * 0.35;
        final padY = _kNameFontSize * 0.2;
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              topLeft.dx - padX,
              topLeft.dy - padY,
              name.width + padX * 2,
              name.height + padY * 2,
            ),
            Radius.circular(_kNameFontSize * 0.4),
          ),
          Paint()..color = cell.theme.background.withValues(alpha: 0.72),
        );
        name.paint(canvas, topLeft);
      }
    }
  }

  @override
  bool shouldRepaint(_GridTablePainter old) =>
      old.render != render ||
      old.namesVisible != namesVisible ||
      !setEquals(old.dimmed, dimmed);
}

/// Highlights the selected cell with the shared zone paint (selected fill +
/// glow + thickened outline), so the table and the globe read as one system.
class _GridSelectionPainter extends CustomPainter {
  final _GridTableRender render;
  final String? selectedId;

  const _GridSelectionPainter({
    required this.render,
    required this.selectedId,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final id = selectedId;
    if (id == null) return;
    final cell = render.cellsByZoneId[id];
    if (cell == null) return;
    paintPolygonZone(
      canvas,
      Path()..addRect(cell.rect),
      cell.theme,
      strokeWidth: 2.5,
      selected: true,
    );
  }

  @override
  bool shouldRepaint(_GridSelectionPainter old) =>
      old.render != render || old.selectedId != selectedId;
}

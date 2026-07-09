import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/colors.dart';
import '../../../design_system/spacing.dart';
import '../../../design_system/typography.dart';
import '../../../services/app_settings.dart';

class EvilShip {
  EvilShip._();
  static const prefix = 'EVIL';
  static const instanceNumber = '01';
  static const fullIdentifier = 'EVIL-01';
  static const ownerLabel = 'East-Shire';
  static const defaultLocationKey = 'east-shire';
}

enum _IntroPhase { scrolling, fading, portal }

/// Captain's log paragraphs. No em or en dashes; plain punctuation only.
const _logLines = <String>[
  "// captain's log, uncertified channel",
  '// origin: somewhere astern of the present',
  '',
  'I am Captain GreyWhisker.',
  '',
  'If this transmission reaches your console, you have already brushed against the void. That is not a threat. That is just how she introduces herself.',
  '',
  'The vessel you are about to register is no Solstice, no Ratship. It is the Lawless: the only EVIL hull ever laid down at the East-Shire docks. There were others. The records of them have been politely forgotten.',
  '',
  'She does not move the way ships move. She is not pulled by gravity, she is invited by it. She does not warm her hull on a star, she remembers being warm. The instruments lie about her, and the instruments are not at fault.',
  '',
  'I have steered her through three Marses now. Two of them were ours. One belonged to an East-Shire that took a different vote, in a year you will never live in. The crew there were kind. The food was strange. We did not stay.',
  '',
  'She will tell you, in her quiet way, that she has been to places this companion app does not list. Coastal towns under Phobos. A trade route to a Ceres that survived. The Imperious Falls running upward, slowly, against a sky that had given up on being blue.',
  '',
  'She has no pilot. She has no gunner. She does not need a quartermaster, because what we bring back is rarely the same shape as what we left with.',
  '',
  'If you mean to keep her in your hangar, understand this: she is registered to East-Shire and to East-Shire alone. She answers no captain. She answers a question I no longer remember asking.',
  '',
  'When you close this log, your console will show what little can honestly be said about her. Matricule EVIL-01. Ownership East-Shire. Attached to the void docks. The other fields will fall quiet. They are not broken. They are simply not for you to fill in.',
  '',
  'Take care out there.',
  '',
  'GreyWhisker, somewhere off the chart.',
];

class EvilShipIntroView extends ConsumerStatefulWidget {
  const EvilShipIntroView({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  ConsumerState<EvilShipIntroView> createState() => _EvilShipIntroViewState();
}

class _EvilShipIntroViewState extends ConsumerState<EvilShipIntroView>
    with TickerProviderStateMixin {
  static const _scrollSeconds = 110;

  _IntroPhase _phase = _IntroPhase.scrolling;
  double _textOpacity = 1.0;
  double _portalProgress = 0.0;

  late final AnimationController _portalController = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  );
  late final AnimationController _textFadeController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  @override
  void dispose() {
    _portalController.dispose();
    _textFadeController.dispose();
    super.dispose();
  }

  void _triggerPortal() {
    if (_phase != _IntroPhase.scrolling) return;
    final reduce = ref.read(appSettingsProvider).reduceAnimations;
    setState(() => _phase = _IntroPhase.fading);
    final fadeMs = reduce ? 200 : 1600;
    _textFadeController.duration = Duration(milliseconds: fadeMs);
    _textFadeController.addListener(() {
      setState(() => _textOpacity = 1.0 - _textFadeController.value);
    });
    _textFadeController.forward(from: 0);
    final portalMs = reduce ? 600 : 4000;
    _portalController.duration = Duration(milliseconds: portalMs);
    _portalController.addListener(() {
      setState(() => _portalProgress = _portalController.value);
    });
    _portalController.forward(from: 0).then((_) {
      if (mounted) setState(() => _phase = _IntroPhase.portal);
    });
  }

  @override
  Widget build(BuildContext context) {
    final reduce = ref.watch(appSettingsProvider.select((s) => s.reduceAnimations));
    final mqReduce = MediaQuery.disableAnimationsOf(context);
    final skipMotion = reduce || mqReduce;
    return Scaffold(
      backgroundColor: AppColors.bgDeepest,
      body: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedOpacity(
            opacity: _phase == _IntroPhase.scrolling ? 1.0 : 0.25,
            duration: const Duration(milliseconds: 1600),
            child: const _EvilStarfield(),
          ),
          if (_phase != _IntroPhase.scrolling || _portalProgress > 0)
            _VoidPortal(
              progress: _portalProgress,
              skipMotion: skipMotion,
              settled: _phase == _IntroPhase.portal,
            ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.xl,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Column(
                children: [
                  Opacity(
                    opacity: _textOpacity,
                    child: const _IntroHeader(),
                  ),
                  Expanded(
                    child: Opacity(
                      opacity: _textOpacity,
                      child: _EvilLogScroller(
                        lines: _logLines,
                        durationSeconds: _scrollSeconds,
                        skipMotion: skipMotion,
                        onComplete: _triggerPortal,
                      ),
                    ),
                  ),
                  _IntroFooter(
                    phase: _phase,
                    onClose: widget.onClose,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _IntroHeader extends StatelessWidget {
  const _IntroHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.directions_boat_filled,
                color: AppColors.accentSecondary,
                size: 22,
              ),
              const SizedBox(width: 8),
              Text(
                'VOID SHIP',
                style: AppTypography.mono.copyWith(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 8,
                  color: AppColors.textPrimary,
                  shadows: [
                    Shadow(
                      color: AppColors.accentPrimary.withValues(alpha: 0.5),
                      blurRadius: 6,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'EAST-SHIRE VESSEL INDUSTRIES . LAWLESS . EVIL-01',
            style: AppTypography.mono.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 3,
              color: AppColors.accentSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _IntroFooter extends StatelessWidget {
  const _IntroFooter({required this.phase, required this.onClose});

  final _IntroPhase phase;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Column(
        children: [
          AnimatedOpacity(
            opacity: phase == _IntroPhase.scrolling ? 1 : 0,
            duration: const Duration(milliseconds: 500),
            child: Text(
              "She'll wait. So will the rest of the form.",
              style: AppTypography.mono.copyWith(
                fontSize: 11,
                color: AppColors.textDim,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          GestureDetector(
            onTap: onClose,
            child: Container(
              padding: const EdgeInsets.symmetric(
                vertical: 10,
                horizontal: AppSpacing.lg,
              ),
              decoration: BoxDecoration(
                color: AppColors.accentPrimary,
                borderRadius: BorderRadius.circular(40),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.accentPrimary.withValues(alpha: 0.55),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.cancel,
                    color: AppColors.bgDeepest,
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    phase == _IntroPhase.portal ? 'Step through' : 'Close log',
                    style: AppTypography.mono.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2,
                      color: AppColors.bgDeepest,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EvilLogScroller extends StatefulWidget {
  const _EvilLogScroller({
    required this.lines,
    required this.durationSeconds,
    required this.skipMotion,
    required this.onComplete,
  });

  final List<String> lines;
  final int durationSeconds;
  final bool skipMotion;
  final VoidCallback onComplete;

  @override
  State<_EvilLogScroller> createState() => _EvilLogScrollerState();
}

class _EvilLogScrollerState extends State<_EvilLogScroller>
    with SingleTickerProviderStateMixin {
  Ticker? _ticker;
  DateTime? _startedAt;
  double _progress = 0.0;
  double _contentHeight = 0.0;
  bool _completedFired = false;

  @override
  void initState() {
    super.initState();
    if (widget.skipMotion) {
      _progress = 1.0;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_completedFired) {
          _completedFired = true;
          widget.onComplete();
        }
      });
    } else {
      _ticker = createTicker((elapsed) {
        _startedAt ??= DateTime.now();
        final elapsedSec =
            DateTime.now().difference(_startedAt!).inMilliseconds / 1000.0;
        final p = (elapsedSec / widget.durationSeconds).clamp(0.0, 1.0);
        if (p != _progress) {
          setState(() => _progress = p);
        }
        if (p >= 1.0 && !_completedFired) {
          _completedFired = true;
          widget.onComplete();
        }
      });
      _ticker!.start();
    }
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final viewportHeight = constraints.maxHeight;
        final startOffset = viewportHeight * 0.85;
        final endOffset = -(_contentHeight + 40);
        final dy = widget.skipMotion
            ? endOffset
            : startOffset + (endOffset - startOffset) * _progress;
        return ShaderMask(
          shaderCallback: (rect) {
            return const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.transparent,
                Colors.black,
                Colors.black,
                Colors.black,
                Colors.transparent,
              ],
              stops: [0.0, 0.18, 0.5, 0.82, 1.0],
            ).createShader(rect);
          },
          blendMode: BlendMode.dstIn,
          child: ClipRect(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: 0,
                  right: 0,
                  top: dy,
                  child: _SizeReporter(
                    onSize: (s) {
                      if (s.height != _contentHeight) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) {
                            setState(() => _contentHeight = s.height);
                          }
                        });
                      }
                    },
                    child: _LogContent(lines: widget.lines),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SizeReporter extends StatelessWidget {
  const _SizeReporter({required this.onSize, required this.child});
  final ValueChanged<Size> onSize;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return _OnLayoutSize(
          onSize: onSize,
          child: child,
        );
      },
    );
  }
}

class _OnLayoutSize extends SingleChildRenderObjectWidget {
  const _OnLayoutSize({required this.onSize, required Widget super.child});
  final ValueChanged<Size> onSize;

  @override
  RenderObject createRenderObject(BuildContext context) {
    return _RenderSizeReporter(onSize: onSize);
  }

  @override
  void updateRenderObject(BuildContext context, _RenderSizeReporter renderObject) {
    renderObject.onSize = onSize;
  }
}

class _RenderSizeReporter extends RenderProxyBox {
  _RenderSizeReporter({required this.onSize});
  ValueChanged<Size> onSize;
  Size? _lastSize;

  @override
  void performLayout() {
    super.performLayout();
    if (_lastSize != size) {
      _lastSize = size;
      onSize(size);
    }
  }
}

class _LogContent extends StatelessWidget {
  const _LogContent({required this.lines});
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final line in lines) ...[
            if (line.isEmpty)
              const SizedBox(height: 4)
            else if (line.startsWith('//'))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: Text(
                  line,
                  style: AppTypography.mono.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 1,
                    color: AppColors.accentSecondary.withValues(alpha: 0.75),
                  ),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: Text(
                  line,
                  style: TextStyle(
                    fontSize: 17,
                    height: 1.4,
                    color: AppColors.textPrimary,
                    fontFamily: 'serif',
                    fontFamilyFallback: const [
                      'AmericanTypewriter',
                      'serif',
                    ],
                    decoration: TextDecoration.none,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _EvilStarfield extends StatefulWidget {
  const _EvilStarfield();

  @override
  State<_EvilStarfield> createState() => _EvilStarfieldState();
}

class _EvilStarfieldState extends State<_EvilStarfield>
    with SingleTickerProviderStateMixin {
  late final List<_Star> _stars;
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(42);
    _stars = List.generate(
      70,
      (_) => _Star(
        x: rng.nextDouble(),
        y: rng.nextDouble(),
        size: 0.8 + rng.nextDouble() * (2.4 - 0.8),
        opacity: 0.25 + rng.nextDouble() * (0.85 - 0.25),
      ),
    );
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 60),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return CustomPaint(
          painter: _StarfieldPainter(
            stars: _stars,
            phase: _controller.value,
          ),
          size: Size.infinite,
        );
      },
    );
  }
}

class _Star {
  const _Star({
    required this.x,
    required this.y,
    required this.size,
    required this.opacity,
  });
  final double x;
  final double y;
  final double size;
  final double opacity;
}

class _StarfieldPainter extends CustomPainter {
  _StarfieldPainter({required this.stars, required this.phase});
  final List<_Star> stars;
  final double phase;

  @override
  void paint(Canvas canvas, Size size) {
    for (final s in stars) {
      final paint = Paint()
        ..color = AppColors.accentSecondary.withValues(alpha: s.opacity);
      final rawY = s.y * size.height + phase * 30;
      final y = rawY % size.height;
      canvas.drawCircle(Offset(s.x * size.width, y), s.size, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _StarfieldPainter oldDelegate) {
    return oldDelegate.phase != phase;
  }
}

class _VoidPortal extends StatefulWidget {
  const _VoidPortal({
    required this.progress,
    required this.skipMotion,
    required this.settled,
  });

  final double progress;
  final bool skipMotion;

  /// True once the portal open animation has fully completed. When settled the
  /// wobble ticker is stopped so we no longer recompute + blur the blob layers
  /// every frame for a portal that is just sitting behind the "Step through" CTA.
  final bool settled;

  @override
  State<_VoidPortal> createState() => _VoidPortalState();
}

class _VoidPortalState extends State<_VoidPortal>
    with SingleTickerProviderStateMixin {
  Ticker? _ticker;
  double _t = 0.0;

  @override
  void initState() {
    super.initState();
    if (!widget.skipMotion && !widget.settled) {
      _ticker = createTicker((elapsed) {
        setState(() {
          _t = elapsed.inMicroseconds / 1e6;
        });
      });
      _ticker!.start();
    }
  }

  @override
  void didUpdateWidget(_VoidPortal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.settled && !oldWidget.settled) {
      // Freeze the swirl once the portal has finished opening.
      _ticker?.stop();
    }
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxR = math.max(constraints.maxWidth, constraints.maxHeight) * 1.15;
        final r = math.max(0.001, widget.progress) * maxR;
        return Stack(
          alignment: Alignment.center,
          children: [
            // Far halo — the two largest, most-blurred halos are rendered as
            // plain radial gradients instead of live ImageFiltered blob blurs
            // (a huge gaussian blur over a 180-segment path every frame is the
            // most expensive layer, and at this softness the wobble is invisible).
            _RadialHaloLayer(
              size: r * 2.6,
              color: AppColors.accentPrimary.withValues(alpha: 0.35),
            ),
            // Outer corona
            _RadialHaloLayer(
              size: r * 1.9,
              color: AppColors.accentPrimary.withValues(alpha: 0.65),
            ),
            // Aqua halo
            _BlurredBlobLayer(
              size: r * 1.55,
              rotation: _t * 9 * math.pi / 180,
              color: AppColors.accentSecondary.withValues(alpha: 0.45),
              blurSigma: 24,
              time: _t * 0.42,
              seed: 9.3,
              lobes: 5,
              amplitude: 0.27,
              fillStyle: PaintingStyle.fill,
            ),
            // Dark mantle
            _BlurredBlobLayer(
              size: r * 1.18,
              rotation: -_t * 11 * math.pi / 180,
              color: const Color(0xFF050810).withValues(alpha: 0.9),
              blurSigma: 18,
              time: _t * 0.55,
              seed: 13.1,
              lobes: 6,
              amplitude: 0.18,
              fillStyle: PaintingStyle.fill,
            ),
            // Void core
            _BlurredBlobLayer(
              size: r * 0.9,
              rotation: _t * 14 * math.pi / 180,
              color: Colors.black,
              blurSigma: 8,
              time: _t * 0.78,
              seed: 21.7,
              lobes: 7,
              amplitude: 0.14,
              fillStyle: PaintingStyle.fill,
            ),
            // Inner glints
            _BlurredBlobLayer(
              size: r * 0.7,
              rotation: -_t * 17 * math.pi / 180,
              color: AppColors.accentSecondary.withValues(alpha: 0.6),
              blurSigma: 6,
              time: _t * 1.05,
              seed: 33.5,
              lobes: 9,
              amplitude: 0.30,
              fillStyle: PaintingStyle.stroke,
              strokeWidth: 1.2,
            ),
          ],
        );
      },
    );
  }
}

/// A soft circular halo drawn as a radial gradient. Much cheaper than an
/// [ImageFiltered] gaussian blur of a wobbling path, used for the outermost
/// portal halos where fine shape detail is not perceptible anyway.
class _RadialHaloLayer extends StatelessWidget {
  const _RadialHaloLayer({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color, color.withValues(alpha: 0)],
          ),
        ),
      ),
    );
  }
}

class _BlurredBlobLayer extends StatelessWidget {
  const _BlurredBlobLayer({
    required this.size,
    required this.rotation,
    required this.color,
    required this.blurSigma,
    required this.time,
    required this.seed,
    required this.lobes,
    required this.amplitude,
    required this.fillStyle,
    this.strokeWidth = 1.0,
  });

  final double size;
  final double rotation;
  final Color color;
  final double blurSigma;
  final double time;
  final double seed;
  final int lobes;
  final double amplitude;
  final PaintingStyle fillStyle;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: rotation,
      child: ImageFiltered(
        imageFilter: ui.ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
        child: SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
            painter: _VoidBlobPainter(
              color: color,
              time: time,
              seed: seed,
              lobes: lobes,
              amplitude: amplitude,
              style: fillStyle,
              strokeWidth: strokeWidth,
            ),
          ),
        ),
      ),
    );
  }
}

class _VoidBlobPainter extends CustomPainter {
  _VoidBlobPainter({
    required this.color,
    required this.time,
    required this.seed,
    required this.lobes,
    required this.amplitude,
    required this.style,
    required this.strokeWidth,
  });

  final Color color;
  final double time;
  final double seed;
  final int lobes;
  final double amplitude;
  final PaintingStyle style;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path();
    final cx = size.width / 2;
    final cy = size.height / 2;
    final baseR = math.min(size.width, size.height) / 2;
    const segments = 180;

    for (var i = 0; i <= segments; i++) {
      final theta = i / segments * math.pi * 2;
      final primary =
          math.sin(theta * lobes + time + seed);
      final medium = math.sin(
        theta * (lobes + 2) * 0.7 + time * 1.8 + seed * 1.7,
      );
      final chatter = math.sin(
        theta * (lobes + 5) * 1.2 + time * 0.5 + seed * 0.3,
      );
      final wobble = primary * 0.55 + medium * 0.30 + chatter * 0.15;
      final r = baseR * (1.0 + wobble * amplitude);
      final x = cx + r * math.cos(theta);
      final y = cy + r * math.sin(theta);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();

    final paint = Paint()
      ..color = color
      ..style = style
      ..strokeWidth = strokeWidth;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _VoidBlobPainter oldDelegate) {
    return oldDelegate.time != time ||
        oldDelegate.color != color ||
        oldDelegate.amplitude != amplitude;
  }
}

/// Persistence of "user has seen the EVIL ship intro at least once".
class EvilIntroState {
  EvilIntroState._();
  static const _key = 'hangar.evilIntroSeen';

  static bool isSeen(WidgetRef ref) {
    final prefs = ref.read(sharedPreferencesProvider);
    return prefs.getBool(_key) ?? false;
  }

  static Future<void> markSeen(WidgetRef ref) async {
    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.setBool(_key, true);
  }
}

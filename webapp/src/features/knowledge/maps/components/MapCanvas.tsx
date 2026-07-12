/**
 * The interactive map canvas (maps spec §13-15). One `<canvas>` driven by
 * `requestAnimationFrame`, dispatching to the pure render engine by map type:
 *
 *  - `flat`  - pan/zoom/drag + wheel + pinch over a constrained-decode background
 *              image, with `ZoneHitIndex` polygon/marker hit-testing (§13);
 *  - `globe` - quaternion drag-rotate + zoom + optional reduce-motion-gated
 *              autorotation, `SphereHitIndex` (non-grid) or analytic `gridPick`
 *              picking via `drawGlobe` (§14);
 *  - `grid`  - pan/zoom table twin via `drawGridTable` + `gridHitTest` (§15).
 *
 * The viewport transform lives in refs so gestures repaint without React
 * re-renders. Selection/dimming are props; a tap calls `onSelect`.
 */

import { useEffect, useMemo, useRef } from 'react';
import { logError } from '../../../../core/logging';
import { Haptics } from '../../../../core/haptics';
import { useReducedMotion } from '../../../../design-system/reducedMotion';
import type { CanvasPoint, MapDocument } from '../model/types';
import { colorCss } from '../model/theme';
import {
  dragBy,
  autoRotate,
  orientationFromLatLon,
} from '../model/orientation';
import { IDENTITY_QUAT, type Quat } from '../model/quaternion';
import { globeCenter, globeRadius, unproject } from '../model/projection';
import {
  backgroundDecodeWidth,
  buildFlatMapRender,
  rectCenter,
  ZoneHitIndex,
  type FlatRender,
  type Rect,
} from '../render/flatRender';
import {
  buildSphereRender,
  drawGlobe,
  gridPick,
  SphereHitIndex,
  zoneGeoAnchor,
} from '../render/sphereRender';
import {
  buildGridRender,
  drawGridTable,
  gridHitTest,
  type GridRender,
} from '../render/gridRender';
import { drawCenteredLabel } from '../render/labels';
import { paintMarkerZone, paintPolygonZone, zoneStrokeWidth } from '../render/paintOps';
import styles from './MapCanvas.module.css';

export type MapCanvasMode = 'flat' | 'globe' | 'grid';

interface MapCanvasProps {
  readonly doc: MapDocument;
  readonly mode: MapCanvasMode;
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly dimmed: ReadonlySet<string>;
  /** When a filter is active, the dimmed zones are hidden rather than faded. */
  readonly hideDimmed: boolean;
  /** Zone to frame/select on mount and whenever `focusNonce` changes. */
  readonly focusZoneId: string | null;
  readonly focusNonce: number;
  /** Raw `background` asset bytes; decoded here at a constrained width (§13.6). */
  readonly backgroundBlob: Blob | null;
}

interface ViewTransform {
  tx: number;
  ty: number;
  scale: number;
}

const TAP_MOVE_THRESHOLD = 6; // css px - below this a pointer-up is a tap
const GLOBE_MIN_ZOOM = 0.6;
const GLOBE_MAX_ZOOM = 4.0;
const GLOBE_FOCUS_ZOOM = 1.9; // zoom level when framing a single zone on the globe

function ringsPath(rings: readonly (readonly CanvasPoint[])[]): Path2D {
  const p = new Path2D();
  for (const ring of rings) {
    ring.forEach((pt, i) => (i === 0 ? p.moveTo(pt.x, pt.y) : p.lineTo(pt.x, pt.y)));
    p.closePath();
  }
  return p;
}

function rectPath(r: { x: number; y: number; w: number; h: number }): Path2D {
  const p = new Path2D();
  p.rect(r.x, r.y, r.w, r.h);
  return p;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function MapCanvas({
  doc,
  mode,
  selectedId,
  onSelect,
  dimmed,
  hideDimmed,
  focusZoneId,
  focusNonce,
  backgroundBlob,
}: MapCanvasProps) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Render models (rebuilt only when the doc or mode changes) -------------
  const flat = useMemo(() => {
    if (mode !== 'flat') return null;
    const render = buildFlatMapRender(doc);
    return { render, hit: new ZoneHitIndex(render) };
  }, [doc, mode]);
  const sphere = useMemo(() => {
    if (mode !== 'globe') return null;
    const render = buildSphereRender(doc);
    return { render, hit: new SphereHitIndex(doc) };
  }, [doc, mode]);
  const grid = useMemo<GridRender | null>(
    () => (mode === 'grid' ? buildGridRender(doc) : null),
    [doc, mode],
  );

  // --- Mutable render state (kept out of React so gestures never re-render) --
  const viewRef = useRef<ViewTransform>({ tx: 0, ty: 0, scale: 1 });
  const globeRef = useRef<{ q: Quat; zoom: number }>({ q: IDENTITY_QUAT, zoom: 1 });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const initializedRef = useRef(false);

  // Latest props for the imperative loop (avoids stale closures in listeners).
  const stateRef = useRef({ mode, selectedId, dimmed, hideDimmed, reducedMotion, doc });
  stateRef.current = { mode, selectedId, dimmed, hideDimmed, reducedMotion, doc };
  const rendersRef = useRef({ flat, sphere, grid });
  rendersRef.current = { flat, sphere, grid };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const bgBlobRef = useRef<Blob | null>(backgroundBlob);
  bgBlobRef.current = backgroundBlob;

  // --- Background decode (monotonic, single-in-flight) -----------------------
  const bgRef = useRef<{ bitmap: ImageBitmap | null; width: number; decoding: boolean }>({
    bitmap: null,
    width: 0,
    decoding: false,
  });

  // --- Animation bookkeeping --------------------------------------------------
  const rafRef = useRef<number | null>(null);
  const dirtyRef = useRef(true);
  const lastTsRef = useRef<number | null>(null);
  const interactingRef = useRef(false);

  const markDirty = (): void => {
    // Paint the current state immediately so the map never depends on
    // requestAnimationFrame for a frame it needs *now* - browsers pause rAF in
    // hidden/backgrounded tabs and throttle it on restore, which would
    // otherwise leave the canvas blank. The rAF loop (scheduleFrame) is used
    // only to drive the optional decorative globe auto-rotation.
    dirtyRef.current = false;
    draw();
    if (wantsAnimation()) scheduleFrame();
  };

  const canvasSize = (): { w: number; h: number } => {
    const r = rendersRef.current;
    if (r.grid !== null) return { w: r.grid.canvasWidth, h: r.grid.canvasHeight };
    const c = stateRef.current.doc.canvas ?? { width: 1024, height: 1024 };
    return { w: c.width, h: c.height };
  };

  const fitScale = (): number => {
    const { w, h } = sizeRef.current;
    const cs = canvasSize();
    if (cs.w <= 0 || cs.h <= 0) return 1;
    return Math.min(w / cs.w, h / cs.h);
  };

  const setInitialTransform = (): void => {
    if (stateRef.current.mode === 'globe') {
      const s = stateRef.current.doc.sphere;
      const anchor = focusZoneId !== null ? zoneGeoAnchor(stateRef.current.doc, focusZoneId) : null;
      const q =
        anchor !== null
          ? orientationFromLatLon(anchor)
          : s !== null
            ? orientationFromLatLon({ lon: s.initialOrientation.lon, lat: s.initialOrientation.lat })
            : IDENTITY_QUAT;
      globeRef.current = { q, zoom: 1 };
      return;
    }
    if (focusZoneId !== null && frameZone(focusZoneId)) return;
    const fit = fitScale();
    const cs = canvasSize();
    const { w, h } = sizeRef.current;
    viewRef.current = { scale: fit, tx: (w - cs.w * fit) / 2, ty: (h - cs.h * fit) / 2 };
  };

  /** Frame `zoneId` in the viewport; returns false if it has no drawable bounds. */
  const frameZone = (zoneId: string): boolean => {
    const { w, h } = sizeRef.current;
    const fit = fitScale();
    const maxScale = Math.max(8, fit);
    const r = rendersRef.current;
    if (r.grid !== null) {
      const cell = r.grid.cells.find((c) => c.zoneId === zoneId);
      if (cell === undefined) return false;
      const scale = clamp(Math.max(r.grid.nameLodScale * 1.1, fit), fit, maxScale);
      const cx = cell.rect.x + cell.rect.w / 2;
      const cy = cell.rect.y + cell.rect.h / 2;
      viewRef.current = { scale, tx: w / 2 - cx * scale, ty: h / 2 - cy * scale };
      return true;
    }
    if (r.flat !== null) {
      const item = r.flat.render.items.find((it) => it.zoneId === zoneId);
      if (item === undefined || item.kind === 'none') return false;
      const b: Rect = item.bounds;
      if (b.w <= 0 || b.h <= 0) return false;
      const target = Math.min(w / (b.w / 0.55), h / (b.h / 0.55));
      const scale = clamp(target, fit, maxScale);
      const c = rectCenter(b);
      viewRef.current = { scale, tx: w / 2 - c.x * scale, ty: h / 2 - c.y * scale };
      return true;
    }
    return false;
  };

  // --- Drawing ----------------------------------------------------------------
  const requestBackground = (targetWidth: number): void => {
    const bg = bgRef.current;
    const blob = bgBlobRef.current;
    if (blob === null || bg.decoding) return;
    if (bg.bitmap !== null && bg.width >= targetWidth) return;
    bg.decoding = true;
    void createImageBitmap(blob, { resizeWidth: targetWidth, resizeQuality: 'medium' })
      .then((bmp) => {
        bg.bitmap?.close();
        bg.bitmap = bmp;
        bg.width = targetWidth;
        bg.decoding = false;
        markDirty();
      })
      .catch((err: unknown) => {
        bg.decoding = false;
        logError(err); // decode failure → flat theme fill remains (§13.6)
      });
  };

  const draw = (): void => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const { w, h, dpr } = sizeRef.current;
    if (w <= 0 || h <= 0) return;
    const { mode: m, selectedId: sel, dimmed: dim } = stateRef.current;
    const r = rendersRef.current;

    // Full-device clear.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (m === 'globe' && r.sphere !== null) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGlobe(ctx, {
        render: r.sphere.render,
        width: w,
        height: h,
        orientation: globeRef.current.q,
        zoom: globeRef.current.zoom,
        selectedId: sel,
        dimmed: dim,
        hideDimmed: stateRef.current.hideDimmed,
      });
      return;
    }

    const { tx, ty, scale } = viewRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    if (m === 'grid' && r.grid !== null) {
      drawGridTable(ctx, r.grid, { scale, dimmed: dim });
      if (sel !== null) {
        const cell = r.grid.cells.find((c) => c.zoneId === sel);
        if (cell !== undefined) paintPolygonZone(ctx, rectPath(cell.rect), cell.theme, 2.5, true);
      }
      return;
    }

    if (m === 'flat' && r.flat !== null) {
      drawFlat(ctx, r.flat.render, scale, sel, dim);
    }
  };

  const drawFlat = (
    ctx: CanvasRenderingContext2D,
    render: FlatRender,
    scale: number,
    sel: string | null,
    dim: ReadonlySet<string>,
  ): void => {
    const cw = render.canvasSize.width;
    const ch = render.canvasSize.height;
    // Background (flat fill under the image covers the pre-decode gap).
    ctx.fillStyle = colorCss(render.theme.background);
    ctx.fillRect(0, 0, cw, ch);
    const bmp = bgRef.current.bitmap;
    if (bmp !== null) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(bmp, 0, 0, cw, ch);
    }

    const strokeW = zoneStrokeWidth(Math.min(cw, ch));
    const labelsVisible = scale >= render.labelLodScale;

    for (const item of render.items) {
      if (item.kind === 'none' || item.zoneId === sel) continue;
      const isDim = dim.has(item.zoneId);
      if (isDim) ctx.globalAlpha = 0.3;
      if (item.kind === 'marker' && item.markerCenter !== null) {
        paintMarkerZone(ctx, item.markerCenter, render.markerRadius, item.theme, false);
      } else if (item.kind === 'polygon') {
        paintPolygonZone(ctx, ringsPath(item.rings), item.theme, strokeW, false);
      }
      if (isDim) ctx.globalAlpha = 1;
    }

    if (sel !== null) {
      const item = render.items.find((it) => it.zoneId === sel);
      if (item !== undefined) {
        if (item.kind === 'marker' && item.markerCenter !== null) {
          paintMarkerZone(ctx, item.markerCenter, render.markerRadius, item.theme, true);
        } else if (item.kind === 'polygon') {
          paintPolygonZone(ctx, ringsPath(item.rings), item.theme, strokeW, true);
        }
      }
    }

    if (labelsVisible) {
      for (const item of render.items) {
        if (item.label === null) continue;
        const isDim = dim.has(item.zoneId) && item.zoneId !== sel;
        if (isDim) ctx.globalAlpha = 0.3;
        drawCenteredLabel(
          ctx,
          item.label.text,
          item.label.anchor.x,
          item.label.anchor.y,
          item.theme,
          render.fontSize,
        );
        if (isDim) ctx.globalAlpha = 1;
      }
    }
  };

  // --- rAF loop (continuous only while the globe is auto-rotating) -----------
  /** True only when the decorative globe spin should drive a continuous loop. */
  const wantsAnimation = (): boolean => {
    const s = stateRef.current;
    const autoDeg = s.doc.sphere?.autoRotateDegPerSec ?? 0;
    return (
      s.mode === 'globe' &&
      rendersRef.current.sphere !== null &&
      autoDeg > 0 &&
      !s.reducedMotion &&
      !interactingRef.current
    );
  };

  const scheduleFrame = (): void => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(tick);
  };

  const tick = (ts: number): void => {
    rafRef.current = null;
    const s = stateRef.current;
    const autoDeg = s.doc.sphere?.autoRotateDegPerSec ?? 0;
    const animating = wantsAnimation();

    if (animating) {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.1, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      globeRef.current = { ...globeRef.current, q: autoRotate(globeRef.current.q, autoDeg * dt) };
      dirtyRef.current = true;
    } else {
      lastTsRef.current = null;
    }

    if (s.mode === 'flat') {
      requestBackground(backgroundDecodeWidth(canvasSize().w, viewRef.current.scale));
    }

    if (dirtyRef.current) {
      dirtyRef.current = false;
      draw();
    }
    if (animating) scheduleFrame(); // keep looping only for the decorative spin
  };

  // --- Pointer / wheel gestures ----------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef({
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    pinched: false,
    pinchDist: 0,
    pinchScale: 1,
    pinchZoom: 1,
  });

  const localPoint = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (canvas === null) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const applyPan = (dx: number, dy: number): void => {
    if (stateRef.current.mode === 'globe') {
      const { w, h } = sizeRef.current;
      const radius = globeRadius(w, h, globeRef.current.zoom);
      globeRef.current = { ...globeRef.current, q: dragBy(globeRef.current.q, dx, dy, radius) };
    } else {
      const v = viewRef.current;
      viewRef.current = { ...v, tx: v.tx + dx, ty: v.ty + dy };
    }
    markDirty();
  };

  const zoomAt = (factor: number, cx: number, cy: number): void => {
    if (stateRef.current.mode === 'globe') {
      globeRef.current = {
        ...globeRef.current,
        zoom: clamp(globeRef.current.zoom * factor, GLOBE_MIN_ZOOM, GLOBE_MAX_ZOOM),
      };
      markDirty();
      return;
    }
    const v = viewRef.current;
    const fit = fitScale();
    const maxScale = Math.max(8, fit);
    const newScale = clamp(v.scale * factor, fit, maxScale);
    // Keep the document point under (cx, cy) fixed while scaling.
    const docX = (cx - v.tx) / v.scale;
    const docY = (cy - v.ty) / v.scale;
    viewRef.current = { scale: newScale, tx: cx - docX * newScale, ty: cy - docY * newScale };
    markDirty();
  };

  const hitTestAt = (cx: number, cy: number): string | null => {
    const r = rendersRef.current;
    if (stateRef.current.mode === 'globe' && r.sphere !== null) {
      const { w, h } = sizeRef.current;
      const geo = unproject(
        { x: cx, y: cy },
        globeRef.current.q,
        globeRadius(w, h, globeRef.current.zoom),
        globeCenter(w, h),
      );
      if (stateRef.current.doc.grid !== null) return gridPick(r.sphere.render, geo);
      return r.sphere.hit.hitTest(geo);
    }
    const v = viewRef.current;
    const docX = (cx - v.tx) / v.scale;
    const docY = (cy - v.ty) / v.scale;
    if (stateRef.current.mode === 'grid' && r.grid !== null) {
      return gridHitTest(r.grid, { x: docX, y: docY });
    }
    if (stateRef.current.mode === 'flat' && r.flat !== null) {
      return r.flat.hit.hitTest({ x: docX, y: docY }, v.scale);
    }
    return null;
  };

  // Bind imperative listeners once; they read the refs above.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas === null || container === null) return;

    const resize = (): void => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (!initializedRef.current) {
        setInitialTransform();
        initializedRef.current = true;
      } else if (stateRef.current.mode !== 'globe') {
        // Keep the scale valid against the new fit bounds.
        const v = viewRef.current;
        const fit = fitScale();
        viewRef.current = { ...v, scale: clamp(v.scale, fit, Math.max(8, fit)) };
      }
      markDirty();
    };

    const onPointerDown = (e: PointerEvent): void => {
      canvas.setPointerCapture(e.pointerId);
      const p = localPoint(e);
      pointers.current.set(e.pointerId, p);
      const g = gestureRef.current;
      if (pointers.current.size === 1) {
        g.downX = p.x;
        g.downY = p.y;
        g.lastX = p.x;
        g.lastY = p.y;
        g.moved = false;
        g.pinched = false;
        interactingRef.current = true;
      } else if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        g.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        g.pinchScale = viewRef.current.scale;
        g.pinchZoom = globeRef.current.zoom;
        g.pinched = true;
        g.moved = true;
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = localPoint(e);
      pointers.current.set(e.pointerId, p);
      const g = gestureRef.current;
      if (pointers.current.size >= 2) {
        const pts = [...pointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const factor = dist / g.pinchDist;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        if (stateRef.current.mode === 'globe') {
          globeRef.current = {
            ...globeRef.current,
            zoom: clamp(g.pinchZoom * factor, GLOBE_MIN_ZOOM, GLOBE_MAX_ZOOM),
          };
          markDirty();
        } else {
          const fit = fitScale();
          const newScale = clamp(g.pinchScale * factor, fit, Math.max(8, fit));
          const v = viewRef.current;
          const docX = (midX - v.tx) / v.scale;
          const docY = (midY - v.ty) / v.scale;
          viewRef.current = { scale: newScale, tx: midX - docX * newScale, ty: midY - docY * newScale };
          markDirty();
        }
        return;
      }
      const dx = p.x - g.lastX;
      const dy = p.y - g.lastY;
      g.lastX = p.x;
      g.lastY = p.y;
      if (Math.hypot(p.x - g.downX, p.y - g.downY) > TAP_MOVE_THRESHOLD) g.moved = true;
      applyPan(dx, dy);
    };

    const endPointer = (e: PointerEvent): void => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = localPoint(e);
      pointers.current.delete(e.pointerId);
      const g = gestureRef.current;
      if (pointers.current.size === 0) {
        interactingRef.current = false;
        lastTsRef.current = null;
        if (!g.moved && !g.pinched) {
          const id = hitTestAt(p.x, p.y);
          if (id !== null) Haptics.selection();
          onSelectRef.current(id);
        }
        if (rendersRef.current.sphere !== null) scheduleFrame(); // resume autorotation
      }
    };

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const p = localPoint(e);
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAt(factor, p.x, p.y);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('wheel', onWheel);
    };
    // Intentionally bound once - all live data flows through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-init transform whenever the mode changes (globe⇄grid, or new doc).
  useEffect(() => {
    initializedRef.current = false;
    bgRef.current.bitmap?.close();
    bgRef.current = { bitmap: null, width: 0, decoding: false };
    if (sizeRef.current.w > 0) {
      setInitialTransform();
      initializedRef.current = true;
    }
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, doc]);

  // Repaint when selection / dimming change.
  useEffect(() => {
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, dimmed]);

  // Reset the background decode when the source blob changes.
  useEffect(() => {
    bgRef.current.bitmap?.close();
    bgRef.current = { bitmap: null, width: 0, decoding: false };
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundBlob]);

  // Frame + (re-)focus a zone on demand (deep link, in-map search pick, filter
  // selection). A null focusZoneId means "reset the view" (e.g. filter cleared).
  useEffect(() => {
    if (sizeRef.current.w === 0) return;
    if (focusZoneId === null) {
      setInitialTransform(); // globe → initial orientation + zoom 1; flat/grid → fit
      markDirty();
      return;
    }
    if (stateRef.current.mode === 'globe') {
      const anchor = zoneGeoAnchor(stateRef.current.doc, focusZoneId);
      if (anchor !== null) {
        // Rotate the zone to front-centre AND zoom in on it.
        globeRef.current = { q: orientationFromLatLon(anchor), zoom: GLOBE_FOCUS_ZOOM };
      }
    } else {
      frameZone(focusZoneId);
    }
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // Kick a frame when reduce-motion flips (starts/stops the spin loop).
  useEffect(() => {
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // Cleanup the last bitmap + pending frame on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      bgRef.current.bitmap?.close();
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}

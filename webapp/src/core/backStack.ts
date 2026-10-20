/**
 * The app-wide stack of things "Back" closes - modal overlays (sheets,
 * dialogs, full-screen details) and unsaved-changes guards - kept in step with
 * the browser history, so the Android back gesture / browser Back closes the
 * top-most one instead of leaving the screen (app-shell spec §3.3).
 *
 * Every open layer owns one same-URL history entry above the page's own entry:
 * a copy of the router's state plus an `essiLayer` marker, so the router sees
 * no navigation.
 * - Back pops the top entry and runs its layer's `onBack`: an overlay closes;
 *   a guard (`keep`) gets its entry back and asks "Discard changes?".
 * - Closing from the UI (button, Escape, scrim, drag) leaves a dead entry,
 *   popped right after the commit - or reused when another layer opens in the
 *   same commit (history row → detail) - so Back never lands on a do-nothing
 *   entry. Escape (the keyboard's Back) closes the top-most overlay only.
 * - These pops are ours, not the user's: the popstate listener runs before the
 *   router's (capture, installed first) and stops the event.
 * - The router writing history while entries are up: a `replace` (a filter
 *   change, a stripped `?zone=`) becomes the route our entries carry and is
 *   copied down to the page's entry when they pop; a `push` (a link out of a
 *   sheet) takes the overlays' place instead of stacking on them, so Back from
 *   the new screen returns straight to the page.
 */

type HistoryState = Record<string, unknown> | null;

interface Marker {
  doc: string;
  id: number;
}

interface Layer {
  /** Stacking order: higher is on top (opened later, or opened inside another). */
  order: number;
  /** A guard: Back runs `onBack` and its entry is pushed again (it stays). */
  keep: boolean;
  /** Escape runs `onBack` while this is the top-most such layer. */
  escape: boolean;
  onBack: () => void;
  /** Its history entry, once pushed. */
  entry: number | null;
  /** Its entry is gone for good (Back consumed it, or the screen was left). */
  spent: boolean;
}

interface Entry {
  id: number;
  /** null: a dead entry, its layer was closed from the UI. */
  layer: Layer | null;
}

interface Route {
  state: HistoryState;
  url: string;
}

interface Traversal {
  /** 'top': land on our top entry (or the page's); 'route': land on a dead entry that becomes the route. */
  land: 'top' | 'route';
  /** The app pushed a route meanwhile: wherever this lands, it's the router's business. */
  abandoned: boolean;
  timer: ReturnType<typeof setTimeout>;
}

/** A traversal whose popstate never comes (cancelled by the browser) is given up after this. */
const TRAVERSAL_TIMEOUT_MS = 1000;

/** Tells this page's entries apart from a previous page load's (a reload with an overlay up). */
const DOC = Math.random().toString(36).slice(2);

let installed = false;
let nextOrder = 1;
let nextEntryId = 1;
const layers = new Set<Layer>();
/** Our entries above the page's entry, bottom → top, as the browser holds them. */
let entries: Entry[] = [];
/** The route our entries carry: the page's at the first push, then the router's latest replace. */
let route: Route | null = null;
/** The router replaced the route while entries were up: lower entries still hold the old one. */
let routeChanged = false;
/** Router key + index of the page's entry under ours. */
let base: { key: unknown; idx: unknown } | null = null;
let traversal: Traversal | null = null;
let syncQueued = false;

const nativePush = (state: unknown, url?: string | URL | null) =>
  History.prototype.pushState.call(window.history, state, '', url);
const nativeReplace = (state: unknown, url?: string | URL | null) =>
  History.prototype.replaceState.call(window.history, state, '', url);

function markerOf(state: unknown): Marker | null {
  const m = (state as { essiLayer?: Marker } | null)?.essiLayer;
  return m !== undefined && m !== null && m.doc === DOC ? m : null;
}

function withoutMarker(state: unknown): HistoryState {
  if (state === null || typeof state !== 'object') return null;
  const copy = { ...(state as Record<string, unknown>) };
  delete copy.essiLayer;
  return copy;
}

function withMarker(state: HistoryState, id: number): Record<string, unknown> {
  return { ...(state ?? {}), essiLayer: { doc: DOC, id } satisfies Marker };
}

function absoluteUrl(url: string | URL | null | undefined): string {
  return url === undefined || url === null ? window.location.href : new URL(url, window.location.href).href;
}

function isBase(state: unknown): boolean {
  const s = state as { key?: unknown; idx?: unknown } | null;
  return base !== null && markerOf(state) === null && s?.key === base.key && s?.idx === base.idx;
}

// --- Keeping the browser in step ---------------------------------------------

/** Live layers that should hold an entry, bottom → top. */
function wanted(): Layer[] {
  return [...layers].filter((l) => !l.spent).sort((a, b) => a.order - b.order);
}

function queueSync(): void {
  if (syncQueued) return;
  syncQueued = true;
  // After the commit: a layer closed and another opened in the same commit
  // share one entry, and StrictMode's mount/unmount/mount settles first.
  queueMicrotask(sync);
}

/** Makes our entries match the open layers: pops what's stale, pushes what's missing. */
function sync(): void {
  syncQueued = false;
  if (traversal !== null) return; // resumes once it lands
  const want = wanted();
  let same = 0;
  while (same < entries.length && same < want.length && entries[same]!.layer === want[same]) same++;
  const stale = entries.length - same;
  let missing = want.slice(same);
  if (stale > 1 || (stale === 1 && missing.length === 0)) {
    for (const e of entries.slice(same)) if (e.layer !== null) e.layer.entry = null;
    entries = entries.slice(0, same);
    traverse(-stale, 'top'); // pushes resume when it lands
    return;
  }
  if (stale === 1) {
    // One stale entry on top and a layer to place: reuse it (no async pop).
    const top = entries[same]!;
    if (top.layer !== null) top.layer.entry = null;
    entries = entries.slice(0, same);
    place(missing[0]!, nativeReplace);
    missing = missing.slice(1);
  }
  for (const layer of missing) place(layer, nativePush);
}

function place(layer: Layer, write: (state: unknown, url?: string | null) => void): void {
  if (entries.length === 0 && route === null) {
    route = { state: withoutMarker(window.history.state), url: window.location.href };
    routeChanged = false;
    const s = window.history.state as { key?: unknown; idx?: unknown } | null;
    base = { key: s?.key, idx: s?.idx };
  }
  const id = nextEntryId++;
  try {
    write(withMarker(route!.state, id), route!.url);
  } catch {
    layer.spent = true; // history API throttled: this layer just won't close on Back
    return;
  }
  layer.entry = id;
  entries.push({ id, layer });
}

function traverse(delta: number, land: Traversal['land']): void {
  const timer = setTimeout(() => {
    traversal = null;
    sync();
  }, TRAVERSAL_TIMEOUT_MS);
  traversal = { land, abandoned: false, timer };
  window.history.go(delta);
}

/** The page's entry (or our top one) takes the router's latest route, if it moved meanwhile. */
function fixUp(): void {
  if (route === null) return;
  const top = entries.at(-1);
  if (routeChanged) nativeReplace(top === undefined ? route.state : withMarker(route.state, top.id), route.url);
  if (top === undefined) forgetRoute();
}

function forgetRoute(): void {
  route = null;
  routeChanged = false;
  base = null;
}

/** The screen is being left: every layer loses its entry. */
function spendAll(): void {
  for (const layer of layers) {
    layer.spent = true;
    layer.entry = null;
  }
  entries = [];
}

// --- Events --------------------------------------------------------------------

/** Back went past the page's entry (history menu, another route): the screen is left. */
function leaveScreen(): void {
  const overlays = [...layers].filter((l) => !l.keep);
  spendAll();
  forgetRoute();
  for (const layer of overlays) layer.onBack();
}

function onPopState(e: PopStateEvent): void {
  const ours = traversal;
  const state: unknown = window.history.state;
  const m = markerOf(state);
  if (ours !== null) {
    clearTimeout(ours.timer);
    traversal = null;
    if (ours.abandoned) {
      sync();
      return;
    }
    if (ours.land === 'route' && route !== null) {
      e.stopImmediatePropagation();
      nativeReplace(route.state, route.url); // the dead entry becomes the new screen's
      entries = [];
      forgetRoute();
    } else if (m !== null && !entries.some((en) => en.id === m.id)) {
      e.stopImmediatePropagation();
      traverse(-1, 'top'); // a dead entry (Forward, or a lost race): keep going back
      return;
    } else if (m === null && (entries.length > 0 || !isBase(state))) {
      leaveScreen(); // not where we were heading (the user pressed Back meanwhile)
    } else {
      e.stopImmediatePropagation();
      fixUp();
    }
    sync();
    return;
  }

  if (entries.length === 0) return; // nothing of ours is up: the router's navigation

  const at = m === null ? -1 : entries.findIndex((en) => en.id === m.id);
  if (m !== null && at === -1) {
    // Forward onto an overlay that has since closed: step back to where we were.
    e.stopImmediatePropagation();
    traverse(-1, 'top');
    return;
  }
  if (m === null && !isBase(state)) {
    leaveScreen();
    return;
  }

  // Back popped our top entry (or more): same screen, so the router never hears of it.
  e.stopImmediatePropagation();
  const popped = entries.slice(at + 1).reverse();
  entries = entries.slice(0, at + 1);
  fixUp();
  for (const { layer } of popped) {
    if (layer === null || !layers.has(layer)) continue;
    layer.entry = null;
    if (!layer.keep) layer.spent = true;
  }
  sync(); // a guard gets its entry back right away
  for (const { layer } of popped) {
    if (layer !== null && layers.has(layer)) layer.onBack();
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
  let top: Layer | null = null;
  for (const layer of layers) if (layer.escape && (top === null || layer.order > top.order)) top = layer;
  if (top === null) return;
  e.preventDefault();
  top.onBack();
}

/** The router (or anyone) pushing while our entries are up: the new screen takes their place. */
function patchedPush(state: unknown, _unused: string, url?: string | URL | null): void {
  if (traversal !== null) {
    traversal.abandoned = true;
    spendAll();
    forgetRoute();
    nativePush(state, url);
    return;
  }
  if (entries.length === 0) {
    nativePush(state, url);
    return;
  }
  const below = entries.length - 1;
  spendAll();
  nativeReplace(state, url);
  if (below === 0) {
    forgetRoute();
    return;
  }
  // The dead entries under it collapse into one that becomes this route.
  route = { state: state as HistoryState, url: absoluteUrl(url) };
  routeChanged = true;
  traverse(-below, 'route');
}

/** A replace while our entries are up updates the route they carry; the top keeps its marker. */
function patchedReplace(state: unknown, _unused: string, url?: string | URL | null): void {
  if (entries.length === 0 && traversal === null) {
    nativeReplace(state, url);
    return;
  }
  route = { state: withoutMarker(state), url: absoluteUrl(url) };
  routeChanged = true;
  const m = markerOf(window.history.state);
  nativeReplace(m === null ? state : withMarker(route.state, m.id), url);
}

/**
 * Hooks the listeners and the history methods. Called from main.tsx before
 * the router starts, so this popstate listener runs before the router's; the
 * first layer installs it too (tests).
 */
export function installBackStack(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.history.pushState = patchedPush;
  window.history.replaceState = patchedReplace;
  window.addEventListener('popstate', onPopState, true);
  window.addEventListener('keydown', onKeyDown);
}

// --- Layers ----------------------------------------------------------------------

/** Reserves a stacking order. Claimed while rendering, so a parent ranks below the layers it renders. */
export function claimLayerOrder(): number {
  return nextOrder++;
}

export interface BackLayerOptions {
  onBack: () => void;
  /** From `claimLayerOrder`; defaults to "above everything open now". */
  order?: number;
  /** A guard: stays after Back (its entry comes back). Default false. */
  keep?: boolean;
  /** Escape runs `onBack` while it's the top-most such layer. Default true. */
  escape?: boolean;
}

export interface BackLayer {
  setOnBack(onBack: () => void): void;
  /** Closed from the UI (or unmounted): its entry is removed without navigating. */
  close(): void;
}

export function openBackLayer(options: BackLayerOptions): BackLayer {
  installBackStack();
  const layer: Layer = {
    order: options.order ?? claimLayerOrder(),
    keep: options.keep ?? false,
    escape: options.escape ?? true,
    onBack: options.onBack,
    entry: null,
    spent: false,
  };
  layers.add(layer);
  queueSync();
  return {
    setOnBack(onBack) {
      layer.onBack = onBack;
    },
    close() {
      if (!layers.delete(layer)) return;
      const entry = entries.find((en) => en.layer === layer);
      if (entry !== undefined) entry.layer = null;
      layer.entry = null;
      queueSync();
    },
  };
}

/** Test helper: forgets every layer and entry (the history itself is left as is). */
export function resetBackStackForTests(): void {
  if (traversal !== null) clearTimeout(traversal.timer);
  traversal = null;
  layers.clear();
  entries = [];
  forgetRoute();
  syncQueued = false;
}

/**
 * /knowledge/maps/:id — the interactive map viewer (maps spec §12.5-§16).
 *
 * Loads the installed document offline, dispatches to the right renderer by map
 * type (flat 2D, 3D globe, grid table) via <MapCanvas>, and wires: zone
 * selection → <ZoneSheet> (pins CRUD + fields), enum filter chips → dimming,
 * `?zone=` deep-link resolution + centering, in-map zone search (searchZones),
 * and a live "my notes" panel. Stale/removed/draft ids land on a real pane.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { friendlyError } from '../../core/errorText';
import { Haptics } from '../../core/haptics';
import { logError } from '../../core/logging';
import { FavoriteKind } from '../../data/db';
import { AppBackground } from '../../design-system/components/AppBackground';
import { GlassCard } from '../../design-system/components/GlassCard';
import { TagChip } from '../../design-system/components/TagChip';
import {
  IconArrowBack,
  IconChevronRight,
  IconClose,
  IconGridView,
  IconMap,
  IconPublic,
  IconSearch,
  IconWarningAmber,
} from '../../design-system/icons';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { useLiveQuery } from '../favorites/useLiveQuery';
import { IconEditNote, IconPushPin } from './kbIcons';
import { SearchField } from './components/SearchField';
import { Spinner } from './components/Spinner';
import { MapCanvas, type MapCanvasMode } from './maps/components/MapCanvas';
import { ZoneSheet } from './maps/components/ZoneSheet';
import { readBlob } from './maps/data/blobStore';
import { countPinsForMap, deletePin, listPinsForMap } from './maps/data/pins';
import { loadDocument, loadInstalledManifest, mapAssetSha } from './maps/data/repository';
import { buildSearchIndex, searchZones, type MapSearchIndex } from './maps/data/search';
import { ensureSeedImported } from './maps/data/seedImporter';
import { SUPPORTED_MAP_SCHEMA_VERSION } from './maps/model/limits';
import { sanitizeTheme, zoneTheme } from './maps/model/theme';
import type { MapDescriptor, MapDocument, MapZone } from './maps/model/types';
import styles from './MapDetailView.module.css';

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'missing' }
  | { status: 'draft' }
  | { status: 'ready'; doc: MapDocument; descriptor: MapDescriptor | null };

type PaneIcon = 'map' | 'draft' | 'update';

interface CanvasView {
  readonly kind: 'canvas';
  readonly doc: MapDocument;
  readonly mode: MapCanvasMode;
}
type ViewKind =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'pane'; icon: PaneIcon; title: string; message: string }
  | CanvasView;

function computeDimmed(doc: MapDocument, filters: ReadonlyMap<string, ReadonlySet<string>>): Set<string> {
  const active = [...filters.entries()].filter(([, set]) => set.size > 0);
  if (active.length === 0) return new Set();
  const dim = new Set<string>();
  for (const zone of doc.zones) {
    for (const [key, set] of active) {
      const v = zone.fields[key];
      if (typeof v !== 'string' || !set.has(v)) {
        dim.add(zone.id);
        break;
      }
    }
  }
  return dim;
}

function zoneKindLabel(zone: MapZone): string {
  const geom = zone.geometry;
  if (geom === null) return zone.gridPos !== null ? 'Region' : 'Unavailable';
  switch (geom.kind) {
    case 'polygon':
    case 'sphericalPolygon':
      return 'Region';
    case 'marker':
      return 'Marker';
    case 'sphericalCap':
      return 'Area';
    case 'unknown':
      return 'Unavailable';
  }
}

export function MapDetailView() {
  const { id: rawId } = useParams();
  const id = rawId ?? '';
  const [params] = useSearchParams();
  const deepLinkZone = params.get('zone');
  const navigate = useNavigate();

  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [bgBlob, setBgBlob] = useState<Blob | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gridMode, setGridMode] = useState(false);
  const [filters, setFilters] = useState<Map<string, ReadonlySet<string>>>(new Map());
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 });
  const [panel, setPanel] = useState<'none' | 'zones' | 'notes'>('none');

  const pinCount = useLiveQuery(() => countPinsForMap(id), [id]);

  // Load the installed document (+ descriptor) offline.
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setSelectedId(null);
    setFilters(new Map());
    setGridMode(false);
    void (async () => {
      try {
        await ensureSeedImported(); // idempotent — covers a direct deep link
        const manifest = await loadInstalledManifest();
        const descriptor = manifest?.maps.find((m) => m.id === id) ?? null;
        const doc = await loadDocument(id);
        if (cancelled) return;
        if (doc === null) {
          setState(descriptor?.draft === true ? { status: 'draft' } : { status: 'missing' });
          return;
        }
        setState({ status: 'ready', doc, descriptor });
        // Grid-backed planet maps (170+ named zones) are far more legible as
        // the flat grid table; open there by default. Pure spheres with no
        // grid (decorative globes) stay in globe mode.
        setGridMode(doc.type === 'sphere' && doc.grid !== null);
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const readyDoc = state.status === 'ready' ? state.doc : null;
  const descriptor = state.status === 'ready' ? state.descriptor : null;

  // Resolve the deep-linked zone once the doc is ready: select + center it.
  useEffect(() => {
    if (readyDoc === null) return;
    if (deepLinkZone !== null && readyDoc.zones.some((z) => z.id === deepLinkZone)) {
      setSelectedId(deepLinkZone);
      setFocus((f) => ({ id: deepLinkZone, nonce: f.nonce + 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyDoc, deepLinkZone]);

  // Decode the flat background from the offline store (constrained inside canvas).
  useEffect(() => {
    let cancelled = false;
    if (readyDoc === null || readyDoc.type !== 'flat') {
      setBgBlob(null);
      return;
    }
    void (async () => {
      try {
        const sha = await mapAssetSha(id, 'background');
        const blob = sha !== null ? await readBlob(sha) : null;
        if (!cancelled) setBgBlob(blob);
      } catch (error) {
        if (!cancelled) setBgBlob(null);
        logError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readyDoc, id]);

  const dimmed = useMemo(
    () => (readyDoc !== null ? computeDimmed(readyDoc, filters) : new Set<string>()),
    [readyDoc, filters],
  );
  const filterFields = useMemo(
    () =>
      readyDoc !== null
        ? readyDoc.fieldsSchema.filter(
            (f) => f.filterable && f.type === 'enum' && f.options !== null && f.options.length > 0,
          )
        : [],
    [readyDoc],
  );
  const searchIndex = useMemo<MapSearchIndex | null>(
    () => (readyDoc !== null && descriptor !== null ? buildSearchIndex([{ descriptor, doc: readyDoc }]) : null),
    [readyDoc, descriptor],
  );

  const selectedZone =
    readyDoc !== null && selectedId !== null
      ? (readyDoc.zones.find((z) => z.id === selectedId) ?? null)
      : null;
  const selectedTheme = useMemo(
    () =>
      readyDoc !== null && selectedZone !== null
        ? zoneTheme(sanitizeTheme(readyDoc.theme), selectedZone.themeOverride)
        : null,
    [readyDoc, selectedZone],
  );

  const view = computeView(state, gridMode);
  const isGridSphere = readyDoc !== null && readyDoc.type === 'sphere' && readyDoc.grid !== null;
  const title =
    descriptor?.title ?? (readyDoc !== null ? readyDoc.id : null) ?? 'Map';
  const pinBadge = pinCount.status === 'ready' ? pinCount.data : 0;

  const toggleFilter = (key: string, option: string): void => {
    setFilters((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(key) ?? []);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      if (set.size === 0) next.delete(key);
      else next.set(key, set);
      return next;
    });
  };

  const openZone = (zoneId: string): void => {
    setSelectedId(zoneId);
    setFocus((f) => ({ id: zoneId, nonce: f.nonce + 1 }));
    setPanel('none');
  };

  const canvasReady = view.kind === 'canvas';

  return (
    <AppBackground>
      <div className={styles.page}>
        <div className={styles.appBar}>
          <button type="button" className={styles.back} aria-label="Back" onClick={() => navigate(-1)}>
            <IconArrowBack size={24} />
          </button>
          <span className={styles.title}>{title}</span>
          <span className={styles.actions}>
            {canvasReady && (
              <>
                <FavoriteButton kind={FavoriteKind.map} id={id} tooltip="Favorite map" activeColor="var(--accent-primary)" />
                <button
                  type="button"
                  className={styles.actionBtn}
                  title="My map notes"
                  aria-label="My map notes"
                  onClick={() => setPanel((p) => (p === 'notes' ? 'none' : 'notes'))}
                >
                  <IconPushPin size={22} />
                  {pinBadge > 0 && <span className={styles.badge}>{pinBadge}</span>}
                </button>
                {isGridSphere && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    title={gridMode ? 'Globe view' : 'Grid view'}
                    aria-label={gridMode ? 'Globe view' : 'Grid view'}
                    onClick={() => setGridMode((g) => !g)}
                  >
                    {gridMode ? <IconPublic size={22} /> : <IconGridView size={22} />}
                  </button>
                )}
                {readyDoc !== null && readyDoc.zones.length > 0 && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    title="List of zones"
                    aria-label="List of zones"
                    onClick={() => setPanel((p) => (p === 'zones' ? 'none' : 'zones'))}
                  >
                    <IconSearch size={22} />
                  </button>
                )}
              </>
            )}
          </span>
        </div>

        <div className={styles.viewport}>
          {view.kind === 'loading' && (
            <div className={styles.center}>
              <Spinner />
            </div>
          )}
          {view.kind === 'error' && (
            <MessagePane
              icon="update"
              title="Couldn't open this map"
              message={friendlyError(view.error, 'The map failed to load.')}
            />
          )}
          {view.kind === 'pane' && <MessagePane icon={view.icon} title={view.title} message={view.message} />}
          {view.kind === 'canvas' && (
            <>
              <MapCanvas
                doc={view.doc}
                mode={view.mode}
                selectedId={selectedId}
                onSelect={setSelectedId}
                dimmed={dimmed}
                focusZoneId={focus.id}
                focusNonce={focus.nonce}
                backgroundBlob={bgBlob}
              />
              {filterFields.length > 0 && (
                <div className={styles.filterBar}>
                  <div className={styles.filterRow}>
                    {filterFields.flatMap((field) =>
                      (field.options ?? []).map((option) => (
                        <TagChip
                          key={`${field.key}:${option}`}
                          label={option}
                          selected={filters.get(field.key)?.has(option) ?? false}
                          onTap={() => toggleFilter(field.key, option)}
                        />
                      )),
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {selectedZone !== null && selectedTheme !== null && readyDoc !== null && (
          <ZoneSheet
            mapId={id}
            doc={readyDoc}
            zone={selectedZone}
            theme={selectedTheme}
            onClose={() => setSelectedId(null)}
          />
        )}

        {panel === 'zones' && readyDoc !== null && (
          <ZonesPanel
            doc={readyDoc}
            index={searchIndex}
            onPick={openZone}
            onClose={() => setPanel('none')}
          />
        )}
        {panel === 'notes' && readyDoc !== null && (
          <NotesPanel mapId={id} doc={readyDoc} onPick={openZone} onClose={() => setPanel('none')} />
        )}
      </div>
    </AppBackground>
  );
}

function computeView(state: DetailState, gridMode: boolean): ViewKind {
  switch (state.status) {
    case 'loading':
      return { kind: 'loading' };
    case 'error':
      return { kind: 'error', error: state.error };
    case 'missing':
      return {
        kind: 'pane',
        icon: 'map',
        title: 'Map not found',
        message:
          'This map is no longer available. It may have been removed in a content update. Go back to the gallery to see current maps.',
      };
    case 'draft':
      return {
        kind: 'pane',
        icon: 'draft',
        title: 'Draft map',
        message:
          'This map is still a draft and is not available to open yet. It will unlock in a future content update.',
      };
    case 'ready': {
      const doc = state.doc;
      if (doc.schemaVersion > SUPPORTED_MAP_SCHEMA_VERSION) {
        return updatePane(
          'This map needs a newer version of ESSI to open. Reload the app to get the latest version.',
        );
      }
      if (doc.type === 'flat') {
        if (doc.canvas === null) return updatePane('This map needs a newer app version to display.');
        return { kind: 'canvas', doc, mode: 'flat' };
      }
      if (doc.type === 'sphere') {
        if (doc.sphere === null) return updatePane('This globe needs a newer app version to display.');
        const mode: MapCanvasMode = doc.grid !== null && gridMode ? 'grid' : 'globe';
        return { kind: 'canvas', doc, mode };
      }
      return updatePane(
        'This map uses a format this app version does not understand yet. Update the app to view it.',
      );
    }
  }
}

function updatePane(message: string): ViewKind {
  return { kind: 'pane', icon: 'update', title: 'Update required', message };
}

function MessagePane({ icon, title, message }: { icon: PaneIcon; title: string; message: string }) {
  const Icon = icon === 'map' ? IconMap : icon === 'draft' ? IconEditNote : IconWarningAmber;
  return (
    <div className={styles.center}>
      <GlassCard padding={24} className={styles.pane}>
        <div className={styles.paneHeader}>
          <span className={styles.paneIcon}>
            <Icon size={22} />
          </span>
          <span className={styles.paneTitle}>{title}</span>
        </div>
        <p className={styles.paneMessage}>{message}</p>
      </GlassCard>
    </div>
  );
}

// --- Zones list / in-map search (§12.6) --------------------------------------

function ZonesPanel({
  doc,
  index,
  onPick,
  onClose,
}: {
  doc: MapDocument;
  index: MapSearchIndex | null;
  onPick: (zoneId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const rows: { id: string; name: string; kind: string }[] = useMemo(() => {
    if (trimmed.length > 0 && index !== null) {
      const byId = new Map(doc.zones.map((z) => [z.id, z] as const));
      return searchZones(index, trimmed)
        .map((hit) => byId.get(hit.zoneId))
        .filter((z): z is MapZone => z !== undefined)
        .map((z) => ({ id: z.id, name: z.name.length > 0 ? z.name : z.id, kind: zoneKindLabel(z) }));
    }
    return doc.zones.map((z) => ({
      id: z.id,
      name: z.name.length > 0 ? z.name : z.id,
      kind: zoneKindLabel(z),
    }));
  }, [doc, index, trimmed]);

  return (
    <Panel title={`Zones · ${doc.zones.length}`} onClose={onClose}>
      <div className={styles.panelSearch}>
        <SearchField value={query} onChange={setQuery} placeholder="Search zones" onClear={() => setQuery('')} />
      </div>
      {rows.length === 0 ? (
        <p className={styles.panelEmpty}>No zones match.</p>
      ) : (
        <div className={styles.panelList}>
          {rows.map((row) => (
            <GlassCard key={row.id} onTap={() => onPick(row.id)} ariaLabel={`${row.name}, ${row.kind}`}>
              <div className={styles.zoneRow}>
                <div className={styles.zoneText}>
                  <span className={styles.zoneName}>{row.name}</span>
                  <span className={styles.zoneKind}>{row.kind}</span>
                </div>
                <IconChevronRight size={20} className={styles.chevron} />
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </Panel>
  );
}

// --- My notes (§12.7) --------------------------------------------------------

function NotesPanel({
  mapId,
  doc,
  onPick,
  onClose,
}: {
  mapId: string;
  doc: MapDocument;
  onPick: (zoneId: string) => void;
  onClose: () => void;
}) {
  const pins = useLiveQuery(() => listPinsForMap(mapId), [mapId]);
  const zoneNames = useMemo(() => new Map(doc.zones.map((z) => [z.id, z.name] as const)), [doc]);

  const rows =
    pins.status === 'ready'
      ? pins.data.filter((p) => zoneNames.has(p.zoneId))
      : [];

  const remove = (pinId: string): void => {
    Haptics.selection();
    deletePin(pinId).catch((error: unknown) => logError(error));
  };

  return (
    <Panel title={`My notes · ${rows.length}`} onClose={onClose}>
      {pins.status === 'loading' && <Spinner padded />}
      {pins.status === 'error' && <p className={styles.panelEmpty}>Couldn't load your notes.</p>}
      {pins.status === 'ready' && rows.length === 0 && (
        <p className={styles.panelEmpty}>No notes yet. Open a zone and tap "Add note / pin".</p>
      )}
      {rows.length > 0 && (
        <div className={styles.panelList}>
          {rows.map((pin) => {
            const name = zoneNames.get(pin.zoneId) ?? pin.zoneId;
            return (
              <div key={pin.id} className={styles.noteRow}>
                <button
                  type="button"
                  className={styles.noteMain}
                  aria-label={`Note on ${name}`}
                  onClick={() => onPick(pin.zoneId)}
                >
                  <span className={styles.noteIcon}>
                    <IconPushPin size={18} />
                  </span>
                  <span className={styles.noteText}>
                    <span className={styles.zoneName}>{name.length > 0 ? name : pin.zoneId}</span>
                    <span className={styles.noteBody}>{pin.note}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.noteDelete}
                  title="Delete note"
                  aria-label="Delete note"
                  onClick={() => remove(pin.id)}
                >
                  <IconClose size={20} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button type="button" className={styles.catcher} aria-label="Close panel" onClick={onClose} />
      <section className={styles.panel} role="dialog" aria-label={title}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>{title}</span>
          <button type="button" className={styles.actionBtn} title="Close" aria-label="Close" onClick={onClose}>
            <IconClose size={22} />
          </button>
        </div>
        <div className={styles.panelBody}>{children}</div>
      </section>
    </>
  );
}

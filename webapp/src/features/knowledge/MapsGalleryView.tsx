/**
 * /knowledge/maps — the interactive maps gallery (maps spec §12.2).
 *
 * On entry it imports the bundled seed (idempotent), loads the installed
 * manifest offline, and — when the settings flags allow — fires one guarded
 * background update check (installing silently, surfacing a "New maps ready"
 * banner for the next entry). It offers cross-map zone search (searchZones,
 * debounced 280 ms), a changelog banner, and the map card grid with
 * constrained-decode thumbnails. Empty/loading/error/seed-failure states are
 * all real panes.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../../core/errorText';
import { logError } from '../../core/logging';
import { useSettingsStore } from '../../data/settings';
import { GlassCard } from '../../design-system/components/GlassCard';
import { HowItWorksSheet } from '../../design-system/components/HowItWorksSheet';
import { NeonButton } from '../../design-system/components/NeonButton';
import {
  IconChevronRight,
  IconClose,
  IconGridView,
  IconInfoOutline,
  IconMap,
  IconPublic,
  IconReplay,
  IconSatelliteAlt,
  IconSparkle,
} from '../../design-system/icons';
import { IconTravelExplore } from './kbIcons';
import { DetailScaffold } from './components/DetailScaffold';
import { SearchField } from './components/SearchField';
import { Spinner } from './components/Spinner';
import { MapsHowItWorks } from './maps/components/MapsHowItWorks';
import { readBlob } from './maps/data/blobStore';
import {
  APP_VERSION_FALLBACK,
  checkForUpdate,
  install,
  loadDocument,
  loadInstalledManifest,
  mapAssetSha,
} from './maps/data/repository';
import { buildSearchIndex, searchZones, type MapSearchIndex, type SearchHit } from './maps/data/search';
import { ensureSeedImported } from './maps/data/seedImporter';
import type { MapDescriptor, MapDocument, MapIcon, MapsManifest } from './maps/model/types';
import styles from './MapsGalleryView.module.css';

type GalleryState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | {
      status: 'ready';
      manifest: MapsManifest | null;
      index: MapSearchIndex;
      seedFailed: boolean;
      diskFull: boolean;
    };

type UpdateBanner = 'none' | 'ready' | 'updateApp';

function mapIcon(icon: MapIcon): (props: { size?: number }) => ReactElement {
  switch (icon) {
    case 'sphere':
      return IconPublic;
    case 'sector':
      return IconGridView;
    case 'station':
      return IconSatelliteAlt;
    case 'map':
    case 'dungeon':
      return IconMap;
    case 'unknown':
      return IconTravelExplore;
  }
}

export function MapsGalleryView() {
  const navigate = useNavigate();
  const [state, setState] = useState<GalleryState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [howItWorks, setHowItWorks] = useState(false);
  const [query, setQuery] = useState('');
  const [committed, setCommitted] = useState('');
  const [updateBanner, setUpdateBanner] = useState<UpdateBanner>('none');
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [changelogDismissed, setChangelogDismissed] = useState(false);
  const checkedRef = useRef(false);

  const mapsNetworkEnabled = useSettingsStore((s) => s.mapsNetworkEnabled);
  const mapsAutoUpdate = useSettingsStore((s) => s.mapsAutoUpdate);
  const lastSeenChangelog = useSettingsStore((s) => s.mapsLastSeenChangelogVersion);
  const markChangelogSeen = useSettingsStore((s) => s.markMapsChangelogSeen);

  // Load: seed import (idempotent) → installed manifest → cross-map search index.
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const seed = await ensureSeedImported();
        const manifest = await loadInstalledManifest();
        const entries: { descriptor: MapDescriptor; doc: MapDocument }[] = [];
        if (manifest !== null) {
          for (const descriptor of manifest.maps) {
            if (descriptor.draft) continue;
            const doc = await loadDocument(descriptor.id);
            if (doc !== null) entries.push({ descriptor, doc });
          }
        }
        if (cancelled) return;
        setState({
          status: 'ready',
          manifest,
          index: buildSearchIndex(entries),
          seedFailed: seed.kind === 'failed',
          diskFull: seed.kind === 'failed' ? seed.diskFull : false,
        });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // One guarded background update check per entry (§10.5).
  useEffect(() => {
    if (state.status !== 'ready' || checkedRef.current) return;
    checkedRef.current = true;
    if (!mapsNetworkEnabled || !mapsAutoUpdate) return;
    void (async () => {
      try {
        const outcome = await checkForUpdate({ networkEnabled: true, appVersion: APP_VERSION_FALLBACK });
        if (outcome.kind === 'available') {
          await install(outcome);
          setUpdateBanner('ready'); // appears on the NEXT entry
        } else if (outcome.kind === 'blockedByAppVersion') {
          setUpdateBanner('updateApp');
        }
      } catch (error) {
        logError(error);
      }
    })();
  }, [state.status, mapsNetworkEnabled, mapsAutoUpdate]);

  // Debounce keystrokes into the committed query (§11.4).
  useEffect(() => {
    const timer = setTimeout(() => setCommitted(query), 280);
    return () => clearTimeout(timer);
  }, [query]);

  const manifest = state.status === 'ready' ? state.manifest : null;
  const maps = useMemo<MapDescriptor[]>(
    () => (manifest !== null ? [...manifest.maps].sort((a, b) => a.order - b.order) : []),
    [manifest],
  );

  const trimmed = committed.trim();
  const results = useMemo<SearchHit[]>(
    () => (state.status === 'ready' && trimmed.length > 0 ? searchZones(state.index, trimmed) : []),
    [state, trimmed],
  );

  const changelog = manifest?.changelog ?? [];
  const showChangelog =
    manifest !== null &&
    changelog.length > 0 &&
    manifest.contentVersion.length > 0 &&
    manifest.contentVersion !== lastSeenChangelog &&
    !changelogDismissed;

  const dismissChangelog = (): void => {
    if (manifest !== null) markChangelogSeen(manifest.contentVersion);
    setChangelogDismissed(true);
  };

  const infoAction = (
    <button
      type="button"
      className={styles.infoBtn}
      title="How interactive maps work"
      aria-label="How interactive maps work"
      onClick={() => setHowItWorks(true)}
    >
      <IconInfoOutline size={24} />
    </button>
  );

  return (
    <>
      <DetailScaffold title="Interactive maps" action={infoAction} bodyPadding="64px 12px 32px">
        {state.status === 'loading' && <Spinner padded />}

        {state.status === 'error' && (
          <p className={styles.errorText}>{friendlyError(state.error, "Couldn't load maps.")}</p>
        )}

        {state.status === 'ready' && (
          <div className={styles.column}>
            {showChangelog && (
              <div className={styles.banner} style={changelogBannerStyle}>
                <span className={styles.bannerIcon} style={{ color: 'var(--accent-secondary)' }}>
                  <IconSparkle size={20} />
                </span>
                <div className={styles.bannerBody}>
                  <span className={styles.bannerTitle} style={{ color: 'var(--accent-secondary)' }}>
                    What's new
                  </span>
                  {changelog.map((entry, i) => (
                    <div key={i} className={styles.changelogEntry}>
                      {entry.version !== null && (
                        <span className={styles.changelogVersion}>{entry.version}</span>
                      )}
                      <span className={styles.changelogNotes}>{entry.notes}</span>
                    </div>
                  ))}
                </div>
                <button type="button" className={styles.bannerClose} title="Dismiss" aria-label="Dismiss" onClick={dismissChangelog}>
                  <IconClose size={18} />
                </button>
              </div>
            )}

            {updateBanner !== 'none' && !updateDismissed && (
              <div
                className={styles.banner}
                style={updateBanner === 'ready' ? updateReadyStyle : updateAppStyle}
              >
                <span
                  className={styles.bannerIcon}
                  style={{ color: updateBanner === 'ready' ? 'var(--accent-primary)' : 'var(--accent-warn)' }}
                >
                  {updateBanner === 'ready' ? <IconMap size={20} /> : <IconReplay size={20} />}
                </span>
                <div className={styles.bannerBody}>
                  <span
                    className={styles.bannerTitle}
                    style={{ color: updateBanner === 'ready' ? 'var(--accent-primary)' : 'var(--accent-warn)' }}
                  >
                    {updateBanner === 'ready' ? 'New maps ready' : 'Update ESSI'}
                  </span>
                  <span className={styles.bannerMessage}>
                    {updateBanner === 'ready'
                      ? 'Updated map content was downloaded and will appear the next time you open Interactive maps.'
                      : 'Newer map content is available but needs a newer version of ESSI. Reload the app to get it.'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.bannerClose}
                  title="Dismiss"
                  aria-label="Dismiss"
                  onClick={() => setUpdateDismissed(true)}
                >
                  <IconClose size={18} />
                </button>
              </div>
            )}

            {maps.length > 0 && (
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search zones across maps"
                onClear={() => setQuery('')}
              />
            )}

            {trimmed.length > 0 ? (
              <SearchResults hits={results} query={committed} onOpen={(mapId, zoneId) => navigate(zoneLink(mapId, zoneId))} />
            ) : maps.length > 0 ? (
              <div className={styles.cards}>
                {maps.map((descriptor) => (
                  <MapCard key={descriptor.id} descriptor={descriptor} onOpen={() => navigate(mapLink(descriptor.id))} />
                ))}
              </div>
            ) : (
              <EmptyState seedFailed={state.seedFailed} diskFull={state.diskFull} onRetry={() => setReload((n) => n + 1)} />
            )}
          </div>
        )}
      </DetailScaffold>

      <HowItWorksSheet open={howItWorks} onClose={() => setHowItWorks(false)}>
        <MapsHowItWorks />
      </HowItWorksSheet>
    </>
  );
}

function zoneLink(mapId: string, zoneId: string): string {
  return `/knowledge/maps/${encodeURIComponent(mapId)}?zone=${encodeURIComponent(zoneId)}`;
}
function mapLink(mapId: string): string {
  return `/knowledge/maps/${encodeURIComponent(mapId)}`;
}

// --- Search results (§12.2) --------------------------------------------------

function SearchResults({
  hits,
  query,
  onOpen,
}: {
  hits: readonly SearchHit[];
  query: string;
  onOpen: (mapId: string, zoneId: string) => void;
}) {
  if (hits.length === 0) {
    return <p className={styles.noMatch}>No zones match “{query}”.</p>;
  }
  return (
    <div className={styles.cards}>
      {hits.map((hit) => {
        const Icon = mapIcon(hit.mapIcon);
        return (
          <GlassCard
            key={`${hit.mapId}/${hit.zoneId}`}
            onTap={() => onOpen(hit.mapId, hit.zoneId)}
            ariaLabel={`${hit.zoneName}, in ${hit.mapTitle}`}
          >
            <div className={styles.resultRow}>
              <span className={styles.resultIcon}>
                <Icon size={20} />
              </span>
              <div className={styles.resultText}>
                <span className={styles.resultMap}>{hit.mapTitle.toUpperCase()}</span>
                <span className={styles.resultZone}>{hit.zoneName}</span>
              </div>
              <IconChevronRight size={20} className={styles.chevron} />
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

// --- Map card (§12.3) --------------------------------------------------------

function MapCard({ descriptor, onOpen }: { descriptor: MapDescriptor; onOpen: () => void }) {
  return (
    <GlassCard onTap={onOpen} ariaLabel={descriptor.draft ? `${descriptor.title}, draft` : descriptor.title}>
      <div className={styles.cardRow}>
        <MapThumb mapId={descriptor.id} icon={descriptor.icon} />
        <div className={styles.cardText}>
          <div className={styles.cardTitleRow}>
            <span className={styles.cardTitle}>{descriptor.title}</span>
            {descriptor.draft && <span className={styles.draftBadge}>DRAFT</span>}
          </div>
          {descriptor.subtitle !== null && descriptor.subtitle.length > 0 && (
            <span className={styles.cardSubtitle}>{descriptor.subtitle}</span>
          )}
        </div>
        <IconChevronRight size={20} className={styles.chevron} />
      </div>
    </GlassCard>
  );
}

/** 48×48 thumbnail decoded at display size (§12.3); falls back to the map glyph. */
function MapThumb({ mapId, icon }: { mapId: string; icon: MapIcon }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawn, setDrawn] = useState(false);
  const Icon = mapIcon(icon);

  useEffect(() => {
    let cancelled = false;
    let bitmap: ImageBitmap | null = null;
    setDrawn(false);
    void (async () => {
      try {
        const sha = await mapAssetSha(mapId, 'background');
        const blob = sha !== null ? await readBlob(sha) : null;
        if (blob === null) return;
        const dpr = window.devicePixelRatio || 1;
        const size = Math.max(1, Math.min(256, Math.round(48 * dpr)));
        bitmap = await createImageBitmap(blob, { resizeWidth: size, resizeQuality: 'medium' });
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (canvas === null) return;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx === null) return;
        const scale = Math.max(size / bitmap.width, size / bitmap.height); // cover-fit
        const dw = bitmap.width * scale;
        const dh = bitmap.height * scale;
        ctx.drawImage(bitmap, (size - dw) / 2, (size - dh) / 2, dw, dh);
        setDrawn(true);
      } catch (error) {
        logError(error); // decode error → glyph fallback stays
      } finally {
        bitmap?.close();
      }
    })();
    return () => {
      cancelled = true;
      bitmap?.close();
    };
  }, [mapId]);

  return (
    <div className={styles.thumb}>
      <canvas ref={canvasRef} className={styles.thumbCanvas} style={{ opacity: drawn ? 1 : 0 }} />
      {!drawn && (
        <span className={styles.thumbGlyph}>
          <Icon size={26} />
        </span>
      )}
    </div>
  );
}

// --- Empty states (§12.2) ----------------------------------------------------

function EmptyState({
  seedFailed,
  diskFull,
  onRetry,
}: {
  seedFailed: boolean;
  diskFull: boolean;
  onRetry: () => void;
}) {
  const title = seedFailed ? (diskFull ? 'Storage full' : "Couldn't set up maps") : 'No maps yet';
  const message = seedFailed
    ? diskFull
      ? 'Offline maps could not be set up because storage is full. Free up some space and try again.'
      : 'The offline map set could not be prepared.'
    : 'Interactive maps will appear here once they are installed.';
  return (
    <GlassCard className={styles.empty} padding={20}>
      <div className={styles.emptyHeader}>
        <span className={styles.emptyIcon} style={{ color: seedFailed ? 'var(--accent-warn)' : 'var(--accent-primary)' }}>
          {seedFailed ? <IconReplay size={20} /> : <IconMap size={20} />}
        </span>
        <span className={styles.emptyTitle}>{title}</span>
      </div>
      <p className={styles.emptyMessage}>{message}</p>
      {seedFailed && (
        <div className={styles.emptyAction}>
          <NeonButton title="Retry" icon={<IconReplay size={18} />} onPressed={onRetry} />
        </div>
      )}
    </GlassCard>
  );
}

const changelogBannerStyle = {
  background: 'rgba(122, 227, 255, 0.10)',
  border: '1px solid rgba(122, 227, 255, 0.45)',
};
const updateReadyStyle = {
  background: 'rgba(79, 195, 255, 0.10)',
  border: '1px solid rgba(79, 195, 255, 0.45)',
};
const updateAppStyle = {
  background: 'rgba(255, 179, 71, 0.10)',
  border: '1px solid rgba(255, 179, 71, 0.45)',
};

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { IconPublic, IconTrack, IconWarningAmber, IconWifiTethering } from '../../design-system/icons';
import { useSettingsStore } from '../../data/settings';
import type { HistoryRow } from '../../data/db';
import { Haptics } from '../../core/haptics';
import { showSnackbar } from '../../core/snackbar';
import { ToolScaffold } from './nasa/ui/ToolScaffold';
import { Divider, Spinner, SquareSegmented } from './nasa/ui/kit';
import { BulletRow, HistorySheet, ProxyNotice } from './nasa/ui/viewKit';
import {
  IconCenterFocus,
  IconPushPin,
  IconPushPinOutlined,
  IconStopCircle,
} from './nasa/ui/toolIcons';
import { TrackerHowItWorks } from './nasa/ui/howItWorks/TrackerHowItWorks';
import { dMonthYear, dMonthYearHm } from './nasa/ui/format';
import {
  catalogSuggestions,
  findCatalogMatch,
  loadTrackedObjects,
  resolvePin,
  type TrackedObject,
} from './nasa/catalog';
import { track, type TrackTarget } from './nasa/trackerClient';
import { TrackerCancelledError, TrackerError, TrackerUnparseableError } from './nasa/errors';
import type { TrackerResult } from './nasa/models';
import { KIND_EMOJI, type ObjectKind } from './nasa/sbdb';
import { decodeTrackerEntry, saveTrackerHistory } from './nasa/history';
import { toggleFavorite, useFavoriteSet } from './shared/favorites';
import styles from './nasa/ui/nasa.module.css';

/**
 * /tools/tracker — Object Tracker (tools-live spec §6). Resolves a canonical
 * MPC designation (curated catalog, then SBDB) and fetches the body's live
 * heliocentric vector from JPL Horizons, reporting sector, AU coordinates and
 * SL distance. Accepts a prefill TrackTarget via router location state and
 * auto-tracks it once when an MPC id is provided.
 */

type TrackerPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: TrackerResult }
  | { kind: 'errored'; error: TrackerError };

const TRACKER_FAVORITE_KIND = 'tracked_object' as const;

const TRACKER_HISTORY_STRINGS = {
  title: 'Tracker history',
  emptyTitle: 'No tracks yet',
  errorTitle: "Couldn't load tracker history",
  clearTitle: 'Delete all tracks?',
  clearMessage: 'All saved tracks will be removed.',
  deleteTitle: 'Delete track?',
} as const;

function isTrackTarget(value: unknown): value is TrackTarget {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      {children}
    </div>
  );
}

export function TrackerView() {
  const location = useLocation();
  const proxyBase = useSettingsStore((s) => s.jplProxyUrl).trim().replace(/\/+$/, '') || null;

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ObjectKind>('asteroid');
  const [phase, setPhase] = useState<TrackerPhase>({ kind: 'idle' });
  const [lockedMpcID, setLockedMpcID] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<readonly TrackedObject[]>([]);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const autoTrackedRef = useRef(false);

  const favoriteIds = useFavoriteSet(TRACKER_FAVORITE_KIND);

  const loading = phase.kind === 'loading';

  useEffect(() => {
    let alive = true;
    void loadTrackedObjects().then((c) => {
      if (alive) setCatalog(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  const runTrack = (target: TrackTarget) => {
    if (proxyBase === null) return;
    abortRef.current?.abort();
    const gen = ++genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'loading' });
    void (async () => {
      try {
        const result = await track(proxyBase, target, catalog, controller.signal);
        void saveTrackerHistory(result);
        if (gen !== genRef.current) return;
        setPhase({ kind: 'ready', result });
        Haptics.success();
      } catch (e) {
        if (e instanceof TrackerCancelledError) {
          if (gen !== genRef.current) return;
          setPhase({ kind: 'idle' });
          return;
        }
        if (gen !== genRef.current) return;
        const error = e instanceof TrackerError ? e : new TrackerUnparseableError();
        setPhase({ kind: 'errored', error });
        Haptics.warning();
      }
    })();
  };

  // Prefill + one-shot auto-track from Discoveries / history / pin navigation.
  useEffect(() => {
    if (autoTrackedRef.current) return;
    const state: unknown = location.state;
    if (!isTrackTarget(state)) return;
    setQuery(state.name);
    setKind(state.kind);
    const mpc =
      typeof state.mpcID === 'string' && state.mpcID.trim().length > 0 ? state.mpcID.trim() : null;
    setLockedMpcID(mpc);
    if (mpc !== null) {
      autoTrackedRef.current = true;
      runTrack(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    const hit = findCatalogMatch(catalog, value);
    if (hit !== null) {
      setKind(hit.kind);
      setLockedMpcID(hit.identifier);
    } else {
      setLockedMpcID(null);
    }
  };

  const selectSuggestion = (entry: TrackedObject) => {
    Haptics.selection();
    onQueryChange(entry.name);
  };

  const cancel = () => {
    Haptics.warning();
    abortRef.current?.abort();
    genRef.current += 1;
    setPhase({ kind: 'idle' });
  };

  const trackFromInput = () => {
    runTrack({ name: query, kind, mpcID: lockedMpcID ?? undefined });
  };

  const pins = useMemo(() => {
    return Array.from(favoriteIds)
      .map((id) => resolvePin(catalog, id))
      .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  }, [favoriteIds, catalog]);

  const suggestions = useMemo(() => {
    if (lockedMpcID !== null) return [];
    return catalogSuggestions(catalog, kind, query);
  }, [catalog, kind, query, lockedMpcID]);

  const trackPin = (pin: { id: string; label: string; kind: ObjectKind }) => {
    Haptics.tap();
    setQuery(pin.label);
    setKind(pin.kind);
    setLockedMpcID(pin.id);
    runTrack({ name: pin.label, kind: pin.kind, mpcID: pin.id });
  };

  const unpin = async (id: string) => {
    Haptics.selection();
    try {
      await toggleFavorite(TRACKER_FAVORITE_KIND, id);
      showSnackbar('Unpinned.');
    } catch {
      showSnackbar("Couldn't unpin.", { danger: true });
    }
  };

  const togglePin = async (id: string) => {
    Haptics.selection();
    try {
      await toggleFavorite(TRACKER_FAVORITE_KIND, id);
    } catch {
      showSnackbar("Couldn't update favorite.", { danger: true });
    }
  };

  const renderTrackerRow =
    (close: () => void) =>
    (row: HistoryRow): ReactNode => {
      const result = decodeTrackerEntry(row);
      const date = new Date(row.date);
      return (
        <GlassCard
          onTap={() => {
            setQuery(result.displayName);
            setKind(result.kind);
            setLockedMpcID(result.mpcID);
            close();
            runTrack({ name: result.displayName, kind: result.kind, mpcID: result.mpcID });
          }}
        >
          <div className={styles.rowCenter} style={{ gap: 12 }}>
            <span style={{ fontSize: 22 }}>{KIND_EMOJI[result.kind]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.headline}>{result.displayName}</div>
              <div className={styles.caption} style={{ marginTop: 2 }}>
                {dMonthYearHm(date)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                className={styles.mono}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)' }}
              >
                Sector {result.sector}
              </div>
              <div className={styles.caption}>{result.slRounded.toFixed(2)} SL</div>
            </div>
          </div>
        </GlassCard>
      );
    };

  const canTrack = query.trim().length > 0 && !loading;

  return (
    <ToolScaffold
      title="Tracker"
      historyTooltip="Tracker history"
      renderHowItWorks={() => <TrackerHowItWorks />}
      renderHistory={(close) => (
        <HistorySheet
          kind="tracker"
          strings={TRACKER_HISTORY_STRINGS}
          onClose={close}
          renderRow={renderTrackerRow(close)}
        />
      )}
    >
      <TransmissionHeader label="ESSI · real-time object tracking" />

      <GlassCard>
        <div className={styles.rowCenter} style={{ gap: 8 }}>
          <span style={{ color: 'var(--accent-warn)', display: 'inline-flex' }}>
            <IconWifiTethering size={18} />
          </span>
          <span className={styles.headline}>Network access required</span>
        </div>
        <div className={styles.caption} style={{ marginTop: 8 }}>
          This tool sends up to 5 GET requests to public NASA APIs (JPL Horizons + SBDB). Nothing
          happens until you tap Track.
        </div>
        <Divider alpha={0.4} margin="8px 0" />
        <BulletRow label="Endpoint:" value="ssd.jpl.nasa.gov + ssd-api.jpl.nasa.gov" />
        <BulletRow label="Sent:" value="An object name or designation" />
        <BulletRow label="Received:" value="A single heliocentric position vector" />
        <BulletRow label="Locally:" value="Sector (1-12), AU coordinates and distance in SL" />
        <BulletRow label="Stored:" value="Nothing sent to a server (tracks are saved locally)" />
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Target" icon={<IconCenterFocus size={18} />} />
        <input
          className={styles.textField}
          style={{ marginTop: 8 }}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Object name (e.g. Ceres, C/2025 N1)"
          value={query}
          disabled={loading}
          onChange={(e) => onQueryChange(e.target.value)}
        />

        {pins.length > 0 && (
          <>
            <div className={styles.rowCenter} style={{ gap: 4, marginTop: 12 }}>
              <span style={{ color: 'var(--accent-primary)', display: 'inline-flex' }}>
                <IconPushPin size={12} />
              </span>
              <span
                className={styles.mono}
                style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'var(--accent-primary)' }}
              >
                PINNED
              </span>
            </div>
            <div className={styles.chipWrap} style={{ marginTop: 6 }}>
              {pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  className={styles.chip}
                  disabled={loading}
                  title={`Track ${pin.label} · right-click to unpin`}
                  onClick={() => trackPin(pin)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    void unpin(pin.id);
                  }}
                >
                  <span style={{ color: 'var(--accent-primary)', display: 'inline-flex' }}>
                    <IconPushPin size={11} />
                  </span>
                  {pin.label}
                </button>
              ))}
            </div>
          </>
        )}

        {suggestions.length > 0 && (
          <div className={styles.chipWrap} style={{ marginTop: 8 }}>
            {suggestions.map((entry) => (
              <button
                key={entry.identifier}
                type="button"
                className={styles.chip}
                disabled={loading}
                onClick={() => selectSuggestion(entry)}
              >
                {KIND_EMOJI[entry.kind]} {entry.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <SquareSegmented
            options={[
              { value: 'comet', label: 'Comets' },
              { value: 'asteroid', label: 'Asteroids' },
            ]}
            value={kind}
            onChange={setKind}
            disabled={loading || lockedMpcID !== null}
          />
        </div>
      </GlassCard>

      {proxyBase === null ? (
        <ProxyNotice />
      ) : (
        <GlassCard>
          {loading ? (
            <div className={styles.rowCenter} style={{ gap: 8 }}>
              <Spinner size={18} />
              <span
                className={styles.mono}
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent-secondary)' }}
              >
                Tracking…
              </span>
              <button
                type="button"
                className={styles.iconBtn}
                style={{ marginLeft: 'auto', color: 'var(--accent-danger)' }}
                title="Stop tracking"
                aria-label="Stop tracking"
                onClick={cancel}
              >
                <IconStopCircle size={26} />
              </button>
            </div>
          ) : (
            <NeonButton
              title="Track"
              icon={<IconTrack size={18} />}
              enabled={canTrack}
              onPressed={trackFromInput}
            />
          )}
        </GlassCard>
      )}

      {phase.kind === 'errored' && (
        <GlassCard>
          <div className={styles.rowCenter} style={{ gap: 8 }}>
            <span style={{ color: 'var(--accent-danger)', display: 'inline-flex' }}>
              <IconWarningAmber size={24} />
            </span>
            <span className={styles.body}>{phase.error.message}</span>
          </div>
        </GlassCard>
      )}

      {phase.kind === 'ready' && <TrackResult result={phase.result} favoriteIds={favoriteIds} onTogglePin={togglePin} />}
    </ToolScaffold>
  );
}

function TrackResult({
  result,
  favoriteIds,
  onTogglePin,
}: {
  result: TrackerResult;
  favoriteIds: Set<string>;
  onTogglePin: (id: string) => void;
}) {
  const pinned = favoriteIds.has(result.mpcID);
  return (
    <GlassCard>
      <div className={styles.rowCenter}>
        <SectionHeader title="Position" icon={<IconPublic size={18} />} />
        <button
          type="button"
          className={styles.iconBtn}
          style={{ marginLeft: 'auto', color: pinned ? 'var(--accent-primary)' : 'var(--text-dim)' }}
          title={pinned ? 'Remove favorite' : 'Pin object'}
          aria-label={pinned ? 'Remove favorite' : 'Pin object'}
          aria-pressed={pinned}
          onClick={() => onTogglePin(result.mpcID)}
        >
          {pinned ? <IconPushPin size={18} /> : <IconPushPinOutlined size={18} />}
        </button>
      </div>

      <div className={styles.rowCenter} style={{ gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 22 }}>{KIND_EMOJI[result.kind]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.headline}>{result.displayName}</div>
          <div className={styles.caption} style={{ marginTop: 2 }}>
            MPC {result.mpcID} · {dMonthYear(result.timestamp)}
          </div>
        </div>
      </div>

      <Divider alpha={0.12} margin="12px 0" />

      <InfoRow label="Sector">
        <span className={styles.mono} style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent-primary)' }}>
          {result.sector}
        </span>
      </InfoRow>
      <InfoRow label="Distance">
        <span className={styles.mono} style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-secondary)' }}>
          {result.slRounded.toFixed(3)} SL
        </span>
      </InfoRow>
      {result.slFloor < result.slRounded && (
        <div className={styles.caption} style={{ color: 'var(--accent-warn)', marginTop: 4 }}>
          Navigation flooring → {result.slFloor} SL
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <InfoRow label="AU distance">
          <span className={styles.mono} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {result.distanceAU.toFixed(3)}
          </span>
        </InfoRow>
        <InfoRow label="X (AU)">
          <span className={styles.mono} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {result.xAU.toFixed(3)}
          </span>
        </InfoRow>
        <InfoRow label="Y (AU)">
          <span className={styles.mono} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {result.yAU.toFixed(3)}
          </span>
        </InfoRow>
        <InfoRow label="Z (AU)">
          <span className={styles.mono} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {result.zAU.toFixed(3)}
          </span>
        </InfoRow>
      </div>
    </GlassCard>
  );
}

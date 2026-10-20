import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import {
  IconClose,
  IconPublic,
  IconTrack,
  IconWarningAmber,
} from '../../design-system/icons';
import { resolveProxyBase } from './nasa/jplClient';
import type { HistoryRow } from '../../data/db';
import { Haptics } from '../../core/haptics';
import { showSnackbar } from '../../core/snackbar';
import { ToolScaffold } from './nasa/ui/ToolScaffold';
import { NetworkNotice } from './nasa/ui/NetworkNotice';
import { Divider, Spinner, SquareSegmented } from './nasa/ui/kit';
import { HistorySheet } from './nasa/ui/viewKit';
import {
  IconCenterFocus,
  IconPushPin,
  IconPushPinOutlined,
  IconRefresh,
  IconShare,
  IconStopCircle,
} from './nasa/ui/toolIcons';
import { TrackerHowItWorks } from './nasa/ui/howItWorks/TrackerHowItWorks';
import { dMonthYearHm } from './nasa/ui/format';
import {
  catalogSuggestions,
  findCatalogMatch,
  loadTrackedObjects,
  resolvePin,
  type TrackedObject,
} from './nasa/catalog';
import { track, type TrackTarget } from './nasa/trackerClient';
import {
  TrackerAmbiguousError,
  TrackerCancelledError,
  TrackerError,
  TrackerSunError,
  TrackerUnparseableError,
  type TrackChoice,
} from './nasa/errors';
import { isMajorKind, type TrackKind, type TrackerResult } from './nasa/models';
import { distanceFromSunAU } from './nasa/sectorMath';
import {
  describeMajorBody,
  describeMajorBodyInline,
  findMajorBody,
  majorBodyFromId,
  majorBodyId,
  majorBodySuggestions,
  majorBodySymbol,
  trackDesignation,
  trackSymbol,
  type MajorBody,
} from './nasa/majorBodies';
import { KIND_EMOJI, type ObjectKind } from './nasa/sbdb';
import { decodeTrackerEntry, saveTrackerHistory } from './nasa/history';
import { toggleFavorite, useFavoriteSet } from './shared/favorites';
import { trackerFromSnapshot, trackerShare } from './nasa/share';
import { ShareSheet } from './shared/ShareSheet';
import type { ShareContent } from './shared/shareActions';
import styles from './nasa/ui/nasa.module.css';

/**
 * /tools/tracker - Object Tracker (tools-live spec §6). Resolves a canonical
 * MPC designation (curated catalog, then SBDB) and fetches the body's live
 * heliocentric vector from JPL Horizons, reporting sector, AU coordinates and
 * SL distance. Accepts a prefill TrackTarget via router location state and
 * auto-tracks it once when an MPC id is provided. A shared link
 * (`?snap=…`) shows the shared position as-is, with a Refresh button.
 *
 * A planet or moon name (Europa, Titan, Lune…) is recognised as you type and
 * tracked directly with its Horizons id; "search asteroids and comets
 * instead" covers the asteroid that shares its name (52 Europa).
 */

type TrackerPhase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  /** `shared`: opened from a share link - the position on the sharer's day. */
  | { kind: 'ready'; result: TrackerResult; shared?: boolean }
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const proxyBase = resolveProxyBase();

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ObjectKind>('asteroid');
  const [phase, setPhase] = useState<TrackerPhase>({ kind: 'idle' });
  const [lockedMpcID, setLockedMpcID] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<readonly TrackedObject[]>([]);
  const [share, setShare] = useState<ShareContent | null>(null);
  /** The typed name is a planet / moon, but the user wants the asteroid or comet of that name. */
  const [smallBodyOnly, setSmallBodyOnly] = useState(false);

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

  // Leaving the page stops the request (it would otherwise finish in the
  // background and still write history).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      genRef.current += 1;
      // StrictMode re-runs effects after this cleanup: let the auto-track run again.
      autoTrackedRef.current = false;
    };
  }, []);

  const runTrack = (target: TrackTarget) => {
    if (proxyBase === null) return;
    if (searchParams.has('snap')) setSearchParams({}, { replace: true });
    abortRef.current?.abort();
    const gen = ++genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'loading' });
    void (async () => {
      try {
        const result = await track(proxyBase, target, catalog, controller.signal);
        if (gen !== genRef.current) return;
        void saveTrackerHistory(result);
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

  /** Puts a target back in the form (history, pin, link…). */
  const prefill = (name: string, trackKind: TrackKind, mpcID: string | null) => {
    setQuery(name);
    if (isMajorKind(trackKind)) {
      setLockedMpcID(null);
      setSmallBodyOnly(false);
    } else {
      setKind(trackKind);
      setLockedMpcID(mpcID);
      // An asteroid named like a moon (52 Europa) stays an asteroid.
      setSmallBodyOnly(findMajorBody(name) !== null);
    }
  };

  // A shared link wins; otherwise prefill + one-shot auto-track from
  // Discoveries / history / pin navigation. The router state is cleared once
  // used, so a reload or Back → Forward doesn't track again.
  useEffect(() => {
    if (autoTrackedRef.current) return;
    const shared = trackerFromSnapshot(searchParams.get('snap'));
    if (shared !== null) {
      autoTrackedRef.current = true;
      prefill(shared.displayName, shared.kind, shared.mpcID);
      setPhase({ kind: 'ready', result: shared, shared: true });
      return;
    }
    const state: unknown = location.state;
    if (!isTrackTarget(state)) return;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    const mpc =
      typeof state.mpcID === 'string' && state.mpcID.trim().length > 0 ? state.mpcID.trim() : null;
    prefill(state.name, state.kind, mpc);
    if (mpc !== null) {
      autoTrackedRef.current = true;
      runTrack(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onQueryChange = (value: string) => {
    setQuery(value);
    setSmallBodyOnly(false);
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

  /** The planet / moon / Sun the typed name means, unless the user asked for small bodies. */
  const major = useMemo(() => (smallBodyOnly ? null : findMajorBody(query)), [query, smallBodyOnly]);
  const majorNamed = smallBodyOnly ? findMajorBody(query) : null;

  const trackMajor = (body: MajorBody) => {
    if (body.type === 'star') {
      setPhase({ kind: 'errored', error: new TrackerSunError() });
      return;
    }
    runTrack({ name: body.name, kind: body.type === 'moon' ? 'moon' : 'planet', mpcID: majorBodyId(body) });
  };

  const trackFromInput = () => {
    if (major !== null) {
      trackMajor(major);
      return;
    }
    runTrack({ name: query, kind, mpcID: lockedMpcID ?? undefined });
  };

  const pins = useMemo(() => {
    return Array.from(favoriteIds)
      .map((id): { id: string; label: string; kind: TrackKind } => {
        const body = majorBodyFromId(id);
        if (body !== null) return { id, label: body.name, kind: body.type === 'moon' ? 'moon' : 'planet' };
        return resolvePin(catalog, id);
      })
      .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  }, [favoriteIds, catalog]);

  const suggestions = useMemo(() => {
    if (lockedMpcID !== null) return [];
    return catalogSuggestions(catalog, kind, query);
  }, [catalog, kind, query, lockedMpcID]);

  const majorSuggestions = useMemo(
    () => (lockedMpcID !== null || smallBodyOnly ? [] : majorBodySuggestions(query)),
    [query, lockedMpcID, smallBodyOnly],
  );

  const trackPin = (pin: { id: string; label: string; kind: TrackKind }) => {
    Haptics.tap();
    prefill(pin.label, pin.kind, pin.id);
    runTrack({ name: pin.label, kind: pin.kind, mpcID: pin.id });
  };

  const unpin = async (id: string, label: string) => {
    Haptics.selection();
    try {
      await toggleFavorite(TRACKER_FAVORITE_KIND, id);
      showSnackbar(`${label} unpinned.`, {
        action: {
          label: 'Undo',
          onClick: () => {
            void toggleFavorite(TRACKER_FAVORITE_KIND, id).catch(() =>
              showSnackbar("Couldn't pin it again.", { danger: true }),
            );
          },
        },
      });
    } catch {
      showSnackbar("Couldn't unpin.", { danger: true });
    }
  };

  const trackChoice = (choice: TrackChoice) => {
    Haptics.tap();
    prefill(choice.label, choice.kind, choice.mpcID);
    runTrack({ name: choice.label, kind: choice.kind, mpcID: choice.mpcID });
  };

  const refreshShared = (result: TrackerResult) => {
    Haptics.tap();
    runTrack({ name: result.displayName, kind: result.kind, mpcID: result.mpcID });
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
            prefill(result.displayName, result.kind, result.mpcID);
            close();
            runTrack({ name: result.displayName, kind: result.kind, mpcID: result.mpcID });
          }}
        >
          <div className={styles.rowCenter} style={{ gap: 12 }}>
            <span style={{ fontSize: 22 }}>{trackSymbol(result)}</span>
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

      <NetworkNotice
        tool="tracker"
        summary="Via a Cloudflare proxy to NASA JPL · nothing is sent until you tap Track"
        intro="This tool sends up to 5 GET requests to public NASA APIs (JPL Horizons + SBDB). Browsers can't call them directly (no CORS headers), so requests are relayed through a small Cloudflare Worker proxy. Nothing happens until you tap Track."
        rows={[
          ['Via:', 'A Cloudflare Worker proxy that forwards the request to NASA'],
          ['Endpoint:', 'ssd.jpl.nasa.gov + ssd-api.jpl.nasa.gov'],
          ['Sent:', 'An object name or designation'],
          ['Received:', 'A single heliocentric position vector'],
          ['Locally:', 'Sector (1-12), AU coordinates and distance in SL'],
          ['Your IP:', 'Seen by the Cloudflare proxy, not by NASA'],
          ['Stored:', 'Nothing sent to a server (tracks are saved locally)'],
        ]}
      />

      <GlassCard>
        <SectionHeader title="Target" icon={<IconCenterFocus size={18} />} />
        <input
          className={styles.textField}
          style={{ marginTop: 8 }}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Name (e.g. Ceres, Europa, C/2025 N1)"
          enterKeyHint="go"
          value={query}
          disabled={loading}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canTrack && proxyBase !== null) {
              e.preventDefault();
              trackFromInput();
            }
          }}
        />

        {major !== null && (
          <div className={styles.bodyHint} role="status">
            <span className={styles.bodyHintSymbol} aria-hidden="true">
              {majorBodySymbol(major)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.body}>
                <strong>{major.name}</strong> · {describeMajorBody(major)}
              </div>
              <div className={styles.caption} style={{ marginTop: 2 }}>
                {major.type === 'star'
                  ? 'The centre of the map: 0 SL, no sector.'
                  : 'Tracked directly with JPL Horizons (its own position, not its planet’s).'}
              </div>
              {major.type !== 'star' && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  disabled={loading}
                  onClick={() => setSmallBodyOnly(true)}
                >
                  Search asteroids and comets named “{query.trim()}” instead
                </button>
              )}
            </div>
          </div>
        )}
        {majorNamed !== null && (
          <div className={styles.caption} style={{ marginTop: 8 }}>
            Searching asteroids and comets only.{' '}
            <button
              type="button"
              className={styles.linkBtn}
              disabled={loading}
              onClick={() => setSmallBodyOnly(false)}
            >
              Track {majorNamed.name} ({describeMajorBodyInline(majorNamed)}) instead
            </button>
          </div>
        )}

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
                <span key={pin.id} className={styles.pinChip}>
                  <button
                    type="button"
                    className={styles.pinChipMain}
                    disabled={loading}
                    title={`Track ${pin.label}`}
                    onClick={() => trackPin(pin)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      void unpin(pin.id, pin.label);
                    }}
                  >
                    <span style={{ color: 'var(--accent-primary)', display: 'inline-flex' }}>
                      <IconPushPin size={11} />
                    </span>
                    {pin.label}
                  </button>
                  <button
                    type="button"
                    className={styles.pinChipRemove}
                    title={`Unpin ${pin.label}`}
                    aria-label={`Unpin ${pin.label}`}
                    onClick={() => void unpin(pin.id, pin.label)}
                  >
                    <IconClose size={12} />
                  </button>
                </span>
              ))}
            </div>
          </>
        )}

        {(majorSuggestions.length > 0 || suggestions.length > 0) && (
          <div className={styles.chipWrap} style={{ marginTop: 8 }}>
            {majorSuggestions.map((body) => (
              <button
                key={`jpl-${body.naif}`}
                type="button"
                className={styles.chip}
                disabled={loading}
                onClick={() => {
                  Haptics.selection();
                  onQueryChange(body.name);
                }}
              >
                {majorBodySymbol(body)} {body.name}
                {body.parent !== undefined && <span className={styles.chipNote}>{body.parent}</span>}
              </button>
            ))}
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
            disabled={loading || lockedMpcID !== null || major !== null}
          />
        </div>
      </GlassCard>

      {proxyBase === null ? null : (
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
          {phase.error instanceof TrackerAmbiguousError && (
            <>
              <div className={styles.chipWrap} style={{ marginTop: 10 }}>
                {phase.error.choices.map((choice) => (
                  <button
                    key={`${choice.kind}:${choice.mpcID}`}
                    type="button"
                    className={styles.chip}
                    onClick={() => trackChoice(choice)}
                  >
                    {KIND_EMOJI[choice.kind]} {choice.label}
                  </button>
                ))}
              </div>
              {phase.error.more > 0 && (
                <div className={styles.caption} style={{ marginTop: 8 }}>
                  …and {phase.error.more} more. Type a more precise name or the designation.
                </div>
              )}
            </>
          )}
        </GlassCard>
      )}

      {phase.kind === 'ready' && phase.shared === true && (
        <GlassCard>
          <div className={styles.rowCenter} style={{ gap: 10 }}>
            <span style={{ color: 'var(--accent-secondary)', display: 'inline-flex' }}>
              <IconShare size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.headline}>Shared position</div>
              <div className={styles.caption} style={{ marginTop: 2 }}>
                As of {dMonthYearHm(phase.result.timestamp)}. Objects move - refresh for today&apos;s.
              </div>
            </div>
            {proxyBase !== null && (
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={() => refreshShared(phase.result)}
              >
                <IconRefresh size={16} />
                Refresh
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {phase.kind === 'ready' && (
        <TrackResult
          result={phase.result}
          favoriteIds={favoriteIds}
          onTogglePin={togglePin}
          onShare={() => {
            Haptics.tap();
            setShare(trackerShare(phase.result));
          }}
        />
      )}

      <ShareSheet content={share} onClose={() => setShare(null)} />
    </ToolScaffold>
  );
}

function TrackResult({
  result,
  favoriteIds,
  onTogglePin,
  onShare,
}: {
  result: TrackerResult;
  favoriteIds: Set<string>;
  onTogglePin: (id: string) => void;
  onShare: () => void;
}) {
  const pinned = favoriteIds.has(result.mpcID);
  return (
    <GlassCard>
      <div className={styles.rowCenter}>
        <SectionHeader title="Position" icon={<IconPublic size={18} />} />
        <button
          type="button"
          className={styles.iconBtn}
          style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}
          title="Share"
          aria-label="Share this position"
          onClick={onShare}
        >
          <IconShare size={18} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          style={{ color: pinned ? 'var(--accent-primary)' : 'var(--text-dim)' }}
          title={pinned ? 'Remove favorite' : 'Pin object'}
          aria-label={pinned ? 'Remove favorite' : 'Pin object'}
          aria-pressed={pinned}
          onClick={() => onTogglePin(result.mpcID)}
        >
          {pinned ? <IconPushPin size={18} /> : <IconPushPinOutlined size={18} />}
        </button>
      </div>

      <div className={styles.rowCenter} style={{ gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 22 }}>{trackSymbol(result)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.headline}>{result.displayName}</div>
          <div className={styles.caption} style={{ marginTop: 2 }}>
            {trackDesignation(result)} · {dMonthYearHm(result.timestamp)}
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
        <InfoRow label="Map distance (AU)">
          <span className={styles.mono} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {result.distanceAU.toFixed(3)}
          </span>
        </InfoRow>
        <InfoRow label="From the Sun (AU, 3D)">
          <span className={styles.mono} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {distanceFromSunAU(result.xAU, result.yAU, result.zAU).toFixed(3)}
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
        <div className={styles.caption} style={{ marginTop: 6 }}>
          The game map is flat: sector, SL and map distance use X and Y only (Z is ignored).
        </div>
      </div>
    </GlassCard>
  );
}

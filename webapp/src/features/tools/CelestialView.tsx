import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import {
  IconExpandMore,
  IconExploreOff,
  IconInfoOutline,
  IconTrack,
  IconWarningAmber,
  IconWifiTethering,
} from '../../design-system/icons';
import { resolveProxyBase } from './nasa/jplClient';
import type { HistoryRow } from '../../data/db';
import { Haptics } from '../../core/haptics';
import { ToolScaffold } from './nasa/ui/ToolScaffold';
import { Divider, PillSegmented, Spinner } from './nasa/ui/kit';
import { BulletRow, HistorySheet } from './nasa/ui/viewKit';
import {
  IconEventNote,
  IconList,
  IconSchedule,
  IconStopCircle,
  IconTimer,
  IconTravelExplore,
} from './nasa/ui/toolIcons';
import { DiscoveriesHowItWorks } from './nasa/ui/howItWorks/DiscoveriesHowItWorks';
import { dMonthYear } from './nasa/ui/format';
import {
  expectedSeconds,
  isWideWindow,
  searchDiscoveries,
  windowDays,
  ymdLocal,
} from './nasa/discoveriesClient';
import { CelestialCancelledError, CelestialError, CelestialOfflineError } from './nasa/errors';
import {
  computeStatus,
  displayNameOf,
  KIND_EMOJI,
  statusEmoji,
  statusExplanation,
  statusLabel,
  trackingPeriodDays,
  type DiscoveredObject,
  type DiscoveryStatus,
  type ObjectKind,
} from './nasa/sbdb';
import { decodeDiscoveryEntry, saveDiscoveryHistory } from './nasa/history';
import type { TrackTarget } from './nasa/trackerClient';
import styles from './nasa/ui/nasa.module.css';

/**
 * /tools/discoveries - Celestial Discoveries (tools-live spec §5). One SBDB
 * bulk query per Search tap, filtered by object kind and a first-observation
 * date window; results are classified locally (status icons) and each opens a
 * detail sheet that can hand off to the Tracker.
 */

function yesterdayMidnight(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - 1);
  return d;
}

function todayMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function defaultStart(): Date {
  const d = yesterdayMidnight();
  d.setDate(d.getDate() - 10);
  return d;
}

function parseYmd(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m === null) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function kindPlural(kind: ObjectKind): string {
  return kind === 'comet' ? 'comets' : 'asteroids';
}

function kindLabel(kind: ObjectKind): string {
  return kind === 'comet' ? 'Comets' : 'Asteroids';
}

function statusColor(status: DiscoveryStatus): string {
  switch (status) {
    case 'ok':
      return 'var(--accent-success)';
    case 'caution':
      return 'var(--accent-warn)';
    case 'danger':
      return 'var(--accent-danger)';
    case 'unknown':
      return 'var(--text-secondary)';
  }
}

function DateChip({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value: Date;
  min: string;
  max: string;
  disabled: boolean;
  onChange: (d: Date) => void;
}) {
  return (
    <label className={`${styles.dateChip} ${disabled ? styles.dateChipDisabled : ''}`}>
      <span>{dMonthYear(value)}</span>
      <IconExpandMore size={16} />
      <input
        type="date"
        className={styles.dateInputOverlay}
        value={ymdLocal(value)}
        min={min}
        max={max}
        disabled={disabled}
        onClick={(e) => {
          // Chrome only opens the calendar from the indicator; force it here.
          e.currentTarget.showPicker?.();
        }}
        onChange={(e) => {
          const d = parseYmd(e.target.value);
          if (d !== null) onChange(d);
        }}
      />
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

const DISCOVERY_HISTORY_STRINGS = {
  title: 'Discoveries history',
  emptyTitle: 'No searches yet',
  errorTitle: "Couldn't load discoveries history",
  clearTitle: 'Delete all searches?',
  clearMessage: 'All saved searches will be removed.',
  deleteTitle: 'Delete search?',
} as const;

interface ResultMeta {
  kind: ObjectKind;
  startYmd: string;
  endYmd: string;
}

export function CelestialView() {
  const proxyBase = resolveProxyBase();

  const [kind, setKind] = useState<ObjectKind>('comet');
  const [startDate, setStartDate] = useState<Date>(() => defaultStart());
  const [endDate, setEndDate] = useState<Date>(() => yesterdayMidnight());
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DiscoveredObject[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [resultMeta, setResultMeta] = useState<ResultMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [detail, setDetail] = useState<DiscoveredObject | null>(null);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const maxYmd = ymdLocal(todayMidnight());
  const days = windowDays(startDate, endDate);
  const est = expectedSeconds(kind, days);
  const wide = isWideWindow(kind, days);
  const isHistorical = startDate.getFullYear() < 1900;

  const onStartChange = (d: Date) => {
    setStartDate(d);
    if (d.getTime() > endDate.getTime()) setEndDate(d);
  };
  const onEndChange = (d: Date) => {
    setEndDate(d);
    if (d.getTime() < startDate.getTime()) setStartDate(d);
  };

  const runSearch = async (base: string, input: ResultMetaInput, gen: number, signal: AbortSignal) => {
    try {
      const res = await searchDiscoveries(base, input, signal);
      // Save even 0-result searches, before the supersession check (spec §5.3).
      void saveDiscoveryHistory(input.kind, input.startDate, input.endDate, res.objects);
      if (gen !== genRef.current) return;
      setResults(res.objects);
      setTruncated(res.truncated);
      setResultMeta({
        kind: input.kind,
        startYmd: ymdLocal(input.startDate),
        endYmd: ymdLocal(input.endDate),
      });
      setIsSearching(false);
      if (res.objects.length === 0) Haptics.warning();
      else Haptics.success();
    } catch (e) {
      if (e instanceof CelestialCancelledError) {
        if (gen !== genRef.current) return;
        setIsSearching(false);
        return;
      }
      if (gen !== genRef.current) return;
      if (e instanceof CelestialError) {
        setResults(null);
        setResultMeta(null);
        setErrorMessage(e.message);
        setTimedOut(e instanceof CelestialOfflineError);
      } else {
        setResults(null);
        setResultMeta(null);
        setErrorMessage('Unexpected error.');
        setTimedOut(false);
      }
      setIsSearching(false);
      Haptics.warning();
    }
  };

  const search = () => {
    if (proxyBase === null) return;
    abortRef.current?.abort();
    const gen = ++genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setErrorMessage(null);
    setTimedOut(false);
    setTruncated(false);
    void runSearch(proxyBase, { kind, startDate, endDate }, gen, controller.signal);
  };

  const cancel = () => {
    Haptics.warning();
    abortRef.current?.abort();
    genRef.current += 1;
    setIsSearching(false);
  };

  const renderDiscoveryRow =
    (close: () => void) =>
    (row: HistoryRow): ReactNode => {
      const entry = decodeDiscoveryEntry(row);
      const count = entry.results.length;
      return (
        <GlassCard
          onTap={() => {
            setKind(entry.kind);
            setStartDate(entry.startDate);
            setEndDate(entry.endDate);
            close();
          }}
        >
          <div className={styles.rowCenter} style={{ gap: 12 }}>
            <span style={{ fontSize: 22 }}>{KIND_EMOJI[entry.kind]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.body}>{kindLabel(entry.kind)}</div>
              <div className={styles.caption} style={{ marginTop: 2 }}>
                {dMonthYear(entry.startDate)} → {dMonthYear(entry.endDate)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                className={styles.mono}
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)' }}
              >
                {count}
              </div>
              <div className={styles.caption}>hits</div>
            </div>
          </div>
        </GlassCard>
      );
    };

  const latency =
    kind === 'asteroid'
      ? 'Asteroid queries are slower than comet queries (the SBDB indexes millions of bodies). Timeout is set to 90 seconds.'
      : wide
        ? 'Wide windows return more rows. Timeout is 30 seconds; if you hit it, narrow the range.'
        : 'Comet queries return quickly. Timeout is 30 seconds.';
  const latencyTint = kind === 'asteroid' ? 'var(--accent-warn)' : 'var(--accent-primary)';

  return (
    <>
      <ToolScaffold
        title="Discoveries"
        historyTooltip="Search history"
        renderHowItWorks={() => <DiscoveriesHowItWorks />}
        renderHistory={(close) => (
          <HistorySheet
            kind="discovery"
            strings={DISCOVERY_HISTORY_STRINGS}
            onClose={close}
            renderRow={renderDiscoveryRow(close)}
          />
        )}
      >
        <TransmissionHeader label="ESSI · deep space discovery" />

        <GlassCard>
          <div className={styles.rowCenter} style={{ gap: 8 }}>
            <span style={{ color: 'var(--accent-warn)', display: 'inline-flex' }}>
              <IconWifiTethering size={18} />
            </span>
            <span className={styles.headline}>Network access required</span>
          </div>
          <div className={styles.caption} style={{ marginTop: 8 }}>
            This tool sends a single GET request to the NASA SBDB Query API. Browsers can&apos;t call it
            directly (no CORS headers), so the request is relayed through a small Cloudflare Worker
            proxy. Nothing happens until you tap Search.
          </div>
          <Divider alpha={0.4} margin="8px 0" />
          <BulletRow label="Via:" value="A Cloudflare Worker proxy that forwards the request to NASA" />
          <BulletRow label="Endpoint:" value="ssd-api.jpl.nasa.gov/sbdb_query.api" />
          <BulletRow label="Sent:" value="Object kind (comet or asteroid) + a date range" />
          <BulletRow label="Received:" value="JSON list of bodies matching the filter" />
          <BulletRow
            label="Locally:"
            value="Status icon + optional client-side date filter for pre-1900 dates"
          />
          <BulletRow label="Your IP:" value="Seen by the Cloudflare proxy, not by NASA" />
          <BulletRow
            label="Stored:"
            value="Nothing sent to a server (searches are saved locally on your device)"
          />
        </GlassCard>

        <GlassCard>
          <SectionHeader title="Query" icon={<IconEventNote size={18} />} />
          <div style={{ marginTop: 12 }}>
            <PillSegmented
              options={[
                { value: 'comet', label: 'Comets' },
                { value: 'asteroid', label: 'Asteroids' },
              ]}
              value={kind}
              onChange={setKind}
              disabled={isSearching}
            />
          </div>

          <div className={styles.dateRow} style={{ marginTop: 12 }}>
            <span className={styles.dateLabel}>Start</span>
            <span className={styles.spacer} />
            <DateChip
              value={startDate}
              min="1800-01-01"
              max={maxYmd}
              disabled={isSearching}
              onChange={onStartChange}
            />
          </div>
          <div className={styles.dateRow} style={{ marginTop: 8 }}>
            <span className={styles.dateLabel}>End</span>
            <span className={styles.spacer} />
            <DateChip
              value={endDate}
              min="1800-01-01"
              max={maxYmd}
              disabled={isSearching}
              onChange={onEndChange}
            />
          </div>

          <div className={styles.windowChip} style={{ marginTop: 8 }}>
            {ymdLocal(startDate)} → {ymdLocal(endDate)} · {days} {days === 1 ? 'day' : 'days'} (UTC)
          </div>

          <div className={styles.hintRow} style={{ marginTop: 8 }}>
            <span style={{ color: latencyTint, display: 'inline-flex', flex: 'none' }}>
              {kind === 'asteroid' || wide ? <IconTimer size={14} /> : <IconSchedule size={14} />}
            </span>
            <span>
              <span className={styles.hintText} style={{ color: latencyTint, display: 'block' }}>
                Estimated time: {est.lo} to {est.hi} seconds
              </span>
              <span className={styles.caption} style={{ display: 'block', marginTop: 2 }}>
                {latency}
              </span>
            </span>
          </div>

          {isHistorical && (
            <div className={styles.hintRow} style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--accent-warn)', display: 'inline-flex', flex: 'none' }}>
                <IconInfoOutline size={14} />
              </span>
              <span className={styles.caption}>
                Pre-1900 start dates trigger a broader query and a local filter. May take
                significantly longer.
              </span>
            </div>
          )}
        </GlassCard>

        {proxyBase === null ? null : (
          <GlassCard>
            {isSearching ? (
              <div className={styles.rowCenter} style={{ gap: 8 }}>
                <Spinner size={18} />
                <span
                  className={styles.mono}
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent-secondary)' }}
                >
                  Querying SBDB…
                </span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  style={{ marginLeft: 'auto', color: 'var(--accent-danger)' }}
                  title="Stop search"
                  aria-label="Stop search"
                  onClick={cancel}
                >
                  <IconStopCircle size={26} />
                </button>
              </div>
            ) : (
              <NeonButton title="Search" icon={<IconTravelExplore size={18} />} onPressed={search} />
            )}
          </GlassCard>
        )}

        {errorMessage !== null && (
          <GlassCard>
            <div className={styles.rowCenter} style={{ gap: 8 }}>
              <span style={{ color: 'var(--accent-danger)', display: 'inline-flex' }}>
                {timedOut ? <IconTimer size={18} /> : <IconWarningAmber size={18} />}
              </span>
              <span className={styles.body}>{errorMessage}</span>
            </div>
            {timedOut && (
              <div className={styles.caption} style={{ marginTop: 8 }}>
                Try narrowing the window, or shifting the dates so the query lands inside SBDB&apos;s
                indexed range.
              </div>
            )}
          </GlassCard>
        )}

        {results !== null && resultMeta !== null && (
          <>
            {results.length === 0 ? (
              <GlassCard>
                <div className={styles.rowCenter} style={{ gap: 8 }}>
                  <span style={{ color: 'var(--accent-warn)', display: 'inline-flex' }}>
                    <IconExploreOff size={18} />
                  </span>
                  <span className={styles.headline}>No matches</span>
                </div>
                <div className={styles.caption} style={{ marginTop: 8 }}>
                  No {kindPlural(resultMeta.kind)} were discovered between {resultMeta.startYmd} and{' '}
                  {resultMeta.endYmd}. Try a wider window or shift the dates.
                </div>
              </GlassCard>
            ) : (
              <GlassCard>
                <SectionHeader title={`Results · ${results.length}`} icon={<IconList size={18} />} />
                {truncated && (
                  <div
                    className={styles.banner}
                    style={{
                      marginTop: 8,
                      background: 'rgba(255, 179, 71, 0.1)',
                      border: '0.7px solid rgba(255, 179, 71, 0.5)',
                    }}
                  >
                    <span style={{ color: 'var(--accent-warn)', display: 'inline-flex', flex: 'none' }}>
                      <IconWarningAmber size={16} />
                    </span>
                    <span className={styles.caption} style={{ color: 'var(--accent-warn)' }}>
                      Results truncated - SBDB capped this reply at its row limit, so more matches
                      almost certainly exist. Narrow the date range for a complete list.
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {results.map((object, i) => (
                    <DiscoveryCard key={`${object.designation}-${i}`} object={object} onOpen={setDetail} />
                  ))}
                </div>
              </GlassCard>
            )}
          </>
        )}
      </ToolScaffold>

      {detail !== null && <DiscoveryDetail object={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

interface ResultMetaInput {
  kind: ObjectKind;
  startDate: Date;
  endDate: Date;
}

function DiscoveryCard({
  object,
  onOpen,
}: {
  object: DiscoveredObject;
  onOpen: (o: DiscoveredObject) => void;
}) {
  const status = computeStatus(object);
  const name = displayNameOf(object);
  return (
    <GlassCard onTap={() => onOpen(object)}>
      <div className={styles.rowCenter} style={{ gap: 12 }}>
        <span className={styles.statusBar} style={{ background: statusColor(status) }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.body}>{name}</div>
          <div
            className={styles.rowCenter}
            style={{ gap: 6, marginTop: 2, flexWrap: 'wrap' }}
          >
            <span style={{ fontSize: 12 }}>{KIND_EMOJI[object.kind]}</span>
            <span className={styles.mono} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {object.firstObs ?? '?'}
            </span>
            {object.diameterMeters !== undefined && (
              <span className={styles.mono} style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {object.diameterMeters.toFixed(1)} m
              </span>
            )}
            {object.isHazardous && (
              <span
                className={styles.mono}
                style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-danger)' }}
              >
                PHA
              </span>
            )}
          </div>
        </div>
        <span style={{ color: 'var(--accent-primary)', display: 'inline-flex', alignSelf: 'center' }}>
          <IconTrack size={18} />
        </span>
      </div>
    </GlassCard>
  );
}

/** Discovery detail bottom sheet (spec §5.7). */
function DiscoveryDetail({ object, onClose }: { object: DiscoveredObject; onClose: () => void }) {
  const navigate = useNavigate();
  const status = computeStatus(object);
  const name = displayNameOf(object);
  const days = trackingPeriodDays(object);

  const track = () => {
    const target: TrackTarget = { name, kind: object.kind, mpcID: object.designation };
    onClose();
    navigate('/tools/tracker', { state: target });
  };

  return (
    <>
      <div className={styles.sheetScrim} onClick={onClose} role="presentation" />
      <div className={styles.sheet} role="dialog" aria-label="Discovery">
        <div className={styles.sheetAppBar}>
          <button type="button" className={styles.sheetDone} onClick={onClose}>
            Close
          </button>
          <span className={styles.sheetTitle}>Discovery</span>
        </div>
        <div className={styles.sheetBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassCard>
            <div className={styles.rowCenter} style={{ gap: 12 }}>
              <span style={{ fontSize: 30 }}>{KIND_EMOJI[object.kind]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.headline}>{name}</div>
                <div className={styles.rowCenter} style={{ gap: 4, marginTop: 2 }}>
                  <span className={styles.mono} style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    MPC
                  </span>
                  <span className={styles.mono} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-secondary)' }}>
                    {object.designation}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className={styles.rowCenter} style={{ gap: 12 }}>
              <span style={{ fontSize: 28 }}>{statusEmoji(status)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: statusColor(status) }}>
                  {statusLabel(status)}
                </div>
                <div className={styles.caption} style={{ marginTop: 4 }}>
                  {statusExplanation(object)}
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Details" icon={<IconInfoOutline size={18} />} />
            <div style={{ marginTop: 8 }}>
              <InfoRow label="Kind" value={kindLabel(object.kind)} />
              <InfoRow label="Designation" value={object.designation} />
              {object.firstObs !== undefined && <InfoRow label="First obs." value={object.firstObs} />}
              {object.lastObs !== undefined && <InfoRow label="Last obs." value={object.lastObs} />}
              {days !== null && (
                <InfoRow label="Tracking" value={`${days} ${days === 1 ? 'day' : 'days'}`} />
              )}
              {object.kind === 'asteroid' && object.diameterMeters !== undefined && (
                <InfoRow label="Diameter" value={`${object.diameterMeters.toFixed(0)} m`} />
              )}
              {object.kind === 'asteroid' && object.albedo !== undefined && (
                <InfoRow label="Albedo" value={object.albedo.toFixed(3)} />
              )}
              {object.kind === 'asteroid' && (
                <InfoRow label="PHA flag" value={object.isHazardous ? 'Yes' : 'No'} />
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <NeonButton title="Track this object live" icon={<IconTrack size={18} />} onPressed={track} />
            <div className={styles.caption} style={{ marginTop: 8 }}>
              Opens the Tracker tool with this object pre-filled. Sends 1 GET to JPL Horizons.
            </div>
          </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { ModalLayer } from '../../design-system/components/ModalLayer';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import {
  IconExpandMore,
  IconExploreOff,
  IconInfoOutline,
  IconTrack,
  IconWarningAmber,
} from '../../design-system/icons';
import { resolveProxyBase } from './nasa/jplClient';
import type { HistoryRow } from '../../data/db';
import { Haptics } from '../../core/haptics';
import { ToolScaffold } from './nasa/ui/ToolScaffold';
import { NetworkNotice } from './nasa/ui/NetworkNotice';
import { PillSegmented, Spinner } from './nasa/ui/kit';
import { HistorySheet } from './nasa/ui/viewKit';
import {
  IconEventNote,
  IconList,
  IconSchedule,
  IconShare,
  IconStopCircle,
  IconTimer,
  IconTravelExplore,
} from './nasa/ui/toolIcons';
import { DiscoveriesHowItWorks } from './nasa/ui/howItWorks/DiscoveriesHowItWorks';
import { dMonthYear, dMonthYearHm } from './nasa/ui/format';
import {
  expectedSeconds,
  arrangeDiscoveries,
  isWideWindow,
  parseYmdInRange,
  statusCounts,
  type DiscoverySort,
  type StatusFilter,
  searchDiscoveries,
  windowDays,
  ymdLocal,
} from './nasa/discoveriesClient';
import { CelestialCancelledError, CelestialError, CelestialTimeoutError } from './nasa/errors';
import {
  computeStatus,
  displayNameOf,
  KIND_EMOJI,
  statusEmoji,
  statusExplanation,
  statusLabelOf,
  trackingPeriodDays,
  type DiscoveredObject,
  type DiscoveryStatus,
  type ObjectKind,
} from './nasa/sbdb';
import { decodeDiscoveryEntry, saveDiscoveryHistory } from './nasa/history';
import type { TrackTarget } from './nasa/trackerClient';
import {
  discoveriesListShare,
  discoveriesRoute,
  discoveryObjectShare,
  parseDiscoveriesParams,
  type DiscoveriesQuery,
} from './nasa/share';
import { ShareSheet } from './shared/ShareSheet';
import type { ShareContent } from './shared/shareActions';
import styles from './nasa/ui/nasa.module.css';

/**
 * /tools/discoveries - Celestial Discoveries (tools-live spec §5). One SBDB
 * bulk query per Search tap, filtered by object kind and a first-observation
 * date window; results are classified locally (status icons) and each opens a
 * detail sheet that can hand off to the Tracker.
 *
 * The last form and results live at module level, so Discoveries → Tracker →
 * Back finds them again, and the URL carries the last query
 * (`?kind=&from=&to=`): a shared link re-runs it, `&focus=` opens one object.
 */

/** Results render in pages (a pre-1900 search can return ~50 000 objects). */
const PAGE_SIZE = 100;

interface LastResults {
  query: DiscoveriesQuery;
  results: DiscoveredObject[];
  truncated: boolean;
  total: number | null;
}

/** Results reopened from the history: the objects saved then, read-only. */
interface SavedView {
  savedAt: Date;
  /** How many the search had found (the history keeps at most 200). */
  total: number;
}

const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'danger', label: '🔴 Hazardous' },
  { value: 'caution', label: '🟡 Caution' },
  { value: 'ok', label: '🟢 Normal' },
];

let lastForm: { kind: ObjectKind; startDate: Date; endDate: Date } | null = null;
let lastResults: LastResults | null = null;

function sameQuery(a: DiscoveriesQuery, b: DiscoveriesQuery): boolean {
  return (
    a.kind === b.kind &&
    ymdLocal(a.start) === ymdLocal(b.start) &&
    ymdLocal(a.end) === ymdLocal(b.end)
  );
}

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
  const ymd = ymdLocal(value);
  // What the field shows while typing: a year typed digit by digit passes
  // through 0002, 0020, 0202… which must not become the search date.
  const [draft, setDraft] = useState(ymd);
  useEffect(() => setDraft(ymd), [ymd]);
  return (
    <label className={`${styles.dateChip} ${disabled ? styles.dateChipDisabled : ''}`}>
      <span>{dMonthYear(value)}</span>
      <IconExpandMore size={16} />
      <input
        type="date"
        className={styles.dateInputOverlay}
        value={draft}
        min={min}
        max={max}
        disabled={disabled}
        onClick={(e) => {
          // Chrome only opens the calendar from the indicator; force it here.
          e.currentTarget.showPicker?.();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const d = parseYmdInRange(e.target.value, min, max);
          if (d !== null) onChange(d);
        }}
        // An unfinished or out-of-range entry goes back to the last valid date.
        onBlur={() => setDraft(ymd)}
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

export function CelestialView() {
  const proxyBase = resolveProxyBase();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initial state: a link's query, else the last form / results of this visit.
  const [initial] = useState(() => {
    const linked = parseDiscoveriesParams(searchParams);
    const cached =
      lastResults !== null && (linked === null || sameQuery(lastResults.query, linked)) ? lastResults : null;
    const form =
      linked !== null
        ? { kind: linked.kind, startDate: linked.start, endDate: linked.end }
        : (lastForm ?? { kind: 'comet' as ObjectKind, startDate: defaultStart(), endDate: yesterdayMidnight() });
    return { linked, cached, form };
  });

  const [kind, setKind] = useState<ObjectKind>(initial.form.kind);
  const [startDate, setStartDate] = useState<Date>(initial.form.startDate);
  const [endDate, setEndDate] = useState<Date>(initial.form.endDate);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DiscoveredObject[] | null>(initial.cached?.results ?? null);
  const [truncated, setTruncated] = useState(initial.cached?.truncated ?? false);
  const [resultMeta, setResultMeta] = useState<DiscoveriesQuery | null>(initial.cached?.query ?? null);
  const [total, setTotal] = useState<number | null>(initial.cached?.total ?? null);
  const [saved, setSaved] = useState<SavedView | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<DiscoverySort>('oldest');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [detail, setDetail] = useState<DiscoveredObject | null>(null);
  const [share, setShare] = useState<ShareContent | null>(null);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const focusRef = useRef<string | null>(initial.linked?.focus ?? null);

  useEffect(() => {
    lastForm = { kind, startDate, endDate };
  }, [kind, startDate, endDate]);

  // A link opens the object it names once its results are in.
  useEffect(() => {
    const focus = focusRef.current;
    if (focus === null || results === null) return;
    focusRef.current = null;
    const hit = results.find((o) => o.designation === focus);
    if (hit !== undefined) setDetail(hit);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

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
      void saveDiscoveryHistory(input.kind, input.startDate, input.endDate, res.objects, res.total ?? undefined);
      if (gen !== genRef.current) return;
      const query: DiscoveriesQuery = { kind: input.kind, start: input.startDate, end: input.endDate };
      lastResults = { query, results: res.objects, truncated: res.truncated, total: res.total };
      setResults(res.objects);
      setTruncated(res.truncated);
      setTotal(res.total);
      setSaved(null);
      setStatusFilter('all');
      setSortOrder('oldest');
      setResultMeta(query);
      setVisible(PAGE_SIZE);
      setIsSearching(false);
      // The URL keeps the query: Back from the Tracker, a reload or a shared
      // link find these results again.
      const route = discoveriesRoute(query);
      setSearchParams(new URLSearchParams(route.slice(route.indexOf('?') + 1)), { replace: true });
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
        setTimedOut(e instanceof CelestialTimeoutError);
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

  const search = (input: ResultMetaInput = { kind, startDate, endDate }) => {
    if (proxyBase === null) return;
    abortRef.current?.abort();
    const gen = ++genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setErrorMessage(null);
    setTimedOut(false);
    setTruncated(false);
    void runSearch(proxyBase, input, gen, controller.signal);
  };

  // A shared link runs its query (unless these results are already here).
  // Leaving the page stops the request.
  useEffect(() => {
    if (initial.linked !== null && initial.cached === null) {
      search({ kind: initial.linked.kind, startDate: initial.linked.start, endDate: initial.linked.end });
    }
    return () => {
      abortRef.current?.abort();
      genRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const count = entry.total;
      return (
        <GlassCard
          onTap={() => {
            // Show what was saved (works offline); "Search again" refreshes it.
            setKind(entry.kind);
            setStartDate(entry.startDate);
            setEndDate(entry.endDate);
            setResults(entry.results);
            setResultMeta({ kind: entry.kind, start: entry.startDate, end: entry.endDate });
            setTruncated(entry.total > entry.results.length);
            setTotal(entry.total > entry.results.length ? entry.total : null);
            setSaved({ savedAt: new Date(row.date), total: entry.total });
            setStatusFilter('all');
            setSortOrder('oldest');
            setVisible(PAGE_SIZE);
            setErrorMessage(null);
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

  // What the results card lists: one status (or all), in the chosen order.
  const counts = useMemo(() => statusCounts(results ?? []), [results]);
  const shown = useMemo(
    () => arrangeDiscoveries(results ?? [], statusFilter, sortOrder),
    [results, statusFilter, sortOrder],
  );

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

        <NetworkNotice
          tool="discoveries"
          summary="Via a Cloudflare proxy to NASA JPL · nothing is sent until you tap Search"
          intro="This tool sends a single GET request to the NASA SBDB Query API. Browsers can't call it directly (no CORS headers), so the request is relayed through a small Cloudflare Worker proxy. Nothing happens until you tap Search."
          rows={[
            ['Via:', 'A Cloudflare Worker proxy that forwards the request to NASA'],
            ['Endpoint:', 'ssd-api.jpl.nasa.gov/sbdb_query.api'],
            ['Sent:', 'Object kind (comet or asteroid) + a date range'],
            ['Received:', 'JSON list of bodies matching the filter'],
            ['Locally:', 'Status icon + optional client-side date filter for pre-1900 dates'],
            ['Your IP:', 'Seen by the Cloudflare proxy, not by NASA'],
            ['Stored:', 'Nothing sent to a server (searches are saved locally on your device)'],
          ]}
        />

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
            {ymdLocal(startDate)} → {ymdLocal(endDate)} · {days} {days === 1 ? 'day' : 'days'}
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
              <NeonButton title="Search" icon={<IconTravelExplore size={18} />} onPressed={() => search()} />
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
                  No {kindPlural(resultMeta.kind)} were discovered between {ymdLocal(resultMeta.start)} and{' '}
                  {ymdLocal(resultMeta.end)}. Try a wider window or shift the dates.
                </div>
              </GlassCard>
            ) : (
              <GlassCard>
                <div className={styles.rowCenter}>
                  <SectionHeader
                    title={
                      total !== null && total > results.length
                        ? `Results · ${results.length} of ${total}`
                        : `Results · ${results.length}`
                    }
                    icon={<IconList size={18} />}
                  />
                  <button
                    type="button"
                    className={styles.iconBtn}
                    style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}
                    title="Share"
                    aria-label="Share these results"
                    onClick={() => {
                      Haptics.tap();
                      setShare(discoveriesListShare(resultMeta, results, truncated));
                    }}
                  >
                    <IconShare size={18} />
                  </button>
                </div>
                {saved !== null && (
                  <div className={styles.banner} style={{ marginTop: 8 }}>
                    <span style={{ color: 'var(--accent-secondary)', display: 'inline-flex', flex: 'none' }}>
                      <IconSchedule size={16} />
                    </span>
                    <span className={styles.caption} style={{ flex: 1 }}>
                      Saved search from {dMonthYearHm(saved.savedAt)}
                      {saved.total > results.length
                        ? ` · the ${results.length} kept of ${saved.total} found.`
                        : '.'}
                    </span>
                    {proxyBase !== null && (
                      <button
                        type="button"
                        className={styles.refreshBtn}
                        disabled={isSearching}
                        onClick={() => {
                          Haptics.tap();
                          search({ kind: resultMeta.kind, startDate: resultMeta.start, endDate: resultMeta.end });
                        }}
                      >
                        Search again
                      </button>
                    )}
                  </div>
                )}
                {truncated && saved === null && (
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
                      {total !== null && total > results.length
                        ? `Showing the first ${results.length} of ${total} - SBDB caps a reply at ${results.length} rows. Narrow the date range for the complete list.`
                        : 'Results truncated - SBDB capped this reply at its row limit, so more matches almost certainly exist. Narrow the date range for a complete list.'}
                    </span>
                  </div>
                )}
                <div className={styles.chipWrap} style={{ marginTop: 10 }} role="group" aria-label="Filter by status">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      className={`${styles.chip} ${statusFilter === f.value ? styles.chipOn : ''}`}
                      aria-pressed={statusFilter === f.value}
                      disabled={f.value !== 'all' && counts[f.value] === 0}
                      onClick={() => {
                        setStatusFilter(f.value);
                        setVisible(PAGE_SIZE);
                      }}
                    >
                      {f.label} <span className={styles.chipNote}>{counts[f.value]}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.chipWrap} style={{ marginTop: 6 }} role="group" aria-label="Sort">
                  <span className={styles.caption} style={{ alignSelf: 'center' }}>
                    Sort:
                  </span>
                  {(resultMeta.kind === 'asteroid'
                    ? (['oldest', 'newest', 'largest'] as const)
                    : (['oldest', 'newest'] as const)
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.chip} ${sortOrder === value ? styles.chipOn : ''}`}
                      aria-pressed={sortOrder === value}
                      onClick={() => setSortOrder(value)}
                    >
                      {value === 'oldest' ? 'Oldest first' : value === 'newest' ? 'Newest first' : 'Largest first'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {shown.slice(0, visible).map((object, i) => (
                    <DiscoveryCard key={`${object.designation}-${i}`} object={object} onOpen={setDetail} />
                  ))}
                </div>
                {shown.length > visible && (
                  <button
                    type="button"
                    className={styles.showMoreBtn}
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  >
                    Show {Math.min(PAGE_SIZE, shown.length - visible)} more · {visible} of {shown.length} shown
                  </button>
                )}
              </GlassCard>
            )}
          </>
        )}
      </ToolScaffold>

      {detail !== null && (
        <DiscoveryDetail
          object={detail}
          onClose={() => setDetail(null)}
          onShare={
            resultMeta === null
              ? undefined
              : () => {
                  Haptics.tap();
                  setShare(discoveryObjectShare(detail, resultMeta));
                }
          }
        />
      )}

      <ShareSheet content={share} onClose={() => setShare(null)} />
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

/** Discovery detail bottom sheet (spec §5.7); a modal layer (Back / Escape close it). */
function DiscoveryDetail({
  object,
  onClose,
  onShare,
}: {
  object: DiscoveredObject;
  onClose: () => void;
  onShare?: () => void;
}) {
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
    <ModalLayer onClose={onClose}>
      <div className={styles.sheetScrim} onClick={onClose} role="presentation" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Discovery" tabIndex={-1}>
        <div className={styles.sheetAppBar}>
          <button type="button" className={styles.sheetDone} onClick={onClose}>
            Close
          </button>
          <span className={styles.sheetTitle}>Discovery</span>
          {onShare !== undefined && (
            <button
              type="button"
              className={styles.iconBtn}
              style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}
              title="Share"
              aria-label="Share this discovery"
              onClick={onShare}
            >
              <IconShare size={20} />
            </button>
          )}
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
                  {statusLabelOf(object)}
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
    </ModalLayer>
  );
}

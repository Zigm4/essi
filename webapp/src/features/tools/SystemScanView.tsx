import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { PageScrollView } from '../../design-system/components/PageScrollView';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { AppBackground } from '../../design-system/components/AppBackground';
import { ModalLayer } from '../../design-system/components/ModalLayer';
import {
  IconCheckCircle,
  IconChevronRight,
  IconPublic,
  IconTune,
  IconWarningAmber,
} from '../../design-system/icons';
import { resolveProxyBase } from './nasa/jplClient';
import type { HistoryRow } from '../../data/db';
import { ToolScaffold } from './nasa/ui/ToolScaffold';
import { NetworkNotice } from './nasa/ui/NetworkNotice';
import { Divider, PillBadge, Spinner, SquareSegmented } from './nasa/ui/kit';
import { PlanetGlyph } from './nasa/ui/PlanetGlyph';
import { HistorySheet } from './nasa/ui/viewKit';
import {
  IconCenterFocus,
  IconError,
  IconRadioUnchecked,
  IconRefresh,
  IconSchedule,
  IconShare,
  IconStopCircle,
} from './nasa/ui/toolIcons';
import { ScanHowItWorks } from './nasa/ui/howItWorks/ScanHowItWorks';
import { dMonthHm, dMonthYear, dMonthYearHm, dMonthYearHms, hms } from './nasa/ui/format';
import { PLANETS, searchSpanText, type PlanetSpec } from './nasa/planets';
import { fetchFull, fetchLight, INTER_REQUEST_DELAY_MS } from './nasa/scanClient';
import { ScanCancelledError, ScanError, ScanOfflineError, ScanUnparseableError } from './nasa/errors';
import type { PlanetPosition, ScanMode } from './nasa/models';
import { decodeScanEntry, saveScanHistory, type ScanEntry } from './nasa/history';
import { Haptics } from '../../core/haptics';
import { scanFromSnapshot, scanShare, type SharedScan } from './nasa/share';
import { ShareSheet } from './shared/ShareSheet';
import type { ShareContent } from './shared/shareActions';
import styles from './nasa/ui/nasa.module.css';

/**
 * /tools/scan - System Scan (tools-live spec §4). Fetches live heliocentric
 * planet positions from JPL Horizons (via the configured proxy) one at a time,
 * converts (X, Y) into the game's sector/SL grid, and - in Full mode - locates
 * each planet's next sector change. Errors surface verbatim per §4.9.
 * A shared link (`?snap=…`) shows the shared scan as-is, with a Refresh button.
 */

type PlanetRowStatus =
  | { kind: 'pending' }
  | { kind: 'ok'; position: PlanetPosition }
  | { kind: 'errored'; error: ScanError };

const MS_PER_DAY = 86_400_000;

const PLANET_BY_NAME = new Map<string, { spec: PlanetSpec; index: number }>(
  PLANETS.map((spec, index) => [spec.name, { spec, index }]),
);

function pendingRows(): PlanetRowStatus[] {
  return PLANETS.map(() => ({ kind: 'pending' }));
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new ScanCancelledError());
      },
      { once: true },
    );
  });
}

function statusLine(
  status: PlanetRowStatus,
  planet: PlanetSpec,
  full: boolean,
): { text: string; color: string } {
  if (status.kind === 'pending') return { text: 'pending', color: 'var(--text-dim)' };
  if (status.kind === 'errored') return { text: status.error.message, color: 'var(--accent-danger)' };
  const pos = status.position;
  if (pos.nextChange !== undefined) {
    const days = (pos.nextChange.date.getTime() - Date.now()) / MS_PER_DAY;
    const dateStr = days > 365 ? dMonthYear(pos.nextChange.date) : dMonthYearHm(pos.nextChange.date);
    // An old scan (history, shared link): the change already happened.
    if (days < 0) {
      return { text: `→ sector ${pos.nextChange.toSector} since ${dateStr}`, color: 'var(--text-dim)' };
    }
    const color =
      days <= 30
        ? 'var(--accent-success)'
        : days <= 365
          ? 'var(--accent-warn)'
          : 'var(--accent-danger)';
    return { text: `→ sector ${pos.nextChange.toSector} on ${dateStr}`, color };
  }
  // Full mode searched and found nothing: say so, or the row reads like Light mode.
  if (full) return { text: `No sector change within ${searchSpanText(planet)}`, color: 'var(--text-dim)' };
  return { text: hms(pos.timestamp), color: 'var(--text-dim)' };
}

function PlanetResultRow({
  planet,
  index,
  status,
  full,
  staticGlyph = false,
}: {
  planet: PlanetSpec;
  index: number;
  status: PlanetRowStatus;
  /** Rows of a Full scan (no next change found ≠ Light). */
  full: boolean;
  staticGlyph?: boolean;
}) {
  const line = statusLine(status, planet, full);
  return (
    <div className={styles.planetRow} style={{ opacity: status.kind === 'pending' ? 0.55 : 1 }}>
      <PlanetGlyph glyph={planet.glyph} hasRing={planet.hasRing} index={index} staticGlyph={staticGlyph} />
      <div className={styles.planetMain}>
        <div className={styles.planetName}>{planet.name}</div>
        <div className={styles.planetStatus} style={{ color: line.color }}>
          {line.text}
        </div>
      </div>
      <div className={styles.planetTrailing}>
        {status.kind === 'pending' && (
          <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
            <IconRadioUnchecked size={18} />
          </span>
        )}
        {status.kind === 'ok' && (
          <>
            <div className={styles.sectorRow}>
              <span className={styles.sectorLabel}>Sector</span>
              <span className={styles.sectorValue}>{status.position.sector}</span>
            </div>
            <div className={styles.slValue}>{status.position.distanceSL} SL</div>
          </>
        )}
        {status.kind === 'errored' && (
          <span style={{ color: 'var(--accent-danger)', display: 'inline-flex' }}>
            <IconError size={20} />
          </span>
        )}
      </div>
    </div>
  );
}

/** A read-only stack of OK planet rows (share/history detail). */
function SnapshotRows({ snapshots, mode }: { snapshots: PlanetPosition[]; mode: ScanMode }) {
  return (
    <>
      {snapshots.map((snapshot, i) => {
        const found = PLANET_BY_NAME.get(snapshot.name);
        const spec = found?.spec ?? PLANETS[0]!;
        const index = found?.index ?? 0;
        return (
          <div key={`${snapshot.name}-${i}`}>
            {i > 0 && <Divider alpha={0.3} margin="2px 0" />}
            <PlanetResultRow
              planet={spec}
              index={index}
              status={{ kind: 'ok', position: snapshot }}
              full={mode === 'full'}
              staticGlyph
            />
          </div>
        );
      })}
    </>
  );
}

const SCAN_HISTORY_STRINGS = {
  title: 'Scan history',
  emptyTitle: 'No scans yet',
  emptySubtitle: 'Run a scan from the Tools tab to populate history.',
  errorTitle: "Couldn't load scan history",
  clearTitle: 'Delete all scans?',
  clearMessage: "All saved scans will be removed. This can't be undone.",
  deleteTitle: 'Delete scan?',
} as const;

export function SystemScanView() {
  const proxyBase = resolveProxyBase();

  const [searchParams, setSearchParams] = useSearchParams();
  const [shared, setShared] = useState<SharedScan | null>(() => scanFromSnapshot(searchParams.get('snap')));
  const [mode, setMode] = useState<ScanMode>(() => shared?.mode ?? 'light');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<PlanetRowStatus[]>(pendingRows);
  /** The mode of the scan shown in the rows (the Mode control may have changed since). */
  const [rowsMode, setRowsMode] = useState<ScanMode>('light');
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null);
  const [detail, setDetail] = useState<{ date: Date; entry: ScanEntry } | null>(null);
  /** The last completed scan (what Share sends). */
  const [lastScan, setLastScan] = useState<SharedScan | null>(null);
  const [share, setShare] = useState<ShareContent | null>(null);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page stops the scan (it would otherwise keep calling JPL in
  // the background and still write history).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      genRef.current += 1;
    };
  }, []);

  const runScan = async (base: string, scanMode: ScanMode, gen: number, signal: AbortSignal) => {
    const now = new Date();
    const okSnapshots: PlanetPosition[] = [];
    let anyErrored = false;
    for (let i = 0; i < PLANETS.length; i++) {
      if (gen !== genRef.current) return;
      const idx = i;
      try {
        const position =
          scanMode === 'full'
            ? await fetchFull(base, PLANETS[idx]!, now, signal)
            : await fetchLight(base, PLANETS[idx]!, now, signal);
        if (gen !== genRef.current) return;
        setRows((r): PlanetRowStatus[] => r.map((row, j) => (j === idx ? { kind: 'ok', position } : row)));
        okSnapshots.push(position);
      } catch (e) {
        if (e instanceof ScanCancelledError) return;
        if (gen !== genRef.current) return;
        const error = e instanceof ScanError ? e : new ScanUnparseableError();
        // Offline / timed out (after the retries): the next planets would fail
        // the same way, 2 s each - stop here and mark them all.
        const stop = error instanceof ScanOfflineError;
        setRows((r): PlanetRowStatus[] =>
          r.map((row, j) => (j === idx || (stop && j > idx) ? { kind: 'errored', error } : row)),
        );
        anyErrored = true;
        if (stop) {
          setProgress(PLANETS.length);
          break;
        }
      }
      if (gen !== genRef.current) return;
      setProgress(idx + 1);
      if (idx < PLANETS.length - 1) {
        try {
          await abortableSleep(INTER_REQUEST_DELAY_MS, signal);
        } catch {
          return;
        }
      }
    }
    if (gen !== genRef.current) return;
    setIsScanning(false);
    setLastScannedAt(new Date());
    if (okSnapshots.length > 0) {
      setLastScan({ date: now, mode: scanMode, snapshots: okSnapshots });
      void saveScanHistory(scanMode, okSnapshots, anyErrored);
    }
  };

  const startScan = () => {
    if (proxyBase === null) return;
    abortRef.current?.abort();
    const gen = ++genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const scanMode = mode;
    if (shared !== null) {
      setShared(null);
      setSearchParams({}, { replace: true });
    }
    setLastScan(null);
    setRowsMode(scanMode);
    setRows(pendingRows());
    setProgress(0);
    setIsScanning(true);
    void runScan(proxyBase, scanMode, gen, controller.signal);
  };

  const cancelScan = () => {
    Haptics.warning();
    abortRef.current?.abort();
    genRef.current += 1;
    setIsScanning(false);
  };

  const renderScanRow =
    (close: () => void) =>
    (row: HistoryRow): ReactNode => {
      const entry = decodeScanEntry(row);
      const date = new Date(row.date);
      const count = entry.snapshots.length;
      return (
        <GlassCard
          onTap={() => {
            setDetail({ date, entry });
            close();
          }}
        >
          <div className={styles.rowCenter} style={{ gap: 12 }}>
            <span
              style={{
                color: row.errored ? 'var(--accent-warn)' : 'var(--accent-success)',
                display: 'inline-flex',
              }}
            >
              {row.errored ? <IconWarningAmber size={18} /> : <IconCheckCircle size={18} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.body}>{dMonthYearHms(date)}</div>
              <div className={styles.rowCenter} style={{ gap: 6, marginTop: 2 }}>
                <PillBadge text={entry.mode.toUpperCase()} />
                <span className={styles.caption}>{count === 1 ? '1 planet' : `${count} planets`}</span>
              </div>
            </div>
            <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}>
              <IconChevronRight size={20} />
            </span>
          </div>
        </GlassCard>
      );
    };

  const modeSummary =
    mode === 'light'
      ? 'Current sector and distance for each planet.'
      : 'Light data plus the next sector change for each planet (more API calls).';
  const estimate = mode === 'light' ? '≈ 10 to 20 seconds' : '≈ 45 to 120 seconds';

  return (
    <>
      <ToolScaffold
        title="System Scan"
        historyTooltip="Scan history"
        renderHowItWorks={() => <ScanHowItWorks />}
        renderHistory={(close) => (
          <HistorySheet
            kind="scan"
            strings={SCAN_HISTORY_STRINGS}
            onClose={close}
            renderRow={renderScanRow(close)}
          />
        )}
      >
        <TransmissionHeader label="ESSI · deep space monitoring" />

        <NetworkNotice
          tool="scan"
          summary="Via a Cloudflare proxy to NASA JPL · nothing is sent until you tap Scan now"
          intro="This is one of a few ESSI features that reach the network (System Scan, Tracker and Discoveries). Browsers can't call NASA's servers directly (they send no CORS headers), so the request is relayed through a small Cloudflare Worker proxy. Calls are made one at a time with a small gap, to stay under JPL Horizons' rate limit."
          rows={[
            ['Via:', 'A Cloudflare Worker proxy that forwards the request to NASA'],
            ['Endpoint:', 'ssd.jpl.nasa.gov/api/horizons.api'],
            ['Sent:', 'Planet codes (199-999) and the current UTC timestamp'],
            ['Received:', 'Public ephemeris text (X, Y, Z heliocentric vectors)'],
            ['Locally:', 'Sector (1-12) and distance in SL'],
            ['Your IP:', 'Seen by the Cloudflare proxy, not by NASA'],
            ['Stored:', 'Nothing sent to a server (scans are saved locally on your device)'],
          ]}
          footnote="This feature is opt-in: nothing happens until you tap Scan now."
        />

        <GlassCard>
          <SectionHeader title="Mode" icon={<IconTune size={18} />} />
          <div style={{ marginTop: 12 }}>
            <SquareSegmented
              options={[
                { value: 'light', label: 'Light' },
                { value: 'full', label: 'Full' },
              ]}
              value={mode}
              onChange={setMode}
              disabled={isScanning}
            />
          </div>
          <div className={styles.body} style={{ marginTop: 12 }}>
            {modeSummary}
          </div>
          <div className={styles.hintRow} style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--accent-warn)', display: 'inline-flex' }}>
              <IconSchedule size={12} />
            </span>
            <span className={styles.hintText} style={{ color: 'var(--accent-warn)' }}>
              Estimated time: {estimate}
            </span>
          </div>
        </GlassCard>

        {proxyBase === null ? null : (
          <GlassCard>
            {isScanning ? (
              <div className={styles.rowCenter} style={{ gap: 8 }}>
                <Spinner size={18} />
                <span
                  className={styles.mono}
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent-secondary)' }}
                >
                  Scanning… {progress}/9
                </span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  style={{ marginLeft: 'auto', color: 'var(--accent-danger)' }}
                  title="Stop scan"
                  aria-label="Stop scan"
                  onClick={cancelScan}
                >
                  <IconStopCircle size={26} />
                </button>
              </div>
            ) : (
              <>
                <NeonButton
                  title="Scan now"
                  icon={<IconCenterFocus size={18} />}
                  onPressed={startScan}
                />
                {lastScannedAt !== null && (
                  <div
                    className={styles.mono}
                    style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}
                  >
                    Last scan: {hms(lastScannedAt)} local
                  </div>
                )}
              </>
            )}
          </GlassCard>
        )}

        {shared !== null && (
          <GlassCard>
            <div className={styles.rowCenter} style={{ gap: 10 }}>
              <span style={{ color: 'var(--accent-secondary)', display: 'inline-flex' }}>
                <IconShare size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.headline}>Shared scan · {shared.mode.toUpperCase()}</div>
                <div className={styles.caption} style={{ marginTop: 2 }}>
                  As of {dMonthYearHm(shared.date)}. Planets move - refresh for now.
                </div>
              </div>
              {proxyBase !== null && (
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={() => {
                    Haptics.tap();
                    startScan();
                  }}
                >
                  <IconRefresh size={16} />
                  Refresh
                </button>
              )}
            </div>
          </GlassCard>
        )}

        <GlassCard>
          <div className={styles.rowCenter}>
            <SectionHeader title="Solar system snapshot" icon={<IconPublic size={18} />} />
            {!isScanning && (shared ?? lastScan) !== null && (
              <button
                type="button"
                className={styles.iconBtn}
                style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}
                title="Share"
                aria-label="Share this scan"
                onClick={() => {
                  const scan = shared ?? lastScan;
                  if (scan === null) return;
                  Haptics.tap();
                  setShare(scanShare(scan.date, scan.mode, scan.snapshots));
                }}
              >
                <IconShare size={18} />
              </button>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            {shared !== null ? (
              <SnapshotRows snapshots={shared.snapshots} mode={shared.mode} />
            ) : (
              PLANETS.map((planet, i) => (
                <div key={planet.name}>
                  {i > 0 && <Divider alpha={0.3} margin="2px 0" />}
                  <PlanetResultRow planet={planet} index={i} status={rows[i]!} full={rowsMode === 'full'} />
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </ToolScaffold>

      {detail !== null && (
        <ScanDetail
          date={detail.date}
          entry={detail.entry}
          onClose={() => setDetail(null)}
          onShare={() => {
            Haptics.tap();
            setShare(scanShare(detail.date, detail.entry.mode, detail.entry.snapshots));
          }}
        />
      )}

      <ShareSheet content={share} onClose={() => setShare(null)} />
    </>
  );
}

/** Full-screen scan history detail (spec §4.12); a modal layer (Back / Escape close it). */
function ScanDetail({
  date,
  entry,
  onClose,
  onShare,
}: {
  date: Date;
  entry: ScanEntry;
  onClose: () => void;
  onShare: () => void;
}) {
  return (
    <ModalLayer onClose={onClose}>
      <div
        className={styles.detailScrim}
        role="dialog"
        aria-modal="true"
        aria-label={`Scan of ${dMonthYearHms(date)}`}
        tabIndex={-1}
      >
        <AppBackground showsScanlines={false}>
          <div className={styles.page}>
            <div className={styles.appBar}>
              <button type="button" className={styles.sheetDone} onClick={onClose}>
                Close
              </button>
              <span className={styles.title}>{dMonthHm(date)}</span>
              <button
                type="button"
                className={styles.iconBtn}
                style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}
                title="Share"
                aria-label="Share this scan"
                onClick={onShare}
              >
                <IconShare size={20} />
              </button>
            </div>
            <PageScrollView padding="64px 12px 32px">
              <div className={styles.stack}>
                <GlassCard>
                  <SectionHeader title="Scan" icon={<IconCenterFocus size={18} />} />
                  <div className={styles.rowCenter} style={{ gap: 8, marginTop: 8 }}>
                    <span className={styles.body} style={{ flex: 1 }}>
                      {dMonthYearHms(date)}
                    </span>
                    <PillBadge text={entry.mode.toUpperCase()} style={{ padding: '3px 6px', letterSpacing: 1.5 }} />
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionHeader title="Snapshot" icon={<IconPublic size={18} />} />
                  <div style={{ marginTop: 12 }}>
                    <SnapshotRows snapshots={entry.snapshots} mode={entry.mode} />
                  </div>
                </GlassCard>
              </div>
            </PageScrollView>
          </div>
        </AppBackground>
      </div>
    </ModalLayer>
  );
}

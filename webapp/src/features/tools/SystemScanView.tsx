import { useRef, useState, type ReactNode } from 'react';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { PageScrollView } from '../../design-system/components/PageScrollView';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { AppBackground } from '../../design-system/components/AppBackground';
import {
  IconCheckCircle,
  IconChevronRight,
  IconPublic,
  IconTune,
  IconWarningAmber,
  IconWifiTethering,
} from '../../design-system/icons';
import { useSettingsStore } from '../../data/settings';
import type { HistoryRow } from '../../data/db';
import { ToolScaffold } from './nasa/ui/ToolScaffold';
import { Divider, PillBadge, Spinner, SquareSegmented } from './nasa/ui/kit';
import { PlanetGlyph } from './nasa/ui/PlanetGlyph';
import { BulletRow, HistorySheet, ProxyNotice } from './nasa/ui/viewKit';
import {
  IconCenterFocus,
  IconError,
  IconRadioUnchecked,
  IconSchedule,
  IconStopCircle,
} from './nasa/ui/toolIcons';
import { ScanHowItWorks } from './nasa/ui/howItWorks/ScanHowItWorks';
import { dMonthHm, dMonthYear, dMonthYearHm, dMonthYearHms, hms } from './nasa/ui/format';
import { PLANETS, type PlanetSpec } from './nasa/planets';
import { fetchFull, fetchLight, INTER_REQUEST_DELAY_MS } from './nasa/scanClient';
import { ScanCancelledError, ScanError, ScanUnparseableError } from './nasa/errors';
import type { PlanetPosition, ScanMode } from './nasa/models';
import { decodeScanEntry, saveScanHistory, type ScanEntry } from './nasa/history';
import { Haptics } from '../../core/haptics';
import styles from './nasa/ui/nasa.module.css';

/**
 * /tools/scan - System Scan (tools-live spec §4). Fetches live heliocentric
 * planet positions from JPL Horizons (via the configured proxy) one at a time,
 * converts (X, Y) into the game's sector/SL grid, and - in Full mode - locates
 * each planet's next sector change. Errors surface verbatim per §4.9.
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

function statusLine(status: PlanetRowStatus): { text: string; color: string } {
  if (status.kind === 'pending') return { text: 'pending', color: 'var(--text-dim)' };
  if (status.kind === 'errored') return { text: status.error.message, color: 'var(--accent-danger)' };
  const pos = status.position;
  if (pos.nextChange !== undefined) {
    const days = (pos.nextChange.date.getTime() - Date.now()) / MS_PER_DAY;
    const dateStr = days > 365 ? dMonthYear(pos.nextChange.date) : dMonthYearHm(pos.nextChange.date);
    const color =
      days <= 30
        ? 'var(--accent-success)'
        : days <= 365
          ? 'var(--accent-warn)'
          : 'var(--accent-danger)';
    return { text: `→ sector ${pos.nextChange.toSector} on ${dateStr}`, color };
  }
  return { text: hms(pos.timestamp), color: 'var(--text-dim)' };
}

function PlanetResultRow({
  planet,
  index,
  status,
  staticGlyph = false,
}: {
  planet: PlanetSpec;
  index: number;
  status: PlanetRowStatus;
  staticGlyph?: boolean;
}) {
  const line = statusLine(status);
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
function SnapshotRows({ snapshots }: { snapshots: PlanetPosition[] }) {
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
  const proxyBase = useSettingsStore((s) => s.jplProxyUrl).trim().replace(/\/+$/, '') || null;

  const [mode, setMode] = useState<ScanMode>('light');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<PlanetRowStatus[]>(pendingRows);
  const [lastScannedAt, setLastScannedAt] = useState<Date | null>(null);
  const [detail, setDetail] = useState<{ date: Date; entry: ScanEntry } | null>(null);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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
        setRows((r): PlanetRowStatus[] => r.map((row, j) => (j === idx ? { kind: 'errored', error } : row)));
        anyErrored = true;
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

        <GlassCard>
          <div className={styles.rowCenter} style={{ gap: 8 }}>
            <span style={{ color: 'var(--accent-warn)', display: 'inline-flex' }}>
              <IconWifiTethering size={18} />
            </span>
            <span className={styles.headline}>Network access required</span>
          </div>
          <div className={styles.caption} style={{ marginTop: 8 }}>
            This is one of a few ESSI features that reach the network (System Scan, Tracker and
            Discoveries). Calls are made one at a time with a small gap, to stay under JPL Horizons&apos;
            rate limit.
          </div>
          <Divider alpha={0.4} margin="8px 0" />
          <BulletRow label="Endpoint:" value="ssd.jpl.nasa.gov/api/horizons.api" />
          <BulletRow label="Sent:" value="Planet codes (199-999) and the current UTC timestamp" />
          <BulletRow label="Received:" value="Public ephemeris text (X, Y, Z heliocentric vectors)" />
          <BulletRow label="Locally:" value="Sector (1-12) and distance in SL" />
          <BulletRow label="To NASA:" value="Your IP address (like any web request)" />
          <BulletRow
            label="Stored:"
            value="Nothing sent to a server (scans are saved locally on your device)"
          />
          <div className={styles.caption} style={{ marginTop: 8 }}>
            This feature is opt-in: nothing happens until you tap Scan now.
          </div>
        </GlassCard>

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

        {proxyBase === null ? (
          <ProxyNotice />
        ) : (
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

        <GlassCard>
          <SectionHeader title="Solar system snapshot" icon={<IconPublic size={18} />} />
          <div style={{ marginTop: 12 }}>
            {PLANETS.map((planet, i) => (
              <div key={planet.name}>
                {i > 0 && <Divider alpha={0.3} margin="2px 0" />}
                <PlanetResultRow planet={planet} index={i} status={rows[i]!} />
              </div>
            ))}
          </div>
        </GlassCard>
      </ToolScaffold>

      {detail !== null && (
        <ScanDetail date={detail.date} entry={detail.entry} onClose={() => setDetail(null)} />
      )}
    </>
  );
}

/** Full-screen scan history detail (spec §4.12). */
function ScanDetail({ date, entry, onClose }: { date: Date; entry: ScanEntry; onClose: () => void }) {
  return (
    <div className={styles.detailScrim}>
      <AppBackground showsScanlines={false}>
        <div className={styles.page}>
          <div className={styles.appBar}>
            <button type="button" className={styles.sheetDone} onClick={onClose}>
              Close
            </button>
            <span className={styles.title}>{dMonthHm(date)}</span>
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
                  <SnapshotRows snapshots={entry.snapshots} />
                </div>
              </GlassCard>
            </div>
          </PageScrollView>
        </div>
      </AppBackground>
    </div>
  );
}

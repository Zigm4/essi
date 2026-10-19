import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../../design-system/components/GlassCard';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { friendlyError } from '../../core/errorText';
import { IconChevronRight } from '../../design-system/icons';
import { IconSchedule, IconSwapHoriz, IconTram } from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ToolScaffold } from './shared/ToolScaffold';
import { loadCatalog } from './shared/catalog';
import {
  consolidated,
  currentStop,
  isCurrentEntry,
  parseSchedule,
  rangeText,
  type ScheduleEntry,
  type TrainStop,
} from './mars-express/marsExpressService';
import { ZoneDetailSheet } from './mars-express/ZoneDetailSheet';
import styles from './mars-express/MarsExpress.module.css';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * /tools/mars-express - live schedule (spec §5.3, web-adapted). The zone alerts
 * of the native app were removed: a web page can't deliver scheduled
 * notifications once it is closed or backgrounded (no server push here).
 */
export function MarsExpressView() {
  const [stops, setStops] = useState<TrainStop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog<unknown>('train_schedule.json')
      .then((data) => {
        if (alive) setStops(parseSchedule(data));
      })
      .catch((e: unknown) => {
        if (alive) setError(friendlyError(e, "Couldn't load the schedule."));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ToolScaffold title="Mars Express">
      <div className={styles.stack}>
        <TransmissionHeader label="ESSI · transit operations" />
        {error !== null ? (
          <CenteredError message={error} />
        ) : stops === null ? (
          <CenteredSpinner />
        ) : (
          <MarsExpressContent stops={stops} />
        )}
      </div>
    </ToolScaffold>
  );
}

function MarsExpressContent({ stops }: { stops: TrainStop[] }) {
  const [now, setNow] = useState(() => new Date());
  const [sheetZone, setSheetZone] = useState<number | null>(null);

  // 5-second ticker (§5.3): keep `now` fresh; re-sync on window refocus (tab resume).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5_000);
    const onResume = () => setNow(new Date());
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, []);

  const minute = now.getMinutes();
  const current = currentStop(minute, stops);
  const entries = useMemo(() => consolidated(minute, stops), [minute, stops]);
  const wallTime = `${pad2(now.getHours())}:${pad2(minute)}`;

  return (
    <>
      {/* LIVE card */}
      <GlassCard>
        <div className={styles.liveRow}>
          <div className={styles.liveLeft}>
            <div className={styles.overline}>LIVE</div>
            {current !== null ? (
              <>
                <div className={styles.liveTitle}>{`Zone ${current.zone}`}</div>
                <div className={styles.liveCaption}>{current.name ?? 'Transit route'}</div>
              </>
            ) : (
              <div className={styles.liveTitle}>Idle</div>
            )}
          </div>
          <div className={styles.liveRight}>
            <div className={styles.liveMinute}>{`:${pad2(minute)}`}</div>
            <div className={styles.liveClock}>{wallTime}</div>
          </div>
        </div>
      </GlassCard>

      {/* Schedule card */}
      <GlassCard>
        <SectionHeader title="Schedule (next hour)" icon={<IconSchedule size={18} />} />
        <div className={styles.schedCaption}>Tap a row for zone details and the next arrivals.</div>
        {entries.map((entry) => (
          <ScheduleRow
            key={`${entry.zone}-${entry.startMinute}-${entry.nextHour ? 1 : 0}`}
            entry={entry}
            minute={minute}
            onTap={() => setSheetZone(entry.zone)}
          />
        ))}
      </GlassCard>

      <ZoneDetailSheet zone={sheetZone} stops={stops} onClose={() => setSheetZone(null)} />
    </>
  );
}

function ScheduleRow({
  entry,
  minute,
  onTap,
}: {
  entry: ScheduleEntry;
  minute: number;
  onTap: () => void;
}) {
  const current = isCurrentEntry(entry, minute);
  const named = entry.name !== null;
  return (
    <button
      type="button"
      className={`${styles.schedRow} ${current ? styles.schedRowCurrent : ''}`}
      onClick={onTap}
    >
      <span className={`${styles.schedRange} ${current ? styles.schedRangeCurrent : ''}`}>
        {rangeText(entry)}
      </span>
      <span className={`${styles.schedIcon} ${named ? styles.schedIconNamed : styles.schedIconTransit}`}>
        {named ? <IconTram size={16} /> : <IconSwapHoriz size={16} />}
      </span>
      <div className={styles.schedMid}>
        <div className={styles.schedZone}>{`Zone ${entry.zone}`}</div>
        <div className={styles.schedSub}>{entry.name ?? 'Transit'}</div>
      </div>
      <span className={styles.schedChevron}>
        <IconChevronRight size={18} />
      </span>
    </button>
  );
}

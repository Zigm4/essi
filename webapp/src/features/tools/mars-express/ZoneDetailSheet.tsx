import { useEffect, useState } from 'react';
import { BottomSheet } from '../shared/BottomSheet';
import { IconSchedule, IconTram } from '../shared/toolIcons';
import { minutesUntil, nameFor, zoneTiming, type TrainStop } from './marsExpressService';
import styles from './MarsExpress.module.css';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function clock(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Zone detail sheet: name, countdown and the next arrivals (spec §5.4,
 * web-adapted - no alerts). While the train is at the zone it says so, and
 * the countdown is to the next arrival after it leaves.
 */
export function ZoneDetailSheet({
  zone,
  stops,
  onClose,
}: {
  zone: number | null;
  stops: TrainStop[];
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={zone !== null}
      onClose={onClose}
      heightFraction={0.7}
      radius={22}
      ariaLabel="Zone details"
    >
      {zone !== null && <ZoneDetailContent key={zone} zone={zone} stops={stops} />}
    </BottomSheet>
  );
}

function ZoneDetailContent({ zone, stops }: { zone: number; stops: TrainStop[] }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(id);
  }, []);

  const { here, leavesAt, arrivals } = zoneTiming(zone, stops, now, 3);
  const next = arrivals[0];
  const zoneName = nameFor(zone, stops) ?? 'Transit route';

  return (
    <div className={styles.sheetStack}>
      <div>
        <div className={styles.zoneOverline}>{`Zone ${zone}`}</div>
        <div className={styles.zoneHeadline}>{zoneName}</div>
        {here && (
          <div className={styles.nextRow}>
            <IconTram size={20} />
            <span className={styles.hereNow}>Train here now</span>
            {leavesAt !== null && <span className={styles.nextCaption}>{`until ${clock(leavesAt)}`}</span>}
          </div>
        )}
        {next !== undefined && (
          <div className={styles.nextRow}>
            <IconTram size={20} />
            <span className={styles.nextCaption}>{here ? 'Back in' : 'Next arrival in'}</span>
            <span className={styles.nextMin}>{`${minutesUntil(next, now)} min`}</span>
          </div>
        )}
      </div>

      {arrivals.length > 0 && (
        <div>
          <div className={styles.arrivalsHead}>
            <IconSchedule size={18} />
            <span className={styles.arrivalsHeadline}>Next arrivals</span>
          </div>
          <div className={styles.arrivalsCaption}>{arrivals.map(clock).join('  ·  ')}</div>
        </div>
      )}
    </div>
  );
}

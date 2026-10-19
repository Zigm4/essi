import { useEffect, useState } from 'react';
import { BottomSheet } from '../shared/BottomSheet';
import { IconSchedule, IconTram } from '../shared/toolIcons';
import { nameFor, nextArrivals, nextOccurrences, type TrainStop } from './marsExpressService';
import styles from './MarsExpress.module.css';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Zone detail sheet: name, countdown and the next arrivals (spec §5.4, web-adapted - no alerts). */
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

  const arrivals = nextArrivals(zone, now.getMinutes(), stops);
  const minutesUntil = arrivals.length > 0 ? arrivals[0]! - now.getMinutes() : null;
  const zoneName = nameFor(zone, stops) ?? 'Transit route';
  const upcoming = nextOccurrences(zone, stops, 3, now);

  return (
    <div className={styles.sheetStack}>
      <div>
        <div className={styles.zoneOverline}>{`Zone ${zone}`}</div>
        <div className={styles.zoneHeadline}>{zoneName}</div>
        {minutesUntil !== null && (
          <div className={styles.nextRow}>
            <IconTram size={20} />
            <span className={styles.nextCaption}>Next arrival in</span>
            <span className={styles.nextMin}>{`${minutesUntil} min`}</span>
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div>
          <div className={styles.arrivalsHead}>
            <IconSchedule size={18} />
            <span className={styles.arrivalsHeadline}>Next arrivals</span>
          </div>
          <div className={styles.arrivalsCaption}>
            {upcoming.map((d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`).join('  ·  ')}
          </div>
        </div>
      )}
    </div>
  );
}

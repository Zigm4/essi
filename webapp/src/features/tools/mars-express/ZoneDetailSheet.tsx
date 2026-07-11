import { useEffect, useState } from 'react';
import { NeonButton } from '../../../design-system/components/NeonButton';
import { showSnackbar } from '../../../core/snackbar';
import { BottomSheet } from '../shared/BottomSheet';
import { Switch } from '../shared/Switch';
import {
  IconNotificationsActive,
  IconNotificationsOff,
  IconNotificationsOutlined,
  IconSchedule,
  IconTram,
} from '../shared/toolIcons';
import { nameFor, nextArrivals, type TrainStop } from './marsExpressService';
import { useTrainAlertStore } from './trainAlerts';
import styles from './MarsExpress.module.css';

/** Zone detail + alert-arming sheet (spec §5.4, web-adapted). */
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
      {zone !== null && <ZoneDetailContent key={zone} zone={zone} stops={stops} onClose={onClose} />}
    </BottomSheet>
  );
}

function ZoneDetailContent({
  zone,
  stops,
  onClose,
}: {
  zone: number;
  stops: TrainStop[];
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const entries = useTrainAlertStore((s) => s.entries);
  const arm = useTrainAlertStore((s) => s.arm);
  const cancelZone = useTrainAlertStore((s) => s.cancelZone);

  const entry = entries.find((e) => e.zone === zone);
  const armed = entry !== undefined;
  const [repeat, setRepeat] = useState(() => entry?.repeat ?? false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(id);
  }, []);

  const arrivals = nextArrivals(zone, now.getMinutes(), stops);
  const minutesUntil = arrivals.length > 0 ? arrivals[0]! - now.getMinutes() : null;
  const zoneName = nameFor(zone, stops) ?? 'Transit route';

  const onArm = async () => {
    const outcome = await arm(zone, stops, repeat);
    switch (outcome) {
      case 'armed':
        onClose();
        break;
      case 'permissionDenied':
        showSnackbar(
          'Notifications are turned off. Enable them for ESSI in system settings to arm alerts.',
          { danger: true },
        );
        break;
      case 'nothingToSchedule':
        showSnackbar(
          "The next arrival is too soon to schedule alerts. Try again once there's more time before it.",
          { danger: true },
        );
        break;
    }
  };

  const onCancel = () => {
    cancelZone(zone);
    onClose();
  };

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

      <div>
        <div className={styles.alertsHead}>
          <IconNotificationsOutlined size={18} />
          <span className={styles.alertsHeadline}>{armed ? 'Alert armed' : 'Local alerts'}</span>
        </div>
        <div className={styles.alertsCaption}>
          You'll get 3 notifications per arrival: 2 min before, 1 min before, and on arrival. You
          can arm several zones at once.
        </div>
        <div className={styles.webHint}>
          <IconSchedule size={12} />
          <span>Web build: alerts only fire while this tab stays open.</span>
        </div>

        <div className={styles.repeatRow}>
          <div className={styles.repeatMain}>
            <div className={styles.repeatTitle}>Repeat every hour</div>
            <div className={styles.repeatCaption}>
              Schedules the next 6 arrivals (up to ~6 h ahead). Reopen the app to extend further —
              alerts can only be scheduled while the app is running.
            </div>
          </div>
          <Switch checked={repeat} onChange={setRepeat} ariaLabel="Repeat every hour" />
        </div>

        <div className={styles.sheetButtons}>
          {armed ? (
            <>
              <NeonButton
                title="Update alert"
                icon={<IconNotificationsActive size={18} />}
                onPressed={() => void onArm()}
              />
              <NeonButton
                title="Cancel alerts"
                icon={<IconNotificationsOff size={18} />}
                danger
                onPressed={onCancel}
              />
            </>
          ) : (
            <NeonButton
              title="Set alert"
              icon={<IconNotificationsActive size={18} />}
              onPressed={() => void onArm()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../../design-system/components/GlassCard';
import { NeonButton } from '../../../design-system/components/NeonButton';
import { withAlpha } from '../../../design-system/color';
import { IconMap } from '../../../design-system/icons';
import { FavoriteButton } from '../shared/FavoriteButton';
import { ShareSheet } from '../shared/ShareSheet';
import type { ShareContent } from '../shared/shareActions';
import { IconIosShare } from '../shared/toolIcons';
import { depthFromName, zoneFactRows, type FishingZone } from './fishingData';
import { fishingZoneShare } from './fishingShare';
import styles from './Fishing.module.css';

/** Zone summary card (spec §4.4). */
export function ZoneSummaryCard({
  zone,
  showsZoneNumber,
  favorite,
}: {
  zone: FishingZone;
  showsZoneNumber: boolean;
  favorite: boolean;
}) {
  const navigate = useNavigate();
  const depth = depthFromName(zone.depth);
  const [share, setShare] = useState<ShareContent | null>(null);
  // Discord message, image or link (fishingZoneShare) - the same sheet as the NASA tools.
  const onShare = () => setShare(fishingZoneShare(zone, showsZoneNumber));

  return (
    <GlassCard>
      <div className={styles.zoneHeader}>
        <div className={styles.zoneNameCol}>
          {showsZoneNumber && <div className={styles.zoneNumber}>{`Zone ${zone.id}`}</div>}
          <div className={styles.zoneName}>{zone.name}</div>
        </div>
        <FavoriteButton
          kind="fishing_zone"
          id={String(zone.id)}
          active={favorite}
          size={22}
          tooltip="Star zone"
        />
        <button
          type="button"
          className={styles.zoneShare}
          aria-label="Share zone"
          title="Share zone"
          onClick={onShare}
        >
          <IconIosShare size={18} />
        </button>
        {depth !== null && (
          <span className={styles.zoneCircle} style={{ background: withAlpha(depth.color, 0.55) }} />
        )}
      </div>

      <div className={styles.zoneDivider} />

      {/* Same rows as the share card (zoneFactRows), so the image matches the card. */}
      {zoneFactRows(zone).map((row) => (
        <ZoneRow key={row.label} label={row.label} value={row.value} />
      ))}

      {zone.mapRef != null && (
        <NeonButton
          className={styles.viewMap}
          title="View on map"
          icon={<IconMap size={18} />}
          onPressed={() => {
            const { mapId, zoneId } = zone.mapRef!;
            navigate(`/knowledge/maps/${mapId}${zoneId !== undefined ? `?zone=${zoneId}` : ''}`);
          }}
        />
      )}

      <ShareSheet content={share} onClose={() => setShare(null)} />
    </GlassCard>
  );
}

function ZoneRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.zoneDetailRow}>
      <span className={styles.zoneDetailLabel}>{label}</span>
      <span className={styles.zoneDetailValue}>{value}</span>
    </div>
  );
}

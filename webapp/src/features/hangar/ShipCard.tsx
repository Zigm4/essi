import { useRef } from 'react';
import { Haptics } from '../../core/haptics';
import { GlassCard } from '../../design-system/components/GlassCard';
import { TagChip } from '../../design-system/components/TagChip';
import { IconShield, IconWarningAmber } from '../../design-system/icons';
import type { CatalogData } from './catalog';
import { IconPlace, IconPlus, IconRemove, IconVerified, RoleIcon } from './hangarIcons';
import { ROLE_DISPLAY } from './roles';
import { updateHull } from './shipRepository';
import {
  assignedRoles,
  hullTone,
  locationDisplay,
  modelLabel,
  type ShipModel,
} from './shipModel';
import styles from './hangar.module.css';

const HULL_TONE_VAR: Record<'success' | 'warn' | 'danger', string> = {
  success: 'var(--accent-success)',
  warn: 'var(--accent-warn)',
  danger: 'var(--accent-danger)',
};

const LONG_PRESS_MS = 500;

/** A single ship registry card (spec §5.3). */
export function ShipCard({
  model,
  catalog,
  onOpen,
  onDelete,
}: {
  model: ShipModel;
  catalog: CatalogData | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const entry = model.modelKey != null ? catalog?.modelByKey.get(model.modelKey) : undefined;
  const hullMax = entry?.hullMax ?? null;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startLongPress = () => {
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      onDelete();
    }, LONG_PRESS_MS);
  };

  const adjustHull = (delta: number) => {
    if (model.hull == null) return;
    let next = model.hull + delta;
    if (next < 0) next = 0;
    if (hullMax != null && next > hullMax) next = hullMax;
    if (next === model.hull) return;
    Haptics.selection();
    void updateHull(model.id, next);
  };

  const label = modelLabel(model, catalog);
  const location = locationDisplay(model, catalog);
  const roles = assignedRoles(model);

  const minusDisabled = (model.hull ?? 0) <= 0;
  const plusDisabled = hullMax != null && (model.hull ?? 0) >= hullMax;

  return (
    <div
      className={styles.cardWrap}
      role="button"
      tabIndex={0}
      aria-label={model.name.length > 0 ? model.name : '(unnamed)'}
      onClick={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        Haptics.tap();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      onPointerDown={startLongPress}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onPointerMove={clearTimer}
      onContextMenu={(e) => {
        e.preventDefault();
        onDelete();
      }}
    >
      <GlassCard>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderMain}>
            <span className={styles.shipName}>
              {model.name.length > 0 ? model.name : '(unnamed)'}
            </span>
            {label != null && <span className={styles.modelLabel}>{label}</span>}
          </div>
          {model.registered ? (
            <span className={`${styles.badge} ${styles.badgeOk}`}>
              <IconVerified size={14} />
              Registered
            </span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeWarn}`}>
              <IconWarningAmber size={14} />
              Unregistered
            </span>
          )}
        </div>

        {location != null && (
          <div className={styles.locationRow}>
            <span className={styles.rowIcon}>
              <IconPlace size={16} />
            </span>
            <span className={styles.locationText}>{location}</span>
          </div>
        )}

        {model.hull != null && (
          <div className={styles.hullRow}>
            <span className={styles.rowIcon}>
              <IconShield size={16} />
            </span>
            <span className={styles.hullLabel}>Hull </span>
            {hullMax != null ? (
              <span
                className={styles.hullValue}
                style={{ color: HULL_TONE_VAR[hullTone(model.hull, hullMax)] }}
              >
                {model.hull} / {hullMax}
              </span>
            ) : (
              <span className={styles.hullValue} style={{ color: 'var(--accent-secondary)' }}>
                {model.hull}
              </span>
            )}
            <span className={styles.hullSpacer} />
            <button
              type="button"
              className={styles.stepper}
              disabled={minusDisabled}
              aria-label="Decrease hull"
              onClick={(e) => {
                e.stopPropagation();
                adjustHull(-1);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <IconRemove size={16} />
            </button>
            <button
              type="button"
              className={styles.stepper}
              disabled={plusDisabled}
              aria-label="Increase hull"
              onClick={(e) => {
                e.stopPropagation();
                adjustHull(1);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <IconPlus size={16} />
            </button>
          </div>
        )}

        {roles.length > 0 && (
          <div className={styles.rolesBlock}>
            {roles.map(({ right, name }) => (
              <div className={styles.roleRow} key={right}>
                <span className={styles.roleIcon}>
                  <RoleIcon right={right} size={12} />
                </span>
                <span className={styles.roleName}>{ROLE_DISPLAY[right]}</span>
                <span className={styles.roleCrew}>{name}</span>
              </div>
            ))}
          </div>
        )}

        {model.tags.length > 0 && (
          <div className={styles.cardTags}>
            {model.tags.map((tag) => (
              <TagChip key={tag.id} label={tag.displayName} onTap={onOpen} />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormatException } from '../core/errors';
import { formatBytes } from '../core/formatBytes';
import { Haptics } from '../core/haptics';
import { logError } from '../core/logging';
import { showSnackbar } from '../core/snackbar';
import { db } from '../data/db';
import { describeImportSummary, importFromUserPick } from '../data/exportImport';
import { useSettingsStore } from '../data/settings';
import { resetToBuiltInMaps } from '../features/knowledge/maps/data/seedImporter';
import { GlassCard } from '../design-system/components/GlassCard';
import { ModalLayer } from '../design-system/components/ModalLayer';
import { SectionHeader } from '../design-system/components/SectionHeader';
import { SubPage } from '../design-system/components/SubPage';
import {
  IconCheckCircle,
  IconChevronRight,
  IconDataObject,
  IconDownload,
  IconGraphicEq,
  IconMap,
  IconReplay,
  IconSatelliteAlt,
  IconShield,
  IconSparkle,
  IconUpload,
} from '../design-system/icons';
import { runBackupExport } from './backupExport';
import styles from './SettingsView.module.css';

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleText}>
        <div className={styles.toggleTitle}>{title}</div>
        <div className={styles.toggleSubtitle}>{subtitle}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={title}
        className={`${styles.switch} ${value ? styles.switchOn : ''}`}
        onClick={() => onChange(!value)}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}

function ActionRow({
  label,
  icon,
  onTap,
}: {
  label: string;
  icon: ReactNode;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.actionRow}
      onClick={() => {
        Haptics.tap();
        onTap();
      }}
    >
      <span className={styles.actionIcon}>{icon}</span>
      {label}
      <span className={styles.actionChevron}>
        <IconChevronRight size={20} />
      </span>
    </button>
  );
}

/** Settings (/menu/settings) - app-shell spec §8. Auto-backup is hidden on web. */
export function SettingsView() {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const [mapsVersion, setMapsVersion] = useState<string | null>(null);
  const [mapsBytes, setMapsBytes] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refreshMapsInfo = useCallback(() => {
    void (async () => {
      try {
        const installed = await db.mapPacks.where('state').equals('installed').toArray();
        setMapsVersion(installed[0]?.contentVersion ?? null);
        const blobs = await db.mapBlobs.toArray();
        setMapsBytes(blobs.reduce((sum, b) => sum + b.data.size, 0));
      } catch (e) {
        logError(e);
        setMapsVersion(null);
        setMapsBytes(0);
      }
    })();
  }, []);

  useEffect(() => {
    refreshMapsInfo();
  }, [refreshMapsInfo]);

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Marks backed up only once the file is known to exist (cancel = nothing).
      await runBackupExport();
    } finally {
      setExporting(false);
    }
  };

  const onImport = async () => {
    try {
      const summary = await importFromUserPick();
      showSnackbar(describeImportSummary(summary));
    } catch (e) {
      showSnackbar(e instanceof FormatException ? e.message : 'Import failed', { danger: true });
    }
  };

  const onResetMaps = async () => {
    setConfirmReset(false);
    if (resetting) return;
    setResetting(true);
    try {
      const result = await resetToBuiltInMaps();
      if (result.kind === 'failed') {
        logError(result.error);
        showSnackbar(
          result.diskFull
            ? 'Could not reset maps: storage is full.'
            : 'Could not reset maps. Try again.',
          { danger: true },
        );
      } else {
        showSnackbar('Maps reset');
      }
    } catch (e) {
      logError(e);
      showSnackbar('Could not reset maps. Try again.', { danger: true });
    } finally {
      setResetting(false);
      refreshMapsInfo();
    }
  };

  return (
    <SubPage title="Settings">
      <GlassCard>
        <SectionHeader title="Feedback" icon={<IconGraphicEq size={18} />} />
        <div className={styles.cardStack}>
          <ToggleRow
            title="Haptic feedback"
            subtitle="Vibrations on tap, save, and selection."
            value={settings.hapticsEnabled}
            onChange={(v) => {
              settings.setHapticsEnabled(v);
              if (v) Haptics.tap();
            }}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Motion" icon={<IconSparkle size={18} />} />
        <div className={styles.cardStack}>
          <ToggleRow
            title="Animations"
            subtitle="Console reveals, particles, pulsing glows, blinking cursors and the boot intro typewriter."
            value={!settings.reduceAnimations}
            onChange={(v) => settings.setReduceAnimations(!v)}
          />
          <ToggleRow
            title="Fast boot"
            subtitle="Skip the boot intro and jump straight into the app on launch."
            value={settings.fastBoot}
            onChange={settings.setFastBoot}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Data" icon={<IconDataObject size={18} />} />
        <div className={styles.cardStack}>
          <div className={styles.caption}>
            Backup or move your data between devices using a JSON file.
          </div>
          <ActionRow
            label={exporting ? 'Exporting…' : 'Export…'}
            icon={<IconUpload size={18} />}
            onTap={() => {
              void onExport();
            }}
          />
          <ActionRow
            label="Import…"
            icon={<IconDownload size={18} />}
            onTap={() => {
              void onImport();
            }}
          />
          {/* Auto-backup toggle is mobile-only (Documents dir) - hidden on web. */}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Interactive maps" icon={<IconMap size={18} />} />
        <div className={styles.cardStack}>
          <div className={styles.caption}>
            The maps are built into ESSI and work offline. New maps come with app updates;
            nothing is downloaded on its own.
          </div>
          <div className={styles.infoLine}>
            Maps version: <span className={styles.infoValue}>{mapsVersion ?? 'none'}</span>
          </div>
          <div className={styles.mapsManageRow}>
            <div className={styles.infoLine}>
              Storage used:{' '}
              <span className={styles.infoValue}>
                {mapsBytes === null ? '…' : formatBytes(mapsBytes)}
              </span>
            </div>
            <button
              type="button"
              className={styles.resetButton}
              aria-label="Reset interactive maps"
              disabled={resetting}
              onClick={() => setConfirmReset(true)}
            >
              {resetting ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Intro" icon={<IconSatelliteAlt size={18} />} />
        <div className={styles.cardStack}>
          <div className={styles.caption}>
            Replay the incoming-transmission intro that explains ESSI, the tools and the
            privacy promise.
          </div>
          <ActionRow
            label="Replay intro"
            icon={<IconReplay size={18} />}
            onTap={() => navigate('/onboarding', { state: { replay: true } })}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="What stays on" icon={<IconShield size={18} />} />
        <div className={styles.cardStack}>
          {[
            'CRT scanlines and hex grid (static, no motion).',
            'Critical UI feedback (errors, save success).',
            'Save flash on edit (very brief, accessibility-safe).',
            'Static splash on launch.',
          ].map((line) => (
            <div key={line} className={styles.bulletRow}>
              <span className={styles.bulletIcon}>
                <IconCheckCircle size={14} />
              </span>
              <span className={styles.caption}>{line}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* A modal layer: the scrim, Back and Escape cancel; focus moves in and back. */}
      {confirmReset && (
        <ModalLayer onClose={() => setConfirmReset(false)}>
          <div className={styles.dialogScrim} onClick={() => setConfirmReset(false)} role="presentation">
            <div
              className={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              aria-label="Reset interactive maps?"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.dialogTitle}>Reset interactive maps?</div>
              <div className={styles.dialogBody}>
                This deletes the stored copy of the maps and sets up the built-in maps again. Use it
                if a map no longer opens. Your zone notes and favorites are kept.
              </div>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.dialogButton}
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dialogButton}
                  onClick={() => {
                    void onResetMaps();
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </ModalLayer>
      )}
    </SubPage>
  );
}

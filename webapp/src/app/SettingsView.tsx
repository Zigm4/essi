import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormatException } from '../core/errors';
import { friendlyError } from '../core/errorText';
import { formatBytes } from '../core/formatBytes';
import { Haptics } from '../core/haptics';
import { logError } from '../core/logging';
import { showSnackbar } from '../core/snackbar';
import { db } from '../data/db';
import { describeImportSummary, exportAndDownload, importFromUserPick } from '../data/exportImport';
import { useSettingsStore } from '../data/settings';
import { GlassCard } from '../design-system/components/GlassCard';
import { SectionHeader } from '../design-system/components/SectionHeader';
import { SubPage } from '../design-system/components/SubPage';
import {
  IconCheckCircle,
  IconChevronRight,
  IconDataObject,
  IconDownload,
  IconGraphicEq,
  IconMap,
  IconPublic,
  IconReplay,
  IconSatelliteAlt,
  IconShield,
  IconSparkle,
  IconUpload,
} from '../design-system/icons';
import styles from './SettingsView.module.css';

function ToggleRow({
  title,
  subtitle,
  value,
  disabled = false,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={`${styles.toggleRow} ${disabled ? styles.toggleRowDisabled : ''}`}>
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
        disabled={disabled}
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

const MAPS_LOCAL_STORAGE_KEYS = [
  'underdeck.maps.pointerEtag',
  'underdeck.maps.lastCheckAt',
  'underdeck.maps.seedImported',
  'underdeck.maps.seedImportedVersion',
];

/** Settings (/menu/settings) — app-shell spec §8. Auto-backup is hidden on web. */
export function SettingsView() {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const [mapsVersion, setMapsVersion] = useState<string | null>(null);
  const [mapsBytes, setMapsBytes] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
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
      await exportAndDownload();
      // Web download = synthetic success (never a dismissed share sheet).
      settings.markBackedUp();
    } catch (e) {
      showSnackbar(friendlyError(e, 'Export failed. Please try again.'), { danger: true });
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

  const onClearMaps = async () => {
    setConfirmClear(false);
    try {
      await db.transaction('rw', [db.mapPackFiles, db.mapPacks, db.mapBlobs], async () => {
        await db.mapPackFiles.clear();
        await db.mapPacks.clear();
        await db.mapBlobs.clear();
      });
      for (const key of MAPS_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
      refreshMapsInfo();
    } catch (e) {
      logError(e);
      showSnackbar('Could not clear maps. Try again.', { danger: true });
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
          {/* Auto-backup toggle is mobile-only (Documents dir) — hidden on web. */}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Interactive maps" icon={<IconMap size={18} />} />
        <div className={styles.cardStack}>
          <ToggleRow
            title="Download interactive maps"
            subtitle="Fetch new and updated maps from GitHub (Pages/Fastly + jsDelivr), at most once a day. Off keeps only what is already on your device."
            value={settings.mapsNetworkEnabled}
            onChange={settings.setMapsNetworkEnabled}
          />
          <ToggleRow
            title="Auto-update maps"
            subtitle="Automatically check for newer map content in the background. Turn off to update only when you choose."
            value={settings.mapsAutoUpdate}
            disabled={!settings.mapsNetworkEnabled}
            onChange={settings.setMapsAutoUpdate}
          />
          <div className={styles.infoLine}>
            Installed version: <span className={styles.infoValue}>{mapsVersion ?? 'none'}</span>
          </div>
          <div className={styles.mapsManageRow}>
            <div className={styles.infoLine}>
              Downloaded maps:{' '}
              <span className={styles.infoValue}>
                {mapsBytes === null ? '…' : formatBytes(mapsBytes)}
              </span>
            </div>
            <button
              type="button"
              className={styles.clearButton}
              aria-label="Clear downloaded maps"
              onClick={() => setConfirmClear(true)}
            >
              Clear
            </button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Network" icon={<IconPublic size={18} />} />
        <div className={styles.cardStack}>
          <div className={styles.caption}>
            JPL proxy URL — the System Scan, Discoveries and Tracker tools send their NASA
            requests through this proxy. Leave empty to disable those tools.
          </div>
          <input
            type="url"
            className={styles.proxyInput}
            placeholder="https://your-worker.example.workers.dev"
            aria-label="JPL proxy URL"
            value={settings.jplProxyUrl}
            onChange={(e) => settings.setJplProxyUrl(e.target.value)}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Intro" icon={<IconSatelliteAlt size={18} />} />
        <div className={styles.cardStack}>
          <div className={styles.caption}>
            Replay the incoming-transmission intro that explains Underdeck, the tools and the
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

      {confirmClear && (
        <div className={styles.dialogScrim}>
          <div className={styles.dialog} role="alertdialog" aria-label="Clear downloaded maps?">
            <div className={styles.dialogTitle}>Clear downloaded maps?</div>
            <div className={styles.dialogBody}>
              This frees up space by removing downloaded map content. The built-in sample map is
              restored, and maps re-download the next time you open them (if downloads are on).
            </div>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogButton}
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.dialogButton} ${styles.dialogDanger}`}
                onClick={() => {
                  void onClearMaps();
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </SubPage>
  );
}

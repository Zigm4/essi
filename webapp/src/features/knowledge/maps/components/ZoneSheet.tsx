/**
 * The single zone-detail surface (maps spec §16). A themed bottom sheet with a
 * full-screen tap-catcher behind it (tap outside clears the selection). Hosts
 * the live pin section (create/edit/delete via `pins.ts` → Dexie `mapPins`),
 * the schema-driven fields renderer, a favorite toggle and a share action.
 */

import { useState, type CSSProperties, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Haptics } from '../../../../core/haptics';
import { friendlyError } from '../../../../core/errorText';
import { logError } from '../../../../core/logging';
import { showSnackbar } from '../../../../core/snackbar';
import { FavoriteKind } from '../../../../data/db';
import { NeonButton } from '../../../../design-system/components/NeonButton';
import { IconClose, IconOpenInNew } from '../../../../design-system/icons';
import { FavoriteButton } from '../../../favorites/FavoriteButton';
import { useLiveQuery } from '../../../favorites/useLiveQuery';
import { IconPushPin } from '../../kbIcons';
import { getPin, savePin } from '../data/pins';
import { MAX_PIN_NOTE_LENGTH } from '../model/limits';
import { colorAlpha, colorCss, type MapTheme } from '../model/theme';
import type { MapDocument, MapZone, ZoneFieldSpec } from '../model/types';
import styles from './ZoneSheet.module.css';

interface ZoneSheetProps {
  readonly mapId: string;
  readonly doc: MapDocument;
  readonly zone: MapZone;
  readonly theme: MapTheme;
  readonly onClose: () => void;
}

export function ZoneSheet({ mapId, doc, zone, theme, onClose }: ZoneSheetProps) {
  const navigate = useNavigate();
  const accent = colorCss(theme.accent);
  const surfaceStyle: CSSProperties = {
    background: colorCss(theme.surface),
    borderTop: `1px solid ${colorAlpha(theme.zoneStroke, 0.35)}`,
    boxShadow: `0 -6px 24px ${colorAlpha(theme.glow, 0.18)}`,
  };

  return (
    <>
      <button
        type="button"
        className={styles.catcher}
        aria-label="Close zone details"
        onClick={onClose}
      />
      <section className={styles.sheet} style={surfaceStyle} role="dialog" aria-label={zone.name}>
        <span className={styles.handle} style={{ background: colorAlpha(theme.label, 0.25) }} />
        <div className={styles.header}>
          {zone.cellNum !== null && (
            <span
              className={styles.zoneNum}
              style={{ color: accent, borderColor: colorAlpha(theme.accent, 0.4), background: colorAlpha(theme.accent, 0.12) }}
              aria-label={`Zone number ${zone.cellNum}`}
            >
              {zone.cellNum}
            </span>
          )}
          <h2
            className={styles.name}
            style={{ color: colorCss(theme.label), fontFamily: `"${theme.fontFamily}", sans-serif` }}
          >
            {zone.name.length > 0 ? zone.name : 'Zone'}
          </h2>
          <FavoriteButton
            kind={FavoriteKind.mapZone}
            id={`${mapId}/${zone.id}`}
            tooltip="Favorite zone"
            activeColor={accent}
          />
          <button type="button" className={styles.iconBtn} title="Share zone" aria-label="Share zone"
            style={{ color: accent }} onClick={() => void shareZone(zone.name)}>
            <IconOpenInNew size={20} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Close"
            aria-label="Close"
            style={{ color: colorAlpha(theme.label, 0.7) }}
            onClick={onClose}
          >
            <IconClose size={22} />
          </button>
        </div>

        <div className={styles.body}>
          <PinSection mapId={mapId} zoneId={zone.id} theme={theme} />
          <ZoneFields
            schema={doc.fieldsSchema}
            fields={zone.fields}
            theme={theme}
            onOpenLink={(url) => openLink(url, navigate)}
          />
        </div>
      </section>
    </>
  );
}

// --- Pin section (§16.1 / §16.3) ---------------------------------------------

function PinSection({
  mapId,
  zoneId,
  theme,
}: {
  mapId: string;
  zoneId: string;
  theme: MapTheme;
}) {
  const pin = useLiveQuery(() => getPin(mapId, zoneId), [mapId, zoneId]);
  const note = pin.status === 'ready' && pin.data !== undefined ? pin.data.note : '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const accent = colorCss(theme.accent);
  const hasNote = note.trim().length > 0;

  const startEdit = (): void => {
    setDraft(note);
    setEditing(true);
  };

  const save = (): void => {
    setSaving(true);
    savePin(mapId, zoneId, draft)
      .then(() => {
        Haptics.success();
        setSaving(false);
        setEditing(false);
      })
      .catch((error: unknown) => {
        setSaving(false);
        logError(error);
        showSnackbar(friendlyError(error, "Couldn't save — please try again."), { danger: true });
      });
  };

  if (editing) {
    const dirty = draft.trim() !== note.trim();
    return (
      <div className={styles.pinEditor} style={{ borderColor: colorAlpha(theme.accent, 0.5) }}>
        <textarea
          className={styles.pinInput}
          value={draft}
          maxLength={MAX_PIN_NOTE_LENGTH}
          autoFocus
          placeholder="Your note for this zone…"
          style={{ color: colorCss(theme.label) }}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className={styles.pinActions}>
          <button type="button" className={styles.pinCancel} onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.pinSave}
            disabled={!dirty || saving}
            style={{ background: dirty ? accent : colorAlpha(theme.accent, 0.25), color: '#03060B' }}
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.pinRow}
      style={{ borderColor: hasNote ? colorAlpha(theme.accent, 0.5) : 'var(--border-subtle)' }}
      aria-label={hasNote ? 'Edit your note for this zone' : 'Add a note to this zone'}
      onClick={startEdit}
    >
      <span className={styles.pinIcon} style={{ color: hasNote ? accent : colorAlpha(theme.label, 0.5) }}>
        <IconPushPin size={18} />
      </span>
      {hasNote ? (
        <span className={styles.pinContent}>
          <span className={styles.pinLabel} style={{ color: accent }}>
            MY NOTE
          </span>
          <span className={styles.pinNote} style={{ color: colorCss(theme.label) }}>
            {note}
          </span>
        </span>
      ) : (
        <span className={styles.pinAdd} style={{ color: colorAlpha(theme.label, 0.75) }}>
          Add note / pin
        </span>
      )}
    </button>
  );
}

// --- Fields renderer (§16.2) -------------------------------------------------

function coerceScalar(value: unknown): string | null {
  if (typeof value === 'string') return value.length === 0 ? null : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function coerceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = coerceScalar(item);
    if (s !== null) out.push(s);
  }
  return out;
}

function ZoneFields({
  schema,
  fields,
  theme,
  onOpenLink,
}: {
  schema: readonly ZoneFieldSpec[];
  fields: Readonly<Record<string, unknown>>;
  theme: MapTheme;
  onOpenLink: (url: string) => void;
}) {
  const labelColor = colorAlpha(theme.label, 0.55);
  const valueColor = colorCss(theme.label);
  // Render strictly in schema order; drop fields with no renderable value (§16.2).
  const blocks: { key: string; label: string; node: ReactElement }[] = [];
  for (const spec of schema) {
    const node = renderField(spec, fields[spec.key], theme, valueColor, onOpenLink);
    if (node !== null) blocks.push({ key: spec.key, label: spec.label.toUpperCase(), node });
  }
  if (blocks.length === 0) return null;
  return (
    <div className={styles.fields}>
      {blocks.map((block) => (
        <div key={block.key} className={styles.field}>
          <span className={styles.fieldLabel} style={{ color: labelColor }}>
            {block.label}
          </span>
          {block.node}
        </div>
      ))}
    </div>
  );
}

function renderField(
  spec: ZoneFieldSpec,
  value: unknown,
  theme: MapTheme,
  valueColor: string,
  onOpenLink: (url: string) => void,
): ReactElement | null {
  const font = `"${theme.fontFamily}", sans-serif`;
  switch (spec.type) {
    case 'enum': {
      const s = coerceScalar(value);
      if (s === null) return null;
      return (
        <span
          className={styles.badge}
          style={{
            background: colorAlpha(theme.accent, 0.15),
            border: `1px solid ${colorAlpha(theme.accent, 0.5)}`,
            color: colorCss(theme.accent),
            fontFamily: font,
          }}
        >
          {s}
        </span>
      );
    }
    case 'number': {
      const s = coerceScalar(value);
      if (s === null) return null;
      return (
        <span className={styles.mono} style={{ color: valueColor }}>
          {spec.unit !== null ? `${s} ${spec.unit}` : s}
        </span>
      );
    }
    case 'stringList': {
      const list = coerceList(value);
      if (list.length === 0) return null;
      return (
        <ul className={styles.list}>
          {list.map((item, i) => (
            <li key={i} className={styles.listItem} style={{ color: valueColor }}>
              <span className={styles.bullet} style={{ background: colorCss(theme.accent) }} />
              {item}
            </li>
          ))}
        </ul>
      );
    }
    case 'longText': {
      const s = coerceScalar(value);
      if (s === null) return null;
      return (
        <p className={styles.paragraph} style={{ color: valueColor }}>
          {s}
        </p>
      );
    }
    case 'link': {
      const s = coerceScalar(value);
      if (s === null) return null;
      return (
        <div className={styles.linkWrap}>
          <NeonButton title={spec.label} icon={<IconOpenInNew size={18} />} onPressed={() => onOpenLink(s)} />
        </div>
      );
    }
    case 'text': {
      const s = coerceScalar(value);
      if (s === null) return null;
      return (
        <span className={styles.text} style={{ color: valueColor }}>
          {s}
        </span>
      );
    }
    case 'unknown': {
      const s = coerceScalar(value); // scalar → plain text; structured → nothing
      if (s === null) return null;
      return (
        <span className={styles.text} style={{ color: valueColor }}>
          {s}
        </span>
      );
    }
  }
}

// --- Link + share helpers ----------------------------------------------------

function openLink(url: string, navigate: (to: string) => void): void {
  const trimmed = url.trim();
  if (trimmed.startsWith('underdeck://map/')) {
    const rest = trimmed.slice('underdeck://map/'.length);
    const [idPart, queryPart] = rest.split('?');
    const id = decodeURIComponent(idPart);
    let target = `/knowledge/maps/${encodeURIComponent(id)}`;
    const zone = new URLSearchParams(queryPart ?? '').get('zone');
    if (zone !== null && zone.length > 0) target += `?zone=${encodeURIComponent(zone)}`;
    navigate(target);
    return;
  }
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    window.open(trimmed, '_blank', 'noopener');
  }
}

async function shareZone(zoneName: string): Promise<void> {
  Haptics.tap();
  const text = `ESSI map · ${zoneName}`;
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: zoneName, text });
    } else if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      showSnackbar('Copied to clipboard');
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return; // user cancelled
    logError(error);
  }
}

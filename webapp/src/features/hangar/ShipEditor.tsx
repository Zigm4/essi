import { useRef, useState, type ReactNode } from 'react';
import { Haptics } from '../../core/haptics';
import { friendlyError } from '../../core/errorText';
import { showSnackbar } from '../../core/snackbar';
import { GlassCard } from '../../design-system/components/GlassCard';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { IconExpandMore, IconShield, IconShieldMoon, IconTag } from '../../design-system/icons';
import {
  CATEGORY_ORDER,
  CUSTOM_LOCATION_KEY,
  EVIL,
  availableRoles,
  hasPrefix,
  isEvilEntry,
  useCatalogs,
  type CatalogData,
  type ShipCatalogEntry,
} from './catalog';
import {
  IconDirectionsBoat,
  IconGroups,
  IconNotesLines,
  IconPlace,
} from './hangarIcons';
import { ROLE_DISPLAY, SHIP_RIGHTS, roleHint, type ShipRight } from './roles';
import {
  composedName,
  extractSuffix,
  type ShipDraft,
  type ShipModel,
} from './shipModel';
import { deleteShip, saveShip, useAllTags } from './shipRepository';
import { PickerSheet, type PickerGroup } from './PickerSheet';
import { TagInputField, type TagInputHandle } from './TagInputField';
import { EvilShipIntro } from './EvilShipIntro';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './hangar.module.css';

const EVIL_SEEN_KEY = 'underdeck.hangar.evilIntroSeen';

function evilIntroSeen(): boolean {
  try {
    return localStorage.getItem(EVIL_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function markEvilIntroSeen(): void {
  try {
    localStorage.setItem(EVIL_SEEN_KEY, 'true');
  } catch {
    /* ignore */
  }
}

function parseIntOrNull(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number.parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

function digitsOnly(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

interface Fields {
  nameField: string;
  suffixField: string;
  customModelField: string;
  registered: boolean;
  modelKey: string | null;
  locationKey: string | null;
  zoneField: string;
  sectorField: string;
  slField: string;
  customLocationField: string;
  hullField: string;
  noteField: string;
  roles: Record<ShipRight, string>;
  tags: string[];
}

function emptyRoleFields(): Record<ShipRight, string> {
  const out = {} as Record<ShipRight, string>;
  for (const r of SHIP_RIGHTS) out[r] = '';
  return out;
}

function serialize(f: Fields): string {
  return JSON.stringify({
    nameField: f.nameField,
    suffixField: f.suffixField,
    customModelField: f.customModelField,
    registered: f.registered,
    modelKey: f.modelKey,
    locationKey: f.locationKey,
    zoneField: f.zoneField,
    sectorField: f.sectorField,
    slField: f.slField,
    customLocationField: f.customLocationField,
    hullField: f.hullField,
    noteField: f.noteField,
    roles: SHIP_RIGHTS.map((r) => f.roles[r]),
    tags: f.tags,
  });
}

function initialFields(initial: ShipModel | null, catalog: CatalogData): Fields {
  const roles = emptyRoleFields();
  if (initial != null) {
    for (const r of SHIP_RIGHTS) roles[r] = initial.roles[r] ?? '';
  }
  const entry =
    initial?.modelKey != null ? catalog.modelByKey.get(initial.modelKey) : undefined;
  const suffixField =
    initial != null && entry != null && hasPrefix(entry)
      ? extractSuffix(initial.name, entry.prefix ?? '')
      : '';
  return {
    nameField: initial?.name ?? '',
    suffixField,
    customModelField: initial?.customModelLabel ?? '',
    registered: initial?.registered ?? false,
    modelKey: initial?.modelKey ?? null,
    locationKey: initial?.locationKey ?? null,
    zoneField: initial?.locationZone != null ? String(initial.locationZone) : '',
    sectorField: initial?.locationSector ?? '',
    slField: initial?.locationSL != null ? String(initial.locationSL) : '',
    customLocationField: initial?.customLocation ?? '',
    hullField: initial?.hull != null ? String(initial.hull) : '',
    noteField: initial?.note ?? '',
    roles,
    tags: initial != null ? initial.tags.map((t) => t.displayName) : [],
  };
}

// --- Small presentational helpers -------------------------------------------

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.labeledField}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function EditorSheet({
  title,
  leading,
  trailing,
  onBackdrop,
  children,
}: {
  title: string;
  leading: ReactNode;
  trailing: ReactNode;
  onBackdrop: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.editorRoot}>
      <button
        type="button"
        className={styles.editorScrim}
        aria-label="Close editor"
        onClick={onBackdrop}
      />
      <div className={styles.editorPanel} role="dialog" aria-label={title}>
        <div className={styles.editorAppBar}>
          <span className={styles.editorLeading}>{leading}</span>
          <span className={styles.editorTitle}>{title}</span>
          <span className={styles.editorTrailing}>{trailing}</span>
        </div>
        <div className={styles.editorBody}>{children}</div>
      </div>
    </div>
  );
}

// --- Editor outer: waits for catalogs (spec §13) ----------------------------

export function ShipEditor({
  initial,
  onClose,
}: {
  initial: ShipModel | null;
  onClose: () => void;
}) {
  const catalog = useCatalogs();
  const title = initial != null ? 'Edit ship' : 'New ship';

  if (catalog.status !== 'ready') {
    return (
      <EditorSheet
        title={title}
        onBackdrop={onClose}
        leading={
          <button type="button" className={styles.editorCancel} onClick={onClose}>
            Cancel
          </button>
        }
        trailing={<span className={styles.editorSaveDisabled}>Save</span>}
      >
        {catalog.status === 'loading' ? (
          <div className={styles.editorCentered}>
            <span className={styles.spinner} aria-label="Loading" />
          </div>
        ) : (
          <div className={styles.editorCentered}>
            <span className={styles.catalogError}>Couldn't load the ship catalog.</span>
          </div>
        )}
      </EditorSheet>
    );
  }

  return <ShipEditorForm initial={initial} catalog={catalog.data} onClose={onClose} />;
}

// --- Editor form: catalog is ready ------------------------------------------

type IntroState = { open: false } | { open: true; mode: 'select' | 'replay'; key: string };

function ShipEditorForm({
  initial,
  catalog,
  onClose,
}: {
  initial: ShipModel | null;
  catalog: CatalogData;
  onClose: () => void;
}) {
  const tagsState = useAllTags();
  const tagPool = tagsState.status === 'ok' ? tagsState.data.map((t) => t.displayName) : [];

  const [fields, setFields] = useState<Fields>(() => initialFields(initial, catalog));
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const baselineRef = useRef<string>(serialize(initialFields(initial, catalog)));

  const editingEvil =
    initial?.modelKey != null && isEvilEntry(catalog.modelByKey.get(initial.modelKey));
  const [evilPlayed, setEvilPlayed] = useState<boolean>(editingEvil);
  const [intro, setIntro] = useState<IntroState>(
    editingEvil && initial?.modelKey != null
      ? { open: true, mode: 'replay', key: initial.modelKey }
      : { open: false },
  );

  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const tagHandleRef = useRef<TagInputHandle | null>(null);

  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  const entry = fields.modelKey != null ? catalog.modelByKey.get(fields.modelKey) : undefined;
  const prefixed = entry != null && hasPrefix(entry);
  const isEvil = isEvilEntry(entry);
  const locEntry =
    fields.locationKey != null ? catalog.locationByKey.get(fields.locationKey) : undefined;

  const name = composedName(fields, catalog.modelByKey);
  const dirty = serialize(fields) !== baselineRef.current;
  const saveEnabled = name.trim().length > 0;

  // --- EVIL helpers ---------------------------------------------------------

  const applyEvilDefaults = (base: Fields, evilKey: string): Fields => ({
    ...base,
    modelKey: evilKey,
    registered: true,
    locationKey: EVIL.defaultLocationKey,
    customLocationField: '',
    zoneField: '',
    sectorField: '',
    slField: '',
    nameField: EVIL.identifier,
    suffixField: EVIL.instanceNumber,
    roles: emptyRoleFields(),
  });

  const commitEvilSelection = (evilKey: string) => {
    const next = applyEvilDefaults(fieldsRef.current, evilKey);
    setFields(next);
    baselineRef.current = serialize(next); // re-baseline after EVIL defaults (spec §6.2b)
    setEvilPlayed(true);
  };

  // --- Model / location changes (spec §6.5) ---------------------------------

  const onPickModel = (newKey: string | null) => {
    setModelPickerOpen(false);
    const newEntry = newKey != null ? catalog.modelByKey.get(newKey) : undefined;

    if (newEntry != null && isEvilEntry(newEntry) && newKey != null) {
      if (evilIntroSeen()) {
        commitEvilSelection(newKey);
      } else {
        Haptics.warning();
        setIntro({ open: true, mode: 'select', key: newKey });
      }
      return;
    }

    const f = fieldsRef.current;
    const newPrefix = newEntry != null && hasPrefix(newEntry) ? (newEntry.prefix ?? '') : null;
    if (newPrefix != null) {
      set({ modelKey: newKey, suffixField: extractSuffix(f.nameField.trim(), newPrefix) });
    } else {
      const promote = f.suffixField.trim() !== '' && f.nameField.trim() === '';
      set({
        modelKey: newKey,
        nameField: promote ? f.suffixField.trim() : f.nameField,
        suffixField: '',
      });
    }
    setEvilPlayed(false);
  };

  const onIntroClose = () => {
    const current = intro;
    setIntro({ open: false });
    if (current.open && current.mode === 'select') {
      commitEvilSelection(current.key);
      markEvilIntroSeen();
    }
  };

  // --- Save / close ---------------------------------------------------------

  const attemptClose = () => {
    if (dirty) setShowDiscard(true);
    else onClose();
  };

  const onSave = async () => {
    if (!saveEnabled) return;
    const finalTags = tagHandleRef.current?.commitPending() ?? fieldsRef.current.tags;
    const f = fieldsRef.current;
    const currentEntry = f.modelKey != null ? catalog.modelByKey.get(f.modelKey) : undefined;
    const currentLoc =
      f.locationKey != null ? catalog.locationByKey.get(f.locationKey) : undefined;
    const supportsZone = currentLoc?.paramKind === 'zone';
    const supportsSpace = currentLoc?.paramKind === 'spaceCoordinate';
    const customModelVisible = f.modelKey == null || !hasPrefix(currentEntry);

    const roles = {} as Record<ShipRight, string | null>;
    for (const r of SHIP_RIGHTS) {
      const trimmed = f.roles[r].trim();
      roles[r] = trimmed === '' ? null : trimmed;
    }

    const draft: ShipDraft = {
      id: initial?.id ?? '',
      name: composedName(f, catalog.modelByKey),
      modelKey: f.modelKey,
      customModelLabel: customModelVisible
        ? f.customModelField.trim() === ''
          ? null
          : f.customModelField.trim()
        : null,
      registered: f.registered,
      locationKey: f.locationKey,
      customLocation:
        f.locationKey === CUSTOM_LOCATION_KEY
          ? f.customLocationField.trim() === ''
            ? null
            : f.customLocationField.trim()
          : null,
      locationZone: supportsZone ? parseIntOrNull(f.zoneField) : null,
      locationSector: supportsSpace
        ? f.sectorField.trim() === ''
          ? null
          : f.sectorField.trim()
        : null,
      locationSL: supportsSpace ? parseIntOrNull(f.slField) : null,
      hull: parseIntOrNull(f.hullField),
      roles,
      note: f.noteField,
    };

    try {
      await saveShip(draft, finalTags);
      Haptics.success();
      onClose();
    } catch (err) {
      console.error('Failed to save ship:', err);
      showSnackbar(friendlyError(err, "Couldn't save — please try again."), { danger: true });
    }
  };

  const confirmDelete = async () => {
    if (initial == null) return;
    setShowDelete(false);
    Haptics.warning();
    try {
      await deleteShip(initial.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete ship:', err);
      showSnackbar(friendlyError(err), { danger: true });
    }
  };

  // --- Picker groups --------------------------------------------------------

  const modelGroups: PickerGroup[] = CATEGORY_ORDER.map((cat) => ({
    label: cat.toUpperCase(),
    items: catalog.models
      .filter((m) => m.category === cat)
      .sort((a, b) => (a.displayName < b.displayName ? -1 : a.displayName > b.displayName ? 1 : 0))
      .map((m: ShipCatalogEntry) => ({
        key: m.key,
        title: m.displayName,
        subtitle: m.crewSize != null ? `Crew ${m.crewSize}` : null,
      })),
  })).filter((g) => g.items.length > 0);

  const locationGroups: PickerGroup[] = (
    ['landmarks', 'stations', 'bodies', 'special', 'custom'] as const
  )
    .map((group) => ({
      label: group.toUpperCase(),
      items: catalog.locations
        .filter((l) => l.group === group)
        .map((l) => ({ key: l.key, title: l.displayName, subtitle: l.subtitle })),
    }))
    .filter((g) => g.items.length > 0);

  const availableRoleList: ShipRight[] = availableRoles(entry);

  const showCustomModel = fields.modelKey == null || !prefixed;
  const hullLabel = entry?.hullMax != null ? `Hull (max ${entry.hullMax})` : 'Hull';

  return (
    <EditorSheet
      title={initial != null ? 'Edit ship' : 'New ship'}
      onBackdrop={attemptClose}
      leading={
        <button type="button" className={styles.editorCancel} onClick={attemptClose}>
          Cancel
        </button>
      }
      trailing={
        <button
          type="button"
          className={saveEnabled ? styles.editorSave : styles.editorSaveDisabled}
          disabled={!saveEnabled}
          onClick={() => void onSave()}
        >
          Save
        </button>
      }
    >
      {/* Card 1 — IDENTITY */}
      <GlassCard className={styles.editorCard}>
        <SectionHeader title="Identity" className={styles.sectionHeader} />
        {prefixed ? (
          <LabeledField label="Call sign">
            <div className={`${styles.prefixField} ${evilPlayed ? styles.disabledField : ''}`}>
              <span className={styles.prefixChip}>{entry?.prefix}-</span>
              <input
                className={styles.prefixInput}
                value={fields.suffixField}
                placeholder="number"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                disabled={evilPlayed}
                onChange={(e) => set({ suffixField: e.target.value.toUpperCase() })}
              />
            </div>
          </LabeledField>
        ) : (
          <LabeledField label="Name">
            <input
              className={styles.input}
              value={fields.nameField}
              placeholder="Ship's call sign"
              onChange={(e) => set({ nameField: e.target.value })}
            />
          </LabeledField>
        )}

        <LabeledField label="Model">
          <button
            type="button"
            className={`${styles.pickerButton} ${evilPlayed ? styles.disabledField : ''}`}
            disabled={evilPlayed}
            onClick={() => setModelPickerOpen(true)}
          >
            <span className={entry != null ? styles.pickerValue : styles.pickerPlaceholder}>
              {entry != null ? entry.displayName : 'Pick a model'}
            </span>
            <span className={styles.pickerChevron}>
              <IconExpandMore size={20} />
            </span>
          </button>
        </LabeledField>

        {showCustomModel && (
          <LabeledField label="Custom model label">
            <input
              className={styles.inputMono}
              value={fields.customModelField}
              placeholder="e.g. MMC-1234 (optional)"
              onChange={(e) => set({ customModelField: e.target.value })}
            />
          </LabeledField>
        )}

        <div className={styles.switchRow}>
          <button
            type="button"
            role="switch"
            aria-checked={fields.registered}
            className={`${styles.switch} ${fields.registered ? styles.switchOn : ''}`}
            onClick={() => set({ registered: !fields.registered })}
          >
            <span className={styles.switchThumb} />
          </button>
          <span className={styles.switchLabel}>Registered</span>
        </div>
      </GlassCard>

      {/* Card 2 — LOCATION */}
      <GlassCard className={styles.editorCard}>
        <SectionHeader
          title="Location"
          icon={<IconPlace size={18} />}
          className={styles.sectionHeader}
        />
        <button
          type="button"
          className={styles.pickerButton}
          onClick={() => setLocationPickerOpen(true)}
        >
          <span className={locEntry != null ? styles.pickerValue : styles.pickerPlaceholder}>
            {locEntry != null ? locEntry.displayName : 'Pick a location'}
          </span>
          <span className={styles.pickerChevron}>
            <IconExpandMore size={20} />
          </span>
        </button>

        {locEntry?.paramKind === 'zone' && (
          <LabeledField label="Zone">
            <input
              className={styles.inputMono}
              inputMode="numeric"
              value={fields.zoneField}
              placeholder={String(locEntry.defaultZone ?? 55)}
              onChange={(e) => set({ zoneField: digitsOnly(e.target.value) })}
            />
          </LabeledField>
        )}

        {locEntry?.paramKind === 'spaceCoordinate' && (
          <div className={styles.fieldRow}>
            <LabeledField label="Sector">
              <input
                className={styles.inputMono}
                value={fields.sectorField}
                placeholder="A-1"
                onChange={(e) => set({ sectorField: e.target.value })}
              />
            </LabeledField>
            <LabeledField label="SL">
              <input
                className={styles.inputMono}
                inputMode="numeric"
                value={fields.slField}
                placeholder="0"
                onChange={(e) => set({ slField: digitsOnly(e.target.value) })}
              />
            </LabeledField>
          </div>
        )}

        {fields.locationKey === CUSTOM_LOCATION_KEY && (
          <LabeledField label="Custom location">
            <input
              className={styles.input}
              value={fields.customLocationField}
              placeholder="Free text"
              onChange={(e) => set({ customLocationField: e.target.value })}
            />
          </LabeledField>
        )}
      </GlassCard>

      {/* Card 3 — HULL */}
      <GlassCard className={styles.editorCard}>
        <SectionHeader
          title="Hull"
          icon={<IconShield size={18} />}
          className={styles.sectionHeader}
        />
        <LabeledField label={hullLabel}>
          <input
            className={styles.inputMono}
            inputMode="numeric"
            value={fields.hullField}
            placeholder="0"
            onChange={(e) => set({ hullField: digitsOnly(e.target.value) })}
          />
        </LabeledField>
      </GlassCard>

      {/* Card 4 — CREW ROLES or OWNER */}
      {isEvil ? (
        <GlassCard className={styles.editorCard}>
          <SectionHeader
            title="Owner"
            icon={<IconShieldMoon size={18} />}
            className={styles.sectionHeader}
          />
          <div className={styles.ownerRow}>
            <span className={styles.ownerIcon}>
              <IconDirectionsBoat size={18} />
            </span>
            <span className={styles.ownerName}>{EVIL.ownerLabel}</span>
            <span className={styles.ownerSpacer} />
            <span className={styles.ownerId}>{EVIL.identifier}</span>
          </div>
          <div className={styles.ownerCaption}>
            Roles do not apply to the void ship. She answers no captain.
          </div>
        </GlassCard>
      ) : (
        availableRoleList.length > 0 && (
          <GlassCard className={styles.editorCardCrew}>
            <SectionHeader
              title="Crew roles"
              icon={<IconGroups size={18} />}
              className={styles.sectionHeader}
            />
            {availableRoleList.map((r) => (
              <LabeledField key={r} label={ROLE_DISPLAY[r]}>
                <input
                  className={styles.input}
                  value={fields.roles[r]}
                  placeholder={roleHint(r)}
                  onChange={(e) => set({ roles: { ...fields.roles, [r]: e.target.value } })}
                />
              </LabeledField>
            ))}
          </GlassCard>
        )
      )}

      {/* Card 5 — NOTE */}
      <GlassCard className={styles.editorCard}>
        <SectionHeader
          title="Note"
          icon={<IconNotesLines size={18} />}
          className={styles.sectionHeader}
        />
        <textarea
          className={styles.textarea}
          rows={3}
          value={fields.noteField}
          placeholder="Anything else worth knowing about this ship"
          onChange={(e) => set({ noteField: e.target.value })}
        />
      </GlassCard>

      {/* Tags block */}
      <div className={styles.tagsBlock}>
        <SectionHeader title="Tags" icon={<IconTag size={18} />} className={styles.sectionHeader} />
        <TagInputField
          selected={fields.tags}
          onChange={(next) => set({ tags: next })}
          pool={tagPool}
          controlRef={tagHandleRef}
        />
      </div>

      {initial != null && (
        <button type="button" className={styles.deleteButton} onClick={() => setShowDelete(true)}>
          Delete ship
        </button>
      )}

      {modelPickerOpen && (
        <PickerSheet
          title="Pick a model"
          noneLabel="No model"
          selectedKey={fields.modelKey}
          groups={modelGroups}
          onPick={onPickModel}
          onDismiss={() => setModelPickerOpen(false)}
        />
      )}

      {locationPickerOpen && (
        <PickerSheet
          title="Pick a location"
          noneLabel="No location"
          selectedKey={fields.locationKey}
          groups={locationGroups}
          onPick={(key) => {
            setLocationPickerOpen(false);
            set({ locationKey: key });
          }}
          onDismiss={() => setLocationPickerOpen(false)}
        />
      )}

      {intro.open && <EvilShipIntro onClose={onIntroClose} />}

      {showDiscard && (
        <ConfirmDialog
          title="Discard changes?"
          body="You have unsaved changes."
          cancelLabel="Keep editing"
          confirmLabel="Discard"
          onCancel={() => setShowDiscard(false)}
          onConfirm={() => {
            setShowDiscard(false);
            onClose();
          }}
        />
      )}

      {showDelete && (
        <ConfirmDialog
          title="Delete ship?"
          cancelLabel="Cancel"
          confirmLabel="Delete"
          onCancel={() => setShowDelete(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </EditorSheet>
  );
}

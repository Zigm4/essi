import { useEffect, useRef, useState } from 'react';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TerminalNotes } from '../../design-system/components/TerminalNotes';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { FormatException } from '../../core/errors';
import { friendlyError } from '../../core/errorText';
import {
  IconCheckCircle,
  IconGraphicEq,
  IconTools,
  IconWarningAmber,
} from '../../design-system/icons';
import {
  IconAttachMoney,
  IconCancel,
  IconChecklist,
  IconFlag,
  IconGppBad,
  IconPending,
} from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ToolScaffold } from './shared/ToolScaffold';
import { loadCatalog } from './shared/catalog';
import {
  analyze,
  isValidId,
  validate,
  type FoeFamilyPart,
  type FoeField,
  type FoeFieldKey,
  type FoeReport,
  type FoeTables,
} from './foe/foeDecoder';
import styles from './foe/FoeDecoder.module.css';

const NOTES = [
  'FOEs are the bounties roaming Mars: hunt them down and claim the reward when they fall.',
  'Every FOE carries a 10-digit registry ID that encodes its faction, combat profile and loot drop.',
  'Decoding an ID tells you who you are hunting, how it fights and what it drops.',
];

/** /tools/foe - decode 10-digit FOE (bounty) IDs. */
export function FoeDecoderView() {
  const [tables, setTables] = useState<FoeTables | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [report, setReport] = useState<FoeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog<FoeTables>('foe_tables.json')
      .then((data) => {
        if (alive) setTables(data);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(friendlyError(e, "Couldn't load the bounty registry."));
      });
    return () => {
      alive = false;
    };
  }, []);

  const rules = validate(input);
  const valid = isValidId(input);

  const onChange = (raw: string) => {
    const sanitized = raw.replace(/\D/g, '').slice(0, 10);
    setInput(sanitized);
    setReport(null);
    setError(null);
  };

  const onDecode = () => {
    if (tables === null) return;
    try {
      setReport(analyze(input, tables));
      setError(null);
    } catch (e) {
      setReport(null);
      setError(e instanceof FormatException ? e.message : 'Unknown error.');
    }
    inputRef.current?.blur();
  };

  return (
    <ToolScaffold title="Bounty Decoder">
      <div className={styles.stack}>
        <TransmissionHeader label="ESSI · Bounty Registry Division" />

        {loadError !== null ? (
          <CenteredError message={loadError} />
        ) : tables === null ? (
          <CenteredSpinner />
        ) : (
          <>
            <TerminalNotes title="bounty.notes" lines={NOTES} />

            <GlassCard>
              <div className={styles.inputCaption}>Enter a 10-digit FOE ID</div>
              <input
                ref={inputRef}
                className={styles.input}
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={10}
                placeholder="e.g. 3241501042"
                value={input}
                style={{
                  borderBottomColor: valid ? 'var(--accent-success)' : 'var(--border-glow)',
                }}
                onChange={(e) => onChange(e.target.value)}
              />
              <NeonButton
                className={styles.decode}
                title="Decode"
                icon={<IconGraphicEq size={18} />}
                enabled={valid}
                onPressed={onDecode}
              />
            </GlassCard>

            {input.length > 0 && !valid && (
              <GlassCard>
                <SectionHeader title="ID format" icon={<IconChecklist size={18} />} />
                <div className={styles.checklistRows}>
                  {rules.map((rule) => (
                    <div className={styles.checklistRow} key={rule.id}>
                      <span className={rule.ok ? styles.checkOk : styles.checkBad}>
                        {rule.ok ? <IconCheckCircle size={18} /> : <IconCancel size={18} />}
                      </span>
                      <span className={`${styles.checkLabel} ${rule.ok ? styles.checkLabelOk : ''}`}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {error !== null && (
              <GlassCard>
                <div className={styles.errorRow}>
                  <IconWarningAmber size={20} />
                  <span className={styles.errorMsg}>{error}</span>
                </div>
              </GlassCard>
            )}

            {report !== null && <Report report={report} />}

            <GlassCard>
              <div className={styles.noticeHeader}>
                <span className={styles.noticeIcon}>
                  <IconTools size={16} />
                </span>
                <span className={styles.noticeTitle}>Under development</span>
              </div>
              <p className={styles.noticeText}>
                This decoder is a work in progress: subfactions, ranks, weapons and family names are
                still being mapped and will be completed over time.
              </p>
            </GlassCard>
          </>
        )}
      </div>
    </ToolScaffold>
  );
}

function Report({ report }: { report: FoeReport }) {
  const byKey = (key: FoeFieldKey): FoeField => {
    const f = report.fields.find((x) => x.key === key);
    if (f === undefined) throw new Error(`missing field ${key}`);
    return f;
  };
  const faction = byKey('faction');
  // Positions 2-6 + family name only decode once the faction is known.
  const dependentPending = faction.known ? 'pending decode' : 'needs faction';

  return (
    <div className={styles.stack}>
      <div className={styles.terminalBlock}>
        <span className={styles.terminalLine}>{`> decoding bounty ${report.id}…`}</span>
        <span className={styles.terminalLine}>{'> registry match ✓'}</span>
      </div>

      <GlassCard>
        <div className={styles.headline}>
          {faction.emoji !== '' && <span className={styles.headlineEmoji}>{faction.emoji}</span>}
          <div className={styles.headlineMain}>
            <span className={styles.headlineName}>
              {faction.known ? faction.name : 'Unknown faction'}
            </span>
            <span className={styles.headlineSub}>{`FOE ${report.id}`}</span>
          </div>
          {faction.code !== undefined && <span className={styles.factionChip}>{faction.code}</span>}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Identity" icon={<IconFlag size={18} />} />
        <div className={styles.fieldRows}>
          <FieldRow field={byKey('subfaction')} pendingLabel={dependentPending} />
          <FamilyRow
            parts={report.familyParts}
            fullName={report.familyName}
            code={report.familyCode}
            factionKnown={faction.known}
          />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Combat profile" icon={<IconGppBad size={18} />} />
        <div className={styles.fieldRows}>
          <FieldRow field={byKey('rank')} pendingLabel={dependentPending} />
          <FieldRow field={byKey('dodge')} />
          <FieldRow field={byKey('weapon')} pendingLabel={dependentPending} />
          <FieldRow field={byKey('protection')} />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Reward" icon={<IconAttachMoney size={18} />} />
        <div className={styles.fieldRows}>
          <FieldRow field={byKey('loot')} />
        </div>
      </GlassCard>
    </div>
  );
}

function FieldRow({ field, pendingLabel = 'pending decode' }: { field: FoeField; pendingLabel?: string }) {
  // Raw-value fields (dodge, protection): the value is the digit itself.
  if (field.isValue === true) {
    return (
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{field.label}</span>
        <span className={styles.fieldValue}>{field.digit}</span>
      </div>
    );
  }
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{field.label}</span>
      {field.emoji !== '' && <span className={styles.fieldEmoji}>{field.emoji}</span>}
      {field.known ? (
        <span className={styles.fieldName}>{field.name}</span>
      ) : (
        <span className={styles.fieldPending}>
          <IconPending size={14} /> {pendingLabel}
        </span>
      )}
      {field.note !== undefined && <span className={styles.fieldNote}>{field.note}</span>}
      {field.code !== undefined && <span className={styles.fieldCode}>{field.code}</span>}
      <span className={styles.digitBadge}>{field.digit}</span>
    </div>
  );
}

/**
 * Family name is three fragments (positions 8-10) concatenated. Shows the full
 * name when all three resolve; otherwise composes the known fragments inline and
 * renders each unmapped fragment as its raw digit.
 */
function FamilyRow({
  parts,
  fullName,
  code,
  factionKnown,
}: {
  parts: FoeFamilyPart[];
  fullName: string | null;
  code: string;
  factionKnown: boolean;
}) {
  const anyKnown = parts.some((p) => p.name !== null);
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>Family name</span>
      {!factionKnown ? (
        <span className={styles.fieldPending}>
          <IconPending size={14} /> needs faction
        </span>
      ) : fullName !== null ? (
        <span className={styles.fieldName}>{fullName}</span>
      ) : anyKnown ? (
        <span className={styles.familyCompose}>
          {parts.map((p, i) =>
            p.name !== null ? (
              <span key={i} className={styles.familyPart}>
                {p.name}
              </span>
            ) : (
              <span key={i} className={styles.familyPartMissing}>
                {p.digit}
              </span>
            ),
          )}
        </span>
      ) : (
        <span className={styles.fieldPending}>
          <IconPending size={14} /> pending decode
        </span>
      )}
      <span className={styles.digitBadge}>{code}</span>
    </div>
  );
}

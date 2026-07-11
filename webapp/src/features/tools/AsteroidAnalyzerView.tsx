import { useEffect, useRef, useState } from 'react';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TerminalNotes } from '../../design-system/components/TerminalNotes';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { withAlpha } from '../../design-system/color';
import { FormatException } from '../../core/errors';
import { friendlyError } from '../../core/errorText';
import {
  IconCheckCircle,
  IconGraphicEq,
  IconWarningAmber,
} from '../../design-system/icons';
import { IconAttachMoney, IconCancel, IconChecklist, IconMoneyOff } from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ToolScaffold } from './shared/ToolScaffold';
import { loadCatalog } from './shared/catalog';
import {
  alertTint,
  analyze,
  formatAmount,
  isValidId,
  validate,
  type AsteroidReport,
  type AsteroidTables,
} from './asteroid/asteroidDecoder';
import styles from './asteroid/AsteroidAnalyzer.module.css';

const NOTES = [
  'This tool is for players who own a UFO, the type of ship that can mine multiple resources directly from asteroids.',
  'Some players own several UFOs, you can ask them to grant you pilot rights if you want to try the gameplay.',
  "Decomposing an asteroid's ID reveals its quality: resource composition, hazard level, size and other key characteristics.",
];

/** /tools/asteroid — decode 9-digit asteroid IDs. */
export function AsteroidAnalyzerView() {
  const [tables, setTables] = useState<AsteroidTables | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [report, setReport] = useState<AsteroidReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog<AsteroidTables>('asteroid_tables.json')
      .then((data) => {
        if (alive) setTables(data);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(friendlyError(e, "Couldn't load the asteroid tables."));
      });
    return () => {
      alive = false;
    };
  }, []);

  const rules = validate(input);
  const valid = isValidId(input);

  const onChange = (raw: string) => {
    const sanitized = raw.replace(/\D/g, '').slice(0, 9);
    setInput(sanitized);
    setReport(null);
    setError(null);
  };

  const onAnalyze = () => {
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
    <ToolScaffold title="Asteroid Analyzer">
      <div className={styles.stack}>
        <TransmissionHeader label="ESSI · Asteroid Analysis Division" />

        {loadError !== null ? (
          <CenteredError message={loadError} />
        ) : tables === null ? (
          <CenteredSpinner />
        ) : (
          <>
            <TerminalNotes title="asteroid.notes" lines={NOTES} />

            <GlassCard>
              <div className={styles.inputCaption}>Enter a 9-digit asteroid ID</div>
              <input
                ref={inputRef}
                className={styles.input}
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={9}
                placeholder="e.g. 195016321"
                value={input}
                style={{
                  borderBottomColor: valid ? 'var(--accent-success)' : 'var(--border-glow)',
                }}
                onChange={(e) => onChange(e.target.value)}
              />
              <NeonButton
                className={styles.analyze}
                title="Analyze"
                icon={<IconGraphicEq size={18} />}
                enabled={valid}
                onPressed={onAnalyze}
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
                      <span
                        className={`${styles.checkLabel} ${rule.ok ? styles.checkLabelOk : ''}`}
                      >
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
          </>
        )}
      </div>
    </ToolScaffold>
  );
}

function Report({ report }: { report: AsteroidReport }) {
  return (
    <div className={styles.stack}>
      <div className={styles.terminalBlock}>
        <span className={styles.terminalLine}>{`> decoding asteroid ${report.id}…`}</span>
        <span className={styles.terminalLine}>{'> match found ✓'}</span>
      </div>

      {report.alerts.map((alert, i) => {
        const tint = alertTint(alert.level);
        return (
          <div
            key={i}
            className={styles.alertBox}
            style={{ background: withAlpha(tint, 0.12), borderColor: withAlpha(tint, 0.5) }}
          >
            <span className={styles.alertEmoji}>{alert.emoji}</span>
            <span className={styles.alertMsg}>{alert.message}</span>
          </div>
        );
      })}

      <GlassCard>
        <div className={styles.wealthRow}>
          <div className={styles.wealthCol}>
            <span className={styles.miniCaption}>Wealth</span>
            <div className={styles.wealthIcons}>
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={i < report.wealth ? styles.coinOn : styles.coinOff}>
                  {i < report.wealth ? <IconAttachMoney size={18} /> : <IconMoneyOff size={18} />}
                </span>
              ))}
            </div>
            <span className={styles.miniCaption}>{report.wealth}/9</span>
          </div>
          <div className={`${styles.wealthCol} ${styles.wealthColRight}`}>
            <span className={styles.miniCaption}>Resource value</span>
            <span className={styles.valueNumber}>{report.resourceValueText}</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Primary characteristics" />
        <div className={styles.charRows}>
          <CharRow label="Type" emoji={report.type.emoji} name={report.type.name} />
          <CharRow
            label="Size"
            emoji={report.size.emoji}
            name={report.size.name}
            suffix={`×${formatAmount(report.size.multiplier ?? 1)}`}
          />
          <CharRow
            label="Structure"
            emoji={report.structure.emoji}
            name={report.structure.name}
            suffix={`risk ${report.structure.risk ?? 0}`}
          />
          <CharRow
            label="Salvage"
            emoji={report.salvage.emoji}
            name={report.salvage.name}
            suffix={`value ${report.salvage.value ?? 0}`}
          />
          <CharRow label="Law" emoji={report.law.emoji} name={report.law.name} />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Resources" />
        <div className={styles.resourceRows}>
          {report.resources.map((res, i) => (
            <div className={styles.resourceRow} key={i}>
              <span className={styles.resourceEmoji}>{res.emoji}</span>
              <div className={styles.resourceMain}>
                <span className={styles.resourceName}>{res.name}</span>
                {res.symbol !== undefined && (
                  <span className={styles.resourceSymbol}>{res.symbol}</span>
                )}
              </div>
              <span className={styles.resourcePts}>{`${res.value ?? 0} pts`}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function CharRow({
  label,
  emoji,
  name,
  suffix,
}: {
  label: string;
  emoji: string;
  name: string;
  suffix?: string;
}) {
  return (
    <div className={styles.charRow}>
      <span className={styles.charLabel}>{label}</span>
      <span className={styles.charEmoji}>{emoji}</span>
      <span className={styles.charName}>{name}</span>
      {suffix !== undefined && <span className={styles.charSuffix}>{suffix}</span>}
    </div>
  );
}

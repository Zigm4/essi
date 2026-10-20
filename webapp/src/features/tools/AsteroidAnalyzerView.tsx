import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TerminalNotes } from '../../design-system/components/TerminalNotes';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { withAlpha } from '../../design-system/color';
import { FormatException } from '../../core/errors';
import {
  IconCheckCircle,
  IconGraphicEq,
  IconWarningAmber,
} from '../../design-system/icons';
import { IconAttachMoney, IconCancel, IconChecklist, IconIosShare, IconMoneyOff } from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { cleanIdInput } from './shared/idInput';
import { isSubmitKey, revealResult } from './shared/revealResult';
import { ShareSheet } from './shared/ShareSheet';
import type { ShareContent } from './shared/shareActions';
import { ToolScaffold } from './shared/ToolScaffold';
import { useCatalog } from './shared/useCatalog';
import {
  analyze,
  isValidId,
  validate,
  type AsteroidReport,
  type AsteroidTables,
} from './asteroid/asteroidDecoder';
import { alertRows, characteristicRows, resourceRows, WEALTH_MAX, wealthText } from './asteroid/asteroidFacts';
import { asteroidIdFromSearch, asteroidShare } from './asteroid/asteroidShare';
import styles from './asteroid/AsteroidAnalyzer.module.css';

const parseTables = (raw: unknown) => raw as AsteroidTables;

const NOTES = [
  'This tool is for players who own a UFO, the type of ship that can mine multiple resources directly from asteroids.',
  'Some players own several UFOs, you can ask them to grant you pilot rights if you want to try the gameplay.',
  "Decomposing an asteroid's ID reveals its quality: resource composition, hazard level, size and other key characteristics.",
];

/** /tools/asteroid - decode 9-digit asteroid IDs; `?id=` (a shared link) decodes that one. */
export function AsteroidAnalyzerView() {
  const {
    data: tables,
    error: loadError,
    retry,
  } = useCatalog('asteroid_tables.json', parseTables, "Couldn't load the asteroid tables.");
  const [input, setInput] = useState('');
  const [report, setReport] = useState<AsteroidReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareContent | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  // Set by a decode the user asked for (not a shared link): show its result.
  const revealNext = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedId = asteroidIdFromSearch(searchParams.toString());

  useEffect(() => {
    if (report === null || !revealNext.current) return;
    revealNext.current = false;
    revealResult(reportRef.current);
  }, [report]);

  const decode = (id: string, data: AsteroidTables) => {
    try {
      setReport(analyze(id, data));
      setError(null);
    } catch (e) {
      setReport(null);
      setError(e instanceof FormatException ? e.message : 'Unknown error.');
    }
  };

  // A shared link fills the ID and shows its analysis once the tables are in.
  useEffect(() => {
    if (tables === null || linkedId === null) return;
    setInput(linkedId);
    setError(null);
    if (isValidId(linkedId)) decode(linkedId, tables);
    else setReport(null);
  }, [tables, linkedId]);

  const rules = validate(input);
  const valid = isValidId(input);

  const onChange = (raw: string) => {
    // Clean, then limit: no native maxLength, which would cut a pasted "#123 456…" first.
    const sanitized = cleanIdInput(raw, 9);
    setInput(sanitized);
    setReport(null);
    setError(null);
    // Typing another ID leaves the shared one: reloading shouldn't bring it back.
    if (searchParams.has('id')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('id');
          return next;
        },
        { replace: true },
      );
    }
  };

  const onAnalyze = () => {
    if (tables === null || !valid) return;
    revealNext.current = true;
    decode(input, tables);
    inputRef.current?.blur();
  };

  return (
    <ToolScaffold title="Asteroid Analyzer">
      <div className={styles.stack}>
        <TransmissionHeader label="ESSI · Asteroid Analysis Division" />

        {loadError !== null ? (
          <CenteredError message={loadError} onRetry={retry} />
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
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. 195016321"
                value={input}
                style={{
                  borderBottomColor: valid ? 'var(--accent-success)' : 'var(--border-glow)',
                }}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (isSubmitKey(e)) onAnalyze();
                }}
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

            {report !== null && (
              <div ref={reportRef} className={styles.reveal}>
                <Report report={report} onShare={() => setShare(asteroidShare(report))} />
              </div>
            )}
          </>
        )}
      </div>
      <ShareSheet content={share} onClose={() => setShare(null)} />
    </ToolScaffold>
  );
}

function Report({ report, onShare }: { report: AsteroidReport; onShare: () => void }) {
  // Same rows as the share card (asteroidFacts), so the image matches the screen.
  return (
    <div className={styles.stack}>
      <div className={styles.reportHead}>
        <div className={styles.terminalBlock}>
          <span className={styles.terminalLine}>{`> decoding asteroid ${report.id}…`}</span>
          <span className={styles.terminalLine}>{'> match found ✓'}</span>
        </div>
        <button
          type="button"
          className={styles.shareBtn}
          aria-label="Share this analysis"
          title="Share this analysis"
          onClick={onShare}
        >
          <IconIosShare size={20} />
        </button>
      </div>

      {alertRows(report).map((alert, i) => (
        <div
          key={i}
          className={styles.alertBox}
          style={{ background: withAlpha(alert.tint, 0.12), borderColor: withAlpha(alert.tint, 0.5) }}
        >
          <span className={styles.alertEmoji}>{alert.emoji}</span>
          <span className={styles.alertMsg}>{alert.message}</span>
        </div>
      ))}

      <GlassCard>
        <div className={styles.wealthRow}>
          <div className={styles.wealthCol}>
            <span className={styles.miniCaption}>Wealth</span>
            <div className={styles.wealthIcons}>
              {Array.from({ length: WEALTH_MAX }, (_, i) => (
                <span key={i} className={i < report.wealth ? styles.coinOn : styles.coinOff}>
                  {i < report.wealth ? <IconAttachMoney size={18} /> : <IconMoneyOff size={18} />}
                </span>
              ))}
            </div>
            <span className={styles.miniCaption}>{wealthText(report)}</span>
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
          {characteristicRows(report).map((row) => (
            <CharRow key={row.label} label={row.label} emoji={row.emoji} name={row.name} suffix={row.suffix} />
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Resources" />
        <div className={styles.resourceRows}>
          {resourceRows(report).map((res, i) => (
            <div className={styles.resourceRow} key={i}>
              <span className={styles.resourceEmoji}>{res.emoji}</span>
              <div className={styles.resourceMain}>
                <span className={styles.resourceName}>{res.name}</span>
                {res.symbol !== undefined && (
                  <span className={styles.resourceSymbol}>{res.symbol}</span>
                )}
              </div>
              <span className={styles.resourcePts}>{res.points}</span>
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

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TerminalNotes } from '../../design-system/components/TerminalNotes';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { FormatException } from '../../core/errors';
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
  IconIosShare,
  IconPending,
} from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { cleanIdInput } from './shared/idInput';
import { isSubmitKey, revealResult } from './shared/revealResult';
import { ShareSheet } from './shared/ShareSheet';
import type { ShareContent } from './shared/shareActions';
import { ToolScaffold } from './shared/ToolScaffold';
import { useCatalog } from './shared/useCatalog';
import { analyze, isValidId, validate, type FoeReport, type FoeTables } from './foe/foeDecoder';
import {
  BLUEPRINT_HINT,
  foeHeadline,
  foeLootPool,
  foeSections,
  isBlueprintReward,
  isPartialFamily,
  LOOT_HINT,
  type FoeRow,
} from './foe/foeFacts';
import { foeIdFromSearch, foeShare } from './foe/foeShare';
import styles from './foe/FoeDecoder.module.css';

const parseTables = (raw: unknown) => raw as FoeTables;

const NOTES = [
  'FOEs are the bounties roaming Mars: hunt them down and claim the reward when they fall.',
  'Every FOE carries a 10-digit registry ID that encodes its faction, combat profile and loot drop.',
  'Decoding an ID tells you who you are hunting, how it fights and what it drops.',
];

/** /tools/foe - decode 10-digit FOE (bounty) IDs; `?id=` (a shared link) decodes that one. */
export function FoeDecoderView() {
  const {
    data: tables,
    error: loadError,
    retry,
  } = useCatalog('foe_tables.json', parseTables, "Couldn't load the bounty registry.");
  const [input, setInput] = useState('');
  const [report, setReport] = useState<FoeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareContent | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  // Set by a decode the user asked for (not a shared link): show its result.
  const revealNext = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedId = foeIdFromSearch(searchParams.toString());

  useEffect(() => {
    if (report === null || !revealNext.current) return;
    revealNext.current = false;
    revealResult(reportRef.current);
  }, [report]);

  const decode = (id: string, data: FoeTables) => {
    try {
      setReport(analyze(id, data));
      setError(null);
    } catch (e) {
      setReport(null);
      setError(e instanceof FormatException ? e.message : 'Unknown error.');
    }
  };

  // A shared link fills the ID and shows its decoding once the registry is in.
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
    const sanitized = cleanIdInput(raw, 10);
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

  const onDecode = () => {
    if (tables === null || !valid) return;
    revealNext.current = true;
    decode(input, tables);
    inputRef.current?.blur();
  };

  return (
    <ToolScaffold title="Bounty Decoder">
      <div className={styles.stack}>
        <TransmissionHeader label="ESSI · Bounty Registry Division" />

        {loadError !== null ? (
          <CenteredError message={loadError} onRetry={retry} />
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
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. 3241501042"
                value={input}
                style={{
                  borderBottomColor: valid ? 'var(--accent-success)' : 'var(--border-glow)',
                }}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (isSubmitKey(e)) onDecode();
                }}
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

            {report !== null && (
              <div ref={reportRef} className={styles.reveal}>
                <Report report={report} onShare={() => setShare(foeShare(report))} />
              </div>
            )}

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
      <ShareSheet content={share} onClose={() => setShare(null)} />
    </ToolScaffold>
  );
}

function Report({ report, onShare }: { report: FoeReport; onShare: () => void }) {
  // Same rows as the share card (foeFacts), so the image matches the screen.
  const headline = foeHeadline(report);
  const sections = foeSections(report);

  return (
    <div className={styles.stack}>
      <div className={styles.reportHead}>
        <div className={styles.terminalBlock}>
          <span className={styles.terminalLine}>{`> decoding bounty ${report.id}…`}</span>
          <span className={styles.terminalLine}>{'> registry match ✓'}</span>
        </div>
        <button
          type="button"
          className={styles.shareBtn}
          aria-label="Share this bounty"
          title="Share this bounty"
          onClick={onShare}
        >
          <IconIosShare size={20} />
        </button>
      </div>

      <GlassCard>
        <div className={styles.headline}>
          {headline.emoji !== '' && <span className={styles.headlineEmoji}>{headline.emoji}</span>}
          <div className={styles.headlineMain}>
            <span className={styles.headlineName}>{headline.name}</span>
            <span className={styles.headlineSub}>{`FOE ${report.id}`}</span>
          </div>
          {headline.code !== undefined && <span className={styles.factionChip}>{headline.code}</span>}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Identity" icon={<IconFlag size={18} />} />
        <div className={styles.fieldRows}>
          {sections.identity.map((row) =>
            row.key === 'family' ? <FamilyRow key={row.key} row={row} /> : <FieldRow key={row.key} row={row} />,
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Combat profile" icon={<IconGppBad size={18} />} />
        <div className={styles.fieldRows}>
          {sections.combat.map((row) => (
            <FieldRow key={row.key} row={row} />
          ))}
        </div>
      </GlassCard>

      <RewardCard report={report} loot={sections.loot} />
    </div>
  );
}

function RewardCard({ report, loot }: { report: FoeReport; loot: FoeRow }) {
  const pool = foeLootPool(report);
  return (
    <GlassCard>
      <SectionHeader title="Reward" icon={<IconAttachMoney size={18} />} />
      <div className={styles.fieldRows}>
        <FieldRow row={loot} />
      </div>
      <p className={styles.rewardHint}>{LOOT_HINT}</p>
      {pool !== null && (
        <div className={styles.lootPool}>
          <span className={styles.lootPoolLabel}>{pool.label}</span>
          <div className={styles.lootPoolItems}>
            {pool.items.map((item) => (
              <span key={item} className={styles.lootPoolItem}>
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
      {isBlueprintReward(report) && <p className={styles.rewardHint}>{BLUEPRINT_HINT}</p>}
    </GlassCard>
  );
}

function FieldRow({ row }: { row: FoeRow }) {
  // Raw-value fields (dodge, protection): the value is the digit itself.
  if (row.isValue) {
    return (
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{row.label}</span>
        <span className={styles.fieldValue}>{row.digits}</span>
      </div>
    );
  }
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{row.label}</span>
      {row.emoji !== '' && <span className={styles.fieldEmoji}>{row.emoji}</span>}
      {row.value !== null ? (
        <span className={styles.fieldName}>{row.value}</span>
      ) : (
        <span className={styles.fieldPending}>
          <IconPending size={14} /> {row.pendingLabel}
        </span>
      )}
      {row.note !== undefined && <span className={styles.fieldNote}>{row.note}</span>}
      {row.code !== undefined && <span className={styles.fieldCode}>{row.code}</span>}
      <span className={styles.digitBadge}>{row.digits}</span>
    </div>
  );
}

/**
 * Family name is three fragments (positions 8-10) concatenated. Shows the full
 * name when all three resolve; otherwise composes the known fragments inline and
 * renders each unmapped fragment as its raw digit.
 */
function FamilyRow({ row }: { row: FoeRow }) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{row.label}</span>
      {row.value !== null ? (
        <span className={styles.fieldName}>{row.value}</span>
      ) : isPartialFamily(row) ? (
        <span className={styles.familyCompose}>
          {(row.parts ?? []).map((p, i) =>
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
          <IconPending size={14} /> {row.pendingLabel}
        </span>
      )}
      <span className={styles.digitBadge}>{row.digits}</span>
    </div>
  );
}

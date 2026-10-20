import { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { Haptics } from '../../core/haptics';
import { IconContentCopy, IconSearch, IconWallet } from '../../design-system/icons';
import { IconBarChart, IconIosShare, IconList, IconPerson } from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ShareSheet } from './shared/ShareSheet';
import { copyText, type ShareContent } from './shared/shareActions';
import { isSubmitKey, revealResult } from './shared/revealResult';
import { ToolScaffold } from './shared/ToolScaffold';
import { useCatalog } from './shared/useCatalog';
import {
  capResults,
  normalizeQuery,
  ownerHandle,
  ownerId,
  parseWallets,
  resultsLabel,
  search,
  walletCountLabel,
  walletStats,
  type WalletDisplay,
  type WalletHit,
  type WalletOwner,
} from './wallet/walletData';
import { walletQueryFromSearch, walletShare } from './wallet/walletShare';
import styles from './wallet/WalletLookup.module.css';

/**
 * /tools/wallet - find a wallet from an owner handle, or an owner from a
 * wallet. `?q=` (global search, a shared link) runs that search.
 */
export function WalletLookupView() {
  const location = useLocation();
  const { data: owners, error: loadError, retry } = useCatalog('wallets.json', parseWallets, "Couldn't load wallet data.");
  const [query, setQuery] = useState(() => walletQueryFromSearch(location.search));
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const trimmed = query.trim();
  const result = useMemo(
    () => (owners === null ? null : search(query, owners)),
    [owners, query],
  );
  const display = useMemo(() => (result === null ? null : capResults(result)), [result]);
  const stats = useMemo(() => (owners === null ? null : walletStats(owners)), [owners]);

  return (
    <ToolScaffold title="Wallet Lookup">
      <div className={styles.stack}>
        <TransmissionHeader label="ESBE · blockchain analysis" />

        {loadError !== null ? (
          <CenteredError message={loadError} onRetry={retry} />
        ) : owners === null || display === null || stats === null ? (
          <CenteredSpinner />
        ) : (
          <>
            <GlassCard>
              <SectionHeader title="Search owner or wallet" />
              <div className={styles.caption}>
                Find a wallet from an owner handle, or an owner from a wallet.
              </div>
              <input
                className={styles.searchField}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Results update as you type: Enter just closes the keyboard and shows them.
                  if (!isSubmitKey(e)) return;
                  e.currentTarget.blur();
                  revealResult(resultsRef.current);
                }}
              />
            </GlassCard>

            <div ref={resultsRef} className={styles.reveal}>
              {normalizeQuery(query).length === 0 ? (
                <GlassCard>
                  <SectionHeader title="Database overview" icon={<IconBarChart size={18} />} />
                  <div style={{ marginTop: 8 }}>
                    <StatRow label="Owners" value={String(stats.totalOwners)} />
                    <StatRow label="Wallets" value={String(stats.totalWallets)} />
                    <StatRow label="Avg per owner" value={stats.avgPerOwner} />
                  </div>
                </GlassCard>
              ) : display.total === 0 ? (
                <GlassCard>
                  <div className={styles.noMatchRow}>
                    <IconSearch size={22} />
                    <div className={styles.noMatchText}>
                      <span className={styles.noMatchHead}>No matches</span>
                    </div>
                  </div>
                  <div className={styles.caption} style={{ marginBottom: 0 }}>
                    Try a different name, Discord handle, or wallet substring.
                  </div>
                </GlassCard>
              ) : (
                <Results query={trimmed} display={display} />
              )}
            </div>
          </>
        )}
      </div>
    </ToolScaffold>
  );
}

function Results({ query, display }: { query: string; display: WalletDisplay }) {
  const [share, setShare] = useState<ShareContent | null>(null);
  // Discord message, image or link (walletShare) - the same sheet as the NASA tools.
  const onShare = () => setShare(walletShare(query, display));
  return (
    <div className={styles.stack}>
      <div className={styles.resultsHeader}>
        <SectionHeader title={resultsLabel(display.total)} icon={<IconList size={18} />} />
        <button
          type="button"
          className={styles.shareBtn}
          aria-label="Share results"
          title="Share results"
          onClick={onShare}
        >
          <IconIosShare size={18} />
        </button>
      </div>

      {display.hiddenCaption !== null && (
        <div className={styles.hiddenCaption}>{display.hiddenCaption}</div>
      )}

      {display.owners.map((owner) => (
        <OwnerCard key={`owner-${ownerId(owner)}`} owner={owner} />
      ))}

      {display.walletHits.length > 0 && (
        <>
          <SectionHeader
            className={styles.subHeader}
            title="Wallet matches"
            icon={<IconWallet size={18} />}
          />
          {display.walletHits.map((hit, i) => (
            <WalletHitCard key={`hit-${hit.wallet}-${i}`} hit={hit} />
          ))}
        </>
      )}

      <ShareSheet content={share} onClose={() => setShare(null)} />
    </div>
  );
}

function OwnerCard({ owner }: { owner: WalletOwner }) {
  const handle = ownerHandle(owner);
  return (
    <GlassCard>
      <div className={styles.ownerTop}>
        <span className={styles.ownerIcon}>
          <IconPerson size={20} />
        </span>
        <div className={styles.ownerNameCol}>
          <div className={styles.ownerName}>{owner.display_name}</div>
          {handle !== null && <div className={styles.ownerHandle}>{handle}</div>}
        </div>
        <span className={styles.ownerCount}>{walletCountLabel(owner.wallets.length)}</span>
      </div>
      <div className={styles.divider} />
      {owner.wallets.map((wallet) => (
        <div className={styles.walletRow} key={wallet}>
          <span className={styles.walletIcon}>
            <IconWallet size={16} />
          </span>
          <span className={styles.walletText}>{wallet}</span>
          <CopyWalletButton wallet={wallet} />
        </div>
      ))}
    </GlassCard>
  );
}

function WalletHitCard({ hit }: { hit: WalletHit }) {
  const { owner } = hit;
  const handle = ownerHandle(owner);
  return (
    <GlassCard>
      <div className={styles.hitWallet}>
        <span className={styles.walletIcon}>
          <IconWallet size={16} />
        </span>
        <span className={styles.hitWalletText}>{hit.wallet}</span>
        <CopyWalletButton wallet={hit.wallet} />
      </div>
      <div className={styles.hitRegistered}>
        Registered to <span className={styles.hitOwner}>{owner.display_name}</span>
        {handle !== null && <span className={styles.hitOwnerHandle}>{` (${handle})`}</span>}
      </div>
    </GlassCard>
  );
}

/** Copies one wallet address - a long string that is easy to mis-select on a phone. */
function CopyWalletButton({ wallet }: { wallet: string }) {
  return (
    <button
      type="button"
      className={styles.copyBtn}
      aria-label={`Copy wallet ${wallet}`}
      title="Copy wallet"
      onClick={() => {
        Haptics.tap();
        void copyText(wallet, 'Wallet copied');
      }}
    >
      <IconContentCopy size={16} />
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

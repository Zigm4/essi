import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TransmissionHeader } from '../../design-system/components/TransmissionHeader';
import { friendlyError } from '../../core/errorText';
import { IconSearch, IconWallet } from '../../design-system/icons';
import { IconBarChart, IconIosShare, IconList, IconPerson } from './shared/toolIcons';
import { CenteredError, CenteredSpinner } from './shared/Status';
import { ToolScaffold } from './shared/ToolScaffold';
import { loadCatalog } from './shared/catalog';
import { shareOrCopy } from './shared/share';
import {
  capResults,
  ownerId,
  parseWallets,
  search,
  walletStats,
  type WalletDisplay,
  type WalletHit,
  type WalletOwner,
} from './wallet/walletData';
import styles from './wallet/WalletLookup.module.css';

/** /tools/wallet — find a wallet from an owner handle, or an owner from a wallet. */
export function WalletLookupView() {
  const [searchParams] = useSearchParams();
  const [owners, setOwners] = useState<WalletOwner[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  useEffect(() => {
    let alive = true;
    loadCatalog<unknown>('wallets.json')
      .then((data) => {
        if (alive) setOwners(parseWallets(data));
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(friendlyError(e, "Couldn't load wallet data."));
      });
    return () => {
      alive = false;
    };
  }, []);

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
          <CenteredError message={loadError} />
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
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </GlassCard>

            {trimmed.length === 0 ? (
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
          </>
        )}
      </div>
    </ToolScaffold>
  );
}

function Results({ query, display }: { query: string; display: WalletDisplay }) {
  const onShare = () => {
    void shareOrCopy('ESSI wallet lookup', buildShareText(query, display));
  };
  const total = display.total;
  return (
    <div className={styles.stack}>
      <div className={styles.resultsHeader}>
        <SectionHeader
          title={`${total} result${total === 1 ? '' : 's'}`}
          icon={<IconList size={18} />}
        />
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
    </div>
  );
}

function OwnerCard({ owner }: { owner: WalletOwner }) {
  const showHandle =
    owner.discord_username !== null &&
    owner.discord_username.toLowerCase() !== owner.display_name.toLowerCase();
  const count = owner.wallets.length;
  return (
    <GlassCard>
      <div className={styles.ownerTop}>
        <span className={styles.ownerIcon}>
          <IconPerson size={20} />
        </span>
        <div className={styles.ownerNameCol}>
          <div className={styles.ownerName}>{owner.display_name}</div>
          {showHandle && <div className={styles.ownerHandle}>{`@${owner.discord_username}`}</div>}
        </div>
        <span className={styles.ownerCount}>{`${count} wallet${count === 1 ? '' : 's'}`}</span>
      </div>
      <div className={styles.divider} />
      {owner.wallets.map((wallet) => (
        <div className={styles.walletRow} key={wallet}>
          <span className={styles.walletIcon}>
            <IconWallet size={16} />
          </span>
          <span className={styles.walletText}>{wallet}</span>
        </div>
      ))}
    </GlassCard>
  );
}

function WalletHitCard({ hit }: { hit: WalletHit }) {
  const { owner } = hit;
  const showHandle =
    owner.discord_username !== null &&
    owner.discord_username.toLowerCase() !== owner.display_name.toLowerCase();
  return (
    <GlassCard>
      <div className={styles.hitWallet}>
        <span className={styles.walletIcon}>
          <IconWallet size={16} />
        </span>
        <span className={styles.hitWalletText}>{hit.wallet}</span>
      </div>
      <div className={styles.hitRegistered}>
        Registered to <span className={styles.hitOwner}>{owner.display_name}</span>
        {showHandle && (
          <span className={styles.hitOwnerHandle}>{` (@${owner.discord_username})`}</span>
        )}
      </div>
    </GlassCard>
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

function buildShareText(query: string, display: WalletDisplay): string {
  const lines: string[] = [`Wallet lookup "${query}" — ${display.total} match${display.total === 1 ? '' : 'es'}`];
  for (const owner of display.owners) {
    lines.push(`${owner.display_name}: ${owner.wallets.join(', ')}`);
  }
  for (const hit of display.walletHits) {
    lines.push(`${hit.wallet} → ${hit.owner.display_name}`);
  }
  if (display.hiddenCaption !== null) lines.push(display.hiddenCaption);
  return lines.join('\n');
}

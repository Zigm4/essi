/**
 * Wallet lookup data + search (spec §6). `wallets.json` is an array of owner
 * entries linking a display name / Discord handle to one or more WAX wallet
 * strings. GDPR-sensitive - see the return notes; shipped as-is per an explicit
 * product decision.
 */

export interface WalletOwner {
  display_name: string;
  discord_username: string | null;
  wallets: string[];
}

export interface WalletHit {
  wallet: string;
  owner: WalletOwner;
}

export interface WalletSearchResult {
  ownerHits: WalletOwner[];
  /** Wallet hits with an owner already in ownerHits removed. */
  walletHits: WalletHit[];
}

/** Stable identity to dedupe owner-vs-wallet hits. */
export function ownerId(owner: WalletOwner): string {
  return owner.discord_username ?? owner.display_name;
}

/**
 * The Discord handle shown under an owner's name (`@handle`), or null when it
 * is missing or only repeats the name (case-insensitively). The results and
 * the share use the same rule.
 */
export function ownerHandle(owner: WalletOwner): string | null {
  const handle = owner.discord_username;
  if (handle === null || handle.toLowerCase() === owner.display_name.toLowerCase()) return null;
  return `@${handle}`;
}

/** `1 result`, `12 results`. */
export function resultsLabel(total: number): string {
  return `${total} result${total === 1 ? '' : 's'}`;
}

/** `1 wallet`, `2 wallets`. */
export function walletCountLabel(count: number): string {
  return `${count} wallet${count === 1 ? '' : 's'}`;
}

/** Parses the raw JSON; missing `wallets` becomes []; skips non-objects. */
export function parseWallets(raw: unknown): WalletOwner[] {
  if (!Array.isArray(raw)) return [];
  const owners: WalletOwner[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    if (typeof obj.display_name !== 'string') continue;
    const wallets = Array.isArray(obj.wallets)
      ? obj.wallets.filter((w): w is string => typeof w === 'string')
      : [];
    owners.push({
      display_name: obj.display_name,
      discord_username: typeof obj.discord_username === 'string' ? obj.discord_username : null,
      wallets,
    });
  }
  return owners;
}

/**
 * Trimmed, lower-cased search text. A leading "@" is dropped: handles are shown
 * as "@handle" (Discord mention style) but stored without it.
 */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/^@+/, '').trim().toLowerCase();
}

/**
 * `search(query)` (§6.2). Empty query → no results (the overview is shown
 * instead). ownerHits = display_name OR discord_username substring match;
 * walletHits = every (wallet, owner) pair whose wallet contains q, minus pairs
 * whose owner is already an owner hit.
 */
export function search(query: string, owners: WalletOwner[]): WalletSearchResult {
  const q = normalizeQuery(query);
  if (q.length === 0) return { ownerHits: [], walletHits: [] };

  const ownerHits: WalletOwner[] = [];
  for (const owner of owners) {
    const name = owner.display_name.toLowerCase();
    const handle = owner.discord_username?.toLowerCase() ?? '';
    if (name.includes(q) || handle.includes(q)) ownerHits.push(owner);
  }

  const ownerHitIds = new Set(ownerHits.map(ownerId));
  const walletHits: WalletHit[] = [];
  for (const owner of owners) {
    for (const wallet of owner.wallets) {
      if (wallet.toLowerCase().includes(q)) walletHits.push({ wallet, owner });
    }
  }
  const dedupedWalletHits = walletHits.filter((h) => !ownerHitIds.has(ownerId(h.owner)));

  return { ownerHits, walletHits: dedupedWalletHits };
}

export interface WalletStats {
  totalOwners: number;
  totalWallets: number;
  /** wallets / owners to one decimal, e.g. "1.0". */
  avgPerOwner: string;
}

export function walletStats(owners: WalletOwner[]): WalletStats {
  const totalOwners = owners.length;
  const totalWallets = owners.reduce((acc, o) => acc + o.wallets.length, 0);
  const avg = totalOwners === 0 ? 0 : totalWallets / totalOwners;
  return { totalOwners, totalWallets, avgPerOwner: avg.toFixed(1) };
}

export const WALLET_RESULT_CAP = 50;

export interface WalletDisplay {
  owners: WalletOwner[];
  walletHits: WalletHit[];
  total: number;
  shown: number;
  hiddenCaption: string | null;
}

/** Caps the result list at 50 visible items - owner cards first (§6.3). */
export function capResults(result: WalletSearchResult): WalletDisplay {
  const total = result.ownerHits.length + result.walletHits.length;
  const owners = result.ownerHits.slice(0, WALLET_RESULT_CAP);
  const remaining = Math.max(0, WALLET_RESULT_CAP - owners.length);
  const walletHits = result.walletHits.slice(0, remaining);
  const shown = owners.length + walletHits.length;
  return {
    owners,
    walletHits,
    total,
    shown,
    hiddenCaption:
      shown < total
        ? `Showing ${shown} of ${total} matches - refine your search to narrow down.`
        : null,
  };
}

/**
 * In-memory inverted index shared by KB Home search and the global-search KB
 * source (knowledge spec §9). Exact algorithm — do not "improve" the ranking:
 * AND-of-prefix matching with a final alphabetical-by-title sort, no scoring.
 */

/**
 * Tokenizer used for BOTH indexing and queries (§9.1):
 * - lowercase the text;
 * - a token is a maximal run of ASCII alphanumerics (`0-9A-Za-z`); every other
 *   character — punctuation, whitespace, and any non-ASCII letter (accents
 *   split tokens!) — is a separator;
 * - only tokens of length >= 2 are kept.
 */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens: string[] = [];
  let current = '';
  for (let i = 0; i < lower.length; i += 1) {
    const code = lower.charCodeAt(i);
    const isAlnum =
      (code >= 48 && code <= 57) || // 0-9
      (code >= 97 && code <= 122); // a-z (already lowercased)
    if (isAlnum) {
      current += lower[i];
    } else if (current.length >= 2) {
      tokens.push(current);
      current = '';
    } else {
      current = '';
    }
  }
  if (current.length >= 2) tokens.push(current);
  return tokens;
}

export class KBSearchIndex {
  /** token -> set of slugs that contain it. */
  private readonly postings = new Map<string, Set<string>>();
  /** slug -> title, for the final sort. */
  private readonly titles = new Map<string, string>();

  /**
   * Index every field's tokens under `slug`. Fields for an article are its
   * title, full markdown body, each tag, and its category title (§9.1).
   */
  addDocument(slug: string, title: string, fields: readonly string[]): void {
    this.titles.set(slug, title);
    for (const field of fields) {
      for (const token of tokenize(field)) {
        let set = this.postings.get(token);
        if (set === undefined) {
          set = new Set<string>();
          this.postings.set(token, set);
        }
        set.add(slug);
      }
    }
  }

  /**
   * `search(query) -> slug[]` (§9.2): every query token is prefix-matched
   * against the index; results are the intersection (AND) across tokens,
   * finally sorted alphabetically by title (case-sensitive), ties by slug.
   */
  search(query: string): string[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    let result: Set<string> | null = null;
    for (const queryToken of queryTokens) {
      const matches = new Set<string>();
      for (const [token, slugs] of this.postings) {
        if (token.startsWith(queryToken)) {
          for (const slug of slugs) matches.add(slug);
        }
      }
      if (result === null) {
        result = matches;
      } else {
        for (const slug of result) {
          if (!matches.has(slug)) result.delete(slug);
        }
      }
      if (result.size === 0) break;
    }
    if (result === null) return [];

    return [...result].sort((a, b) => {
      const titleA = this.titles.get(a) ?? a;
      const titleB = this.titles.get(b) ?? b;
      if (titleA < titleB) return -1;
      if (titleA > titleB) return 1;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  }
}

/** Domain models for the bundled Knowledge Base (knowledge spec §8). */

export interface KBArticleRef {
  slug: string;
  title: string;
  /** Path relative to `public/knowledge/`, e.g. `01-maps/ratropia.md`. */
  file: string;
  /** Optional in the manifest; defaults to `[]`. */
  tags: string[];
  order: number;
}

export interface KBCategory {
  id: string;
  title: string;
  /** SF-symbol-ish name from the manifest, mapped to an icon per §3.2. */
  icon: string;
  order: number;
  articles: KBArticleRef[];
}

export interface KBArticle {
  slug: string;
  title: string;
  /** Denormalized from the parent category. */
  categoryId: string;
  categoryTitle: string;
  tags: string[];
  markdown: string;
  order: number;
}

/**
 * A draft/scaffold article. Detected purely by the substring `Draft in
 * progress` in the body (knowledge spec §5.5) — there is no manifest flag.
 */
export function isPlaceholderArticle(article: KBArticle): boolean {
  return article.markdown.includes('Draft in progress');
}

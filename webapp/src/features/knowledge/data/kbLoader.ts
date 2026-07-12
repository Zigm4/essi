import { useEffect, useState } from 'react';
import { logError } from '../../../core/logging';
import { KBSearchIndex } from './kbIndex';
import type { KBArticle, KBArticleRef, KBCategory } from './kbModels';

/** Loaded, indexed knowledge base - computed once, cached for the app lifetime. */
export interface KBData {
  /** Sorted by `order` ascending. */
  categories: KBCategory[];
  /** Keyed by slug. */
  articles: Map<string, KBArticle>;
  index: KBSearchIndex;
  /** Articles of a category, sorted by `order` ascending. */
  articlesIn(categoryId: string): KBArticle[];
}

// --- Manifest wire format (public/knowledge/manifest.json) -------------------

interface ManifestArticle {
  slug: string;
  title: string;
  file: string;
  tags?: string[];
  order: number;
}

interface ManifestCategory {
  id: string;
  title: string;
  icon: string;
  order: number;
  articles: ManifestArticle[];
}

interface Manifest {
  categories: ManifestCategory[];
}

/** Build a fetch URL under the site base path for a `public/knowledge/` asset. */
export function knowledgeAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}knowledge/${relativePath}`;
}

function toRef(article: ManifestArticle): KBArticleRef {
  return {
    slug: article.slug,
    title: article.title,
    file: article.file,
    tags: article.tags ?? [],
    order: article.order,
  };
}

async function loadArticleMarkdown(ref: KBArticleRef): Promise<string> {
  try {
    const response = await fetch(knowledgeAssetUrl(ref.file));
    if (!response.ok) throw new Error(`article ${ref.file} -> HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    // Per-file failure: log and substitute a placeholder - the article still
    // appears in lists and the reader (knowledge spec §8.3 step 2).
    logError(error);
    return `# ${ref.title}\n\n(Article content missing.)`;
  }
}

async function loadOnce(): Promise<KBData> {
  const response = await fetch(knowledgeAssetUrl('manifest.json'));
  if (!response.ok) throw new Error(`manifest -> HTTP ${response.status}`);
  const manifest = (await response.json()) as Manifest;

  const categories: KBCategory[] = manifest.categories
    .map((category) => ({
      id: category.id,
      title: category.title,
      icon: category.icon,
      order: category.order,
      articles: category.articles.map(toRef),
    }))
    .sort((a, b) => a.order - b.order);

  const articles = new Map<string, KBArticle>();
  const index = new KBSearchIndex();

  for (const category of categories) {
    for (const ref of category.articles) {
      const markdown = await loadArticleMarkdown(ref);
      const article: KBArticle = {
        slug: ref.slug,
        title: ref.title,
        categoryId: category.id,
        categoryTitle: category.title,
        tags: ref.tags,
        markdown,
        order: ref.order,
      };
      articles.set(article.slug, article);
      index.addDocument(article.slug, article.title, [
        article.title,
        markdown,
        ...article.tags,
        category.title,
      ]);
    }
  }

  return {
    categories,
    articles,
    index,
    articlesIn(categoryId: string): KBArticle[] {
      return [...articles.values()]
        .filter((article) => article.categoryId === categoryId)
        .sort((a, b) => a.order - b.order);
    },
  };
}

let cached: Promise<KBData> | null = null;

/** Memoized loader - every KB view and global search awaits the same instance. */
export function loadKBData(): Promise<KBData> {
  if (cached === null) {
    cached = loadOnce().catch((error: unknown) => {
      // Drop the cache on failure so a later mount can retry (no explicit
      // refresh mechanism exists; a successful load is cached forever).
      cached = null;
      throw error;
    });
  }
  return cached;
}

export type KBLoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: KBData }
  | { status: 'error'; error: unknown };

/** React hook wrapping the memoized loader. */
export function useKBData(): KBLoadState {
  const [state, setState] = useState<KBLoadState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadKBData().then(
      (data) => {
        if (active) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}

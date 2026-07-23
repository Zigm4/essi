import { useParams } from 'react-router-dom';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TagChip } from '../../design-system/components/TagChip';
import { IconTag } from '../../design-system/icons';
import { friendlyError } from '../../core/errorText';
import { FavoriteKind } from '../../data/db';
import { FavoriteButton } from '../favorites/FavoriteButton';
import { useKBData } from './data/kbLoader';
import { KBMarkdownView } from './KBMarkdownView';
import { IconBookmarkBorder, IconBookmarkFilled } from './kbIcons';
import { DetailScaffold } from './components/DetailScaffold';
import { Spinner } from './components/Spinner';
import styles from './KBArticleView.module.css';

/** /knowledge/article/:slug - a knowledge base article (markdown). */
export function KBArticleView() {
  const { slug } = useParams();
  const kb = useKBData();

  if (kb.status === 'loading') {
    return (
      <DetailScaffold title="" bodyPadding="64px 16px 32px">
        <Spinner />
      </DetailScaffold>
    );
  }

  if (kb.status === 'error') {
    return (
      <DetailScaffold title="" bodyPadding="64px 16px 32px">
        <p className={styles.errorText}>{friendlyError(kb.error, "Couldn't load this article.")}</p>
      </DetailScaffold>
    );
  }

  const article = slug !== undefined ? kb.data.articles.get(slug) : undefined;

  // Real dead-end for stale deep links - no spinner (§5.4).
  if (article === undefined) {
    return (
      <DetailScaffold title="" bodyPadding="64px 16px 32px">
        <p className={styles.notFound}>Article not found.</p>
      </DetailScaffold>
    );
  }

  const favoriteAction = (
    <FavoriteButton
      kind={FavoriteKind.kbArticle}
      id={article.slug}
      icon={IconBookmarkBorder}
      activeIcon={IconBookmarkFilled}
      tooltip="Bookmark article"
      activeColor="var(--accent-primary)"
    />
  );

  return (
    <DetailScaffold title={article.title} action={favoriteAction} bodyPadding="64px 16px 32px">
      <div className={styles.kicker}>{article.categoryTitle.toUpperCase()}</div>
      <h1 className={`t-title ${styles.title}`}>{article.title}</h1>
      <div className={styles.markdown}>
        <KBMarkdownView markdown={article.markdown} />
      </div>

      {article.tags.length > 0 && (
        <>
          <hr className={styles.divider} />
          <SectionHeader className={styles.tagsHeader} title="Tags" icon={<IconTag size={18} />} />
          <div className={styles.tags}>
            {article.tags.map((tag) => (
              <TagChip key={tag} label={tag} onTap={() => undefined} />
            ))}
          </div>
        </>
      )}
    </DetailScaffold>
  );
}

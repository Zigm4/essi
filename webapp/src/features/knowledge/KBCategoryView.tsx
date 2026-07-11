import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { TagChip } from '../../design-system/components/TagChip';
import { IconChevronRight } from '../../design-system/icons';
import { friendlyError } from '../../core/errorText';
import type { KBArticle, KBCategory } from './data/kbModels';
import { useKBData } from './data/kbLoader';
import { categoryRowIcon } from './kbCategoryIcon';
import { DetailScaffold } from './components/DetailScaffold';
import { Spinner } from './components/Spinner';
import styles from './KBCategoryView.module.css';

function ArticleRow({ article, category }: { article: KBArticle; category: KBCategory }) {
  const navigate = useNavigate();
  return (
    <GlassCard
      className={styles.card}
      onTap={() => navigate(`/knowledge/article/${article.slug}`)}
      ariaLabel={article.title}
    >
      <div className={styles.row}>
        <span className={styles.icon}>{categoryRowIcon(category.icon, 22)}</span>
        <div className={styles.text}>
          <div className="t-headline">{article.title}</div>
          {article.tags.length > 0 && (
            <div className={styles.tags}>
              {article.tags.map((tag) => (
                <TagChip key={tag} label={tag} onTap={() => undefined} />
              ))}
            </div>
          )}
        </div>
        <span className={styles.chevron}>
          <IconChevronRight size={24} />
        </span>
      </div>
    </GlassCard>
  );
}

/** /knowledge/category/:id — a knowledge base category. */
export function KBCategoryView() {
  const { id } = useParams();
  const kb = useKBData();

  if (kb.status === 'loading') {
    return (
      <DetailScaffold title="" bodyPadding="64px 12px 32px">
        <Spinner />
      </DetailScaffold>
    );
  }

  if (kb.status === 'error') {
    return (
      <DetailScaffold title="" bodyPadding="64px 12px 32px">
        <p className={styles.errorText}>{friendlyError(kb.error, "Couldn't load this category.")}</p>
      </DetailScaffold>
    );
  }

  // Unknown :id falls back to the first category (firstWhere orElse first, §4.1).
  const category = kb.data.categories.find((c) => c.id === id) ?? kb.data.categories[0];
  if (category === undefined) {
    return (
      <DetailScaffold title="" bodyPadding="64px 12px 32px">
        <p className={styles.empty}>No articles yet in this category.</p>
      </DetailScaffold>
    );
  }

  const articles = kb.data.articlesIn(category.id);

  return (
    <DetailScaffold title={category.title} bodyPadding="64px 12px 32px">
      {articles.length === 0 ? (
        <p className={styles.empty}>No articles yet in this category.</p>
      ) : (
        <div className={styles.list}>
          {articles.map((article) => (
            <ArticleRow key={article.slug} article={article} category={category} />
          ))}
        </div>
      )}
    </DetailScaffold>
  );
}

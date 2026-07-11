import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BannerPage } from '../../design-system/components/BannerPage';
import { PageScrollView } from '../../design-system/components/PageScrollView';
import { GlassCard } from '../../design-system/components/GlassCard';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TagChip } from '../../design-system/components/TagChip';
import { IconChevronRight, IconKnowledge, IconMap, IconSearch } from '../../design-system/icons';
import { friendlyError } from '../../core/errorText';
import type { KBArticle, KBCategory } from './data/kbModels';
import { useKBData } from './data/kbLoader';
import { homeCategoryIcon } from './kbCategoryIcon';
import { IconEditNote } from './kbIcons';
import { SearchField } from './components/SearchField';
import { Spinner } from './components/Spinner';
import styles from './KBHomeView.module.css';

function articleCountLabel(n: number): string {
  return `${n} article${n === 1 ? '' : 's'}`;
}

/** Header-only touch point into the interactive maps gallery. The full
 * MapsHomeSection (map cards, seed import, error state) belongs to the maps
 * spec and its owning agent; this row provides the documented navigation. */
function InteractiveMapsSection() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={styles.mapsHeader}
      onClick={() => navigate('/knowledge/maps')}
    >
      <span className={styles.mapsIcon}>
        <IconMap size={18} />
      </span>
      <span className={styles.kicker}>Interactive maps</span>
      <span className={styles.viewAll}>View all</span>
      <span className={styles.mapsChevron}>
        <IconChevronRight size={18} />
      </span>
    </button>
  );
}

function DraftsBanner() {
  return (
    <GlassCard className={styles.drafts}>
      <div className={styles.draftsRow}>
        <span className={styles.draftsIcon}>
          <IconEditNote size={18} />
        </span>
        <div className={styles.draftsBody}>
          <div className="t-headline">Drafts in progress</div>
          <p className={styles.draftsCaption}>
            Every article here is a working draft. Writing takes time, so expect missing sections,
            light tables, and updates over the next builds.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function CategoryCard({ category }: { category: KBCategory }) {
  const navigate = useNavigate();
  return (
    <GlassCard
      className={styles.card}
      onTap={() => navigate(`/knowledge/category/${category.id}`)}
      ariaLabel={category.title}
    >
      <div className={styles.categoryRow}>
        <span className={styles.categoryIcon}>{homeCategoryIcon(category.icon, 26)}</span>
        <div className={styles.categoryText}>
          <div className="t-headline">{category.title}</div>
          <div className={styles.countCaption}>{articleCountLabel(category.articles.length)}</div>
        </div>
        <span className={styles.chevron}>
          <IconChevronRight size={20} />
        </span>
      </div>
    </GlassCard>
  );
}

function ResultCard({ article }: { article: KBArticle }) {
  const navigate = useNavigate();
  return (
    <GlassCard
      className={styles.card}
      onTap={() => navigate(`/knowledge/article/${article.slug}`)}
      ariaLabel={article.title}
    >
      <div className={styles.resultKicker}>{article.categoryTitle.toUpperCase()}</div>
      <div className={`t-headline ${styles.resultTitle}`}>{article.title}</div>
      {article.tags.length > 0 && (
        <div className={styles.tags}>
          {article.tags.map((tag) => (
            <TagChip key={tag} label={tag} onTap={() => undefined} />
          ))}
        </div>
      )}
    </GlassCard>
  );
}

/** /knowledge — knowledge base home (Knowledge tab). */
export function KBHomeView() {
  const [query, setQuery] = useState('');
  const kb = useKBData();
  const trimmedIsEmpty = query.length === 0;

  return (
    <BannerPage bannerLabel="ESSI · Archive & Doctrine">
      <PageScrollView padding="12px 12px 32px">
        <div className={styles.searchField}>
          <SearchField value={query} onChange={setQuery} placeholder="Search articles" />
        </div>

        {kb.status === 'loading' && <Spinner />}

        {kb.status === 'error' && (
          <p className={styles.errorText}>{friendlyError(kb.error, "Couldn't load the knowledge base.")}</p>
        )}

        {kb.status === 'ready' && trimmedIsEmpty && (
          <>
            <div className={styles.mapsSection}>
              <InteractiveMapsSection />
            </div>
            <DraftsBanner />
            <SectionHeader
              className={styles.sectionHeader}
              title="Library"
              icon={<IconKnowledge size={18} />}
            />
            <div className={styles.list}>
              {kb.data.categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </>
        )}

        {kb.status === 'ready' && !trimmedIsEmpty && (
          <>
            <SectionHeader
              className={styles.sectionHeader}
              title="Results"
              icon={<IconSearch size={18} />}
            />
            {(() => {
              const slugs = kb.data.index.search(query);
              const articles = slugs
                .map((slug) => kb.data.articles.get(slug))
                .filter((a): a is KBArticle => a !== undefined);
              if (articles.length === 0) {
                return <p className={styles.noMatches}>No matches.</p>;
              }
              return (
                <div className={styles.list}>
                  {articles.map((article) => (
                    <ResultCard key={article.slug} article={article} />
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </PageScrollView>
    </BannerPage>
  );
}

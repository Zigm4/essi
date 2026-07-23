import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BannerPage } from '../../design-system/components/BannerPage';
import { PageScrollView } from '../../design-system/components/PageScrollView';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TagChip } from '../../design-system/components/TagChip';
import {
  IconChevronRight,
  IconForum,
  IconKnowledge,
  IconMailOutline,
  IconMap,
  IconPublic,
  IconSearch,
} from '../../design-system/icons';
import { Haptics } from '../../core/haptics';
import { discordInviteUrl } from '../../core/constants';
import { showSnackbar } from '../../core/snackbar';
import { friendlyError } from '../../core/errorText';
import type { KBArticle, KBArticleRef, KBCategory } from './data/kbModels';
import { useKBData } from './data/kbLoader';
import { homeCategoryIcon } from './kbCategoryIcon';
import { IconTravelExplore, IconVolunteerActivism } from './kbIcons';
import { loadInstalledManifest } from './maps/data/repository';
import { ensureSeedImported } from './maps/data/seedImporter';
import type { MapDescriptor } from './maps/model/types';
import { SearchField } from './components/SearchField';
import { Spinner } from './components/Spinner';
import styles from './KBHomeView.module.css';

function articleCountLabel(n: number): string {
  return `${n} article${n === 1 ? '' : 's'}`;
}

/** The installed interactive maps, listed inline on the Knowledge home (no gallery). */
function MapsList() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MapDescriptor[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureSeedImported(); // idempotent
        const manifest = await loadInstalledManifest();
        if (!cancelled && manifest !== null) {
          setMaps([...manifest.maps].filter((m) => !m.draft).sort((a, b) => a.order - b.order));
        }
      } catch {
        /* leave the list empty; the KB still loads */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (maps.length === 0) return null;
  return (
    <div className={styles.mapsList}>
      {maps.map((m) => (
        <GlassCard
          key={m.id}
          className={styles.card}
          onTap={() => navigate(`/knowledge/maps/${encodeURIComponent(m.id)}`)}
          ariaLabel={m.title}
        >
          <div className={styles.categoryRow}>
            <span className={styles.categoryIcon}>
              {m.icon === 'sphere' ? <IconPublic size={26} /> : <IconMap size={26} />}
            </span>
            <div className={styles.categoryText}>
              <div className="t-headline">{m.title}</div>
              {m.subtitle !== null && m.subtitle.length > 0 && (
                <div className={styles.countCaption}>{m.subtitle}</div>
              )}
            </div>
            <span className={styles.chevron}>
              <IconChevronRight size={20} />
            </span>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

/** Map-related KB articles (e.g. APMs) surfaced under the Maps section. */
function MapReferences({ articles }: { articles: readonly KBArticleRef[] }) {
  const navigate = useNavigate();
  if (articles.length === 0) return null;
  return (
    <div className={styles.references}>
      <span className={styles.refHeader}>Field notes</span>
      <div className={styles.mapsList}>
        {articles.map((article) => (
          <GlassCard
            key={article.slug}
            className={styles.card}
            onTap={() => navigate(`/knowledge/article/${encodeURIComponent(article.slug)}`)}
            ariaLabel={article.title}
          >
            <div className={styles.categoryRow}>
              <span className={styles.refIcon}>
                <IconTravelExplore size={24} />
              </span>
              <div className={styles.categoryText}>
                <div className="t-headline">{article.title}</div>
                <div className={styles.countCaption}>Reference</div>
              </div>
              <span className={styles.chevron}>
                <IconChevronRight size={20} />
              </span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

/** Root-level draft notice + contribution call (moved off individual articles). */
function ContributeBanner() {
  const navigate = useNavigate();
  const openContact = (): void => {
    navigate('/menu/contact', {
      state: {
        initialMessage:
          'Contributing intel for the ESSI knowledge base.\n\nArticle / section: \nWhat I know: \n',
      },
    });
  };
  const openDiscord = (): void => {
    Haptics.tap();
    const opened = window.open(discordInviteUrl, '_blank', 'noopener,noreferrer');
    if (opened === null) showSnackbar("Couldn't open Discord - try again", { danger: true });
  };

  return (
    <GlassCard className={styles.contribute}>
      <SectionHeader title="Contribute intel" icon={<IconVolunteerActivism size={18} />} />
      <p className={styles.contributeCaption}>
        Every article here is a working draft - expect missing sections and updates over the next
        builds. If you have first-hand info, corrections or screenshots, send them in and help fill
        it out.
      </p>
      <NeonButton
        className={styles.contributeButton}
        title="Contribute intel"
        icon={<IconMailOutline size={18} />}
        onPressed={openContact}
      />
      <button type="button" className={styles.discord} onClick={openDiscord}>
        <IconForum size={16} />
        <span>or discuss on Discord</span>
      </button>
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

/** /knowledge - knowledge base home (Knowledge tab). */
export function KBHomeView() {
  const [query, setQuery] = useState('');
  const kb = useKBData();
  const trimmedIsEmpty = query.length === 0;

  const mapArticles =
    kb.status === 'ready' ? (kb.data.categories.find((c) => c.id === 'maps')?.articles ?? []) : [];

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
            <SectionHeader
              className={styles.sectionHeader}
              title="Maps"
              icon={<IconMap size={18} />}
            />
            <MapsList />
            <MapReferences articles={mapArticles} />

            <SectionHeader
              className={styles.sectionHeader}
              title="Library"
              icon={<IconKnowledge size={18} />}
            />
            <div className={styles.list}>
              {kb.data.categories
                .filter((category) => category.id !== 'maps')
                .map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
            </div>

            <ContributeBanner />
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

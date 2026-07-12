import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../../design-system/components/GlassCard';
import { NeonButton } from '../../design-system/components/NeonButton';
import { SectionHeader } from '../../design-system/components/SectionHeader';
import { TagChip } from '../../design-system/components/TagChip';
import { IconForum, IconMailOutline, IconTag } from '../../design-system/icons';
import { Haptics } from '../../core/haptics';
import { friendlyError } from '../../core/errorText';
import { discordInviteUrl } from '../../core/constants';
import { showSnackbar } from '../../core/snackbar';
import { FavoriteKind } from '../../data/db';
import { FavoriteButton } from '../favorites/FavoriteButton';
import type { KBArticle } from './data/kbModels';
import { isPlaceholderArticle } from './data/kbModels';
import { useKBData } from './data/kbLoader';
import { KBMarkdownView } from './KBMarkdownView';
import {
  IconBookmarkBorder,
  IconBookmarkFilled,
  IconVolunteerActivism,
} from './kbIcons';
import { DetailScaffold } from './components/DetailScaffold';
import { Spinner } from './components/Spinner';
import styles from './KBArticleView.module.css';

function ContributeCard({ article }: { article: KBArticle }) {
  const navigate = useNavigate();

  const openContact = (): void => {
    const initialMessage = `Contributing intel for the KB article "${article.title}" (${article.slug}).\n\nSection: \nWhat I know: \n`;
    navigate('/menu/contact', { state: { initialMessage } });
  };

  const openDiscord = (): void => {
    Haptics.tap();
    const opened = window.open(discordInviteUrl, '_blank', 'noopener,noreferrer');
    if (opened === null) {
      showSnackbar("Couldn't open Discord - try again", { danger: true });
    }
  };

  return (
    <GlassCard className={styles.contribute}>
      <SectionHeader title="Contribute intel" icon={<IconVolunteerActivism size={18} />} />
      <p className={styles.contributeCaption}>
        This article is still a draft. If you have first-hand info, corrections or screenshots, send
        them in and help fill it out.
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

      {isPlaceholderArticle(article) && (
        <div className={styles.contributeWrap}>
          <ContributeCard article={article} />
        </div>
      )}

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

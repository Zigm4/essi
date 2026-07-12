import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { resolveLink } from '../../core/internalLink';
import { logError } from '../../core/logging';
import { knowledgeAssetUrl } from './data/kbLoader';
import { IconBrokenImage } from './kbIcons';
import styles from './KBMarkdownView.module.css';

/** 120px tile shown for rejected / failed images (§6.3 brokenImageTile). */
function BrokenImageTile() {
  return (
    <span className={styles.brokenTile}>
      <IconBrokenImage size={28} />
    </span>
  );
}

/**
 * Image renderer, reimplementing §6.3 exactly:
 * - `http://`  -> rejected outright (broken tile);
 * - `https://` -> network image (spinner while loading, broken tile on error);
 * - relative   -> bundled asset under `knowledge/images/` (lazy, async decode,
 *                 width-constrained per audit R7), broken tile on error.
 */
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const raw = (src ?? '').trim();
  const lower = raw.toLowerCase();

  let resolved: string | null;
  if (lower.startsWith('http://')) {
    resolved = null;
  } else if (lower.startsWith('https://')) {
    resolved = raw;
  } else {
    const clean = raw.startsWith('./') ? raw.slice(2) : raw;
    const base = clean.startsWith('images/') ? clean : `images/${clean}`;
    resolved = knowledgeAssetUrl(base);
  }

  if (resolved === null || status === 'error') return <BrokenImageTile />;

  return (
    <span className={`${styles.imageWrap} ${status === 'loading' ? styles.imageWrapLoading : ''}`}>
      {status === 'loading' && <span className={styles.imageSpinner} aria-hidden="true" />}
      <img
        className={styles.image}
        src={resolved}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => {
          logError(new Error(`KB image failed to load: ${resolved ?? raw}`));
          setStatus('error');
        }}
      />
    </span>
  );
}

/**
 * Themed markdown renderer for KB articles (knowledge spec §6). Element styling
 * lives in the CSS module; only links (internal/external resolution), images,
 * and tables (horizontal scroll wrapper) need custom components. Raw HTML is
 * NOT enabled (no rehype-raw) - content is trusted markdown only.
 *
 * `urlTransform` is neutralized so the custom `underdeck://` scheme and relative
 * image paths survive react-markdown's default sanitizer; link clicks are still
 * routed through the http/https/mailto allow-list in `resolveLink`.
 */
export function KBMarkdownView({ markdown }: { markdown: string }) {
  const navigate = useNavigate();

  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        return (
          <a
            className={styles.link}
            href={href ?? undefined}
            onClick={(event) => {
              event.preventDefault();
              if (href !== undefined && href !== null && href.length > 0) {
                resolveLink(href, (to) => navigate(to));
              }
            }}
          >
            {children}
          </a>
        );
      },
      img({ src, alt }) {
        return (
          <MarkdownImage
            src={typeof src === 'string' ? src : undefined}
            alt={typeof alt === 'string' ? alt : undefined}
          />
        );
      },
      table({ children }) {
        return (
          <div className={styles.tableWrap}>
            <table>{children}</table>
          </div>
        );
      },
    }),
    [navigate],
  );

  return (
    <div className={styles.markdown}>
      <Markdown remarkPlugins={[remarkGfm]} urlTransform={(url) => url} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}

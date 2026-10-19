import { useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { launchExternal } from '../../../core/externalLink';
import { markdownImageSource } from '../logic';
import { IconImage } from './icons';
import styles from './MarkdownView.module.css';

/**
 * EssiMarkdownView (spec §16). CommonMark + GFM, rendered read-only for
 * note bodies and link notes on the DETAIL pages only. No raw HTML is rendered
 * (react-markdown ignores it by default), and every link tap is routed through
 * `launchExternal`'s http/https/mailto allow-list (spec §18.7) - never a raw
 * window.open of an arbitrary scheme. Images from other hosts only load on tap.
 */

/**
 * A markdown image (spec §16): scaled to the card width; one from another host
 * shows as an "Image from host · Show" button until tapped, then loads without
 * a referrer.
 */
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [state, setState] = useState<'idle' | 'shown' | 'failed'>('idle');
  const source = markdownImageSource(src, window.location.href);
  const label = alt ?? '';

  if (source.kind === 'none') {
    return label !== '' ? <span className={styles.imageAlt}>{label}</span> : null;
  }

  if (source.kind === 'local' || state === 'shown') {
    return (
      <img
        src={source.src}
        alt={label}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={source.kind === 'remote' ? () => setState('failed') : undefined}
      />
    );
  }

  const failed = state === 'failed';
  return (
    <button
      type="button"
      className={styles.imageButton}
      title={label !== '' ? label : undefined}
      aria-label={`${failed ? 'Retry image' : 'Show image'} from ${source.host}`}
      onClick={(e) => {
        // The image may sit inside a link: show it, don't follow the link.
        e.preventDefault();
        e.stopPropagation();
        setState('shown');
      }}
    >
      <span className={styles.imageIcon}>
        <IconImage size={16} />
      </span>
      <span className={styles.imageText}>
        {failed ? "Couldn't load image from " : 'Image from '}
        <span className={styles.imageHost}>{source.host}</span>
      </span>
      <span className={styles.imageAction}>{failed ? 'Retry' : 'Show'}</span>
    </button>
  );
}

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href ?? '#'}
      onClick={(e) => {
        e.preventDefault();
        if (typeof href === 'string' && href.length > 0) launchExternal(href);
      }}
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} />
  ),
};

export function MarkdownView({ source }: { source: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}

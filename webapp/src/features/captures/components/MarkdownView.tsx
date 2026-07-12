import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { launchExternal } from '../../../core/externalLink';
import styles from './MarkdownView.module.css';

/**
 * EssiMarkdownView (spec §16). CommonMark + GFM, rendered read-only for
 * note bodies and link notes on the DETAIL pages only. No raw HTML is rendered
 * (react-markdown ignores it by default), and every link tap is routed through
 * `launchExternal`'s http/https/mailto allow-list (spec §18.7) - never a raw
 * window.open of an arbitrary scheme.
 */

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

import type { TagModel } from '../models';
import { TagPill } from './TagPill';
import styles from './ChipScroller.module.css';

/**
 * Horizontally scrollable row of read-only tag chips (cards + detail meta
 * rows). `reverse` right-aligns and shows the start of the list at the right
 * edge, matching the Flutter `reverse` ListView (spec §10 / §12).
 */
export function ChipScroller({
  tags,
  reverse = false,
}: {
  tags: readonly TagModel[];
  reverse?: boolean;
}) {
  if (tags.length === 0) return null;
  return (
    <div className={`${styles.row} ${reverse ? styles.reverse : ''}`}>
      {tags.map((tag) => (
        <TagPill key={tag.id} label={tag.displayName} />
      ))}
    </div>
  );
}

import type { ReactNode } from 'react';
import { friendlyError } from '../../../core/errorText';
import { PageScrollView } from '../../../design-system/components/PageScrollView';
import { IconSearch } from '../../../design-system/icons';
import type { ListEmptyKind } from '../logic';
import type { TagModel } from '../models';
import { TagPill } from './TagPill';
import styles from './CaptureListShell.module.css';

/**
 * Shared chrome for the Notes and Links lists (spec §6/§7): async matrix
 * (spinner / red error / data), search field, tag-filter row and empty states.
 * The filtered card list is passed as `children`. When the tag filter hides
 * every item, the empty state says so and offers to clear the filters rather
 * than claiming there's nothing saved.
 */
export function CaptureListShell({
  loading,
  error,
  errorFallback,
  searchPlaceholder,
  search,
  onSearchChange,
  allTags,
  selectedTagIds,
  onToggleTag,
  isEmpty,
  emptyKind,
  onClearFilters,
  emptyIcon,
  emptyTitleNone,
  emptyCaptionNone,
  children,
}: {
  loading: boolean;
  error: unknown;
  errorFallback: string;
  searchPlaceholder: string;
  search: string;
  onSearchChange: (value: string) => void;
  allTags: readonly TagModel[];
  selectedTagIds: ReadonlySet<string>;
  onToggleTag: (id: string) => void;
  isEmpty: boolean;
  emptyKind: ListEmptyKind;
  onClearFilters: () => void;
  emptyIcon: ReactNode;
  emptyTitleNone: string;
  emptyCaptionNone: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className={styles.centered}>
        <span className={styles.spinner} aria-label="Loading" role="status" />
      </div>
    );
  }

  if (error !== undefined) {
    return (
      <div className={styles.centered}>
        <p className={styles.errorText}>{friendlyError(error, errorFallback)}</p>
      </div>
    );
  }

  return (
    <PageScrollView>
      <div className={styles.content}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <IconSearch size={18} />
          </span>
          <input
            type="text"
            className={styles.searchInput}
            value={search}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {allTags.length > 0 && (
          <div className={styles.tagRow}>
            {allTags.map((tag) => (
              <TagPill
                key={tag.id}
                label={tag.displayName}
                selected={selectedTagIds.has(tag.id)}
                onTap={() => onToggleTag(tag.id)}
              />
            ))}
          </div>
        )}

        <div className={styles.spacer8} />

        {isEmpty ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>{emptyIcon}</span>
            <div className={styles.emptyTitle}>
              {emptyKind === 'none' ? emptyTitleNone : 'No matches'}
            </div>
            <div className={styles.emptyCaption}>
              {emptyKind === 'none'
                ? emptyCaptionNone
                : emptyKind === 'search'
                  ? 'Try a different search.'
                  : 'Nothing matches your filters.'}
            </div>
            {emptyKind === 'tags' && (
              <button type="button" className={styles.emptyAction} onClick={onClearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className={styles.list}>{children}</div>
        )}
      </div>
    </PageScrollView>
  );
}

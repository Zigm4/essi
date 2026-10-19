import type { LinkModel, NoteModel } from './models';

/**
 * Pure, side-effect-free business logic for Captures. Everything here mirrors
 * the algorithms in the spec so it can be unit-tested without a DB.
 */

// --- List filtering (spec §6 / §7) -------------------------------------------

/**
 * Notes filter (spec §6):
 *   search = lowercase(rawInput)   // NOT trimmed
 *   keep if (search=='' OR title~search OR body~search)
 *         AND (selected empty OR any tag id in selected)
 */
export function filterNotes(
  notes: readonly NoteModel[],
  rawSearch: string,
  selectedTagIds: ReadonlySet<string>,
): NoteModel[] {
  const search = rawSearch.toLowerCase();
  return notes.filter((note) => {
    const textOk =
      search === '' ||
      note.title.toLowerCase().includes(search) ||
      note.body.toLowerCase().includes(search);
    if (!textOk) return false;
    if (selectedTagIds.size === 0) return true;
    return note.tags.some((t) => selectedTagIds.has(t.id));
  });
}

/**
 * Links filter (spec §7): text match spans title, url and note.
 */
export function filterLinks(
  links: readonly LinkModel[],
  rawSearch: string,
  selectedTagIds: ReadonlySet<string>,
): LinkModel[] {
  const search = rawSearch.toLowerCase();
  return links.filter((link) => {
    const textOk =
      search === '' ||
      link.title.toLowerCase().includes(search) ||
      link.url.toLowerCase().includes(search) ||
      link.note.toLowerCase().includes(search);
    if (!textOk) return false;
    if (selectedTagIds.size === 0) return true;
    return link.tags.some((t) => selectedTagIds.has(t.id));
  });
}

/**
 * Which empty state a list shows when nothing is left to display (spec §6.4):
 * - `tags`: items exist but the tag filter (maybe with a search) hides them all,
 *   so the list offers to clear the filters instead of claiming it's empty;
 * - `search`: a search query matches nothing;
 * - `none`: there's nothing to show at all.
 */
export type ListEmptyKind = 'none' | 'search' | 'tags';

export function listEmptyKind(
  totalCount: number,
  rawSearch: string,
  tagFilterActive: boolean,
): ListEmptyKind {
  if (tagFilterActive && totalCount > 0) return 'tags';
  if (rawSearch !== '') return 'search';
  return 'none';
}

// --- Tag input (spec §15) ----------------------------------------------------

export const MAX_TAG_SUGGESTIONS = 6;

/**
 * Suggestion algorithm (spec §15):
 *   raw = lowercase(trim(input)); if raw=='' → none
 *   else first 6 pool entries where lowercase(pool).contains(raw)
 *        AND pool not already selected (exact match).
 */
export function computeTagSuggestions(
  suggestionPool: readonly string[],
  selectedTags: readonly string[],
  input: string,
): string[] {
  const raw = input.trim().toLowerCase();
  if (raw === '') return [];
  const selected = new Set(selectedTags);
  const out: string[] = [];
  for (const candidate of suggestionPool) {
    if (out.length >= MAX_TAG_SUGGESTIONS) break;
    if (selected.has(candidate)) continue;
    if (candidate.toLowerCase().includes(raw)) out.push(candidate);
  }
  return out;
}

/**
 * `_add(tag)` (spec §15): ignore blank; ignore if a selected tag already equals
 * it case-insensitively; else append (insertion order preserved). Returns a new
 * array (never mutates the input).
 */
export function addTag(selectedTags: readonly string[], raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed === '') return [...selectedTags];
  const key = trimmed.toLowerCase();
  if (selectedTags.some((t) => t.toLowerCase() === key)) return [...selectedTags];
  return [...selectedTags, trimmed];
}

/** Remove a tag by exact string match (the editor's remove ✕). */
export function removeTag(selectedTags: readonly string[], tag: string): string[] {
  return selectedTags.filter((t) => t !== tag);
}

/**
 * Commit token = `trim(text.replaceAll(',', ''))` (spec §15), minus any leading
 * `#` so a pasted "#intel" gives the tag "intel".
 */
export function commitTokenText(text: string): string {
  return text.replace(/,/g, '').trim().replace(/^#+\s*/, '');
}

/** Tag separators (spec §15): commas and any whitespace, newlines included. */
const TAG_SEPARATORS = /[\s,]+/;

/**
 * Splits raw tag-field text on separators (spec §15). Every complete token is a
 * tag; the fragment after the last separator stays in the field. Pasting
 * "intel, mars trade" gives the tags intel and mars, with "trade" still typed -
 * never the single tag "intel mars trade".
 */
export function splitTagInput(text: string): { tokens: string[]; pending: string } {
  const parts = text.split(TAG_SEPARATORS);
  const pending = parts.pop() ?? '';
  const tokens = parts.map(commitTokenText).filter((t) => t !== '');
  return { tokens, pending };
}

/** Every tag in `text`, the trailing fragment included (Enter / Save, spec §15). */
export function tagTokens(text: string): string[] {
  return text
    .split(TAG_SEPARATORS)
    .map(commitTokenText)
    .filter((t) => t !== '');
}

/**
 * The tag-field text after pasting `text` over [start, end), or null when the
 * browser can paste it as is. A single-line input may drop pasted newlines
 * ("intel\nmars" → "intelmars"), so they become separators first.
 */
export function pastedTagText(
  current: string,
  start: number,
  end: number,
  text: string,
): string | null {
  if (!/[\r\n]/.test(text)) return null;
  return current.slice(0, start) + text.replace(/[\r\n]+/g, ' ') + current.slice(end);
}

/** `addTag` for each token in turn (duplicates and blanks ignored). */
export function addTags(selectedTags: readonly string[], tokens: readonly string[]): string[] {
  let next = [...selectedTags];
  for (const token of tokens) next = addTag(next, token);
  return next;
}

/**
 * Ordered, case-insensitive dedupe of the editor's raw display-name list
 * (the first half of `_resolveTags`, spec §18.1). Blanks are dropped, order
 * is preserved, and the first spelling of each key wins.
 */
export function dedupeTagInputs(displayNames: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of displayNames) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

// --- Backup reminder (spec §17) ----------------------------------------------

export const REMINDER_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface BackupStatus {
  /** Any user data at all (COUNT over the 9 tracked tables > 0). */
  hasData: boolean;
  /** Max change timestamp across tables in epoch ms, or null when none. */
  lastChangedAt: number | null;
}

export interface ReminderInputs {
  status: BackupStatus;
  lastBackupAt: number | null;
  snoozedUntil: number | null;
  now: number;
}

/**
 * Whether to surface the "back up your data" reminder. Proactive: it shows as
 * soon as the user has ANY data that has never been exported (or has changed
 * since the last export), unless the reminder is currently snoozed. There is no
 * 30-day grace period - the whole point is to warn before an uninstall wipes
 * data the user never saved to a file.
 *
 *   show = hasData
 *     AND NOT (snoozedUntil != null AND now < snoozedUntil)
 *     AND (lastBackupAt == null OR lastChangedAt == null OR lastChangedAt > lastBackupAt)
 */
export function shouldShowReminder({
  status,
  lastBackupAt,
  snoozedUntil,
  now,
}: ReminderInputs): boolean {
  if (!status.hasData) return false;
  if (snoozedUntil !== null && now < snoozedUntil) return false;
  const changedSinceBackup =
    lastBackupAt === null ||
    status.lastChangedAt === null ||
    status.lastChangedAt > lastBackupAt;
  return changedSinceBackup;
}

/**
 * `lastBackupLabel` (spec §17):
 *   daysSince = max(0, floor((now - lastBackupAt) in days))
 *   null → 'never backed up'; 0 → 'backed up today';
 *   1 → 'last backup yesterday'; n → 'last backup {n} days ago'.
 */
export function lastBackupLabel(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt === null) return 'never backed up';
  const daysSince = Math.max(0, Math.floor((now - lastBackupAt) / (24 * 60 * 60 * 1000)));
  if (daysSince === 0) return 'backed up today';
  if (daysSince === 1) return 'last backup yesterday';
  return `last backup ${daysSince} days ago`;
}

// --- Markdown images (spec §16) ----------------------------------------------

export type MarkdownImageSource =
  | { kind: 'local'; src: string }
  | { kind: 'remote'; src: string; host: string }
  | { kind: 'none' };

/**
 * How a markdown image may load (spec §16). The app's own images load as usual;
 * an http(s) image from any other host waits for a tap, so a note imported
 * from someone else's backup can't fetch a tracking pixel behind the user's
 * back. Anything else - react-markdown blanks `javascript:`, `data:` and other
 * unsafe schemes - doesn't load at all.
 */
export function markdownImageSource(
  src: string | null | undefined,
  pageUrl: string,
): MarkdownImageSource {
  const raw = src?.trim() ?? '';
  if (raw === '') return { kind: 'none' };
  let url: URL;
  try {
    url = new URL(raw, pageUrl);
  } catch {
    return { kind: 'none' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { kind: 'none' };
  if (url.origin === new URL(pageUrl).origin) return { kind: 'local', src: url.href };
  return { kind: 'remote', src: url.href, host: url.hostname };
}

// --- Discord detection (spec §18.8) ------------------------------------------

/** Plain, case-sensitive substring test used only to swap the link icon. */
export function isDiscordUrl(url: string): boolean {
  return url.includes('discord');
}

/**
 * The tag filter actually in force: the stored selection minus tags that no
 * longer exist. Deleting the last note with a selected tag removes the tag (and
 * its chip); without this, its id stayed selected and hid every note with no
 * way to clear it.
 */
export function liveTagSelection(
  selected: ReadonlySet<string>,
  existingTags: readonly { id: string }[] | undefined,
): ReadonlySet<string> {
  if (existingTags === undefined || selected.size === 0) return selected;
  const existing = new Set(existingTags.map((t) => t.id));
  const live = [...selected].filter((id) => existing.has(id));
  return live.length === selected.size ? selected : new Set(live);
}

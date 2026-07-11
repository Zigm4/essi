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

/** Commit token = `trim(text.replaceAll(',', ''))` (spec §15). */
export function commitTokenText(text: string): string {
  return text.replace(/,/g, '').trim();
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
 * `BackupReminder.shouldShowReminder` (spec §17):
 *   show = hasData
 *     AND NOT (snoozedUntil != null AND now < snoozedUntil)
 *     AND (lastBackupAt == null OR lastChangedAt == null OR lastChangedAt > lastBackupAt)
 *     AND (lastBackupAt == null OR now - lastBackupAt >= 30 days)
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
  if (!changedSinceBackup) return false;
  const staleEnough = lastBackupAt === null || now - lastBackupAt >= REMINDER_THRESHOLD_MS;
  return staleEnough;
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

// --- Discord detection (spec §18.8) ------------------------------------------

/** Plain, case-sensitive substring test used only to swap the link icon. */
export function isDiscordUrl(url: string): boolean {
  return url.includes('discord');
}

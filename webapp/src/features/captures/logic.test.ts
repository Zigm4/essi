import { describe, expect, it } from 'vitest';
import type { LinkModel, NoteModel, TagModel } from './models';
import {
  addTag,
  commitTokenText,
  computeTagSuggestions,
  dedupeTagInputs,
  filterLinks,
  filterNotes,
  isDiscordUrl,
  lastBackupLabel,
  removeTag,
  shouldShowReminder,
} from './logic';

const DAY = 24 * 60 * 60 * 1000;

function tag(id: string, displayName: string): TagModel {
  return { id, displayName, name: displayName.toLowerCase(), colorHex: null };
}

function note(partial: Partial<NoteModel> & { id: string }): NoteModel {
  return {
    title: '',
    body: '',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    tags: [],
    ...partial,
  };
}

function link(partial: Partial<LinkModel> & { id: string }): LinkModel {
  return {
    title: '',
    url: '',
    note: '',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    tags: [],
    ...partial,
  };
}

describe('filterNotes', () => {
  const salvage = tag('t1', 'Salvage');
  const combat = tag('t2', 'Combat');
  const notes = [
    note({ id: 'a', title: 'Salvage run', body: 'found a wreck', tags: [salvage] }),
    note({ id: 'b', title: 'Combat log', body: 'shot down', tags: [combat] }),
    note({ id: 'c', title: 'Empty', body: '' }),
  ];

  it('matches title or body case-insensitively', () => {
    expect(filterNotes(notes, 'WRECK', new Set()).map((n) => n.id)).toEqual(['a']);
    expect(filterNotes(notes, 'combat', new Set()).map((n) => n.id)).toEqual(['b']);
  });

  it('does not trim the search input', () => {
    // "wreck" matches note a, but the trailing space must NOT be trimmed away,
    // and no field contains "wreck " → no matches.
    expect(filterNotes(notes, 'wreck ', new Set())).toEqual([]);
  });

  it('returns everything for an empty search and no tags', () => {
    expect(filterNotes(notes, '', new Set()).map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('filters by selected tag ids (OR across tags)', () => {
    expect(filterNotes(notes, '', new Set(['t1'])).map((n) => n.id)).toEqual(['a']);
    expect(filterNotes(notes, '', new Set(['t1', 't2'])).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('combines search AND tag filters', () => {
    expect(filterNotes(notes, 'log', new Set(['t1'])).map((n) => n.id)).toEqual([]);
    expect(filterNotes(notes, 'log', new Set(['t2'])).map((n) => n.id)).toEqual(['b']);
  });
});

describe('filterLinks', () => {
  const links = [
    link({ id: 'a', title: 'Docs', url: 'https://example.com/guide', note: 'read later' }),
    link({ id: 'b', title: '', url: 'https://discord.com/channels/1', note: '' }),
  ];

  it('matches title, url or note', () => {
    expect(filterLinks(links, 'guide', new Set()).map((l) => l.id)).toEqual(['a']);
    expect(filterLinks(links, 'discord', new Set()).map((l) => l.id)).toEqual(['b']);
    expect(filterLinks(links, 'later', new Set()).map((l) => l.id)).toEqual(['a']);
  });
});

describe('computeTagSuggestions', () => {
  const pool = ['Alpha', 'Alpine', 'Beta', 'Gamma', 'Salvage', 'Salt', 'Salsa'];

  it('returns nothing for blank input', () => {
    expect(computeTagSuggestions(pool, [], '')).toEqual([]);
    expect(computeTagSuggestions(pool, [], '   ')).toEqual([]);
  });

  it('matches case-insensitive substring, capped at 6', () => {
    expect(computeTagSuggestions(pool, [], 'al')).toEqual([
      'Alpha',
      'Alpine',
      'Salvage',
      'Salt',
      'Salsa',
    ]);
  });

  it('excludes already-selected tags (exact match)', () => {
    expect(computeTagSuggestions(pool, ['Alpha'], 'alp')).toEqual(['Alpine']);
  });
});

describe('addTag / removeTag', () => {
  it('appends new tags preserving order', () => {
    expect(addTag(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('ignores blank and case-insensitive duplicates', () => {
    expect(addTag(['Salvage'], '  ')).toEqual(['Salvage']);
    expect(addTag(['Salvage'], 'salvage')).toEqual(['Salvage']);
  });

  it('trims the added tag', () => {
    expect(addTag([], '  Combat  ')).toEqual(['Combat']);
  });

  it('removes by exact string', () => {
    expect(removeTag(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('commitTokenText', () => {
  it('strips commas and trims', () => {
    expect(commitTokenText('salvage,')).toBe('salvage');
    expect(commitTokenText('  combat ')).toBe('combat');
    expect(commitTokenText(',,,')).toBe('');
  });
});

describe('dedupeTagInputs', () => {
  it('drops blanks, keeps first spelling, preserves order', () => {
    expect(dedupeTagInputs(['Salvage', 'salvage', '  ', 'Combat', 'SALVAGE'])).toEqual([
      'Salvage',
      'Combat',
    ]);
  });
});

describe('shouldShowReminder', () => {
  const now = 1_000_000_000_000;
  const base = {
    status: { hasData: true, lastChangedAt: now - DAY },
    lastBackupAt: null as number | null,
    snoozedUntil: null as number | null,
    now,
  };

  it('never shows without data', () => {
    expect(shouldShowReminder({ ...base, status: { hasData: false, lastChangedAt: now } })).toBe(
      false,
    );
  });

  it('shows when there is data and no backup ever', () => {
    expect(shouldShowReminder(base)).toBe(true);
  });

  it('is suppressed while snoozed', () => {
    expect(shouldShowReminder({ ...base, snoozedUntil: now + DAY })).toBe(false);
    // Expired snooze no longer suppresses.
    expect(shouldShowReminder({ ...base, snoozedUntil: now - DAY })).toBe(true);
  });

  it('hides when a recent backup covers the latest change', () => {
    expect(
      shouldShowReminder({
        ...base,
        lastBackupAt: now - DAY, // recent
        status: { hasData: true, lastChangedAt: now - 2 * DAY },
      }),
    ).toBe(false);
  });

  it('shows as soon as data changes after a backup (no 30-day wait)', () => {
    expect(
      shouldShowReminder({
        ...base,
        lastBackupAt: now - 2 * DAY, // recent backup
        status: { hasData: true, lastChangedAt: now - DAY }, // but changed since
      }),
    ).toBe(true);
  });
});

describe('lastBackupLabel', () => {
  const now = 1_000_000_000_000;
  it('handles every bucket', () => {
    expect(lastBackupLabel(null, now)).toBe('never backed up');
    expect(lastBackupLabel(now, now)).toBe('backed up today');
    expect(lastBackupLabel(now - DAY, now)).toBe('last backup yesterday');
    expect(lastBackupLabel(now - 5 * DAY, now)).toBe('last backup 5 days ago');
  });
});

describe('isDiscordUrl', () => {
  it('is a case-sensitive substring test', () => {
    expect(isDiscordUrl('https://discord.com/x')).toBe(true);
    expect(isDiscordUrl('https://DISCORD.com/x')).toBe(false);
  });
});

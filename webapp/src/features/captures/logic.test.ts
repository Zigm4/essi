import { describe, expect, it } from 'vitest';
import type { LinkModel, NoteModel, TagModel } from './models';
import {
  addTag,
  addTags,
  commitTokenText,
  computeTagSuggestions,
  dedupeTagInputs,
  filterLinks,
  filterNotes,
  isDiscordUrl,
  lastBackupLabel,
  listEmptyKind,
  markdownImageSource,
  pastedTagText,
  removeTag,
  splitTagInput,
  tagTokens,
  shouldShowReminder, liveTagSelection } from './logic';

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

  it('drops a leading # (hashtag style)', () => {
    expect(commitTokenText('#intel')).toBe('intel');
    expect(commitTokenText('##')).toBe('');
  });
});

describe('splitTagInput / tagTokens (pasted lists)', () => {
  it('splits a pasted list on commas and spaces, keeping the last fragment typed', () => {
    expect(splitTagInput('intel, mars trade')).toEqual({ tokens: ['intel', 'mars'], pending: 'trade' });
  });

  it('commits everything when the text ends with a separator', () => {
    expect(splitTagInput('temp zeta alpha mid bravo  ')).toEqual({
      tokens: ['temp', 'zeta', 'alpha', 'mid', 'bravo'],
      pending: '',
    });
    expect(splitTagInput('salvage,combat,')).toEqual({ tokens: ['salvage', 'combat'], pending: '' });
  });

  it('handles newlines and hashtags', () => {
    expect(splitTagInput('#intel\n#mars\ttrade\n')).toEqual({
      tokens: ['intel', 'mars', 'trade'],
      pending: '',
    });
  });

  it('keeps a plain token pending and ignores lone separators', () => {
    expect(splitTagInput('salv')).toEqual({ tokens: [], pending: 'salv' });
    expect(splitTagInput(' ')).toEqual({ tokens: [], pending: '' });
    expect(splitTagInput(', #,')).toEqual({ tokens: [], pending: '' });
  });

  it('tagTokens includes the trailing fragment (Enter / Save)', () => {
    expect(tagTokens('intel, mars trade')).toEqual(['intel', 'mars', 'trade']);
    expect(tagTokens('  ')).toEqual([]);
  });

  it('addTags adds each token once, case-insensitively', () => {
    expect(addTags(['Intel'], ['intel', 'mars', 'MARS', ''])).toEqual(['Intel', 'mars']);
  });
});

describe('pastedTagText', () => {
  it('leaves a single-line paste to the browser', () => {
    expect(pastedTagText('ab', 2, 2, 'intel, mars')).toBeNull();
  });

  it('turns pasted newlines into separators at the caret', () => {
    expect(pastedTagText('xy', 1, 1, 'intel\r\nmars\n')).toBe('xintel mars y');
    expect(pastedTagText('old', 0, 3, 'a\nb')).toBe('a b');
  });
});

describe('listEmptyKind', () => {
  it('is "none" when there is nothing at all', () => {
    expect(listEmptyKind(0, '', false)).toBe('none');
    // A tag that only ships/links use, selected while there are no notes yet.
    expect(listEmptyKind(0, '', true)).toBe('none');
  });

  it('is "search" when only a search hides everything', () => {
    expect(listEmptyKind(3, 'zzz', false)).toBe('search');
    expect(listEmptyKind(0, 'zzz', false)).toBe('search');
  });

  it('is "tags" when items exist but the tag filter hides them (with or without a search)', () => {
    expect(listEmptyKind(3, '', true)).toBe('tags');
    expect(listEmptyKind(3, 'zzz', true)).toBe('tags');
  });
});

describe('markdownImageSource', () => {
  const page = 'https://essi.example/captures/note/1';

  it('loads the app\'s own images directly', () => {
    expect(markdownImageSource('/pwa-512.png', page)).toEqual({
      kind: 'local',
      src: 'https://essi.example/pwa-512.png',
    });
  });

  it('holds back images from any other host', () => {
    expect(markdownImageSource('https://i.imgur.com/x.png', page)).toEqual({
      kind: 'remote',
      src: 'https://i.imgur.com/x.png',
      host: 'i.imgur.com',
    });
    // Protocol-relative URLs are remote too.
    expect(markdownImageSource('//tracker.example/p.gif', page)).toMatchObject({
      kind: 'remote',
      host: 'tracker.example',
    });
  });

  it('never loads blank or non-http sources', () => {
    expect(markdownImageSource(undefined, page)).toEqual({ kind: 'none' });
    expect(markdownImageSource('', page)).toEqual({ kind: 'none' });
    expect(markdownImageSource('data:image/png;base64,AAAA', page)).toEqual({ kind: 'none' });
    expect(markdownImageSource('javascript:alert(1)', page)).toEqual({ kind: 'none' });
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

describe('liveTagSelection', () => {
  const tags = [{ id: 'a' }, { id: 'b' }];
  it('drops selected tags that no longer exist (deleted with their last note)', () => {
    expect([...liveTagSelection(new Set(['a', 'gone']), tags)]).toEqual(['a']);
    expect(liveTagSelection(new Set(['gone']), tags).size).toBe(0);
  });
  it('keeps the selection as is while tags are loading or when all exist', () => {
    const sel = new Set(['a', 'b']);
    expect(liveTagSelection(sel, tags)).toBe(sel);
    expect(liveTagSelection(new Set(['gone']), undefined).has('gone')).toBe(true);
  });
});

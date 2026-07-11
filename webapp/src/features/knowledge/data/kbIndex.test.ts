import { describe, expect, it } from 'vitest';
import { KBSearchIndex, tokenize } from './kbIndex';

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumerics', () => {
    expect(tokenize('Hideous Dungeon!')).toEqual(['hideous', 'dungeon']);
  });

  it('drops tokens shorter than 2 chars', () => {
    expect(tokenize('a b12 c')).toEqual(['b12']);
    expect(tokenize('I go')).toEqual(['go']);
  });

  it('treats markdown syntax as separators (clean words inside **bold**)', () => {
    expect(tokenize('**Vessel** `!recall`')).toEqual(['vessel', 'recall']);
  });

  it('splits on non-ASCII accented letters', () => {
    // The accented "é" is a separator, so "café" yields "caf".
    expect(tokenize('café')).toEqual(['caf']);
    expect(tokenize('Ratrópia')).toEqual(['ratr', 'pia']);
  });
});

function buildFixture(): KBSearchIndex {
  const index = new KBSearchIndex();
  // slug, title, [fields...]
  index.addDocument('ratropia', 'Ratropia', ['Ratropia', 'A ratropia walkthrough map.', 'kb:map', 'Maps']);
  index.addDocument('vessel-permissions', 'Vessel Permissions', [
    'Vessel Permissions',
    'How vessel passenger permissions work.',
    'kb:system',
    'Systems',
  ]);
  index.addDocument('vessel-recall', 'Vessel Recall', [
    'Vessel Recall',
    'Recall your vessel from anywhere.',
    'kb:system',
    'Systems',
  ]);
  return index;
}

describe('KBSearchIndex.search', () => {
  it('prefix-matches every token', () => {
    expect(buildFixture().search('rat')).toEqual(['ratropia']);
  });

  it('ANDs all tokens and prefix-matches each (vess perm -> Vessel Permissions)', () => {
    expect(buildFixture().search('vess perm')).toEqual(['vessel-permissions']);
  });

  it('returns all AND matches sorted alphabetically by title', () => {
    // "vessel" prefix hits both vessel articles; sorted by title.
    expect(buildFixture().search('vessel')).toEqual(['vessel-permissions', 'vessel-recall']);
  });

  it('matches on category title and tags too', () => {
    expect(buildFixture().search('systems')).toEqual(['vessel-permissions', 'vessel-recall']);
    expect(buildFixture().search('map')).toEqual(['ratropia']);
  });

  it('is case-insensitive', () => {
    expect(buildFixture().search('RATROPIA')).toEqual(['ratropia']);
  });

  it('returns [] for empty or all-short queries', () => {
    expect(buildFixture().search('')).toEqual([]);
    expect(buildFixture().search('a !')).toEqual([]);
  });

  it('returns [] when the AND cannot be satisfied', () => {
    expect(buildFixture().search('vessel ratropia')).toEqual([]);
  });
});

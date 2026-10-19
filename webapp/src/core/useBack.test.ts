import { describe, expect, it } from 'vitest';
import { parentTabRoot } from './useBack';

describe('parentTabRoot', () => {
  it('maps a route to the root of its tab', () => {
    expect(parentTabRoot('/menu/faq')).toBe('/menu');
    expect(parentTabRoot('/knowledge/maps/mars')).toBe('/knowledge');
    expect(parentTabRoot('/captures/note/42')).toBe('/captures');
    expect(parentTabRoot('/tools/jobs')).toBe('/tools');
  });

  it('falls back to Tools for the root path', () => {
    expect(parentTabRoot('/')).toBe('/tools');
    expect(parentTabRoot('')).toBe('/tools');
  });
});

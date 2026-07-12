import { describe, expect, it } from 'vitest';
import { normalizeProxyUrl } from './jplClient';

describe('normalizeProxyUrl', () => {
  it('keeps a well-formed https URL', () => {
    expect(normalizeProxyUrl('https://p.zigm4.workers.dev')).toBe('https://p.zigm4.workers.dev');
  });

  it('adds https:// when the scheme is missing (the common paste mistake)', () => {
    expect(normalizeProxyUrl('p.zigm4.workers.dev')).toBe('https://p.zigm4.workers.dev');
  });

  it('upgrades http:// to https:// for a remote host (mixed-content trap)', () => {
    expect(normalizeProxyUrl('http://p.zigm4.workers.dev')).toBe('https://p.zigm4.workers.dev');
  });

  it('keeps http:// for localhost (local dev proxy)', () => {
    expect(normalizeProxyUrl('http://localhost:8799')).toBe('http://localhost:8799');
    expect(normalizeProxyUrl('http://127.0.0.1:8799/')).toBe('http://127.0.0.1:8799');
  });

  it('trims whitespace and strips trailing slashes', () => {
    expect(normalizeProxyUrl('  https://p.workers.dev/  ')).toBe('https://p.workers.dev');
    expect(normalizeProxyUrl('https://p.workers.dev///')).toBe('https://p.workers.dev');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeProxyUrl('')).toBe('');
    expect(normalizeProxyUrl('   ')).toBe('');
  });
});

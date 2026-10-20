import { afterEach, describe, expect, it, vi } from 'vitest';
import { jplRequest, normalizeProxyUrl } from './jplClient';

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

describe('jplRequest offline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'onLine');
  });

  it('fails at once when the device is offline, without calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const started = Date.now();
    await expect(jplRequest('https://p.example', 'sbdb', { sstr: '1P' })).rejects.toMatchObject({
      name: 'NetworkError',
      kind: 'offline',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Date.now() - started).toBeLessThan(400); // no 500 ms + 1500 ms retry waits
  });
});

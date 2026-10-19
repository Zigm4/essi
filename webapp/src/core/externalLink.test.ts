import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowedExternalUrl, launchExternal } from './externalLink';
import { useSnackbarStore } from './snackbar';

describe('allowedExternalUrl', () => {
  it('allows http, https and mailto', () => {
    expect(allowedExternalUrl('https://example.com/page')).toBe('https://example.com/page');
    expect(allowedExternalUrl('http://example.com')).toBe('http://example.com/');
    expect(allowedExternalUrl('mailto:someone@example.com')).toBe('mailto:someone@example.com');
  });

  it('trims whitespace before parsing', () => {
    expect(allowedExternalUrl('  https://example.com  ')).toBe('https://example.com/');
  });

  it('rejects dangerous or unknown schemes', () => {
    expect(allowedExternalUrl('javascript:alert(1)')).toBeNull();
    expect(allowedExternalUrl('file:///etc/passwd')).toBeNull();
    expect(allowedExternalUrl('data:text/html,<b>x</b>')).toBeNull();
    expect(allowedExternalUrl('underdeck://kb/foo')).toBeNull();
    expect(allowedExternalUrl('ftp://example.com')).toBeNull();
  });

  it('rejects unparseable input', () => {
    expect(allowedExternalUrl('not a url')).toBeNull();
    expect(allowedExternalUrl('')).toBeNull();
  });
});

describe('launchExternal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useSnackbarStore.getState().dismiss();
  });

  it('opens allowed http(s) URLs in a new tab with noopener noreferrer, without a false error', () => {
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    expect(launchExternal('https://example.com')).toBe(true);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.href).toBe('https://example.com/');
    expect(clicked[0]!.target).toBe('_blank');
    expect(clicked[0]!.rel).toBe('noopener noreferrer');
    expect(clicked[0]!.isConnected).toBe(false); // removed after the click
    expect(useSnackbarStore.getState().message).toBeNull();
  });

  it('never opens a disallowed scheme and shows the exact snackbar copy', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(launchExternal('javascript:alert(1)')).toBe(false);
    expect(click).not.toHaveBeenCalled();
    expect(useSnackbarStore.getState().message).toBe("Couldn't open that link.");
    expect(useSnackbarStore.getState().danger).toBe(true);
  });
});

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

  it('opens allowed http(s) URLs with noopener,noreferrer', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    expect(launchExternal('https://example.com')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer');
  });

  it('never opens a disallowed scheme and shows the exact snackbar copy', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    expect(launchExternal('javascript:alert(1)')).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(useSnackbarStore.getState().message).toBe("Couldn't open that link.");
    expect(useSnackbarStore.getState().danger).toBe(true);
  });

  it('reports failure when the window fails to open', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(launchExternal('https://blocked.example')).toBe(false);
    expect(useSnackbarStore.getState().message).toBe("Couldn't open that link.");
  });
});

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKBData } from './kbLoader';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function Probe() {
  const kb = useKBData();
  return kb.status === 'error' ? (
    <button type="button" onClick={kb.retry}>
      error
    </button>
  ) : (
    <span>{kb.status}</span>
  );
}

describe('useKBData', () => {
  it('loads again on retry after a failed load', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(new Response(JSON.stringify({ categories: [] })));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => root.render(<Probe />));
    const retry = host.querySelector('button');
    expect(retry?.textContent).toBe('error');

    await act(async () => retry!.click());
    expect(host.textContent).toBe('ready');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsteroidAnalyzerView } from './AsteroidAnalyzerView';
import { FishingRoomView } from './FishingRoomView';
import { FoeDecoderView } from './FoeDecoderView';
import { WalletLookupView } from './WalletLookupView';

// The views load their tables over fetch: serve the shipped files instead.
vi.mock('./shared/catalog', () => ({
  loadCatalog: (file: string) =>
    Promise.resolve(
      JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../public/catalog', file), 'utf-8')) as unknown,
    ),
}));
// Stars live in IndexedDB, which jsdom doesn't have.
vi.mock('./shared/favorites', () => ({
  useFavoriteSet: () => new Set<string>(),
  toggleFavorite: () => Promise.resolve(),
}));

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;
let search = '';

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  // AppBackground reads prefers-reduced-motion and sizes its canvas with a
  // ResizeObserver; jsdom has neither.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Records the current query string, to see a view drop a used link parameter. */
function SearchProbe() {
  search = useLocation().search;
  return null;
}

async function open(url: string, path: string, view: ReactNode): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={view} />
        </Routes>
        <SearchProbe />
      </MemoryRouter>,
    );
  });
}

function type(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('shared links reopen the result', () => {
  it('Asteroid Analyzer decodes ?id=, and typing another ID drops it', async () => {
    await open('/tools/asteroid?id=195016321', '/tools/asteroid', <AsteroidAnalyzerView />);
    const input = host.querySelector('input')!;
    expect(input.value).toBe('195016321');
    expect(host.textContent).toContain('> decoding asteroid 195016321…');
    expect(host.textContent).toContain('Hypermassive');
    expect(host.querySelector('[aria-label="Share this analysis"]')).not.toBeNull();
    type(input, '19501632');
    expect(search).toBe('');
    expect(host.textContent).not.toContain('> decoding asteroid');
  });

  it('Asteroid Analyzer shows the checklist for a malformed ?id=', async () => {
    await open('/tools/asteroid?id=1950', '/tools/asteroid', <AsteroidAnalyzerView />);
    expect(host.querySelector('input')!.value).toBe('1950');
    expect(host.textContent).toContain('ID format');
    expect(host.textContent).not.toContain('> decoding asteroid');
  });

  it('Bounty Decoder decodes ?id=', async () => {
    await open('/tools/foe?id=3241501042', '/tools/foe', <FoeDecoderView />);
    expect(host.querySelector('input')!.value).toBe('3241501042');
    expect(host.textContent).toContain('> decoding bounty 3241501042…');
    expect(host.textContent).toContain('Sheriff');
    expect(host.querySelector('[aria-label="Share this bounty"]')).not.toBeNull();
  });

  it('Fishing opens the ?zone= card on its room', async () => {
    await open('/tools/fishing/rankle-river?zone=49', '/tools/fishing/:roomId', <FishingRoomView />);
    const sheet = document.querySelector('[role="dialog"][aria-label="Zone details"]');
    expect(sheet?.textContent).toContain("Marooner's Mooring");
    expect(sheet?.textContent).toContain('Zone 49');
  });

  it('Wallet Lookup runs ?q=', async () => {
    await open('/tools/wallet?q=wam', '/tools/wallet', <WalletLookupView />);
    expect(host.querySelector('input')!.value).toBe('wam');
    expect(host.textContent).toMatch(/\d+ results/);
    expect(host.querySelector('[aria-label="Share results"]')).not.toBeNull();
  });
});

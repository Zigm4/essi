import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../../core/errors';
import { AsteroidAnalyzerView } from './AsteroidAnalyzerView';
import { FoeDecoderView } from './FoeDecoderView';
import { WalletLookupView } from './WalletLookupView';

// The shipped catalogs, or a network failure for the next `failures` loads.
const catalog = vi.hoisted(() => ({ failures: 0 }));
vi.mock('./shared/catalog', () => ({
  loadCatalog: (file: string) => {
    if (catalog.failures > 0) {
      catalog.failures -= 1;
      return Promise.reject(new NetworkError('offline', 'Connection error'));
    }
    return Promise.resolve(
      JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../../../public/catalog', file), 'utf-8'),
      ) as unknown,
    );
  },
}));

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  catalog.failures = 0;
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
  vi.unstubAllGlobals();
});

async function render(view: ReactNode): Promise<void> {
  await act(async () => {
    root.render(<MemoryRouter>{view}</MemoryRouter>);
  });
}

function type(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pressEnter(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

describe('Enter / "Go" decodes', () => {
  it('Asteroid Analyzer decodes a complete ID, and ignores Enter on an incomplete one', async () => {
    await render(<AsteroidAnalyzerView />);
    const input = host.querySelector('input')!;
    expect(input.getAttribute('enterkeyhint')).toBe('go');
    type(input, '19501632');
    pressEnter(input);
    expect(host.textContent).not.toContain('> decoding asteroid');
    type(input, '195016321');
    pressEnter(input);
    expect(host.textContent).toContain('> decoding asteroid 195016321…');
  });

  it('Bounty Decoder decodes on Enter', async () => {
    await render(<FoeDecoderView />);
    const input = host.querySelector('input')!;
    type(input, '3241501042');
    pressEnter(input);
    expect(host.textContent).toContain('> decoding bounty 3241501042…');
  });
});

describe('a failed catalog load can be retried', () => {
  it('shows "Try again", which loads the tables again', async () => {
    catalog.failures = 1;
    await render(<AsteroidAnalyzerView />);
    expect(host.textContent).toContain('No network connection');
    expect(host.querySelector('input')).toBeNull();
    const retry = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Try again');
    expect(retry).toBeDefined();
    await act(async () => retry!.click());
    expect(host.textContent).not.toContain('No network connection');
    expect(host.querySelector('input')).not.toBeNull();
  });
});

describe('Wallet Lookup', () => {
  it('copies a wallet from its row', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await render(<WalletLookupView />);
    type(host.querySelector('input')!, 'cruzified');
    const copy = host.querySelector<HTMLButtonElement>('[aria-label="Copy wallet jnyrg.wam"]');
    expect(copy).not.toBeNull();
    await act(async () => copy!.click());
    expect(writeText).toHaveBeenCalledWith('jnyrg.wam');
  });

  it('closes the keyboard on Enter (results already show as you type)', async () => {
    await render(<WalletLookupView />);
    const input = host.querySelector('input')!;
    expect(input.getAttribute('enterkeyhint')).toBe('search');
    input.focus();
    type(input, 'cruzified');
    pressEnter(input);
    expect(document.activeElement).not.toBe(input);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsteroidAnalyzerView } from './AsteroidAnalyzerView';
import { FoeDecoderView } from './FoeDecoderView';

// The views load their tables over fetch: serve the shipped files instead.
vi.mock('./shared/catalog', () => ({
  loadCatalog: (file: string) =>
    Promise.resolve(
      JSON.parse(
        readFileSync(resolve(import.meta.dirname, '../../../public/catalog', file), 'utf-8'),
      ) as unknown,
    ),
}));

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;

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

async function renderView(view: ReactNode): Promise<HTMLInputElement> {
  await act(async () => {
    root.render(<MemoryRouter>{view}</MemoryRouter>);
  });
  const input = host.querySelector('input');
  if (input === null) throw new Error('ID input not rendered');
  return input;
}

/** A paste / autofill: the whole text lands in the field in one input event. */
function insertText(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, input.value + text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ID fields accept formatted pastes', () => {
  it('Asteroid Analyzer keeps all 9 digits of "#195 016 321"', async () => {
    const input = await renderView(<AsteroidAnalyzerView />);
    expect(input.hasAttribute('maxlength')).toBe(false);
    insertText(input, '#195 016 321');
    expect(input.value).toBe('195016321');
    expect(host.textContent).not.toContain('ID format');
  });

  it('Bounty Decoder keeps all 10 digits of "FOE #3241501042"', async () => {
    const input = await renderView(<FoeDecoderView />);
    expect(input.hasAttribute('maxlength')).toBe(false);
    insertText(input, 'FOE #3241501042');
    expect(input.value).toBe('3241501042');
    expect(host.textContent).not.toContain('ID format');
  });
});

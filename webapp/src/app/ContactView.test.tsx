import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContactView } from './ContactView';

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
  } as unknown as typeof ResizeObserver;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function renderAt(state: unknown) {
  const router = createMemoryRouter([{ path: '/menu/contact', element: <ContactView /> }], {
    initialEntries: [{ pathname: '/menu/contact', state }],
  });
  await act(async () => root.render(<RouterProvider router={router} />));
  return router;
}

function textarea(): HTMLTextAreaElement {
  return host.querySelector('textarea') as HTMLTextAreaElement;
}

describe('ContactView pre-fill', () => {
  it('fills the message from router state, then clears that state', async () => {
    const template = 'Contributing intel for the ESSI knowledge base.\n\nArticle / section: \n';
    const router = await renderAt({ initialMessage: template });
    expect(textarea().value).toBe(template);
    // Back/Forward or a reload must not bring the template back.
    expect(router.state.location.state).toBeNull();
    expect(router.state.location.pathname).toBe('/menu/contact');
    // The message stays in the field after the history entry is replaced.
    expect(textarea().value).toBe(template);
  });

  it('opens empty without router state', async () => {
    await renderAt(null);
    expect(textarea().value).toBe('');
  });

  it('ignores a malformed pre-fill', async () => {
    await renderAt({ initialMessage: 42 });
    expect(textarea().value).toBe('');
  });
});

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSearchQuery } from './useSearchQuery';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let current: ReturnType<typeof useSearchQuery>;

function Harness() {
  current = useSearchQuery(10);
  return null;
}

let root: Root | null = null;

async function mount(hash: string): Promise<void> {
  window.history.replaceState(null, '', hash);
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root!.render(
      <HashRouter>
        <Harness />
      </HashRouter>,
    );
  });
}

afterEach(async () => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  if (root !== null) await act(async () => root!.unmount());
  root = null;
  vi.restoreAllMocks();
});

describe('useSearchQuery', () => {
  it('a fresh search starts empty and writes nothing', async () => {
    await mount('#/menu/search');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    expect(current.initial).toBe('');
    expect(current.committed).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(replaceState).toHaveBeenCalledTimes(0);
  });

  it('coming back restores the query from the URL at once', async () => {
    await mount('#/menu/search?q=recall');
    expect(current.initial).toBe('recall');
    expect(current.text).toBe('recall');
    expect(current.committed).toBe('recall'); // no debounce on arrival
  });

  it('writes each committed query to ?q= without adding history entries', async () => {
    await mount('#/menu/search');
    const pushState = vi.spyOn(window.history, 'pushState');
    const length = window.history.length;
    await act(async () => current.setText('  vessel recall '));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/menu/search?q=vessel+recall'));
    expect(current.committed).toBe('vessel recall');
    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
  });

  it('follows a URL changed from outside', async () => {
    await mount('#/menu/search?q=recall');
    await act(async () => {
      window.history.pushState(null, '', '#/menu/search?q=z35');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await vi.waitFor(() => expect(current.committed).toBe('z35'));
    expect(current.text).toBe('z35');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(window.location.hash).toBe('#/menu/search?q=z35');
  });

  it('does not read back its own writes', async () => {
    await mount('#/menu/search');
    await act(async () => current.setText('a'));
    await act(async () => current.setText('ab'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    await act(async () => current.setText('abc'));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/menu/search?q=abc'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(current.text).toBe('abc');
    expect(current.committed).toBe('abc');
  });

  it('clearing drops ?q= at once', async () => {
    await mount('#/menu/search?q=recall');
    await act(async () => current.clear());
    expect(current.text).toBe('');
    expect(current.committed).toBe('');
    await vi.waitFor(() => expect(window.location.hash).toBe('#/menu/search'));
  });
});

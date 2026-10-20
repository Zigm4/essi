import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FavoriteRow } from '../../data/db';
import type { Job } from '../tools/jobs/jobModel';
import type { FavoriteItem, FavoriteSources } from './favoritesList';
import { FavoritesContent } from './FavoritesView';
import type { LiveResult } from './useLiveQuery';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const job = { id: 42, typeRaw: 'leadership', factionRep: 'rep_mschf' } as Job;

const sources: FavoriteSources = {
  jobs: { status: 'ready', data: new Map([[42, job]]) },
  articles: { status: 'failed' },
  maps: { status: 'ready', data: { maps: new Map(), zones: new Map(), readDocs: new Set() } },
  fishing: { status: 'loading' },
  tracked: { status: 'ready', data: [] },
};

function ready(...pairs: [string, string][]): LiveResult<readonly FavoriteRow[]> {
  return { status: 'ready', data: pairs.map(([entityType, entityId]) => ({ entityType, entityId, createdAt: 0 })) };
}

async function render(rows: LiveResult<readonly FavoriteRow[]>, onUnstar = vi.fn()) {
  const router = createMemoryRouter(
    [
      { path: '/menu/favorites', element: <FavoritesContent rows={rows} sources={sources} onUnstar={onUnstar} /> },
      { path: '*', element: <div /> },
    ],
    { initialEntries: ['/menu/favorites'] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
  return { router, onUnstar };
}

function button(label: string): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (found === null) throw new Error(`no button "${label}"`);
  return found;
}

describe('FavoritesContent', () => {
  it('waits for the favorites, then invites to star when there are none', async () => {
    await render({ status: 'loading' });
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    await render(ready());
    expect(host.textContent).toContain('No favorites yet');
  });

  it('lists each kind under its header, raw ids for what is gone or unloaded', async () => {
    await render(ready(['tracked_object', 'jpl:502'], ['job', '42'], ['map', 'europa'], ['kb_article', 'apm-guide']));
    const headers = [...host.querySelectorAll('section')].map((s) => s.getAttribute('aria-label'));
    expect(headers).toEqual(['Jobs', 'Articles', 'Maps', 'Tracked objects']);
    expect(host.textContent).toContain('Leadership #42');
    expect(host.textContent).toContain('Mischief (MSC)');
    expect(host.textContent).toContain('Europa');
    // Articles failed to load: the slug, a note, still openable.
    expect(host.textContent).toContain("Couldn't load the knowledge base - showing IDs.");
    expect(button('apm-guide')).toBeTruthy();
    // A map that isn't installed: its id, not openable, still un-starrable.
    expect(host.textContent).toContain('Map not installed');
    const mapButtons = host.querySelectorAll('section[aria-label="Maps"] button');
    expect([...mapButtons].map((b) => b.getAttribute('aria-label'))).toEqual(['Remove europa from favorites']);
  });

  it('shows a spinner for a group whose source is still loading', async () => {
    await render(ready(['fishing_zone', '23']));
    const section = host.querySelector('section[aria-label="Fishing zones"]');
    expect(section?.querySelector('[role="status"]')).not.toBeNull();
    expect(section?.textContent).not.toContain('Zone 23');
  });

  it('opens the job sheet and the Tracker with its prefill', async () => {
    const { router } = await render(ready(['job', '42'], ['tracked_object', 'jpl:502']));
    await act(async () => button('Leadership #42. Mischief (MSC)').click());
    expect(router.state.location.pathname).toBe('/tools/jobs');
    expect(router.state.location.search).toBe('?job=42');

    await act(async () => router.navigate('/menu/favorites'));
    await act(async () => button('Europa. Moon of Jupiter').click());
    expect(router.state.location.pathname).toBe('/tools/tracker');
    expect(router.state.location.state).toEqual({ name: 'Europa', kind: 'moon', mpcID: 'jpl:502' });
  });

  it('un-stars from the row', async () => {
    const { onUnstar } = await render(ready(['job', '42']));
    await act(async () => button('Remove Leadership #42 from favorites').click());
    expect(onUnstar).toHaveBeenCalledTimes(1);
    expect((onUnstar.mock.calls[0]![0] as FavoriteItem).id).toBe('42');
  });
});

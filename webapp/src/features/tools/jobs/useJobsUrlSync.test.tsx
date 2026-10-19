import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseJobsJson } from './jobModel';
import { computeFacetOptions } from './jobsFacets';
import { pristineFilter, type JobFilter } from './jobsLogic';
import { useJobsUrlSync } from './useJobsUrlSync';

const options = computeFacetOptions(
  parseJobsJson(
    JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../../public/catalog/jobs.json'), 'utf-8'),
    ),
  ),
);

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let current: JobFilter = pristineFilter();
let update: (f: JobFilter) => void = () => {};

function Harness() {
  const [filter, setFilter] = useState<JobFilter>(pristineFilter);
  current = filter;
  update = setFilter;
  useJobsUrlSync(options, filter, setFilter);
  return null;
}

/** A filter change applied synchronously, like a tap - the router's own transition stays pending. */
function change(partial: Partial<JobFilter>) {
  flushSync(() => update({ ...current, ...partial }));
}

let root: Root;

beforeEach(async () => {
  window.history.replaceState(null, '', '#/tools/jobs?f=rep_mschf,rep_pearl');
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      <HashRouter>
        <Harness />
      </HashRouter>,
    );
  });
  // The rest drives React like the browser does (no act), so router transitions can lag behind.
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(async () => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.unmount());
  vi.restoreAllMocks();
});

describe('useJobsUrlSync', () => {
  it('a shared link wins on mount', () => {
    expect([...current.factions].sort()).toEqual(['rep_mschf', 'rep_pearl']);
    expect(window.location.hash).toBe('#/tools/jobs?f=rep_mschf,rep_pearl');
  });

  it('never reads back its own URL while the router transition is pending', async () => {
    change({ factions: new Set(['rep_mschf']) });
    expect(window.location.hash).toBe('#/tools/jobs?f=rep_mschf'); // sheet changes are written at once
    change({ factions: new Set() }); // before the router has committed the first write
    await vi.waitFor(() => expect(window.location.hash).toBe('#/tools/jobs'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(current.factions.size).toBe(0);
    expect(window.location.hash).toBe('#/tools/jobs');
  });

  it('writes the search once typing pauses, keeping every keystroke', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    change({ query: 'x' });
    change({ query: 'xy' });
    change({ query: 'xyz' });
    expect(replaceState).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(window.location.hash).toBe('#/tools/jobs?f=rep_mschf,rep_pearl&q=xyz'));
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(current.query).toBe('xyz');
  });

  it('applies a URL changed from outside', async () => {
    window.history.replaceState(null, '', '#/tools/jobs?f=rep_hex&norep=1');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect([...current.factions]).toEqual(['rep_hex']));
    expect(current.noRepOnly).toBe(true);
  });
});

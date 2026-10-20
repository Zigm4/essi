import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogData, ShipCatalogEntry } from './catalog';
import type { ShipDraft, ShipModel } from './shipModel';
import { emptyRoles } from './shipModel';
import { ShipEditor } from './ShipEditor';

const MODELS: ShipCatalogEntry[] = [
  { key: 'moon-buggy', displayName: 'Moon Buggy', category: 'landcraft', prefix: 'MOOB', crewSize: 1, hullMax: null },
  { key: 'ufo-oort', displayName: 'UFO Oort', category: 'spacecraft', prefix: 'OORT', crewSize: null, hullMax: null },
];
const CATALOG: CatalogData = {
  models: MODELS,
  locations: [],
  modelByKey: new Map(MODELS.map((m) => [m.key, m])),
  locationByKey: new Map(),
};

const { saveShip } = vi.hoisted(() => ({
  saveShip: vi.fn((_draft: ShipDraft, _tags: string[]) => Promise.resolve('id')),
}));
vi.mock('./shipRepository', () => ({
  saveShip,
  deleteShip: vi.fn(),
  restoreShip: vi.fn(),
  useAllTags: () => ({ status: 'ok', data: [] }),
}));
vi.mock('./catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./catalog')>()),
  useCatalogs: () => ({ status: 'ready', data: CATALOG }),
}));

function ship(partial: Partial<ShipModel>): ShipModel {
  return {
    id: 'ship-1',
    name: '',
    modelKey: null,
    customModelLabel: null,
    registered: false,
    locationKey: null,
    customLocation: null,
    locationZone: null,
    locationSector: null,
    locationSL: null,
    hull: null,
    roles: emptyRoles(),
    note: '',
    createdAt: 0,
    updatedAt: 0,
    tags: [],
    ...partial,
  };
}

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  saveShip.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(initial: ShipModel) {
  act(() => root.render(<ShipEditor initial={initial} onClose={() => undefined} />));
}

/** A paste: the whole text replaces the field in one input event. */
function pasteInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function save(): Promise<ShipDraft> {
  const button = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Save');
  await act(async () => button?.click());
  expect(saveShip).toHaveBeenCalledTimes(1);
  return saveShip.mock.calls[0][0];
}

describe('ShipEditor call sign', () => {
  it('pasting the full call sign in any case does not double the prefix', async () => {
    render(ship({ name: 'OORT-1', modelKey: 'ufo-oort' }));
    const input = document.body.querySelector('input[placeholder="number"]') as HTMLInputElement;
    expect(input.value).toBe('1');
    pasteInto(input, 'oort-07');
    expect(input.value).toBe('07');
    expect((await save()).name).toBe('OORT-07');
  });
});

describe('ShipEditor crew roles', () => {
  it('drops names in seats the crew size hides, which the editor no longer shows', async () => {
    render(
      ship({
        name: 'MOOB-1',
        modelKey: 'moon-buggy',
        roles: { ...emptyRoles(), pilot: 'Ann', gunner: 'Bob', medic: 'Alice' },
      }),
    );
    expect(document.body.querySelector('input[placeholder="Pilot\'s name"]')).not.toBeNull();
    expect(document.body.querySelector('input[placeholder="Gunner\'s name"]')).toBeNull();
    const draft = await save();
    expect(draft.roles.pilot).toBe('Ann');
    expect(draft.roles.gunner).toBeNull();
    expect(draft.roles.medic).toBeNull();
  });
});

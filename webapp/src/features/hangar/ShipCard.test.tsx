import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogData, ShipCatalogEntry } from './catalog';
import { emptyRoles, type ShipModel } from './shipModel';
import { ShipCard } from './ShipCard';

const { updateHull } = vi.hoisted(() => ({ updateHull: vi.fn(() => Promise.resolve()) }));
vi.mock('./shipRepository', () => ({ updateHull }));

const MODELS: ShipCatalogEntry[] = [
  { key: 'solstice-trigrave', displayName: 'Solstice Trigrave', category: 'spacecraft', prefix: 'SOLT', crewSize: 2, hullMax: 80 },
  { key: 'moon-buggy', displayName: 'Moon Buggy', category: 'landcraft', prefix: 'MOOB', crewSize: 1, hullMax: null },
];
const CATALOG: CatalogData = {
  models: MODELS,
  locations: [],
  modelByKey: new Map(MODELS.map((m) => [m.key, m])),
  locationByKey: new Map(),
};

function ship(partial: Partial<ShipModel>): ShipModel {
  return {
    id: 'ship-1',
    name: 'SOLT-42',
    modelKey: 'solstice-trigrave',
    customModelLabel: null,
    registered: true,
    locationKey: null,
    customLocation: null,
    locationZone: null,
    locationSector: null,
    locationSL: null,
    hull: 40,
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
const onOpen = vi.fn();

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  onOpen.mockClear();
  updateHull.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(model: ShipModel) {
  act(() =>
    root.render(<ShipCard model={model} catalog={CATALOG} onOpen={onOpen} onDelete={() => undefined} />),
  );
}

function press(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function button(label: string): HTMLButtonElement {
  return host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
}

describe('ShipCard keyboard', () => {
  it('leaves Enter and Space on the hull steppers to the buttons', () => {
    render(ship({}));
    for (const label of ['Increase hull', 'Decrease hull']) {
      for (const key of ['Enter', ' ']) {
        // Not prevented: the browser goes on to click the button.
        expect(press(button(label), key).defaultPrevented).toBe(false);
      }
    }
    expect(onOpen).not.toHaveBeenCalled();

    act(() => button('Increase hull').click());
    expect(updateHull).toHaveBeenCalledWith('ship-1', 41);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('still opens the editor with Enter or Space on the card itself', () => {
    render(ship({}));
    const card = host.querySelector('[role="button"]') as HTMLElement;
    expect(press(card, 'Enter').defaultPrevented).toBe(true);
    expect(press(card, ' ').defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});

describe('ShipCard crew', () => {
  it('only lists the seats the model has', () => {
    render(
      ship({
        modelKey: 'moon-buggy',
        roles: { ...emptyRoles(), pilot: 'Ann', gunner: 'Bob', medic: 'Alice' },
      }),
    );
    expect(host.textContent).toContain('Ann');
    expect(host.textContent).not.toContain('Bob');
    expect(host.textContent).not.toContain('Alice');
  });
});

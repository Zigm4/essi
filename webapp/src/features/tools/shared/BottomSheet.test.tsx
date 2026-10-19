import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BottomSheet } from './BottomSheet';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let appRoot: HTMLDivElement;
let opener: HTMLButtonElement;
let root: Root;

function render(open: boolean, footer?: React.ReactNode) {
  act(() => {
    root.render(
      <BottomSheet open={open} onClose={() => {}} ariaLabel="Test sheet" footer={footer}>
        <button type="button">Inside</button>
      </BottomSheet>,
    );
  });
}

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  opener = document.createElement('button');
  opener.textContent = 'Open';
  appRoot.appendChild(opener);
  document.body.appendChild(appRoot);
  root = createRoot(document.createElement('div'));
  opener.focus();
});

afterEach(() => {
  act(() => root.unmount());
  appRoot.remove();
});

describe('BottomSheet focus handling', () => {
  it('moves focus into the panel and makes the app inert while open', () => {
    render(true);
    const dialog = document.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
    expect(appRoot.hasAttribute('inert')).toBe(true);
  });

  it('releases the app and gives focus back to the opener on close', () => {
    render(true);
    render(false);
    expect(appRoot.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});

describe('BottomSheet footer', () => {
  it('renders no pinned bar for an empty footer (null / false)', () => {
    for (const footer of [null, false, undefined]) {
      render(true, footer);
      expect(document.querySelector('[role="dialog"]')!.children.length).toBe(2); // handle + body
      render(false);
    }
    render(true, <button type="button">Apply</button>);
    expect(document.querySelector('[role="dialog"]')!.children.length).toBe(3);
  });
});

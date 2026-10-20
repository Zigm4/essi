import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let online = true;

beforeEach(() => {
  online = true;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(navigator, 'onLine');
});

function setOnline(value: boolean) {
  act(() => {
    online = value;
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

describe('OfflineBanner', () => {
  it('shows while the device is offline, and goes when the connection is back', () => {
    act(() => root.render(<OfflineBanner />));
    expect(host.textContent).toBe('');
    setOnline(false);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Offline');
    setOnline(true);
    expect(host.textContent).toBe('');
  });
});

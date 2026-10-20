import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NetworkNotice } from './NetworkNotice';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => host.remove());

function mount(): () => void {
  const root = createRoot(host);
  act(() =>
    root.render(
      <NetworkNotice tool="tracker" summary="Folded summary" intro="Full intro" rows={[['Via:', 'A proxy']]} />,
    ),
  );
  return () => act(() => root.unmount());
}

describe('NetworkNotice', () => {
  it('is open the first time, folded afterwards, and unfolds on tap', () => {
    let unmount = mount();
    expect(host.textContent).toContain('Full intro');
    expect(host.textContent).not.toContain('Folded summary');
    unmount();

    unmount = mount();
    expect(host.textContent).toContain('Folded summary');
    expect(host.textContent).not.toContain('Full intro');
    const toggle = host.querySelector('button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle.click());
    expect(host.textContent).toContain('Full intro');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    unmount();
  });
});

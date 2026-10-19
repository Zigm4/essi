import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;

function Boom(): never {
  throw new Error('render failed');
}

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  // React and logError both report the caught error to the console.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    act(() => root.render(<ErrorBoundary><p>fine</p></ErrorBoundary>));
    expect(host.textContent).toBe('fine');
  });

  it('shows a recovery card instead of a blank screen when a child throws', () => {
    act(() =>
      root.render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      ),
    );
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).toContain('Something went wrong on this screen.');
    expect(host.textContent).toContain('Reload');
    expect(host.textContent).toContain('Back to Tools');
  });
});

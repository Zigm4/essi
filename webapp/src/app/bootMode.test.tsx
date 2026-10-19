import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '../data/settings';
import { BootScreen } from './BootScreen';
import { bootMode, storedFastBootChoice } from './bootMode';

// The particle canvas is irrelevant here and jsdom has no canvas.
vi.mock('../design-system/components/AppBackground', () => ({
  AppBackground: ({ children }: { children: ReactNode }) => children,
}));

const FAST_BOOT_KEY = 'underdeck.settings.fastBoot';

describe('bootMode', () => {
  it('plays the full intro on the very first launch', () => {
    expect(bootMode({ fastBootChoice: null, onboardingSeen: false })).toBe('full');
  });

  it('is fast on later launches by default', () => {
    expect(bootMode({ fastBootChoice: null, onboardingSeen: true })).toBe('fast');
  });

  it('keeps an explicit Settings choice either way', () => {
    expect(bootMode({ fastBootChoice: false, onboardingSeen: true })).toBe('full');
    expect(bootMode({ fastBootChoice: true, onboardingSeen: false })).toBe('fast');
  });
});

describe('storedFastBootChoice', () => {
  beforeEach(() => localStorage.clear());

  it('tells "never set" apart from "off"', () => {
    expect(storedFastBootChoice()).toBeNull();
    localStorage.setItem(FAST_BOOT_KEY, 'false');
    expect(storedFastBootChoice()).toBe(false);
    localStorage.setItem(FAST_BOOT_KEY, 'true');
    expect(storedFastBootChoice()).toBe(true);
  });
});

describe('BootScreen', () => {
  const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    localStorage.clear();
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
    // The boot log auto-scrolls; jsdom has no Element.scrollTo.
    Element.prototype.scrollTo ??= () => undefined;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  function launch() {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/boot']}>
          <Routes>
            <Route path="/boot" element={<BootScreen />} />
            <Route path="/tools" element={<p>tools</p>} />
            <Route path="/onboarding" element={<p>onboarding</p>} />
          </Routes>
        </MemoryRouter>,
      ),
    );
  }

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('first launch: full intro, then stores the fast default for the next one', () => {
    useSettingsStore.setState({ onboardingSeen: false, fastBoot: false });
    launch();
    advance(1000);
    expect(host.textContent).toContain('tap to skip');
    // Closing the app mid-intro leaves the next launch a first launch.
    expect(localStorage.getItem(FAST_BOOT_KEY)).toBeNull();
    // ≈6 s of typing, a 1.6 s hold, then the fade (effects schedule between steps).
    for (let i = 0; i < 12; i++) advance(1000);
    expect(host.textContent).toBe('onboarding');
    expect(localStorage.getItem(FAST_BOOT_KEY)).toBe('true');
    expect(useSettingsStore.getState().fastBoot).toBe(true);
  });

  it('later launch with no explicit choice: straight into the app', () => {
    useSettingsStore.setState({ onboardingSeen: true, fastBoot: false });
    launch();
    advance(300);
    expect(host.textContent).toBe('tools');
    expect(useSettingsStore.getState().fastBoot).toBe(true);
  });

  it('a tap skips the full intro', () => {
    useSettingsStore.setState({ onboardingSeen: false, fastBoot: false });
    launch();
    advance(500);
    act(() => host.querySelector<HTMLElement>('[aria-label="Skip intro"]')?.click());
    advance(600);
    expect(host.textContent).toBe('onboarding');
  });

  it('Fast boot turned off in Settings: the full intro still plays', () => {
    localStorage.setItem(FAST_BOOT_KEY, 'false');
    useSettingsStore.setState({ onboardingSeen: true, fastBoot: false });
    launch();
    advance(1000);
    expect(host.textContent).not.toBe('tools');
    expect(localStorage.getItem(FAST_BOOT_KEY)).toBe('false');
  });
});

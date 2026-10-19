import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarkdownView } from './MarkdownView';

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

function render(source: string) {
  act(() => root.render(<MarkdownView source={source} />));
}

describe('MarkdownView images', () => {
  it('holds back a remote image until it is tapped, then loads it without a referrer', () => {
    render('Body ![map](https://i.imgur.com/x.png) [js](https://example.com)');
    expect(host.querySelector('img')).toBeNull();
    const button = host.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('Image from i.imgur.com');
    expect(button.getAttribute('aria-label')).toBe('Show image from i.imgur.com');

    act(() => button.click());
    const img = host.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://i.imgur.com/x.png');
    expect(img.getAttribute('alt')).toBe('map');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    // The link after it still renders.
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('offers a retry when a shown image fails to load', () => {
    render('![](https://cdn.example/x.png)');
    act(() => host.querySelector('button')?.click());
    act(() => {
      host.querySelector('img')?.dispatchEvent(new Event('error'));
    });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('button')?.textContent).toContain(
      "Couldn't load image from cdn.example",
    );
  });

  it('loads the app\'s own images directly', () => {
    render(`![icon](${window.location.origin}/pwa-512.png)`);
    expect(host.querySelector('img')?.getAttribute('src')).toBe(
      `${window.location.origin}/pwa-512.png`,
    );
    expect(host.querySelector('button')).toBeNull();
  });

  it('shows a tap on an image inside a link instead of following the link', () => {
    render('[![shot](https://i.imgur.com/x.png)](https://example.com)');
    const button = host.querySelector('a button') as HTMLButtonElement;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => {
      button.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(host.querySelector('a img')).not.toBeNull();
  });

  it('never loads an unsafe source, showing its alt text instead', () => {
    render('![secret](javascript:alert(1))');
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('secret');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealResult } from './revealResult';

function resultAt(top: number): HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> } {
  const el = document.createElement('div') as HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> };
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  el.scrollIntoView = vi.fn();
  return el;
}

afterEach(() => vi.unstubAllGlobals());

describe('revealResult', () => {
  it('scrolls a result that starts low on the screen', () => {
    vi.stubGlobal('innerHeight', 800);
    const el = resultAt(620);
    revealResult(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
  });

  it('leaves a result that is already in view', () => {
    vi.stubGlobal('innerHeight', 800);
    const el = resultAt(240);
    revealResult(el);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('ignores a missing element', () => {
    expect(() => revealResult(null)).not.toThrow();
  });
});

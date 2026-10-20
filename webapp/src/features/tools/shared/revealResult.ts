/**
 * Scrolls a fresh result into view when it starts low on the screen - on a
 * phone it appears under the input and the closing keyboard, out of sight.
 * Left alone when its top is already in the upper part of the viewport
 * (desktop, or a short page). Pair with a `scroll-margin-top` that clears the
 * app bar floating over the page.
 */
export function revealResult(el: HTMLElement | null): void {
  if (el === null) return;
  if (el.getBoundingClientRect().top < window.innerHeight * 0.55) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

/** Enter / the phone keyboard's "Go" key in a single-field form. */
export function isSubmitKey(e: { key: string; nativeEvent: { isComposing?: boolean } }): boolean {
  return e.key === 'Enter' && e.nativeEvent.isComposing !== true;
}

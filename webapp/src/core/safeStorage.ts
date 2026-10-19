/**
 * localStorage that never throws. A browser can refuse storage outright
 * (site data blocked, some private modes, enterprise policy): touching
 * `window.localStorage` then throws a SecurityError, which at module load
 * would blank the whole app. Here every call is guarded and falls back to an
 * in-memory map, so the app runs with default settings that last the session.
 */

const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function safeGetItem(key: string): string | null {
  try {
    const s = storage();
    if (s !== null) return s.getItem(key);
  } catch {
    /* fall through to memory */
  }
  return memory.get(key) ?? null;
}

export function safeSetItem(key: string, value: string): void {
  try {
    const s = storage();
    if (s !== null) {
      s.setItem(key, value);
      return;
    }
  } catch {
    /* fall through to memory */
  }
  memory.set(key, value);
}

export function safeRemoveItem(key: string): void {
  memory.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}

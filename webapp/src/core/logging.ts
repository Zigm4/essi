/** Minimal centralized error logger with a pluggable crash-reporter seam. */

export type ErrorReporter = (error: unknown, stack?: string) => void;

let reporter: ErrorReporter | null = null;

/** Attach/detach a crash-reporting backend in exactly one place. */
export function setErrorReporter(fn: ErrorReporter | null): void {
  reporter = fn;
}

/** The single sink for every caught/uncaught error. */
export function logError(error: unknown, stack?: string): void {
  if (import.meta.env.DEV) {
    console.error('[Underdeck] ERROR:', error, stack ?? '');
  }
  if (reporter) {
    try {
      reporter(error, stack);
    } catch {
      // A reporter must never throw out of an error handler.
    }
  }
}

/** Wire window-level handlers so framework errors are never silently swallowed. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    logError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason);
  });
}

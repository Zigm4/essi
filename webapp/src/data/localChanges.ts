import type { DBCore, DBCoreMutateRequest, Middleware } from 'dexie';
import { safeGetItem, safeSetItem } from '../core/safeStorage';

/**
 * Durable "local data changed at" marker (epoch ms) for the backup reminder.
 * Row timestamps alone can't see a deletion (a job reset to Not done, a star
 * removed, a note or history cleared) or an import of rows older than the last
 * backup, so every successful write to a user-data table bumps this marker,
 * deletions and imports included. Lives next to `settings.lastBackupAt`.
 */

const LOCAL_CHANGE_KEY = 'underdeck.settings.lastLocalChangeAt';

export function readLocalChangeAt(): number | null {
  const raw = safeGetItem(LOCAL_CHANGE_KEY);
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Monotonic: a clock that steps back never moves the marker backwards. */
export function markLocalChange(at: number = Date.now()): void {
  const previous = readLocalChangeAt();
  if (previous !== null && previous >= at) return;
  safeSetItem(LOCAL_CHANGE_KEY, String(at));
}

/** Operations a mutate request asked for; 1 for a range delete (count unknown). */
function requestedOps(req: DBCoreMutateRequest): number {
  switch (req.type) {
    case 'add':
    case 'put':
      return req.values.length;
    case 'delete':
      return req.keys.length;
    case 'deleteRange':
      return 1;
  }
}

/**
 * Dexie DBCore middleware: after any mutate on one of `tables` that wrote at
 * least one row (add, put, update, delete, clear), calls `onChange`. It runs
 * before the transaction commits, so a rolled-back write can bump the marker
 * too - harmless, the reminder just shows once more.
 */
export function localChangesMiddleware(
  tables: ReadonlySet<string>,
  onChange: () => void,
): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'localChanges',
    create: (down) => ({
      ...down,
      table: (name) => {
        const table = down.table(name);
        if (!tables.has(name)) return table;
        return {
          ...table,
          // .then on Dexie's own promise, not async/await: a native promise
          // here would let a long transaction (the import) commit too early.
          mutate: (req) =>
            table.mutate(req).then((res) => {
              if (res.numFailures < requestedOps(req)) onChange();
              return res;
            }),
        };
      },
    }),
  };
}

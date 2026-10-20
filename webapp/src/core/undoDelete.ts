import { friendlyError } from './errorText';
import { logError } from './logging';
import { showSnackbar } from './snackbar';

/**
 * A single delete the way the app does it: at once, with Undo in the snackbar
 * ("delete all" keeps a confirm instead). `remove` resolves to what `restore`
 * needs, or undefined when the record was already gone. Failures are shown,
 * never thrown; resolves to false when the delete failed.
 */
export async function deleteWithUndo<T>(
  noun: string,
  remove: () => Promise<T | undefined>,
  restore: (deleted: T) => Promise<void>,
): Promise<boolean> {
  let deleted: T | undefined;
  try {
    deleted = await remove();
  } catch (e) {
    logError(e, `delete ${noun}`);
    showSnackbar(friendlyError(e, `Couldn't delete the ${noun}.`), { danger: true });
    return false;
  }
  if (deleted === undefined) return true;
  const kept = deleted;
  showSnackbar(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} deleted.`, {
    action: {
      label: 'Undo',
      onClick: () => {
        restore(kept).catch((e: unknown) => {
          logError(e, `restore ${noun}`);
          showSnackbar(`Couldn't restore the ${noun}.`, { danger: true });
        });
      },
    },
  });
  return true;
}

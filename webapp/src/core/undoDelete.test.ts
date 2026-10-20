import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSnackbarStore } from './snackbar';
import { deleteWithUndo } from './undoDelete';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('deleteWithUndo', () => {
  beforeEach(() => {
    useSnackbarStore.setState({ message: null, action: null, danger: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('deletes at once and puts the record back on Undo', async () => {
    const restore = vi.fn(() => Promise.resolve());
    expect(await deleteWithUndo('note', () => Promise.resolve({ id: 'n1' }), restore)).toBe(true);
    const { message, action } = useSnackbarStore.getState();
    expect(message).toBe('Note deleted.');
    expect(action?.label).toBe('Undo');

    action?.onClick();
    expect(restore).toHaveBeenCalledWith({ id: 'n1' });
  });

  it('says so when the delete or the Undo fails', async () => {
    const failed = await deleteWithUndo('ship', () => Promise.reject(new Error('quota')), () =>
      Promise.resolve(),
    );
    expect(failed).toBe(false);
    expect(useSnackbarStore.getState()).toMatchObject({ message: "Couldn't delete the ship.", danger: true });

    await deleteWithUndo('link', () => Promise.resolve('l1'), () => Promise.reject(new Error('quota')));
    useSnackbarStore.getState().action?.onClick();
    await flush();
    expect(useSnackbarStore.getState()).toMatchObject({ message: "Couldn't restore the link.", danger: true });
  });

  it('shows nothing when the record was already gone', async () => {
    expect(await deleteWithUndo('note', () => Promise.resolve(undefined), () => Promise.resolve())).toBe(true);
    expect(useSnackbarStore.getState().message).toBeNull();
  });
});

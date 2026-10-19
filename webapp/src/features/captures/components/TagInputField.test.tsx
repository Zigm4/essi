import { act, createRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TagInputField, type TagInputHandle } from './TagInputField';

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let host: HTMLDivElement;
let root: Root;
let current: string[] = [];
const handle = createRef<TagInputHandle>();

function Harness({ initial = [] }: { initial?: string[] }) {
  const [tags, setTags] = useState<string[]>(initial);
  current = tags;
  return <TagInputField ref={handle} tags={tags} onChange={setTags} suggestionPool={[]} />;
}

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  current = [];
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(initial?: string[]): HTMLInputElement {
  act(() => root.render(<Harness initial={initial} />));
  return host.querySelector('input') as HTMLInputElement;
}

/** A paste: the whole text lands in the field in one input event. */
function insertText(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, input.value + text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** A paste event carrying `text` (jsdom has no ClipboardEvent / DataTransfer). */
function paste(input: HTMLInputElement, text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  act(() => {
    input.dispatchEvent(event);
  });
  return event;
}

describe('Captures TagInputField', () => {
  it('splits a pasted list into one tag per entry', () => {
    const input = render();
    insertText(input, 'intel, mars trade ');
    expect(current).toEqual(['intel', 'mars', 'trade']);
    expect(input.value).toBe('');
  });

  it('keeps the last fragment typed until it is committed', () => {
    const input = render(['Intel']);
    insertText(input, 'intel,#mars trade');
    expect(current).toEqual(['Intel', 'mars']);
    expect(input.value).toBe('trade');
    act(() => {
      handle.current?.commitPending();
    });
    expect(current).toEqual(['Intel', 'mars', 'trade']);
    expect(input.value).toBe('');
  });

  it('turns pasted lines into separate tags', () => {
    const input = render();
    const event = paste(input, '#intel\n#mars\n');
    expect(event.defaultPrevented).toBe(true);
    expect(current).toEqual(['intel', 'mars']);
    expect(input.value).toBe('');
  });

  it('leaves a single-line paste to the browser', () => {
    const input = render();
    expect(paste(input, 'salvage').defaultPrevented).toBe(false);
    expect(current).toEqual([]);
  });
});

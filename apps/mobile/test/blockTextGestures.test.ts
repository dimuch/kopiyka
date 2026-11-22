import { describe, expect, it } from 'vitest';
import { blockTextGestures } from '@/components/blockTextGestures';

/** A stand-in for the list's DOM node: real events, and a style that records what was set. */
function fakeNode() {
  const set: Record<string, string> = {};
  const node = Object.assign(new EventTarget(), {
    style: {
      setProperty: (name: string, value: string | null) => {
        set[name] = value ?? '';
      },
    },
  });
  return { node, set };
}

function contextMenu(target: EventTarget): boolean {
  const event = new Event('contextmenu', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('blockTextGestures', () => {
  it('turns off text selection and the iOS callout, and sets nothing else', () => {
    const { node, set } = fakeNode();
    blockTextGestures(node);
    expect(set).toEqual({
      'user-select': 'none',
      '-webkit-user-select': 'none',
      '-webkit-touch-callout': 'none',
    });
  });

  it('stops the context menu on the list, not elsewhere', () => {
    const { node } = fakeNode();
    blockTextGestures(node);
    expect(contextMenu(node)).toBe(true);
    expect(contextMenu(new EventTarget())).toBe(false);
  });

  it('lets the context menu through again after cleanup', () => {
    const { node } = fakeNode();
    const cleanup = blockTextGestures(node);
    cleanup();
    expect(contextMenu(node)).toBe(false);
  });
});

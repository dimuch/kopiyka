/** The part of a DOM element this needs, so a test can pass a stand-in. `HTMLElement` fits it. */
type ListNode = { style: Pick<CSSStyleDeclaration, 'setProperty'> } & Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

// One function for every list, so a repeated add (StrictMode runs effects twice in dev) is a no-op.
function preventMenu(event: Event) {
  event.preventDefault();
}

/**
 * Web only (brief 097): in a phone browser a long-press on text is also the browser's own gesture, so picking up a
 * row would select its words and open the iOS callout or the Android menu along with the drag. Turns all three off
 * on the node and everything in it. Returns a cleanup that removes the listener; the styles go with the node.
 */
export function blockTextGestures(node: ListNode): () => void {
  node.style.setProperty('user-select', 'none');
  node.style.setProperty('-webkit-user-select', 'none');
  node.style.setProperty('-webkit-touch-callout', 'none');
  node.addEventListener('contextmenu', preventMenu);
  return () => node.removeEventListener('contextmenu', preventMenu);
}

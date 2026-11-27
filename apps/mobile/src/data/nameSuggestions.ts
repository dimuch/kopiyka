// Name suggestions on the expense form (brief 108). The API ranks the names; the form only filters them as you type.

/** How many suggestions the form shows at most. */
export const SUGGESTION_LIMIT = 20;

/** The ranked names containing the typed text, ignoring case and surrounding spaces, in their order. */
export function matchingNames(names: string[], typed: string): string[] {
  const needle = typed.trim().toLowerCase();
  return names.filter((name) => name.toLowerCase().includes(needle)).slice(0, SUGGESTION_LIMIT);
}

/**
 * Where to scroll a list of `rowHeight` rows, `visibleRows` tall and scrolled to `scrollY`, so row `index` is fully in
 * view: its top for a row cut off above, the offset that puts it on the bottom row for one cut off below, or null
 * when it's already fully visible.
 */
export function scrollToShow(index: number, scrollY: number, rowHeight: number, visibleRows: number): number | null {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  const viewHeight = visibleRows * rowHeight;
  if (top < scrollY) return top;
  if (bottom > scrollY + viewHeight) return bottom - viewHeight;
  return null;
}

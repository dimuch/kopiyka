/** The pure maths behind dragging a row to a new place in a list (brief 092). */

/** A copy of `items` with the one at `from` moved to `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const moved = [...items];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item as T);
  return moved;
}

/**
 * Where the row at `from`, dragged `dy` pixels, lands: past every other row whose middle its own middle has passed.
 * `heights` are the rows' heights, top first.
 */
export function dropIndex(heights: readonly number[], from: number, dy: number): number {
  const tops = heights.map((_, index) => heights.slice(0, index).reduce((sum, height) => sum + height, 0));
  const middleOf = (index: number) => tops[index]! + heights[index]! / 2;
  const draggedMiddle = middleOf(from) + dy;
  let to = from;
  heights.forEach((_, index) => {
    if (index > from && draggedMiddle > middleOf(index)) to++;
    if (index < from && draggedMiddle < middleOf(index)) to--;
  });
  return to;
}

/**
 * How far a row that isn't held moves aside while the held row goes from `from` to `to`: up by its height for the
 * rows it passed going down, down for those it passed going up.
 */
export function rowOffset(index: number, from: number, to: number, draggedHeight: number): number {
  if (from < index && index <= to) return -draggedHeight;
  if (to <= index && index < from) return draggedHeight;
  return 0;
}

/** How close to the list's top or bottom (px) the finger starts the list scrolling. */
const EDGE_ZONE = 56;
/** The fastest scroll (px a frame), with the finger at or past the edge. */
const MAX_STEP = 12;

/**
 * Pixels to scroll the list this frame while a row is held at `pointerY`: up (negative) near `top`, down near
 * `bottom`, faster the closer the finger is to the edge, and 0 elsewhere. All in window coordinates.
 */
export function edgeStep(pointerY: number, top: number, bottom: number): number {
  const intoTop = EDGE_ZONE - (pointerY - top);
  const intoBottom = EDGE_ZONE - (bottom - pointerY);
  const step = (into: number) => Math.round((MAX_STEP * Math.min(into, EDGE_ZONE)) / EDGE_ZONE);
  if (intoTop > 0) return -step(intoTop);
  if (intoBottom > 0) return step(intoBottom);
  return 0;
}

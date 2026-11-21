/**
 * A member's own order of a ledger's categories (brief 092). The app saves one month's list in its new order; this
 * merges it into the member's order for the whole ledger, where other months can show categories this one lacks.
 */

/**
 * LEFT JOINs the member's position `o.list_position` onto categories `c`. The member's user id is the next param. Joins
 * on the full primary key.
 */
export const MY_ORDER_JOIN = `LEFT JOIN category_orders o
    ON o.ledger_id = c.ledger_id AND o.user_id = ? AND o.category_id = c.category_id`;

/** The member's placed categories first, by position; the rest after, in the ledger's order. */
export const IN_MY_ORDER = 'o.list_position IS NULL, o.list_position, c.sort_order, c.category_id';

/**
 * The longest run of `shown` that keeps its order in `current`: the categories the drop didn't move. On a tie, the
 * run whose ids come earliest in `shown` wins, so for one drag only an adjacent swap is ambiguous and the dragged
 * row is whichever comes second.
 */
function longestRising(current: readonly number[], shown: readonly number[]): Set<number> {
  const place = new Map(current.map((id, index) => [id, index]));
  const places = shown.map((id) => place.get(id)!);
  const runLength = places.map(() => 1);
  const before = places.map(() => -1);
  let end = 0;
  for (let index = 0; index < places.length; index++) {
    for (let earlier = 0; earlier < index; earlier++) {
      if (places[earlier]! < places[index]! && runLength[earlier]! + 1 > runLength[index]!) {
        runLength[index] = runLength[earlier]! + 1;
        before[index] = earlier;
      }
    }
    if (runLength[index]! > runLength[end]!) end = index;
  }
  const kept = new Set<number>();
  for (let index = end; index !== -1 && shown.length > 0; index = before[index]!) kept.add(shown[index]!);
  return kept;
}

/**
 * `current` is the member's whole order of the ledger's live categories; `shown` is some of them in a new order.
 * Categories the drop didn't move keep their place against every category, shown or not. Each moved one goes right
 * after the category now above it in `shown`, or to the top. The result has every id of `current` once.
 */
export function mergeOrder(current: readonly number[], shown: readonly number[]): number[] {
  const kept = longestRising(current, shown);
  const merged = current.filter((id) => kept.has(id) || !shown.includes(id));
  shown.forEach((id, index) => {
    if (kept.has(id)) return;
    merged.splice(index === 0 ? 0 : merged.indexOf(shown[index - 1]!) + 1, 0, id);
  });
  return merged;
}

# Plan: Order categories my way

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: PR 1 `feat/category-order`; PR 2 `feat/category-order-drag`
Base: PR 1 origin/main (71463c6, 1.12.0; rebased from 5f148bc in review); PR 2 origin/main after PR 1 merges (not stacked unless the user says so)

## Approach

**Storage.** A new table `category_orders` holds one row per member, ledger and category: that member's position for
it. Positions are the same in every month. A save rewrites a position for every live category of the ledger. A
category with no row comes after the placed ones, in today's `sort_order, category_id` order. That covers new
categories (from either member) and anyone who never reordered. The rows go with the membership, as a ledger label
does (brief 056).

**Reading.** `GET /api/ledgers/:id/categories` LEFT JOINs the caller's rows and orders by
`o.list_position IS NULL, o.list_position, c.sort_order, c.category_id`. `pickQuick` keeps its own sort, so the quick
row doesn't change (brief: out of scope). Every surface reads this one list: Budget, Expenses, the form's "More"
sheet, and the connector's month summary.

**Saving.** `PUT /api/ledgers/:id/categories/order` takes the month's list in its new order. Its rule and SQL live in
`categories/order.ts`: `routes.ts` is already 205 lines (conventions §2).

- The app only knows one month's list, but other months can show categories this one lacks.
- So the server merges: categories the drop didn't move keep their order against every category, shown or not. Each
  moved one goes right after the category now above it, or to the top.
- "Moved" means the fewest categories that explain the new order: the ones outside a longest run that kept its old
  order. For one drag, that's the dragged row.

**Drag (PR 2).** A `ReorderList` component built on `PanResponder` and `Animated` (no new dependency):

- Each row's `Pressable` keeps `onPress` and gets `onLongPress`, which picks the row up and turns the screen's
  `scrollEnabled` off.
- The list's `onMoveShouldSetPanResponderCapture` is true only while a row is held. On the first move after the
  long-press it takes the touch from the `Pressable`, which then won't fire `onPress`.
- So a tap still opens the row, and a scroll that starts before the long-press still scrolls.
- The pure maths (drop index, how far the other rows move aside, scroll step at the edges, moving an item) goes in
  `data/reorder.ts`, with unit tests.
- `data/useCategoryOrder.ts` shows the new order at once, saves it, and puts the old order back with a message if the
  save fails.

Alternative considered (merge rule): when the list is saved, each category the month hides stays next to the one that
followed it. That's about 12 lines fewer here and in the demo. It lost because a category added later would jump from
the end to the middle of other months whenever the row above it moved. The rule chosen leaves everything the drop
didn't touch where it was.

Alternative considered (body): send only the move (`{ categoryId, beforeId }`). It lost because the brief's AC asks
for "category ids in order" with repeats rejected, and a list body is idempotent for `PUT`.

## Contracts

- DB: `apps/api/migrations/017_category_orders.sql` (PR 1)

  ```sql
  -- Brief 092. Each member's own order of a ledger's categories, the same in every month. A save writes a position for
  -- every live category of the ledger; one with no row (added since, or never ordered) comes after the placed ones in
  -- categories.sort_order, then category_id. The rows go with the membership, like ledger_members.label.
  CREATE TABLE IF NOT EXISTS category_orders (
    ledger_id      INT UNSIGNED NOT NULL,
    user_id        INT UNSIGNED NOT NULL,
    category_id    INT UNSIGNED NOT NULL,
    list_position  INT UNSIGNED NOT NULL,   -- 0 = top
    PRIMARY KEY (ledger_id, user_id, category_id),
    CONSTRAINT fk_category_orders_member FOREIGN KEY (ledger_id, user_id)
      REFERENCES ledger_members (ledger_id, user_id) ON DELETE CASCADE,
    CONSTRAINT fk_category_orders_category FOREIGN KEY (category_id)
      REFERENCES categories (category_id) ON DELETE CASCADE
  );
  ```

  This is additive. The previous release ignores the table, so rollback keeps working (people then see the ledger
  order).

- API (PR 1): `PUT /api/ledgers/:id/categories/order` with guards `requireAuth, requireLedger`.
  - Body: `{ categoryIds: number[] }`, top first, each a positive integer appearing once, at least one.
  - Response: `204`, no body.
  - `400 invalid_request` (Zod, global handler): body missing or not an array, an empty array, a non-integer or ≤ 0
    id, a repeated id.
  - `400 unknown_category` (the code expense writes already use): an id that isn't a live category of this ledger.
    That covers unknown ids, another ledger's, and those deleted before 028 (`categories.deleted_at`). Nothing is
    written. A category that's live in the ledger but removed from the month, or from every month, is accepted and
    placed: the order isn't month data, and a partner removing a row mid-drag mustn't fail the save. The AC's
    'deleted' is read as `categories.deleted_at`.
  - `401 unauthorized` when signed out. `404 ledger_not_found` for a non-member.
  - API tokens get `403 insufficient_scope`: the route isn't in `WRITE_TOKEN_ROUTES`, so the connector can't reorder.
  - There's no `month_ended` check: the order isn't month data.
- API (PR 1): `GET /api/ledgers/:id/categories?month=`: same body. `categories` now comes in the caller's order.
  `CategoryDto.sortOrder` stays the ledger's `sort_order`; its doc comment, and the mirror in
  `apps/mobile/src/api/types.ts`, say the array is in the caller's order (brief 092). `quickCategoryIds` doesn't
  change. Consumers: `useMonth` and `useMonthCategories` (app), the demo store, and `apps/mcp` `tools.ts`. The
  connector's month summary maps categories in API order and nothing there sorts or asserts order.
- `apps/api/src/categories/order.ts` (PR 1, new):
  - `mergeOrder(current: number[], shown: number[]): number[]` is pure. `current` is the member's whole order of the
    ledger's live categories; `shown` is a subset in its new order. The result has every id of `current` once.
  - `MY_ORDER_JOIN` is SQL that LEFT JOINs `category_orders o` for categories `c`; the user id is the next param.
  - `IN_MY_ORDER` is the ORDER BY fragment above.
  - `saveOrder(db, ledgerId, userId, categoryIds): Promise<'saved' | 'unknown_category'>` runs in `withTransaction`:
    1. Lock the member's `ledger_members` row `FOR UPDATE`. This must be the first statement, as `lockLedger` does, so
       two saves by one person run one after the other.
    2. Read `current` with `MY_ORDER_JOIN` / `IN_MY_ORDER` over the ledger's live categories.
    3. Refuse with `unknown_category` if an id isn't in `current`.
    4. Delete the member's rows for the ledger and insert `mergeOrder(current, categoryIds)` as positions 0…n−1 in
       one `VALUES ?`.
- Demo (PR 1): `StoreData.order: number[]` holds the one demo user's order, top first, and is empty until they
  reorder.
  - `inMyOrder(data, categories)`, private in `demo/categoryRoutes.ts`, sorts by place in `order`, then
    `sortOrder`, then `categoryId`.
  - The `categoryRoutes` GET uses it.
  - A new `PUT` route in `categoryRoutes.ts` repeats the API's checks, refusals and `mergeOrder`.
  - `sampleData` and `test/demoFixture.ts` start with `order: []`.
- App (PR 2):
  - `data/categories.ts`: `saveCategoryOrder(ledgerId: number, categoryIds: number[]): Promise<void>` sends the
    `PUT` above.
  - `data/reorder.ts` (pure):
    - `moveItem<T>(items: readonly T[], from: number, to: number): T[]`.
    - `dropIndex(heights: readonly number[], from: number, dy: number): number` gives where the dragged row lands:
      after every other row whose middle its own middle has passed.
    - `rowOffset(index: number, from: number, to: number, draggedHeight: number): number` gives how far a row that
      isn't held moves aside: `−draggedHeight` for `from < index ≤ to`, `+draggedHeight` for `to ≤ index < from`, and
      0 otherwise.
    - `edgeStep(pointerY: number, top: number, bottom: number): number` gives pixels to scroll this frame. It is
      negative within 56 px of `top` and positive within 56 px of `bottom`, rising linearly to 12 at (or past) the
      edge, and 0 elsewhere.
  - `data/useCategoryOrder.ts`:
    `useCategoryOrder(ledgerId: number, categories: Category[] | null, onSaved: () => void)` returns
    `{ categories: Category[] | null; move: (from: number, to: number) => void; saving: boolean; failed: boolean }`.
    - `move` applies `moveItem` at once: the new array is kept with the array it was made from, and shown while
      `categories` is still that array.
    - It then sends the new ids. On success it calls `onSaved` (the screen's `reload`). The reloaded list is a new
      array, so the local copy stops applying with no flicker.
    - On failure it drops the local copy, so the old order is back, and `failed` is true until the list reloads or
      the next drop.
    - `saving` blocks a new pick-up until the save settles, so two saves never race.
  - `components/ReorderList.tsx`: `ReorderList<T>(props)`. Its props:
    - `items: readonly T[]` and `keyOf: (item: T) => number`.
    - `renderRow: (item: T, index: number, drag: { onLongPress?: () => void; onPressOut?: () => void }) => ReactNode`.
      The row spreads `drag` on the `Pressable` that picks it up.
    - `onMove: (from: number, to: number) => void`, called only when `from !== to`.
    - `disabled: boolean`.
    - `onDragChange: (dragging: boolean) => void`. The screen sets `scrollEnabled={!dragging}`.
    - `scrollRef: RefObject<ScrollView | null>` (added in slice 9). The list must be a direct child of that scroll
      view's content.
    - `style?: StyleProp<ViewStyle>`.
- Reuses: `withTransaction`, `inMonthList`/`NAME_IN_MONTH` (unchanged), `unknown_category`'s meaning from
  `expenses/routes.ts`, `LoadError` (no `onRetry`) for the "not saved" line, `@/components/Pressable`, `useMonth`'s
  `reload`, the demo's `refuse` and `Route`, and the test helpers `makeUser`, `addMember`, `storeMonthList` and
  `authHeader`.
- New dependencies: none. The drag uses React Native's `PanResponder`, `Animated`, `Pressable.onLongPress`,
  `ScrollView.scrollTo`/`scrollEnabled` and `measureInWindow`. All are core RN 0.88 APIs (reactnative.dev 0.88 docs).

## Version

PR 1: Bump minor, 1.12.0 → 1.13.0 (brief 089 took 1.12.0 first, §8b step 4).
Why: §8b `minor` covers a new API route (`PUT …/categories/order`) and an additive migration. Shipped app builds and
the connector keep working: they never send the route, and the list keeps its shape. Rollback runs on the extra table.

PR 2: Bump minor, 1.13.0 → 1.14.0 (or `main`'s number +minor at that time).
Why: §8b `minor` covers a new user action (drag to reorder on Budget and Expenses). Nothing existing stops working.

## Slices

### PR 1: API, migration and demo store (`feat/category-order`, ~450 lines, about 60% tests)

- [x] 0. Bump version to 1.13.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.13.0
- [x] 1. Add a table for each member's category order (~45)
  - Files: `apps/api/migrations/017_category_orders.sql`, `apps/api/test/categoryOrders.migration.int.test.ts`
    (new), `apps/api/test/helpers.ts` (`'category_orders'` first in `DATA_TABLES`, because `clearData` turns FK checks
    off, so the cascades don't run)
  - Tests: `SHOW COLUMNS FROM category_orders` gives `[ledger_id int unsigned NO]`, `[user_id int unsigned NO]`,
    `[category_id int unsigned NO]` and `[list_position int unsigned NO]`; running `runMigrations` again returns `[]`.
- [x] 2. Work out a member's whole order from one month's new order (~85)
  - Files: `apps/api/src/categories/order.ts` (new: `mergeOrder` and a private `longestRising`),
    `apps/api/test/categoryOrder.test.ts` (new)
  - Change: keep the longest run of `shown` that's in `current` order. On a tie, keep the run whose ids come earliest in
    `shown`. In the O(n²) DP, each id's predecessor is the earliest earlier id that gives it the longest run, and the
    run ends at the first id that reaches the overall longest length. For a single drag, only an adjacent swap ties. Every other id in `current` keeps its place. Each moved id goes
    right after its new predecessor in `shown`, or first if it has none. Moved ids go in `shown` order.
  - Tests (table, values checked with a scratch script). With P=1, X=2, h=3, S=4:
    - `[1,2,3]`, `[3,1,2]` → `[3,1,2]` (the whole list is shown).
    - `[P,X,h,S]`, `[P,S,X]` → `[P,h,S,X]` (X moved down; hidden h keeps its place before S).
    - `[1,2,3]`, `[2]` → `[1,2,3]` and `[1,2,3,4]`, `[2,4]` → `[1,2,3,4]` (nothing moved).
    - `[5,6,7]`, `[6,5]` → `[6,5,7]` (a category the month lacks stays last).
    - `[8,1,2]`, `[2,1]` → `[8,2,1]` (a tie keeps the first run, 2; 1 goes after it).
    - `[1,2,3,4,5]`, `[5,4,1,2,3]` → `[5,4,1,2,3]` (two moved, in shown order).
- [x] 3. List categories in the caller's own order (~75)
  - Files: `apps/api/src/categories/order.ts` (`MY_ORDER_JOIN`, `IN_MY_ORDER`), `apps/api/src/categories/routes.ts`
    (the list query joins it; params `[first, first, userId, ledgerId, first]`; `sortOrder` doc),
    `apps/mobile/src/api/types.ts` (doc line), `apps/api/test/categoryOrder.int.test.ts` (new)
  - Change: the list `ORDER BY` becomes `IN_MY_ORDER`. Nothing writes rows yet, so nothing moves for anyone.
  - Note: `MY_ORDER_JOIN` joins on `o.ledger_id = c.ledger_id AND o.user_id = ? AND o.category_id = c.category_id`
    (the full primary key).
  - Tests:
    - Setup: `owner` and `member` (`addMember`) on one ledger, with rows inserted directly. The owner has
      `gym` 0 and `rent` 1. The member has `car` 0.
    - The owner's October list starts `gym, rent, groceries, education…`: the rest follow in `sort_order`.
    - The member's starts `car, rent, groceries…`.
    - A third user with no rows (a second member) sees the 15 in `sort_order`.
    - `quickCategoryIds` is the same for all three.
- [x] 4. Save my category order from a month's new order (~150)
  - Files: `apps/api/src/categories/order.ts` (`saveOrder`), `apps/api/src/categories/routes.ts` (`OrderBody`, the
    `PUT` route), `apps/api/test/categoryOrder.int.test.ts`
  - Note: `OrderBody` checks repeated ids with `.refine((ids) => new Set(ids).size === ids.length)` and caps the
    array with `.max(500)` (far above any ledger's list).
  - Tests:
    - happy: the owner `PUT`s October's 15 ids with `gym` first → 204. The list is in that order in October and in
      September (the same in every month).
    - a month that lacks some categories: October without `fun` (`storeMonthList`). Moving `gym` to the top there
      leaves `fun` between `clothes` and `eating_out` in September.
    - a category added after the save (`POST …/months/2026-10/categories`) comes last for the saver.
    - other members: after the owner's save, the member's list is unchanged. After the member saves their own, the
      owner's is unchanged.
    - `400 unknown_category`: an id that doesn't exist, another ledger's category, and a category with
      `deleted_at` set. Each time the saver's order is unchanged afterwards.
    - `400 invalid_request`: a repeated id, `[]`, a missing body, and `[0]`.
    - `401` with no auth header; `404 ledger_not_found` for a non-member's `PUT`.
- [x] 5. Keep my category order in the demo too (~95)
  - Files: `apps/mobile/src/demo/state.ts` (`order`), `apps/mobile/src/demo/categoryRoutes.ts` (the GET sorts with
    a private `inMyOrder`; new `PUT` route with a private `mergeOrder`), `apps/mobile/src/demo/sampleData.ts`,
    `apps/mobile/test/demoFixture.ts`, `apps/mobile/test/demoCategories.test.ts`
  - Tests (new describe "demo categories, my order"):
    - Saving `[2,1]` (November's list, food first) lists `food, rent` in November and `rent, old` in October. The
      whole order becomes `[2,1,3]`: 1 is the moved one on the tie and goes after 2, and 3 keeps its place after
      both. Checked with the scratch script.
    - A category added to November after the save comes last.
    - `[1,1]` → 400 `invalid_request`; `[]` → 400 `invalid_request`; `[99]` → 400 `unknown_category`, with the
      order unchanged.
    - With no saved order, the list stays in sort order: the existing tests pass unchanged.
  - Verify: `yarn mobile export:web && yarn mobile check-builds` pass without `--accept` (no new demo module).

### PR 2: drag to reorder (`feat/category-order-drag`, from `main` after PR 1 merges, ~400 lines)

- [x] 6. Bump version to 1.14.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.14.0 (or `main`'s number +minor)
- [x] 7. Work out where a dragged row lands and how the others make room (~95)
  - Files: `apps/mobile/src/data/reorder.ts` (new), `apps/mobile/test/reorder.test.ts` (new)
  - Tests (table):
    - `moveItem(['a','b','c','d'], 0, 2)` → `b,c,a,d`; `(3, 0)` → `d,a,b,c`; `(1, 1)` → unchanged and not the same
      array.
    - `dropIndex([50,50,50,50], 0, 0)` → 0; `(…, 0, 26)` → 0 (its middle, 51, hasn't passed row 1's, 75);
      `(…, 0, 51)` → 1; `(…, 3, -200)` → 0; `(…, 1, 500)` → 3. With mixed heights, `([50,70,50], 0, 61)` → 1 and
      `(…, 0, 59)` → 0.
    - `rowOffset`: from 0 to 2 with height 50 gives rows 1 and 2 → −50 and row 3 → 0. From 3 to 1 gives rows 1 and
      2 → +50 and row 0 → 0.
    - `edgeStep(300, 100, 700)` → 0; `(100, 100, 700)` → −12; `(672, 100, 700)` → 6; `(800, 100, 700)` → 12 (finger
      below the list, over the tab bar); `(130, 100, 700)` → −6 (rounded).
- [x] 8. Drag a category to a new place on the Budget tab (~200; the smallest slice a person can check end to end)
  - Files: `apps/mobile/src/components/ReorderList.tsx` (new), `apps/mobile/src/data/useCategoryOrder.ts` (new),
    `apps/mobile/src/data/categories.ts` (`saveCategoryOrder`), `apps/mobile/src/app/(tabs)/budget.tsx`,
    `apps/mobile/demo-modules.txt` (`yarn mobile export:web && yarn mobile check-builds --accept`: the three new
    modules)
  - `ReorderList`:
    - The `PanResponder` is created in a `useState(() => PanResponder.create(...))` initializer; its handlers read
      the held row from a ref, not state or render values (`react-hooks/refs`).
    - One `PanResponder` on the list `View`. Its capture handler is true only while a row is held; termination
      requests are refused, which also covers RNW's `selectionchange`/`contextmenu`.
    - `onLongPress` picks a row up: it sets `held` state `{ key, from, to }` and calls `onDragChange(true)`.
    - Moves set a `dragY` `Animated.Value` (`gestureState.dy`). `to` re-renders only when `dropIndex` changes.
    - Each row is an `Animated.View` that reports its height (`onLayout`) to a ref map. It animates its own
      `rowOffset` with `Animated.timing` (150 ms), and resets to 0 without animating when its index changes, so a
      drop doesn't jump.
    - Release or terminate calls `onMove(from, to)` if they differ, then clears `held` and calls
      `onDragChange(false)`.
    - A long-press released without a move ends in `onPressOut`. The check is deferred one frame, because the hand-off
      to the pan responder also fires `onPressOut` just before its grant.
    - The held row sits above the others (`zIndex`), with the surface colour behind it and `scale` 1.03.
    - The list has `userSelect: 'none'`.
    - `useNativeDriver: false` throughout: the held row follows the finger from JS anyway.
  - Budget: `useCategoryOrder(ledger.ledgerId, data?.categories ?? null, reload)`. The list card becomes a
    `ReorderList` with `disabled={order.saving}`, and `ScrollView` gets `scrollEnabled={!dragging}`.
    - The row `Pressable` gets `{...drag}`. The edit button doesn't, so it only taps.
    - An ended month's rows become a `Pressable` with only `{...drag}`, `accessible={false}` and `focusable={false}`,
      so screen readers and the keyboard meet what they do today. Ordering works in any month (brief Notes).
    - On failure, `LoadError` without `onRetry` shows "Couldn’t save the order. Check your connection and try
      again." above the card.
  - Verify (web, phone width, `web` + `api` launch configs):
    - Long-press rent, drag it below groceries and drop. The rows move aside while dragging and the new order shows.
      After a reload it's still there. Expenses, the Add expense form's "More" sheet and the October list show it
      too.
    - A short tap opens the planned-amount form and the edit icon opens the form. An ended month's rows dim while
      pressed, like every `@/components/Pressable` (accepted), and a tap does nothing else.
    - The wheel/trackpad scroll still scrolls. With the API stopped, a drop snaps back and shows the line.
    - Removing a category still offers Undo.
    - On iPhone (Expo Go), the same, plus: a flick that starts on a row scrolls and doesn't pick it up.
- [x] 9. Scroll the list while a held row is near its top or bottom (~55)
  - Files: `apps/mobile/src/components/ReorderList.tsx` (`scrollRef`), `apps/mobile/src/app/(tabs)/budget.tsx`
    (`ref`)
  - Change:
    - On pick-up, `measureInWindow` the scroll view and the list. The scroll offset is the list's `onLayout` y minus
      (list window y − scroll window y).
    - While held, a `requestAnimationFrame` loop applies `edgeStep(moveY, …)`. It clamps the offset to
      `[0, list bottom − viewport height]`, calls `scrollTo({ y, animated: false })`, and adds the scrolled distance
      to `dragY` and `dropIndex`'s `dy`.
    - The loop stops on drop and on unmount.
  - Verify (web at phone width and iPhone): in a 15-category month, drag the top row to the bottom edge. The list
    scrolls and it drops last. Drag it back up past the top edge and it drops first.
- [x] 10. Drag categories on the Expenses tab too (~45)
  - Files: `apps/mobile/src/app/(tabs)/expenses.tsx`
  - Change:
    - `rows` is built from `useCategoryOrder(...).categories`, and the list card becomes a `ReorderList`.
    - `Animated.ScrollView` gets `ref` and `scrollEnabled={!dragging}`.
    - The row `Pressable` gets `{...drag}`, and the same "not saved" line shows.
    - The collapsing summary keeps working: programmatic scrolls still fire its `onScroll`.
  - Verify (web and iPhone):
    - Long-press a row, drag and drop. Budget and "More" show the new order. A tap opens the category; scrolling
      collapses the card as before. An auto-scroll past the card works.
    - A failed save snaps back with the line.
    - Demo build (`yarn mobile web:demo`): a drag on either tab shows on the other tab and in "More". It holds until
      a page reload, which starts the demo over.

## AC → evidence

| AC                                                                     | Evidence                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| API saves my order; 401, 404, unknown/deleted, repeats, others' orders | `categoryOrder.int.test.ts` slice 4 (each case listed there); merge rule `categoryOrder.test.ts` slice 2                                         |
| GET in caller's order; unplaced ones after in `sort_order, id`         | `categoryOrder.int.test.ts` slice 3 (two members, a third with no rows)                                                                          |
| Web: drag on Budget → Budget, Expenses, Home, "More"; survives reload  | slice 8 Verify (Home has no category list: its cards don't change, see Open questions); slice 10 Verify from Expenses                            |
| Tap opens; scroll scrolls; failed save restores + says so              | slice 8 and 10 Verify (tap, edit icon, wheel/flick, API stopped); `useCategoryOrder` rollback seen there                                         |
| iPhone (Expo Go) on both tabs                                          | slice 8, 9 and 10 iPhone checks, recorded in PR 2's test plan                                                                                    |
| Demo store follows the same rules                                      | `demoCategories.test.ts` slice 5; slice 10 demo check                                                                                            |
| No new dependency                                                      | `apps/mobile/package.json` and `yarn.lock` unchanged in both PRs (reviewer checks the diff)                                                      |
| Gates green                                                            | every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`; PR 2 also `yarn mobile export:web && yarn mobile check-builds` |

## Not doing (YAGNI)

- A "reset to ledger order" button, ordering per month or per tab, and changing `categories.sort_order` (out of scope).
- The quick row keeps `pickQuick`'s most-recently-used sort with its `sort_order` fallback (out of scope).
- Ordering from the connector: write tokens stay limited to `WRITE_TOKEN_ROUTES`. Order in Notion sync and imports
  isn't touched (out of scope).
- Keyboard/screen-reader reordering and haptics (out of scope).
- The Statistics summary route (PR #130) sorts its categories by spent, then `sort_order`. The brief doesn't list
  Statistics, so it stays on the ledger order (Follow-ups).
- No query per id: ids are checked against the ledger's list in memory, not in an `IN (…)`.
- No test for an API token's `PUT`: default-deny is already covered by `apiTokens.auth.int.test.ts`.
- `deploy/export-ledger.sh` doesn't export orders: it's a one-off start-up script, and an order is a preference.

## Risks

- **Hand-off from `Pressable` to the list's pan responder.** On web, RNW's `PressResponder` might not yield on the
  capture, or might still fire `onPress` via `click`. Proven or disproven by slice 8 on web and iPhone.
  - From reading RNW 0.21's `PressResponder`: it yields on termination requests (`cancelable` defaults to true), and
    its `click` is cancelled once a long-press fired (`_longPressDispatched`).
  - If either fails, stop and revise the plan before slice 9.
- **iOS native scroll after pick-up.** `scrollEnabled` turns off a render after `onLongPress`. A move inside that
  frame could start a native scroll. Slice 8 iPhone check. If it bites, the fallback is to turn scrolling off on
  `onPressIn` and back on at `onPressOut` when no long-press fired; that's a plan revision.
- **One-frame jump at drop** (rows reset while the list re-renders in the new order). Slice 8 web and iPhone check.
  The index-change reset is the planned mitigation.
- **Auto-scroll offset maths** relies on the list being a direct child of the scroll content, which is true on both
  tabs today, and on `measureInWindow` matching `gestureState.moveY`'s coordinates. Slice 9 checks this on web and
  iPhone.
- **`Animated.ScrollView` ref** typing as `ScrollView` (for `scrollTo`/`measureInWindow`): slice 10 typecheck.
- **Merge ties**: when two neighbouring rows swap, either could be "the moved one". That changes where a category the
  month doesn't show ends up. Pinned by slice 2's tie case; it only matters for a category sitting between the two.
- **Membership removed mid-save**: the insert's FK fails and the API returns 500, which the app shows as "not saved".
  The window is milliseconds and the next request gets 404, so there's no branch for it.

## Open questions

- **yes (Gate A)**: Split the brief into two PRs?
  - PR 1 is the API, migration and demo store, about 450 lines with about 60% tests. The demo has to ship with the
    API rule (conventions §2), so the split can't go lower.
  - PR 2 is the drag on both tabs, about 400 lines.
  - Assumption: yes. PR 2 starts from `main` after PR 1 merges, with the same brief and plan.
- no: Home has no category list today (three money cards, Statistics, Settings), so nothing there can follow the
  order. Assumption: the AC's "Home" check is that Home's cards are unchanged after a drag.
- no: Ended months take drags on Budget (the brief's Notes say ordering works in any month). Their rows become
  long-press-only `Pressable`s. Assumption: yes.
- no: The rule for categories a month doesn't show, from slice 2: what you didn't move stays put, and a moved row
  goes right after the one above it. Assumption: this is what "my order, the same in every month" means.
- no: "Web with touch" (Safari on iPhone, the PWA) isn't an AC device. Assumption: web is checked with a mouse at
  phone width, and Safari touch is tried once in slice 8 as best effort, with what's seen recorded in the PR.
- no: The connector's month summary will list categories in the token owner's order. Nothing relies on the old order.
  Assumption: fine; no connector change.

## Follow-ups

- The Statistics category list (PR #130's summary route and the coming screen) could follow the member's order as a
  tie-break, if wanted: its own brief.
- `categories/routes.ts` passes 200 lines with slice 4 (~215). A `service.ts` split is a later refactor, not this
  feature.

## Deviations

- Version: PR 1 is 1.13.0, PR 2 1.14.0. Brief 089 (Statistics) took 1.12.0 while PR 1 was in review; the branch was
  rebased onto it.
- `pickQuick` (API and demo) now breaks ties between equally recent categories by `sort_order`, then id. The list
  comes in the caller's own order, so without it a stable sort let that order decide, and partners saw different
  quick rows when one import stamped many categories at once. Found in review; keeps "`quickCategoryIds` doesn't
  change" true.
- The demo's order save refuses a bad body (`[0]`, no `categoryIds`) with `invalid_request`, as the API does.
- slice 8: the drag's state lives in a small `Drag` class made once with `useState(() => new Drag(setHeld))`, not in
  refs read by a `PanResponder` made in a `useState` initializer: the React Compiler lint refuses both ref reads in that
  initializer and assigning to the hook value in an effect. Same behaviour, same file.
- slice 8: the held row's travel is measured from the long-press's `pageY` (`gesture.moveY - startY`), not
  `gesture.dy`. The list only takes the touch on the first move after the long-press, so `dy` lost that first move and
  the row trailed the finger (70 px behind in the web check).
- slice 8: no `userSelect: 'none'` on the list: React Native's `ViewStyle` doesn't type it. Text selection during a
  mouse drag on web is left to the user's manual check.

## Consolidate

PR 1, against origin/main 5f148bc: reused 0 · extracted 0 · left 5.

- LEAVE `mergeOrder`/`longestRising` in `demo/categoryRoutes.ts` (twins of `categories/order.ts`): across the API/app
  boundary. The demo mirrors the API's rules in its own runtime, as `pickQuick` already does.
- LEAVE `inMyOrder` (demo) against `IN_MY_ORDER` (SQL): same boundary.
- LEAVE the member-row lock in `saveOrder`: `lockLedger` locks the `ledgers` row, which would also serialise other
  members' saves; there is no member-row lock to reuse, and this is its only copy.
- LEAVE `OrderBody`: no sibling body takes a list of ids.
- LEAVE the test's `idOf` (same query in `categories.int.test.ts` and `income.int.test.ts`): tests are outside the
  pass, and each suite keeps its own local helpers.

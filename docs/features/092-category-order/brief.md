# Order categories my way

Type: feature

## Why

Categories show in one fixed order per ledger (`categories.sort_order`, seeded 10, 20, … and new ones at the end). The
app can't change it, and on a shared ledger both people would want their own order: the categories I use most at the
top of Budget and Expenses, without moving them for my partner.

Replaces `../015-reorder-categories/brief.md`, which predates per-month lists and asked for a ledger-wide order with
up/down buttons.

## What

- **My own order.** Each user has their own category order per ledger. It is the same in every month: a month shows the
  categories it has, in my order. Another member of the ledger keeps theirs.
- **Drag to reorder.** On the Budget tab and the Expenses tab, I long-press a category row to pick it up, drag it up or
  down, and drop it. The row follows my finger (or mouse), the other rows move out of the way, and the list scrolls to
  let me drag past the visible part. Dropping saves my order at once; there's no Edit or Done mode.
- **A plain tap still opens the row**, and scrolling still scrolls: only a long-press starts a drag.
- **Works on web and in the iPhone app** (Expo Go), with mouse and touch.
- **One order everywhere.** Budget, Expenses, Home and the expense form's "More" sheet all follow my order.
- **New categories** (mine or my partner's) appear at the end of my order until I move them.
- **Until I reorder**, I see today's ledger order, so nothing moves for anyone when this ships.

## Acceptance criteria

- [ ] API: an endpoint saves my order for a ledger, given category ids in order. Integration tests: happy path,
      401 signed out, 404 not a member, an unknown or deleted category id rejected, repeated ids rejected, and saving
      never changes another member's order.
- [ ] API: `GET /api/ledgers/:id/categories` returns categories in the caller's order; categories missing from it come
      after the ordered ones in today's `sort_order, category_id` order. Integration test with two members of one
      ledger who see different orders.
- [ ] App, web at phone width: on Budget, long-press a row, drag it to another place, drop → the new order shows on
      Budget, Expenses, Home and the expense form's "More" sheet, and survives a reload. Same from the Expenses tab.
- [ ] App: a short tap on a row still opens it; a scroll gesture still scrolls; a failed save puts the rows back in
      their previous order and says the order wasn't saved.
- [ ] iPhone (Expo Go): long-press and drag works on both tabs; scrolling and tapping still work.
- [ ] Demo build: the demo store follows the same rules (its order changes and survives within the demo session).
- [ ] No new dependency: the drag is built on React Native's `PanResponder` and `Animated`.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- A separate order per month or per tab.
- Changing the ledger-wide `sort_order` or anyone else's order; a "reset to ledger order" button.
- The expense form's quick row: it stays by most recently used (falling back to the ledger order).
- Ordering from the MCP connector, and any order change in Notion sync or imports.
- Keyboard and screen-reader reordering (worth its own brief if wanted).
- Haptics.

## Notes

- One list query feeds every surface: `GET /api/ledgers/:id/categories` in `apps/api/src/categories/routes.ts`
  (`ORDER BY c.sort_order, c.category_id`). Members are in `ledger_members (ledger_id, user_id)`.
- The Expenses tab uses `Animated.ScrollView` from React Native (no reanimated or gesture-handler in the app).
- Rows on both tabs are tappable (they open the category); the drag must not break that or the Budget tab's Undo toast.
- The demo store sorts by `sortOrder` in `apps/mobile/src/demo/categoryRoutes.ts`.
- Ended months are read-only for expenses, but ordering isn't month data, so it works in any month.

## Open questions

- None at the brief level; the planner proposes the storage shape and the endpoint's method and path.

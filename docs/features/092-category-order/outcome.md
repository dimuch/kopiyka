# Outcome: Order categories my way

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#132](https://github.com/dimuch/kopiyka/pull/132) Order categories my way: API, migration and demo — v1.13.0
- [#134](https://github.com/dimuch/kopiyka/pull/134) Order categories my way: drag on Budget and Expenses — v1.14.0

## Decided

- Two PRs (Gate A): the `category_orders` table, API and demo store first, then the long-press drag on both tabs.
- Each member keeps one order for every month. Categories a month doesn't show stay put, and a moved row goes right
  after the one above it. Ended months take drags too.
- Found in review: `pickQuick` breaks ties by `sort_order`, then id, so partners see the same quick row.
- The drag's state lives in a small `Drag` class, the held row follows the long-press's `pageY`, and edge
  scrolling measures the scroll view's inner view at pick-up.
- No `userSelect: 'none'` on the list, as `ViewStyle` doesn't type it; brief 097 fixed web text selection.

## Left out

- A reset button, per-month or per-tab order, keyboard or screen-reader reordering, and haptics.
- Ordering from the connector, and the quick row following the order (brief 099 later did that).

## Follow-ups

- Statistics' category list could follow the member's order as a tie-break — in BACKLOG.md
- `categories/routes.ts` passed 200 lines — in BACKLOG.md

Full plan: `git show 5811ced1:docs/features/092-category-order/plan.md`

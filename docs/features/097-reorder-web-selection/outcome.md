# Outcome: No text selection when picking up a category row on web

Brief: ./brief.md · Finished 2026-11-22

## PRs

- [#139](https://github.com/dimuch/kopiyka/pull/139) No text selection when picking up a category row on web — v1.15.3

## Decided

- On web, the reorder list blocks text selection, the iOS Safari callout and desktop right-click at all times, from a
  small helper in `components/` next to its only caller.
- The `contextmenu` listener is one module-level function, so StrictMode's repeated add does nothing.
- The browser check ran on the demo build, which renders the same `ReorderList`, as MySQL wasn't reachable.

## Left out

- Blocking page scroll or bounce while a row is held (out of scope).
- Turning the block on and off with `disabled`, and any other change on Budget, Expenses or elsewhere.

## Follow-ups

None.

Full plan: `git show b546ccb7:docs/features/097-reorder-web-selection/plan.md`

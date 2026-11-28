# Outcome: App links, navigation and loading robustness

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#21](https://github.com/dimuch/kopiyka/pull/21) App links, navigation and loading robustness — before versioning

## Decided

- Update and Delete leave through `leave()`, so a direct web link goes Home. Delete hands over its Undo only when it
  can go back, so a stale offer can't show up on a later Category screen.
- `src/linkParams.ts` (`parseIdParam`, `parseMonthParam`, unit-tested) checks params in an outer component. Only a
  valid link mounts the child that loads data, so the hooks stayed unchanged.
- Home shows "—" until its rows load, and `CompactTotal` isn't rendered until then, as on the Category screen.
- `PhoneColumn` takes `onPressOutside`, a mouse-only full-window target on web, so a click outside the column closes
  the sheet. Only deviation: a ternary instead of `&&`.

## Left out

- A "skip" mode in `useMonth` or `useExpenseDraft`, and any change to `undo.ts`.
- An Undo on Home after a delete from a link, native deep links, and hidden-category totals.

## Follow-ups

None.

Full plan: `git show 41edcb7a:docs/features/009-app-link-and-loading-robustness/plan.md`

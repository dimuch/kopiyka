# Outcome: Web app at phone width

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#16](https://github.com/dimuch/kopiyka/pull/16) Web app at phone width — before versioning

## Decided

- One `PhoneColumn` wraps the root Stack on web: every screen, the expense modal included, renders inside the stack
  container. The category sheet's `Modal` gets its own column, because it portals to `document.body`.
- On native `PhoneColumn` returns its children unchanged, so a large iPhone isn't narrowed.
- `SafeAreaProvider` takes `colors.bg`, so the space outside the column isn't white. Only the column dims under the
  sheet.
- A global CSS rule on `#root` was rejected: the modal portal sits outside it.

## Left out

- Breakpoints, a device frame, a custom `index.html` or global CSS.
- `window.confirm` and the browser's date picker stay where the browser puts them.

## Follow-ups

- On wide windows a click outside the column no longer closes the sheet — done in 009, #21
- Conventions §2 should list layout constants (`phoneWidth`) in `theme.ts` — done in #19 (docs only, no brief)

Full plan: `git show edeaffde:docs/features/008-web-phone-width/plan.md`

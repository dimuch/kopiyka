# Outcome: One load state for the data screens

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#204](https://github.com/dimuch/kopiyka/pull/204) One load state for the data screens — v1.26.18

## Decided

- Roadmap row R16. `components/LoadState.tsx` renders the first-load error or spinner, then the refresh line and the
  screen's content through a render prop. Budget, Expenses, Income, Statistics and Members use it.
- Both branches are fragments, so the host tree and remounts stay the same. `spinnerStyle` stays a prop, so Members'
  inline spinner style doesn't become a class.
- The category screen was left out: its refresh line sits inside its scroll view, and its not-in-month state has
  none. Budget's second refresh line, for income, was left out too: no spinner, and it comes after the figures.
- Each render callback keeps the screen's own name for its value, so the children moved without an edit.
- Web proof by recorded page trees for the loaded state, the spinner and the first-load error on all five, and
  Members' refresh error through a console `fetch` override: identical.

## Left out

- Spinner-colour or refresh-message props, and any change to `LoadError`, `CategoryInMonth`, texts or styles.
- The figure rows (R17).

## Follow-ups

- Budget's income triad and the category screen could share a second shape — dropped: only worth it if a third copy
  appears

Full plan: `git show 373fd207:docs/features/132-load-state/plan.md`

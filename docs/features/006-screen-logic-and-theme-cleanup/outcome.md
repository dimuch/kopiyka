# Outcome: Screen logic and theme cleanup

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#18](https://github.com/dimuch/kopiyka/pull/18) Screen logic and theme cleanup — before versioning

## Decided

- Refactor only, re-checked against the code after 003–008: month sums moved to `data/monthSummary.ts`, `withQuick`
  and the quick/more split to `data/quick.ts`, and all 14 raw colours to `theme.ts` tokens.
- The four string `&&` renders became explicit, `useCollapsingSummary` memoises its event and interpolations, and
  unused exports and `nativeID`s went (each input already has an `accessibilityLabel`).
- The brief's `Number.isInteger` id item was dropped: 004 had chosen to send a bad id to the API and show "That link
  isn't valid." The ACs were edited to match at Gate A.
- Home's total stays the sum of its rows, so its number didn't change. Retyping with `Currency` was cut at the
  skeptic's request.

## Left out

- Per-item amount formatting in the Category list (not a sum), boolean `&&` renders, and `app.json`'s colours.
- A test runner, `AuthContext` fixes and any redesign (out of scope).

## Follow-ups

- `/expense?categoryId=abc` preselects `NaN` — done in 009, #21
- `/category/abc` loads the whole month before "Category not found." — done in 009, #21
- Home's total ignores expenses in hidden categories — dropped: hidden categories were removed in 012 (#24)

Full plan: `git show 802aa711:docs/features/006-screen-logic-and-theme-cleanup/plan.md`

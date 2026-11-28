# Outcome: One load-on-focus hook for the app's data hooks

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#195](https://github.com/dimuch/kopiyka/pull/195) One load-on-focus hook for the app's data hooks — v1.26.9

## Decided

- Roadmap row R7. A new `data/useFocusLoad.ts` holds what five hooks copied: the attempt tag, the tagged loaded and
  failed state, the `useFocusEffect` with its `live` guard, and `reload`. `useMonth`, `useIncome`, `useMonthBalance`,
  `useMembers` and `useSummary` each kept their key, request and return shape.
- Each caller passes a `load` wrapped in `useCallback` on its key's inputs, instead of a deps array or a ref, so both
  the hooks lint and the React Compiler lint still check the real deps.
- `useMonth`, the hardest, moved first with the new hook; `useSummary` and `useMembers` shared one commit.
- The web check ran once on the finished branch instead of around each slice. The light-mode pass and the fast
  month-switch check were skipped: no style changed, and the stale-answer guard moved verbatim.

## Left out

- Hook tests or a render-test framework.
- Moving the effect-based hooks (`useCategoryTotals`, `useRate`, `useExpenseNames` and others) or `invites.tsx`.
- Options on `useFocusLoad` (no-focus mode, initial value, an error object).

## Follow-ups

None.

Full plan: `git show 6fd192cc:docs/features/123-app-focus-load-hook/plan.md`

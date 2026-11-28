# Outcome: One three-figure row for Budget and Expenses

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#205](https://github.com/dimuch/kopiyka/pull/205) One three-figure row for Budget and Expenses — v1.26.19

## Decided

- Roadmap row R17. `components/FigureRow.tsx` draws the three label-over-amount columns of Budget's `IncomeFigures`
  and the Expenses summary card, as a fragment that adds no host node. Each screen kept its container, row style,
  accessibility label, labels and values.
- FigureRow takes `value: string | undefined`, drawing a missing one as a muted "—", which absorbs the one
  difference (Expenses before its month loads) without a `pending` flag.
- Its styles are a plain `StyleSheet.create`, not a `makeStyles`, since they hold no colour.
- The danger colour was checked on Expenses, since Budget can't show a negative Remaining with test data. Page trees
  matched base after each slice in light and dark; the no-categories state wasn't reached.

## Left out

- A container in FigureRow, `pending` or colour props, other figure counts, and Statistics' totals card.
- Any change to the labels, values, accessibility labels or `spendingFigures`.

## Follow-ups

None.

Full plan: `git show 03c28fa1:docs/features/133-figure-row/plan.md`

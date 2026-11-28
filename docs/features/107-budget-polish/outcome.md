# Outcome: Expenses and Income polish: add per row, three figures, red "over", light yellow

Brief: ./brief.md · Finished 2026-11-24

## PRs

- [#146](https://github.com/dimuch/kopiyka/pull/146) Expenses and Income polish: add per row, three figures, red over, light yellow — v1.18.0

## Decided

- The row "+" keeps `AddExpenseButton`'s own "Add expense" label, and the file was left unchanged (user, 2026-11-24).
- The "+" sits beside the row, not inside it, so VoiceOver reaches it and a press can't open the category or drag.
- The Expenses card's three figures come from a pure `spendingFigures` in `data/monthSummary.ts`, with unit tests.
- The figures spread across the card's width instead of three equal columns, as the user asked after seeing it.
- One 105 item came forward: the same caution yellow in both themes.

## Left out

- The `cautionText` token and the near-plan label (brief 105).
- A shared figures component for Budget and Expenses: two callers, and 104 brought `Card`.
- Changes to the category screen's "+" or label.

## Follow-ups

- "Remaining" means income − budgeted on Budget and budgeted − spent on Expenses — dropped: 105c (#175) looked again
  and kept both.

Full plan: `git show 69e72913:docs/features/107-budget-polish/plan.md`

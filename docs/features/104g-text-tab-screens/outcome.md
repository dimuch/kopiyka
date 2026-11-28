# Outcome: Shared components, part 7: Text on the tab screens

Brief: ./brief.md · Finished 2026-11-26

## PRs

- [#170](https://github.com/dimuch/kopiyka/pull/170) Shared components, part 7: Text on the tab screens — v1.23.10

## Decided

- At Gate A: one PR in three slices (about 252 lines) for the 50 sites in 7 files.
- Statistics' period items switch `variant={checked ? 'bodyStrong' : 'bodyMedium'}`, matching today's faces.
- `Text.tsx` gained one pair, `captionMedium`, for Expenses' "€9 over".
- The nested " of €…" takes `variant="body"`, still inheriting the tabular digits.
- `budget-ended` was taken as it stands, with the ended rows checked from the code, and a `statistics-period` view was
  added. All 14 views matched in both themes.

## Left out

- 104h's screens, 105's look and dropping `tabular` from text with no digits.
- A lint guard against role spreads: proposed after 104h.

## Follow-ups

None.

Full plan: `git show 6b09a95c:docs/features/104g-text-tab-screens/plan.md`

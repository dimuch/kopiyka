# Plan: Expenses summary in the same figure order as Budget

Status: approved
Brief: ./brief.md
Branch: fix/summary-figures-order
Base: origin/main

## Approach

Swap the second and third entries of the figures array in `expenses.tsx` (Budgeted centred, Remaining with `over`
on the right; the index-based alignment styles stay), and reorder `spendingFigures`' label to
`Spent …, budgeted …, remaining …`. The no-categories branch and its label are unchanged. Update the test's expected
labels first (they fail before the fix), plus the two order comments and the test title. Old briefs/plans (107) are
history and stay as written.
Alternative considered: one shared summary-card component for both tabs; out of scope per the brief, left for the
consolidation pass.

## Contracts

- DB: none
- API: none
- App: `spendingFigures` keeps its signature and fields; only `label`'s wording order changes
- Reuses: existing `figures`/`figureCentre`/`figureEnd` styles and the `over` → `danger` colour
- New dependencies: none

## Version

Bump: patch — 1.23.16 → 1.23.17
Why: §8b `patch` (styling/copy, no new capability): the card's order and screen reader label change in the app.

## Slices

- [ ] 0. Bump version to 1.23.17
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.17
- [ ] 1. Show Spent, Budgeted and Remaining on the Expenses card, as on Budget (~15 lines)
  - Files: apps/mobile/src/data/monthSummary.ts, apps/mobile/src/app/(tabs)/expenses.tsx,
    apps/mobile/test/monthSummary.test.ts
  - Change: label order, JSDoc and the return type's field order (`spent, budgeted, remaining, over, label`) in
    `spendingFigures`; swap the array's last two entries and the `figures` style
    comment ("Budgeted centred, Remaining at the right edge") in `expenses.tsx`; test labels and title
  - Tests: `monthSummary.test.ts` → the four budget cases expect `Spent …, budgeted …, remaining …`; "no budget"
    unchanged; `expected` objects in the same field order | Verify: web at phone width + iPhone (Expo Go), light and dark: under plan, over plan, no categories

## AC → evidence

| AC                                                 | Evidence                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Spent, Budgeted, Remaining with left/centre/right  | Manual: Expenses vs Budget tab, web phone width + iPhone, light and dark |
| Over plan: only Remaining (right) in danger colour | Manual: a month over plan; `spendingFigures` "over plan" case (`over`)   |
| No categories: Spent, "Not set", "—"               | Manual: month without categories; "no budget" test case                  |
| Label order spent, budgeted, remaining             | `monthSummary.test.ts` `spendingFigures` cases (fail before slice 1)     |
| Comments match the new order                       | Review of slice 1 diff (`monthSummary.ts` JSDoc, `expenses.tsx` style)   |
| Checked on iPhone and web, light and dark          | PR test plan checkboxes                                                  |

## Not doing (YAGNI)

- Shared summary-card component; renaming figures; Budget tab changes; editing brief 107's historical docs.

## Risks

- None that change the plan; the alignment styles are index-based, so swapping entries moves Remaining right.

## Open questions

- none

## Follow-ups

- After merge: move 112 out of "Planned: small fixes" in `docs/features/BACKLOG.md` (flow step, not a slice).

## Deviations

## Consolidate

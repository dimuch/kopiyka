# Plan: Budget progress on the Expenses tab and Home

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/budget-progress
Base: origin/main @ 0c5c717 (033 part 1, 035, 036 and 037 API merged)

## Approach

App only. The API already returns everything needed. `GET …/categories?month=` gives each category's `plannedEur`
('0.00' when none is set; brief 036). `GET …/expenses?month=` gives the expenses, and `spentByCategory` already turns
them into spent cents per category. Both the Expenses tab and Home load these through `useMonth`, which reloads on
focus.

The progress maths goes in a new pure module, `data/budgetProgress.ts`, using integer cents. The 90% check is
`spent × 10 ≥ planned × 9`, so no floats are involved. `plannedCents(categories)` joins `sumCents` in
`data/monthSummary.ts`. That gives it three callers (Budget tab, Expenses tab, Home), which is the extraction 036
deferred to this brief.

The warning background is a new palette token, `warnBg`, in `theme.ts`. A unit test checks its contrast against the
row text in both themes. The Expenses rows replace the bar relative to the biggest spender with a bar relative to the
plan. The summary card's "Budget —" placeholder shows the planned total. Home's Budget card shows the same total, or
"Not set".

Alternative considered: a new API field (`spentEur` per category on the list) so the app doesn't have to sum. It lost
because the app already loads the month's expenses and sums them in cents (`spentByCategory`). A server sum would
duplicate that and add a route change, with its integration tests, that no AC needs.

## Contracts

- DB: none.
- API: none. The fields used are `Category.plannedEur` on `GET /api/ledgers/:id/categories?month=` (036) and
  `Expense.amountEur` on `GET /api/ledgers/:id/expenses?month=`.
- App, new `apps/mobile/src/data/budgetProgress.ts`:

  ```ts
  export interface BudgetProgress {
    /** Share of the bar to fill, 0–1: spent ÷ planned, full once spent reaches planned (any spending against €0). */
    fill: number;
    /** Spent has reached 90% of planned, or anything is spent against €0. */
    warning: boolean;
    /** EUR cents spent beyond planned; 0 within it. */
    overCents: number;
  }
  /** How much of a category's month plan is used, from integer EUR cents (brief 034). */
  export function budgetProgress(spentCents: number, plannedCents: number): BudgetProgress;
  ```

  The rules:
  - `warning = spentCents > 0 && spentCents * 10 >= plannedCents * 9`. Integer maths. With €0 planned it's true for
    any spending and false for none.
  - `fill = plannedCents === 0 ? (spentCents > 0 ? 1 : 0) : Math.min(1, spentCents / plannedCents)`. `fill` is a
    display ratio, not money.
  - `overCents = Math.max(0, spentCents - plannedCents)`.

  `DECIMAL(12,2)` allows at most 999,999,999,999 cents per amount; × 10, or summed over a month, that stays far below
  `Number.MAX_SAFE_INTEGER` (about 9 × 10^15).

- App, `apps/mobile/src/data/monthSummary.ts` gains:
  ```ts
  /** The month's planned EUR over `categories`, in integer cents. */
  export function plannedCents(categories: Category[]): number;
  ```
  Callers: `budget.tsx` (replaces its inline `reduce`), `expenses.tsx`, `index.tsx`.
- App, `apps/mobile/src/theme.ts`: `darkColors.warnBg = '#2A2117'` and `lightColors.warnBg = '#FFF4E6'`, with the
  JSDoc "Row background at ≥ 90% of plan; row text keeps ≥ 4.5:1 on it." I measured the WCAG contrast with a
  scratch script:
  - dark: `text` 13.6, `muted` 6.5, `accent` 7.2;
  - light: `text` 16.5, `muted` 5.5, `accent` 5.4.

  Light `over` (#B25E09) would only reach 4.3 on this background, so "€12.40 over" uses `text`, not `over`.

- App, row copy on the Expenses tab:
  - right of the name: `${eur(spent)} of ${eur(planned)}` ("€86.20 of €120"); the " of €120" part is muted;
  - under the bar, only when `overCents > 0`: `${eur(overCents)} over` ("€12.40 over");
  - accessibility label: `${name}, ${eur(spent)} of ${eur(planned)} spent`, plus `, ${eur(over)} over` when over.
- App, the Expenses summary card's right slot ("Budget"):
  - `—` while loading;
  - "Not set" for a month with no categories;
  - otherwise `eur(plannedCents(data.categories))`.

  The stale caption "Budgets arrive with the next update; amounts show what you spent." is removed (in slice 2).
  The totals row (the `styles.totalRow` View) becomes `accessible` with `accessibilityLabel`: while loading
  `'Spent this month, loading'`; for a month with no categories `` `Spent this month, ${eur(total)}, budget not set` ``;
  otherwise `` `Spent this month, ${eur(total)} of ${eur(plannedCents(data.categories))}` ``. The total Text's own
  `'Loading'` label goes, because the group label covers it (same pattern as `CompactTotal`'s `accessible` View).

- App, the Home Budget card figure:
  - `null` (shows '—') while loading;
  - "Not set" when `data.categories.length === 0`;
  - otherwise `eur(plannedCents(data.categories))`.
- New dependencies: none.

## Slices

- [x] 1. Work out how much of each category's plan is used
  - Files: `apps/mobile/src/data/budgetProgress.ts` (new), `apps/mobile/src/data/monthSummary.ts` (`plannedCents`),
    `apps/mobile/src/app/(tabs)/budget.tsx` (use `plannedCents`), `apps/mobile/test/budgetProgress.test.ts` (new),
    `apps/mobile/test/monthSummary.test.ts`.
  - Change: as in Contracts. About 80 lines, most of them tests.
  - Tests, `budgetProgress.test.ts`, as an `it.each` table of `[spent, planned, fill, warning, over]` with a comment
    giving each row's arithmetic:
    - `[0, 12000, 0, false, 0]` (nothing spent);
    - `[5000, 12000, 5000/12000, false, 0]` (the AC's €50 of €120, about 0.4167);
    - `[6000, 12000, 0.5, false, 0]`;
    - `[10799, 12000, …, false, 0]` (just under 90%);
    - `[10800, 12000, 0.9, true, 0]` (the AC's 90%);
    - `[12000, 12000, 1, true, 0]` (exactly at plan: full, not over);
    - `[13240, 12000, 1, true, 1240]` (the AC's €132.40: capped, €12.40 over);
    - `[900, 1001, …, false, 0]` and `[901, 1001, …, true, 0]` (90% of €10.01 is 900.9 cents; integer comparison,
      no rounding);
    - `[0, 0, 0, false, 0]` (planned €0, nothing spent);
    - `[1, 0, 1, true, 1]` (planned €0, any spending is over).

    Fractions are checked with `toBeCloseTo(x, 10)`, and everything else with `toBe`.

  - Tests, `monthSummary.test.ts`, a new case "sums the planned amounts in cents": `[]` gives 0;
    `['120.50', '0.00', '0.10', '0.20']` gives 12080 (exact, with the 0.1 + 0.2 comment).
  - Verify: the Budget tab head still reads "€… planned", the same as before (a mechanical replacement).

- [x] 2. Show each category's progress against its plan on the Expenses tab
  - Files: `apps/mobile/src/theme.ts` (`warnBg`), `apps/mobile/test/theme.test.ts` (new),
    `apps/mobile/src/app/(tabs)/expenses.tsx`.
  - Change:
    - `rows` gain `planned: toCents(c.plannedEur)` and `progress: budgetProgress(spent, planned)`. `maxSpent` goes.
    - The bar width is `` `${progress.fill * 100}%` ``. The row style adds `{ backgroundColor: colors.warnBg }` when
      `progress.warning`.
    - The right-hand text and the over line follow Contracts, using a new `overText` style (bodyMedium 12,
      `colors.text`).
    - The section head's "spent" label becomes "spent of planned".
    - `listCard` gains `overflow: 'hidden'`, so a warning first or last row stays inside the rounded corners.
    - `rowName` gains `flexShrink: 1` and `numberOfLines={1}`, so a long name doesn't wrap next to "€86.20 of €120".
    - The summary card's stale caption "Budgets arrive with the next update; …" is removed (one line), since rows
      now show budgets.

    About 75 lines.

  - Tests, `theme.test.ts`: a local WCAG contrast helper (relative luminance, about 8 lines, in the test file only).
    It asserts that `text`, `muted` and `accent` each reach ≥ 4.5 on `warnBg`, in both `darkColors` and
    `lightColors`. The test file is the only place the helper lives.
  - Verify: AC rows 2 and 3 (QA setup below), on web at 390×844, light and dark. Rename one QA category (037) to a
    40-character name: it stays on one line, truncated, and the amount stays visible.

- [x] 3. Show the month's planned total on the Expenses tab
  - Files: `apps/mobile/src/app/(tabs)/expenses.tsx`.
  - Change: the summary card's "Budget" slot and its accessibility label follow Contracts. About 20 lines.
  - Verify: AC row 4, Expenses part.

- [x] 4. Show the month's planned total on Home's Budget card
  - Files: `apps/mobile/src/app/(tabs)/index.tsx`.
  - Change: the Budget card figure follows Contracts, in place of the constant 'Not set'. About 8 lines.
  - Verify: AC row 4, Home part.

Estimated total: about 185 changed lines, of which about 75 are tests.

## AC → evidence

QA setup (local dev DB, QA ledgers only; the running API must be this checkout's, checked with
`lsof -iTCP:3000 -sTCP:LISTEN` and the process's cwd):

1. `yarn api create-user --username claude-qa-034 --email claude-qa-034@example.test`. Its October has the 15
   defaults at €0.
2. In the app's Budget tab (036's editor), set rent, groceries and fun to €120, and leave gym and car at €0.
3. Add expenses dated in October: rent €50, groceries €108, fun €132.40, car €5.
4. For "Not set" on Home: `yarn api create-user --username claude-qa-034-empty …`, then for that ledger only
   `UPDATE category_months m JOIN categories c ON c.category_id = m.category_id SET m.deleted_at = NOW() WHERE c.ledger_id = <id> AND m.list_month = '2026-10-01'`.

Delete both QA users and ledgers after the PR.

| AC                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Unit tests: fill, cap at 100%, 90% threshold, over amount, planned €0  | `apps/mobile/test/budgetProgress.test.ts` (slice 1 table); `monthSummary.test.ts` "sums the planned amounts in cents".                                                                                                                                                                                                                         |
| 2. €50/€120 half-empty, no warning; €108/€120 warning; €132.40 full, over | Web 390×844, Expenses → October:<br>rent "€50 of €120", bar about 42% full, plain background.<br>Groceries "€108 of €120", warning background.<br>Fun "€132.40 of €120", bar full, warning background, "€12.40 over".<br>Screen reader label on fun: "fun, €132.40 of €120 spent, €12.40 over".                                                |
| 3. Planned €0: empty bar and no warning; with spending, over              | Same screen: gym "€0 of €0", empty bar, plain background. Car "€5 of €0", full bar, warning background, "€5 over".                                                                                                                                                                                                                             |
| 4. Expenses tab spent of planned; Home Budget planned total or "Not set"  | Expenses card: "Spent this month €295.40", "Budget €360". November (no budget): "Budget Not set".<br>Home as claude-qa-034: Budget "€360", Expenses "€295.40".<br>Home as claude-qa-034-empty: Budget "Not set".                                                                                                                               |
| 5. Figures update after add, edit, delete and a planned-amount change     | Web, starting from the Expenses tab:<br>add €10 to rent → "€60 of €120", total +€10;<br>edit it to €58 → "€108 of €120" with the warning background;<br>delete it → back to "€50"; Undo on the Category screen and back → "€108" again;<br>Budget → rent €200 → Expenses shows "of €200", plain background; Home's Budget card goes up by €80. |
| 6. Light and dark readable; iPhone (Expo Go)                              | `theme.test.ts` contrast assertions; web checks in rows 2–4 in both themes (Settings → Appearance).<br>The user, on iPhone: the same three rows, the over line, and the card and Home totals; in light mode, note whether the empty part of the bar track (1.15:1 on `warnBg`) is still visible on a warning row.                              |
| 7. Gates green                                                            | `yarn format:check && yarn lint && yarn typecheck && yarn test` on every slice.                                                                                                                                                                                                                                                                |

## Not doing (YAGNI)

- Any API change, including a server-side spent total per category.
- Bringing `CompactTotal` back to the Expenses header. 027 removed it at the user's request, and the brief's "budget
  line" is met by the summary card's existing Budget slot (Open questions).
- Colouring the card total or the bar fill differently when over, a "left to spend" figure, and progress on the
  Category screen (`CompactTotal budgetCents={null}` stays) or Statistics. These are out of scope or not asked for.
- Notifications at 90% or 100%.

## Risks

- **`overflow: 'hidden'` on the list card** might clip something on iOS, such as a tile's shadow or a press
  highlight. Slice 2's web check and the iPhone check confirm it. If it does, the fallback is
  `borderRadius` on the first and last rows instead.
- **Fractional percentage widths** (`'41.666…%'`) on RN and web. Core `DimensionValue` accepts any `${number}%`, and
  the existing bar already passes computed percentages. Slice 2's web check confirms; the iPhone check covers native.
- **The light warning tint reads too faint on the iPhone screen.** 036 noted that the light palette is "tuned on the
  iPhone". If the user wants it stronger, `#FDEBD3` still passes `text` 15.4 and `muted` 5.1 (measured). That would be
  a one-line change, with the contrast test as the guard.
- **Refresh after a planned-amount change** relies on the Expenses tab's `useFocusEffect` reload when it is switched
  to. That is the same mechanism 036's Budget tab relies on. AC row 5 proves it on web, and the iPhone check covers
  native.

## Open questions

- No (please confirm at approval): what "using `CollapsingSummary`'s existing budget line" means. `CompactTotal`'s
  `budgetCents` (" / €4,600") is in `CollapsingSummary.tsx`, but the Expenses tab no longer renders it, because brief
  027 removed the compact header total. Assumed: the Expenses tab's collapsing summary card already has a "Budget —"
  slot, and that slot shows the planned total. The card reads "Spent this month €2,078.85 · Budget €4,600", with an
  accessibility label of "…€2,078.85 of €4,600". The alternative is to render "of €4,600" inline after the big total
  and drop the slot, which is about the same size.
- No: the copy, which the brief calls a proposal. Assumed:
  - "€86.20 of €120" right of the name;
  - "€12.40 over" on its own line under the bar;
  - "Not set" in the Expenses card for a month with no budget, matching Home;
  - the section head says "spent of planned".
- No: 90% is checked as "spent ≥ 90% of planned", exactly, with no rounding (€108.00 of €120 warns, €107.99 doesn't).
  Spent exactly equal to planned warns but isn't over.

## Follow-ups

- `CompactTotal`'s JSDoc says "the budget part appears once budgets exist", but its only caller (the Category screen)
  passes `null`. That is for a future brief that adds progress to the Category screen (out of scope here).

## Deviations

- slice 2: `rowAmount` also gets `flexShrink: 0`. With only `rowName` shrinking, "of €1,500" still wrapped under
  a 40-character name at 390 px on web; now the name truncates and the amount stays on one line.

## Consolidate

CONSOLIDATE: reused 0 · extracted 0 · left 3

- LEAVE `budgetProgress` vs `CompactTotal`'s `over` (`components/CollapsingSummary.tsx`): `CompactTotal` colours the
  Category screen's total when spent is strictly above the budget, with no 90% step and no €0 rule. Merging would
  change the Category screen, which the brief keeps out of scope.
- LEAVE `plannedCents` vs `sumCents`: same shape (a cents sum), but over a different type and field
  (`Category.plannedEur` vs `Expense.amountEur|amountUah`); `plannedCents` is already the one shared copy for its
  three callers (Budget, Expenses, Home).
- LEAVE the budget figure in `index.tsx` and `expenses.tsx` (no categories → "Not set", otherwise
  `eur(plannedCents(…))`): two screens only, and the Expenses tab also needs the "budget not set" screen-reader phrase,
  so a shared `budgetFigure()` would replace half of it. Extract into `data/monthSummary.ts` if a third caller appears
  (review nit 1).
- Not a consolidate change: single-letter names in this branch's new lines (`find-short-names.sh --diff origin/main`)
  renamed in a separate commit.

## Revision 1 (skeptic: approve with edits)

- #9: the Expenses totals row gets one `accessible` group label for loading, no budget and spent of planned; the
  total Text's own 'Loading' label goes.
- Suggestions taken: the cents bound corrected to `DECIMAL(12,2)`; `rowName` truncates to one line, with a
  long-name web check; the faint light-mode track noted in the iPhone check; the stale caption's removal moved to
  slice 2.

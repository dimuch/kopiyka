# Plan: Expenses and Income polish: add per row, three figures, red "over", light yellow

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/budget-polish
Base: origin/main (b70a5d4, version 1.17.2)

## Approach

App-only. Five small commits after the bump, each about one of the brief's items. They touch `theme.ts`, `income.tsx`,
`expenses.tsx` and `data/monthSummary.ts`. `AddExpenseButton` is used as it is, with its own "Add expense" label.
The row "+" uses Budget's existing row shape, a wrapper `View` holding two sibling buttons: the row `Pressable`, which
still carries the drag handlers, and the "+". The "+" is not nested inside the row, so a press on it can't open the
category or start a drag. Budget's comment explains why it isn't nested: VoiceOver can't reach a nested button, and
web would nest `role="button"`. The Expenses card's three figures come from one pure function, `spendingFigures`,
in `data/monthSummary.ts`. Expenses already imports that module, so the demo's module list doesn't change. The
function's cases (negative, no budget, €0 plans) get unit tests, and the screen only lays them out the way Budget's
`IncomeFigures` does.
Alternative considered: one shared `Figures` component for Budget's strip and the Expenses card. That would be two
callers, under the rule of three, and brief 104 brings `Card` anyway. The figures stay local to each screen.

## Contracts

- DB: none
- API: none
- App:
  - `data/monthSummary.ts`, new:
    ```ts
    /** The Expenses card's Spent, Remaining (Budgeted − Spent) and Budgeted (brief 107); no categories = no budget. */
    export function spendingFigures(
      spentCents: number,
      categories: Category[],
    ): { spent: string; remaining: string; budgeted: string; over: boolean; label: string };
    ```
    - With categories: `spent = eur(spent)`, `budgeted = eur(plannedCents(categories))` (€0 plans count, as today),
      `remaining = eur(budgeted − spent)`, `over = remaining < 0`,
      `label = "Spent €X, remaining €Y, budgeted €Z"`.
    - No categories: `budgeted = 'Not set'`, `remaining = '—'`, `over = false`, `label = "Spent €X, budget not set"`.
    - Before the month loads the screen shows "—" ×3 and keeps today's label,
      `"Spent this month, loading"` or `"Spent this month, not available"`.
  - `AddExpenseButton`: unchanged (`{ categoryId?: number }`, label "Add expense"). The Expenses row calls it with
    `categoryId={row.categoryId}` (Open question 1, resolved).
  - `theme.ts`: `lightColors.caution` `#9A7400` → `#F2C94C`. No new keys.
- Reuses: `AddExpenseButton` (row "+"), `ReorderList` + its `DragHandlers` as they are, Budget's `openRow` sibling
  layout and `IncomeFigures` look (`small` label, `text.amount` value, `flex: 1` columns), `plannedCents`, `eur`,
  `progressColor`, `useCollapsingSummary` (unchanged; the card's height is measured by `onCardLayout`).
- New dependencies: none

## Version

Bump: minor — 1.17.3 → 1.18.0 (rebased after #147 took 1.17.3)
Why: §8b `minor`, "a new user action". Each category row on Expenses gets its own "+" that adds an expense to that
category, and the card shows a new Remaining figure. Brief 094 counted its month arrows the same way. Nothing a client
relies on changes: there's no API, connector or DB change, and rollback is untouched. The header "+" goes, but every
add it allowed is still possible: the row "+" opens the same form, where the category can be changed. So it isn't
`major`. If 103b or PR #144 takes a number first, rebase and bump once more (§8b step 4).

## Slices

- [x] 0. Bump version to 1.18.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.18.0
- [x] 1. Use the dark theme's yellow for near-plan bars in light too
  - Files: apps/mobile/src/theme.ts, apps/mobile/test/theme.test.ts, docs/design/design-system.md
  - Change: light `caution` → `#F2C94C`. The comment above it says it's the dark yellow, 1.3:1 on the light track
    (under brief 091's 3:1, an accepted exception), with the row's amounts next to the bar. The dark key's JSDoc
    stops claiming "≥ 3:1" for both themes. Spec: the "Caution is the same yellow in both themes" paragraph
    (lines 62–65) says brief 107 makes the change and records the exception to 091, and that brief 105 still adds
    the `cautionText` label. It also says that until 105 adds "€15 left", the row's "€X of €Y" amounts are the text
    signal next to the bar. Principle 5 (lines 33–35, "always comes with a text label") then points to that
    paragraph. Line 60 (violet bars, still 105) stays.
  - Tests: `theme.test.ts`. The new case "uses the same yellow for near-plan bars in both themes" fails before the
    change. "keeps every bar colour visible on the track" skips only light `near`, with the reason in a comment.
    Every other pair still has to reach 3:1.
  - ~25 lines
- [x] 2. Show the Income total in the heading's size and colour
  - Files: apps/mobile/src/app/(tabs)/income.tsx
  - Change: the section head's amount drops " total". It gets its own style,
    `{ ...text.heading, fontFamily: fonts.display, color: colors.text, fontVariant: ['tabular-nums'] }`. It sits in a
    `<View accessible accessibilityLabel={`Total ${amount}`}>` wrapper, the way Budget's figures do
    (budget.tsx:279–283), and the Text itself has no label. `small` stays for the "Added by" lines.
  - Verify: web at phone width, light and dark: the "Income" heading and "€1,750" have the same size, face and
    colour, with no "total". The a11y tree / DOM shows `aria-label="Total €1,750"`. On iPhone, VoiceOver reads
    "Total €1,750".
  - ~8 lines
- [x] 3. Show a category's "over" line in red on Expenses
  - Files: apps/mobile/src/app/(tabs)/expenses.tsx
  - Change: `overText` colour `colors.text` → `colors.danger`. The comment says why: the words, not only the bar,
    say it's over. Contrast is 5.3:1 (light) and 7.6:1 (dark) on `surface`.
  - Verify: web at phone width, light and dark, with a category over plan: "€X over" is `danger` (computed colour
    `rgb(194, 59, 49)` light, `rgb(255, 138, 128)` dark).
  - ~3 lines
- [x] 4. Show Spent, Remaining and Budgeted on the Expenses card
  - Files: apps/mobile/src/data/monthSummary.ts, apps/mobile/test/monthSummary.test.ts,
    apps/mobile/src/app/(tabs)/expenses.tsx
  - Change: add `spendingFigures` (Contracts). The card's `totalRow`/`totalCol`/`budgetCol` become one accessible
    row with three `flex: 1` columns, in the order Spent, Remaining, Budgeted. Each column is a `small` caption over
    a `text.amount` value. Remaining takes `colors.danger` when `over`, and the loading "—" stay muted as today.
    `figures = data && total !== null ? spendingFigures(total, data.categories) : null`. The old `noBudget` and
    `plannedText` go, and so do the styles `totalRow`, `totalCol`, `budgetCol`, `caption`, `total` and `budget`.
    New styles: `figures` `{ flexDirection: 'row', gap: space.sm }`, `figure` `{ flex: 1, gap: space.xs }` and
    `figureValue` `{ ...text.amount, color: colors.text }`. Tokens only.
  - Tests: `monthSummary.test.ts` → `spendingFigures`, in table style:
    - 250.50 spent of 1,000 planned (two categories) → `€250.50` / `€749.50` / `€1,000`, not over, label
      `Spent €250.50, remaining €749.50, budgeted €1,000`
    - 1,009 of 1,000 → remaining `−€9`, over
    - spent = planned → `€0`, not over
    - categories all at €0 with €12 spent → budgeted `€0`, remaining `−€12`, over
    - no categories → `€0` / `—` / `Not set`, label `Spent €0, budget not set`
  - Verify: web at phone width, light and dark: a current month with a budget, one where Spent > Budgeted
    (Remaining is red and negative), a month with no categories, and a slow load (devtools throttling) showing
    "—" ×3. A refresh error after the month has loaded (go offline, switch tabs away and back) shows the "Couldn’t
    refresh" note, and the card keeps its three amounts, not "—". `spendingFigures` never sees the error, so this
    is a screen check, not a unit case. The card still fades under the header on scroll.
  - ~120 lines
- [x] 5. Add an expense from its category row on Expenses
  - Files: apps/mobile/src/app/(tabs)/expenses.tsx (`AddExpenseButton.tsx` is not touched)
  - Change:
    - Expenses: the header's right side becomes an empty `<View style={styles.side} />`, which keeps the switcher
      centred, and `sideEnd` goes. `const ended = month < thisMonth` (EmptyMonth's check reuses it).
    - `renderRow` returns `<View style={[styles.openRow, divider?, !ended && styles.withAdd]}>`. Inside it are the
      row `Pressable`, which keeps `{...drag}`, `onPress`, its label and `styles.row` plus `flex: 1`, and, when
      `!ended`, `<AddExpenseButton categoryId={row.categoryId} />`. `index < rows.length - 1 && styles.divider`
      moves from the row `Pressable` to this wrapper, as on budget.tsx:225, so the divider runs under the "+".
    - New styles: `openRow` `{ flexDirection: 'row', alignItems: 'center' }` and `withAdd`
      `{ paddingRight: space.sm }`, matching Budget's edit button.
  - Verify: web at phone width (390 and 402), light and dark, on the current month:
    - Every row has a "+" with a 44×44 box. It opens `/expense?categoryId=<id>` with that category picked.
    - A tap on the row body opens the category.
    - A long-press on the row body starts a drag. A long-press on "+" doesn't start one.
    - No "+" in the header. The month title's centre x equals the header's centre x (`getBoundingClientRect`).
    - Ended month: no "+", and a tap still opens the category.
    - Each row's "+" has `aria-label="Add expense"` (AddExpenseButton's own), and there's no nested `role="button"`.
    - At Gate B on iPhone: VoiceOver reaches the row and the "+" ("Add expense") separately, and the same tap,
      long-press and drag checks pass.
  - ~35 lines

Total: about 190 changed lines without the bump.

## AC → evidence

| AC                                                                       | Evidence                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current month: every row has "+", which opens add form with its category | Slice 5 verify: web phone width, each row has an "Add expense" button that opens `/expense?categoryId=…` with the category selected; iPhone at Gate B                                           |
| No header "+", title still centred                                       | Slice 5 verify: header DOM has no "Add expense" button; switcher's centre x = header's centre x                                                                                                 |
| Ended month: no "+", row tap opens category                              | Slice 5 verify on the previous month                                                                                                                                                            |
| Tap outside "+" opens category; long-press drags                         | Slice 5 verify, web and iPhone                                                                                                                                                                  |
| Light near-plan bar `#F2C94C`, dark unchanged                            | `theme.test.ts` "uses the same yellow for near-plan bars in both themes" (fails before slice 1); dark value untouched in diff; web check of a 90–100% row in light                              |
| Income total: no "total", heading size, bold face, main colour           | Slice 2 verify (computed font-family/size/colour equal to the "Income" heading's; text "€1,750"; `aria-label="Total €1,750"`)                                                                   |
| "€X over" in `danger`, light and dark                                    | Slice 3 verify (computed colour per theme)                                                                                                                                                      |
| Budget month: Spent, Remaining, Budgeted correct; negative in `danger`   | `monthSummary.test.ts` `spendingFigures` cases 1–4; slice 4 verify for the red colour and order                                                                                                 |
| No categories: "Not set" and "—"                                         | `monthSummary.test.ts` "no categories" case; slice 4 verify on an empty month                                                                                                                   |
| Demo shows the same changes                                              | Demo web build (`KOPIYKA_FLAVOUR=demo`, :8084): Expenses (row "+", three figures, red over, yellow bar in light) and Income total; `yarn mobile check-builds` passes with no module-list change |

## Not doing (YAGNI)

- The `cautionText` token and the near-plan "€15 left" label (brief 105).
- A shared `Figures`/`Card` component for Budget and Expenses (brief 104; only two callers).
- Changing the category screen's "+" or its label (out of scope; it keeps "Add expense").
- Limiting the row "+" in future months: same rule as the category screen (hidden only when ended); the form already
  says "That category isn't in <month>" if today's month lacks it.
- Any change to `ReorderList`, `CollapsingSummary`, `CategoryTile`, `MonthSwitcher`, `HomeButton`, `dangerText`, the
  category/expense/income-item screens, or `eslint.config.js`.

## Risks

- The row "+" (44pt + 8pt) narrows the row body by ~52pt; with a long name and a four-digit "€1,234.56 of €2,000"
  the name truncates hard at 390pt — slice 5 verify at 390 and 402 with the longest seeded name; if it reads badly,
  drop the row's right padding (`paddingRight: 0` on the row Pressable when the "+" shows, the "+" box gives ~12pt)
  and record it under Deviations.
- Merge with 103b: it edits `theme.ts` (maybe an `input` text role); this plan edits only the light `caution` line
  there and doesn't touch `AddExpenseButton` — whichever lands second rebases and re-runs the gates; the PR says that fresh "before" snapshots of Expenses and Income are needed (brief).
- Card height shrinks (amountLg → amount); `useCollapsingSummary` re-measures via `onCardLayout` — slice 4 verify
  scrolls the tab to confirm the fade still ends as the card leaves.

## Open questions

- **Resolved (user, 2026-11-24): option (c).** The row "+" was to be labelled "Add expense to <category>", but
  `AddExpenseButton` (a 103b file) hard-codes "Add expense". The user chose to keep its own "Add expense" label and
  leave `AddExpenseButton.tsx` untouched; the brief's item 1 now says so. Slice 5 uses
  `<AddExpenseButton categoryId={row.categoryId} />`.
- no — Screen-reader labels for states the brief doesn't spell out: no budget → "Spent €0, budget not set";
  loading/error → today's "Spent this month, loading / not available". Assumed as written.
- no — Placeholder colour on the card: loading "—" stay muted (as today); "Not set" and the no-budget "—" use the
  normal value colour. Assumed.
- no — The brief says two places in `docs/design/design-system.md` say brief 105 makes the caution change; only the
  paragraph at lines 62–65 does (line 60 is about the violet under-plan bars, still 105). Slice 1 edits that
  paragraph only.

## Follow-ups

- "Remaining" now means income − budgeted on Budget and budgeted − spent on Expenses (brief accepts it); worth a
  second look when brief 104/105 restyles both strips.

## Deviations

- slice 4: the three figures spread across the card's full width (Spent at the left edge, Remaining centred,
  Budgeted at the right edge, `justifyContent: 'space-between'`) instead of three equal `flex: 1` columns like
  Budget's strip. The user asked for this after seeing it (2026-11-24, side session). Remaining sits midway
  between the other two, so it is only exactly centred when Spent and Budgeted are the same width.

## Consolidate

Pass over `origin/main...HEAD`: reused 0 · extracted 0 · left 2.

- `spendingFigures` (`data/monthSummary.ts`): no twin. Budget's `IncomeFigures` works out income − budgeted inline,
  a different sum with no "no budget" case; it reuses `plannedCents` and `eur`. LEAVE.
- The Expenses card's three columns (`figures`/`figure`/`figureValue`) mirror Budget's `IncomeFigures` markup and
  styles. LEAVE: two callers, under the rule of three, and brief 104 brings the shared `Card`; a new component in
  `src/components` now would also land in 103b's area.

## Revision 1

User chose option (c) for the row "+" label: slice 5 uses `AddExpenseButton` unchanged (label "Add expense"),
`AddExpenseButton.tsx` drops out of the files, and slice 5 shrinks from ~40 to ~35 lines (total ~190). Approach,
Contracts, AC → evidence, the 103b merge risk and Open question 1 updated to match. Version unchanged.

## Revision 2

Skeptic suggestions: slice 1 also covers the spec's principle 5 and says the row amounts are the text signal until
105; slice 2 labels the Income total through an accessible View wrapper (Risk 2 dropped); slice 5 names the divider
move to the wrapper; slice 4 adds a refresh-error screen check (a unit case can't see the error). Status set to
skeptic-approved.

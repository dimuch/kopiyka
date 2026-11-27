# Plan: Descriptive names across the app

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/app-short-names
Base: origin/main (after R7 #195)

## Approach

Roadmap row R8, done in the order from `kopiyka-refactoring` §6. First a test-only commit pins `categoryTile`, the one
renamed function with no tests. Then the brief's extract: a pure `scrollToShow` in `data/nameSuggestions.ts` replaces
`NameCombobox.tsx`'s nested ternary. Then four rename-only commits, one per area (screens, components, data,
format/theme/auth), with the new names listed below line by line. Then the backlog row.

`find-short-names.sh apps/mobile/src` reports 58 lines today. 55 of them are code: 2 go with the extract and 53 with
the renames. The other 3 are in `components/categoryIcons.LICENSE.txt` (`Copyright (c)` twice, and `x` in Feather's
icon list). Licence text can't be renamed.

Alternative considered: one rename commit for the whole app. It lost because the brief asks for one commit per area,
and the screens need a web check per area.

## Contracts

- DB: none. API: none. Routes, props, hook signatures and exports: unchanged. Only local names change, plus one new
  export.
- App: `apps/mobile/src/data/nameSuggestions.ts` gains

  ```ts
  /**
   * The list offset (pt) that shows row `index` whole: its top when it's above the view, the offset that puts its
   * bottom at the view's bottom when it's below, or null when it's already fully in view (no scroll).
   */
  export function scrollToShow(index: number, scrollY: number, rowHeight: number, visibleRows: number): number | null;
  ```

  Body: `top = index * rowHeight`, `bottom = top + rowHeight`, `viewHeight = visibleRows * rowHeight`. Then
  `if (top < scrollY) return top;`, then `if (bottom > scrollY + viewHeight) return bottom - viewHeight;`, then
  `return null;`. The arithmetic and the strict `<`/`>` are the same as today. A scratch run gave the same result as the
  base's ternary for every index 0–24 and every offset 0–900 pt.
  Its one caller is `NameCombobox.highlight`. The component keeps the side effects: `setActive`, `listRef.current?.scrollTo`,
  `scrollY.current = targetY` and the "Set now: onScroll comes later" comment.
  Placement (conventions §2): it's pure logic, so it leaves the component (`components/` is presentational). It joins
  `matchingNames`, the same feature's other pure rule from brief 108. `format.ts` is for money and dates only.

- `apps/mobile/demo-modules.txt`: unchanged. No module is added; `nameSuggestions.ts` is already on the list.
- Reuses: `(current) => current + 1` from `data/useFocusLoad.ts:34` and `data/invites.tsx:59`; `candidate` from
  `demo/categoryRoutes.ts:278`; `setter` from `expense.tsx:173`; `chip` and `current` from the lines just above and
  below their renames.
- New dependencies: none.

## Version

Bump: patch — 1.26.9 → 1.26.10
Why: conventions §8b, "behaviour-preserving refactor" of shipped app code. The Base is R7's branch, which takes 1.26.9
(`git show chore/app-focus-load-hook:package.json`). If main moves past that before merge, rebase, take main's number
and bump once more (§8b step 4).

## Slices

Proof for every slice:

- All gates pass: `yarn format:check && yarn lint && yarn typecheck && yarn test`. Prettier may rewrap lines that grow
  past 120 characters, which is still mechanical, so run `yarn format` after each rename.
- Test counts: api 549 passed + 2 skipped and mcp 329 throughout. The app goes 511 → 517 (slice 1) → 531 (slice 2), then
  stays at 531.
- `git diff origin/main -- apps/*/test` adds lines, plus the two edited import lines.
- `yarn mobile export:web && yarn mobile check-builds` passes, and `git diff -- apps/mobile/demo-modules.txt` is empty.
- `find-short-names.sh --diff origin/main` reports no lines.

Web check: web from this worktree at exactly http://127.0.0.1:8084, API on 3000, signed in as a QA user, at 390×844 in
light and dark, once on the finished branch: the renamed screens (Budget, Expenses, a category, the expense form,
income item) and the name list's keyboard scrolling (slice 2). Renames have no visual effect, so one pass at the end
stands in for a pass per slice. Before slice 0, on Base, take screenshots at 390×844 in light and dark of Budget,
Expenses, a category screen, the expense form (with tiles and chips), income item and Settings; the final pass compares
against them. Slice 2's keyboard-scroll check runs before slice 2 is committed.

Proof that a characterization test bites (refactoring §2): break the line it pins by hand, watch the named case fail,
then restore the line.

- [x] 0. Bump version to 1.26.10
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.10
- [x] 1. Pin category tile colours with characterization tests
  - Files: apps/mobile/test/theme.test.ts
  - Change: add `categoryTile` to the import, and add `describe('categoryTile')` with one `it.each` of 6 rows. The
    values come from running Base's `theme.ts`:
    - `car`, light → `{ bg: 'hsla(0, 70%, 45%, 0.14)', fg: 'hsl(0, 70%, 32%)' }`. Hue 0 from `HUES` stays 0, so `??`
      isn't `||`.
    - `groceries`, dark → `{ bg: 'hsla(140, 70%, 60%, 0.16)', fg: 'hsl(140, 80%, 74%)' }`.
    - `pets`, light → hue 211. The fallback starts at 7: 7·31+112 = 329; 329·31+101 = 10300 % 360 = 220;
      220·31+116 = 6936 % 360 = 96; 96·31+115 = 3091 % 360 = 211. So `{ bg: 'hsla(211, 70%, 45%, 0.14)', fg: 'hsl(211,
70%, 32%)' }`.
    - `pets`, dark → `{ bg: 'hsla(211, 70%, 60%, 0.16)', fg: 'hsl(211, 80%, 74%)' }`.
    - `a`, light → hue 314 (7·31+97) → `{ bg: 'hsla(314, 70%, 45%, 0.14)', fg: 'hsl(314, 70%, 32%)' }`.
    - `''`, light → the seed, hue 7 → `{ bg: 'hsla(7, 70%, 45%, 0.14)', fg: 'hsl(7, 70%, 32%)' }`.
  - Tests: bite check. Seed 7 → 0 fails the `''` row. Multiplier 31 → 37 fails `pets` and `a`. `??` → `||` fails `car`.
    App tests: 517.
- [x] 2. Extract scrollToShow for the name list's scroll offset
  - Files: apps/mobile/src/data/nameSuggestions.ts, apps/mobile/src/components/NameCombobox.tsx,
    apps/mobile/test/nameSuggestions.test.ts
  - Change: add `scrollToShow` (Contracts). `highlight` keeps `setActive(...)`, then
    `const targetY = scrollToShow(index, scrollY.current, ROW_HEIGHT, VISIBLE_ROWS); if (targetY === null) return;`
    then `scrollTo({ y: targetY, animated: false })` and `scrollY.current = targetY`. `top`, `visible` and the ternary
    leave the component. `targetY` replaces the old `y`, which takes care of finder lines `NameCombobox.tsx:91,93`.
    Add `scrollToShow` to the `@/data/nameSuggestions` import.
  - Tests: `nameSuggestions.test.ts` gets `describe('scrollToShow')` with one `it.each` of 14 rows. The expected values
    come from Base's ternary, run verbatim. Unless a row says otherwise, rowHeight is 44 and visibleRows is 5, so the
    view is 220 pt.

    | index | scrollY | expected | case                                           |
    | ----- | ------- | -------- | ---------------------------------------------- |
    | 0     | 0       | null     | first row, list at the top                     |
    | 4     | 0       | null     | last fully visible row: bottom = view's bottom |
    | 5     | 0       | 44       | one row below the view                         |
    | 19    | 0       | 660      | ↑ from none wraps to the last of 20            |
    | 1     | 88      | 44       | above the view: its top goes to the view's top |
    | 2     | 88      | null     | top = view's top                               |
    | 6     | 88      | null     | bottom = view's bottom                         |
    | 7     | 88      | 132      | below the view                                 |
    | 0     | 132     | 0        | ↓ past the end wraps to the first row          |
    | 0     | 1       | 0        | cut off by 1 pt at the top                     |
    | 1     | 50      | 44       | partly hidden above, after a hand scroll       |
    | 5     | 50      | null     | fully inside after a hand scroll               |
    | 6     | 50      | 88       | partly hidden below, after a hand scroll       |
    | 3     | 0       | 10       | rowHeight 10 and visibleRows 3                 |

    The last row catches rowHeight and visibleRows swapped: (3, 0, 3, 10) gives null.
    Bite check. `<` → `<=` fails index 2 / scrollY 88. `>` → `>=` fails index 4 / scrollY 0. Returning
    `bottom - viewHeight` from the first branch fails index 1 / scrollY 88. App tests: 531.

  - Verify: web check on the expense form. Pick a category with at least 6 earlier names; if the QA user has none,
    add expenses until one does. Focus Name and press ↓: the highlight moves down, and from the 6th row on the list
    scrolls so the highlight sits on the bottom row. Press ↑ back up: the list doesn't move until the highlight passes
    the top, then the row lands at the top. ↓ on the last row wraps to the first and the list jumps to the top. Close
    and reopen, then press ↑ with no highlight: the last row shows at the bottom. Scroll the list by hand half a row,
    then press ↓: a row that is partly hidden scrolls fully into view, and a row that is already fully visible doesn't
    move the list. Enter picks the highlighted name.
- [x] 3. Use descriptive names in the app's screens
  - Files: apps/mobile/src/app/category/[categoryId].tsx, apps/mobile/src/app/(tabs)/budget.tsx,
    apps/mobile/src/app/(tabs)/expenses.tsx, apps/mobile/src/app/expense.tsx, apps/mobile/src/app/income-item.tsx
  - Change (renames only; each name changes at its declaration and at every use):
    - `[categoryId].tsx:76` `(c)` → `(candidate)`. Not `category`: that line declares `const category`. `candidate`
      is what `demo/categoryRoutes.ts:278` uses.
    - `[categoryId].tsx:158` `(d)` → `(day)`, uses on lines 159, 162, 165 and 168.
    - `[categoryId].tsx:168` `(e)` → `(expense)`, uses on lines 170, 173, 177, 179 and 182.
    - `budget.tsx:121` `(m) => router.setParams({ month: m })` → `(nextMonth) => router.setParams({ month: nextMonth })`.
      Not `month`: that's the screen's own `month`.
    - `expenses.tsx:56` `(s, r) => s + r.spent` → `(sum, row) => sum + row.spent`. Same order: accumulator first, then
      the element of `rows`.
    - `expense.tsx:173` `setter: (v: string) => void` → `setter: (text: string) => void`. This is a type label only;
      `value` is already the next parameter.
    - `expense.tsx:191` `pickCategory(c: Category)` → `pickCategory(category: Category)`, use on line 192.
      `ExpenseForm` has no other `category`.
    - `expense.tsx:226` `const cat` → `const categoryName` (use on line 227), and its `(c)` → `(category)`.
    - `income-item.tsx:159` `edit(set: …)` → `edit(setter: …)`, use on line 160. The brief names it, and the finder
      misses three-letter names. `setter` is what `expense.tsx` uses.
  - Tests: no test covers screens; typecheck, lint and the web check do.
  - Verify: web check:
    - Budget: ‹ and › change `?month=`.
    - Expenses: the total equals the sum of the rows; switch the month.
    - A category screen: day headers and totals; rows show their name, or the category name when they have none; a tap
      opens the edit form.
    - New expense: add one, and the note reads "Added “…” to <Category> · €… · <date>".
    - Income item: type a title and an amount, then save.
- [x] 4. Use descriptive names in the app's components
  - Files: apps/mobile/src/components/{CollapsingSummary,CategorySheet,Icon,AppearancePicker,CategoryPicker,DateChips}.tsx
  - Change (renames only):
    - `CollapsingSummary.tsx:37` `(e: LayoutChangeEvent)` → `(event: LayoutChangeEvent)`, use on line 38. `{ y, height }`
      stays: those are the layout's own field names and the `card` state's shape.
    - `CategorySheet.tsx:43` `(c)` → `(category)`, uses on lines 45–48.
    - `Icon.tsx:86` `(d)` → `(path)`, giving `<Path key={path} d={path} />`. SVG's `d` attribute keeps its name.
    - `AppearancePicker.tsx:29` `(o)` → `(option)`, uses on lines 30–41. `styles.option` is a property, so there's no
      clash.
    - `CategoryPicker.tsx:29` `(c)` → `(category)`, uses on lines 30–38. `CategoryPicker.tsx:57` `(c)` → `(category)`,
      use on line 59.
    - `DateChips.tsx:30` `(d)` → `(chip)`, use on line 31. The `.filter((chip) => …)` just above already uses `chip`.
  - Tests: no test covers components; typecheck, lint and the web check do.
  - Verify: web check:
    - Expense form: quick tiles (the selected one is marked); "N more" opens the sheet, and a pick takes the last quick
      spot; Today and Yesterday chips.
    - Settings: Light, Dark and Auto switch the theme.
    - Icons on tiles, the tab bar and buttons.
    - Scroll Expenses and a category screen: the card fades and the compact total shows in the top bar.
- [x] 5. Use descriptive names in the app's data modules
  - Files: apps/mobile/src/data/{monthSummary,quick,categoryRemove,undo,useCategoryTotals,useExpenseDraft,useMonthCategories,useExpenseNames,useRate}.ts
  - Change (renames only). This slice is the largest, about 30 lines in 9 files, and fully mechanical:
    - `monthSummary.ts:6` `(sum, e)` → `(sum, expense)`.
    - `monthSummary.ts:46` `expenseCount(n: number)` → `expenseCount(count: number)`, use on line 47.
    - `monthSummary.ts:53` `for (const e of` → `for (const expense of`, uses on the same line.
    - `monthSummary.ts:67` `for (const e of` → `for (const expense of`, uses on lines 68–70 (`[e]` becomes `[expense]`).
    - `quick.ts:12` `(c) => [c.categoryId, c]` → `(category) => [category.categoryId, category]`.
    - `quick.ts:14` `.filter((c): c is Category => !!c)` → `.filter((category): category is Category => !!category)`.
    - `quick.ts:15`, `:28` and `:35` `(c)` → `(category)`. `quick.ts:29`'s `row` is separate.
    - `categoryRemove.ts:21` `const m` → `const fullMonth`, uses on lines 23, 24 (twice) and 29. Not `monthName`: that's
      the imported function, and shadowing it would throw.
    - `categoryRemove.ts:17` `c: Pick<…>` → `category: Pick<…>`, uses on lines 20, 24, 26 and 29, and in the JSDoc on
      line 13 (`` `c`'s `` becomes `` `category`'s ``). The finder misses it because the parameter is on a line of its
      own (BACKLOG small follow-up). See Open questions.
    - `categoryRemove.ts:35` `n: number` → `deletedCount: number`, uses on line 37. Not `expenseCount`: that's the
      imported function.
    - `undo.ts:65` `(o) => (o?.undo === undo ? null : o)` → `(current) => (current?.undo === undo ? null : current)`,
      as `setOffer((current) =>` three lines below.
    - `useCategoryTotals.ts:35`, `useExpenseDraft.ts:66` and `useMonthCategories.ts:42` `(v) => v + 1` →
      `(current) => current + 1`. Not `version`: that's the state variable.
    - `useMonthCategories.ts:31` `(c)` → `(monthList)`, uses on lines 33–34. Not `list`, which is a key of the same
      object.
    - `useExpenseNames.ts:20` `(r)` → `(expenseNames)`, giving `names: expenseNames.names`.
    - `useRate.ts:18` `(r)` → `(nbuRate)`, giving `eurUah: nbuRate.eurUah, rateDate: nbuRate.rateDate`.
  - Tests (unmodified): `monthSummary.test.ts` (`expenseCount`, `monthSummary`: `sumCents`, `spentByCategory`,
    `groupByDay`), `quick.test.ts` (`quick`, `monthPicker`, `startCategoryId`) and `categoryRemove.test.ts`
    (`removeWarning`, `removedMessage`). No test covers the hooks; the web check does.
  - Verify: web check:
    - Expense form: the rate preview fills the other currency; name suggestions show; the categories follow the date's
      month and the start category.
    - Edit an existing expense: it loads.
    - Delete an expense: the Undo toast shows, Undo restores it, and the toast clears.
    - A category's menu → Remove from <Month>: the dialog text is unchanged, and after removing, Undo shows "Removed “…”
      from <Month> and N expenses".
    - Delete-category screen and category form: totals load.
    - With `api` stopped, the expense form and the delete-category screen show an error with Retry. Start `api` and
      press Retry: they load.
- [x] 6. Use descriptive names in format, theme and ledger choice
  - Files: apps/mobile/src/format.ts, apps/mobile/src/theme.ts, apps/mobile/src/auth/ledgerChoice.ts
  - Change (renames only):
    - `format.ts:27` `[y, m, d]` → `[year, monthNumber, day]`, uses on line 28. Not `month`: in this repo `month` means
      'YYYY-MM' (refactoring §4, units; `kyivMonthNumber` is the precedent).
    - `format.ts:33` `const d` → `const utcMidnight`, uses on lines 34–35.
    - `format.ts:64`, `:70` and `:85` `[y, m]` → `[year, monthNumber]`, uses on lines 65, 71 and 86. Calling it `month`
      would also clash with the `month` parameter.
    - `format.ts:102` `const t` → `const decimalText`, uses on lines 103–104.
    - `format.ts:113` `const t` → `const trimmed`, uses on lines 114–115.
    - `format.ts:150` `[y, m, d]` → `[year, monthNumber, day]`, uses on line 151. These stay strings, so '01' keeps its
      zero.
    - `theme.ts:133` `(h, ch) => (h * 31 + ch.charCodeAt(0)) % 360` → `(hash, character) => (hash * 31 +
character.charCodeAt(0)) % 360`. Not `hue`: that line declares `const hue`.
    - `ledgerChoice.ts:11` `(l)` → `(ledger)`.
  - Tests (unmodified): `format.test.ts` (`format: dates`: parse, addDays, shiftMonth, `labels months and days`;
    `format: month labels`; `format: amounts`; `normalizeBalance`), `theme.test.ts` (`categoryTile`, from slice 1) and
    `ledgerChoice.test.ts` (`pickLedger`).
  - Verify: after this slice `find-short-names.sh apps/mobile/src` lists exactly the 3 `categoryIcons.LICENSE.txt`
    lines. Web check: dates and month labels on Expenses, a category screen and the form; tile colours match the Base
    screenshots; after a page reload the same ledger opens.
- [x] 7. Mark R8 in review in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: roadmap row R8: brief `124`, state `in review`.

## AC → evidence

| AC                                                                                                 | Evidence                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `nameSuggestions.ts` exports pure `scrollToShow`, unit-tested; no nested ternary in `NameCombobox` | slice 2: `nameSuggestions.test.ts` › `scrollToShow` (14 rows, bite-checked); review: `highlight` calls it and holds no `? :`    |
| `find-short-names.sh apps/mobile/src`: no lines outside the licence file                           | slices 2–6 (55 code lines); run at the end, only the 3 `categoryIcons.LICENSE.txt` lines remain                                 |
| Rename commits are renames only, one per area                                                      | slices 3–6 each touch one area; review `git show` per commit: only identifiers change (plus Prettier rewraps)                   |
| `demo-modules.txt` unchanged; `check-builds` passes                                                | every slice: `yarn mobile export:web && yarn mobile check-builds`; `git diff origin/main -- apps/mobile/demo-modules.txt` empty |
| Web check 390×844 light and dark, renamed screens, no visible change                               | slices 2–6 Verify, compared with the Base screenshots; results in the PR test plan                                              |
| Behaviour unchanged: existing tests pass unmodified                                                | `yarn test` with api 549 + 2 skipped, mcp 329, app 511 + 20 new = 531; `git diff origin/main -- apps/*/test` only adds lines    |
| One patch bump in root `package.json` and `apps/mobile/app.json`                                   | slice 0 (1.26.10 in both)                                                                                                       |

## Not doing (YAGNI)

- Vague or two-to-three-letter names the brief excludes or doesn't list: `on` (`CategoryPicker.tsx:30`), `mon`
  (`format.ts:93`), `byId` (`quick.ts:12`), `cat` as a style key, `{ y, height }` from the layout.
- Single-letter names in `apps/mobile/test` (for example `format.test.ts`'s `const d = parseDate(…)`). The brief covers
  `src` only, and test files change only by adding lines.
- Teaching the finder about parameters on a line of their own. That's an existing BACKLOG follow-up; slice 5 renames the
  one it misses by hand.
- Any other restructuring of `NameCombobox` (R9–R17 own those).

## Risks

- The call site could pass `ROW_HEIGHT` and `VISIBLE_ROWS` in the wrong order. The tests can't see it, because the view
  height (rows × height) stays the same, but `top` would be wrong. Slice 2's web check catches it: the list would
  scroll at the wrong rows.
- A new name might shadow an outer one. The repo has no `no-shadow` lint rule, so a clash would compile. The names
  above were checked against each scope (`category`, `month`, `monthName`, `expenseCount`, `version`, `hue`, `list`),
  and typecheck catches any real redeclaration, such as `const [, month] = month.split(…)`. Slices 3–6 confirm it by
  review plus unchanged tests and the web check.
- R7 could change in review, or the rebase onto origin/main could move these lines. After the rebase, re-run
  `find-short-names.sh apps/mobile/src` and the line numbers above. The names stay the same; only the line numbers
  move.
- If no QA category has 6 or more names, the scroll check needs extra local expenses. Slice 2 adds them on the local
  database only.

## Open questions

- Decided before the skeptic: the licence lines stay, and the AC reads "no lines outside
  `categoryIcons.LICENSE.txt`". The finder script is not changed in this PR.
- no — `categoryRemove.ts:17`'s `c:` isn't in the finder's 58 lines, but it's a single-letter parameter in a module the
  brief names, and refactoring §4 covers it. Assumption: rename it in slice 5. Drop it if the AC should mean the
  finder's list only.
- no — If R7 has merged before slice 7, also mark R7 `done (#<PR>)`, as origin/main did for R6. Assumption: yes.
- no — The brief lists `theme` among the covering tests, but `categoryTile` had none. Assumption: slice 1 adds them;
  that's refactoring §2 for a thinly covered target.

## Follow-ups

- `find-short-names.sh` also misses destructured single letters (`const { y, height } = …`), besides parameters on a
  line of their own (already in BACKLOG).
- The test files still use single-letter names (`apps/mobile/test`, e.g. `format.test.ts:147`). A later row could
  clean them.

## Deviations

- `expense.tsx`'s setter label is `next`, not `text` (the file imports `text` from `@/theme`; skeptic suggestion).
- Web check: base shots (Budget, Expenses, a category, the expense form, income item, Settings in dark; Expenses and
  the form in light) and the same screens on the finished branch match; slice 2's arrow-key scrolling was checked
  before its commit; the add note reads "Added “…” to groceries · €3 · <date>".

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

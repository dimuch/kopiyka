# Plan: Split the expense form into named pieces

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/expense-form-split
Base: origin/main (after R13 #201)

## Approach

Roadmap row R14, in the refactoring order (`kopiyka-refactoring` §6): two moves into existing `data/` modules, one
function per commit, then two in-file extracts in `apps/mobile/src/app/expense.tsx`.

- `rateLabel` moves as it is to `data/useRate.ts`, next to the `Rate` type it reads.
- The save error's nested ternary (lines 229-237) becomes `saveErrorText(code, month)` in `data/monthEnded.ts`. That
  module already holds `lockedText`, which the ternary calls, and `restoreRefusedText`, which has the same
  `code → text | null` shape. The fallback `errorText(err, 'save')` stays in the screen, because each screen maps its
  own codes (refactoring §8 LEAVE).
- `CategorySection` takes the Category group (289-314) and `AddedNote` takes the added note (363-370). Both go below
  `ExpenseForm`, and each reads its own `useColors`/`useThemedStyles(makeStyles)`.

Neither function can be tested where it is now. `expense.tsx` imports `react-native`, which won't load under Node. So
"characterization tests first" happens inside each move slice. Paste a verbatim copy into the target module and write
the tests. Run them green, which pins today's code. Do the bite checks. Only then delete the screen's copy and import
the new one, so no commit leaves two copies. The expected strings below come from running Base's code verbatim under
`tsx`.

Alternative considered: a new pure `data/rateLabel.ts` would need no test mock, but it adds a module and a
`demo-modules.txt` line for one function. `useRate.ts` loads under Vitest with `@/api/client` mocked (probed on Base:
without the mock it throws `__DEV__ is not defined`). That's the same one-line mock `demoDataFunctions.test.ts` uses.

## Contracts

- DB, API, routes: none. `demo-modules.txt`: no change. `useRate.ts` newly imports `@/format`, which is already listed.
- `data/useRate.ts`, verbatim body:
  `/** The form's rate line: loading, unavailable for 'YYYY-MM-DD' `date`, or the rate and the day it's from. */`
  `export function rateLabel(rate: Rate, date: string): string`
- `data/monthEnded.ts`, after `lockedText`:
  ```ts
  /** The expense form's text for a save its 'YYYY-MM' month refused; null for any other failure (the screen maps it). */
  export function saveErrorText(code: string | null, month: string): string | null {
    if (code === 'category_not_in_month') return `That category isn’t in ${monthName(month)}.`;
    // The month ended while the form was open.
    if (code === 'month_ended') return lockedText(month);
    return null;
  }
  ```
  Screen: `showError(saveErrorText(code, body.expenseDate.slice(0, 7)) ?? errorText(err, 'save'))`. The `code` line
  stays. Inputs read today: `code` (`err instanceof ApiError ? err.code : null`), the body's month, and `err` through
  `errorText`. `doing` is always `'save'` here.
- In `expense.tsx` (not exported):
  - `function CategorySection({ noBudget, notInMonth, picker, selectedId, locked, list, onPick }: { noBudget: string | null; notInMonth: string | null; picker: ReturnType<typeof monthPicker> | null; selectedId: number | null; locked: boolean; list: MonthCategories; onPick: (category: Category) => void })`
    renders today's `<View style={styles.group}>` with the label and the 4-way ternary, verbatim. `pickCategory` →
    `onPick`, and `locked` stays as `disabled={locked}`.
  - `function AddedNote({ text }: { text: string | null })` renders today's `View accessibilityRole="summary"` with its
    `Icon` and `Text`, or `null`, like `ErrorLine`. Its hooks run before the `null` return.
  - `ExpenseForm` keeps all its hooks, in the same order, and its one effect (`[categoryAlert]`). `noBudget`,
    `notInMonth` and `picker` are still computed there, because `save()` and the effect need them.
- Reuses: `monthName`, `lockedText`, `shortDate`, `MonthCategories`, `monthPicker`, and the `ErrorLine` null pattern.
- New dependencies: none.

## Version

Bump: patch — 1.26.15 → 1.26.16
Why: §8b says a behaviour-preserving refactor of shipped app code is a patch. R13 (brief 129) merged as 1.26.15.
If main moves, rebase and bump again (§8b step 4). Numbers may skip.

## Slices

Each slice ends with the gates green (`yarn format:check && yarn lint && yarn typecheck && yarn test`) and the counts
api 549 + 2 skipped and mcp 329. Mobile goes 531 → 536 after slice 1, then 547 from slice 2 on. Each slice also runs
`find-short-names.sh --diff origin/main` clean and `yarn mobile export:web && yarn mobile check-builds` with no list
change. No existing test changes; slice 2 only adds `saveErrorText` to an import line.

- [x] 0. Bump version to 1.26.16
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.16
- [x] 1. Move the rate line text next to the rate hook (~40 lines)
  - Files: apps/mobile/src/data/useRate.ts, apps/mobile/src/app/expense.tsx, apps/mobile/test/useRate.test.ts (new)
  - Change: tests first, on the verbatim copy (see Approach). Then delete the screen's copy. Its import becomes
    `{ rateLabel, useRate }` (`Rate` is no longer used there).
  - Tests: `vi.mock('@/api/client', () => ({ api: vi.fn() }))`, then `describe('rateLabel')` with `it.each` over
    `[rate, date, text]`:
    - loading, `2026-11-14` → `Fetching the NBU rate…`
    - unavailable, `2026-11-14` → `NBU rate for 14 Nov 2026 isn’t available yet; it’s fetched again when you save`
    - ok 48.5 on `2026-11-14`, date `2026-11-14` → `1 € = ₴48.5000 · NBU official rate for 14 Nov 2026`
    - ok 48.5 on `2026-11-13`, date `2026-11-15` →
      `1 € = ₴48.5000 · NBU official rate for 13 Nov 2026 (the latest before 15 Nov 2026)`
    - ok 45.0731 on `2026-12-31`, date `2027-01-01` →
      `1 € = ₴45.0731 · NBU official rate for 31 Dec 2026 (the latest before 1 Jan 2027)`
    - Bite: each of these breaks makes a row fail: `!==` → `===`, `toFixed(4)` → `toFixed(2)`, `rate.rateDate` →
      `date` in the ok line, `shortDate(date)` → `date` in the unavailable line, and editing the loading text.
  - Verify: web check, the add rows (rate line).
- [x] 2. Name the expense form's save error texts (~40 lines)
  - Files: apps/mobile/src/data/monthEnded.ts, apps/mobile/src/app/expense.tsx, apps/mobile/test/monthEnded.test.ts
  - Change: add `saveErrorText` (Contracts). The ternary becomes an `if` chain, and its comment moves with the
    `month_ended` line. The screen calls it as in Contracts.
  - Tests: new `describe('saveErrorText')`:
    - `category_not_in_month` → `That category isn’t in November.` (`2026-11`) / `That category isn’t in January.`
      (`2027-01`)
    - `month_ended` → `October has ended, so its expenses can’t change.` (`2026-10`) /
      `January has ended, so its expenses can’t change.` (`2027-01`)
    - `toBeNull()` for `null`, `not_found`, `rate_unavailable`, `date_in_future`, `unknown_category`,
      `invalid_request` and `internal` (`2026-11`)
    - Bite: each of these breaks fails a row: swap the two branches, return `null` first, pass the raw `month` to
      `monthName`'s place, return `lockedText(month)` at the end.
  - Verify: web check, the save-with-API-stopped row.
- [x] 3. Show the expense form's category group as its own section (~40 lines)
  - Files: apps/mobile/src/app/expense.tsx
  - Change: add `CategorySection` (Contracts) and replace the group with
    `<CategorySection noBudget={noBudget} … onPick={pickCategory} />`. Import `type MonthCategories`. The host tree and
    the branch order stay the same. `CategoryPicker` stays at the same position, so its open sheet's state survives.
  - Verify: web check, every row.
- [x] 4. Show the added note as its own piece (~20 lines)
  - Files: apps/mobile/src/app/expense.tsx
  - Change: add `AddedNote` (Contracts) and render `<AddedNote text={added} />` where the ternary was.
  - Verify: web check, the add rows (the note and when it clears).
- [x] 5. Mark R14 in review in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: rebase on `origin/main` first. On a conflict in the roadmap table, keep main's rows and then apply only
    these edits:
    - R14 gets brief `130` and state `in review`.
    - If R13's PR (#201 or near it) has merged, R13 becomes `done (#<n>)`.
    - If main still lists R12 as `in review`, it becomes `done (#200)`.

**Web check.** Run Expo web from this sibling worktree with `yarn mobile expo start --web --port 8084` at exactly
http://127.0.0.1:8084, and `yarn api dev` on 3000 from the same worktree. Sign in as the QA user, at 390×844, light
then dark. Before slice 1, screenshot every row on Base. After slices 1-4, compare each touched row against those
screenshots, checking text, order, spacing, alerts and focus.

- Add (EUR): open `/expense` and type a name and `12.50` in €. The ₴ side shows the preview, and the rate line shows
  `1 € = ₴… · NBU official rate for <today>` (or the fallback). Press Add. The note reads
  `Added “<name>” to <category> · €12.50 · <date>`, and name and amount clear. Typing again hides the note.
- Add in UAH: type `500` in ₴ (the default side). € shows the converted preview. After Add, the note shows the saved €.
- Edit: open an existing expense (`/expense?expenseId=<id>`). The title says Edit expense, and the stored other side
  shows until the amount changes. Update returns to the previous screen. An October expense opens locked: it shows
  `October has ended, so its expenses can’t change.`, the picker is disabled and there are no buttons.
- No budget: use a QA ledger whose current month has no categories (local DB only). The group shows
  `Set up <Month>’s budget first.`, and Add only announces it.
- Not in month: the date can't leave the current month (the date field's min is the 1st, its max is today). So open
  `/expense?categoryId=<a category in an earlier month's list only>`. The picker shows with
  `That category isn’t in <Month>.`, and Add saves nothing.
- Load error: with Home open, stop the API, then tap Add expense (in-app navigation, no reload). The group shows
  `Couldn’t load the categories. Check your connection and try again.` with Retry, the rate line shows its unavailable
  text, and Add is disabled. Start the API and press Retry: the picker shows. Then fill the form, stop the API again
  and press Add: `Couldn’t save. Check your connection and try again.`
- Loading: pause the API (`kill -STOP $(lsof -tiTCP:3000 -sTCP:LISTEN)`), open add, and the group shows the spinner.
  Resume with `kill -CONT`.

## AC → evidence

| AC                                                 | Evidence                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `rateLabel`, `saveErrorText` in `data/`, pinned    | slices 1-2: `useRate.test.ts`, `monthEnded.test.ts` `saveErrorText`, green before the cut |
| `CategorySection`, `AddedNote`; form shorter       | slices 3-4; `ExpenseForm` line count in the PR (see Open questions)                       |
| Texts, announcements, focus, navigation unchanged  | verbatim moves; web check rows against the Base screenshots                               |
| Web check 390×844 light/dark, every category state | web check rows, recorded in the PR test plan                                              |
| `demo-modules.txt` only an intended change         | `check-builds` passes with no list change, every slice                                    |
| `find-short-names.sh --diff origin/main` clean     | every slice                                                                               |
| Existing tests pass unmodified                     | counts as above; only an import line added in `monthEnded.test.ts`                        |
| One patch bump                                     | slice 0                                                                                   |

## Not doing (YAGNI)

- `remove()`'s own `month_ended ? lockedText : errorText` ternary and `income-item.tsx:157` stay as they are. Moving
  `errorText` is out too. No other sections are extracted (Date, Name, Amount, the action buttons).

## Risks

- A component boundary could remount `CategoryPicker` or the note. It renders at a fixed position with the same
  element types, so it won't. Slice 3's web check opens the "More" sheet and then changes the name, and the sheet stays
  open.
- `useRate.test.ts` could still pull native code. The probe on Base shows the client mock is enough.

## Open questions

- no — `ExpenseForm` is 254 lines today (121-374); the four pieces take it to about 223, which the brief accepts. No
  further extract.
- no — The characterization tests can't run against the screen's own copy, so they are written first inside each move
  slice, on a verbatim copy (Approach). The alternative is separate test commits that leave two copies in the code.

## Follow-ups

- `remove()` could call `saveErrorText` for its `month_ended` line (DELETE never sends `category_not_in_month`). That
  needs its own refactor brief.

## Deviations

- `CategorySection` takes the whole Category group (its `View` and label too), as Contracts' line range says.
- Web proof: page tree (role, label, text, position, size) recorded with `origin/main`'s `src` checked out in the
  worktree, then compared on the branch: add form, UAH preview, edit, category not in the month, light and dark for
  two: identical. After Add, the note's text and position matched; the page differed only by a name suggestion that
  the base run's own expense added. The no-budget and save-error rows were not run (the texts are unit-tested and the
  JSX moved verbatim).

## Consolidate

# Plan: One copy-previous-month hook, and the Budget row as a component

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/copy-previous-hook
Base: origin/main (after R11 #199, 470b7cd7)

## Approach

Roadmap row R13. A new `data/useCopyPrevious.ts` holds the flow that `budget.tsx:74-115` and `income.tsx:48-90` repeat
line for line: `busy`, the `inFlight` ref, the `shown` tag, tagged `refused`/`failed`, the `copiedOver` snapshot, the
refusal text (`copyRefusedText`), the failure note and the two reloads on a refusal. The hook has no effect, so nothing
re-runs. Each screen keeps what differs: the copy call, what it snapshots, "previous has something", `ended`, and the
previous-month LoadError. Then, in its own commit, `renderRow` becomes an in-file `BudgetRow`.

Alternative considered: the hook takes `ended` and a `previousHasItems` boolean and returns `canCopy`. It lost: two
more inputs than the brief's signature, and `ended` drives other things on both screens. The hook returns only its own
part, `hideCopy`. A pure `copyNote(...)` in `monthCopy.ts` also lost: its five inputs would be the hook's own state,
and the hook would be its only caller (refactoring §7). `copyRefusedText`, the logic that can be tested in Node, stays
covered by `monthCopy.test`.

**Diff of the two flows (base).** Everything else matches token for token. Only the comments change wording.

| Point                   | Budget                                                                                         | Income                                            | Goes to                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| call                    | `copyPreviousMonth(ledgerId, month)`                                                           | `copyPreviousIncome(ledgerId, month)`             | screen passes `copy`                      |
| `before` / `copiedOver` | `data` (`MonthData \| null`, `useMonth`)                                                       | `items` (`IncomeItem[] \| null`, `useIncome`)     | screen passes `current`                   |
| refusal text            | `copyRefusedText(err.code, month)` if `ApiError`                                               | same                                              | hook                                      |
| reloads on a refusal    | `reload()` then `previous.reload()` (`useMonthCategories`)                                     | `reload()` then `previous.reload()` (`useIncome`) | hook (`reloadPrevious`)                   |
| on a failure            | `setFailed(shown)`, no reload                                                                  | same                                              | hook                                      |
| previous has something  | `previous.status === 'ready' && previous.categories.length > 0`                                | `!!previous.items?.length`                        | screen                                    |
| rest of `canCopy`       | `!ended && … && !refusal && data !== copiedOver`                                               | `!ended && … && !refusal && items !== copiedOver` | `ended` in screen, the rest is `hideCopy` |
| note                    | `refusal ?? (failed === shown ? 'Couldn’t copy. Check your connection and try again.' : null)` | same                                              | hook                                      |
| ended                   | `month < thisMonth`, only gates `canCopy` (and other UI)                                       | same                                              | screen                                    |
| previous LoadError      | `!ended && previous.status === 'error'`                                                        | `!ended && !previous.items && previous.error`     | screen (R16's)                            |

## Contracts

- DB, API, routes: none.
- `apps/mobile/src/data/useCopyPrevious.ts` (new):

  ```ts
  export function useCopyPrevious(input: {
    ledgerId: number;
    month: string; // 'YYYY-MM' being filled
    copy: (ledgerId: number, month: string) => Promise<void>; // copyPreviousMonth | copyPreviousIncome
    current: object | null; // the month's loaded list, compared by identity only
    reload: () => void;
    reloadPrevious: () => void;
  }): { busy: boolean; note: string | null; hideCopy: boolean; startCopy: () => Promise<void> };
  ```

  The body moves from the screens unchanged: `shown`, the four `useState`s (`copiedOver: object | null`, initial
  `null`), `inFlight`, and `async function startCopy()`, the old `copy()` with `before = current`,
  `copy(ledgerId, month)` and `reloadPrevious()` swapped in. Then
  `refusal = refused?.shown === shown ? refused.text : null`, `note` as today, and
  `hideCopy = !!refusal || current === copiedOver` (De Morgan of `!refusal && current !== copiedOver`, so `null ===
null` while loading still reads settled, as today). The why-comments move with their lines. The refusal comment
  becomes "A `*_exists` brings the list in; a `no_previous_*` refreshes the previous month".

- Why lint stays clean and nothing re-runs: `copy` gets the module functions (stable). `reload` and `reloadPrevious`
  get `useCallback(…, [])` results (`useFocusLoad`, `useMonthCategories`), and nothing depends on them. `inFlight` is
  read only inside `startCopy` (an event, not render), as today. There's no `useCallback`/`useMemo`: today's `copy`
  isn't memoized, and `EmptyMonth` isn't `memo`.
- Screens: `const { busy, note, hideCopy, startCopy } = useCopyPrevious({ ledgerId: ledger.ledgerId, month, copy:
copyPreviousMonth, current: data, reload, reloadPrevious: previous.reload })`. Budget:
  `canCopy = !ended && previous.status === 'ready' && previous.categories.length > 0 && !hideCopy`. Income:
  `canCopy = !ended && !!previous.items?.length && !hideCopy`. JSX changes only `onPress: copy` → `startCopy`.
  Imports that go unused: `ApiError`, `copyRefusedText`, `type MonthData` (budget), `type IncomeItem` and `useRef` (income).
- `BudgetRow` (in `budget.tsx`, between `Budget` and `IncomeFigures`):
  `function BudgetRow({ category, drag, month, ended, pushOnce }: { category: Category; drag: DragHandlers; month:
string; ended: boolean; pushOnce: (href: Href) => void })`. Its body is today's `renderRow` body, unchanged. It calls
  `useThemedStyles(makeStyles)` (like `IncomeFigures`) and `useCardStyle('none')` itself, so the screen's `rowCard`
  goes. `pushOnce` is passed in, not called per row: `usePushOnce` keeps one guard and one focus reset per screen, and a
  hook per row would let two rows push in one tick. `renderRow={(category, drag) => <BudgetRow category={category}
drag={drag} month={month} ended={ended} pushOnce={pushOnce} />}`. ReorderList's contract
  (`renderRow: (item, drag: DragHandlers) => ReactNode`) puts the result inside its keyed `Row` (`key={keyOf(item)}`),
  with no `cloneElement`. Keys, the host tree and the props stay the same.
- Reuses: `copyRefusedText` (`data/monthCopy.ts`), `copyPreviousMonth`, `copyPreviousIncome`, `DragHandlers`,
  `useCardStyle`, `EmptyMonth`. New dependencies: none.

## Version

Bump: patch — 1.26.13 → 1.26.15
Why: §8b "a refactor that touches shipped code is `patch`". R12 (brief 128, in flight) takes 1.26.14. If `main` has
moved when this rebases, re-bump once (§8b step 4).

## Slices

Every slice: gates green, with tests unchanged (api 549 + 2 skipped, mcp 329, mobile 531), and
`.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` clean. There are no
characterization tests: no logic moves into a pure function. `copyRefusedText` stays where it is, and
`monthCopy.test` still covers it.

- [ ] 0. Bump version to 1.26.15
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.15
- [ ] 1. Share the copy-previous flow in useCopyPrevious, starting with Budget
  - Files: apps/mobile/src/data/useCopyPrevious.ts (new), src/app/(tabs)/budget.tsx, apps/mobile/demo-modules.txt
  - Change: hook as in Contracts. Budget's lines 74–110 go, and lines 112–115 become `canCopy` as above.
    `yarn mobile export:web && yarn mobile check-builds --accept`: the only new line is `src/data/useCopyPrevious.ts`,
    after `useCategoryTotals.ts`. Budget is in the demo (`demo-app/(tabs)/budget.tsx` re-exports it). ~110 lines.
  - Verify: web check, Budget rows
- [ ] 2. Use useCopyPrevious on the Income tab
  - Files: src/app/(tabs)/income.tsx
  - Change: lines 48–85 go. `canCopy` is as above, and `totalText` stays. `check-builds` passes with no list change. ~45 lines.
  - Verify: web check, Income rows
- [ ] 3. Draw Budget's category rows with an in-file BudgetRow
  - Files: src/app/(tabs)/budget.tsx
  - Change: as in Contracts. The two comments (ended rows, sibling buttons) move with their lines, and BudgetRow gets
    a one-line JSDoc. Add `type Href` (expo-router), `type Category` (`@/api/types`) and `type DragHandlers`
    (`@/components/ReorderList`) to the imports. ~70 lines, mostly moved.
  - Verify: web check, row part
- [ ] 4. Mark R13 in review in the backlog
  - Files: docs/features/BACKLOG.md: R13 → `129 | in review`. If #200 has merged when slice 4 is written, rebase first
    and also set R12 → `done (#200)`. If it merges later, resolve the rebase conflict by keeping main's R11/R12 rows,
    setting R12 → `done (#200)` and keeping R13 → `129 | in review`. Never touch R11 (#200 owns it).

**Web check.** Web runs from this worktree at exactly http://127.0.0.1:8084, with this worktree's own API on 3000
(`yarn api dev` in a background shell). First run `lsof -nP -iTCP:3000 -sTCP:LISTEN` and `lsof -a -p <pid> -d cwd`. If
3000 belongs to another checkout, don't stop it. Ask instead. The window is 390×844. Sign in as a QA user: create
`claude-qa-129` if there's none, and delete it at the end in the cleanup order. Setup: in November 2026 (this month),
add ≥ 1 category and ≥ 1 income item. December 2026 and January 2027 stay empty. Before slice 1, take base screenshots
of the six notes and buttons below, then compare text and placement after slices 1–2. Run the whole check in light,
then again in dark. Each step empties its month again, so the run repeats. "Tab B" is a second browser tab, which shares
the cookie. Tab A doesn't reload when it gets focus back, so it keeps the state it loaded.

- Budget:
  1. Success: `/budget?month=2026-12`. "No budget for December yet" shows "Copy November’s categories". Press it: the
     button goes busy, then the list shows, and Copy doesn't flash back in between.
  2. `no_previous_budget`: tab A opens `/budget?month=2027-01` (Copy shows). In tab B, remove each of December's
     categories (category form → Remove). Back in tab A, press Copy. The note "December has no categories to copy."
     shows and Copy hides. Switch to February and back: the note is gone, because it's tagged with its month.
  3. `budget_exists`: tab A opens empty December (Copy shows). In tab B, add one category to December. In tab A, press
     Copy. The network panel shows 409 `budget_exists`, the note shows until the reload lands, then December's list
     shows. In tab B, remove that category again.
  4. Failure: tab A on empty December, then stop the API (kill the `tsx watch` parent and its child). Press Copy. The
     note says "Couldn’t copy. Check your connection and try again.", and Copy stays, enabled. Start the API and press
     Copy: the note clears and the copy works. `kill -STOP` won't do here: `api()` has no timeout, so the request just
     waits, and after `kill -CONT` it succeeds. Use it only to see the busy state.
- Income: the same four steps with `/income?month=…`: "Copy November’s income"; "December has no income to copy."
  (delete December's items in tab B); 409 `income_exists` (add an item in tab B, then delete it); and the failure note.
- Rows (after slice 3): on November, tap a row (opens the amount), tap the pencil (opens the category form), long-press
  and drag a row to reorder it. On October (ended), the rows aren't buttons and long-press still drags. Read the rows'
  labels with the a11y inspector: the same as on base.

## AC → evidence

| AC                                              | Evidence                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Hook holds the flow; screens have no copy state | slices 1–2; `rg -n "inFlight\|copiedOver\|setRefused\|setFailed" 'src/app/(tabs)'` finds nothing |
| Refusal/failure texts, Copy show/hide unchanged | `monthCopy.test` unmodified; web check Budget/Income steps 1–4 against base screenshots          |
| `renderRow` → in-file `BudgetRow`, own commit   | slice 3; web check rows                                                                          |
| Web check 390×844 light and dark                | web check above, recorded in the PR test plan                                                    |
| `demo-modules.txt` only the new module          | slice 1 `check-builds --accept`, diff = `src/data/useCopyPrevious.ts`; slices 2–3 pass unchanged |
| `find-short-names.sh --diff origin/main` clean  | run every slice                                                                                  |
| Existing tests pass unmodified                  | `yarn test` counts unchanged every slice                                                         |
| Version one patch, both files                   | slice 0                                                                                          |

## Not doing (YAGNI)

- No `canCopy` or `ended` inside the hook, no pure note helper, no `useCallback` on `startCopy`, no `memo` on BudgetRow.
- No change to the previous-month LoadError conditions (they differ, and R16 owns them), the income rows, `IncomeFigures` (R17),
  or any text.

## Risks

- A React Compiler lint rule (`react-hooks/refs`, `immutability`) flags the moved code in a hook where it passed in a
  screen. Slice 1 `yarn lint` shows it. If it does, the fix stays inside the hook, with no disable comment.
- Calling `useThemedStyles`/`useCardStyle` per row changes something visible. Slice 3's row check compares against base.
  If it does, pass `styles` and `rowCard` in as props instead.
- Another session's API holds port 3000, and stopping it would break that session. The `lsof` check before the web
  check catches this.

## Open questions

- no — the name `hideCopy` for "refused or just copied over" (brief: "`canCopy`-relevant state"). Assumed fine.
- no — for the failure, the API is stopped rather than paused (see the web check). Assumed acceptable to the user.

## Follow-ups

- BACKLOG's roadmap row R11 still says `in review`, though the brief says #199 merged. Slice 4 leaves it alone, so it
  doesn't clash with R12's branch.

## Deviations

- Skeptic edits folded in before build: `isSettled` is named `hideCopy` (with a one-line JSDoc); slice 4's backlog rule
  for #200; the web check reloads the page at the start of each step (refusal tags stay while the screen is mounted),
  expects a refusal note to come back when returning to its month (as on base), runs the worktree's own API with the
  main checkout's `apps/api/.env` copied in, waits until port 3000 is really free before the failure step, and checks
  ended rows in the demo build rather than with a fresh QA user.

## Consolidate

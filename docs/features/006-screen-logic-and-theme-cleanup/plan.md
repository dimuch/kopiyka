# Plan: Screen logic and theme cleanup

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/screen-logic-and-theme-cleanup
Base: origin/main@53017e1

## Approach

All changes are in `apps/mobile`, and every slice is refactor-only: no visible or behavioural change. The API is
untouched, so `yarn test` is unaffected. Audit items: M9, M10, M12, M13, M21, M22 (`docs/audits/2026-10-architecture.md`).

The brief predates 003, 004, 005, 007 and 008. I re-checked each item against Base:

| Brief item                                                           | On Base                                                                                                                                                                                                                         | In this plan                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/monthSummary.ts` (`sumCents`, `spentByCategory`, `groupByDay`) | Still inline: `app/index.tsx:20-25`, `app/category/[categoryId].tsx:61-71`. Four `+ toCents(e.amount…)` sums.                                                                                                                   | Slice 1, as briefed.                                                                                                                                      |
| `data/quick.ts` (`withQuick` + quick/more split)                     | `withQuick` already moved to `data/useExpenseDraft.ts:8` (004). The split is still inline in `app/expense.tsx:128-129`.                                                                                                         | Slice 2, trimmed: move `withQuick` and add the split. `useExpenseDraft.ts` imports the API client, so `withQuick` can't be run by `tsx` there (verified). |
| Raw hex → `theme.ts`                                                 | 12 `#rrggbb` in 7 files (moved by 007), plus `#000` and one `rgba(…)`. List under Contracts.                                                                                                                                    | Slice 3, all 14.                                                                                                                                          |
| `{x && …}` on a number/string                                        | `{editingId && …}` is gone (004). String cases left: `expense.tsx:235` (`error`), `:266` (`added`), `login.tsx:93` (`error`), `CollapsingSummary.tsx:57` (`label`). The others test booleans, objects or a function.            | Slice 4, those four.                                                                                                                                      |
| `expenseId` via `Number.isInteger`, invalid → "add"                  | Moot. 004 deliberately sends a malformed id to the API so `/expense?expenseId=abc` shows "That link isn’t valid." with Back (`useExpenseDraft.ts:69`, 004 slice 6). No `NaN` is rendered: the title tests `editingId !== null`. | Dropped; Open question 1. Re-verified only (Procedure N).                                                                                                 |
| `useCollapsingSummary` memoisation                                   | Still re-creates `Animated.event` and the interpolations each render (`CollapsingSummary.tsx:16-33`). React Compiler is off (`app.json` has no `experiments.reactCompiler`), so nothing memoises it for us.                     | Slice 5.                                                                                                                                                  |
| Unused `API_URL`, `sliders`, `IconName`, `ledgers`, `nativeID`s      | All still there. `API_URL` and `IconName` are used inside their own files, so only the `export` goes. `nativeID`s: `login.tsx:59,76`, `expense.tsx:216`, `AmountFields.tsx:46`.                                                 | Slice 6. The `nativeID`s are removed, not wired: every input already has an `accessibilityLabel` with the same text.                                      |

Home's total stays the sum of its rows, not `sumCents(expenses)`: rows come from active categories only, so an
expense in a since-hidden category isn't counted today, and summing all expenses would change the number.

Alternative considered: put the summaries in `format.ts` and leave `withQuick` in `useExpenseDraft.ts` (fewer files).
Lost because `format.ts` is formatting/parsing, the brief names the modules, and a hook module that imports the API
client can't be loaded by `tsx` for a pure-helper check.

## Contracts

- DB: none. API: none.
- `apps/mobile/src/data/monthSummary.ts` (new). Imports only `type Expense` and `toCents`.

  ```ts
  /** Sum of one amount column over `expenses`, in integer cents. */
  export function sumCents(expenses: Expense[], field: 'amountEur' | 'amountUah'): number;
  /** EUR cents spent per category id; categories without expenses are absent. */
  export function spentByCategory(expenses: Expense[]): Map<number, number>;
  export interface Day {
    date: string;
    items: Expense[];
    /** EUR cents. */
    totalCents: number;
  }
  /** Expenses grouped by `expenseDate`, days and items in the order given (the API sends newest first). */
  export function groupByDay(expenses: Expense[]): Day[];
  ```

  Callers: Home (`spentByCategory`), Category (`groupByDay`, `sumCents` ×2); `groupByDay` uses `sumCents` per day.
  `groupByDay` pushes into the day's array instead of Base's copy-per-item spread; same output.

- `apps/mobile/src/data/quick.ts` (new). Imports only `type Category`.

  ```ts
  const QUICK_COUNT = 5; // moved from useExpenseDraft.ts
  /** Puts `id` in the quick row, taking the last spot when it isn't there yet. */
  export function withQuick(quick: number[], id: number): number[]; // body unchanged
  /** The quick row's categories in its order, and the rest for "More". `byId` may hold a hidden category. */
  export function splitQuick(
    quick: number[],
    categories: Category[],
    byId: Map<number, Category>,
  ): { quick: Category[]; more: Category[] };
  // quick: quick.map(byId.get).filter(defined); more: categories.filter(c => !quick.includes(c.categoryId)) — as Base.
  ```

  Callers: `withQuick` — `useExpenseDraft.ts` (`toDraft`) and `expense.tsx` (`pickCategory`); `splitQuick` — `expense.tsx`.
  `useExpenseDraft.ts` stops exporting `withQuick`.

- `apps/mobile/src/theme.ts`, `colors` gains (values copied exactly; names follow the audit's suggestions):

  | Token             | Value              | Replaces                                                                                   |
  | ----------------- | ------------------ | ------------------------------------------------------------------------------------------ |
  | `accentTint`      | `#16233A`          | `DateChips.tsx:49` `chipOn`, `CategoryPicker.tsx:78` `catOn`, `expense.tsx:315` `added` bg |
  | `accentLine`      | `#2B4470`          | `expense.tsx:317` `added` border                                                           |
  | `surfaceRaised`   | `#22262D`          | `category/[categoryId].tsx:230` toast, `CategorySheet.tsx:83` item                         |
  | `borderStrongest` | `#3A404A`          | `CategorySheet.tsx:67` handle, `CategoryPicker.tsx:82` dashed "More"                       |
  | `faint`           | `#6E757E`          | `expense.tsx:224` and `AmountFields.tsx:57` placeholders, `AmountFields.tsx:24` swap icon  |
  | `fainter`         | `#4A505A`          | `login.tsx:90` code placeholder                                                            |
  | `backdrop`        | `rgba(5,6,8,0.62)` | `CategorySheet.tsx:55`                                                                     |
  | `shadow`          | `#000`             | `AddExpenseButton.tsx:33`                                                                  |

- `CompactTotal` and `useCollapsingSummary`: same props and return shape. `onScroll` is `useMemo([scrollY])` and the
  three styles are one `useMemo([scrollY, card])`; `onCardLayout` stays as it is. A why-comment says a new
  `Animated.event` is re-attached to the native scroll view. Candidate checked with `eslint --stdin` and Prettier
  against the repo config: clean.
- Removed: `export` on `API_URL` (`client.ts:18`) and `IconName` (`Icon.tsx:16`); the `sliders` path; `ledgers` from
  `AuthState`'s `signedIn` member and from `fetchMe`'s result (`me.ledgers[0]` stays); the four `nativeID` props.
- New dependencies: none.

## Slices

Each slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`. Estimates are insertions + deletions;
slices 1, 2 and 5 were drafted in the system temp dir. **PR total ≈ 205 changed lines.**

- [x] 1. Move month totals and day grouping into data/monthSummary.ts
  - Files: `data/monthSummary.ts` (new), `app/index.tsx`, `app/category/[categoryId].tsx`
  - Change: the module from Contracts. Home's `rows` memo uses `spentByCategory`; `total` stays the sum of rows. Category
    uses `useMemo(() => groupByDay(data?.expenses ?? []), [data])`, `sumCents` for `totalEur`/`totalUah` (0 without
    data), and `d.totalCents`; its `Expense` import goes.
  - Verify: Procedure C (module part) passes; on Base it fails to resolve `@/data/monthSummary`. Procedure T diff is
    empty. `rg -n "\+ toCents\(" apps/mobile/src/app` is empty (4 hits on Base).
  - ≈55 lines.
- [x] 2. Move the quick-row rules into data/quick.ts
  - Files: `data/quick.ts` (new), `data/useExpenseDraft.ts`, `app/expense.tsx`
  - Change: move `QUICK_COUNT` and `withQuick`; add `splitQuick`; the form gets `quickCats`/`moreCats` from it.
  - Verify: Procedure C passes in full. In the browser, on Add expense: picking a "More" category puts it in the last
    quick spot and removes it from the sheet, as on Base; editing an expense still preselects its category.
  - ≈35 lines.
- [ ] 3. Move the remaining raw colours into theme tokens
  - Files: `theme.ts`, `components/{DateChips,CategoryPicker,CategorySheet,AmountFields,AddExpenseButton}.tsx`,
    `app/{expense,login}.tsx`, `app/category/[categoryId].tsx`
  - Change: the token table above; each literal becomes `colors.<token>`.
  - Verify: `rg -n "#[0-9A-Fa-f]{3,8}\b|rgba?\(" apps/mobile/src -g '!theme.ts'` is empty (14 hits on Base). Every
    literal removed in `git show` appears once in `theme.ts` with the same value. Procedure V screenshots match Base.
  - ≈40 lines.
- [ ] 4. Render string-guarded blocks with ternaries
  - Files: `app/expense.tsx`, `app/login.tsx`, `components/CollapsingSummary.tsx`
  - Change: `{error && (…)}`, `{added && (…)}`, `{error && (…)}`, `{label && (…)}` → `{x ? (…) : null}`.
  - Verify: in the browser, Add with an empty name shows "Add a name and an amount first."; a wrong login code shows
    its error; the "Added …" note shows after Add; on a scrolled Category the compact bar shows the category name. Review:
    `rg -n "\{(error|added|label) && \(" apps/mobile/src` is empty (4 hits on Base; Home's and Category's
    `{error && <LoadError…}` test a boolean and stay).
  - ≈16 lines.
- [ ] 5. Keep one native scroll handler for the collapsing summary
  - Files: `components/CollapsingSummary.tsx`
  - Change: the memoisation in Contracts.
  - Verify: on Home and Category, scroll down: the card fades, the compact total and divider fade in, as on Base. Leave
    and refocus Home (a refetch re-renders it), then scroll again: same. iPhone (Expo Go): same check, recorded in the
    PR test plan.
  - ≈32 lines.
- [ ] 6. Remove unused exports, the sliders icon, ledgers state and label ids
  - Files: `api/client.ts`, `components/Icon.tsx`, `auth/AuthContext.tsx`, `app/login.tsx`, `app/expense.tsx`,
    `components/AmountFields.tsx`
  - Change: the removals in Contracts. Prettier will likely fold each `<Text style>Label</Text>` onto one line.
  - Verify: `rg -n "export (const API_URL|type IconName)|sliders|nativeID" apps/mobile/src` is empty (7 hits on Base).
    `rg -n "ledgers" apps/mobile/src/auth` hits only `fetchMe`'s response type and `me.ledgers[0]` (4 hits on Base).
    Sign out and in again; Home loads. In the browser's accessibility tree, the name, amount, username and code inputs
    keep their names.
  - ≈25 lines.

Optional, if the user asks at Gate A (not part of this plan): "Use the Currency type for the entered currency and format
helpers" — `api/types.ts` (`Expense.enteredCurrency: Currency`) and `format.ts` (`import type { Currency }` for
`convertPreview` and `otherAmountText`), ≈6 lines; verify `rg -n "'EUR' \| 'UAH'" apps/mobile/src` hits only
`api/types.ts:3`.

### In-app browser procedures (launch configs `api` + `web`, sign in, resize to 390×844)

Snapshots and screenshots go in the system temp dir, never the repo. Take the "before" set on Base, before slice 1.

**Procedure T, totals.** On Home for the current month and the previous one, and on one category with expenses on at
least two days, evaluate `document.body.innerText` and save each. Note the months and the category id used, and make no
other writes to the dev DB between the "before" and "after" snapshots (run Procedure V's Add/Delete after them, or
take a fresh "before" on Base afterwards). Repeat after slice 1 and at the end; `diff` must be empty (row amounts, Home
total, Category card EUR/UAH, day totals, item amounts).

**Procedure V, visuals.** Screenshots before and after slice 3, and at the end:

1. Home, top and scrolled (compact total, divider, the Add button's shadow).
2. Add expense: Today chip on (`accentTint`), a selected category tile, the dashed More tile, empty name and amount
   placeholders, the swap icon. Then Add a test expense to show the "Added …" note (`accentTint`/`accentLine`).
3. The category sheet from More (backdrop, handle, items).
4. Category of that test expense: open it and Delete it to show the Undo toast (`surfaceRaised`), then let the toast
   time out. Only the test expense is touched; real data stays as it was.
5. Login after Sign out (the code field's placeholder).

**Procedure N, malformed id (AC 3 as proposed).** Load `/expense?expenseId=abc`: header "Edit expense", body "That link
isn’t valid." with Back, and `document.body.innerText.includes('NaN')` is `false`. Same on Base and at the end.

### Procedure C, pure-helper check (nothing added to the repo)

Save as `$TMPDIR/kopiyka-006-check.ts` and run from the repo root with
`yarn api tsx --tsconfig ../mobile/tsconfig.json "$TMPDIR/kopiyka-006-check.ts" < /dev/null`. Use a file: `tsx -e`
with `--tsconfig` opens a REPL and hangs. Slice 1 runs it without the `quick` lines. It passed against the Contracts'
drafts (`monthSummary and quick checks passed`).

```ts
import assert from 'node:assert/strict';
import type { Category, Expense } from '@/api/types';
import { groupByDay, spentByCategory, sumCents } from '@/data/monthSummary';
import { splitQuick, withQuick } from '@/data/quick';
const ex = (expenseId: number, categoryId: number, expenseDate: string, amountEur: string, amountUah: string) =>
  ({ expenseId, categoryId, expenseDate, amountEur, amountUah }) as Expense;
// As the API sends them: newest date first.
const es = [
  ex(3, 1, '2026-10-07', '12.50', '600.00'),
  ex(2, 1, '2026-10-07', '0.10', '4.85'),
  ex(1, 2, '2026-10-05', '100.00', '4850.00'),
];
assert.equal(sumCents(es, 'amountEur'), 11260); // 1250 + 10 + 10000
assert.equal(sumCents(es, 'amountUah'), 545485); // 60000 + 485 + 485000
assert.equal(sumCents([], 'amountEur'), 0);
assert.deepEqual(
  [...spentByCategory(es)],
  [
    [1, 1260],
    [2, 10000],
  ],
);
assert.deepEqual(
  groupByDay(es).map((d) => [d.date, d.items.map((e) => e.expenseId), d.totalCents]),
  [
    ['2026-10-07', [3, 2], 1260],
    ['2026-10-05', [1], 10000],
  ],
);
assert.deepEqual(groupByDay([]), []);
assert.deepEqual(withQuick([1, 2, 3, 4, 5], 9), [1, 2, 3, 4, 9]);
assert.deepEqual(withQuick([1, 2], 2), [1, 2]);
const cat = (categoryId: number) =>
  ({ categoryId, techName: `c${categoryId}`, displayName: `C${categoryId}`, sortOrder: categoryId }) as Category;
const cats = [cat(1), cat(2), cat(3)];
const byId = new Map([...cats, cat(7)].map((c) => [c.categoryId, c])); // 7: a since-hidden category
const s = splitQuick([3, 7, 1], cats, byId);
assert.deepEqual(
  s.quick.map((c) => c.categoryId),
  [3, 7, 1],
);
assert.deepEqual(
  s.more.map((c) => c.categoryId),
  [2],
);
console.log('monthSummary and quick checks passed');
```

## AC → evidence

AC wording as proposed under Open questions; the originals' evidence is the same where unchanged.

| AC                                                                      | Evidence                                                                   |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. No raw colour outside `theme.ts`; screens look the same              | Slice 3 `rg`; Procedure V                                                  |
| 2. No `+ toCents(` sums in `app/`; Home and Category totals match       | Slice 1 `rg`; Procedure T; Procedure C                                     |
| 3. `/expense?expenseId=abc` shows "That link isn’t valid." and no `NaN` | Procedure N (before and after)                                             |
| 4. No `{<string or number> && <JSX>}` in `apps/mobile/src`              | Slice 4 `rg` + review of the remaining `&&` (booleans, objects, `onRetry`) |
| 5. Removed symbols have no importer; lint + typecheck green             | Slice 6 `rg`; gates on every commit                                        |
| 6. Behaviour unchanged; refactor-only                                   | Procedures T, V, N; slice checks 2, 4, 5                                   |
| (What) `monthSummary.ts`, `quick.ts` used by the screens                | Procedure C; `rg -n "monthSummary\|@/data/quick" apps/mobile/src/app`      |
| (What) `useCollapsingSummary` memoised                                  | Slice 5 checks; review                                                     |

## Not doing (YAGNI)

- The `Number.isInteger` / "invalid id → Add" change (Open question 1).
- Per-item `eur(toCents(e.amountEur))` / `uah(toCents(e.amountUah))` in the Category list: formatting one amount, not a
  sum (Open question 2).
- Converting the boolean/object `&&` renders (`error` booleans, `category`, `expense`, `onRetry`): they can't render text.
- Un-exporting `convertPreview`, `centsToInput`, `ExpenseInput`, `ExpenseDraft`: pure helpers kept testable, or types
  of exported signatures.
- A test runner, `KeyboardAvoid` wrapper, `AuthContext` fixes, redesign (brief: out of scope).
- `app.json`'s `#0E1013`/`#E6F4FE`: config, not `src`.
- Retyping `Expense.enteredCurrency` and `format.ts`'s parameters with `Currency`: no brief AC (007's review nit and
  PR #14 listed it as a candidate; offered to the user at Gate A).

## Risks

- **Totals drift** if `spentByCategory` or `sumCents` differs from Base. Slice 1's Procedure T diff and Procedure C
  catch it before slice 2.
- **A token value typo** shifts a colour slightly. Slice 3's "same literal in `theme.ts`" diff check and Procedure V.
- **The memoised scroll handler stops driving the fade** (e.g. stale `card` in the styles). Slice 5's scroll checks,
  including after a refocus re-render; `card` is in the styles' deps.
- **Removing `nativeID` changes web DOM ids** (`id="name-label"` etc.). Nothing references them (`rg` finds only the
  props), and inputs are named by `accessibilityLabel`; slice 6 checks the accessibility tree.

## Open questions

- Blocking: no. **1. `expenseId` parsing.** The brief wants an invalid id treated as "add". 004 deliberately did the
  opposite: `?expenseId=abc` reaches the API and shows "That link isn’t valid." + Back, with no `NaN` rendered.
  Assumption: keep 004's behaviour and drop the item (AC 3 and AC 6 edits below). Switching would be ≈4 lines in
  `expense.tsx`, plus dropping 004's comment, and would make the load-time `invalid_request` text unreachable.
- Blocking: no. **2. AC 2's grep.** `toCents(e\.amount` also matches the two per-item display conversions in the
  Category list, which aren't sums. Assumption: change the grep to `\+ toCents\(`. Keeping the original wording would
  need `groupByDay` items to carry cents (≈+8 lines, a wider `Day` type).
- Blocking: no. **3. `nativeID`s: remove or wire `aria-labelledby`.** The brief lets the plan pick. Picked: remove,
  because each input already has an `accessibilityLabel` with the label's text; wiring would add a second name source.
- Blocking: no. **4. Token names** (`accentTint`, `accentLine`, `surfaceRaised`, `borderStrongest`, `faint`, `fainter`,
  `backdrop`, `shadow`). Conventions don't decide names.

### Proposed brief edits (for your approval at Gate A; brief.md is not edited)

- What, `data/quick.ts`: "`withQuick` (moved from `data/useExpenseDraft.ts`) and the quick/more split (`splitQuick`)".
- What, conditional renders: drop "`expenseId` params are parsed with `Number.isInteger`, and an invalid one is treated
  as 'add'." Why: the four string cases are `expense.tsx` `error`/`added`, `login.tsx` `error`, `CollapsingSummary`
  `label`.
- What, removals: "…and the unreferenced `nativeID`s (removed; inputs keep their `accessibilityLabel`)."
- AC 1: "`rg -n "#[0-9A-Fa-f]{3,8}\b|rgba?\(" apps/mobile/src -g '!theme.ts'` returns nothing; screens look the same
  (before/after screenshots of Home, Category with the Undo toast, Add/Edit with the "Added" note, the category sheet and
  Login at 390×844)."
- AC 2: "`rg -n "\+ toCents\(" apps/mobile/src/app` returns nothing; totals on Home and Category match before/after for
  the same month."
- AC 3: "`/expense?expenseId=abc` on web shows “That link isn’t valid.” with Back and no stray `NaN` text (004's
  behaviour, unchanged)."
- AC 4: "No `{<number or string> && <JSX>}` patterns remain in `apps/mobile/src` (`rg` + code review)."
- AC 6: "Behaviour is unchanged. The PR is refactor-only."

## Follow-ups

- `/expense?categoryId=abc` preselects `NaN`: no tile is selected, and Add says "Add a name and an amount first."
  (`expense.tsx:69` parses with `Number`). Harmless but misleading.
- `/category/abc` drops the `categoryId` filter (`NaN` is falsy in `useMonth.ts:27`), loads the whole month, then shows
  "Category not found." Correct outcome, wasted request.
- Home's total ignores expenses in since-hidden categories (rows come from active categories). Probably intended;
  worth stating once budgets arrive.

## Deviations

<filled by the developer during build>

## Revision 1

Skeptic: APPROVE WITH EDITS.

- Required: slice 7 (`Currency`), proposed AC 7, its evidence row, its open question, Contracts bullet and Approach row
  are removed; the retyping is under Not doing, with a short optional note at the end of Slices so it can be re-added at
  Gate A without re-planning. Open questions renumbered (3 → nativeIDs, 4 → token names).
- Adopted: slice 5 drops the `onCardLayout` `useCallback` (the brief names only the event and interpolations), ≈32
  lines. Procedure T forbids dev-DB writes between snapshots and records the months/category used. Procedure V adds and
  deletes only its own test expense.
- PR total ≈ 205 changed lines (was ≈ 215).

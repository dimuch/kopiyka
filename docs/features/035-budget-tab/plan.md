# Plan: Budget tab, set up a month (part 2 of 5 of 033)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md (outline: ../033-monthly-budget/plan.md, "Later parts", Part 2)
Branch: feat/budget-tab
Base: origin/main @ 9f53fac (part 1, PR #45, merged)

## Approach

App only. Part 1 already gives everything the app needs: `GET …/categories?month=` returns `[]` for a month with no
budget, `POST …/months/:month/copy` sets it up, and expense writes into such a month get `400 category_not_in_month`.

- The Expenses tab's month switcher moves into `components/MonthSwitcher.tsx` (mechanical slice).
- `(tabs)/budget.tsx` replaces the placeholder. Its month lives in the route param `month` (`/budget?month=2026-11`),
  so the Expenses tab can open it on a month with `router.navigate`, and the switcher calls `router.setParams`. This
  avoids syncing state from a param in an effect. It reads the month with the existing `useMonth` and the previous
  month with the existing `useMonthCategories`, so there's no new hook.
- `components/NoBudget.tsx` shows "No budget for November yet" with an optional action button. The Budget tab uses it
  with Copy, and the Expenses tab with a link to the Budget tab.
- The expense form shows "Set up November’s budget first." in place of the picker when the month's list is empty, and
  Save returns early. The default category already copes: `firstQuickId` takes `quickCategoryIds[0] ?? null`, which is
  `null` for an empty month (the API's `pickQuick` over zero rows), and it is set by the first non-empty list.

Alternative considered: a new `data/useBudgetMonth` hook that loads the month's and the previous month's categories
in one `Promise.all`. It lost because it's about 45 more lines for one caller, while `useMonth` plus
`useMonthCategories` already do it. The cost is that the Budget tab also loads the month's expenses, which it doesn't
show yet (034 will).

## Contracts

- DB: none.
- API: none new. The app consumes `POST /api/ledgers/:id/months/:month/copy` → `204`. Errors: `409 month_ended`,
  `409 budget_exists`, `409 no_previous_budget`, plus 400/401/404 as for every ledger route.
- App, `data/categories.ts`, new:
  ```ts
  /** Sets up a 'YYYY-MM' month with no budget with the previous month's categories (brief 033). */
  export async function copyPreviousMonth(ledgerId: number, month: string): Promise<void>;
  // POST /api/ledgers/${ledgerId}/months/${month}/copy
  ```
- App, `data/monthCopy.ts`, new pure module with no RN imports, so Node tests can load it:
  ```ts
  /** The Budget tab's text for a refused copy into a 'YYYY-MM' month; null when `code` isn't a copy refusal. */
  export function copyRefusedText(code: string, month: string): string | null;
  // 'budget_exists'      → 'November already has a budget.'
  // 'no_previous_budget' → 'October has no categories to copy.'
  // 'month_ended'        → 'November has ended, so it can’t change.'  (same text as delete-category.tsx)
  ```
- App, `components/MonthSwitcher.tsx`:
  `export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void })`. It
  renders the previous button, the "BUDGET ’26" eyebrow with the month name, and the next button, exactly as
  `expenses.tsx` lines 48–69 do today. Each arrow calls `onChange(shiftMonth(month, ±1))`.
- App, `components/NoBudget.tsx`:
  ```ts
  /** A month with no categories: "No budget for November yet", an optional action and its outcome. */
  export function NoBudget(props: {
    month: string;
    action?: { label: string; onPress: () => void; busy: boolean };
    /** A refusal or failure from the action, announced to screen readers (via LoadError). */
    note?: string | null;
  }): JSX.Element;
  ```
  The card uses the same surface, border and radius as the Expenses list card. The button is a 44pt-plus
  `accessibilityRole="button"` with `accessibilityState={{ busy }}`, and shows a spinner while busy.
- App routes: `(tabs)/budget` reads `useLocalSearchParams<{ month?: string | string[] }>()`. The month is
  `parseMonthParam(params.month) ?? thisMonth`, and a missing or malformed month opens the current month. The Expenses
  tab opens it with `router.navigate({ pathname: '/budget', params: { month } })`.
- New dependencies: none.

## Slices

- [ ] 1. Share the month switcher between tabs as a component
  - Files: `apps/mobile/src/components/MonthSwitcher.tsx` (new), `apps/mobile/src/app/(tabs)/expenses.tsx`.
  - Change: move the switcher JSX and its styles (`monthSwitch`, `monthLabel`, `eyebrow`, `month`, and its own
    `iconButton`) into the component. `expenses.tsx` renders `<MonthSwitcher month={month} onChange={setMonth} />` and
    keeps `iconButton` for its Home button. No visible change. About 90 lines.
  - Verify: typecheck and lint. On web at 390×844, the Expenses tab looks and switches months exactly as before, in
    light and dark.

- [ ] 2. Show the selected month's categories on the Budget tab
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx` (rewrite), `apps/mobile/src/components/NoBudget.tsx` (new, `month`
    prop only).
  - Change:
    - The header is a centred `MonthSwitcher`, whose `onChange` is `router.setParams({ month })`.
    - `const [thisMonth] = useState(() => kyivMonth(new Date()))`, the same pattern as `category/[categoryId].tsx`.
    - Data comes from `useMonth(ledger.ledgerId, month)`. The states are: loading (spinner); error with no data
      (`LoadError` "Couldn’t load this month…" with Retry); error with stale data ("Couldn’t refresh…"); an empty list
      (`<NoBudget month={month} />`); and otherwise a list card with one non-pressable row per category
      (`CategoryTile` and name).
    - `PlaceholderPage` stays, because Statistics and Settings use it. About 145 lines.
  - Verify: on web at 390×844 as the QA user, the Budget tab shows October's 15 categories in sort order. Next shows
    "No budget for November yet" with no button, and the URL reads `/budget?month=2026-11`. Previous/Next work, and
    `/budget?month=bad` opens October. Check light and dark.

- [ ] 3. Set up a month by copying the previous month's categories
  - Files: `apps/mobile/src/data/categories.ts`, `apps/mobile/src/data/monthCopy.ts` (new),
    `apps/mobile/test/monthCopy.test.ts` (new), `apps/mobile/src/components/NoBudget.tsx` (gains `action` and
    `note`), `apps/mobile/src/app/(tabs)/budget.tsx`, `apps/mobile/src/data/useMonthCategories.ts` (JSDoc rewrite
    only), `apps/mobile/src/data/useMonth.ts` (`interface MonthData` becomes `export interface MonthData`, for
    `copiedOver`'s type).
  - Change, in `budget.tsx`:
    - `const previous = useMonthCategories(ledger.ledgerId, shiftMonth(month, -1))`.
    - Copy shows only when all of these hold: `!ended`;
      `previous.status === 'ready' && previous.categories.length > 0`; the month wasn't refused (below); and `data`
      isn't the empty list that was loaded before a successful copy (below).
    - Its label is `` `Copy ${monthName(shiftMonth(month, -1))}’s categories` ``.
    - If `previous.status === 'error'`, the empty state shows a `LoadError` that retries `previous.reload`.
    - Press: an `inFlight` ref guards it (as `delete-category.tsx` does, against two presses in one tick), then busy,
      then `copyPreviousMonth`. `inFlight.current = false` and busy off in `finally` (the screen stays mounted, so a
      later copy into another month must work). `ended` is `month < thisMonth`, as in `category/[categoryId].tsx`.
    - On 204: `reload()`. Copy then stays hidden while `data` is the object loaded before the copy. That's state
      `copiedOver: MonthData | null`, compared by identity. `useMonth` keeps the old data until the reload lands, and
      without this the button would flash back for a moment.
    - On a refusal (`copyRefusedText` isn't null): `refused = { month, text }` hides Copy and shows the text for that
      month. Then `reload()` and `previous.reload()`, so a `budget_exists` brings the list in.
    - Any other failure: the note "Couldn’t copy. Check your connection and try again.", and the button stays.
    - Refusals are tagged with their month, so switching months clears them without an effect.
    - `useMonthCategories`' JSDoc says it also serves the Budget tab's Copy check.
  - Tests: `monthCopy.test.ts`, table style:
    - `budget_exists`, `no_previous_budget` and `month_ended` for `'2026-11'` give the exact texts above;
    - `month_ended` for `'2027-01'` names January, and `no_previous_budget` for `'2027-01'` names December (the year
      boundary);
    - `'not_found'` and `'unknown'` give `null`.
  - Verify: see AC rows 1–3. About 125 lines.

- [ ] 4. Point an Expenses month with no budget to the Budget tab
  - Files: `apps/mobile/src/app/(tabs)/expenses.tsx`.
  - Change: when `rows` is loaded and empty, render
    `<NoBudget month={month} action={{ label: 'Go to Budget', onPress: () => router.navigate({ pathname: '/budget', params: { month } }), busy: false }} />`
    in place of the empty list card. The summary card and the "Categories / spent" head stay above it, as they are.
    An ended month (`month < thisMonth`, `thisMonth` read once like the Category screen) gets no `action`: it can't be
    set up any more (user, Gate A). About 23 lines.
  - Verify: on web, Expenses, then Next to December (no budget) shows the line and "Go to Budget". It opens the Budget
    tab on December. Then go back to Expenses, pick January, and press Go to Budget again: the already-mounted Budget
    tab moves to January.

- [ ] 5. Ask for a budget before saving an expense into a month with none
  - Files: `apps/mobile/src/app/expense.tsx`.
  - Change:
    - `const noBudget = list.status === 'ready' && list.categories.length === 0 ? `Set up ${monthName(month)}’s budget first.` : null`.
    - The Category group renders it as `accessibilityRole="alert"` text (the `styles.error` style) in place of the
      picker. `notInMonth` becomes `!noBudget && picker?.missing ? … : null`, so a preselected category doesn't add
      "That category isn’t in November."
    - The announce effect covers `noBudget ?? notInMonth`.
    - `save()` checks `noBudget` first: if set, it announces and returns, before the name/amount check.
    - The default category needs no change (Approach). About 25 lines.
  - Verify: AC row 4 (form).

## AC → evidence

QA setup (local dev DB, QA ledger only): `yarn api create-user --username claude-qa-035 --email claude-qa-035@example.test`.
Its October has the 15 defaults, and every other month is empty. For the ended-month check, add an August list to that
ledger only:

```sql
INSERT INTO category_months (category_id, list_month) SELECT category_id, '2026-08-01' FROM categories WHERE ledger_id = <qa>
```

The running API must be this checkout's (≥ 9f53fac). Check with `lsof -iTCP:3000 -sTCP:LISTEN` and the process's cwd.
Delete the QA user and ledger after the PR.

| AC                                                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Web: November empty screen; Copy fills it with October's list       | Web 390×844 (slice 3): Budget → Next → "No budget for November yet" and "Copy October’s categories". Press it: the 15 rows appear in October's order and the button doesn't flash back.                                                                                                                                                                                                                                                                                                                                                                                           |
| 2. Copy hidden without a previous list; the three 409s handled         | `monthCopy.test.ts` (all three codes plus unknown). Web: December shows no Copy while November is empty, and shows "Copy November’s categories" once November is copied, and pressing it fills December with November's list. `budget_exists`: open December in two browser tabs, copy in one, press in the other: the list appears. `month_ended` needs a month to end with the tab open, and `no_previous_budget` needs every category removed from the previous month after the tab loaded (possible but laborious), so the unit test covers both and the code path is shared. |
| 3. Ended month's Budget tab has no buttons                             | Web, with the QA August seed: September (ended, no budget, previous has a list) shows the line with no Copy. August (ended, with a list) shows rows only.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4. Expenses links to Budget; the form shows the message and won't save | Expenses link: slice 4's check. Form: Add expense, then pick a September date (the picker caps at today, so September stands in for November until 1 Nov). It shows "Set up September’s budget first." in place of the categories. Type a name and amount and press Add: no POST in the network panel, the message is announced, and Expenses → September stays empty. Back to an October date: the picker returns with the default category selected.                                                                                                                            |
| 5. iPhone (Expo Go): empty screen and copy                             | The user, on iPhone: Budget → December (or November if not yet copied) → Copy. The rows appear, and the Expenses tab's "Go to Budget" lands on that month.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 6. Gates green                                                         | `yarn format:check && yarn lint && yarn typecheck && yarn test` on every slice, recorded in the PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Not doing (YAGNI)

- Planned amounts, totals, row taps and editors (036), rename (037), Add a category (038), progress (034).
- A categories-only data hook for the Budget tab (Approach). It loads the month's expenses unused until 034.
- Persisting the Budget tab's month anywhere but the route param, or syncing it with the Expenses tab's month.
- A new API error code or client-side "has budget" endpoint. The empty list is the signal (033's decision).
- Updating conventions §3 with "nothing carries over". 033 left that as a proposal; nothing in §3 is made stale here.

## Risks

- **Tab params on an already-mounted tab.** `router.setParams` and `router.navigate` with params must update the
  Budget tab's `useLocalSearchParams` on web and iOS (expo-router 57.0.26 exports both; see
  `build/global-state/router.d.ts`). Slice 2 proves `setParams` on web, and slice 4 proves `navigate` into a mounted
  tab. The user's iPhone check covers native. If it fails, fall back to `useState`, seeded from the param and re-seeded
  by a param tag compared in render (no effect). That's about 10 more lines.
- **Home's Budget card navigates to `/budget` without a month.** The tab may keep the last month or reset to the
  current one, and either is acceptable. Slice 2 notes which.
- **Time: from 2026-10-31 an expense can be dated 1 November.** If this PR isn't merged and deployed by then, run
  `POST /api/ledgers/:id/months/2026-11/copy` once per ledger (033's Gate A decision). Slice 5 is independent of 3.
  Slice 4 uses `NoBudget`'s `action` prop from slice 3. If slice 3 is late, move `action` into slice 2 (≈10 lines).
- **`month_ended` on a long-lived tab.** `thisMonth` is read once at mount, so an iOS Budget tab left open across a
  month's end still offers Copy for the month that just ended. The server's `409 month_ended` is then handled by slice
  3 (message, Copy hidden for that month).
- **The web check against the wrong API.** Same guard as 033 (AC setup above).

## Open questions

- No — the Expenses tab's button label isn't in the brief. Assumed: "Go to Budget".
- Decided (user, Gate A, 2026-10-17): the Expenses tab's link is hidden for an ended month with no budget; it shows
  only "No budget for August yet".
- No — an ended month keeps the wording "No budget for September yet". Assumed: the brief's one line everywhere.
- No — Budget rows aren't pressable in this part. Assumed: 036 adds the tap that sets an amount.

## Follow-ups

- Size is about 405 changed lines, which sits at the limit. If it needs cutting, `copyRefusedText` and its test could
  be inlined into the screen (−30 lines), but AC 2 would then lose its only automated evidence.
- 033's follow-ups stand: conventions §3 "nothing carries over", and `linkParams.ts`'s `MONTH_RE` accepting `9999-12`.

## Deviations

<filled by the developer during build>

## Revision 1 (skeptic, approve with edits)

- Slice 3 Files add `data/useMonthCategories.ts` (JSDoc) and `data/useMonth.ts`, which exports `MonthData` for
  `copiedOver`'s type. I chose the export over a `ReturnType` expression because it's clearer.
- Slice 3's Press contract: `inFlight` reset and busy off in `finally`; `ended` is `month < thisMonth`.
- Risks: slice 4 depends on slice 3's `action` prop (fallback: move it into slice 2). New risk: `month_ended` on a
  long-lived tab.
- Suggestions taken:
  - slice 4 says the "Categories / spent" head stays;
  - AC 2 adds the December-from-November copy check;
  - AC 2's `no_previous_budget` wording is softened.

# Plan: Expense screen data hooks

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/expense-data-hooks
Base: origin/main after brief 007 merges (007 = `docs/features/007-expense-form-components`, from c813684)

## Approach

All changes are in `apps/mobile`. Every slice below was built in order on a scratch copy of Base plus 007's three moves,
and measured there. Each slice passed `prettier --check`, `tsc --noEmit` and `eslint --max-warnings 0` with the repo's
configs. The API is untouched, so `yarn test` is unaffected.

- **Reads move into two hooks.**
  - `data/useExpenseDraft.ts` loads categories, the quick ids and (when editing) the expense in parallel, with a `live`
    guard and `reload`. A since-hidden category is known only by its id, as a stand-in in `categoryById`. It is never in
    `categories`, so no string sentinel is needed.
  - `data/useRate.ts` loads the NBU rate for a date and returns `rateDate`.
  - Both tag their result with the request (`key` / `date`), so a new request reads as `loading`. That avoids a
    synchronous `setState` in the effect, which `react-hooks/set-state-in-effect` (an error in this config) would reject.
    Neither hook needs an `eslint-disable`.
- **Writes move too.** AC1 says `expense.tsx` has no `api(` calls, so POST, PUT and DELETE go to `data/expenses.ts`.
- **The form mounts after the draft loads.** The screen becomes `ExpenseScreen` (loading, error, header) plus a
  module-level `ExpenseForm`. The form seeds its `useState`s from the loaded draft, so no effect copies data into state,
  and Retry remounts the form fresh.
- **Load once per open, not on focus.** `useMonth` reloads on focus because its lists change behind it. Here the draft
  seeds editable state, so a focus reload would remount the form and drop what was typed. The screen is a modal that
  mounts fresh on every open, and nothing is pushed on top of it (`CategorySheet` and the date picker are modals, not
  routes). `useRate` re-runs whenever `date` changes.
- **Line target.** Measured `expense.tsx`:

  | State                                                    | Lines |
  | -------------------------------------------------------- | ----- |
  | origin/main c813684                                      | 467   |
  | Hooks + writes moved, no extraction (separate draft)     | 451   |
  | Base of this plan (after brief 007's moves)              | 340   |
  | After slices 1–3 (rate hook, writes, draft + form split) | 302   |
  | After slices 4–7 (Retry view, saved name, codes, a11y)   | 317   |
  | Probe: also extracting the "Added" note (not planned)    | 302   |

Alternatives considered:

- **Seed the form inside one component**, by setting state during render when the draft arrives. It would save the
  `ExpenseForm` split. But it is the pattern `react-hooks/set-state-in-render` exists to catch, and it is harder to read.
- **Keep the writes inline** and read AC1 as "reads only". That contradicts AC1's literal "no `api(` calls".

## Contracts

- DB: none. API: none. The endpoints used are unchanged:
  - `GET /api/ledgers/:id/categories` → `{ categories, quickCategoryIds }`
  - `GET /api/ledgers/:id/expenses/:expenseId` → `Expense`. A deleted expense gives `404 not_found`
    (`apps/api/test/expenses.int.test.ts:161`); a malformed id gives `400 invalid_request`.
  - `POST /api/ledgers/:id/expenses` (201) and `PUT /api/ledgers/:id/expenses/:expenseId` → `Expense`
  - `DELETE /api/ledgers/:id/expenses/:expenseId` → 204
  - `GET /api/rates/eur-uah?date=` → `{ date, rateDate, eurUah }`, or `503 rate_unavailable` with a `reason`
  - Any other error: `500 internal`
- `apps/mobile/src/api/types.ts` gains `EurUahRate`. `Currency` already exists, from brief 007.
  ```ts
  export interface EurUahRate {
    date: string; // asked for
    rateDate: string; // the NBU's date; earlier than `date` when the API fell back
    eurUah: number; // 1 EUR in UAH, 4 decimals
  }
  ```
- `apps/mobile/src/data/useRate.ts`:
  ```ts
  export type Rate =
    { status: 'loading' } | { status: 'ok'; eurUah: number; rateDate: string } | { status: 'unavailable' };
  /** The NBU EUR→UAH rate for a Kyiv date; `rateDate` is an earlier day when the API fell back to one. */
  export function useRate(date: string): Rate;
  // State { date, rate } | null; returns the stored rate only when its date === `date`, else a module-level LOADING.
  // Any failure (503, network) → 'unavailable'.
  ```
- `apps/mobile/src/data/useExpenseDraft.ts`:
  ```ts
  /** Puts `id` in the quick row, taking the last spot when it isn't there yet. */
  export function withQuick(quick: number[], id: number): number[]; // moved from the screen with QUICK_COUNT = 5
  export interface ExpenseDraftData {
    categories: Category[]; // active ones, as the API lists them
    quickIds: number[]; // quick row, already holding categoryId
    categoryId: number | null; // expense's ?? the categoryId param ?? first quick id ?? null
    expense: Expense | null; // the saved expense when editing
    categoryById: Map<number, Category>; // categories + a stand-in for the expense's since-hidden category
  }
  export type ExpenseDraft = { reload: () => void } & (
    { status: 'loading' } | { status: 'error'; error: unknown } | ({ status: 'ready' } & ExpenseDraftData)
  );
  export function useExpenseDraft(ledgerId: number, expenseId: number | null, categoryId: number | null): ExpenseDraft;
  ```
  - **The expense is fetched whenever `expenseId !== null`**, not on truthiness. The screen keeps parsing
    `params.expenseId ? Number(params.expenseId) : null`, so `?expenseId=abc` → `NaN` → `GET …/expenses/NaN` →
    `400 invalid_request`. The header title also uses `expenseId !== null`.
  - The request key is `${ledgerId}/${expenseId}/${categoryId}/${version}`, and `reload` bumps `version`.
  - Both GETs run in parallel (`Promise.all`); the first failure becomes `error`.
  - The stand-in is `{ categoryId, techName: '', displayName: 'hidden category', sortOrder: 0 }`. Its `techName` only
    picks the tile hue; nothing compares it.
- `apps/mobile/src/data/expenses.ts`:
  ```ts
  /** The POST/PUT body: only the entered side; the API prices the other at the date's NBU rate. */
  export interface ExpenseInput {
    categoryId: number;
    expenseDate: string;
    name: string;
    amount: string;
    currency: Currency;
  }
  /** Adds an expense, or replaces expense `expenseId` when given; resolves to the saved, re-priced expense. */
  export function saveExpense(ledgerId: number, expenseId: number | null, input: ExpenseInput): Promise<Expense>;
  /** Soft-deletes an expense, so it can still be restored (Undo). */
  export function deleteExpense(ledgerId: number, expenseId: number): Promise<void>;
  ```
- `apps/mobile/src/app/expense.tsx` after slice 7 (it uses brief 007's `AmountFields`, `CategoryPicker` and `DateChips`
  unchanged):
  - **`ExpenseScreen`** renders by draft status:
    - `error`: no header. It shows the message `errorText(error, 'load')`, then **Retry** unless the code is
      `not_found` (`accessibilityRole="button"`, calls `reload`). Then **Back** (`accessibilityRole="button"`,
      `router.canGoBack() ? router.back() : router.replace('/')`, as in `category/[categoryId].tsx:65`).
    - Otherwise: the header (title `editingId !== null ? 'Edit expense' : 'New expense'`), then a spinner while
      `loading`, or `<ExpenseForm draft={draft} ledgerId={…} />` once ready.
  - **`ExpenseForm({ draft, ledgerId }: { draft: ExpenseDraftData; ledgerId: number })`** is module-level, not nested
    (`react-hooks/static-components`).
    - It reads `today` once, seeds quick / category / date / name / entered / amountText / storedOther from the draft,
      and calls `useRate(date)`.
    - `pickCategory(c)` does `setQuick(withQuick)`, `setCategoryId` and `setError(null)`; it is unchanged from 007, with
      `withQuick` now imported.
    - Save calls `saveExpense(ledgerId, expense?.expenseId ?? null, body)`, with the body unchanged.
    - Delete calls `confirmDelete(expense.name || 'this expense')`, then `deleteExpense`, then
      `setPendingUndo({ …, label: expense.name || 'Expense' })`.
    - The primary button gets `accessibilityLabel={expense ? 'Update' : 'Add'}` and `accessibilityState={{ busy }}`.
      `disabled={busy}` already reports disabled (compare `login.tsx:102`).
  - **`function errorText(err: unknown, doing: 'load' | 'save'): string`**, kept in the screen per the brief's Notes:

    | Code               | Text                                                                        |
    | ------------------ | --------------------------------------------------------------------------- |
    | `not_found`        | This expense was deleted. (was "…deleted meanwhile." on save; one text now) |
    | `rate_unavailable` | unchanged                                                                   |
    | `date_in_future`   | unchanged                                                                   |
    | `unknown_category` | unchanged                                                                   |
    | `invalid_request`  | load: That link isn’t valid. / save: Check the amount and date. (audit M11) |
    | `internal`         | Something went wrong on the server. Try again. (audit M11)                  |
    | anything else      | Couldn’t load / save. Check your connection and try again.                  |

  - **`function rateLabel(rate: Rate, date: string): string`**:
    - loading: `Fetching the NBU rate…`
    - unavailable: unchanged text
    - ok: `` `1 € = ₴${eurUah.toFixed(4)} · NBU official rate for ${shortDate(rateDate)}` ``, plus
      `` ` (the latest before ${shortDate(date)})` `` when `rateDate !== date`
  - The other field is `storedOther ?? otherAmountText(amountText, entered, rate.status === 'ok' ? rate.eurUah : null)`.
- New dependencies: none.

## Slices

Sizes are `git show --stat` on the scratch build (insertions + deletions). **PR size: ≈473 changed lines raw, ≈357
ignoring whitespace.** About 116 of the raw lines are re-indentation in slice 3. The split into briefs 007 and 004 was
decided at Gate A.

- [x] 1. Show the rate's own date and four decimals on the expense screen
  - Files: `data/useRate.ts` (new), `api/types.ts` (`EurUahRate`), `app/expense.tsx`
  - Change: replace the rate effect and `rate` state with `useRate(date)`, and the inline label with `rateLabel`.
  - Verify:
    - Procedure R below.
    - Then the stale-rate check, with `'GET eur-uah': { delay: 3000 }`. Type 100 in UAH and tap Yesterday. Right after
      the tap, the label reads "Fetching the NBU rate…" and EUR is empty, not converted at today's rate. Then tap Today
      within 3 s. The label and EUR end on today's rate and stay there after the delayed Yesterday response lands.
  - 70 lines.
- [x] 2. Save and delete expenses through data/expenses.ts
  - Files: `data/expenses.ts` (new), `app/expense.tsx`
  - Change: the three `api(` writes become `saveExpense` / `deleteExpense`. Same requests, same bodies.
  - Verify: Add, Update and Delete still work. The browser's network log shows the same method, path and body keys as
    on Base.
  - 29 lines.
- [x] 3. Load the expense form through useExpenseDraft
  - Files: `data/useExpenseDraft.ts` (new), `app/expense.tsx`
  - Change, and nothing beyond these Contracts items:
    - The load effect, `categories`, `loadFailed`, the `byId` memo and `withQuick` leave the screen.
    - The `ExpenseScreen` / `ExpenseForm` split, including the `editingId !== null` title.
    - The hidden category is kept by id, and `moreCats` is `draft.categories` minus the quick row.
    - The error view keeps Base's text and Back for now.
  - Commit body: "Mostly re-indentation (the form leaves the loading ternary); read with `git show -w`."
  - Verify:
    - `rg -n "api\(|useEffect|'hidden'" apps/mobile/src/app/expense.tsx` finds nothing.
    - Procedures H and U below.
    - Add and Edit still load and save.
  - 341 lines raw, 225 ignoring whitespace. Splitting further would need a throwaway intermediate load effect (see
    Risks).
- [x] 4. Offer Retry and say when the edited expense was deleted
  - Files: `app/expense.tsx`
  - Change: the `errorText(err, doing)` signature and the `not_found` text; the error view as in Contracts (message,
    Retry unless `not_found`, Back with a role and `canGoBack`).
  - Verify:
    - Procedures A (API stopped, then Retry) and D (deleted id).
    - With `'GET categories': { status: 500, body: { error: 'internal' } }`, the view offers Retry. After
      `window.__stub = {}`, Retry loads the form.
  - About 24 lines (28 measured together with slice 5).
- [x] 5. Use the expense's saved name for the delete prompt and Undo
  - Files: `app/expense.tsx`
  - Change: `confirmDelete(expense.name || 'this expense')` and `label: expense.name || 'Expense'` replace the edited
    `name || …`.
  - Verify: edit an expense saved as "Coffee", type "Tea" in the name and delete. With procedure S,
    `window.__asked` is `Delete “Coffee”?`, and the Category screen's Undo bar says `Deleted “Coffee”`.
  - About 4 lines.
- [x] 6. Map internal and invalid_request errors on the expense screen
  - Files: `app/expense.tsx`
  - Change: the two `errorText` rows in Contracts.
  - Verify:
    - `'POST expenses': { status: 500, body: { error: 'internal' } }`, then Add, shows "Something went wrong on the
      server. Try again."
    - The same rule with `invalid_request` shows "Check the amount and date."
    - Opening `/expense?expenseId=abc` shows "That link isn’t valid." (a real 400 from the API).
  - 3 lines.
- [ ] 7. Give the busy Add/Update button an accessible name and busy state
  - Files: `app/expense.tsx`
  - Change: `accessibilityLabel` and `accessibilityState={{ busy }}` on the primary `Pressable`.
  - Verify:
    - With `'POST expenses': { delay: 3000 }`, fill the form and tap Add.
    - Within 3 s, `document.querySelector('[role="button"][aria-label="Add"]')?.getAttribute('aria-disabled')` is
      `'true'`, and the accessibility snapshot shows a button named "Add".
    - On Base the button has no `aria-label`, and its only child is the spinner.
    - On the iPhone (Expo Go, VoiceOver), the button reads "Add" and "busy" while saving
      (`RCTViewComponentView.mm:1550` adds "busy" to the value).
  - 2 lines.

### In-app browser procedures (launch configs `api` + `web`, sign in, resize to 390×844)

**Procedure S, the request stub.** Evaluate it once per page load; a reload removes it. Rules are keyed
`'METHOD path-suffix'`. The snippet was checked in Node against a fake `fetch`.

```js
(() => {
  const realFetch = window.fetch;
  window.__stub = {}; // 'METHOD path-suffix' → { delay?: ms, status?: n, body?: {}, map?: (body) => body }
  window.confirm = (q) => ((window.__asked = q), true); // web confirmDelete uses window.confirm
  window.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const rule = Object.entries(window.__stub).find(([k]) => {
      const [method, suffix] = k.split(' ');
      return (init.method ?? 'GET') === method && u.pathname.endsWith(suffix);
    })?.[1];
    if (rule?.delay) await new Promise((r) => setTimeout(r, rule.delay));
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (rule?.status) return json(rule.body ?? {}, rule.status);
    if (!rule?.map) return realFetch(url, init);
    const res = await realFetch(url, init);
    return json(rule.map(await res.json()), res.status);
  };
})();
```

**Procedure R, rate fallback (AC5).** Set the rule:

```js
window.__stub = {
  'GET eur-uah': {
    map: (b) => {
      const d = new Date(`${b.date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 2);
      return { ...b, rateDate: d.toISOString().slice(0, 10), eurUah: 48.5 };
    },
  },
};
```

- Open Add expense. The label reads `1 € = ₴48.5000 · NBU official rate for <today−2> (the latest before <today>)`.
- Reload the page, without the stub. The label reads `1 € = ₴<real, 4 decimals> · NBU official rate for <today>`, with
  no suffix unless the real API fell back.

**Procedure H, since-hidden category (AC4).**

1. On Home, open a category and note its id from the URL (`/category/<id>`). Then set the rule:
   ```js
   window.__stub = {
     'GET categories': {
       map: (b) => {
         const hide = /* <id> */ 0;
         b.categories = b.categories.filter((c) => c.categoryId !== hide);
         b.quickCategoryIds = b.quickCategoryIds.filter((id) => id !== hide);
         const extra = b.categories.find((c) => !b.quickCategoryIds.includes(c.categoryId));
         extra.techName = 'hidden'; // a real category with that tech name must stay listed
         window.__renamed = extra.displayName;
         return b;
       },
     },
   };
   ```
2. Tap one of its expenses. The quick row's last tile is "hidden category", and it is selected.
3. Open "N more". The sheet lists `window.__renamed`, and no "hidden category".
4. On Base, the same steps show a "N more" count one lower, and `__renamed` is missing.

**Procedure A, API stopped then Retry (AC2).**

1. Stop the `api` launch config and tap Add expense. The screen shows "Couldn’t load. Check your connection and try
   again.", Retry and Back.
2. Start `api` again and tap Retry. The form appears, and the URL is still `/expense`.

**Procedure D, deleted expense (AC3).**

1. Open an expense from a category and note `expenseId` from the URL.
2. Delete it (the Undo bar shows), then load `http://localhost:8081/expense?expenseId=<id>`.
3. The screen shows "This expense was deleted." and Back, with no Retry. Back goes to Home, because `canGoBack()` is
   false on a direct load.
4. Repeat with client-side history. On the category screen, delete another listed expense behind the UI's back, then
   tap that row. Back returns to the category. The delete (with `ledgerId` from `GET /api/ledgers`):
   ```js
   fetch(`http://localhost:3000/api/ledgers/${ledgerId}/expenses/${expenseId}`, {
     method: 'DELETE',
     credentials: 'include',
   });
   ```

**Procedure U, unmount during load (AC6).**

1. With `'GET categories': { delay: 3000 }`, tap Add expense and press Cancel within 3 s.
2. Wait 4 s and read the console messages: there are no warnings or errors.
3. Repeat with `'GET eur-uah': { delay: 3000 }`, cancelling once the form shows.

**iPhone (Expo Go) checks**, recorded in the PR test plan:

- Add and Edit load.
- Stop `yarn api dev` and open Add: the error and Retry show. Start it again and tap Retry: the form loads.
- The rate label has 4 decimals.
- VoiceOver on the busy button (slice 7).
- The Undo label after deleting an expense whose name was edited (slice 5).

## AC → evidence

| AC                                                                                   | Evidence                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `api(` / fetching `useEffect` in `expense.tsx`; reads in 2 hooks                  | Slice 3: `rg -n "api\(\|useEffect" apps/mobile/src/app/expense.tsx` is empty; the screen's reads are in `useExpenseDraft.ts` / `useRate.ts`, writes in `expenses.ts` |
| API stopped → error + Retry; Retry loads in place (web)                              | Procedure A (slice 4); iPhone repeat                                                                                                                                 |
| `/expense?expenseId=<deleted>` → "This expense was deleted" + Back                   | Procedure D (slice 4)                                                                                                                                                |
| Hidden category selected, not in "more"; real `hidden` tech name stays               | Procedure H (slice 3); code review: `rg -n "'hidden'" apps/mobile/src` finds no comparison                                                                           |
| Fallback day named; rate has 4 decimals                                              | Procedure R (slice 1)                                                                                                                                                |
| Leaving during load → no React state-update warning                                  | Procedure U (slices 1 and 3); `live` guards in both hooks; stale-rate check (slice 1)                                                                                |
| Screen reader: busy button announces "Add"                                           | Slice 7: `aria-label="Add"` + `aria-disabled` on web; VoiceOver "Add … busy" on the iPhone                                                                           |
| `expense.tsx` ≤ ~320 lines; lint/typecheck green; iOS + web recorded                 | `wc -l` = 317 on the scratch build; all four gates on every commit; the PR test plan lists the web procedures and the iPhone checks                                  |
| (What) Undo uses the saved name; Back has a role; `internal`/`invalid_request` texts | Checks for slices 5, 4 and 6                                                                                                                                         |

## Not doing (YAGNI)

- The shared `LoadError` component, Home and Category retries, and the Category screen's inline `restore` call
  (brief 005, audit M5/M6).
- Reload on focus for either hook; Approach says why.
- Extracting the "Added" note, the error view or anything else (see Open questions).
- Prefetching the rate in parallel with the draft. The rate request now starts after the draft loads. That costs one
  extra round trip before the label settles, on a modal that opens in well under a second on LAN.
- `aria-busy` / `aria-selected` for web (see Open questions, Follow-ups).
- Retyping `Expense.enteredCurrency` or `format.ts`'s parameters with `Currency`; no AC needs it.
- Hiding Retry for other 4xx codes, or making the header Cancel use `canGoBack` (see Follow-ups).

## Risks

- **React 19 never prints the old "state update on an unmounted component" warning**; React 18 removed it. So
  procedure U can't fail on its own. The real evidence for AC6 is the `live` guards (code review) plus slice 1's
  stale-rate check, which does fail without the `date` tag.
- **Slice 3 is over ~150 lines** (341 raw, 225 ignoring whitespace). The alternative is an intermediate slice where the
  screen's own effect seeds `ExpenseForm`, followed by moving that effect into the hook. That adds about 30 lines of
  churn, and each step would still be about 150 lines ignoring whitespace, so it stays one slice. The commit body points
  the reviewer to `git show -w`.
- **react-native-web 0.21 doesn't render `accessibilityState`**: `createDOMProps` has no handling for it. On web the
  button exposes its name and `aria-disabled` but not busy; busy is checked on the iPhone. Slice 7 proves the web half.
- **The stand-in tile's hue changes**, because its `techName` is `''` instead of `'hidden'`. It is cosmetic; procedure
  H shows it.

## Open questions

- Blocking: no. **317 lines vs. the target.** The AC now reads "≤ ~320". If a strict ≤ 300 is wanted later, extracting
  the "Added" note measured 302 lines, with +46 changed lines.
- Blocking: no. **AC1 includes writes.** Assumption: "no `api(` calls" means none at all, so slice 2 adds
  `data/expenses.ts`.
- Blocking: no. **The delete prompt also uses the saved name**, with fallbacks. The brief names only the Undo toast.
  Assumption: the prompt and the toast name the same thing.
- Blocking: no. **Wording.**
  - `internal` and save-time `invalid_request` use the audit's M11 texts.
  - Load-time `invalid_request` comes only from a malformed `expenseId`, and says "That link isn’t valid."
  - Save-time `not_found` loses "meanwhile".
  - Retry is hidden only for `not_found`.
- Blocking: no. **`accessibilityState={{ busy }}` vs. `aria-busy={busy}`.** The brief and `login.tsx` use
  `accessibilityState`, which iOS reads but web ignores. RN 0.86's `Pressable` also accepts `aria-busy` and folds it
  into `accessibilityState.busy` (`Pressable.js:228`), and web would render that too. Assumption: follow the brief.

## Follow-ups

- The header Cancel still calls `router.back()`. After a direct web load of `/expense` there is nothing to go back to;
  it should use the same `canGoBack()` fallback.
- On web, `accessibilityState` (selected, busy) renders nothing; plan 003 noted this first. `aria-*` props would fix it
  app-wide.
- Audit M12 (`{editingId && …}` on a number) disappears from `expense.tsx` as a side effect: the form branches on
  `expense`, and the title on `editingId !== null`. Brief 006 can drop that part.
- `useMonth` could use the same request-key tagging instead of its `exhaustive-deps` suppression (audit M7, brief 005).

## Deviations

None.

## Revision 1

Changes made at Gate A (2026-10-07), after the skeptic's APPROVE WITH EDITS and the user's decision:

- **Split into two briefs.** The component moves (old slices 1–3) moved to brief 007
  (`docs/features/007-expense-form-components`), which ships first. This plan keeps old slices 4–10, renumbered 1–7.
  - Base is now origin/main after 007 merges, on branch `chore/expense-data-hooks`.
  - The stacked-PR open question is removed.
  - The brief's line AC is relaxed to ≤ ~320.
- **The skeptic's required edit.** Contracts now say the expense is fetched whenever `expenseId !== null`, that
  `?expenseId=abc` yields a `400 invalid_request`, and that the header title uses `expenseId !== null`.
- **Suggestions adopted:**
  - the delete prompt and Undo label keep the fallbacks `'this expense'` / `'Expense'`;
  - the stale-rate check also asserts "Fetching the NBU rate…" and an unconverted (empty) EUR right after tapping
    Yesterday;
  - slice 3's commit body points the reviewer to `git show -w`, and the slice holds nothing beyond Contracts;
  - `Expense.enteredCurrency` is no longer retyped, and `Currency` now lands in 007 with `AmountFields`;
  - the PR's raw and whitespace-ignoring line counts are stated in the Slices section.
- **Re-measured on the scratch build after these edits:** `expense.tsx` is still 317 lines, and tsc and eslint are
  green.

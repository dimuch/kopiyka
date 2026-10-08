# Plan: Load errors with retry, and a reliable Undo

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/load-errors-retry-and-undo
Base: origin/main@edeaffd

## Approach

All changes are in `apps/mobile`. The API is untouched, so `yarn test` is unaffected. Audit items: M5–M8 and M15
(`docs/audits/2026-10-architecture.md`).

- **`useMonth` uses the request tagging that `useRate` and `useExpenseDraft` already use.**
  - Data is tagged with `ledgerId/month/categoryId`. When the tag doesn't match, `data` is `null`, so the screen shows
    the spinner, not last month's numbers.
  - A refetch for the same tag (on focus, or Retry) keeps the data on screen.
  - The error is tagged with the attempt (the tag plus a `version`). Retry is a new attempt, so it clears the error at
    once. A successful load clears it too.
  - Because `version` is now used inside the callback, the `exhaustive-deps` suppression goes. I checked this by
    feeding the candidate hook below to `eslint --stdin` with the repo config: 0 problems. The current file without
    its suppression gets the `unnecessary dependency: 'version'` warning.
- **One `components/LoadError.tsx`** shows the message and an optional Retry. The message has `accessibilityRole="alert"`
  (web) and is announced on iOS when it mounts. Home and Category use it in two places:
  - as the whole body when nothing has loaded yet;
  - inline above the data when a refetch fails.
  - Expense uses it in its error view, which now keeps the form's header and safe-area edges (004 follow-up).
- **Undo** moves its request to `data/expenses.ts` as `restoreExpense`, next to save and delete. The toast becomes a
  small state machine: offer → restoring → failed → restoring… It closes only on success or after 10 s. The 10 s don't
  run while a request is in flight.
- **iOS announcements** call `AccessibilityInfo.announceForAccessibility` directly. It is a no-op on web
  (react-native-web 0.21), so no `Platform` branch is needed. They run where the message appears:
  - in the event (toast offered, undo failed, save failed, expense added);
  - in `LoadError`'s mount effect, which has no event.

Alternatives considered:

- **Keep `version` and reset `data`/`error` when a load starts.** That would be a synchronous `setState` in the focus
  callback. It is the pattern 004 avoided, and it would also blank the data on every focus refetch, which AC3 forbids.
- **A `useAnnounce(text)` hook.** It is no smaller than four direct calls, and it re-announces only when the text
  changes. A second "Couldn’t undo" would then be silent.

## Contracts

- DB: none. API: none. The endpoints used are unchanged:
  - `GET /api/ledgers/:id/categories` → `{ categories, quickCategoryIds }`
  - `GET /api/ledgers/:id/expenses?month=YYYY-MM[&categoryId=n]` → `{ expenses }`
  - `POST /api/ledgers/:id/expenses/:expenseId/restore` → `Expense`. It gives `404 not_found` when the expense isn't
    deleted, which includes one that was already restored (`apps/api/src/expenses/routes.ts:189-211`).
- `apps/mobile/src/data/useMonth.ts`. The signature is unchanged, and so are its callers (Home, Category).
  ```ts
  /** … `data` is null until this month and category have loaded; a failed refetch keeps it and sets `error`. */
  export function useMonth(
    ledgerId: number,
    month: string,
    categoryId?: number,
  ): {
    data: MonthData | null; // only when tagged `${ledgerId}/${month}/${categoryId ?? ''}`
    error: boolean; // the current attempt (`${key}#${version}`) failed
    reload: () => void; // bumps version → new attempt
  };
  // State: loaded {key, data} | null; failed: attempt | null. On success: setLoaded + setFailed(null).
  // Callback deps [key, attempt, ledgerId, month, categoryId]; no eslint-disable.
  ```
- `apps/mobile/src/data/expenses.ts` gains:
  ```ts
  /** Brings back a soft-deleted expense (Undo). */
  export async function restoreExpense(ledgerId: number, expenseId: number): Promise<void>;
  ```
- `apps/mobile/src/components/LoadError.tsx` (new). Callers: Home, Category (load, refresh, not found) and Expense.
  ```ts
  /** A failed load: the message (announced to screen readers) and Retry, when trying again can help. */
  export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void });
  ```
  - The message `Text` has `accessibilityRole="alert"`.
  - `useEffect(() => AccessibilityInfo.announceForAccessibility(message), [message])`.
  - The Retry `Pressable` has `accessibilityRole="button"` and is at least 44pt tall.
  - Styles use `theme.ts` tokens only, with no raw hex (brief 006).
- Screens:
  - **Home.** No data: error → `LoadError` with the "load" text and `onRetry={reload}`, else the spinner. Data and
    error: an inline `LoadError` with the "refresh" text above the list.
  - **Category.**
    - `month = params.month ?? kyivMonth` (read once with `useState`).
    - No data: error → `LoadError` + Retry, else the spinner.
    - Data but no category in it → `LoadError message="Category not found."` with no Retry. Back is the header's
      existing back button. `AddExpenseButton` is hidden there: it would preselect a category that doesn't exist, and
      the save would fail with `unknown_category`.
    - Otherwise the list, with an inline `LoadError` at the top of the scroll content when `error`.
  - **Toast.** State is `{ undo: PendingUndo; status: 'offer' | 'restoring' | 'failed' } | null`.
    - Text: `Deleted “label”`, or `Couldn’t undo` once failed. Button: Undo / Retry, disabled while restoring.
    - The 10 s timer restarts on each status change and doesn't run while restoring.
    - On success: close the toast and `reload()`, as Base's `restore()` does; "the list shows it" (AC4) depends on it.
    - Updates after the `await` only apply to the toast they started from:
      `setToast((t) => (t?.undo === undo ? next : t))`. So a slow restore that settles after another delete can't
      close or overwrite the new toast.
  - **Expense.** One `SafeAreaView edges={['top','bottom']}` with the header in every state. Body: spinner, or
    `LoadError` (Retry unless `not_found`) followed by the existing Back, or the form. The header Cancel gets the same
    `canGoBack() ? back() : replace('/')` fallback, because it now shows on directly loaded error views too.
- Copy (non-blocking, see Open questions):

  | Where                     | Text                                                                |
  | ------------------------- | ------------------------------------------------------------------- |
  | Home load                 | "Couldn’t load this month. Check your connection and try again."    |
  | Category load             | "Couldn’t load this category. Check your connection and try again." |
  | Home and Category refresh | "Couldn’t refresh. Check your connection and try again."            |
  | Category, after load      | "Category not found."                                               |
  | Expense load              | `errorText(err, 'load')`, unchanged                                 |
  | Toast, after a failure    | "Couldn’t undo"                                                     |

- New dependencies: none.

## Slices

Sizes are estimates (insertions + deletions), not measured on a scratch build. Only `useMonth` was linted, through
`eslint --stdin`. **PR total ≈ 240 changed lines.**

- [x] 1. Show the spinner, not last month's totals, while a month loads
  - Files: `data/useMonth.ts`
  - Change: request and attempt tagging as in Contracts, and the suppression is removed. Screens are untouched. On a
    failed refetch they still show their old error text instead of the data, until slices 2–3.
  - Verify:
    - Procedure B.
    - `rg -n "eslint-disable" apps/mobile/src` is empty.
    - Home and Category still load, and an edit still shows after you return to the screen.
  - ≈35 lines.
- [x] 2. Offer Retry on Home and keep its data when a refresh fails
  - Files: `components/LoadError.tsx` (new), `app/index.tsx`
  - Change: add `LoadError`. Home takes `reload` and uses `LoadError` for the no-data and inline cases. The "pull back
    later" text goes.
  - Verify: procedures A and C, Home parts. `document.querySelector('[role="alert"]').textContent` is the message.
  - ≈60 lines.
- [x] 3. Offer Retry on Category and keep its expenses when a refresh fails
  - Files: `app/category/[categoryId].tsx`
  - Change: the no-data and inline `LoadError`, as in Contracts.
  - Verify: procedures A and C, Category parts.
  - ≈20 lines.
- [x] 4. Show "Category not found" and default Category to the current month
  - Files: `app/category/[categoryId].tsx`
  - Change: the params type becomes `month?: string`, with `useState(() => kyivMonth(new Date()))` as the fallback.
    Data without the category shows the not-found `LoadError`, and `AddExpenseButton` is hidden then (`data !== null
&& !category`).
  - Verify: procedure E; on `/category/999` there is no "Add expense" button.
  - ≈15 lines (+3 for hiding the button).
- [ ] 5. Use the shared load error on the expense screen, with its header
  - Files: `app/expense.tsx`
  - Change: a single return as in Contracts. Cancel uses the `canGoBack` fallback. The error body is `LoadError` plus
    Back, and the now-unused `retryText` style is dropped.
  - Commit body: "Mostly re-indentation; read with `git show -w`."
  - Verify:
    - Procedure A, Expense part.
    - 004's procedure D, `/expense?expenseId=<deleted>`: "This expense was deleted.", no Retry, Back → Home. Cancel →
      Home too.
    - The header shows on the error view.
  - ≈40 lines.
- [ ] 6. Keep the Undo toast until the restore succeeds, with Retry on failure
  - Files: `data/expenses.ts`, `app/category/[categoryId].tsx`
  - Change:
    - Add `restoreExpense`, so the screen no longer imports `api`.
    - The toast state machine from Contracts, including `reload()` on success and the guarded updates after `await`.
    - `announceForAccessibility` when the toast is offered (`Deleted “label”`) and on each failure (`Couldn’t undo`).
  - Verify: procedure D. iPhone checks 1–2.
  - ≈55 lines.
- [ ] 7. Announce save errors and the "Added" note to VoiceOver
  - Files: `app/expense.tsx`
  - Change: a local `showError(text)` that sets the error and announces it replaces the three `setError(<text>)`
    calls (validation, save, delete). `announceForAccessibility(added)` runs after `setAdded`.
  - Verify: on web, behaviour is unchanged (save with an empty name shows the error). iPhone checks 3–4.
  - ≈15 lines.

### In-app browser procedures (launch configs `api` + `web`, sign in, resize to 390×844)

A direct page load with the API down signs you out (`AuthContext` can't reach `/api/ledgers`). So API-down checks
navigate inside the app, without reloading the page.

**Procedure S, the request stub.** This is 004's stub, plus `fail`, which throws what `fetch` throws when the API is
down. Evaluate it once per page load. Rules are keyed `'METHOD path-suffix'`, and the suffix is matched against the
pathname. I checked the snippet in Node against a fake `fetch`:

- `fail` throws `TypeError`;
- `delay` waits;
- `status` returns that body;
- other requests pass through.

```js
(() => {
  const realFetch = window.fetch;
  window.__stub = {}; // 'METHOD path-suffix' → { delay?: ms, fail?: true, status?: n, body?: {} }
  window.confirm = (q) => ((window.__asked = q), true); // web confirmDelete uses window.confirm
  window.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const rule = Object.entries(window.__stub).find(([k]) => {
      const [method, suffix] = k.split(' ');
      return (init.method ?? 'GET') === method && u.pathname.endsWith(suffix);
    })?.[1];
    if (rule?.delay) await new Promise((r) => setTimeout(r, rule.delay));
    if (rule?.fail) throw new TypeError('Failed to fetch'); // what fetch throws when the API is down
    if (rule?.status) {
      return new Response(JSON.stringify(rule.body ?? {}), {
        status: rule.status,
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(url, init);
  };
})();
```

**Procedure A, API stopped then Retry (AC1).** Start each case on Home, with data loaded.

1. **Home.** Stop `api`, then tap Previous month. The list area shows the "load" message and Retry; the page doesn't
   reload. Start `api` and tap Retry: September's categories appear in place, and the URL is unchanged.
2. **Category.** Stop `api` and tap a category row. The body shows the "load" message and Retry, under the "‹ October"
   header. Start `api` and tap Retry: the expenses appear.
3. **Expense.** Stop `api` and tap Add expense. The screen shows the header (Cancel, "New expense"), then "Couldn’t
   load. Check your connection and try again.", Retry and Back. Start `api` and tap Retry: the form appears.

**Procedure B, slow month switch (AC2).**

1. On Home in October, with data, set `window.__stub = { 'GET expenses': { delay: 3000 } }`.
2. Tap Previous month. Within 3 s the month reads "September", the list area shows the spinner, and no October rows
   show. After 3 s, September's rows appear.
3. Tap Previous, then Next, within 3 s. It ends on October's rows, and they stay after the delayed September response
   lands.
4. Base shows October's rows under "September" for the 3 s.
5. The total card reads €0.00 while loading, as it does on first load today (see Follow-ups).

**Procedure C, refetch failure with data on screen (AC3).**

1. **Home.** With October loaded, set `window.__stub = { 'GET expenses': { fail: true } }`. Open a category (it shows
   its load error), then tap "‹ October".
   - Home's rows stay visible, and the inline "Couldn’t refresh…" block with Retry sits above them.
   - Tap Retry while the stub is still set: the block disappears at once and comes back when the attempt fails.
   - Set `window.__stub = {}` and tap Retry: the block goes, and the rows stay.
2. **Category.** Open a category with expenses and set the same stub. Tap an expense, then Cancel: the expenses stay,
   with the inline block at the top. Clear the stub and tap Retry.
3. Repeat step 1 once by stopping `api` instead of using the stub (the AC's wording).

**Procedure D, failed restore then Retry (AC4).** This uses the stub because the toast lasts only 10 s. `fail` throws
the same error as a stopped API.

1. Open a category, tap an expense, and Delete it. The toast reads `Deleted “<name>”`, and the expense is gone from the
   list.
2. Set `window.__stub = { 'POST restore': { fail: true } }` and tap Undo. The toast reads "Couldn’t undo", and its
   button reads Retry.
3. Set `window.__stub = {}` and tap Retry. The toast closes, and the expense is back in the list.
4. Time-out: repeat 1–2 and wait 10 s. The toast closes, and the expense stays deleted.
5. In-flight: repeat 1, set `{ 'POST restore': { delay: 12000, fail: true } }` and tap Undo.
   - The button is disabled, and the toast is still there at 10 s.
   - At 12 s it reads "Couldn’t undo".
   - Base clears the toast at once and never says the undo failed.

**Procedure E, Category edge cases (AC5).**

1. Load `http://localhost:8081/category/999?month=2026-10`. The header reads "‹ October", and the body reads "Category
   not found." with no Retry and no endless spinner. "‹ October" goes to Home, because `canGoBack()` is false.
2. Load `/category/<a real id>` with no `month`.
   - The header names the current Kyiv month.
   - The network log shows `expenses?month=<kyivMonth>&categoryId=<id>`.
   - The list matches the one reached from Home.

**iPhone (Expo Go, VoiceOver on), recorded in the PR test plan:**

1. Delete an expense: VoiceOver says "Deleted “<name>”" when the toast appears.
2. Delete another, Ctrl+C `yarn api dev` within 10 s, and double-tap Undo: VoiceOver says "Couldn’t undo". Start the
   API and double-tap Retry: the expense returns.
3. With the API stopped, fill Add expense and tap Add: the save error is announced. With the API running, Add: the
   "Added …" note is announced.
4. With the API stopped, switch the Home month: the load message is announced, and Retry works after the restart.
   Then, with data on screen and the API stopped, refocus Home and tap Retry twice. The inline refresh message should be
   announced once per failure, not repeated on every render or refocus. If it is noisy, record it under Deviations.

## AC → evidence

| AC                                                                        | Evidence                                                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| API stopped → Home, Category, Expense show error + Retry; Retry loads     | Procedure A (slices 2, 3, 5)                                                                                               |
| Slow switch October→September never shows October's totals                | Procedure B (slice 1)                                                                                                      |
| Data on screen + refocus failure → data stays, inline error with Retry    | Procedure C (slices 2, 3)                                                                                                  |
| Failed Undo → "Couldn’t undo" + Retry; Retry restores and the list shows  | Procedure D (slice 6)                                                                                                      |
| `/category/999?month=…` → "Category not found" + Back; no `month` → today | Procedure E (slice 4)                                                                                                      |
| VoiceOver announces the Undo toast and a save error                       | iPhone checks 1–3 (slices 6, 7), recorded in the PR test plan                                                              |
| lint + typecheck green; suppression gone; no new suppressions             | All four gates on every commit; `rg -n "eslint-disable" apps/mobile/src` is empty after slice 1 (one hit on Base)          |
| (What) LoadError shared by three screens; copy is user-facing             | `rg -n "LoadError" apps/mobile/src/app` hits Home, Category and Expense; `rg -n "API is running" apps/mobile/src` is empty |
| (What) the "Added …" note is announced                                    | iPhone check 3 (slice 7)                                                                                                   |

## Not doing (YAGNI)

- Pull-to-refresh, offline detection, caching, any data-fetching library (brief: out of scope).
- Telling "ledger gone" (`requireLedger`'s 404) apart from "expense gone" on the expense screen. No AC asks for it, and
  a ledger can't disappear mid-session through the app (see Follow-ups).
- The `canGoBack` fallback for `router.back()` after Update. It isn't a load error or Undo, so it is listed under
  Follow-ups. The header Cancel does get the fallback (slice 5), because the error view now shows that header.
- A separate "inline" variant or prop for `LoadError`. It is the same block, in a different place.
- Different Undo text for `not_found` (already restored). See Open questions.
- Replacing the toast's `accessibilityLiveRegion` (web/Android) with `aria-live`. It already reaches web as `aria-live`.

## Risks

- **VoiceOver may drop an announcement made while focus moves**, for example the toast appearing as the expense modal
  closes. iPhone check 1 shows it.
  - If it's cut off, delay that call slightly with `setTimeout`, and record it under Deviations.
  - Don't use `announceForAccessibilityWithOptions({ queue: true })`. react-native-web 0.21 doesn't implement it
    (`AccessibilityInfo/index.js` has only `announceForAccessibility`), so it would throw on web.
- **`accessibilityRole="alert"` on iOS** only sets the role; it doesn't speak. That's why `LoadError` also announces.
  On web, `role="alert"` is what screen readers hear. Slice 2 checks the DOM role.
- **A stale error after switching back**: Oct fails, you switch to Sep, and switch back before Sep's request settles.
  Oct's error shows until its refetch settles. Any success clears it. This is narrow and doesn't break AC2, because no
  stale data is shown.
- **Slice 5 is re-indentation-heavy** (the header moves out of a branch). It stays well under 150 lines either way.

## Open questions

- Blocking: no. **"with Back" on Category not found.** Assumption: the screen's existing header back ("‹ October", with
  the `canGoBack` fallback) is the Back. Adding a second Back button would be about 6 lines.
- Blocking: no. **The expense error view shows both the header Cancel and the body Back.** Assumption: keep Back, so
  004's AC ("+ Back") and procedure D still hold. Dropping it is about −7 lines.
- Blocking: no. **Restore `not_found` (already restored, or the response was lost after success)** shows "Couldn’t undo"
  like any failure. Retry can't help there, but the toast times out in 10 s, and the list's next focus refetch shows
  the truth. Assumption: one failure state, as the brief describes.
- Blocking: no. **Wording** of the four new strings in Contracts. The brief fixes only "Couldn’t undo" and "Category
  not found".

## Follow-ups

- After Update, `ExpenseForm` calls `router.back()`. On a direct web load of `/expense?expenseId=…` there is no history,
  so it should use the same `canGoBack` fallback (004 follow-up).
- Home's total card and `CompactTotal` read €0.00 while a month loads (on first load today, and on every switch after
  slice 1). A dash or the spinner there would be clearer.
- "Ledger gone" vs "expense gone" on the expense load error (004 follow-up). This only matters once membership can
  change mid-session.
- A malformed `month` param (`/category/1?month=abc`) gives a 400 from the API, and `LoadError` offers a Retry that
  can't help.

## Deviations

<filled by the developer during build>

## Revision 1

Changes made after the skeptic's APPROVE WITH EDITS:

- **Required edit.** The `LoadError` contract is now
  `export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void });`, with no return
  annotation, like `AddExpenseButton` and `DateChips`. @types/react 19 has no global `JSX` namespace.
- **Suggestions adopted:**
  - Slice 6: a successful restore also calls `reload()`, as Base does. AC4's "the list shows it" depends on it.
  - Slice 6: toast updates after `await` are guarded with `setToast((t) => (t?.undo === undo ? next : t))`, so a slow
    restore can't close or overwrite a newer toast.
  - Slice 4: `AddExpenseButton` is hidden when the category isn't found (+3 lines; the slice is now ≈15).
  - iPhone check 4: confirm the inline refresh `LoadError` isn't announced noisily on refocus or a failed Retry.
- **New PR estimate: ≈240 changed lines** (slice 4 ≈15, slice 6 ≈55).

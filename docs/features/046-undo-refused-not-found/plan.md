# Plan: Undo that finds nothing to bring back

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/undo-refused-not-found
Base: origin/main (6a6804a)

## Approach

The change is app-only and lives in one function. `restoreRefusedText` in `apps/mobile/src/data/monthEnded.ts` is
already the one place both Undo callers ask "is this refusal final, and what does the bar say?" It learns
`not_found` as well. Both callers (`delete-category.tsx` `setPendingUndo`, `expense.tsx` `remove`) already pass
`err.code` through it. With option A they don't change, and the existing `refused` state of `useUndoOffer` and
`UndoToast` handles the rest: one line, no Retry, the VoiceOver announcement and the 10 s timeout. The 404 wording is
a single string literal in that function. Changing it later means editing that line and its test row.

Alternative considered: give each caller its own `refusedText` that checks `not_found` inline. It lost because the
wording would then live in two screens, and the brief wants one line for both kinds. Also considered: moving
`restoreRefusedText` out of `monthEnded.ts` into a module named after Undo refusals. It lost because that is a move
with no AC behind it, and `data/undo.ts` imports `expo-router`/`react-native`, so it can't host a Node-tested pure
function (see Not doing).

## Contracts

- DB: none
- API: none (the 404s stay as they are: `POST …/categories/:categoryId/months/:month/restore` and
  `POST …/expenses/:expenseId/restore` → `404 { error: 'not_found' }`)
- App, option A (default):
  - `restoreRefusedText(code: string, month: string): string | null`. The signature is unchanged.
    - `'month_ended'` → `` `${monthName(month)} has ended, so it can’t be restored.` `` (unchanged)
    - `'not_found'` → `'Already restored or deleted — nothing to undo.'` (new; it doesn't depend on `month`)
    - any other code → `null` (retryable "Couldn’t undo" + Retry, unchanged)
  - The JSDoc changes to: "The Undo bar's text when a restore is refused for good (into a 'YYYY-MM' month that has
    ended, or with nothing left to restore); null for a retryable failure."
  - Callers are unchanged. `PendingUndo`, `UndoOffer`, `useUndoOffer` and `UndoToast` are unchanged.
- App, **if option B is chosen at Gate A** (≈ +6 lines over A):
  - The signature becomes `restoreRefusedText(code: string, month: string, name: string): string | null`, and
    `'not_found'` → `` `“${name}” was already restored or deleted.` ``.
  - `delete-category.tsx` passes `displayName`, the same name as in `removedMessage`.
  - `expense.tsx` `remove` hoists `const name = expense.name || 'Expense'` and uses it for both `message` and
    `refusedText`, so the bar and the refusal name the same thing.
  - Tests: the existing `month_ended` and `null` rows gain a name argument, and the `not_found` rows assert the
    quoted name, including a category name and the `'Expense'` fallback.
- Reuses: `restoreRefusedText`, `ApiError` (`api/client.ts`), the `refusedText` hook-up in `PendingUndo`,
  `useUndoOffer`'s refused path (state + `announceForAccessibility(text)`), and `UndoToast`'s refused rendering.
- New dependencies: none

## Slices

- [ ] 1. Say why an Undo that finds nothing to restore can't be retried (~15 lines)
  - Files: `apps/mobile/src/data/monthEnded.ts`, `apps/mobile/test/monthEnded.test.ts`. Option B also touches
    `apps/mobile/src/app/delete-category.tsx` and `apps/mobile/src/app/expense.tsx`.
  - Change: add the `not_found` branch and the JSDoc from Contracts, as two early returns in place of today's
    ternary. Option B: also the signature and the two call sites from Contracts.
  - Tests (`apps/mobile/test/monthEnded.test.ts › restoreRefusedText`). Write them first; the `not_found` rows fail
    on the base, which returns `null` (Prove-It).
    - `it.each(['2026-09', '2027-01'])('says there is nothing to undo for not_found in %s', …)` →
      `'Already restored or deleted — nothing to undo.'` The text is the same whatever the month.
    - The existing `month_ended` rows stay as they are.
    - The `null` table becomes `['name_taken', 'internal', 'unknown']`: `not_found` moves out, and `name_taken` is
      the 409 that keeps Retry (brief: out of scope). `internal` and `unknown` are what `ApiError` carries for a 5xx
      with and without a body (`client.ts`: `error ?? 'unknown'`).
    - A network failure is not an `ApiError`, so the callers' `instanceof` check returns `null` before
      `restoreRefusedText` runs. That path is unchanged and is covered by the web check below.
  - Verify: web at 390×844 (`api` launch config, plus the `web` Metro). Metro run under `.claude/worktrees/` serves
    Expo's welcome page, so serve web from a detached sibling worktree outside `.claude` with the changed file copied
    in. Sign in as a per-brief QA user in the current month (October 2026). Run each check on the base first, where
    the bar shows "Couldn’t undo" + Retry (the bug), then with the fix.
    - **Force the 404.** Before the delete, run this in the page. It lets the app's DELETE go through, then restores
      the same thing straight through the API, as another member would, before the bar appears:
      `const f = window.fetch; window.fetch = async (u, i) => { const r = await f(u, i); if (i?.method === 'DELETE' && r.ok) await f(String(u) + '/restore', { method: 'POST', credentials: 'include' }); return r; };`
      (The category's DELETE URL is `…/categories/:id/months/:month`, and the expense's is `…/expenses/:id`. In both
      cases `+ '/restore'` is the restore route.)
    - **Category removal**: Category ⋯ → "Remove from October" → Remove. The bar shows "Removed …" + Undo. Press
      Undo. The bar reads "Already restored or deleted — nothing to undo." with no button, the text is not cut off at
      two lines, and the bar goes away after ~10 s. The category is in the list again after the screen's next focus,
      because the outside call restored it.
    - **Expense delete**: open an October expense → "Delete expense". The Category screen's bar shows "Deleted “…”"
      with Undo. Press Undo. Expect the same line, no button, gone after ~10 s.
    - **Unchanged refusals.** Reload the page to drop the spy. Then, on one expense delete each, stub the restore
      response with
      `const f = window.fetch; window.fetch = (u, i) => String(u).endsWith('/restore') ? Promise.resolve(new Response('{"error":"…"}', { status: …, headers: { 'content-type': 'application/json' } })) : f(u, i);`
      (the 045 pattern; the network case returns `Promise.reject(new TypeError('Failed to fetch'))` instead)
      and press Undo:
      - `409 {"error":"month_ended"}` → "October has ended, so it can’t be restored.", no button.
      - `409 {"error":"name_taken"}`, `500 {"error":"internal"}` and `Promise.reject(new TypeError('Failed to fetch'))`
        → "Couldn’t undo" + Retry.
    - Clean up: reload. Restore any expense the stubs left deleted with a `POST …/restore`
      (`credentials: 'include'`), then remove the QA user (local QA cleanup order).
    - Option B: the same checks, and the line names the category or expense. Also try a 40-character category name
      and a long expense name to see how two lines cut them.

Total ≈ 15 changed lines in 1 commit (option B ≈ 21 in the same commit).

## AC → evidence

| AC                                                                        | Evidence                                                                                                                                                                                             |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category removal's Undo refused with 404 shows the line, no Retry         | `restoreRefusedText` › "says there is nothing to undo for not_found" + slice 1 web check "Category removal" (base: Retry; fix: line, no button)                                                      |
| Expense delete's Undo refused with 404 shows the line, no Retry           | Same unit test + slice 1 web check "Expense delete"                                                                                                                                                  |
| `month_ended` text unchanged; other failures keep "Couldn’t undo" + Retry | Existing `month_ended` rows + the `null` table (`name_taken`, `internal`, `unknown`) + slice 1 web check "Unchanged refusals" (409 month_ended, 409 name_taken, 500, network)                        |
| VoiceOver announces the same line                                         | No code change: `useUndoOffer` announces the refused `text` (`undo.ts`). Covered by the iPhone check, since web has no VoiceOver                                                                     |
| Unit tests cover the new text and which codes it applies to               | `apps/mobile/test/monthEnded.test.ts › restoreRefusedText` (the new `not_found` rows + the `null` table)                                                                                             |
| Web check at 390×844 forcing the 404, category and expense                | Slice 1 Verify, "Force the 404" spy (DELETE then an outside `…/restore`), both flows                                                                                                                 |
| iPhone (Expo Go) checked by the user                                      | PR test plan item for the user: the same two flows, with the restore done from another signed-in device or the web app within the 10 s window, VoiceOver on once                                     |
| Gates green                                                               | `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped, before the commit. Export `DATABASE_URL_TEST` from the main checkout's `apps/api/.env` so API integration tests don't skip |

## Not doing (YAGNI)

- Any API change, or Retry handling for `name_taken` (brief: out of scope).
- Refreshing the list behind the bar after the 404. It refreshes on the next focus, as today.
- Moving `restoreRefusedText` out of `monthEnded.ts` (see Follow-ups).
- A screen-level test of the `refusedText` wiring. There is no RN test environment, `api/client.ts` imports
  `expo-secure-store`, and the wiring itself doesn't change with option A.

## Risks

- `not_found` is not always final. An expense whose category was removed from its month meanwhile gets a 404, and
  restoring the category would make its Undo work again. The brief treats every 404 as final, and Retry within the
  10 s bar wouldn't realistically outlast such a restore, so the plan follows the brief. This is not proven by a
  slice; it is the brief's decision.
- The line might not fit two lines at 390 wide. Option A has 46 characters over about 310 px at 15 pt, so it should
  wrap to two lines at most. Slice 1's web check reads it. Option B can't promise this: names go up to 40 characters
  (category) or 200 (expense), and `numberOfLines={2}` cuts the end, which is where "restored or deleted" sits. Slice
  1's option B check shows how it truncates.

## Open questions

- Decided at Gate A (2026-10-25): option A. The option B notes below stay only as a record.
- Not blocking: option A says "deleted" also when the 404 is an expense whose category was removed from the month
  meanwhile. The category was removed, not deleted, and the expense stays deleted. Assumed this is close enough, as
  the brief's own draft wording covers that case.

## Follow-ups

- `monthEnded.ts` now holds a refusal text that isn't about an ended month. If a third kind of Undo refusal comes
  along, move `restoreRefusedText` (and its tests) into a module named for Undo refusals, as a mechanical commit.

## Deviations

## Consolidate

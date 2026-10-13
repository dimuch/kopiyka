# Plan: Category client calls, and the Undo bar on Home

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/category-undo-on-home
Base: origin/main @ 43247e0

## Approach

The Category screen's inline Undo bar moves, with its behaviour unchanged, into a hook `useUndoOffer` in
`data/undo.ts` and a presentational `UndoToast` in `components/`. The handoff `PendingUndo` becomes
`{ message, restore }`, so the hook doesn't know what was deleted. Brief 018 hands over a category restore the same
way. Home uses the same hook and bar. The edit screen now hands an offer over even when it can't go back (a web link),
which lands on Home, so Home's bar can be checked before 018. A small `expenseCount` label replaces the two inline
"N expense(s)" expressions. The category DTO mirror, delete and restore calls and totals hook move to 018, their
first caller.

Alternative considered: give Home its own copy of the bar. That copy would duplicate the 10 s timer, the "no timeout
while restoring" rule and the race guard (`t?.undo === undo`), and 018 would have to keep both copies in step. The
brief picks the extraction with two callers on purpose, as a departure from the rule of three.

## Where the brief no longer matches the code (checked on 43247e0)

- **"instead of the Add expense button" is stale.** Brief 019 (efddd12, 17068c4) removed the floating Add button
  everywhere. Home has no Add button at all. Only Expenses and Category have a "+", and it sits in the header. Even on
  the Category screen the bar never replaced Add: it is an absolutely positioned overlay at the bottom
  (`bottom: 32`). Plan: Home shows the same overlay at the bottom of its screen, and nothing is hidden for it.
- **Home now has the Notion sync panel (brief 024) and doesn't scroll.** The bar overlays the bottom of Home for up to
  about 10 s. A long sync report could sit under it (see Risks). Restoring an expense also changes Notion's `unsent`
  count (`notion/groceries.ts` and `totals.ts` filter on `deleted_at`). So Home's `onRestored` reloads the Notion
  status too (Open question 1).
- **Styles are theme-aware now (brief 025).** The bar's styles move into `UndoToast` as a module-level
  `makeStyles(colors)` read with `useThemedStyles`. They are not a plain `StyleSheet` with palette values.
- **Home ignores `reload` today** (`const { data, error } = useMonth(...)`). It starts reading it.
- Still true: the bar lives in `app/category/[categoryId].tsx` (lines 62–94, 183–197, styles 250–267). The handoff is
  `data/undo.ts`. Only `app/expense.tsx` `remove()` sets an offer, and only when `router.canGoBack()`. Home refetches
  on focus through `useMonth`. The root `Stack` has no anchor (`unstable_settings`), so a page opened straight from a
  link has nothing to go back to, and `leave()` calls `router.replace('/')`.

## Contracts

- DB: none.
- API: none.
- App:
  - `data/monthSummary.ts`: `export function expenseCount(n: number): string`, giving '0 expenses', '1 expense',
    '23 expenses'. Callers: the Category caption (`${expenseCount(count)} · ${monthLabel(month)}`), Home's Statistics
    card figure (same output as today), and 018's confirm screen and Undo text later.
  - `data/undo.ts`:
    ```ts
    export interface PendingUndo {
      /** What the bar says and VoiceOver announces, e.g. 'Deleted “Coffee”'. */
      message: string;
      /** Brings back what was deleted; rejects when it can't. */
      restore: () => Promise<void>;
    }
    export interface UndoOffer {
      undo: PendingUndo;
      status: 'offer' | 'restoring' | 'failed';
    }
    export function setPendingUndo(undo: PendingUndo): void; // unchanged
    export function takePendingUndo(): PendingUndo | null; // unchanged
    /** Takes a pending Undo when the screen comes into focus and runs its bar; `onRestored` runs after a successful restore. */
    export function useUndoOffer(onRestored: () => void): { offer: UndoOffer | null; restore: () => Promise<void> };
    ```
    The behaviour is moved as-is:
    - on focus, take the pending offer and announce `message`;
    - clear it after 10 000 ms, with the timer restarting on each change and paused while `restoring`;
    - `restore` ignores calls while one is in flight, and settles only the offer it started from;
    - on failure, set `failed` and announce 'Couldn’t undo';
    - after a successful restore, `onRestored` runs even when a newer offer replaced the bar meanwhile (only the
      `t?.undo === undo` settle is guarded), as today.
  - `components/UndoToast.tsx`: `export function UndoToast({ offer, onUndo }: { offer: UndoOffer; onUndo: () => void })`.
    It shows `offer.undo.message`, or 'Couldn’t undo' when failed, plus an Undo/Retry button. The button is disabled
    and dimmed while restoring. The bar keeps `accessibilityLiveRegion="polite"` and the same layout as today. Callers
    render it only when `offer` is set.
  - Routes: none new.
- New dependencies: none.

## Slices

- [x] 1. Show expense counts with one shared label
  - Files: `apps/mobile/src/data/monthSummary.ts`, `apps/mobile/test/monthSummary.test.ts`,
    `apps/mobile/src/app/category/[categoryId].tsx`, `apps/mobile/src/app/(tabs)/index.tsx`
  - Change: add `expenseCount`. The Category caption becomes `{expenseCount(count)} · {monthLabel(month)}`. Home's
    Statistics figure becomes `count === undefined ? null : expenseCount(count)`. The text doesn't change.
  - Tests: `monthSummary.test.ts` → "says how many expenses, singular for one": `0 → '0 expenses'`,
    `1 → '1 expense'`, `23 → '23 expenses'`.
  - Verify: web 390×844. The Category caption still reads "N expenses · October 2026", with one expense giving
    "1 expense · …". Home's Statistics card is unchanged.
  - About 20 lines.
- [ ] 2. Move the expense Undo bar into a shared hook and component
  - Files: `apps/mobile/src/data/undo.ts`, `apps/mobile/src/components/UndoToast.tsx` (new),
    `apps/mobile/src/app/category/[categoryId].tsx`, `apps/mobile/src/app/expense.tsx`
  - Change:
    - `PendingUndo` becomes `{ message, restore }`. Add `UndoOffer` and `useUndoOffer`. The focus effect, timer
      effect and `restore` move over verbatim, including the "only touch the toast this restore started from" guard
      and its comment. Update the file's header comment.
    - New `UndoToast`, with the `toast`, `toastText`, `undo` and `undoText` styles moved into its own `makeStyles`.
    - The Category screen calls `const toast = useUndoOffer(reload)` and renders
      `{toast.offer ? <UndoToast offer={toast.offer} onUndo={toast.restore} /> : null}`. It drops the inline state,
      effects, JSX, styles, and the now unused imports (`AccessibilityInfo`, `useEffect`, `restoreExpense`,
      `takePendingUndo`).
    - `expense.tsx` `remove()` sets
      ``{ message: `Deleted “${expense.name || 'Expense'}”`, restore: () => restoreExpense(ledgerId, expense.expenseId) }``.
      It is still guarded by `router.canGoBack()`, so behaviour doesn't change in this slice.
  - Verify: web 390×844, AC 2 in full:
    - Delete an expense from Category → Edit. The bar reads "Deleted “…” · Undo" and is gone after about 10 s.
    - Undo brings the expense back into the list and the total.
    - Stop the `api` launch config, then Undo → "Couldn’t undo · Retry". The bar stays while you wait. Start the API
      and Retry → the expense is back.
    - Check this in both Light and Dark (Settings), so the moved styles follow the theme.
  - About 150 lines (about 95 added, 55 removed).
- [ ] 3. Show the Undo bar on Home, after deleting an expense opened from a link
  - Files: `apps/mobile/src/app/(tabs)/index.tsx`, `apps/mobile/src/app/expense.tsx`
  - Change:
    - Home reads `reload` from `useMonth`, calls
      `const toast = useUndoOffer(() => { reload(); notion.reload(); })`, and renders `UndoToast` last inside its
      `SafeAreaView`, like Category.
    - `expense.tsx` `remove()` always calls `setPendingUndo`. Its comment changes to say that the screen it returns
      to, Category or (from a link) Home, takes the offer.
  - Verify: web 390×844, AC 3:
    - Open `http://localhost:8081/expense?expenseId=<id>` in a fresh tab and Delete. You land on Home with the bar,
      and Home's Expenses and Statistics figures have dropped.
    - Undo → the figures come back, and the bar goes.
    - Repeat with the API stopped: "Couldn’t undo · Retry". Start the API, Retry, and the figures come back.
    - Re-run slice 2's first check, so a delete from Category still lands on Category with the bar and Home shows
      none.
    - Then switch to another tab and back to Home: no second bar (the handoff was cleared, now that the
      `canGoBack()` guard is gone).
    - With Notion configured locally, the panel's "N new" count follows the Undo. Without it the panel is hidden, and
      the PR's test plan says the "N new" refresh wasn't verified.
  - About 20 lines.

Total: about 190 changed lines.

## AC → evidence

| AC                                                                                                                                    | Evidence                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `expenseCount` gives "0 expenses", "1 expense", "23 expenses"; caption "N expenses · <month>"                                         | `monthSummary.test.ts` "says how many expenses, singular for one" (slice 1); web check of the Category caption (slice 1) |
| Category expense Undo behaves as before (bar about 10 s; Undo restores list and total; API down → Couldn’t undo · Retry, Retry works) | Web 390×844 checks in slice 2, repeated in slice 3; slice 2's diff moves the timer, guard and announcements verbatim     |
| Home shows the bar for a handed-over offer; Undo restores and Home's totals update; failure → Couldn’t undo · Retry                   | Web 390×844 web-link check in slice 3                                                                                    |
| Gates green                                                                                                                           | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each of the 3 commits                             |
| Brief 'What': DTO mirror, delete/restore calls, totals hook                                                                           | Moved to 018 with its first caller (brief OQ2, skeptic objected under approval rule 2)                                   |

The PR's test plan records the web checks. iPhone checks belong to 018 (its AC 3), but VoiceOver behaviour is
unchanged code.

## Not doing (YAGNI)

- The ⋯ menu, the confirm screen, deleting a category from the app and its Undo text (018). Rename (014).
- Any change to the Undo's timing, text, colours or layout. The same 10 s, with no "Undo all", no stacking of offers,
  and no progress indicator.
- A pure reducer or unit tests for the Undo state. The logic moves unchanged and is checked by AC 2 on web. A React
  test renderer would be a new dev dependency that no AC needs.
- Hiding or moving anything on Home while the bar shows. There is no Add button to replace (see the stale-brief
  section).
- Making Home scroll, or reserving space under the Notion panel for the bar.
- Taking the offer on any other tab (Expenses, Budget…). Every delete returns to Category or Home.
- The category DTO mirror, delete/restore calls and `useCategoryTotals` — moved to 018, which is their first caller.

## Risks

- **A web link has nothing to go back to, so the offer must reach Home.** `leave()` calls `router.replace('/')` from a
  modal route. Home has to mount and focus so that its `useFocusEffect` takes the offer. Slice 3's web-link check
  proves this: the bar shows on Home. If it doesn't show, the offer would wait for a later Home focus. Fallback: keep
  the `canGoBack()` guard, and leave Home's bar unchecked until 018 (the brief's stated alternative).
- **A Category delete must not leak to Home.** With the guard gone, an offer is always set. Going back to Category
  focuses Category first, so Category takes it. Slice 3 re-runs slice 2's check and then opens Home: no bar.
- **The bar covers Home content.** Home doesn't scroll. At 390×844 the cards and the panel end well above
  `bottom: 32 + 56`. A long sync report (up to 6 reason lines) could still reach under the bar for its 10 s. Slice 3
  checks Home with the panel visible, if Notion is configured locally. If they overlap, this is a Follow-up, not this
  brief.
- **The extraction changes behaviour.** For example, the `onRestored` closure is stale, or the timer resets
  differently. The hook calls `onRestored` only inside `restore`, after the await, and `reload` is stable. Slice 2's
  checks (AC 2) cover the timer, Undo, failure and Retry.

## Open questions

1. No: should Home's Undo also reload the Notion status? The brief says "reloads its totals", but restoring an
   expense changes the panel's "N new" count. Assumption: yes. It is one call (`notion.reload()`) in Home's
   `onRestored`.
2. Resolved: moved to 018 at the skeptic's objection, as the brief allows.
3. No: where does `expenseCount` live? Assumption: `data/monthSummary.ts`, next to the other pure expense-summary
   helpers. `format.ts` is for money and dates (conventions §2). It also replaces Home's Statistics expression, which
   is the same code, so the helper has two callers now.
4. No: the brief says the bar replaces "the Add expense button". That button no longer exists on Home (brief 019).
   Assumption: the bar is the same bottom overlay as on Category, and nothing is hidden.
5. No: the edit screen hands an offer over from a web link (the brief's own question). Assumption: yes, as the brief
   assumes (slice 3).

## Follow-ups

- 018's plan adds `CategoryWithTotals`, `data/categories.ts` and the totals hook; 018 brief line 13 ('Depends on 017
  (client calls, totals hook, …)') is now partly stale.

## Deviations

<filled by the developer during build>

## Revision 1

Skeptic edits: slice 4 (the category DTO mirror, delete/restore calls and `useCategoryTotals`) moved to 018 unchanged,
as brief OQ2 allows; Contracts, AC → evidence, Not doing, Risks, Open question 2 and Follow-ups updated to match.
Suggestions taken: slice 3 checks that switching tabs shows no second bar, and says the PR records an unverified
"N new" refresh when Notion isn't configured; Contracts state that `onRestored` runs after any successful restore, as
today.

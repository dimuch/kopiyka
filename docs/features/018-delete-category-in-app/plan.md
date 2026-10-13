# Plan: Delete a category in the app, with a warning and Undo

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/delete-category-in-app
Base: origin/main @ 8f2ca44

## Approach

013's API already deletes and restores a category, and 017's Undo bar already runs on Home. This brief adds the app
side:

- the client calls and the all-months totals hook that 017 moved here;
- a modal confirm route, `/delete-category?categoryId=…`, which loads its own numbers;
- pure warning and Undo texts in `data/`, with unit tests;
- a ⋯ button with a small overlay menu in the Category screen's header.

After a delete, the confirm screen hands over `{ message, restore }` (017's `PendingUndo`) and calls
`router.dismissTo('/')`. Home's existing `useUndoOffer` takes the offer when it gains focus. Home needs no change: on
focus it already refetches its month and the Notion status, and its `onRestored` already reloads both.

Alternative considered: nest the confirm route under the Category screen (`category/[categoryId]/delete`). That
needs `category/[categoryId].tsx` moved to `…/index.tsx` and a nested layout, for no AC. A top-level modal with a
search param copies `expense.tsx` (`/expense?expenseId=…`).

## Where the brief no longer matches the code (checked on 8f2ca44)

- **"Depends on 017 (client calls, totals hook, the Undo bar on Home)" is partly stale.** 017 built the shared bar:
  `useUndoOffer`, `PendingUndo { message, restore }` and `UndoToast`. Home takes an offer (c0d5a26). The skeptic
  moved the `CategoryWithTotals` mirror, the delete and restore calls and the totals hook to this brief (017 plan,
  Revision 1). They are planned here, in slices 1–3.
- **"the installed expo-router 57.0.24" is now 57.0.26.** `router.dismissTo` still exists
  (`node_modules/expo-router/build/global-state/router.d.ts:66`). Its doc says: "Dismisses screens until the provided
  href is reached. If the href is not found, it will instead replace the current screen with the provided `href`."
  The v57 SDK docs say the same. It dispatches `POP_TO` with `{ name: '(tabs)', params: { screen: 'index' } }`.
  I ran the installed `StackRouter` in a scratch script:
  - `[(tabs), category, delete-category]` becomes `[(tabs) {screen: 'index'}]`. Category is removed without ever
    regaining focus, and the tab navigator jumps to Home (Category is pushed from the Expenses tab).
  - From a web link, `[category, delete-category]` becomes `[category, (tabs) {screen: 'index'}]`. Home is on top
    and focused; Category stays below it, unfocused (see Risks).
- **Home has the Notion sync panel and theme-aware styles (briefs 024, 025).** Deleting a category changes what Notion
  hasn't heard about. For example, deleting `groceries` makes every grocery row of the year "unwanted"
  (`notion/groceries.ts:57`), and `totals.ts` skips deleted categories. `useNotionSync` refetches on focus, so landing
  on Home after a delete refreshes "N new". 017's `onRestored` already calls `notion.reload()` after Undo. New
  screens use `makeStyles(colors)` with `useThemedStyles`.
- **Still true:**
  - The root `Stack` has `headerShown: false` (`app/_layout.tsx:28`), so `Stack.Toolbar.Menu` (in
    `StackClient.d.ts`, iOS-only) would need the native header.
  - `expense.tsx` is a `presentation: 'modal'` route, and `Icon` has `more`.
  - The category list, quick row, month list and expense form skip deleted categories (012/013 SQL:
    `categories/routes.ts` list, `expenses/routes.ts:112`, `checkCategory` at `:70`).
  - Typed routes are off (`app.json`), so a new route needs no generated types.

## Contracts

- DB: none.
- API: none. Used as built by 013 (`apps/api/src/categories/routes.ts`), all behind `requireAuth` + `requireLedger`:
  - `GET /api/ledgers/:id/categories/:categoryId` → `200 CategoryWithTotalsDto`
    (`{ categoryId, techName, displayName, sortOrder, expenseCount: number, totalEur: string }`). `expenseCount`
    and `totalEur` cover live expenses in all months; `totalEur` is `'0.00'` when there are none. Errors:
    `404 not_found` for an unknown, foreign or deleted category, `400 invalid_request`, `401 unauthorized`.
  - `DELETE /api/ledgers/:id/categories/:categoryId` → `204`. Errors: `404 not_found` (unknown, foreign or already
    deleted).
  - `POST /api/ledgers/:id/categories/:categoryId/restore` → `204`. This restores only the expenses stamped with the
    category's delete. Errors: `404 not_found` (unknown, foreign or live).
- App:
  - `api/types.ts` mirrors `CategoryWithTotalsDto`:
    ```ts
    /** One category with its live expenses across all months (GET one category). */
    export interface CategoryWithTotals extends Category {
      expenseCount: number;
      /** Decimal string, '0.00' without expenses. */
      totalEur: string;
    }
    ```
  - `data/categoryDelete.ts` (pure; callers are the confirm screen now, and the Undo message):
    ```ts
    export interface DeleteWarning {
      title: string;
      body: string;
      /** The destructive button's label. */
      action: string;
    }
    /** What deleting `c` removes, in all months. */
    export function deleteWarning(c: CategoryWithTotals): DeleteWarning;
    /** The Undo bar's text, e.g. 'Deleted “groceries” and 23 expenses'. */
    export function deletedMessage(displayName: string, expenseCount: number): string;
    ```
    Copy (amounts through `eur(toCents(totalEur))`, counts through `expenseCount` from `data/monthSummary.ts`). The
    title is always `Delete “groceries”?`.
    - 0 expenses:
      - body `It has no expenses. You can undo right after.`
      - action `Delete category`
      - Undo `Deleted “groceries”`
    - 1 expense:
      - body `This also deletes its 1 expense (€12.50). It disappears from every month’s totals. You can undo right after.`
      - action `Delete category and 1 expense`
      - Undo `Deleted “groceries” and 1 expense`
    - n ≥ 2:
      - body `This also deletes its 23 expenses (€1,234.50 in total, across all months). They disappear from every month’s totals. You can undo right after.`
      - action `Delete category and 23 expenses`
      - Undo `Deleted “groceries” and 23 expenses`
  - `data/categories.ts` (client calls, like `data/expenses.ts`; brief 014 adds rename here):
    ```ts
    /** Soft-deletes a category and its live expenses, so they can be restored together (Undo). */
    export function deleteCategory(ledgerId: number, categoryId: number): Promise<void>;
    /** Brings back a category with exactly the expenses deleted with it (Undo). */
    export function restoreCategory(ledgerId: number, categoryId: number): Promise<void>;
    ```
  - `data/useCategoryTotals.ts`. It loads on mount and on `reload`, keyed like `useExpenseDraft` with `useEffect`
    and a `live` guard. It doesn't load on focus: the confirm modal is only ever on top.
    ```ts
    export type CategoryTotals = { reload: () => void } & (
      { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; category: CategoryWithTotals }
    );
    export function useCategoryTotals(ledgerId: number, categoryId: number): CategoryTotals;
    ```
  - Route `app/delete-category.tsx`, at `/delete-category?categoryId=<id>`. It is registered in the root `Stack`
    inside the signed-in guard, as `<Stack.Screen name="delete-category" options={{ presentation: 'modal' }} />`.
    - Header: Cancel and the title "Delete category", like `expense.tsx`. Cancel uses the same `leave()`: back, or
      `router.replace('/')` when there's nothing to go back to.
    - Invalid `categoryId` (`parseIdParam`): "That link isn’t valid." and nothing is fetched.
    - Loading: a spinner.
    - Load error `not_found`: "This category was deleted.", with no Retry. Any other error: "Couldn’t load this
      category. Check your connection and try again." with Retry.
    - Ready: the title, the body, and the destructive button labelled with `action`. The button is `colors.danger`
      with an `colors.onAccent` label, 56 pt high. Contrast holds in both palettes: #0E1013 on #FF8A80, and white on
      #C23B31.
    - Delete (slice 3):
      - `busy` disables the button and shows a spinner, with `accessibilityLabel={action}` and
        `accessibilityState={{ busy }}`. It also disables the header's Cancel, so the user can't leave while a delete
        it then navigates from is still in flight.
      - It calls `deleteCategory`, then
        `setPendingUndo({ message: deletedMessage(displayName, expenseCount), restore: () => restoreCategory(ledgerId, categoryId) })`,
        then `router.dismissTo('/')`.
      - On failure it calls `setBusy(false)` (as `expense.tsx` `remove()` does) and stays on the screen with an
        inline alert, which it also announces: `not_found` → "This category was already deleted."; anything else →
        "Couldn’t delete. Check your connection and try again."
  - Category screen (`app/category/[categoryId].tsx`):
    - A ⋯ button (`Icon name="more"`, 44×44, `accessibilityLabel="Category actions"`,
      `accessibilityState={{ expanded }}`) after the "+" in the header. It shows only once the category has loaded.
    - It toggles a local `CategoryMenu({ onDelete, onClose })` in the same file. This is not a generic component,
      since it has one caller. Brief 014 adds an `onRename` row the same way.
    - The menu renders last in the screen, as one overlay `View` with `StyleSheet.absoluteFill` and `zIndex: 2`. That
      is above the header's `zIndex: 1`, so Back and "+" don't take taps while it's open. Inside it:
      - a transparent full-screen `Pressable` (`accessibilityRole="button"`, `accessibilityLabel="Close menu"`) that
        closes it;
      - a card (`surfaceRaised`, `borderStrong`) at `top: insets.top + 64, right: 20`, using
        `useSafeAreaInsets()`. `SafeAreaView` puts the top inset into padding, and absolute children ignore padding.
        64 is the screen's `paddingTop` (20) plus the header's 44 pt row, so the card sits just under the ⋯ button on
        iPhone and on web (inset 0). It isn't placed inside the header View: the header's `zIndex: 1` would put it
        under the backdrop.
    - The card has one row, "Delete category" (`accessibilityRole="button"`) in `colors.danger`, at least 44 pt high.
      It closes the menu, then calls
      `router.push({ pathname: '/delete-category', params: { categoryId } })`. It is not an RN `Modal`, so no modal
      presentation conflict on iOS.
  - `components/UndoToast.tsx`: the message gets `numberOfLines={2}` (was 1). At 390 pt the text has about 248 pt.
    "Deleted “medication” and 12 expenses" doesn't fit on one line, and the cut-off part would be the count.
- New dependencies: none.

## Slices

- [x] 1. Add the texts for deleting a category and its Undo
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/src/data/categoryDelete.ts` (new),
    `apps/mobile/test/categoryDelete.test.ts` (new)
  - Change: add the `CategoryWithTotals` mirror, plus `deleteWarning` and `deletedMessage` as in Contracts.
  - Tests: `categoryDelete.test.ts`, in table style (`it.each`):
    - "warns what goes, across all months":
      - `('groceries', 23, '1234.50')` gives the n ≥ 2 copy, with `€1,234.50`.
      - `('groceries', 2, '1222.00')` gives `(€1,222 in total, across all months)` and
        `Delete category and 2 expenses`. Whole euros drop the cents, as `eur` does elsewhere.
      - `('groceries', 1, '12.50')` gives the 1-expense copy.
      - `('gym', 0, '0.00')` gives the 0-expense copy.
      - The title is `Delete “groceries”?` in every case.
    - "says what Undo brings back": `0 → 'Deleted “groceries”'`, `1 → 'Deleted “groceries” and 1 expense'`,
      `23 → 'Deleted “groceries” and 23 expenses'`.
    - The expected amounts were computed with the repo's `eur(toCents(…))`: `1234.50 → €1,234.50`,
      `1222.00 → €1,222`, `12.50 → €12.50`.
  - About 80 lines.
- [x] 2. Show what deleting a category would remove, on a confirm screen
  - Files: `apps/mobile/src/data/useCategoryTotals.ts` (new), `apps/mobile/src/app/delete-category.tsx` (new),
    `apps/mobile/src/app/_layout.tsx`
  - Change: add the hook, register the modal route, and build the screen's header, invalid-link, loading, error and
    ready states as in Contracts. There is no Delete button yet, and nothing links to the route.
  - Verify: web 390×844, as a QA user whose `groceries` has expenses in two months plus one deleted on its own:
    - Open `/delete-category?categoryId=<groceries>`. It shows `Delete “groceries”?` with the count and total of the
      live expenses in both months, matching `GET …/categories/<id>`, without the deleted one.
    - A category with 0 expenses shows the 0-expense copy. One with 1 expense shows the 1-expense copy.
    - `categoryId=abc` → "That link isn’t valid.", with no request in the network tab.
    - `categoryId=999999` → "This category was deleted.", without Retry.
    - Fail the GET (a console `fetch` wrapper, as in 017's QA) → the error with Retry, and Retry loads.
    - Cancel in a fresh tab → Home.
    - Check both Light and Dark.
  - About 150 lines.
- [x] 3. Delete a category from its confirm screen, with Undo on Home
  - Files: `apps/mobile/src/data/categories.ts` (new), `apps/mobile/src/app/delete-category.tsx`,
    `apps/mobile/src/components/UndoToast.tsx`
  - Change: add the delete and restore calls, and the destructive button with the delete flow as in Contracts. The
    toast's message gets 2 lines.
  - Verify: web 390×844. From slice 2's URL in a fresh tab (the "href not found" path of `dismissTo`):
    - Delete → Home, with the bar "Deleted “groceries” and N expenses · Undo". Home's Expenses and Statistics figures
      drop.
    - The Expenses tab has no groceries row. The expense form's quick row and All categories have no groceries.
    - Undo → Home's figures come back, the Expenses tab shows groceries with its spending, and the confirm URL shows
      the same count again. The expense deleted on its own stays deleted.
    - Fail the restore (fetch wrapper) → "Couldn’t undo · Retry". Retry restores.
    - Delete again and wait about 10 s → the bar goes and groceries stays deleted.
    - Delete `medication` with several expenses → the bar wraps to 2 lines with the count visible. The expense bar
      on Category still shows a short "Deleted “Coffee”" on one line.
    - Fail the DELETE → "Couldn’t delete…", still on the confirm screen, and nothing was deleted.
    - Double-click Delete → one DELETE request.
    - With Notion configured locally, Home's "N new" changes after the delete and after Undo. If it isn't configured,
      the PR records that this wasn't checked (as in 017).
  - About 60 lines.
- [x] 4. Open Delete category from a ⋯ menu on the Category screen
  - Files: `apps/mobile/src/app/category/[categoryId].tsx`
  - Change: add the ⋯ button, the `CategoryMenu` overlay and its styles in the screen's `makeStyles`, as in
    Contracts.
  - Verify: web 390×844:
    - Expenses → groceries → ⋯ opens the menu under the button. A tap outside closes it. A tap on Back or "+" while
      it's open only closes it.
    - ⋯ → Delete category → the confirm modal with the right count and total. Cancel → back on the same Category
      screen, with the same caption and total.
    - ⋯ → Delete category → Delete → Home (not Category or Expenses), with the bar.
    - Undo, then open Expenses → groceries: its figures are back and there's no second bar.
    - "Category not found." (`/category/999999`) has no ⋯.
    - The header still fits with `eating out` and its compact total showing after a scroll.
    - Check both Light and Dark.
    - iPhone (Expo Go) at Gate B, AC 3: the menu (position under the notch), the modal, a delete landing on Home with
      the bar, Undo, and VoiceOver reading "Category actions" and the bar.
  - About 75 lines.

Total: about 365 changed lines.

## AC → evidence

| AC                                                                                                    | Evidence                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web: Category → ⋯ → Delete category shows the warning with the right count and total                  | `categoryDelete.test.ts` (slice 1); web checks in slices 2 and 4 against the API's GET                                                                         |
| Web: Cancel changes nothing                                                                           | Slice 4 web check (back on Category, same figures); slice 2 (fresh tab → Home)                                                                                 |
| Web: Delete returns to Home without that category, its expenses gone from the total, with an Undo bar | Slices 3 and 4 web checks (Home figures, Expenses tab, expense form, bar text)                                                                                 |
| Web: Undo within the window restores the category, its expenses and the totals                        | Slice 3 web check; 013's `categories.int.test.ts` "restores the category and its expenses unchanged" and "keeps an expense deleted earlier on its own deleted" |
| Web: after the window the category stays deleted                                                      | Slice 3 web check (wait about 10 s)                                                                                                                            |
| Web: a failed Undo shows "Couldn’t undo" with Retry                                                   | Slice 3 web check (fetch wrapper), using 017's `useUndoOffer`                                                                                                  |
| iPhone: the ⋯ menu, confirm screen, delete and Undo work                                              | Slice 4's iPhone check at Gate B, recorded in the PR's test plan                                                                                               |
| Gates green                                                                                           | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each of the 4 commits                                                                   |
| Brief "What": deleted means gone everywhere                                                           | Slice 3 web check (list, quick row, month totals, Category screen, expense form) on 012/013's filters                                                          |

## Not doing (YAGNI)

- Rename, create and reorder (briefs 014, 015), and moving expenses to another category.
- A generic `Menu`/`ActionSheet` component, a native menu (`Stack.Toolbar.Menu`, `ActionSheetIOS`) or an RN `Modal`
  for the menu. The reasons are in the brief's Notes.
- Any change to Home: its focus refetch and 017's `onRestored` already cover the month figures and Notion.
- Counting expenses at delete time for the Undo text. The bar uses the confirmed count (brief Notes).
- A second Cancel button on the confirm screen. The header's Cancel is always there, including while loading and on
  errors.
- Escape-to-close, animation or keyboard focus handling for the menu.
- React test-renderer tests of the screen or the hook (a new dev dependency no AC needs).

## Risks

- **Home must take the offer, not a screen popped on the way.** The scratch run of the installed `StackRouter` shows
  `POP_TO` removes Category without focusing it, then the tab navigator jumps from Expenses to Home. Expenses gains
  focus for a moment, but it doesn't take offers. Slice 3 proves the web-link path, slice 4 the normal path on web,
  and Gate B the normal path on iPhone (native-stack popping a modal and the screen under it at once). Fallback if
  iPhone misbehaves: `router.dismissAll()` followed by `router.navigate('/')`.
- **A web-link delete leaves Category under Home.** After `[category, delete-category]`, browser Back from Home shows
  the Category screen's "Category not found." That is harmless and not in any AC; see Follow-ups.
- **The bar's text is cut off.** Slice 3 widens it to 2 lines and checks a long name. The expense bar's short text is
  unchanged.
- **The header gets crowded.** The ⋯ adds 44 pt next to "+" and the compact total, which `flexShrink`s. Slice 4
  checks `eating out` after a scroll. If the label clips badly, the compact total's label ellipsizes; nothing else
  changes.
- **The menu card's position differs between web and the iPhone safe area.** The card is offset by
  `useSafeAreaInsets().top` (0 on web). Slice 4's web check and the Gate B iPhone check cover it.

## Open questions

1. No: the 1-expense copy. The brief elides it as "(…)". Assumption: `(€12.50)`, with no "in total, across all
   months". All three bodies end with "You can undo right after." (the brief's 0 case and the example do).
2. No: Cancel on a confirm page opened straight from a link. Assumption: Home, the same `leave()` as `expense.tsx`.
3. No: the Undo bar shows up to 2 lines for every caller. Assumption: yes. Otherwise the count is what gets cut off.
4. No: the confirm route path. Assumption: `/delete-category?categoryId=…`, like `/expense?expenseId=…` (see
   Approach).
5. No: the destructive button's colours. Assumption: a `danger` fill with the `onAccent` label. No new palette key.
6. No: brief line 13 ("Depends on 017 (client calls, totals hook…)") and "expo-router 57.0.24" are stale. See the
   section on the brief and code above. Neither changes the design.

## Follow-ups

- Deleting `groceries` makes all of this year's grocery rows "unwanted" (`notion/groceries.ts:57`). A Sync before
  Undo trashes them in Notion; a restore then makes them wanted again. This is consistent with "deleted means gone
  everywhere", but the user may want a word about it in the warning one day.
- After a web-link delete, browser Back from Home reaches "Category not found." (see Risks).

## Deviations

- slice 1: `deletedMessage`'s count parameter is `n`, so it doesn't shadow the `expenseCount` helper; the 0-expense
  test case uses `groceries` (not `gym`) so one title assertion covers every row.
- slice 3: the screen's `busy` state lives in the screen component and is passed down, because the header's Cancel
  (outside the loaded content) must be disabled while a delete is in flight.
- slice 3: not checked: Home's Notion "N new" after a delete and Undo. Locally Notion is set only for ledger 1 (the
  real Budget ’26), so the QA ledger has no Notion panel.
- slice 4: with a very large month total (€11,123.54) the compact header label ellipsizes to "eatin…", as the plan's
  Risks expected; the buttons still fit.

## Revision 1

The skeptic approved with no blockers. These suggestions were applied to Contracts, slice 4's checks and Risks:

- The menu overlay has `zIndex: 2`, above the header's `zIndex: 1`, so Back and "+" don't take taps while it's open.
  Slice 4 checks this.
- The card's position is set: `top: insets.top + 64, right: 20` with `useSafeAreaInsets()`, not inside the header.
- The header's Cancel is disabled while a delete is in flight.
- A failed delete calls `setBusy(false)`, as `expense.tsx` does.
- The "Delete category" row and the "Close menu" backdrop get `accessibilityRole="button"` (conventions §5).

# Plan: Tab bar on child pages, and "Back" on the expense form

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/tab-bar-on-child-pages
Base: origin/main@d4ec8ca

## Approach

Brief option 1. Category detail and the expense form stay in the root `Stack`. Each one renders a shared `TabBar`
below its content.

Tapping a tab calls `router.dismissTo` with the tab's path and the params that tab's route holds right now (Budget
and Income keep their month there). That pops back to `(tabs)` and switches to the tab on the month the user left it
on, which is what the real bar does. From a link, with nothing underneath, it replaces the page.
`delete-category.tsx:107` already uses this call, and it passes `month` explicitly for the same reason.

The active tab and those params are read from the `(tabs)` route below the page in the root stack state. A page
opened from a link falls back to a fixed tab.

`TABS`, the badge and the label logic move out of `(tabs)/_layout.tsx` into `src/tabs.ts`. That way the real bar and
the copy use the same list, badge and labels.

The expense form becomes a normal pushed page (drop `presentation: 'modal'`), and its "Cancel" becomes "Back".

**Decision on the brief's open question: the expense form becomes a regular pushed page.**

- On iOS a `modal` is a sheet over a dimmed parent. A bar inside the sheet would float above the real screen edge,
  and the dimmed parent would show its own bar behind the sheet. A pushed card fills the screen, so the bar sits where
  it does on tab pages.
- A pushed page is what "Back" describes, and iOS swipe-back comes with it.
- On web, `modal` and card render the same full-screen scene (019 plan, Risks), so the only change on web is the bar.

Alternative considered: brief option 2, a nested `Stack` in the Expenses tab. Both child pages are only opened from
Expenses and category detail (`expenses.tsx:123`, `AddExpenseButton` in `expenses.tsx:52` and
`category/[categoryId].tsx:94,152`), so this needs one stack, not a copy per tab. It would show the real bar with
about a third of the code. It lost on the link cases:

- A linked `/expense` would highlight Expenses, but the brief says Home.
- Linked pages go back through the tab router's `firstRoute` history (`TabRouter.js:96`). Without
  `initialRouteName`, a linked category goes back to Home instead of Expenses. With `initialRouteName: 'expenses'`, a
  linked form goes back to Expenses, which breaks AC2.

See Open questions.

## Contracts

- DB: none
- API: none
- App:
  - `src/tabs.ts` (new; pure, imports types only):
    - `export type TabName = 'index' | 'budget' | 'income' | 'expenses' | 'statistics' | 'settings'`
    - `export const TABS: readonly { name: TabName; title: string; icon: IconName; href: string }[]`: the 6 tabs on
      base, in today's order. The `href` values are `'/'`, `'/budget'`, `'/income'`, `'/expenses'`, `'/statistics'`
      and `'/settings'`.
    - `export function tabBadge(tab: { name: TabName; title: string }, inviteCount: number): { badge: number | undefined; label: string }`:
      today's inline logic, moved.
      - Settings with a count > 0 → `{ badge: n, label: 'Settings, n invite(s)' }`.
      - Anything else → `{ badge: undefined, label: title }`.
    - `export type StackRoutes = readonly { name: string; params?: object; state?: { index?: number; routes: readonly { name: string; params?: object }[] } }[]`
    - `export function readTabs(routes: StackRoutes, fallback: TabName): { active: TabName; params: Partial<Record<TabName, Record<string, string>>> }`
      - It finds the `(tabs)` route in the root stack's routes.
      - `active` is its focused tab. It is `fallback` when there's no `(tabs)` route, the route has no nested state
        or no `index`, or the focused name isn't in `TABS`.
      - `params` holds each tab route's current params, string values only. Route params come from URLs and
        `setParams({ month })`, so they're strings. With no `(tabs)` route, `params` is `{}`.
      - Falling back on a missing `index` is deliberate. A `(tabs)` navigator that has rendered always has a full
        state with `index`. A partial state only exists before it mounts, and there a guess from `routes` could
        highlight the wrong tab.
  - `components/TabBar.tsx` (new): `export function TabBar({ fallback }: { fallback: TabName })`.
    - **State:** reads `useNavigationState((s) => s.routes)` from `expo-router/react-navigation` (the stable routes
      array of the navigator holding the page, i.e. the root `Stack`), passes it to `readTabs`, and takes the count
      from `useInvites()`.
    - **Press:** calls `router.dismissTo(p ? { pathname: tab.href, params: p } : tab.href)`, where
      `p = params[tab.name]` if it has any keys.
    - **Layout:** copies the library bar's metrics for a phone-width bottom bar with hidden labels, from
      `BottomTabBar.js`, `BottomTabItem.js` and `TabBarIcon.js` in expo-router 57:
      - height 49 + `insets.bottom`, with `paddingBottom: insets.bottom`
      - a hairline top border in `colors.border`, background `colors.bg`
      - items with `flex: 1`, `padding: 5` and `alignItems: 'center'`
      - a 31×28 icon box holding a 25pt icon, `colors.accent` when active and `colors.muted` otherwise
      - a badge 18.75pt high and at least 18.75 wide, font size 14, padding 4, offset −3 top and end, in
        `accent`/`onAccent`
    - **Accessibility** matches the library:
      - `role` is `button` on iOS and `tab` elsewhere; `aria-selected` is the active state.
      - The row has `role="tablist"`.
      - The label is `label` on web, and on iOS `` `${label}, tab, ${i + 1} of ${n}` `` (`BottomTabBar.js`
        `accessibilityLabel`).
      - Touch targets are ≥ 44pt.
  - Routes: `expense` loses `presentation: 'modal'` in `app/_layout.tsx`. No route moves and no URL changes.
- Reuses:
  - `router.dismissTo`, as in `delete-category.tsx` and `members.tsx`
  - `useInvites` (`data/invites.tsx`)
  - `Icon`
  - `useColors` and `useThemedStyles`
  - `useSafeAreaInsets`
  - the existing `leave()` and `goBack()` fallbacks, unchanged
- New dependencies: none. `expo-router/react-navigation` is an entry point of the installed `expo-router`.

## Slices

- [x] 1. Share the tab list and invite badge between the tab bar and other screens
  - Files: `apps/mobile/src/tabs.ts` (new), `apps/mobile/src/app/(tabs)/_layout.tsx`,
    `apps/mobile/test/tabs.test.ts` (new)
  - Change: move `TABS` and the badge/label computation into `tabs.ts`, adding `href`. `_layout.tsx` maps over
    `TABS` and calls `tabBadge`. Behaviour-preserving.
  - Tests: `tabs.test.ts`, `tabBadge`:
    - Settings with 0 → no badge, label "Settings"
    - Settings with 1 → "Settings, 1 invite"
    - Settings with 2 → "Settings, 2 invites"
    - Budget with 3 → no badge, "Budget"
  - Verify: web 390×844, the bar is unchanged (6 icons, active tint, Settings badge with a pending invite).
- [x] 2. Rename the expense form's Cancel to Back and open it as a page
  - Files: `apps/mobile/src/app/expense.tsx`, `apps/mobile/src/app/_layout.tsx`
  - Change: the label "Cancel" becomes "Back", and the style keys `cancel`/`cancelText` become `back`/`backText`.
    Remove `options={{ presentation: 'modal' }}` from `expense`. `leave()` is unchanged.
  - Verify:
    - Web: New and Edit both show "Back", and no "Cancel".
    - Web: Back returns to Expenses and to the category; a direct `/expense` link goes Back to Home.
    - iPhone: the form slides in as a page, and both Back and swipe-back return.
- [x] 3. Read the active tab and each tab's params from the navigation state
  - Files: `apps/mobile/src/tabs.ts` (+`StackRoutes`, `readTabs`), `apps/mobile/test/tabs.test.ts`
  - Change: the pure reader only. Its caller arrives in slice 4.
  - Tests: `readTabs`:
    - `[(tabs)@expenses, category]` → active `expenses`
    - `[(tabs)@index, category, expense]` → active `index`
    - `(tabs)` whose `budget` route has `{ month: '2026-12' }` → `params.budget` is `{ month: '2026-12' }`; a route
      with no params gets no entry
    - A non-string param value is dropped.
    - `[category]` (no `(tabs)`) → the fallback, `params` `{}`
    - `(tabs)` with no `state` → the fallback
    - a nested state with no `index` → the fallback
    - an unknown tab name → the fallback
- [x] 4. Show the tab bar on category detail
  - Files: `apps/mobile/src/components/TabBar.tsx` (new), `apps/mobile/src/app/category/[categoryId].tsx`
  - Change: `CategoryScreen` wraps its result in a `flex: 1` view (background `colors.bg`), followed by
    `<TabBar fallback="expenses" />`. The `SafeAreaView` keeps `edges={['top']}`. The Undo toast
    (`position: 'absolute', bottom: 32`, `UndoToast.tsx:33-36`) and the ⋯ menu stay inside it, so they're laid out
    above the bar. The list's `paddingBottom: 104` still clears the toast.
  - Verify, web 390×844 and iPhone:
    - **Opening:** open a category from Expenses. The bar shows with Expenses active, and the last expense row
      scrolls fully above the bar.
    - **Undo toast:** delete an expense from the category; the toast sits above the bar and covers neither it nor
      the last row once scrolled.
    - **Same look:** compare screenshots of the bar on Expenses and on the category. Height, icon positions and the
      badge match.
    - **Tab taps:** tap Budget and Budget shows; browser back, or tapping Expenses, doesn't show the category. Tap
      Expenses and Expenses shows.
    - **Month kept:** set Budget to another month, go to Expenses, open a category and tap Budget. Budget shows the
      same month. Do the same with Income.
    - **Direct link:** a direct `/category/1?month=…` link shows Expenses active, and tapping Home replaces the
      page.
    - **Badge:** with a pending invite, the Settings badge shows. On iOS VoiceOver reads "Settings, 1 invite, tab,
      6 of 6".
    - **Swipe-back:** iOS swipe-back still returns to Expenses.
- [x] 5. Show the tab bar on the expense form
  - Files: `apps/mobile/src/app/expense.tsx`
  - Change: `ExpenseScreen` wraps the `SafeAreaView` in a `flex: 1` view, followed by `<TabBar fallback="index" />`.
    The `SafeAreaView`'s `edges` become `['top']`, because the bar pads the bottom inset.
  - Verify, web 390×844 and iPhone:
    - **Active tab:** from Expenses "+", the bar shows with Expenses active. From a category "+" or row, Expenses is
      active. From a direct `/expense` link, Home is active.
    - **Not covered:** Add/Update and "Delete expense" scroll fully above the bar. On iPhone, with the keyboard up on
      the amount field, the field and Add stay visible.
    - **Leaving:** type a name and tap Statistics. It leaves with no prompt, and back doesn't return to the form.
    - **From a category:** tap Budget; Budget shows its kept month, and the category is gone from history.

## AC → evidence

| AC                                                     | Evidence                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| "Back" top-left, no "Cancel"                           | Slice 2 verify (New and Edit, web and iPhone)                           |
| Back returns to origin, Home from a link               | Slice 2 verify (from Expenses, from a category, from a direct link)     |
| Bar shows; Add / list not covered (iOS, web)           | Slice 4 and 5 verify (last row, toast, Add/Update above the bar)        |
| Tab tap shows that tab; back/swipe doesn't return      | Slice 4 and 5 verify (browser back, iOS)                                |
| (What) tab tap works the same as on a tab page         | `readTabs` params cases + slice 4 verify (Budget and Income month kept) |
| Category from Expenses → Expenses active               | `readTabs` active cases + slice 4 verify                                |
| Settings badge on child pages                          | `tabBadge` cases + slice 4 verify                                       |
| Unsaved input: tab tap leaves without prompt           | Slice 5 verify                                                          |
| iOS swipe-back on category detail                      | Slice 4 verify (iPhone)                                                 |
| (What) bar looks and reads the same                    | Slice 4 side-by-side screenshots; VoiceOver label check                 |
| (What) link: Expenses active on category, Home on form | `readTabs` fallback cases + slice 4 and 5 direct-link verify            |

## Not doing (YAGNI)

- Nested per-tab stacks (option 2), and rendering `TabBar` on the tab pages through `Tabs`' `tabBar` prop. Both would
  restyle or restructure the 6 working tab pages.
- `<a href>` tab items on web. The library's items are links so they can open in a new tab. The labels, role and
  selection state match, and that's what the brief asks for.
- Refreshing invites when a child page gains focus. The real bar reloads them on tab focus (`screenListeners`), and a
  child page shows the count loaded last.
- Hiding the bar while the keyboard is up.
- An "unsaved changes" prompt.
- The bar on any other child or modal screen (add/rename/delete category, planned amount, members, income-item).
- A back chevron icon on the expense form, which would be out-of-scope restyling.
- Editing brief/plan 019. They are the historical record, and brief 062 records the reversal. No test, README,
  conventions file or code comment asserts that the bar is hidden on child pages: `rg -i "tab bar"` hits only the 019
  docs and comments that stay true.

## Risks

- **Params dropped:** `dismissTo` with only a path would drop a tab's params. Its payload has empty params, and
  `TabRouter`'s NAVIGATE replaces them (`stateUtils.js:10-30`, `TabRouter.js:205-220`). So Budget and Income would
  jump to the current month, unlike the real bar, which navigates with the route's existing params
  (`BottomTabBar.js:268-271`). Slice 3's `readTabs` params cases and slice 4's month-kept check close this.
- **Linked page:** `dismissTo` from a page opened by link (no `(tabs)` underneath) might not replace the page as
  documented. Slice 4's direct-link check proves or disproves this.
- **Web history:** after a tab tap, expo-router's `fork/useLinking.js:323-351` handles a shorter root stack with
  `history.go(-n)` and then `replace`, so browser back skips the child page. Slices 4 and 5 check this with browser
  back.
- **Visual drift:** the hand-built bar could drift from the library bar. Its metrics are copied from expo-router 57's
  source, and slice 4 compares screenshots on web and iPhone. A future expo-router upgrade could still change the
  library bar, which the `TabBar` header comment notes.
- **Keyboard:** the `KeyboardAvoidingView` sits above the bar on iOS, so it pads only by the keyboard's overlap.
  Slice 5 checks this on iPhone.
- **⋯ menu:** while the category's ⋯ menu is open, the bar stays tappable, so a tab tap leaves the page. That's
  harmless and accepted; slice 4 confirms it.

## Open questions

- no: **Modal or page** (the brief's open question). Decided: a regular pushed page (see Approach). Side effect: the
  form now also has iOS swipe-back, which the plan treats as fine.
- no: Child pages show the same tab list as the tab pages (6 icons, Income included). The brief is updated to say so.
- no: The number clash is resolved: origin/main now has 061-income-edit-copy, so this brief is 062.
- no: Option 2 (Expenses nested stack) would give the library's own bar for less code. The cost is the brief's
  link-case rule: a linked expense form would highlight Expenses, and a linked category would go back to Home. The
  plan assumes the brief's rule stands. If the user relaxes it, re-plan as option 2.

## Follow-ups

- none yet

## Deviations

- slice 5: `readTabs` reads a missing `index` as the first route instead of falling back. After a page load the
  tabs keep the partial state from the URL (`{ routes: [{ name: 'expenses' }], stale: true }`) until a tab is
  switched, so the form opened from Expenses showed Home. Same rule as `TabRouter.getRehydratedState`.

## Consolidate

## Revision 1

Skeptic REVISE, round 1:

- **Blocker:** a tab tap on a child page now keeps Budget's and Income's month. `tabUnder` became `readTabs`, which
  also returns each tab route's params, and `TabBar` passes them to `dismissTo`. Added unit cases, a month-kept
  verify step and a Risks line.
- **Reader:** `TabBar` reads `useNavigationState((s) => s.routes)` instead of calling `getState()` in render, so the
  state-shape risk is gone. The missing-`index` fallback is now stated as deliberate.
- **Slices:** the reader and its tests are now slice 3. The old slices 3 and 4 are now 4 and 5, because the old
  slice 3 would have passed ~150 lines.
- **Other edits:**
  - Approach: the opener sentence now cites the files and lines.
  - Slice 1: dropped the `TABS` uniqueness/href test.
  - Slice 4: added the Undo toast check.
  - Not doing: added that child pages don't refresh invites on focus.
  - `TABS.href` is typed `string`, because the app has no typed routes.

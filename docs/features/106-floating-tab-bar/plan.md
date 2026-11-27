# Plan: Floating tab bar with an add-expense button

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Gate A: skeptic APPROVE WITH EDITS (applied); approved 2026-11-27 under the user's standing OK, open questions as recommended.
Brief: ./brief.md
Branch: feat/floating-tab-bar
Base: origin/main (3899b99, version 1.23.16, after #177)

## Approach

**No split.** The estimate is **≈ 315 lines of code and tests**, and **≈ 350** with the two docs, under 400. That makes
one PR, as the brief expects.

- **One bar component for both kinds of page** (brief open question 2). `TabBar` takes the active tab, each tab's
  params and a tap callback, and draws the tabs plus the "+".
  - The tab pages hand it to the library's navigator through `Tabs`' `tabBar` prop. Taps call the navigator's
    `navigateToTab`, which keeps each tab's params, as the library bar did.
  - The pages above the tabs use `PageTabBar`. It is today's `TabBar` logic moved into a wrapper: `readTabs` plus
    `router.dismissTo`.
  - **Each tab stays a link on web.** It is drawn with expo-router's `PlatformPressable`, as `_layout.tsx` draws the
    library's tabs today. It carries `href={tabHref(tab.href, params[tab.name])}`, for example
    `/budget?month=2026-10`, as the library's `buildHref` gave.
    - A plain click runs `onTabPress`, after the default is prevented.
    - A Cmd-, Ctrl- or Shift-click, or a middle click, is left to the browser, which opens the tab in a new tab.
    - Both kinds of page get the links, from the same params they navigate with, so the pages above the tabs' tabs
      become links too. That's free, and it keeps the two bars identical.
  - So the two bars are the same code. They line up by construction, and the copied library metrics with their
    "recheck after an upgrade" note go. In `_layout.tsx`, the seven library options the bar no longer reads go as well.
- **The look.** The bar floats over the page: `position: 'absolute'`, 20pt (`space.xl`) in from each side, and
  `max(bottom inset, 20)` off the bottom. It is a 56pt pill (`size.tabBar`, new) in `surface` on `shadow.float`.
  12pt (`space.md`) to its right sits a 56pt round "+" in `accent` with a 25pt `onAccent` plus.
  - The tab icons are centred in the pill. They keep today's 31×28 box, 25pt icon and badge.
- **The "+"** calls `usePushOnce()('/expense')`: the form for today's month, with no category.
- **Starting on the last used category** (brief open question 1). After a successful add, the form stores the
  category's id on the device, per ledger, in AsyncStorage (`kopiyka.lastCategory.<ledgerId>`). The theme and the
  ledger choice are stored the same way.
  - `useExpenseDraft` reads it for a new expense and passes it to `useMonthCategories`.
  - That hook already fixes the form's start category from the first list it loads (brief 030). Now that start is
    the stored id when that list has it, otherwise the first quick category, as before.
  - The rule is one pure function, `startCategoryId` in `data/quick.ts`, with a table test.
- **Room for the bar.** `useTabBarRoom()` returns the bar's bottom offset plus 56, plus a 16pt gap.
  - Every scroll view on a page with the bar ends its content that far up.
  - The Undo bar sits there, and `useToastRoom()` adds the toast's height and gap on top.
  - ReorderList stops its edge scrolling at the same line. Otherwise a held row on Budget or Expenses would only
    scroll the list with the finger over the bar, and the last rows would stay hidden under it.

Alternative considered: keep the library bar on the tab pages, restyled through `tabBarStyle`, and wrap it in a dock
that adds the "+". But the pill would hold the library's top-aligned items (`padding: 5`,
`justifyContent: 'flex-start'`), and centring them takes a `paddingTop` worked out from the library's internals. The
child-page copy would then have to copy that too. It is about the same size and keeps two drawings of one bar. That is
the bolt-on, so the single component won. It keeps the links too (Open question 2).

Departures from the library skills:

- **Native tabs.** `vercel-react-native-skills` `navigation-native-navigators` and expo-router's NativeTabs: not used.
  The brief keeps a JS bar so that web and iOS match.
- **`paddingBottom`, not `contentInset`.** `ui-scrollview-content-inset` recommends `contentInset`, but it is iOS-only,
  and react-native-web ignores it. The room is fixed per device and only changes with Budget's Undo bar, as it does
  today.

## Inventory (read from the code on Base)

**The bars.**

- Library bar (`(tabs)/_layout.tsx`, expo-router 58.0.30 `BottomTabBar.js`):
  - in flow under the scenes, 49 + `insets.bottom` high, `bg`, with a hairline top border;
  - items `flex: 1` with `padding: 5`, so the icon sits at the top: a 31×28 box with a 25pt icon and an 18.75pt badge;
  - on web each tab is an `<a href role="tab">`, and on iOS a button labelled "Home, tab, 1 of 6";
  - `accessibilityShowsLargeContentViewer` is on.
- `TabBar` (brief 062) copies those metrics for `expense.tsx` and `category/[categoryId].tsx`.
  - It is a `<div role="tab">` on web, with the same names and `aria-selected`.
  - It has no large-content viewer.
- At 390×844 on web, both bars sit at y 795–844. Each tab is 65 wide, and the icon boxes are at y 800–828.

**Scroll views on pages with the bar, and their bottom room:**

| Page               | Content's bottom room on Base                     | After (web; iPhone adds 14)                 |
| ------------------ | ------------------------------------------------- | ------------------------------------------- |
| Budget             | `paddingBottom: space.xxl` (24); 104 while toast  | 92; 164 while the toast shows               |
| Income, Statistics | 24                                                | 92                                          |
| Expenses           | 24                                                | 92                                          |
| Settings           | 0, and Sign out has `marginBottom: space.xl` (20) | 92, with Sign out's margin gone             |
| category page      | `toastRoom` (104), always                         | 164, always                                 |
| expense form       | `paddingBottom: space.huge` (40)                  | 92                                          |
| Home               | no scroll view (header, invites, card grid)       | unchanged; its last card must end above 752 |

Two other places also need the room:

- **ReorderList:** Budget and Expenses pass `scrollRef`. The edge zone is 56px from the viewport's bottom, now behind
  the bar.
- **UndoToast:** it is drawn at `bottom: space.xxxl` (32) on Home, Budget, the category page and the demo's Home. That
  is y 707–763 at 844.

**What sits over the bar.**

- The category and DateField sheets are `Modal`s, so they cover it.
- The menus are `absoluteFill` layers inside their screen.
  - Statistics' menu stays inside its scene, under the bar, as today.
  - On web, the category page's `zIndex: 2` layer covers the bar. A tap on the bar there only closes the menu.
  - On iOS the bar is the later sibling, so it stays on top, as it is beside the menu today.

**Pages that open `/expense`:**

- Expenses rows and the category page's header use `AddExpenseButton categoryId={…}`.
- A category page row opens `expenseId`.
- With no params, only a typed link opens it today.

**The demo** re-exports `(tabs)/_layout.tsx`, `expense.tsx` and the category page, with its 4 tabs.

- No new module reaches it: `pushOnce.ts`, `TabBar.tsx`, `quick.ts`, the draft hook and AsyncStorage are already in
  `demo-modules.txt`.
- So `check-builds` should need no `--accept`.

## Contracts

- DB: none
- API: none
- App:
  - `theme.ts`: `size` gains `tabBar: 56`, the floating tab bar's height and its "+" button's diameter.
  - `components/TabBar.tsx`:
    - `export function TabBar(props: { active: TabName; params: Partial<Record<TabName, Record<string, string>>>; onTabPress: (tab: TabItem) => void })`.
      - `active` and `params` are what `readTabs` returns. `onTabPress` runs on every plain tab tap, the open tab's
        included.
      - It draws `useTabItems()`'s tabs with today's roles, names, `aria-selected` and badge. It adds
        `accessibilityShowsLargeContentViewer` and `accessibilityLargeContentTitle={label}`, as the library bar
        does with its `labelString` (`BottomTabItem.js`), so the invite count stays in it. It also draws the "+".
      - Each tab is a `PlatformPressable` (from `expo-router/react-navigation`), with:
        - `href={tabHref(tab.href, params[tab.name])}`;
        - `pressOpacity={pressedOpacity}`;
        - `role={Platform.select({ ios: 'button', default: 'tab' })}`. The component spreads `...rest` after its own
          `role: 'link'`, so `tab` wins, as it does for the library's tabs today.
      - On web, `PlatformPressable` prevents the default and calls `onPress` only for a plain left click on a
        self-target link. Any other click goes to the browser. On iOS `href` is ignored, and every press calls
        `onPress`.
    - `export function PageTabBar({ fallback }: { fallback: TabName })`. This is today's `TabBar`: it reads
      `useNavigationState(s => s.routes)` and `readTabs(routes, fallback)`. It passes `active` and `params`, and a tap
      calls `router.dismissTo(params ? { pathname: tab.href, params } : tab.href)`.
    - `export function useTabBarRoom(): number` returns `barBottom(insets.bottom) + size.tabBar + space.lg`. The
      private `barBottom(inset)` is `Math.max(inset, space.xl)`. On web that is 92, and 106 on an iPhone with a 34pt
      inset.
    - Styles (final):
      - `dock`: `{ position: 'absolute', left: space.xl, right: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.md, pointerEvents: 'box-none' }`,
        plus an inline `bottom`;
      - `pill`: `{ flex: 1, flexDirection: 'row', height: size.tabBar, borderRadius: radius.pill, backgroundColor: colors.surface }`;
      - `item`: `{ flex: 1, alignItems: 'center', justifyContent: 'center' }`;
      - `add`: `{ width: size.tabBar, height: size.tabBar, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }`;
      - pill and add both take an inline `{ boxShadow: shadow[scheme].float }`;
      - `role="tablist"` goes on the `pill` view, not the `dock`. The "+" is the dock's second child, outside the
        tablist;
      - the icon box, icon and badge styles stay as on Base.
    - "+": `<Pressable accessibilityRole="button" accessibilityLabel="Add expense" onPress={() => pushOnce('/expense')}>`
      around `<Icon name="plus" color={colors.onAccent} size={ICON_SIZE} />`.
  - `app/(tabs)/_layout.tsx`:
    - it imports `readTabs` (and `TabItem`) from `@/data/tabItems`, which the demo swaps, and never from `@/tabs`:
      `buildCheck.mts` bans both `src/data/tabItems.ts` and `src/tabs.ts` from the demo bundle;
    - `tabBar={({ state, navigateToTab }) => <TabBar {...readTabs([{ name: '(tabs)', state }], 'index')} onTabPress={…} />}`.
      The comment says that `readTabs` reads the tab navigator's state as the root stack holds it, so both bars get
      the active tab and the string params from one tested function;
    - on a tap, find the route whose `name` is `tab.name`, and if it isn't the focused one (`state.index`), call
      `navigateToTab(route.key)`;
    - no `tabPress` event is emitted, because nothing in the app listens for it (Not doing);
    - `screenOptions` keeps `headerShown: false` and `sceneStyle`. `Tabs.Screen` keeps `name` and `title`, which gives
      the web page title;
    - the following go, with the imports they used: `tabBarShowLabel`, the two tint colours, `tabBarStyle`,
      `tabBarButton`, `tabBarLabel`, `tabBarAccessibilityLabel`, `tabBarBadge`, `tabBarBadgeStyle` and `tabBarIcon`.
  - `components/UndoToast.tsx`:
    - `toastRoom` (the constant) is replaced by `export function useToastRoom(): number`, which returns
      `useTabBarRoom() + size.toast + space.lg`;
    - the toast's `bottom: space.xxxl` becomes an inline `bottom: useTabBarRoom()`.
  - `components/ReorderList.tsx`: a new required prop, `bottomInset: number`, the scroll view's bottom that the
    floating bar covers.
    - `edges.bottom = scrollY + viewportHeight - bottomInset`;
    - `maxOffset = Math.max(offset, listBottom - (viewportHeight - bottomInset))`.
  - `src/tabRoutes.ts`: `export function tabHref(path: string, params?: Record<string, string>): string`.
    - It returns `path` with no params, else `` `${path}?${key}=${value}&…` `` with each key and value through
      `encodeURIComponent`, in the params' order. For example, `tabHref('/budget', { month: '2026-10' })` is
      `'/budget?month=2026-10'`.
    - It uses no `URLSearchParams`: Hermes' copy of it is partial, and the function runs on iOS too.
  - `data/quick.ts`: `export function startCategoryId(lastUsedId: number | null, categories: Category[], quickIds: number[]): number | null`.
    It returns `lastUsedId` when `categories` has it, else `quickIds[0] ?? null`.
  - `data/useMonthCategories.ts`:
    - the signature becomes `useMonthCategories(ledgerId, month, lastUsedId: number | null = null)`;
    - `firstQuickId` is renamed `startId`: `startCategoryId(lastUsedId, …)` on the first list that loads, then fixed;
    - Budget's call doesn't change.
  - `data/useExpenseDraft.ts`:
    - `ExpenseDraftData` gains `lastUsedId: number | null`. For a new expense it is the stored id, through
      `parseIdParam(raw ?? undefined)`, and `null` for an edit or when nothing readable is stored;
    - `export function rememberLastCategory(ledgerId: number, categoryId: number): void` does
      `AsyncStorage.setItem(key, String(id)).catch(() => {})`;
    - the key is `kopiyka.lastCategory.${ledgerId}`, a module-level helper.
  - `app/expense.tsx`:
    - it calls `useMonthCategories(ledgerId, month, draft.lastUsedId)` and `selectedId = categoryId ?? list.startId`;
    - after a successful add, and not after an update, it calls `rememberLastCategory(ledgerId, saved.categoryId)`;
    - `<PageTabBar fallback="index" />`.
  - `app/category/[categoryId].tsx`: `<PageTabBar fallback="expenses" />`, and `paddingBottom: useToastRoom()` inline.
- Reuses:
  - `usePushOnce`, `useTabItems`/`readTabs` (now for both bars), `Icon`, `Pressable` (brief 066);
  - `PlatformPressable` with `pressOpacity={pressedOpacity}`, exactly as `_layout.tsx`'s `tabBarButton` uses it on Base;
  - `useAppearance().scheme` with `shadow[scheme].float`, as UndoToast does;
  - `parseIdParam` for the stored string;
  - AsyncStorage, as `AppearanceContext` and `AuthContext` use it;
  - the existing `monthPicker`, which puts a start category from "More" into the quick row;
  - 105e's snapshot script and comparison.
- New dependencies: none.

## Version

Bump: minor — 1.23.16 → 1.24.0
Why: this is §8b's `minor` row, "new user action": a "+" on every tab and on the pages above them opens the form, on
the last used category. Everything that exists keeps working.

- No API, data or connector change.
- The rows' "+" are unchanged.
- On web, the tab pages' tabs stay links (Open question 2).

## Slices

- [x] 0. Bump version to 1.24.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.24.0
- [x] 1. Record the floating tab bar's size and place in the design system (≈ 16 lines, docs)
  - Files: `docs/design/design-system.md`
  - Change:
    - Control heights gains `tabBar 56` (the floating tab bar and its "+").
    - The Components row loses "(later)" and reads: `TabBar` | floating pill, 56 high, `surface` on `shadow.float`,
      beside a round 56pt "+" in `accent` with an `onAccent` icon. Prettier re-pads the table, because "(later)" made
      the first column its width.
    - Under the table, one sentence: the bar floats 20pt in from each side and 20pt off the bottom, or the home
      indicator's inset where that's more, with the "+" 12pt to its right. Scroll views leave that room plus 16pt
      under their content, and the Undo bar sits 16pt above the bar.
  - Verify: `yarn format:check`.
- [ ] 2. Start a new expense on the category of the last one added in this ledger (≈ 60 lines)
  - Files: `src/data/quick.ts`, `test/quick.test.ts`, `src/data/useMonthCategories.ts`, `src/data/useExpenseDraft.ts`,
    `src/app/expense.tsx`
  - Change:
    - Code as in Contracts.
    - `useMonthCategories`' JSDoc says what `startId` is: the last used category when the first list has it, else
      that list's first quick one, fixed afterwards so it doesn't follow the date (brief 030). The effect's deps gain
      `lastUsedId`.
    - The draft's read falls back to `null` on a storage error, with the comment "an unreadable store starts the form
      as if nothing was stored". The write's empty `catch` gets the AppearanceContext comment: a failed write only
      loses the start.
  - Tests: `quick.test.ts` › `startCategoryId`, a table of `[lastUsed, month's ids, quick row, expected]`:
    - last used in the quick row → it;
    - last used in "More" → it;
    - not in the month → the first quick;
    - `null` → the first quick;
    - not in the month with an empty quick row → `null`;
    - an empty month → `null`.
  - Verify (web):
    - add an expense from Expenses' O row, then open `/expense`: O is selected, and localStorage
      `kopiyka.lastCategory.<ledgerId>` holds O's id;
    - set the key to `999999`: the first quick category;
    - `/expense?categoryId=<N>`: N;
    - updating an expense leaves the key alone.
- [ ] 3. Draw the tab pages' bar with the same component as the pages above them, each tab still a link (≈ 80 lines)
  - Files: `src/components/TabBar.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/expense.tsx`,
    `src/app/category/[categoryId].tsx`, `src/tabRoutes.ts`, `test/tabs.test.ts`
  - Change:
    - `TabBar` takes `active`, `params` and `onTabPress`, and gains the large-content props.
    - Each tab is a `PlatformPressable` with `href={tabHref(…)}`, in place of `Pressable`. Its comment says that the
      tabs stay links on web, so a Cmd-click or middle click opens one in a new browser tab, while a plain click
      navigates in the app.
    - `tabHref` goes in `tabRoutes.ts`, with JSDoc.
    - `PageTabBar` holds the moved `useNavigationState`, `readTabs` and `dismissTo`, with 062's JSDoc.
    - `_layout.tsx` renders `TabBar` through `tabBar`, as in Contracts, with the comment "One bar for both kinds of
      page (brief 106), so a tab page and a page above it draw the same bar".
    - The two pages render `PageTabBar`.
    - The look doesn't change: the bar stays in flow, edge to edge, 49 + inset.
  - Tests: `tabs.test.ts` › `tabHref`, a table:
    - `('/budget', undefined)` → `'/budget'`;
    - `('/budget', {})` → `'/budget'`;
    - `('/budget', { month: '2026-10' })` → `'/budget?month=2026-10'`;
    - `('/x', { a: 'b c', d: 'e&f' })` → `'/x?a=b%20c&d=e%26f'`.
  - Verify: typecheck and lint. On web at 390×844, with real clicks:
    - every tab switches;
    - Budget keeps its month after Income and back;
    - a tap on the open tab does nothing;
    - each tab is an `<a>` whose `href` is the library's on Base: `/budget?month=…` once Budget has a month;
    - a Cmd-click on a tab opens it in a new browser tab, and the app's own tab doesn't move;
    - the same holds on the category page's bar;
    - on `budget`, the tab and icon boxes match Base's (one snapshot);
    - `rg -n "tabBar(Icon|Badge|Button|Label|Style)" apps/mobile/src` finds nothing.
- [ ] 4. Float the tab bar as a pill over the page, with every list's room and the Undo bar above it (≈ 95 lines)
  - Files: `src/theme.ts`, `src/components/TabBar.tsx`, `src/components/UndoToast.tsx`, `src/app/(tabs)/budget.tsx`,
    `income.tsx`, `expenses.tsx`, `statistics.tsx`, `settings.tsx`, `src/app/category/[categoryId].tsx`,
    `src/app/expense.tsx`
  - Change:
    - `size.tabBar`.
    - TabBar's `dock` and `pill` (no "+" yet, so the pill runs 20–370), and `barBottom` and `useTabBarRoom` with
      JSDoc. `BAR_HEIGHT`, the hairline and the item's `padding: 5` go. The metrics comment becomes "Today's icon and
      badge sizes, from the library bar the tab pages drew before brief 106".
    - UndoToast's `useToastRoom` and its inline `bottom`.
    - Each listed screen calls the hook at the top of its component and puts `{ paddingBottom: … }` inline on its
      scroll content. The old bottom padding goes: 24 on Budget, Income, Expenses and Statistics; Budget's
      `toastRoom` style; the category page's 104 (now `useToastRoom()`); the expense form's 40; and Settings' Sign
      out `marginBottom`. Settings' padding gets the one-line comment "The floating tab bar's room, which also keeps
      Sign out above it".
    - Budget keeps `toast.offer ? toastRoom : barRoom` in one `bottomRoom`. Its comment becomes "Room under the last
      row, so neither the tab bar nor the Undo bar covers it".
    - The expense form's "The tab bar pads the bottom inset." becomes "The tab bar floats over the bottom inset."
  - Verify: typecheck and lint. At this commit, on web at 390×844:
    - the pill is at x 20–370, y 768–824 (full width, since there's no "+" yet);
    - on Budget scrolled to the end, the last row ends at 752;
    - the Undo bar is at y 696–752;
    - Settings' Sign out ends at 752.
  - Also: Visual check B–E on the finished branch. `rg -nw toastRoom apps/mobile/src` finds only Budget's local
    `toastRoom` (from `useToastRoom()`): the exported constant and its imports are gone.
- [ ] 5. Keep a held row's edge scrolling above the floating tab bar (≈ 16 lines)
  - Files: `src/components/ReorderList.tsx`, `src/app/(tabs)/budget.tsx`, `src/app/(tabs)/expenses.tsx`
  - Change:
    - the `bottomInset` prop, its JSDoc and the two edge lines;
    - Budget passes `bottomRoom`, and Expenses passes `useTabBarRoom()`'s value;
    - the `maxOffset` comment says the list's end is brought above the bar.
  - Verify: typecheck. Gate B: on iPhone, hold a row on Expenses (seeded long) and move it down toward the bar. The list
    scrolls once the finger is within 56pt above the bar, and the last row can be dropped last. Synthetic drags don't
    fire on web, so this is an iPhone check.
- [ ] 6. Add a round "+" beside the tab bar that opens the add-expense form (≈ 22 lines)
  - Files: `src/components/TabBar.tsx`
  - Change: the `add` Pressable and style, `usePushOnce`, `colors.onAccent`, and the dock's `gap`. It has a one-line
    JSDoc on why it carries no category: the form starts on the last used one.
  - Verify, on web with real clicks:
    - "+" on Budget, on an ended month's Budget, on the category page and on the expense form opens a new form for
      today;
    - Back returns, and "+" opens it again (Risk 1);
    - a double click opens one form.
- [ ] 7. Mark 106 done in the backlog, after 105e (≈ 18 lines, docs)
  - Files: `docs/features/BACKLOG.md`
  - Change:
    - Snapshot: `main` at v1.23.16 (`3899b99`, after PR #177: brief 105e is done).
    - In progress: none. The design roll-out (103–106) is complete. Next is not chosen yet: see the Planned sections
      (Open question 6).
    - Recently finished gains "106 · The floating tab bar and its "+" (done: v1.24.0)", with one line: a pill tab bar
      and a round "+" on every page with tabs, which opens the form on the last used category.
    - In the roll-out table, 106 says done. The "The 106 brief is a **draft**…" sentence goes.
  - Verify: `yarn format:check`. After `gh pr create`, the PR number goes into both 106 lines in one docs commit, as
    105e did.

Total ≈ 350 lines: docs ≈ 34 (slices 1 and 7), code and tests ≈ 315 (slices 2–6: 60 + 80 + 95 + 16 + 22 = 273, plus
≈ 40 for JSDoc and comments the estimates leave out).

## What moves (the PR lists this; web at 390×844, insets 0)

- **The bar:**
  - it goes from edge to edge at y 795–844 (49, `bg`, hairline top) to a pill at x 20–302, y 768–824 (56, `surface`,
    no edge), with the light shadow or the dark ring;
  - tabs go from 65 to 47 wide, and the icon boxes from y 800–828 to y 782–810 (18 up). Each icon moves sideways too:
    tab _i_'s centre goes from 32.5 + 65*i* to 43.5 + 47*i*;
  - on iPhone the pill's bottom is 34pt off the screen's bottom.
- **The "+":** new, at x 314–370, y 768–824.
- **Scroll views** run to the screen's bottom, under the bar. Their bottom room changes as in the Inventory table. No
  row above a list's end moves.
- **Settings:** Sign out, pinned to the bottom when the page doesn't scroll, goes from bottom 775 to 752 (23 up).
- **The Undo bar:** from y 707–763 to 696–752 (11 up), 16pt above the pill.
- **Home:** nothing moves.
- **Web tab elements:** the tab pages' tabs stay `<a href role="tab">`, with the same hrefs, names and `aria-selected`.
  The child pages' tabs go from `<div role="tab">` to the same `<a href role="tab">`.

## Visual check (AC1, AC2, AC5, AC6; not counted in the line estimates)

**Set-up**, as in 105e's Visual check and its Deviations:

- **Servers:**
  - the API on 3000, the web app on :8084 opened at `http://127.0.0.1:8084`, and `web-demo` on 8082;
  - both git-ignored `.env` files copied in, and `yarn install` run in each worktree;
  - `DATABASE_URL_TEST` from the main checkout's `apps/api/.env`;
  - stop one server before starting the next.
- **Two sets, on one Kyiv day:**
  - `before`: a detached worktree of Base (3899b99) on :8084;
  - `after`: the branch at slice 6;
  - from 1 December, seed `2026-12`, and if it's also before the 3rd, put the expenses on the 1st.
- **Clear first:** delete every older `snap:*` key, and any `kopiyka.lastCategory.*` key, from localStorage on
  127.0.0.1:8084.
- **QA users**, created before `before` and deleted when the brief is done:
  - `claude-qa-106`, the owner;
  - `claude-qa-106-m`, made with `--join claude-qa-106`, for a member's Settings;
  - `claude-qa-106-n`, made with `--ledger "QA N"`. It invites the owner, which gives the badge views; the owner
    accepts after them, which gives the per-ledger check.
- **Seeding**, once, as the owner, through the API, after checking that the month is empty. It repeats 105e's steps:
  - income: Salary €1000 and Bonus €50;
  - U, N and O planned at €100;
  - expenses on the 3rd: €6 and €4 (U), €95 (N) "Market", €109 (O);
  - an actual End of €900.
- **Additions**, so Budget, Expenses and U's page run past the bar:
  - seven more of the month's categories at €10 each;
  - twelve €1 expenses in U, "Coffee 1" to "Coffee 12", on the same day.
- **API calls:** login sends a `deviceId` of 8–64 characters, and a DELETE with no body sends no JSON content type.
  TOTP codes come from a scratch script outside the repo and are never printed. Each sign-in waits for a fresh window.

**Views**, each in Light and Dark, in both sets unless marked:

- `home`, `home-badge` (the invite pending)
- `budget`, `budget-end` (scrolled to the end), `budget-undo` (U removed through its form, then Undo), `budget-ended`
  (2026-10)
- `income`, `statistics`
- `expenses`, `expenses-end`, `expenses-ended` (2026-10: the rows have no "+", the bar does)
- `settings`, `settings-badge`, `settings-member` (as `-m`)
- `category` (U), `category-end`, `category-undo`
- `expense-new` (`/expense`, no key stored), `expense-row` (`/expense?categoryId=<N>`), `expense-added`,
  `expense-edit`
- after only:
  - `expense-last-used`: `/expense` after an add in O;
  - `expense-fallback`: the key set to `999999`.

**Taking them:**

- Each page loads in a same-origin 390×844 iframe, the same for both sets.
- Each snapshot uses 105e's script (104h's `__snapSrc` with the `boxShadow`, border width and border colour columns),
  is saved as JSON in the system temp dir, and its key is deleted.
- A screenshot of each view in each scheme, in both sets, goes in the PR.

**Comparison** (Node, over the saved files):

- **A. Same content.** On every view and scheme:
  - the text leaves are equal and in order, and the type columns are equal;
  - the `a11y` arrays are equal, except that every bar view gains one `button` "Add expense" after the tabs, and that
    the tabs on the child pages (`category*`, `expense-*`) go from tag `div` to `a`, with the same role, name and
    `aria-selected`;
  - on `expenses` the rows' "Add expense" buttons are unchanged.
- **B. The bar** (`after`, every bar view):
  - the pill is x 20, y 768, 282×56, radius `999px`, with no border;
  - its background is `surface` (light `rgb(255, 255, 255)`, dark `rgb(24, 23, 29)`), and its `boxShadow` is
    `rgba(17, 16, 20, 0.12) 0px 4px 24px 0px` in light and `rgba(237, 236, 242, 0.06) 0px 0px 0px 1px` in dark;
  - six tabs, each 47 wide, with a 31×28 icon box centred, at y 782;
  - the "+" is x 314, y 768, 56×56, `accent` (light `rgb(109, 74, 255)`, dark `rgb(160, 140, 255)`), with the same
    shadow;
  - the badge on `home-badge` and `settings-badge` sits at the Settings icon box's top-right, −3.
- **C. Lines up.** The pill, tab, icon-box and "+" boxes are equal on `budget`, `category` and `expense-new`.
- **D. Room.**
  - Each scroll content's `paddingBottom` is 92, and 164 on the `category*` views and on `budget-undo`.
  - On `budget-end` and `expenses-end` the last row ends at 752. On `category-end` it ends at 680.
  - On `home` and `home-badge`, the last card ends at or above 752.
- **E. Undo bar** (`budget-undo`, `category-undo`): y 696–752.
- **F. Start category** (`after`):
  - the selected tile is O on `expense-last-used`, the month's first quick category on `expense-fallback` and
    `expense-new`, and N on `expense-row`;
  - after the add, localStorage holds O's id under `kopiyka.lastCategory.<ledgerId>`.
- **G. Everything else.** Every other leaf that moves more than 2pt is listed against What moves. A move with no
  cause there is a finding, fixed before the PR.
- **H. Links.** The snapshot records each tab element's tag and `href` (a column is added to the script if it lacks
  one). In `after`, on every bar view, each of the six tabs is an `a` with `role="tab"`:
  - on the tab pages, its `href` equals Base's for the same view, e.g. the Budget tab is `/budget?month=2026-10` on
    `budget-ended`;
  - on the child pages, it is `tabHref` of that tab's path and params. Loaded straight from a URL with no tabs
    underneath, those are `/`, `/income`, `/budget`, `/expenses`, `/statistics` and `/settings`;
  - the "+" is not a link.

**Real clicks** (synthetic presses don't fire on react-native-web), in the browser pane:

- every tab on `budget` and on `category`;
- a Cmd-click and a middle click on the Budget tab, from `income` and from `category`, open Budget in a new browser
  tab with its month, while the app's page stays where it was;
- "+" on Home, `budget-ended`, `category` and `expense-new` (each a new form for today; Back returns);
- a double click on "+";
- a row's "+" on `expenses`, which opens that category;
- per ledger: accept `-n`'s invite and switch to "QA N", where "+" starts on its first quick category. Switch back,
  and it starts on O.

**Demo:** run `web-demo` in Light and Dark with the console open. Visit Home, Budget, Income, Expenses, a category page,
the expense form opened from the bar's "+" (once after an add), and the Undo bar after removing a category: there
should be no errors. Then run `yarn mobile export:web` and `yarn mobile check-builds`. No `--accept` is expected; if the
module list changes, accept it and put the diff in the PR.

**Gate B, iPhone (Expo Go)**, both themes:

- the pill clears the home indicator, and its sides are 20pt in;
- taps on every tab and on "+" from a tab page and from the category page;
- VoiceOver reads "Budget, tab, 3 of 6" and "Add expense, button";
- a long press on a tab at the largest text size shows the large-content viewer;
- the last row of Budget, Expenses and U's page scrolls above the bar, and the Undo bar sits above it;
- the expense form's keyboard covers the bar and nothing jumps;
- slice 5's drag;
- swiping back from the category page to Expenses, the bar doesn't jump.

## AC → evidence

| AC (brief)                                                                         | Evidence                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| AC1 floating pill, `shadow.float` (ring in dark), same tabs, a11y names; line up   | slices 3–4; `tabs.test.ts` › `tabHref`; Visual check A, B, C, H; Cmd-click; Gate B |
| AC2 "+" named "Add expense" on all those pages, every month; opens today's form    | slice 6; Visual check A, B (`budget-ended`, `expenses-ended`); real clicks         |
| AC3 starts on the last used category when today's month has it; unit-tested        | slice 2: `quick.test.ts` › `startCategoryId`; Visual check F; per-ledger           |
| AC4 Expenses rows keep their "+" for that row's category and month                 | no change to the rows or `AddExpenseButton`; Visual check A, F; real click         |
| AC5 every list's last row scrolls above the bar; Undo bar above it                 | slices 4, 5; Visual check D, E; Gate B (scroll and drag)                           |
| AC6 before/after 390×844 light and dark; moves over 2pt listed; demo; check-builds | Visual check (24 views + 2 after-only, × 2 schemes × 2 sets); G; Demo              |
| AC7 iPhone: safe area, taps, both themes                                           | Gate B                                                                             |
| AC8 gates                                                                          | every slice                                                                        |

## Not doing (YAGNI)

- **Emitting `tabPress`.** No listener exists in the app (`rg tabPress apps/mobile/src`). Expo-router's own listeners
  are for stacks nested in tabs, and there are none.
- **`scrollIndicatorInsets`** to keep iOS scroll indicators above the bar (Follow-ups).
- **Syncing the last used category, or keeping it per user** (brief Out of scope; Open question 1).
- **Removing the category page's header "+"** (Open question 5).
- **NativeTabs, new tabs, or a change in order or icons** (brief Out of scope).
- **Hiding the bar while the keyboard is up.** The iOS keyboard already covers it, and web has none.

## Risks

1. **Hooks in the tab bar outside a scene.** `usePushOnce` uses `useFocusEffect`, which needs a navigation context. The
   `tabBar` element renders inside the `(tabs)` route of the root stack, so it should see that route's focus. Slice 6
   proves it: "+", Back, "+" again opens the form. If it doesn't, the fallback is a plain in-flight `useRef` reset on
   the next press, recorded in Deviations.
2. **The iPhone inset.** With 34pt the room is 106. Gate B checks the pill against the home indicator, and the last
   rows and the Undo bar against the pill.
3. **Home doesn't scroll.** With an invite card, its last card must still end above the bar. Visual check D measures
   `home-badge`. If it runs under, that's reported, not fixed here (Follow-ups).
4. **Tight tabs on narrow phones.** At 375pt each tab is (375 − 40 − 56 − 12) / 6 = 44.5 wide, just over 44. At 390 it
   is 47. Gate B taps every tab. At 360 wide (a common Android browser width) each tab is (360 − 108) / 6 = 42,
   under §5's 44pt target, though the 56pt height keeps the tap area. This is accepted for now and noted in the PR.
5. **The category menu on web** covers the bar, so a tap there only closes the menu. On iOS the bar stays tappable, as
   it is today on every page. This is harmless; it's noted in the PR.
6. **The dark ring** on the pill and "+" may be faint, as 105e found for the toast. The 3× zoom of a dark `after`
   screenshot records what shows.
7. **The day.** Both sets are taken on one Kyiv day (Set-up).
8. **Main moves:** if another PR takes 1.24.0, rebase, take main's number and bump once more (§8b).

## Open questions

The user is away and Gate A is pre-approved, so the recommended answers are used. **None needs a product decision**
that the brief and the user's 2026-11-26 decisions don't settle.

1. **Blocking: no. Where "last used" is kept (brief open question 1).** Recommended:
   - AsyncStorage on the device (localStorage on web), keyed `kopiyka.lastCategory.<ledgerId>`, beside `kopiyka.theme`
     and `kopiyka.ledger.<userId>`;
   - it's written after every successful add from the form (a row's "+" included), never on an update;
   - it's read when the form opens with no expense and no category: the bar's "+", or a bare `/expense` link;
   - it's per ledger, not per user, as the brief words it ("from this device in this ledger").
2. **Resolved: keep the links. One component (brief open question 2).** Both bars use `TabBar` (Approach), and each
   tab stays an `<a href>` on web, as on Base (coordinator's revision, 2026-11-27).
   - So a Cmd-click or middle click still opens a tab in a new browser tab, and hovering still shows the URL.
   - The pages above the tabs get the same links from the same component, at no extra cost, so the two bars stay
     identical.
   - Roles, names, `aria-selected`, Enter on a focused tab and iOS's large-content viewer all stay.
3. **Blocking: no. Sizes (brief open question 3).** Recommended:
   - the pill and "+" are both 56 (a new `size.tabBar`, the toast's height, so the two floating pieces match);
   - the sides are at the screens' 20pt gutter, where the cards and the Undo bar already sit;
   - the "+" is 12pt from the pill;
   - the bottom is the home indicator's inset, or 20 where there's none;
   - the icons keep today's 25.
4. **Blocking: no. "+" on the expense form** pushes a second, fresh form, and Back returns to the first. The brief
   says it shows wherever the bar shows.
5. **Blocking: no. The category page keeps its header "+"**, which adds to that category, next to the bar's "+", which
   uses the last used one. The brief changes neither. Both are named "Add expense", like the rows on Expenses.
6. **Blocking: no. The backlog's "next"** after 106 isn't chosen. Slice 7 points at the Planned sections, and the user
   picks.

## Follow-ups

- iOS scroll indicators run under the bar. `scrollIndicatorInsets={{ bottom: room }}` on each scroll view would lift
  them.
- If Visual check D finds Home's cards under the bar with invites, Home needs a ScrollView (not briefed).
- The design doc's 16pt screen gutter against the code's 20 (from 105c) is still open. The bar takes the code's 20.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

## Revision 1

The coordinator's request was that the tab pages' web tabs stay links.

- Slice 3 (≈ 65 → ≈ 80 lines) now draws each tab as a `PlatformPressable` with `href={tabHref(tab.href, params)}`, on
  both bars.
- `TabBar` takes `readTabs`' `active` and `params` from both callers.
- `tabHref` is new in `tabRoutes.ts`, with a table test in `tabs.test.ts`.
- Visual check A and H, the real clicks and AC1's evidence check the links.
- Open question 2 is resolved. The Version line, Not doing, What moves and Follow-ups follow from that.
- The total goes from ≈ 335 to ≈ 350 lines. Nothing else changed.

## Revision 2

These are the skeptic's edits (APPROVE WITH EDITS):

- `_layout.tsx` imports `readTabs` and `TabItem` from `@/data/tabItems` only.
- The large-content title is `label`.
- `role="tablist"` is on the pill, and the "+" sits outside it.
- Slice 4 gains its own web checks at 390×844.
- Risk 4 gains the 360-wide note.

I also took three of the skeptic's suggestions:

- The ReorderList slice now comes right after slice 4, so the old slices 5 and 6 swapped numbers.
- Slice 4's `rg` expectation is reworded.
- Settings' padding gets its comment.

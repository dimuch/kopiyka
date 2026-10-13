# Plan: Home screen and tab navigation

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/home-tabs
Base: origin/main @ 731c9e3

## Approach

A `(tabs)` group gets a JS bottom-tab layout with five routes: `index` (Home, `/`), `budget`, `expenses`, `statistics`
and `settings`. Today's `app/index.tsx` moves unchanged to `app/(tabs)/expenses.tsx` (`git mv`). Category detail and the
expense form stay in the root `Stack`, above `(tabs)`, so they cover the tab bar. iOS swipe-back keeps working, and the
form stays a modal, so brief 020 only has to drop `presentation: 'modal'`. Home reuses `useMonth` for the current Kyiv
month and `sumCents` for its figures. Budget, Statistics and Settings share one small `PlaceholderPage`. A last slice
turns `AddExpenseButton` from the floating button into a "+" icon button. It then sits at the right end of the header on
Expenses and on category detail. The slice keeps its two callers and its `categoryId` prop.

**JS `Tabs` from `expo-router/js-tabs`, not `NativeTabs`.** Checked against the installed expo-router 57.0.24 (read in
`/Users/dmytro.kostylov/home/kopiyka/node_modules/expo-router`):

- On web, `NativeTabs` (`expo-router/unstable-native-tabs` → `build/native-tabs/NativeTabsView.web.js`) renders a Radix
  tab list that shows only each tab's `title` text, with no icons. `assets/native-tabs.module.css` pins it at the top of
  the window (`.navigationMenuRoot { position: fixed; top: 24px; left: 50% }`), outside the phone column from brief 008.
  The docs say: "On web, native tabs fall back to a basic implementation, loosely based on iPad design"
  (docs.expo.dev/router/advanced/native-tabs). Native icons must be SF Symbols, Material symbols or images (`sf`, `md`,
  `src`), not our SVG `Icon`. Hiding the bar on child pages needs a context and the `hidden` prop. Using it would mean
  writing a second, web-only tab layout.
- JS `Tabs` (`build/layouts/Tabs.js` → vendored `build/react-navigation/bottom-tabs`) work the same way on web and iOS.
  `tabBarIcon` takes any React node, so we can pass `Icon`. On web every tab item is an `<a href>` with `role="tab"` and
  `aria-selected` (`views/BottomTabItem.js:100-109`). The bar is in-flow at the bottom of `BottomTabView`, so it stays
  inside `PhoneColumn`. The label position comes from the container's frame (`useFrameSize`), and labels go "beside icon"
  only at ≥ 768 wide (`BottomTabBar.js:63`).
- Import path. The docs example uses `import { Tabs } from 'expo-router'` ("In SDK 56 and later, JavaScript tabs are
  bundled with Expo Router", docs.expo.dev/router/advanced/tabs). But the installed `build/exports.d.ts:41-44` marks that
  export `@deprecated Use import { Tabs } from 'expo-router/js-tabs' instead`. `expo-router/js-tabs` (package root
  `js-tabs.js`/`.d.ts`, and the package has no `exports` map) re-exports the same `build/layouts/Tabs`. The plan follows
  the installed types.
- This departs from the vendored `expo-router` skill, which says "Always prefer NativeTabs" and nests a Stack inside
  each tab. The reasons are web parity (conventions §8a: "NativeTabs … need a web fallback") and the brief's note that
  child routes stay in the root Stack.

Alternative considered: `NativeTabs` on iOS plus a `_layout.web.tsx` with headless `expo-router/ui` tabs on web. That
means two tab bars to build and keep in sync, SF Symbols that don't match the 24×24 stroke icon set, and a context to
hide the bar on child pages. It costs more and no AC needs it.

## Contracts

- DB: none. API: none.
- App routes (Expo Router, `apps/mobile/src/app`):

  | File                    | URL           | Navigator                           |
  | ----------------------- | ------------- | ----------------------------------- |
  | `(tabs)/_layout.tsx`    | —             | `Tabs` (`expo-router/js-tabs`)      |
  | `(tabs)/index.tsx`      | `/`           | tab 1 Home                          |
  | `(tabs)/budget.tsx`     | `/budget`     | tab 2 Budget                        |
  | `(tabs)/expenses.tsx`   | `/expenses`   | tab 3 Expenses (moved `index.tsx`)  |
  | `(tabs)/statistics.tsx` | `/statistics` | tab 4 Statistics                    |
  | `(tabs)/settings.tsx`   | `/settings`   | tab 5 Settings                      |
  | `category/[categoryId]` | unchanged     | root `Stack` (covers tab bar)       |
  | `expense`               | unchanged     | root `Stack`, `presentation: modal` |

  The root `_layout.tsx` `Stack.Protected guard={signedIn}` lists `(tabs)`, `category/[categoryId]` and `expense`, in
  that order. `(tabs)` replaces `index`, so signing in still lands on `/`, which is Home.

- Tab layout options. `screenOptions`: `headerShown: false`, `tabBarShowLabel: false`,
  `tabBarActiveTintColor: colors.accent`, `tabBarInactiveTintColor: colors.muted`,
  `tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border }`, `sceneStyle: { backgroundColor: colors.bg }`.
  Each `Tabs.Screen` sets `title` (Home, Budget, Expenses, Statistics, Settings),
  `tabBarAccessibilityLabel: Platform.OS === 'web' ? title : undefined` and
  `tabBarIcon: ({ color, size }) => <Icon name=… color={color} size={size} />`. Without labels the tab bar sets no
  `aria-label` on web (`BottomTabBar.js:283-287`), so web needs the explicit label. On iOS, leaving it `undefined` keeps
  the library default for VoiceOver ("Home, tab, 1 of 5"). A one-line comment on the branch says why.
- `components/Icon.tsx`: `PATHS` gains `home`, `budget`, `expenses`, `stats` and `settings`. These are path-only `d`
  strings, because `Icon` renders only `<Path>`, so circles are written as two arcs. They use the 24×24 grid, stroke
  only, round caps, like the existing set. Motifs: a house, a wallet, a receipt, a bar chart, and sliders. The `IconName`
  union grows to match.
- `components/PlaceholderPage.tsx`: `export function PlaceholderPage({ title, children }: { title: string; children?: ReactNode })`.
  It renders a top-edge `SafeAreaView` with the screen padding, the title (`fonts.display` 22, like the `month` style),
  "Coming soon." (muted), then `children`. Its callers are `budget.tsx`, `statistics.tsx` and `settings.tsx`, plus `index.tsx`
  until slice 3. It doesn't read auth. Settings passes in the sign-out button.
- Home (`(tabs)/index.tsx`): `month = useState(() => kyivMonth(new Date()))`, `{ data } = useMonth(ledger.ledgerId, month)`,
  `{ user } = useSession()`. It has four cards in the brief's order, each a `Pressable` with
  `accessibilityRole="button"`, an `accessibilityLabel` of `` `${title}, ${figure}` `` (or `` `${title}, loading` `` while
  the figure is "—", matching the total's `'Loading'` label in today's `app/index.tsx:67`), and
  `onPress={() => router.navigate(href)}`:

  | Card       | `href`        | Icon       | Figure                                                                   |
  | ---------- | ------------- | ---------- | ------------------------------------------------------------------------ |
  | Budget     | `/budget`     | `budget`   | `'Not set'`                                                              |
  | Expenses   | `/expenses`   | `expenses` | `data ? eur(sumCents(data.expenses, 'amountEur')) : '—'`                 |
  | Statistics | `/statistics` | `stats`    | ``data ? `${n} ${n === 1 ? 'expense' : 'expenses'}` : '—'`` (n = length) |
  | Settings   | `/settings`   | `settings` | `user.username`                                                          |

  Home ignores `error`, so a failed load shows no error block. `useMonth` retries on every focus. The Expenses figure
  equals the Expenses tab's total, a sum over category rows, because `GET …/expenses` only returns expenses whose
  category is not deleted (`apps/api/src/expenses/routes.ts:112`, `c.deleted_at IS NULL`). The categories list uses the
  same filter (`categories/routes.ts:41`), so no expense falls outside the rows.

- `components/AddExpenseButton.tsx` (slice 4): the props stay `{ categoryId?: number }` and the `router.push` to
  `/expense` (with `categoryId` when given) stays the same. It renders a `Pressable` with `accessibilityRole="button"`,
  `accessibilityLabel="Add expense"` and a 44×44 box. The box matches Expenses' `iconButton` (`width: 44, height: 44,
alignItems/justifyContent: 'center', borderRadius: 12`) and holds `<Icon name="plus" color={colors.accent} />` at the
  default size 20, like the header's back and forward icons. It is no longer `position: 'absolute'`, and the
  `useSafeAreaInsets` import goes. Callers put it last in the header row:
  - Expenses: `CompactTotal` and the button go in a right-hand `View`
    (`flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1`). This keeps the "+" at the right edge whether
    or not the total has loaded, with the compact total just left of it. `HeaderDivider` is absolute, so it is unaffected.
  - Category: the same right-hand `View` wraps `CompactTotal` (with its label) and
    `{showAdd ? <AddExpenseButton categoryId={categoryId} /> : null}`. The bottom slot that used to switch between toast
    and FAB becomes `toast ? (…) : null`. `InvalidLink` still has no "+", so its comment stays true.
- New dependencies: none. `Tabs`, `react-native-screens` and `react-native-svg` are already installed.

## Slices

- [x] 1. Add a bottom tab bar and move the month screen to an Expenses tab
  - Files: `apps/mobile/src/app/index.tsx` → `apps/mobile/src/app/(tabs)/expenses.tsx` (`git mv`; rename the component
    `Home` → `Expenses`, nothing else). New: `(tabs)/_layout.tsx`, `(tabs)/index.tsx`, `(tabs)/budget.tsx`,
    `(tabs)/statistics.tsx`, `(tabs)/settings.tsx`, `components/PlaceholderPage.tsx`. Edited: `components/Icon.tsx`,
    `app/_layout.tsx` (`(tabs)` replaces `index`), `app/category/[categoryId].tsx` (`goBack` fallback `router.replace('/expenses')`; the comment says it falls back to "Expenses (current month)").
  - Change: the tab layout and icons as in Contracts. Home, Budget, Statistics and Settings are `PlaceholderPage`s for
    now. A category opened from a bare web link goes back to the Expenses tab, which opens on the current month, not
    the link's month. The
    expense form's `replace('/')` fallback is left alone: it now lands on Home, and brief 020 owns that screen. About
    130 lines, not counting the move.
  - Verify: gates, then checks W1 (tab half), W3, W4, W7, W8, W10, W11 and I1, I3, I4 below. Also,
    `git show --stat -M HEAD` lists `apps/mobile/src/app/{index.tsx => (tabs)/expenses.tsx}` as a rename.
- [x] 2. Move sign out from Expenses to Settings
  - Files: `apps/mobile/src/app/(tabs)/expenses.tsx`, `apps/mobile/src/app/(tabs)/settings.tsx`
  - Change: remove the "Signed in as … · Sign out" `Pressable`, `user`/`logout` and the `signOut` style from Expenses.
    Settings passes the same `Pressable` (role button, `onPress={logout}`) as `PlaceholderPage` children. About 25
    lines.
  - Verify: W9, I5.
- [x] 3. Show Home cards with this month's spent, count and username
  - Files: `apps/mobile/src/app/(tabs)/index.tsx`
  - Change: replace the placeholder with the header and 4 cards from Contracts. The header is the title "Kopiyka" with a
    caption of `monthLabel(month)`, since the figures are for that month. The cards sit in a 2×2 grid, styled like the
    existing `card` (surface, border, radius 22). Each card shows its icon in accent, the title, then the figure (display
    font; muted while it is "—"). About 110 lines.
  - Verify: W1, W2, W5, W6, I2.
- [ ] 4. Replace the floating Add expense button with a "+" in the header
  - Files: `apps/mobile/src/components/AddExpenseButton.tsx`, `apps/mobile/src/app/(tabs)/expenses.tsx`,
    `apps/mobile/src/app/category/[categoryId].tsx`
  - Change: as in Contracts. The doc comment becomes "The "+" header button that opens the add form; preselects
    `categoryId` when given." Expenses' `content.paddingBottom` drops from 104 to 24; it only made room for the
    floating button. About 45 lines.
  - Verify: W12, I6, then rerun W4 (add path) and W8.

### Verification

Run the gates first. Then launch the `api` and `web` configs and sign in as the QA user. Run the checks below in the
in-app browser at 390×844, and W11 at 1440×900. Visible tabs are
`tabs = () => [...document.querySelectorAll('[role=tab]')].filter(e => e.getBoundingClientRect().width > 0)`. Hidden
stack screens are `display: none`, so their tabs measure 0.

- W1: after sign-in the URL is `/`, and `tabs().map(e => [e.getAttribute('aria-label'), e.getAttribute('aria-selected')])`
  is the 5 tabs in order with only `Home` `'true'`. The screenshot shows the Home icon in accent and the others muted.
  After slice 3: 4 cards in the order Budget, Expenses, Statistics, Settings.
- W2: from Home, tap each card. The URL becomes `/budget`, `/expenses`, `/statistics` or `/settings`, the matching
  tab is the only `aria-selected="true"`, and that page shows. Then press browser Back once after a card tap
  (Home → Budget card), and once after the matching tab-icon tap (Home → Budget icon). Both end in the same place.
- W3: from each tab page, tap every other tab icon. Each time, the page changes and only its tab is selected.
- W4: Expenses matches Base side by side. Previous/next month changes the title and the totals, a category row opens
  the category, and "Add expense" opens the form, saves, and comes back with the new total. Until slice 4, "Add
  expense" is the floating button; from slice 4 on, it is the header "+".
- W5: Home's Expenses figure equals Expenses' "Spent this month" for the current month. The Statistics figure equals
  the sum of the per-category counts ("N expenses · …" on each category page). Add one expense, go back to Home, and the
  count goes up by 1 and the total by the amount. Settings shows the QA username and Budget shows "Not set".
- W6: stop the `api` config and reload `/`. All three data figures show "—", no error text appears, and tapping each
  card still switches tabs. Restart `api` and focus Home again: the figures appear.
- W7: Expenses → category. `tabs().length === 0`, the back arrow is top-left, and tapping it returns to `/expenses`
  with `tabs().length === 5` and Expenses selected.
- W8: Expenses → Add expense, and category → expense → Edit. `tabs().length === 0` while the form is open.
- W9: on Expenses, `document.body.innerText.includes('Sign out') === false`. On Settings, "Signed in as <user> · Sign
  out" shows, and tapping it goes to login. Signing in again lands on Home (W1).
- W10: reload `/expenses`, which opens Expenses with its tab selected. Reload `/category/<id>?month=<YYYY-MM>`, then
  back goes to `/expenses`. Reload `/expense`, then close goes to `/` (Home).
- W11 (1440×900): the tablist (`[role=tablist]`) rect is `{left: 519, width: 402}`, inside the column from brief 008.
  The tabs stay icon-only, with no beside-icon labels.
- W12 (slice 4, 390×844):
  `adds = () => [...document.querySelectorAll('[aria-label="Add expense"]')].filter(e => e.getBoundingClientRect().width > 0)`.
  Inactive tab scenes stay mounted but hidden, so this filter counts only visible buttons. `add` below means `adds()[0]`.
  - On Expenses and Category, `adds().length === 1`. On Home, Budget, Statistics, Settings, "Category not found" and an
    invalid link, `adds().length === 0`. No visible element on any page has `textContent` containing "Add expense".
  - On Expenses, the `add` rect is 44×44 with `right === 370` (390 − 20 padding). Its vertical centre equals the
    centre of `[aria-label="Previous month"]`. On Category it equals the centre of the back button.
  - Tapping it on Expenses opens `/expense` titled "Add expense". On Category it opens `/expense?categoryId=<id>` with
    that category selected.
  - Scroll Expenses and a long-named category until the compact total shows. Its rect doesn't intersect `add`, and a
    long label truncates, not the "+".
  - Delete an expense from Category: the Undo bar shows at the bottom, and the "+" stays in the header.
  - `/category/999999` ("Category not found") and `/category/abc` (invalid link) show no "+".
  - Screenshots of the Expenses and Category headers show the "+" aligned with the arrows on the same row.
- I1 (iPhone, Expo Go): sign in, and Home plus the 5-icon bar show, with Home in accent. VoiceOver reads the Home tab as "Home, tab, 1 of 5".
- I2: each card switches tab, and its icon goes accent. The figures match the Expenses tab.
- I3: Expenses → category. The bar is hidden. The back arrow, and also a swipe from the left edge, return to Expenses
  with the bar.
- I4: Add expense (modal sheet) doesn't show the tab bar over the form.
- I5: sign out from Settings works. Expenses has no sign-out line.
- I6 (slice 4): there is no floating button on any page. The "+" sits at the right of the Expenses and Category
  headers, on the same row as the arrows. It is easy to hit with a thumb and opens the add form; on Category the
  category is preselected. VoiceOver reads "Add expense, button".

## AC → evidence

| AC                                                               | Evidence                                    |
| ---------------------------------------------------------------- | ------------------------------------------- |
| Sign in → Home, 4 cards, 5-icon bar, Home active                 | W1, I1 (slice 3 for cards, slice 1 for bar) |
| Tap a card → that tab shows, its icon active                     | W2, I2                                      |
| Tap a tab icon → that page, only its icon active                 | W3, W1 screenshot                           |
| Expenses tab = today's home, same behaviour except adding        | W4 (`git mv` keeps the diff to the rename)  |
| No floating button; "+" in Expenses/Category header (preselects) | W12, I6                                     |
| Card figures: spent = Expenses total, count, username, "Not set" | W5, W6, I2                                  |
| Category hides bar, back arrow, back/swipe → Expenses with bar   | W7, I3                                      |
| Add/edit form: no tab bar over it                                | W8, I4                                      |
| Sign out on Settings, not on Expenses                            | W9, I5                                      |
| Works on web at phone width and on iPhone                        | W1–W12 at 390×844 (W11 at 1440×900), I1–I6  |

## Not doing (YAGNI)

- `NativeTabs`, a web-only tab layout, a Stack nested in each tab, tab text labels, badges, haptics, or
  scroll-to-top on tab re-tap.
- `unstable_settings.anchor` for deep links. The existing `canGoBack()` fallbacks cover them.
- A Home-only data hook that fetches only expenses. `useMonth` also loads categories, which costs one extra small
  request, and it already reloads on focus.
- A shared "N expenses" plural helper. The category screen has the only other copy, so the rule of three doesn't apply
  yet.
- A new header component or a shared header-button style. The "+" copies `iconButton`'s numbers, and a third header
  button would be the time to extract.
- Category's own `content.paddingBottom: 104` stays — the Undo toast (`bottom: 32`, `minHeight: 56`) still floats over
  the list.
- Budget/Statistics content, Settings options, any change to the expense form
  (brief 020), and any API change.

## Risks

- After sign-in, `Stack.Protected` might not resolve to `(tabs)/index` (`/`) — slice 1, W1/W9. Fallback: an explicit
  `initialRouteName` in the tab layout.
- React Navigation's default light theme might show through (a white bar or scene, or a flash) — slice 1 screenshots.
  `tabBarStyle` and `sceneStyle` set the colours.
- On a narrow header, a long category name in `CompactTotal` might push the "+" off-screen or squash it — slice 4,
  W12. The wrapper's `flexShrink: 1` and the label's `numberOfLines={1}` should truncate the label first. If not, give
  the button `flexShrink: 0`.
- Until slice 4 lands, the floating button may sit higher than needed above the tab bar on iPhone, because it adds
  `insets.bottom`. This shows on the slice 1 iPhone check. Slice 4 removes it, so this isn't worth fixing in between.
- `router.navigate('/budget')` from a tab might push instead of switching, which would make web history or back odd —
  slice 3, W2 plus the browser Back button.
- On web, the modal `expense` screen might not cover the tab bar. Brief 008 found it renders `absoluteFill` in
  `BaseStack` — slice 1, W8.
- `expo-router/js-tabs` might not resolve for ESLint `import/no-unresolved` or `tsc` — slice 1 gates. The file sits at
  the package root and the package has no `exports` map, so the risk is low.

## Open questions

- Not blocking — tab labels: the brief says "5 icons", so the plan is icon-only, with each label read to screen readers.
  Showing text under the icons means flipping `tabBarShowLabel`.
- Not blocking — Home header and layout: the brief only says "4 cards". The plan assumes the title "Kopiyka", a caption
  with the current month, and a 2×2 grid.
- Not blocking — a failed refresh after an earlier success: `useMonth` keeps the previous data. The plan keeps showing
  those figures, as the Expenses tab does, so they still match. "—" shows only while nothing has loaded.
- Not blocking — deep-link fallbacks: category goes to `/expenses`. The expense form keeps `replace('/')`, which now
  means Home, and brief 020 revisits it.
- Not blocking — "+" colour: the plan uses `colors.accent`, so the main action stands out, as the old accent button
  did. The header arrows use `colors.muted`. Switching is one prop.

## Follow-ups

None.

## Deviations

## Revision 1

The skeptic approved the plan and made 5 suggestions; all were applied, and no slice or scope changed:

- Card accessibility labels say "loading" while a figure is "—".
- `tabBarAccessibilityLabel` is set on web only, so iOS keeps the library's VoiceOver label.
- Slice 1 checks that git records the move as a rename.
- The category fallback comment says "Expenses (current month)".
- W2 compares browser Back after a card tap and after a tab-icon tap.

## Revision 2

At Gate A the user changed the brief: the floating "Add expense" button is replaced by a "+" in the header.

- New slice 4, about 45 lines. `AddExpenseButton` becomes a 44×44 "+" header button (accent colour, label "Add expense")
  at the right end of the header on Expenses and Category. Its contract is in Contracts.
- New checks W12 and I6, a new AC row, and an updated W4 and I4.
- The floating-button inset risk and its follow-up are replaced by a header-fit risk and an open question about the
  "+" colour.
- Slice 1 stays a pure rename, and slices 1–3 are otherwise unchanged. The total is now about 310 lines.

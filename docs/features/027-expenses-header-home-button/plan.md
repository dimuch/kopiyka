# Plan: Expenses header — Home button and centred month switcher

Status: approved
Brief: ./brief.md
Branch: feat/expenses-header-home-button
Base: origin/main

## Approach

All changes are in `apps/mobile/src/app/(tabs)/expenses.tsx`; the header row is rebuilt as three slots.
The left slot holds a new house `Pressable` (`Icon name="home"`, `colors.muted`, the existing 44×44 `iconButton` style) that calls
`router.navigate('/')`. The centre holds the existing month switcher, unchanged apart from centring its two text lines.
The right slot holds `<AddExpenseButton />`, which is unchanged. The two side slots are `flex: 1, flexBasis: 0` (left aligned
`flex-start`, right `flex-end`) and the centre has its natural width. The sides always get equal widths, so the switcher
sits on the header's true centre whatever the side contents are and however long the month name is.
`CompactTotal` is removed from this screen only. `useCollapsingSummary` and `HeaderDivider` stay, so the divider and the
card's scroll fade behave as they do today ("everything else stays as it is"). Category detail is not touched.

Why `router.navigate('/')` is "the same logic as the Home tab" (checked in expo-router 57.0.26 source):

- Tab bar press, `node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabBar.js:267-271`: if the tab
  isn't focused, it dispatches `{ ...CommonActions.navigate(route), target: state.key }`, which is a `NAVIGATE` to the tabs
  navigator.
- `router.navigate('/')`, `build/global-state/getNavigationAction.js`: resolves `/` to `(tabs)/index`. It finds the
  divergent navigator, which is the tabs navigator (the root stack already focuses `(tabs)`), and it keeps the type `NAVIGATE`
  because only `PUSH` on non-stacks and `expo-tab` navigators are rewritten. It then dispatches with
  `target: navigationState.key`. So it is the same action on the same `TabRouter` (`backBehavior` default `firstRoute`):
  it switches the index and pushes no stack screen.
- It is also the call Home's cards already use (`(tabs)/index.tsx:62`, `router.navigate(c.href)`), so the code reads the
  same in both directions.

Alternative considered: put the switcher in an absolutely positioned centre layer (`left:0,right:0`, `pointerEvents="box-none"`).
It is also truly centred, but it can overlap the side buttons and needs care with hit-testing. Equal `flex:1` side slots
centre just as exactly with plain flex layout.
Alternative considered: `<Link href="/" asChild>`. It behaves the same, but `router.navigate` matches Home's cards and
`AddExpenseButton`.

## Contracts

- DB: none
- API: none
- App: no new modules, props or routes. `expenses.tsx` header: `[Home button | month switcher | AddExpenseButton]`.
  The house button has `accessibilityRole="button"`, `accessibilityLabel="Home"`, a 44×44 box and `onPress={() => router.navigate('/')}`.
  `CollapsingSummary.tsx` is unchanged. Its exports are still used by `category/[categoryId].tsx`, and `HeaderDivider` +
  `useCollapsingSummary` are still used by Expenses.
- New dependencies: none

## Slices

- [x] 1. Add a Home button to the Expenses header and centre the month switcher
  - Files: `apps/mobile/src/app/(tabs)/expenses.tsx`
  - Change: header = left slot (house button) / centre `monthSwitch` / right slot (`AddExpenseButton`). Drop the
    `CompactTotal` render and import (keep `HeaderDivider`, `useCollapsingSummary`). Styles: `header` drops
    `justifyContent: 'space-between'`. Add `side: { flex: 1, flexBasis: 0, flexDirection: 'row' }` with a
    `justifyContent: 'flex-end'` variant for the right side. `trailing` is replaced. Add `alignItems: 'center'` on the
    month label column, so "BUDGET ’26" and a short name like "May" share one centre line. ~30–40 changed lines.
  - Tests: none automated. The app's Vitest runner covers only pure modules in a Node environment
    (`apps/mobile/vitest.config.ts` includes only `test/**/*.test.ts`, and there is no RN renderer). This slice adds no pure logic, and
    adding a component-testing dependency isn't needed by any AC (conventions §6, §7).
  - Verify (launch configs `api` + `web`, viewport 375×812, signed in as the QA user):
    1. Home → Expenses card: house at left, switcher centred, "+" at right. Repeat via the Expenses tab icon.
    2. Centring: in devtools, take `getBoundingClientRect()` of the "Previous month" and "Next month" buttons and of the
       header row, and check that `(prev.left + next.right) / 2` equals the header's centre ±1 px. Do this for May and September
       (step with the arrows) and for the current month. Also confirm that the arrows switch the month and that the card and list follow.
    3. Scroll the categories to the bottom: no total appears in the header. The divider still fades in. Nothing in the header is
       clipped or overlapping at 375 px (September included).
    4. Tap house: Home shows and the Home tab icon is accent-coloured (active). Then do Expenses → tap the Home tab icon and
       compare: same URL `/` and the same `history.length` delta on web.
    5. Accessibility: the house element has role button and name "Home" (devtools a11y pane), and its box is 44×44.
    6. Repeat 1–4 in light and dark (Settings → Appearance).
    7. iPhone (Expo Go): 1, 3, 4 and 6, plus a VoiceOver label "Home, button". After tapping house there is no back-swipe
       to Expenses (a tab switch, not a push).
  - Gates: `yarn format:check && yarn lint && yarn typecheck && yarn test`.

## AC → evidence

| AC                                                         | Evidence                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Header: house left, switcher centred, "+" right            | Slice 1 verify 1 (web 375 px, from Home card and tab bar), 7 (iPhone)                                         |
| House → Home tab shows, Home icon active, same as tab tap  | Slice 1 verify 4 (web URL + `history.length` vs tab tap), 7 (iPhone: no back-swipe); source trace in Approach |
| Switcher centred for every month name; arrows still work   | Slice 1 verify 2 (measured centre ±1 px for May, September, current month)                                    |
| No total in header on scroll; no overlap/cut-off at 375 px | Slice 1 verify 3                                                                                              |
| House: accessible name "Home", 44×44 hit area              | Slice 1 verify 5 (web a11y pane + box size), 7 (VoiceOver)                                                    |
| Web phone width and iPhone, light and dark                 | Slice 1 verify 6 and 7                                                                                        |

## Not doing (YAGNI)

- Changes to `CollapsingSummary.tsx` or category detail's header (out of scope; it keeps its compact total).
- A fixed-width month label to stop the arrows shifting as the name length changes. The group stays centred, which is
  what the AC asks for, and today the right arrow already shifts.
- Removing the card's scroll fade. It stays as today, see Open questions.
- A shared `HeaderIconButton` component. Today there are three 44×44 header-button copies (`iconButton` here,
  `AddExpenseButton`, category's `more`), but they differ in icon, colour and action. A refactor isn't needed for any AC.
- Component-test tooling (e.g. React Native Testing Library). No AC needs it.

## Risks

- `router.navigate('/')` might push or route differently from the tab press on web, e.g. via a URL/history difference.
  Slice 1 verify 4 proves or disproves this by comparing it side by side with a Home tab tap (URL and `history.length`). The
  source trace says both dispatch `NAVIGATE` to the tabs navigator.
- "September" plus two arrows might not fit between two 44 px sides at 375 px. Estimate: 335 px content (20 px padding
  each side), minus 88 px for the sides, leaves 247 px for the centre, against about 96 px for the arrows and gaps plus about 120 px of text at 22 px. Slice 1
  verify 3 measures it. If it is too tight, the label gets `numberOfLines={1}` and the fix is recorded under Deviations.

## Open questions

- No (not blocking): with the compact total gone, should the totals card still fade and shrink as it scrolls away? It
  was the hand-off to the compact total. Assumption: keep it, because the brief says the rest of the page stays as it is and
  the divider's timing comes from the same hook. Dropping it would be a 2-line change if you prefer.

## Follow-ups

None found.

## Deviations

None.

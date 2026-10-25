# Plan: Budget header: Home button

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/budget-header-home
Base: origin/main (1a1c352)

## Approach

This is an app-only change to two screens. The Home button in the Expenses header (`(tabs)/expenses.tsx`, a
`Pressable` with `router.navigate('/')` and `<Icon name="home" color={colors.muted} />` in a 44×44 `iconButton` box)
moves into a no-props `components/HomeButton.tsx`. It is shaped exactly like the existing `AddExpenseButton`:
`useColors()` for the icon colour, a plain `StyleSheet` with no colour, and the router call inside. Expenses switches
to it with no change in behaviour. Budget then puts it in its empty left `side` view. The equal-width `side` views
already keep the month switcher centred, and the "+" logic is untouched.

Alternative considered: copy the 8-line `Pressable` into `budget.tsx`. It lost because the brief requires the "same
icon, colour, size and hit area". One component keeps the two copies from drifting apart, and the repo already
extracts a header button with two callers (`AddExpenseButton`: Expenses + Category). This goes earlier than
conventions §1's rule of three. The component has two real callers now (checklist item 2), and the brief's Notes ask
for it.

## Contracts

- DB: none
- API: none
- App: `export function HomeButton()` in `apps/mobile/src/components/HomeButton.tsx`. It takes no
  props.
  - It renders `Pressable` with `accessibilityRole="button"`, `accessibilityLabel="Home"` and
    `onPress={() => router.navigate('/')}`, plus `style` `{ width: 44, height: 44, alignItems: 'center',
justifyContent: 'center', borderRadius: 12 }`. Inside is `<Icon name="home" color={colors.muted} />`, at the
    default size.
  - It has a one-line JSDoc that carries the why from today's comment: "The header's house button: same action as the
    Home tab icon — switches tabs, pushes nothing."
  - Consumers: `(tabs)/expenses.tsx` (slice 1) and `(tabs)/budget.tsx` (slice 2).
- Reuses: `Icon` (`home` path), `useColors`, the `AddExpenseButton` shape, and the existing `side`/`sideEnd` header
  styles in `budget.tsx`.
- New dependencies: none

## Slices

- [x] 1. Move the Expenses header's Home button into a shared component (~25 lines)
  - Files: `apps/mobile/src/components/HomeButton.tsx` (new), `apps/mobile/src/app/(tabs)/expenses.tsx`.
  - Change: create `HomeButton` as in Contracts. In `expenses.tsx`, replace the inline `Pressable` and its comment
    with `<HomeButton />`. Drop the imports that are no longer used (`Icon`) and the now-unused `iconButton` style.
    `Pressable`, `router` and `colors` stay, because other code in the file still uses them. This is a move only:
    same label, role, box, icon and colour.
  - Tests: none (this is UI, and there is no pure logic). Gates must be green.
  - Verify: run the web check below on the Expenses tab only. The house button is still at the left, and tapping it
    shows Home with no visible change from main.
- [x] 2. Add the Home button to the Budget header (~4 lines)
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx`.
  - Change: `<View style={styles.side} />` → `<View style={styles.side}><HomeButton /></View>`, plus the import. The
    month switcher, "+" and styles are unchanged.
  - Tests: none (UI only). Gates must be green.
  - Verify: the web check below, all steps.

### Web check (both slices)

Metro must not run from `.claude/worktrees/`, where it serves Expo's welcome page. Use a detached sibling worktree:
`git worktree add --detach ../kopiyka-047-web <slice sha>` + `yarn install --immutable` + copy `apps/mobile/.env`.
Run Metro there with `yarn mobile expo start --web --port 8084`, without `CI=1`, and open exactly
`http://127.0.0.1:8084`, the origin CORS allows. Reuse the main checkout's API on :3000. The main checkout also runs
web on :8081 on `main`, so leave it alone. Use a per-brief user, `claude-qa-047`, and delete it afterwards
(memory: local QA cleanup order). Remove the sibling worktree when done.

1. 390×844, Budget tab, current month: house at the left, month switcher centred, "+" at the right. Compare
   side-by-side with the Expenses header: same icon, colour and position.
2. Inspect the house button. Its role is button, its accessible name is "Home", and its box is 44×44.
3. Tap it. Home shows, the Home tab icon is active (accent), Budget is inactive, and there's no back control on
   Home.
4. 375×812: current month, then switch back to an ended month (no "+"). The switcher title stays centred, measured
   as equal left/right gaps to the header edges, and the house, arrows and title don't overlap.
5. Repeat step 1 in Dark appearance (Settings) for colour parity with Expenses.

## AC → evidence

| AC                                                             | Evidence                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Web 390×844: house left, switcher centred, "+" right, like Exp | Slice 2 web check, steps 1 and 5                                                   |
| Tap shows Home, Home tab active, no Back to Budget             | Slice 2 web check, step 3 (`router.navigate('/')` switches tab, as on Expenses)    |
| Accessible name "Home", 44×44 hit area                         | Contracts (`accessibilityLabel`, 44×44 box); slice 2 web check, step 2             |
| Switcher centred, no overlap at 375 px, current + ended month  | Slice 2 web check, step 4                                                          |
| iPhone (Expo Go) checked by the user, light and dark           | User, after slice 2. Recorded in the PR test plan; not done by the developer agent |
| Gates green                                                    | `yarn format:check && yarn lint && yarn typecheck && yarn test` on each slice      |

## Not doing (YAGNI)

- Props on `HomeButton` (colour, size, target). There are no callers that need them.
- Moving `MonthSwitcher`'s or Budget's `iconButton` box into a shared style or constant. That's a separate cleanup
  with no AC behind it.
- Any change to the headers of other screens (Statistics, Settings, Category, modals), or to the switcher and "+".

## Risks

- The header gets crowded at 375 px with the house and the arrows. This is unlikely, since Expenses already shows
  the same three parts at that width. Slice 2 web check step 4 proves it or rules it out.
- A web-only accessible-name clash: the tab bar's Home tab is also named "Home" on web. That's already true on
  Expenses, and it's acceptable. Step 2 checks the button by its role and position, not by its name alone.

## Open questions

- no — The brief suggests extracting a component, but conventions §1 says the rule of three. The plan extracts at
  two copies, with `AddExpenseButton` as the precedent. If the skeptic or the user prefers a copy, slice 1 is dropped
  and slice 2 inlines the 8-line `Pressable` (~10 lines) plus an `iconButton` already present in `budget.tsx`.

## Follow-ups

- After this branch, the same 44×44 button box is still defined in `budget.tsx`, `MonthSwitcher.tsx`,
  `AddExpenseButton.tsx` and `HomeButton.tsx`. A shared header-button style could be a `/kopiyka-hos-refactoring` brief if it grows.

## Deviations

- None.

## Consolidate

- `HomeButton` (new): EXTRACT, done in slice 1. It is the Expenses header's button moved out, now used by Expenses
  and Budget. No other twin: `router.navigate('/')` and the `home` icon appear nowhere else in `apps/mobile/src`.
- The 44×44 button box: LEAVE (see Follow-ups).

## Verification (2026-10-25)

- Gates green on each slice: API 301 passed + 1 skipped (integration ran), mobile 134 passed.
- Web from a sibling worktree on :8084, user `claude-qa-047` (deleted afterwards):
  - 390×844: Budget and Expenses each have one role=button "Home" at x=20, y=20, 44×44, icon stroke
    rgb(91, 100, 112). The month title is centred (152/152 px gaps) on both.
  - Tapping it on Budget opens `/` with the Home tab selected and no back control.
  - 375×812: October (with "+") gaps 144/144; September (ended, no "+") 128/128. The house ends at 64 px, before
    the previous-month arrow (96 / 79.6 px).
  - Dark appearance: the header looks the same as on Expenses.
- Left for the user: iPhone (Expo Go), light and dark.

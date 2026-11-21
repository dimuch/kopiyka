# Plan: Statistics: month arrows with a period dropdown

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/statistics-period-dropdown
Base: origin/main (5811ced, version 1.14.0)

## Approach

The screen's state becomes the `Period` on show, not a chosen preset. Three small pure functions in `data/period.ts`
do the rules: step to a single month counted from the period's last month, whether forward is allowed (not past the
current Kyiv month), and which offered preset the period matches. `PERIOD_CHOICES` shrinks to the brief's five.
`presetPeriod('last12')`, `moveCustom` and their tests stay as they are. On Statistics, the wrap of chips becomes one
switcher row under the header: back arrow, a period button (`periodLabel` and a down chevron), forward arrow. The
button opens a menu card under the row. The card sits on a full-screen layer, like the category screen's ⋯ menu
(`CategoryMenu` in `app/category/[categoryId].tsx`), so a tap anywhere outside the card closes it without a change,
the button included. The row is a direct child of the `SafeAreaView`, so its `onLayout` frame places the card without
hard-coded offsets. The period line under the chips goes, because the switcher shows the same text.

Subtract first: Custom can't be chosen any more, so the screen's custom code goes too: the `custom` state, the
`choose` branch, the From/To `MonthSwitcher` rows, their styles and imports. The custom _logic_ (`moveCustom` and its
tests) stays, as the brief asks. Bringing Custom back means one list entry and about 20 lines of screen code, as in
`e481e23`.

Why a Statistics-only switcher and not `MonthSwitcher` with optional props: the two only share the arrow buttons.
`MonthSwitcher` shows a caption ("BUDGET ’26") over a month name, and its `onChange` takes one month. Statistics needs
a different middle (a menu button with a range label), a disabled forward arrow, and stepping from a range. That's
three optional props with one caller each, a bolt-on, in a component that Budget, Income and Expenses use and the demo
bundles. Had both existed from the start, the shared part would be about 15 lines of arrow JSX and one style. That's
the second copy, so by the rule of three it isn't extracted. `MonthSwitcher.tsx` isn't touched, so Budget, Income,
Expenses and the demo's module list stay as they are.

Alternative considered: `MonthSwitcher` gets `nextDisabled` and a `children` middle. Turned down for the reasons
above: one caller per prop, and a change that reaches three screens and the demo for no gain.

## Contracts

- DB: none
- API: none (the summary route already takes any `from`/`to`)
- App:
  - `data/period.ts`:
    - `PERIOD_CHOICES: readonly { choice: Exclude<PeriodChoice, 'custom'>; label: string }[]` is exactly `current`
      "Current month", `previous` "Previous month", `last3` "Last 3 months", `last6` "Last 6 months" and `thisYear`
      "This year", in that order. A comment says Last 12 months and Custom aren't offered (brief 094), and that
      `presetPeriod('last12')` and `moveCustom` stay so they can come back. `PeriodChoice`, `presetPeriod`,
      `moveCustom` and `periodLabel` don't change.
    - `stepPeriod(period: Period, by: 1 | -1): Period` returns the single month `shiftMonth(period.to, by)`, as
      `{ from: m, to: m }`. JSDoc: on a range it counts from the last month.
    - `canStepForward(period: Period, now: Date): boolean` is `period.to < kyivMonth(now)`. JSDoc: false once the
      period ends on the current Kyiv month, so Statistics never shows a future month.
    - `matchingChoice(period: Period, now: Date): Exclude<PeriodChoice, 'custom'> | null` returns the first
      `PERIOD_CHOICES` entry, in list order, whose `presetPeriod(choice, now)` has the same `from` and `to`, or
      `null`. Only offered presets match, so a Last 12 months range matches nothing.
  - `components/Icon.tsx`: a new name, `down: ['M6 9l6 6 6-6']`, a chevron that matches `back`/`forward`.
  - `app/(tabs)/statistics.tsx`:
    - State: `const [period, setPeriod] = useState<Period>(() => presetPeriod('current', now))`, where `now` is
      read once as today. Also `menuOpen: boolean` and `anchor: LayoutRectangle | null`, which the row's `onLayout`
      sets.
    - Screen-local `PeriodSwitcher({ period, canStepForward, menuOpen, onStep, onToggleMenu, onLayout })`:
      - `period: Period`, `canStepForward: boolean`, `menuOpen: boolean`, `onStep: (by: 1 | -1) => void`,
        `onToggleMenu: () => void`, `onLayout: (frame: LayoutRectangle) => void`.
      - A centred row. Back arrow: `Pressable`, role button, label "Previous month", 44×44, `Icon back` in `muted`.
      - Period button: role button, `accessibilityLabel={`Period, ${periodLabel(period)}`}`,
        `accessibilityHint="Opens a menu of periods"`, `accessibilityState={{ expanded: menuOpen }}`, ≥44 pt high.
        It holds the label text (`fonts.display` 20, `numberOfLines={1}`, `flexShrink: 1`) and `Icon down` in
        `muted`, size 18.
      - Forward arrow: like the back arrow, label "Next month", `disabled={!canStepForward}`,
        `accessibilityState={{ disabled: !canStepForward }}`. The icon is `colors.fainter` while it's disabled.
    - Screen-local `PeriodMenu({ marked, anchor, onChoose, onClose })`:
      - `marked: Exclude<PeriodChoice, 'custom'> | null`, `anchor: LayoutRectangle`,
        `onChoose: (choice: Exclude<PeriodChoice, 'custom'>) => void`, `onClose: () => void`.
      - The layer is an `absoluteFill` `View` with `accessibilityViewIsModal`. On it go a backdrop `Pressable` (role
        button, label "Close menu", `absoluteFill`, calls `onClose`) and the card.
      - The card is `MENU_WIDTH = 200` wide, at `top: anchor.y + anchor.height + 4` and
        `left: anchor.x + (anchor.width - MENU_WIDTH) / 2`, which centres it under the period button. It has
        `accessibilityRole="radiogroup"` and the label "Period".
      - The card has one row per `PERIOD_CHOICES` entry: role radio, `accessibilityLabel={label}`,
        `accessibilityState={{ checked: choice === marked }}`, ≥44 pt. The marked row has semibold text and
        `Icon check` in `accent`.
      - Its styles copy `CategoryMenu`'s `menuLayer`/`menuCard`/`menuItem`. `menuCard` takes its place and width from
        `anchor` and `MENU_WIDTH` instead of `right: 20`/`minWidth: 200`.
    - Wiring: `onStep={(by) => setPeriod(stepPeriod(period, by))}`. The card renders only when `menuOpen && anchor`,
      as the last child of the `SafeAreaView`. `onChoose={(choice) => { setPeriod(presetPeriod(choice, now));
setMenuOpen(false); }}`. `useSummary` keys on the `${ledgerId}/${from}/${to}` strings, so choosing the period
      already shown doesn't reload anything.
- Reuses: `presetPeriod`, `periodLabel`, `shiftMonth`, `kyivMonth`, `useSummary`, `Pressable`, `Icon` (`back`,
  `forward`, `check`), and the layer and card shape of `CategoryMenu`. The card is copied, see Not doing.
- New dependencies: none

## Version

Bump: minor — 1.14.0 → 1.15.0
Why: §8b `minor`: a new user action. The arrows step Statistics one month at a time, and that's the brief's reason.
Last 12 months and Custom are no longer offered, at the user's request. That doesn't reach `major`: §8b's contract
is installed builds, the connector, people's data and rollback, and none of them changes. The summary API still takes
any range, and old builds keep working.

## Slices

- [x] 0. Bump version to 1.15.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.15.0
- [x] 1. Stop offering Last 12 months and Custom on Statistics (~45 lines)
  - Files: apps/mobile/src/data/period.ts, apps/mobile/test/period.test.ts, apps/mobile/src/app/(tabs)/statistics.tsx
  - Change:
    - Narrow `PERIOD_CHOICES` to the five entries in Contracts, with its comment.
    - Screen: keep `preset`, and set `period = presetPeriod(preset, now)`. Delete `custom`, `choice` and `choose`.
      The chips are `selected: preset === option` and call `onPress={() => setPreset(option)}`.
    - Delete the From/To block, the `custom`/`customRow`/`customCaption` styles and the imports left unused:
      `moveCustom`, `MonthSwitcher` and `tabTitle`. `PeriodChoice` stays. Fix the chips comment ("seven choices").
  - Tests: in `period.test.ts`, 'lists the choices in the brief's order' expects the five labels. The `last12`
    `presetPeriod` cases and every `moveCustom` case stay unchanged and pass.
  - Verify (web, 390×844): five chips in the brief's order; Last 3 months shows "Sep – Nov 2026" and its figures; no
    From/To row.
- [x] 2. Work out stepping and the matching preset for a Statistics period (~65 lines)
  - Files: apps/mobile/src/data/period.ts, apps/mobile/test/period.test.ts
  - Change: add `stepPeriod`, `canStepForward` and `matchingChoice` as in Contracts.
  - Tests (`period.test.ts`, table style, fixed `new Date('2026-11-21T10:00:00Z')` unless noted):
    - `stepPeriod`:
      - Nov –1 → Oct; Nov +1 → Dec.
      - `2026-09…2026-11` –1 → `2026-10…2026-10` (the brief's example); +1 → `2026-12…2026-12`.
      - Across the year: `2027-01` –1 → `2026-12`; `2026-12` +1 → `2027-01`.
    - `canStepForward`:
      - `2026-11` false; `2026-10` true; `2026-09…2026-11` false; `2026-01…2026-10` true.
      - At the Kyiv edge, `2026-10` is false at `2026-10-31T21:59:59Z` and true at `2026-10-31T22:00:00Z`.
    - `matchingChoice`:
      - `2026-11` current; `2026-10` previous; `2026-09…11` last3; `2026-06…11` last6; `2026-01…11` thisYear.
      - `2026-09` null; `2026-10…11` null.
      - `2025-12…2026-11` null: Last 12 months isn't offered.
      - On 15 Jan 2027, `2027-01` is current: This year is the same month, and the first in the list wins.
- [ ] 3. Step the Statistics period a month at a time with arrows (~60 lines)
  - Files: apps/mobile/src/app/(tabs)/statistics.tsx
  - Change:
    - `preset` becomes the `period` state (Contracts). The chips stay for now and are
      `selected: matchingChoice(period, now) === option`, with `onPress={() => setPeriod(presetPeriod(option, now))}`.
    - Add `PeriodSwitcher`, so far without the menu props: the middle is a plain `Text`, not yet a button. It sits
      between the header and the `ScrollView`, as a direct child of the `SafeAreaView`.
    - Delete the `period` line and its style, because the switcher shows that text.
  - Verify (web, 390×844 and 375 wide):
    - It opens on "November 2026", the forward arrow is dimmed and does nothing, and the Current month chip is
      selected.
    - Back shows "October 2026" with October's figures, forward is enabled, and the Previous month chip is selected.
      Forward again goes back to November.
    - Last 3 months shows "Sep – Nov 2026". Back shows "October 2026", and back again "September 2026" with no chip
      selected.
    - In the web inspector, edit the label to "Dec 2025 – Nov 2026" at 375 wide: it fits on one line with both
      arrows.
    - Budget, Income and Expenses' switchers are unchanged.
- [ ] 4. Choose the Statistics period from a menu under the switcher (~110 lines)
  - Files: apps/mobile/src/components/Icon.tsx, apps/mobile/src/app/(tabs)/statistics.tsx
  - Change:
    - Add `down` to `Icon`.
    - The `PeriodSwitcher` middle becomes the period button. Add `menuOpen`/`anchor`, `onToggleMenu`, the row's
      `onLayout`, and `PeriodMenu`, rendered last in the `SafeAreaView`.
    - Delete the chips `View` and the `chips`/`chip`/`chipOn`/`chipText` styles.
    - Add the `periodButton`, `menuLayer`, `menuCard`, `menuItem`, `menuText` and `menuTextOn` styles.
  - Verify, on web at 390×844 and on iPhone (light and dark):
    - There are no chips. A tap on the period opens the card centred under it: five rows in order, Current month
      checked.
    - Last 3 months closes the menu and shows "Sep – Nov 2026" with its figures. Back shows "October 2026", and the
      menu has Previous month checked. Back again shows "September 2026", and no row is checked.
    - With the menu open, a tap on the period, the header and the figures each closes it, and the period doesn't
      change.
    - A page search finds neither "Last 12 months" nor "Custom".
    - With the figures scrolled down on iPhone, the card still sits under the switcher, which doesn't scroll.
    - VoiceOver on iPhone:
      - The arrows say "Previous month" and "Next month", and the forward one is dimmed on the current month.
      - The button says "Period, November 2026, button, Opens a menu of periods".
      - With the menu open, only the card and "Close menu" can be reached, and each option says whether it's
        selected.
    - In the web accessibility tree, the button has `aria-expanded`, the forward arrow `aria-disabled`, and each
      option is `role="radio"` with `aria-checked`.
    - `Icon.tsx` is in the demo bundle, so `yarn mobile export:web && yarn mobile check-builds` must pass with no
      `--accept`.

## AC → evidence

| AC                                                                                                      | Evidence                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| AC1: opens on "November 2026", right arrow disabled, no chips                                           | `canStepForward` '2026-11 false' test. Slice 3 check (label, dimmed arrow) and slice 4 check (no chips)             |
| AC2: left shows October and its figures, right enabled; right goes back to Nov                          | `stepPeriod` Nov ±1 tests, `canStepForward` '2026-10 true' test, and the slice 3 check                              |
| AC3: the menu under the period lists the five in order, the matching preset marked                      | 'lists the choices in the brief's order' (five labels), `matchingChoice` tests, and the slice 4 check               |
| AC4: Last 3 months shows "Sep – Nov 2026"; left October (Previous marked); left September (none marked) | `stepPeriod` range test, `matchingChoice` `2026-10` previous and `2026-09` null tests, and the slice 3 and 4 checks |
| AC5: a tap on the period or outside closes the menu with no change                                      | Slice 4 check: taps on the period, header and figures                                                               |
| AC6: no "Last 12 months" or "Custom" on Statistics                                                      | The five-label test, the `matchingChoice` last12 null test, and the slice 4 page search                             |
| AC7: VoiceOver announces the arrows, the period button and each option                                  | Slice 4 VoiceOver check on iPhone (recorded in the PR test plan) and the web accessibility tree check               |

## Not doing (YAGNI)

- Changing `MonthSwitcher` or pulling a shared arrows component out of it. The arrow JSX is only on its second copy
  (see Approach).
- A shared `Dropdown`/`Menu` component, or pulling the layer out of `CategoryMenu`. Two similar overlays don't meet the
  rule of three.
- Keeping the screen's custom state or From/To rows behind a flag. Dropping `'custom'`/`'last12'` from `PeriodChoice`,
  or touching `presetPeriod`/`moveCustom` and their tests.
- Remembering the period between visits, new presets, a native picker, or a dependency (all out of scope).
- Closing the menu on Escape (web) or when the tab loses focus. Neither is an AC, and the ⋯ menu doesn't do either.

## Risks

- The card might not sit under the switcher on iOS. The row's `onLayout` `y` counts the `SafeAreaView`'s padding
  (inset plus 20). Absolute children are placed from the padding edge too, so `y + height` should land right.
  `CategoryMenu` adds the inset by hand because it uses a constant. The slice 4 check on iPhone (notch inset) and on
  web proves or disproves this. If the card is off, correct it by the measured gap, not a constant.
- "Dec 2025 – Nov 2026" might not fit between the arrows at 375 wide. In the offered presets this happens only with
  Last 6 months from January to May. The slice 3 inspector check proves or disproves it. If it doesn't fit, use a
  smaller label size; `numberOfLines={1}` meanwhile keeps the row from wrapping.
- VoiceOver might not voice a radio's `checked`. `LedgerPicker` and `AppearancePicker` already rely on it. The slice
  4 VoiceOver check proves or disproves it. If it fails, use `accessibilityState={{ selected }}`, as the old chips did.

## Open questions

- Not blocking: in January, This year and Current month are the same month, so which is marked? Assumed the first in
  menu order, Current month, even right after choosing This year. The period shown is the same either way, and
  tracking the choice as well as the period would add state for one month a year.
- Not blocking: where does the switcher go? Assumed its own centred row under the "Statistics" header, fixed above
  the scrolling figures. Budget puts it in the header row, but a range label and a chevron don't fit beside the Home
  button, and the screen keeps its title.
- Not blocking: the period line under the switcher. Assumed it's removed, because the switcher shows the same text.
- Not blocking: should the screen's custom state go now? Assumed yes, see Approach. The brief keeps only the logic
  and its tests.
- Not blocking: the version is `minor`, though two options people could pick go away. Assumed `minor`: the user asked
  for the removal, and nothing in the §8b contract breaks (see Version).

## Follow-ups

None found.

## Deviations

- slice 1: the web check didn't run. The real web app needs a sign-in with an authenticator code, and the demo has no
  Statistics tab. Evidence is the five-label test and the gates; the screen check is left for the user.

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

The brief changed from a dropdown of five presets to Budget-style month arrows with a preset menu. This plan replaces
the earlier dropdown-only draft. Kept: slice 1, the `Icon` `down` chevron, the `CategoryMenu`-style layer, the radio
rows and their risks. New: the `stepPeriod`/`canStepForward`/`matchingChoice` logic (slice 2), the arrows (slice 3)
and the switcher-anchored menu (slice 4). The version went from `patch` to `minor`, because stepping by month is a new
user action.

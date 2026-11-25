# Plan: Shared components, part 4: IconButton and Chip

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/icon-buttons
Base: origin/main (1c60698, version 1.23.5). The brief says dab7b78 (1.23.4), but main has since taken 1.23.5 (a1b9748
and 1c60698, name suggestions over the expense form). Neither commit touches a file this plan edits. The branch has no
commits yet, so rebase it onto origin/main before the before set.

## Approach

Add `src/components/IconButton.tsx` and `src/components/Chip.tsx`, then move the brief's 11 icon buttons and 3 chip
kinds onto them. All the hosts are plain `Pressable`s from `@/components/Pressable`. None is an `Animated.View`, a
`Link asChild` or a list host, so each one becomes `<IconButton>` or `<Chip>`. Both components draw exactly today's
look (Contracts), so **nothing moves**.

- **IconButton** is a leaf, like `Button`: its props are explicit, and it draws its own `Icon`.
  - `tone` picks the icon's colour: `muted` has 8 callers and `accent` has 3.
  - `disabled` turns the icon `fainter` and doesn't dim the button, which is what Statistics' Next does today.
- **Chip** is a container, like `Card`: it takes `Pressable`'s props and children, adds `selected`, and owns the role,
  the box and the selected colours.
  - With the props passed through, `disabled`, `accessibilityLabel` and `key` reach the chip without a one-caller
    prop each.
  - The letter tile, the label and the width stay in the callers.

**Size.** I made every edit in a scratch copy of `apps/mobile` and ran it through the repo's Prettier, `tsc` and
ESLint: all clean, with no warnings. It comes to **409 changed lines in `src` (172 added, 237 removed) in 12 files**,
plus 2 lines in `demo-modules.txt`, so 411 in all.

- That's over the brief's "split if more than 400", by 11 lines, and 58% of it is deletions.
- Recommended: one PR in 3 slices, each 149 lines or fewer (Open question 4). That's the same call as 104b's 408 at
  its Gate A.
- The slices are ordered so the split costs nothing: slices 0–2 are the IconButton PR and slice 3 is the Chip PR.

Alternatives considered:

- **IconButton takes the colour** (`color={colors.accent}`) instead of a tone. That's one prop fewer to define, but
  every caller then reads `useColors()`, and brief 105 would chase 11 colour choices instead of two tone lines
  (Open question 1).
- **Chip with explicit props** (`selected`, `onPress`, `disabled`, `accessibilityLabel`, `style`, `children`), like
  Button. `accessibilityLabel` would have one caller ("N more"), against the brief's two-caller rule. Passing
  `Pressable`'s props through, as `Card` does with `ViewProps`, needs no one-off prop.
- **`raised` and `dashed` options on Chip** (Open question 2). Each would have one caller, and brief 105 reworks both,
  so they stay style overrides with a comment.

## Contracts

- DB / API / DTOs / `theme.ts`: none. No new token (`size.chip`, 32, already exists for 105 and stays unused here).
- **`src/components/IconButton.tsx`** (new; drafted at 56 lines):

  ```ts
  /** A 44×44 button with only an icon in it. Disabled, the icon turns `fainter`; the button doesn't dim. */
  export function IconButton(props: {
    icon: IconName;
    label: string; // the accessible name: there's no visible text
    onPress: () => void;
    tone: 'muted' | 'accent'; // the icon's colour: accent for the "+" buttons, muted for the rest
    iconSize?: number; // Budget's 18pt pencil; Icon's own 20 otherwise
    disabled?: boolean; // left undefined by default: on iOS even `false` adds `disabled` to accessibilityState
    'aria-expanded'?: boolean; // the ⋯ menu
    style?: StyleProp<ViewStyle>; // the caller's layout, and the two square corners (below); applied last
  }): React.JSX.Element;
  ```

  - It renders our `Pressable` with `accessibilityRole="button"`, `accessibilityLabel={label}`,
    `aria-expanded={props['aria-expanded']}`, `disabled`, `onPress` and `style={[styles.button, style]}`.
  - Its child is `<Icon name={icon} size={iconSize} color={disabled ? colors.fainter : colors[tone]} />`.
    `size={undefined}` falls back to Icon's default of 20, and `more` keeps its own 3.6 stroke.
  - Style (plain `StyleSheet.create`; colours come from `useColors()`): `button: { width: size.iconButton, height:
size.iconButton, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md }`.
  - Imports: `react-native`, `@/appearance/AppearanceContext`, `@/components/Icon`, `@/components/Pressable`, `@/theme`.
  - **No new attributes on web** (checked in react-native-web 0.21.4):
    - `createDOMProps` writes `aria-expanded` and `aria-selected` only when they're not null.
    - `aria-disabled` is written only when `disabled === true`.
    - So `undefined` and `false` add nothing, and the accessibility records stay as they are.
    - On iOS, RN's `Pressable` adds `disabled` to `accessibilityState` whenever it isn't null (`Pressable.js`:
      `disabled != null ? {..._accessibilityState, disabled} : …`). So `disabled` has no default, and only
      Statistics' Next passes it, as today.
  - **One-caller props:** `iconSize`, `aria-expanded` and `disabled` have one caller each. The brief names all three
    ("plus the props its callers pass today"), and none of them can be a style. Without them, the pencil, the ⋯ and
    Statistics' Next would stay hand-written, which fails AC2. This is the same exception as 104b's `icon`.

- **`src/components/Chip.tsx`** (new; drafted at 45 lines):

  ```ts
  /** A 48pt selectable box: a `surface` fill with a 1pt `borderStrong` edge, or an `accent` edge on `accentTint` while
   *  selected. Its content and width come from the caller. */
  export function Chip(
    props: Omit<ComponentProps<typeof Pressable>, 'accessibilityRole' | 'aria-selected'> & {
      selected?: boolean; // sets aria-selected; left out on a chip that's never selected (the sheet's, "N more")
    },
  ): React.JSX.Element;
  ```

  - It renders `<Pressable {...rest} accessibilityRole="button" aria-selected={selected}
style={[styles.chip, selected && styles.on, style]} />`. The role and `aria-selected` come after the spread, so a
    caller can't override them. TypeScript doesn't check hyphenated JSX attributes, so `aria-selected` could still be
    passed, but `selected` would win.
  - A one-line comment above the style array says the caller's style comes last and must not set the border or fill,
    or the selected look disappears. Today that holds: the selectable chips (A, B) override only width and padding,
    and the fill and edge overrides are on chips that are never selected (C, D).
  - Styles (`makeStyles(colors)`, read with `useThemedStyles`):
    - `chip`: `{ height: size.control, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong,
backgroundColor: colors.surface, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center',
gap: space.sm }`
    - `on`: `{ borderColor: colors.accent, backgroundColor: colors.accentTint }`
  - The fixed `height` stays as it is today. 105 sets the 32pt pill.
  - Imports: `react`, `react-native`, `@/appearance/AppearanceContext`, `@/components/Pressable`, `@/theme`.
  - Checked with a scratch probe: `tone="danger"` and `<Chip accessibilityRole="link">` each fail `tsc` (TS2322).

- **IconButton call sites, measured on Base** (every one: role `button`, no hitSlop, plain `Pressable`):

  | #   | Site (file: style)                                       | Today                                                                                            | → `icon`, `tone` | Other props / caller's `style`                                                       |
  | --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------ |
  | 1   | `components/HomeButton`: `button`                        | 44×44, `radius.md`, centred; `home` 20 muted; label "Home"                                       | `home`, muted    | —                                                                                    |
  | 2   | `components/AddExpenseButton`: `button`                  | the same; `plus` 20 accent; "Add expense"                                                        | `plus`, accent   | — (also drawn on every Expenses row and in the category page's header)               |
  | 3   | `components/MonthSwitcher`: `iconButton` (Previous)      | the same; `back` 20 muted; "Previous month"                                                      | `back`, muted    | —                                                                                    |
  | 4   | `components/MonthSwitcher`: `iconButton` (Next)          | the same; `forward` 20 muted; "Next month"                                                       | `forward`, muted | —                                                                                    |
  | 5   | `(tabs)/statistics` PeriodSwitcher: `iconButton` (Prev.) | the same as 3                                                                                    | `back`, muted    | —                                                                                    |
  | 6   | `(tabs)/statistics` PeriodSwitcher: `iconButton` (Next)  | the same as 4; `disabled={!forwardEnabled}`, icon `fainter`                                      | `forward`, muted | `disabled={!forwardEnabled}`                                                         |
  | 7   | `(tabs)/budget`: `iconButton` ("+")                      | 44×44, `radius.md`; `plus` 20 accent; "Add a category to {Month}"                                | `plus`, accent   | —                                                                                    |
  | 8   | `(tabs)/budget` row: `edit` (pencil)                     | 44×44, **no corner**, mR 8; `edit` **18** muted; "Edit {name} in {Month}"                        | `edit`, muted    | `iconSize={18}`, `style={styles.edit}`: `{ marginRight: space.sm, borderRadius: 0 }` |
  | 9   | `(tabs)/income`: `iconButton` ("+")                      | as 7; "Add income to {Month}"                                                                    | `plus`, accent   | —                                                                                    |
  | 10  | `category/[categoryId]`: `more` (⋯)                      | 44×44, `radius.md`; `more` 20 muted (stroke 3.6); "Category actions"; `aria-expanded={menuOpen}` | `more`, muted    | `aria-expanded={menuOpen}`                                                           |
  | 11  | `components/CategorySheet`: `close`                      | 44×44, **no corner**, mR −8; `close` 20 muted; "Close"                                           | `close`, muted   | `style={styles.close}`: `{ marginRight: -space.sm, borderRadius: 0 }`                |
  - **The two square corners** (Open question 3) keep `borderRadius: 0` in the style each caller already has. Each
    has the comment "Square until brief 105, as before IconButton: a rounded corner would only round its web focus
    ring." and then `eslint-disable-next-line no-restricted-syntax`. A literal `0` trips the style-number rule; I
    checked that with a probe.
  - **Caller clean-up** (from the draft; lint doesn't catch unused StyleSheet keys):
    - Styles go: `HomeButton`'s and `AddExpenseButton`'s `styles` (whole), `iconButton` in MonthSwitcher, Budget,
      Income and Statistics, and the category page's `more`.
    - Imports go:
      - `StyleSheet`, `useColors`, `Icon`, `Pressable`, `radius`, `size`: HomeButton and AddExpenseButton
      - `useColors`, `Icon`, `Pressable`, `radius`, `size`: MonthSwitcher
      - `Icon`, `radius`, `size`: Income
      - `radius`: Budget
      - `useColors`, `Icon`: CategorySheet (and `size` in slice 3)
    - Kept because they're still used: Budget's `Icon` (the Start → End pencil), Statistics' `Icon`, `Pressable`,
      `radius` and `size` (the period button and menu), and the category page's `Icon` (Back), `radius` and `size`.
    - The `const colors` that goes unused leaves HomeButton, AddExpenseButton, MonthSwitcher and CategorySheet.

- **Chip call sites, measured on Base** (all: role `button`, `height` 48, `radius.md`, 1pt `borderStrong`, no
  hitSlop):

  | #   | Site (file: style)                          | Today                                                                                                                                                                                        | → props                                                       | Caller's `style` keeps                                                                                                                                          |
  | --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | A   | `components/DateChips`: `chip`, `chipOn`    | `surface`; pad **16**; a column with `justifyContent: 'center'`; as wide as its label (`text.label`, `text`); `aria-selected={value === d.value}`; no label prop                             | `key`, `selected={value === d.value}`, `onPress`              | `chip: { paddingHorizontal: space.lg }`                                                                                                                         |
  | B   | `components/CategoryPicker`: `cat`, `catOn` | `surface`; **31.5%** wide; pad 8; row, centred, gap 8; letter tile **26**; label `text.label` flex 1, one line; `aria-selected={on}`; `disabled`                                             | `key`, `selected={on}`, `disabled`, `onPress`                 | `cat: { width: '31.5%' }`                                                                                                                                       |
  | C   | `components/CategoryPicker`: `cat` + `more` | as B, plus **dashed** `borderStrongest`, transparent, `justifyContent: 'center'`; `more` icon 20 muted; "{n} more" muted, flex 0; label "More categories"; `disabled`; no `aria-selected`    | `accessibilityLabel="More categories"`, `disabled`, `onPress` | `[styles.cat, styles.more]`; `more`: `{ borderStyle: 'dashed', borderColor: colors.borderStrongest, backgroundColor: 'transparent', justifyContent: 'center' }` |
  | D   | `components/CategorySheet`: `item`          | **`surfaceRaised`** (the same as `surface` in light, `#22262D` against `#181B20` in dark); **48.5%** wide; pad 8; row, gap 8; tile **28**; never selected, no `aria-selected`, no `disabled` | `key`, `onPress`                                              | `item: { width: '48.5%', backgroundColor: colors.surfaceRaised }`                                                                                               |
  - Comments on the overrides: C, "'N more' opens the sheet rather than picking, so it's drawn as an empty slot (a
    one-off, until brief 105)."; D, "A step above the sheet's own surface, which a plain chip would match (a one-off,
    until brief 105)."; A, "Wider padding than a category chip, around a word."
  - **Chip's padding is 8**, because three of the four sites use 8. DateChips keeps its 16 as an override.
  - **DateChips becomes a row.** Its single label was centred in a column. It's now centred in a row, with the same
    padding, inside a chip that's as wide as its content, so the label's box shouldn't move (Risks).
  - **Caller clean-up:** `chipOn` and `catOn` go. `Pressable`, `radius` and `size` leave DateChips and CategoryPicker,
    and `size` leaves CategorySheet. The sheet keeps `Pressable` (its backdrop) and `radius` (its corners).

- **Corrections to the brief's tables:**
  - **The sheet's chips are never selected.** There's no `aria-selected` and no selected style, so AC4's "selected
    and unselected of each kind" means unselected only for them.
  - **"Add expense" is on more than the header.** It's one component, also drawn on every Expenses category row and
    in the category page's header, so the `expenses` and `category` views show it.
  - **Home has no icon button.** The Home tab (`(tabs)/index`) shows HomeCards and PendingInvites only. The house
    button appears on Budget, Income, Expenses and Statistics. `home` is still snapshotted, as a control, since AC3
    lists it.
  - DateChips' side padding is 16, and the "N more" chip has its own label, "More categories".

- **The lists are complete** (searched on Base):
  - `rg "width: size\.iconButton" apps/mobile/src` finds 9 style lines in 8 files, covering the 11 sites above (MonthSwitcher and Statistics share one style per pair).
  - `rg hitSlop` finds nothing.
  - The other icon hosts are out of scope or aren't icon buttons:
    - the category page's and Members' Back (icon and label, 104e)
    - Budget's Start → End line and Statistics' period button
    - Settings' Members row and HomeCards
    - AmountFields' swap (a plain `View`) and DateField's calendar (inside the field)
    - the expense form's "Added" check (a `summary`)
    - TabBar (106)
  - Selectable rows outside the three chip kinds aren't chips:
    - **AppearancePicker's options**: role `radio` with `aria-checked`, 44pt, no edge or fill while unselected, and
      the label changes colour. It doesn't fit without a change, as the brief allows.
    - **LedgerPicker's rows**: radio, `activeTint`/`activeLine`.
    - **The Statistics period menu's rows**: radio rows in a menu.
    - **NameCombobox's options**: listbox options, a fill only.
- **AC2 exceptions after slice 3:** `rg -n "accentTint" apps/mobile/src` finds `Chip.tsx` plus these, none of them a
  chip's selected pair (an `accent` edge on `accentTint`, alongside a `borderStrong` chip):
  - AppearancePicker's `optionOn`. It's the same pair of colours, on a radio option the brief leaves out.
  - NameCombobox's `active` (fill only)
  - the expense form's "Added" note (`accentLine`)
  - Settings' avatar
  - DemoStrip
  - `theme.ts` itself
- **Demo:** IconButton reaches the demo through HomeButton, AddExpenseButton and MonthSwitcher (slice 1), and Chip
  through DateChips and CategoryPicker on the expense form (slice 3). Each slice runs `yarn mobile export:web &&
yarn mobile check-builds --accept`. The list's diff is one line each: `src/components/IconButton.tsx`, then
  `src/components/Chip.tsx`. Statistics isn't in the demo.
- Reuses: `Pressable` (its pressed dimming), `Icon`, `useThemedStyles`/`useColors`, the `size`, `radius` and `space`
  tokens, the `Card`-style pass-through of 104, and the 104 snapshot script with the changes in Visual check. I
  searched `src/components`, and no icon-button or chip component exists.
- New dependencies: none.

## Version

Bump: patch — 1.23.5 → 1.23.6 (the brief planned 1.23.4 → 1.23.5; main took 1.23.5 first)
Why: §8b `patch`. It's a behaviour-preserving refactor of shipped app code: the same buttons, chips, labels, roles and
states. There's no new capability, and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator rebases the branch onto origin/main and takes the **before** set (Visual check). The
line counts come from the scratch draft.

- [ ] 0. Bump version to 1.23.6
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.6
- [ ] 1. Draw Home, Add expense and the month arrows with one IconButton (~149 lines)
  - Files: `src/components/IconButton.tsx` (new), `src/components/HomeButton.tsx`,
    `src/components/AddExpenseButton.tsx`, `src/components/MonthSwitcher.tsx`, `apps/mobile/demo-modules.txt`
  - Change: IconButton as in Contracts, with all of its props, as Button and Card shipped whole. Sites 1–4.
  - Verify: gates; `export:web` + `check-builds --accept`, with only the IconButton line added. Snapshots: `budget`,
    `income`, `expenses` (Home, arrows, the row "+") and `category` (the header "+").
- [ ] 2. Draw the tabs' "+", Statistics' arrows, Budget's pencils, ⋯ and the sheet's Close with IconButton (~133
      lines)
  - Files: `src/app/(tabs)/budget.tsx`, `src/app/(tabs)/income.tsx`, `src/app/(tabs)/statistics.tsx`,
    `src/app/category/[categoryId].tsx`, `src/components/CategorySheet.tsx` (Close only)
  - Change: sites 5–11, the two square-corner overrides, and the clean-up in Contracts.
  - Verify: gates. `rg -n "width: size\.iconButton" apps/mobile/src` finds only `IconButton.tsx`. Snapshots:
    `budget`, `income`, `statistics`, `category`, `category-menu`, `expense-sheet`.
- [ ] 3. Draw the date and category chips with one Chip (~129 lines)
  - Files: `src/components/Chip.tsx` (new), `src/components/DateChips.tsx`, `src/components/CategoryPicker.tsx`,
    `src/components/CategorySheet.tsx` (items), `apps/mobile/demo-modules.txt`
  - Change: Chip as in Contracts; sites A–D with their overrides; `chipOn` and `catOn` go.
  - Verify: gates; `export:web` + `check-builds --accept`, with only the Chip line added. Then
    `rg -n "borderColor: colors\.accent, backgroundColor: colors\.accentTint" apps/mobile/src` finds only `Chip.tsx`,
    and the `accentTint` list matches the AC2 exceptions. Snapshots: `expense-new`, `expense-sheet`. Then the demo
    check.

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped. In this worktree, export
`DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. There are no unit tests to add,
because no pure logic changes (§6: UI is checked in the browser).

**Scratch draft.** The planner drafted every edit in a scratch copy outside the repo (the edited source, an untouched
copy of Base taken at dab7b78, the whole diff and the snapshot snippet). Base's copy differs from 1c60698 only in
`expense.tsx` and `NameCombobox.tsx`, which this plan doesn't edit, so the draft holds on the rebased branch.

The temp dir can be cleared, so Contracts is the source of truth. Slice 2's CategorySheet edit is the Close half of the
draft's diff for that file. It keeps the `size` import, which slice 3 removes.

## What moves (the PR lists this)

- **Expected: nothing.** Every view in both themes should be identical, with the same accessibility records. Any
  difference is a bug in the slice that caused it, and it gets fixed, not listed.
  - The square corners stay (Open question 3).
  - The sheet's raised fill and the dashed "more" stay as overrides (Open question 2).
  - `height` stays `height`.
- **Not caught by the snapshots, and listed:**
  - DateChips' chip lays out as a row instead of a column. With one centred label, at the default text size, no box
    changes.
  - Every IconButton site now passes `aria-expanded={undefined}` and, apart from Statistics' Next,
    `disabled={undefined}`, as today. Neither adds an attribute on web or an `accessibilityState` key on iOS.

## Visual check (AC3–AC6; not counted in the line estimates)

**Set-up.**

- This worktree has `node_modules`, but no `.env` files. Copy the two git-ignored files in, or run `api` from the main
  checkout (this PR doesn't change the API). Check `git status` is clean before the before set.
- **Same day, in November.** The expense form shows today's date, so the before and after sets must be taken on the
  same Kyiv day, or the DateField's text row differs. From 1 December, November has ended, and Budget's "+" and
  pencils, Income's "+", the Expenses rows' "+" and the ⋯ all disappear. In either case, take both sets again on that
  day's data. The view names stay the same.
- **One QA user**, created by the orchestrator before the before set and deleted when the brief is done:
  `yarn api create-user --username claude-qa-104d --email …`. Its ledger gets the default November list of 15
  categories.
- **Seed through the API as the user** (signed in from the page, credentials included), before the before set:
  - `GET /api/ledgers` gives the ledger id. `GET /api/ledgers/<id>/categories?month=2026-11` gives the categories and
    `quickCategoryIds`.
  - Two expenses with `POST /api/ledgers/<id>/expenses`:
    - `{ categoryId: <first quick id>, expenseDate: '<today>', name: 'qa', amount: '12.50', currency: 'EUR' }`
    - the same in a second category, dated `2026-11-03`
    - Note the first category's id as **C**.
  - One income item with `POST /api/ledgers/<id>/months/2026-11/income`: `{ title: 'Salary', amount: '1000.00' }`.
  - Don't pick from the category sheet in either set. A pick moves that category into the quick row.
- TOTP codes come from a scratch script in the system temp dir, and the secret is never printed. Wait for a fresh
  30 s window between sign-ins. Wrong codes count against the limit (5 in 24 hours), so don't guess.

**Snapshot script:** 104b's version (the 104 plan's script, with animations paused and `aria-busy` and `aria-disabled`
recorded), with these changes for this part. The full snippet is in the scratch file above.

- **The accessibility record adds `aria-selected` and `aria-expanded`** (AC5). The selector is
  `[role],[aria-label],[aria-busy],[aria-disabled],[aria-selected],[aria-expanded]`, and each entry records the six
  attributes `role|aria-label|aria-busy|aria-disabled|aria-selected|aria-expanded`.
- **Each row adds three values**, which is what these components draw:
  - `borderTopStyle` (the dashed "more")
  - `color` (the chip labels)
  - `el.getAttribute('stroke') || stroke` (icon colours: muted, accent, `fainter`)
- Its keys are `snap:before:104d:<view>:<scheme>` and `snap:after:104d:*`.
- Use 390×844, check `innerWidth === 390` in every result, and take Light, then Dark, for each view.
- On the first before view (`budget`), check that an icon's rows show an `rgb(…)` stroke. If they show `none`, read
  the `<svg>`'s `stroke` attribute instead, and use the same script for both sets.

**Views, in this order, the same in both sets** (navigate, wait about 2 s, snapshot):

| View            | Where / how                                                                                                                                                        | Shows                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `home`          | `/`                                                                                                                                                                | a control: no icon button or chip                                                                         |
| `budget`        | `/budget?month=2026-11`                                                                                                                                            | Home, both arrows, "+" (accent), 15 pencils (18pt, square)                                                |
| `income`        | `/income?month=2026-11`                                                                                                                                            | Home, both arrows, "+"                                                                                    |
| `expenses`      | `/expenses?month=2026-11`                                                                                                                                          | Home, both arrows, a "+" on each category row                                                             |
| `statistics`    | `/statistics` (it opens at the current month)                                                                                                                      | Previous; Next disabled: `aria-disabled="true"`, `fainter` stroke                                         |
| `category`      | `/category/C?month=2026-11`                                                                                                                                        | "+" and ⋯ with `aria-expanded="false"`                                                                    |
| `category-menu` | On `category`, tap ⋯. Don't press the menu row; reload afterwards                                                                                                  | ⋯ with `aria-expanded="true"`, the menu open                                                              |
| `expense-new`   | `/expense`                                                                                                                                                         | Today selected, Yesterday unselected; the first quick category selected, 4 unselected, "10 more" (dashed) |
| `expense-sheet` | On `expense-new`, tap "10 more". Wait until the sheet has stopped sliding: snapshot twice, 1 s apart, and keep the second only if it matches the first. Don't pick | the sheet's Close (square) and its 10 unselected raised chips                                             |

Before comparing `category-menu` and `expense-sheet` in the after set, confirm that the menu or sheet is open (the
`Close menu` or `Close category list` entry is in the record). If it isn't, reload and repeat.

**After set:** after slice 3, or per slice as listed in Slices, the same views, data and port, compared with
`eval(localStorage.__cmpSrc)('<view>', '<scheme>')`. Expected: `diffs: 0` and `a11ySame: true` for all 9 views × 2
schemes. The screenshots go in the PR, not the repo.

**Checked from the code only** (listed as such in the PR):

- Disabled category chips (the read-only expense form of an ended month). The API refuses an expense in an ended month,
  so the QA user can't have one. `disabled` passes straight through Chip to the same `Pressable`, as today.
- Statistics' Next when enabled, after stepping back a month. It's the same IconButton with `disabled` false.
- An expense dated yesterday (Yesterday selected). It's the same `selected` expression as Today.

**Demo (AC6):** `web-demo` (port 8082), Light and Dark, with the console open. Check Budget, Income, Expenses, a
category page with its ⋯ menu, and the expense form with its sheet open. There should be no errors. `yarn mobile
check-builds` (no `--accept`) passes on the last commit.

**Gate B, iPhone (Expo Go):** the month arrows on Budget, and a category chip on the expense form (tap one: the
selected look moves to it), in both themes.

## AC → evidence

| AC                                                                                                            | Evidence                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 the two components exist, tokens and palette only, no new token                                           | Slices 1 and 3. Their imports are the five listed in Contracts. `git diff origin/main -- apps/mobile/src/theme.ts` is empty                                                                                |
| AC2 they render the listed buttons and chips; no repeated icon box or selected colours, bar listed exceptions | Slices 1–3 (sites 1–11, A–D). Slice 2's `rg` finds only `IconButton.tsx`; slice 3's `rg` finds only `Chip.tsx`. The `accentTint` exceptions and the three one-caller props, with reasons, are in Contracts |
| AC3 before and after snapshots, nothing moves                                                                 | Visual check: 9 views × Light and Dark. Expected: 0 differences (What moves)                                                                                                                               |
| AC4 a selected and an unselected chip of each kind, and Statistics' disabled Next, as before                  | `expense-new` (date and category chips, both states), `expense-sheet` (the sheet's chips, never selected) and `statistics` (Next `aria-disabled`, `fainter` stroke), in both schemes. iPhone at Gate B     |
| AC5 roles, labels, `disabled`, `aria-selected`, `aria-expanded` unchanged                                     | `a11ySame: true` on all 9 views, with the record extended to `aria-selected` and `aria-expanded`. `category` and `category-menu` cover both `aria-expanded` values                                         |
| AC6 demo, no console errors; `check-builds` passes                                                            | Slices 1 and 3: `check-builds --accept` (one line each). After slice 3: the demo views in both themes with a clean console, and `check-builds` without `--accept` passes                                   |
| AC7 gates                                                                                                     | Every slice                                                                                                                                                                                                |

## Not doing (YAGNI)

- 105's look: round 44pt buttons, `raised` with a shadow, 32pt pills, `accentText` labels.
- A `raised` or `dashed` option on Chip, a padding option, or a label inside Chip (Open question 2). The labels' text
  roles are 104f.
- Moving AppearancePicker, LedgerPicker, the period menu's rows or NameCombobox's options onto Chip (Contracts).
- The header Backs (104e), Budget's Start → End line, Statistics' period button and the other out-of-scope items in the
  brief.
- Docs. The design spec's Components table describes 105's IconButton and Chip, and nothing in it goes stale. The
  BACKLOG row is the orchestrator's, when the PR is planned and merged.

## Risks

- **DateChips' label moves** when the column becomes a row. That shouldn't happen: one child, centred both ways, in a
  chip sized by its content. Slice 3's `expense-new` compares the label's row. If it moves, DateChips' `chip`
  override adds `flexDirection: 'column', justifyContent: 'center'` back (2 lines), and the plan's estimate holds.
- **The script misses the icon colour.** react-native-svg's web output might keep `stroke` where neither
  `getAttribute` nor the computed style finds it. The first before view checks for an `rgb(…)` stroke (Visual check).
  If it's missing, IconButton's colours are checked by eye on `budget` and `statistics`, and the PR says so.
- **The sheet's slide animation** gives different y values between runs. The double snapshot in the view table
  catches it.
- **The day changes, or November ends, between the sets.** Both are covered in Set-up.
- **Main moves again.** Rebase, take main's version and bump once more (§8b). If the move changes a snapshotted view,
  take a fresh baseline (104 script, step 7). The expense form changed in 1c60698, so take the before set after the
  rebase.

## Open questions

1. **Blocking: yes (Gate A). IconButton's colour: a `tone`, or the colour passed in (brief open question 1)?**
   - Recommended: `tone: 'muted' | 'accent'`, required, with `disabled` overriding it to `fainter`.
   - Both values have 2 or more callers (8 and 3), and the colours stay in one file, which 105 restyles.
   - Passing the colour in means every caller reads `useColors()`, and an icon could take any palette colour.
   - The snapshots show no difference either way.
   - Assumed: `tone`.
2. **Blocking: yes (Gate A). The sheet's raised chip (brief open question 2).**
   - Recommended: a style override in CategorySheet's `item` (`backgroundColor: colors.surfaceRaised`, with a
     comment), not a Chip option.
   - It's one caller, and 105 reworks the sheet's chips and surfaces anyway. The dashed "N more" is treated the same
     way.
   - The snapshots show no difference: the computed values are the same.
   - Assumed: override.
3. **Blocking: yes (Gate A). Budget's pencil and the sheet's Close: square or `radius.md` (brief open question 3)?**
   - Recommended: keep them square, with `borderRadius: 0` in the style each caller already has (a comment and a lint
     exception each, about 3 lines).
   - With `radius.md`, the only visible change would be a rounder web keyboard focus ring. The snapshots would show it
     as a radius change (`0px` → `14px`) on 15 pencils in `budget` and on Close in `expense-sheet`, for 32 rows across
     the two schemes, all of which would have to be listed and approved.
   - This is the same call as 104c's text buttons.
   - Assumed: square.
4. **Blocking: yes (Gate A). Size: 411 lines, against the brief's "split if more than 400".**
   - Recommended: one PR. It's 11 lines over, 237 of the 411 are deletions, and each slice is 149 lines or fewer. 104b
     was approved at 408.
   - Splitting means two before and after sets, two bumps and two reviews to save nothing in review effort.
   - If you'd rather split: PR 1 is slices 0–2 (IconButton, about 282 lines, bumping to 1.23.6), and PR 2 is slice 3
     (Chip, about 129 lines, its own bump, and only the `expense-new` and `expense-sheet` views).
   - Assumed: one PR.
5. **Blocking: no. Three one-caller props on IconButton** (`iconSize`, `aria-expanded`, `disabled`). The brief names
   them, and none can be a style (Contracts). Assumed: keep them.
6. **Blocking: no. Chip passes `Pressable`'s props through**, as Card passes `ViewProps`, instead of an explicit list
   (Approach). Assumed: pass-through.
7. **Blocking: no. Corrections to the brief:**
   - the sheet's chips are never selected
   - the Home tab has no icon button, and `home` is kept as a control view
   - Add expense is also on the Expenses rows and the category header
   - main has taken 1.23.5, so this is 1.23.6
   - Assumed: as written in Contracts and Version.

## Follow-ups

- For brief 105, delete these with the old look:
  - the two `borderRadius: 0` overrides
  - DateChips' 16pt padding
  - the sheet's `surfaceRaised` and the dashed "more" overrides, if 105 redraws them
  - Chip's fixed 48pt `height` (105: `size.chip`)
- AppearancePicker's selected option uses the chip's colour pair on a radio option. 105 decides whether the segmented
  control shares Chip's look.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

After the skeptic's APPROVE, with its four optional suggestions all taken:

1. The `rg "width: size\.iconButton"` result now reads 9 style lines in 8 files (MonthSwitcher and Statistics share
   one style per pair).
2. The scratch paths note that `base-src` is dab7b78, which differs from 1c60698 only in two files this plan doesn't
   edit.
3. `disabled` has no default in IconButton. Defaulting to `false` would change nothing on web, but on iOS RN's
   `Pressable` would add `disabled: false` to `accessibilityState` on 10 buttons that don't have it today. What Moves
   and the Contracts were updated to match.
4. Chip's style array gets a one-line comment: the caller's style comes last and must not set the border or fill.

The scratch draft was updated and re-checked (`tsc`, ESLint and Prettier are clean). Sizes: IconButton is 56 lines and
Chip 45. Slice 1 is ~149 lines and slice 3 ~129, for 411 in all (409 in `src` plus 2 in `demo-modules.txt`). Open
question 4 now says 11 lines over.

## Gate A (2026-11-25)

Approved by the user as recommended: one PR (about 411 lines, slices 1–2 IconButton, slice 3 Chip); `IconButton`
takes a `tone` (`muted`, `accent`); the category sheet's raised chips and the dashed "N more" stay style overrides.
Open question 3 stands as recommended: Budget's pencil and the sheet's Close keep their square corner
(`borderRadius: 0`), so nothing moves.

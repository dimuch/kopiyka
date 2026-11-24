# Plan: Shared components, part 1 of 6: Card and ProgressBar

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/shared-components
Base: origin/main (904351f, version 1.23.0; rebased twice after main moved, from 1caa333 and then a88d277)

## Approach

**Split (size).** I measured the brief's scope on Base. There are 173 `<Text>` sites in 35 files and 134 `...text.*`
style entries, 71 of them with a `fontFamily: fonts.*` override. There are 17 card styles with `surface` + `border` +
`radius.lg` (the brief says about 16; Settings' Members row is the 17th), 9 copies of the 44×44 box behind 11 icon
buttons, 12 filled buttons, about 16 outlined and text buttons, 3 chip grids, 10 header rows and 1 progress bar. All
seven components together come to **about 1,900 changed lines**, so the brief ships as six sequential briefs, with no
stacking. Each one branches from `origin/main` after the previous one merges, and gets a patch bump.

| Brief         | What ships                                                                                 | ≈ lines |
| ------------- | ------------------------------------------------------------------------------------------ | ------- |
| 104 (this PR) | `Card` (all 17 cards) and `ProgressBar`                                                    | 260     |
| 104b          | `Button`, filled kinds (accent, danger): the 12 filled buttons                             | 380     |
| 104c          | `Button`, outlined and text kinds; `outlinedDanger*` and `dangerText` leave `theme.ts`     | 250     |
| 104d          | `IconButton` (11 buttons, `HomeButton`, `AddExpenseButton`, `MonthSwitcher`) and `Chip`    | 350     |
| 104e          | `ScreenHeader` (10 header rows)                                                            | 340     |
| 104f          | `Text` at every remaining site (about 130 after 104b–104e take the button and header text) | 350     |

The order follows what brief 105 restyles most. Every card loses its border and gains a shadow, every filled button
becomes a 48pt pill, chips become 32pt pills, and the bar gets 4pt with a dot. Header buttons go round, and the type
swap comes last. **Text is not needed for the font swap.** No file outside `theme.ts` names a font or sets a
`fontWeight` (checked with `rg`), so 105's Inter faces reach every site through `fonts`. What `Text` adds for 105 is one
place to collapse the 71 face overrides, so it goes last and can't hold 105 up. `ScreenHeader` comes after `Button` and
`IconButton`, so its Back and Home are built from them. Each later part's plan measures its lines again. The outlines are
under "Later parts".

**This part.** It adds `src/components/Card.tsx` and `src/components/ProgressBar.tsx`, and moves the 17 card styles and
the Expenses bar onto them. Card and ProgressBar draw exactly today's styles (Contracts), so **nothing moves**: the
after snapshots must match the before set. Cards on a plain `View` become `<Card>`. Four hosts can't be a plain `View`:
two Pressables, two `Animated.View`s and two `ReorderList`s. Those take the same look from `useCardStyle()`, so their
trees and behaviour don't change.

Alternatives considered:

- **The brief's cut: `IconButton`, `ScreenHeader`, `Card` and `ProgressBar` first.** It measures about 860 lines
  (IconButton 260, ScreenHeader 340, this part 260), more than twice the limit. Of the four, Card and ProgressBar are what 105
  restyles most. The header pieces change least in 105, and they're better built after `Button` exists.
- **Wrap the four odd hosts in a `<Card>` instead of exporting `useCardStyle`.** It's one API instead of two. But each
  wrap changes something real. A Pressable around a Card puts the web focus ring on square corners. ReorderList's edge
  scrolling measures its own view, so the card's padding moving outside it changes where scrolling stops by 4–5pt. The
  hook keeps every host as it is.

## Contracts

- DB / API / DTOs / `theme.ts`: none. No new token.
- **`src/components/Card.tsx`** (new):

  ```ts
  /** padded: 16 all round. list: 4 above and below; its rows pad themselves and draw dividers to the edges.
   *  group: 4 all round, around radio options. none: the caller pads. */
  export type CardPadding = 'padded' | 'list' | 'group' | 'none';

  /** The card look, for a host that can't be a plain View: a Pressable, an Animated.View or ReorderList's `style`.
   *  A hook: call it at the component's top level only, never inside `.map` or after an early return. */
  export function useCardStyle(padding: CardPadding): StyleProp<ViewStyle>;

  /** A `surface` box with a 1pt `border` and `radius.lg`. Layout (gap, flex, margins, a one-off padding) comes in `style`. */
  export function Card(props: ViewProps & { padding: CardPadding }): React.JSX.Element;
  ```

  - `useCardStyle` reads `useThemedStyles(makeStyles)` and returns `[styles.card, styles[padding]]`.
    - `card` is `{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg }`.
    - `padded` is `{ padding: space.lg }`, `list` is `{ paddingVertical: space.xs }`, `group` is
      `{ padding: space.xs }` and `none` is `{}`.
  - `Card` renders `<View {...rest} style={[useCardStyle(padding), style]} />`. The `ViewProps` it passes on are
    `key`, `accessible`, `accessibilityLabel` and `accessibilityRole="radiogroup"`.
  - Card isn't pressable and has no role of its own. The pressable hosts keep their own role and label.

- **Card call sites** (all 17; "keeps" is what stays in the caller's own style):

  | Where                                         | Host                                                          | padding  | Caller keeps                                                                                                      |
  | --------------------------------------------- | ------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
  | `components/HomeCards.tsx` `card`             | Pressable, `[cardStyle, styles.card]`                         | `padded` | `flexBasis: '45%'`, `flexGrow: 1`, `gap: sm` (and its comment)                                                    |
  | `components/NotionSyncPanel.tsx` `card`       | `<Card>`                                                      | `padded` | `gap: sm`                                                                                                         |
  | `components/PendingInvites.tsx` `card`        | `<Card key>`                                                  | `padded` | `gap: sm`                                                                                                         |
  | `components/EmptyMonth.tsx` `card`            | `<Card>`                                                      | `none`   | `paddingVertical: xl`, `paddingHorizontal: lg`, `gap: lg`, `alignItems: 'center'` (its 20pt top/bottom)           |
  | `components/AppearancePicker.tsx` `group`     | `<Card accessibilityRole="radiogroup">`                       | `group`  | `flexDirection: 'row'`, `gap: sm`                                                                                 |
  | `components/LedgerPicker.tsx` `group`         | `<Card accessibilityRole="radiogroup">`                       | `group`  | `gap: sm`                                                                                                         |
  | `(tabs)/budget.tsx` `IncomeFigures` `figures` | `<Card accessible accessibilityLabel>`                        | `padded` | `flexDirection: 'row'`, `gap: sm`                                                                                 |
  | `(tabs)/budget.tsx` `listCard`                | ReorderList `style={listCard}`                                | `list`   | —                                                                                                                 |
  | `(tabs)/expenses.tsx` `card`                  | Animated.View, `[cardStyle, styles.card, collapse.cardStyle]` | `padded` | `gap: sm`                                                                                                         |
  | `(tabs)/expenses.tsx` `listCard`              | ReorderList `style={listCard}`                                | `list`   | —                                                                                                                 |
  | `(tabs)/income.tsx` `listCard`                | `<Card>`                                                      | `list`   | —                                                                                                                 |
  | `(tabs)/statistics.tsx` `card` (×3)           | `<Card>`                                                      | `list`   | —                                                                                                                 |
  | `(tabs)/settings.tsx` `account`               | `<Card>`                                                      | `padded` | `marginTop: md`, row, centred, `gap: md`                                                                          |
  | `(tabs)/settings.tsx` `members`               | Pressable, `[cardStyle, styles.members]`                      | `none`   | `marginTop: xxl`, `minHeight`, row, `space-between`, `paddingVertical: sm`, `paddingLeft: lg`, `paddingRight: md` |
  | `category/[categoryId].tsx` `card`            | Animated.View, `[cardStyle, styles.card, collapse.cardStyle]` | `padded` | `gap: xxs`                                                                                                        |
  | `category/[categoryId].tsx` `dayCard`         | `<Card>`                                                      | `none`   | —                                                                                                                 |
  | `members.tsx` `list` (×2: members, invited)   | `<Card>`                                                      | `none`   | —                                                                                                                 |

  Every `padded` site has 16/16 padding today, `list` sites have `paddingVertical: xs` only, and `group` sites have
  `padding: xs`. EmptyMonth and Settings' Members row pass `none` with their own padding. A `padded` plus a
  `paddingVertical` override would rely on longhand-over-shorthand precedence, which isn't worth the doubt on web.
  `useCardStyle` is called at the top of `HomeCards`, `Settings`, `Expenses` (twice), `Budget` and
  `CategoryBreakdown`.

- **Surfaces that stay as they are**, each with its reason:
  - `UndoToast`: raised (`surfaceRaised` + `borderStrong`) and floating over the screen. It's 105's `shadow.float`, not
    a card.
  - The category ⋯ menu and the Statistics period menu (`menuCard`): raised, `radius.md`, floating.
  - Members' `ConfirmPanel`: raised and `radius.md`. In dark it's a step lighter than a card, so a Card would recolour
    it.
  - `CategorySheet` and `DateField`'s iOS sheet: sheets, with top-only `radius.xl` and a top border (the brief puts
    sheets out of scope).
  - `NameCombobox`'s list: `radius.md` + `borderStrong`, attached to its field (inputs are out of scope).
  - The expense form's "Added" note: `accentTint`/`accentLine`, `radius.md`. It's a note, not a card.
  - `ReorderList`'s held row: `surface` only while it's dragged.
  - Buttons with `radius.lg` (Save, Add, Remove) and the chips belong to 104b and 104d.

- **`src/components/ProgressBar.tsx`** (new):

  ```ts
  /** A category's spending against its plan: `fill` 0–1 of the track (BudgetProgress.fill), coloured by `state`. */
  export function ProgressBar({ fill, state }: { fill: number; state: BudgetState }): React.JSX.Element;
  ```

  - It draws the Expenses tab's track and fill exactly as today:
    - track: `{ height: 5, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' }`
    - fill: `{ height: 5, borderRadius: radius.pill }`, with `` width: `${fill * 100}%` `` and
      `backgroundColor: progressColor(state, colors)`
  - `progressColor` stays in `theme.ts`, as the brief says. `height` isn't a guarded key, so 5 needs no allowlist.
  - It has no role or label, as today: the row's label already says "€X of €Y spent, €Z over".
  - Caller: `(tabs)/expenses.tsx`, `<ProgressBar fill={row.progress.fill} state={row.progress.state} />`.

- **Demo** (`apps/mobile/demo-modules.txt`): both new files reach the demo, through EmptyMonth, HomeCards, Budget,
  Income, Expenses and the category screen. Slice 1 adds `src/components/Card.tsx` and slice 3 adds
  `src/components/ProgressBar.tsx`, each with `yarn mobile export:web && yarn mobile check-builds --accept`. The list's
  diff is that one line each time.
- Reuses: `useThemedStyles`/`useColors`, `space`/`radius` tokens, `progressColor`, `BudgetState`, the 103 snapshot
  recipe. No existing component does either job (searched `src/components`: no `Card`, `ProgressBar` or card style
  helper).
- New dependencies: none.

## Version

Bump: patch — 1.23.0 → 1.23.1
Why: §8b `patch` ("behaviour-preserving refactor that touches shipped code"). The app's shipped components change shape
in code but draw the same. There's no new capability, and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator takes the **before** set on Base (Visual check). Slice 0 only touches the version.

- [x] 0. Bump version to 1.23.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.1
- [x] 1. Draw the shared components' cards with one Card component (~105 lines)
  - Files: `src/components/Card.tsx` (new), `src/components/{HomeCards,NotionSyncPanel,PendingInvites,EmptyMonth,AppearancePicker,LedgerPicker}.tsx`,
    `apps/mobile/demo-modules.txt`
  - Change: Card as in Contracts. The six sites follow the call-site table, and each style keeps only its "Caller
    keeps" keys. Drop imports that go unused: `View` in EmptyMonth, AppearancePicker and LedgerPicker, and `radius` in
    HomeCards.
  - Verify: gates; `export:web` + `check-builds --accept`, with only the Card line added. In the browser: Home, Settings
    (Appearance) and an empty month on Budget against their before snapshots.
- [x] 2. Draw the screens' cards with Card (~112 lines)
  - Files: `src/app/(tabs)/{budget,expenses,income,statistics,settings}.tsx`, `src/app/category/[categoryId].tsx`,
    `src/app/members.tsx`
  - Change: the other 11 rows of the call-site table, and drop imports that go unused.
  - Verify: gates. `rg -n "borderColor: colors\.border[,} ]" apps/mobile/src` → only `src/components/Card.tsx`, where
    Base has 17 (AC2 for cards). In the browser: Budget, Income, Expenses, Statistics, Settings, the category screen
    and Members against their before snapshots.
- [x] 3. Draw the Expenses tab's bars with a ProgressBar component (~44 lines)
  - Files: `src/components/ProgressBar.tsx` (new), `src/app/(tabs)/expenses.tsx`, `apps/mobile/demo-modules.txt`,
    `docs/design/design-system.md`
  - Change: ProgressBar as in Contracts. The row's 11-line track block becomes one line. The `track` and `bar` styles
    go, and so do the `progressColor` and `radius` imports from `expenses.tsx`. In the design spec, Roll-out item 2's
    heading becomes `**104 · Shared components** (split into 104–104f):`.
  - Verify: gates; `check-builds --accept`, with only the ProgressBar line added.
    `rg -n "colors\.track|progressColor\(" apps/mobile/src` → only `ProgressBar.tsx` (and the definition in
    `theme.ts`). Then the full **after** set, the accessibility record and the demo check (Visual check).

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, without piping. In this worktree,
export `DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. There's no new unit test:
the slices add no pure logic (§6, so UI is checked in the browser), and nothing in `data/` or `format.ts` changes.

## What moves (the PR lists this)

**Nothing.** Card and ProgressBar put the same style values on the same kind of host, and every host stays in place:
no wrapper Views and no reordered children. The only difference in the style arrays is order, Card's entries before
the caller's. No caller sets a key that Card also sets (EmptyMonth and the Members row use `none`). So the after set
must match the before set to the point, in both themes. Any difference at all is a bug in the slice that caused it,
and it gets fixed, not listed.

## Visual check (AC4–AC6; not counted in the line estimates)

**Set-up, checked while planning.**

- This worktree has no `node_modules`, so run `yarn install` first. It uses the lockfile and changes nothing in git:
  check `git status` after.
- It has no `apps/api/.env` or `apps/mobile/.env` either. Either run `api` from the main checkout, which is on Base
  (this PR doesn't change the API), or copy both git-ignored files in.
- Use `claude-qa-103b` (#168): it owns ledger #165, is its only member, and has no pending invites (a read-only query
  while planning). Get TOTP codes from a scratch script in the system temp dir, and don't print the secret. A wrong
  code counts against the IP's limit (5 in 24 hours), so don't guess.

**Data.** Use the November data that 103c seeded on #165. Before the before set, check that Expenses shows at least one
bar under plan, one near it (90% up to plan) and one over plan. If any state is missing, add expenses as the QA user
and keep them, so the after set has the same data. Also check that the category screen has one category with expenses
on 2 or more days.

**Before set (the orchestrator, on Base 1caa333 (before the rebase onto a88d277), before slice 1).** Start `web` (port 8081) from `.claude/launch.json`
in this worktree, and `api` as above. Use the in-app browser at 390×844. Set the scheme with
`localStorage.setItem('kopiyka.theme', 'light')` (then `'dark'`) and reload. Store layout snapshots under
`snap:before:104:<view>:<scheme>`, and keep the older `snap:before:*` keys. Nine views, each in Light and then Dark
(18 snapshots):

- `home`: `/`, the Home cards.
- `budget`: November, with the income figures card and the list card.
- `budget-empty`: a future month with no categories (EmptyMonth, as in 103b).
- `income`: November's list card.
- `expenses`: November's figures card, list card and bars. If the list runs past the screen, take a second view,
  `expenses-end`, scrolled to the bottom.
- `statistics`: the default period (totals card and By category).
- `settings`: the account card, the Members row and the Appearance group.
- `category`: the category with expenses on 2 or more days (Spent card and day cards).
- `members`: as owner (the members list card).

Also record **accessibility** for each view, in Light only, under `snap:before:104:a11y:<view>`:

```js
[...document.querySelectorAll('[role],[aria-label]')].map(
  (e) => `${e.getAttribute('role')}|${e.getAttribute('aria-label')}`,
);
```

**Not affected, so not snapshotted:** the expense form, the category form, delete category, the income item, login and
no-ledger. The PR's `git diff --stat` shows that none of their files, nor any component they render, changes. The one
exception is no-ledger's `PendingInvites`, which shows only with an invite; it's covered under "code only" below.

**Checked from the code only** (listed as such in the PR; Open question 6):

- `PendingInvites`: the QA user has no invites, so this covers Home, Settings and no-ledger with an invite.
- `LedgerPicker`: it shows only with two ledgers.
- `NotionSyncPanel`: it's hidden for a ledger Notion doesn't sync.
- Members' Invited list: no pending invite.
- Ended-month rows and every `LoadError` state, which don't touch the cards.

**After set:** after slice 3, the same views on the same port, data and month. Compare each pair, and the
accessibility records, against What moves (nothing). The screenshots go in the PR, not the repo.

**Demo (AC6):** `web-demo` from `launch.json` (port 8082). Check Home, Budget, Income, Expenses and a category, Light
and Dark, with the console open: no red screen and no errors. `yarn mobile check-builds` (no `--accept`) passes on the
last commit.

**Gate B, iPhone (Expo Go):** glance at Home, Expenses (the bars), Settings and a category screen. Nothing should
look different.

## AC → evidence

| AC                                                                  | Evidence                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 the components exist, tokens only, no new token, a11y           | This part covers Card and ProgressBar (slices 1 and 3). Both import only `react-native`, `@/appearance/AppearanceContext` and `@/theme` (plus `BudgetState`); `git diff origin/main -- apps/mobile/src/theme.ts` is empty; neither is pressable. The other five components: 104b–104f (Later parts) |
| AC2 no hand-written cards (and buttons, icon boxes, chips, headers) | Cards: slice 2's `rg` → only `Card.tsx`; the exceptions with reasons are in Contracts. Buttons, icon boxes, chips and headers: 104b–104e                                                                                                                                                            |
| AC3 every text through `Text`                                       | 104f (Open question 2)                                                                                                                                                                                                                                                                              |
| AC4 before/after snapshots, shifts ≤2pt                             | Visual check: 9 views × 2 schemes on Base and after slice 3. Expected: identical (What moves). Untouched views shown by the diff stat. Code-only list in the PR                                                                                                                                     |
| AC5 accessibility doesn't regress                                   | The `a11y:<view>` records match before and after; no size, role or label changes in Contracts; no header gains a role in this part                                                                                                                                                                  |
| AC6 demo, no console errors; `check-builds` passes                  | Slices 1 and 3: `check-builds --accept` (one line each in `demo-modules.txt`); slice 3: demo views in both themes, console clean; `check-builds` without `--accept` passes                                                                                                                          |
| AC7 gates                                                           | Every slice                                                                                                                                                                                                                                                                                         |

## Not doing (YAGNI)

- `Button`, `IconButton`, `Chip`, `ScreenHeader`, `Text`: later parts.
- A pressable or animated `Card` variant: `useCardStyle` serves those four hosts.
- Raised surfaces (toast, menus, panel, sheets, combobox list) in Card: they differ in colour, radius or border
  (Contracts).
- 105's look: no shadow, no borderless cards, no `md` card padding, no 4pt bar, dot or violet.
- A `progressbar` role on the bar. It would add a new screen-reader stop, which is a behaviour change.
- Other docs: the design spec's "Components" table already describes these components (for 105's look); only its
  Roll-out line changes (slice 3).

## Risks

- **Style-array typing on `Animated.View` and `ReorderList`.** `useCardStyle` returns `StyleProp<ViewStyle>`, nested
  inside each host's array. Slice 2's typecheck proves it. If `Animated.View` rejects it, the hook returns
  `StyleSheet.compose(styles.card, styles[padding])` instead, which is the same style and one line.
- **A host that silently changes.** ReorderList's measuring and the collapse fade read the same `View` as before, so
  nothing changes there. Slice 2's snapshots, plus a long-press drag on Budget and a scroll on Expenses after slice 2,
  prove it.
- **Missing bar states in the QA data.** That would make the ProgressBar check weaker. The Data step adds expenses
  before the before set.
- **Worktree set-up** (no `node_modules`, no `.env`): handled in the Visual check set-up, before the before set.
- **Later-part estimates are rough.** Each later plan re-measures, and splits again if it passes 400.
- **Main moves:** if another PR takes 1.23.1, rebase, take main's number and bump once more (§8b).

## Open questions

1. **Blocking: yes (Gate A). The split and what part 1 holds.**
   - Recommended: six sequential briefs (Approach table), with **Card + ProgressBar first** (about 260 lines).
   - The brief's cut (IconButton, ScreenHeader, Card, ProgressBar) measures about 860.
   - 104b–104f briefs are written from "Later parts" after each previous part merges, as with 103.
   - Assumed: approved.
2. **Blocking: no for this PR, decided for 104f. Text scope (brief open question 1).**
   - Recommended: every site, as AC3 says, in the last part.
   - Fact found: 105's font swap doesn't need `Text`. All faces come from `fonts` in `theme.ts`. `Text`'s value for 105
     is one place for the 71 face overrides (body+medium 14, label+regular 12, heading+display 11, label+semibold 5).
   - So 104f should give those combinations names in `Text.tsx`, composed from tokens and not new tokens. Then 105 maps
     each to an Inter weight once. A one-off would keep a `style`.
   - Putting `Text` last lets 105 start before it, if you'd rather.
   - Assumed: every site, last.
3. **Blocking: yes (Gate A). ProgressBar now, or leave it to 105 (brief open question 2)?**
   - Recommended: now, in slice 3 (about 44 lines).
   - AC1 asks for it. The brief is an explicit instruction, and in the conventions' rule precedence that outranks their
     rule of three. The spec names it too.
   - 105 rebuilds it (4pt, dot, violet), and with it extracted, 105 doesn't touch `expenses.tsx` for that.
   - Against: one caller today.
   - Assumed: extract now.
4. **Blocking: yes (Gate A). Card's padding (brief open question 3).**
   - Recommended: a required `padding` prop, `'padded' | 'list' | 'group' | 'none'`, with layout in `style`.
   - It's not the brief's `none / xs / lg`: "xs" is two shapes today. `list` is vertical only and `group` is all round.
     Making them one would move every list row and divider 4pt in from the card's edge.
   - The prop, not `style`, because 105 retunes card padding (spec `md`). As a prop that's one line in `Card.tsx`;
     in `style` it's 17 copies to edit.
   - The two one-offs (EmptyMonth 20/16, Settings' Members row 8/16/12) pass `none` with their own padding.
   - Assumed: as recommended.
5. **Blocking: no. `useCardStyle` for the four hosts that can't be a plain View** (Approach, Alternatives). Assumed: the
   hook.
6. **Blocking: no. Views without QA data are checked from the code only:** `PendingInvites`, `LedgerPicker`,
   `NotionSyncPanel` and Members' Invited list. This is the same choice 103b's Gate A made. The alternative is a
   temporary user `claude-qa-104-b` with its own ledger and an invite to #168, inserted in SQL, deleted after Gate B.
   Assumed: code only.
7. **Blocking: no. AC4 says "the five tabs".** There are six (Home, Budget, Income, Expenses, Statistics, Settings).
   Assumed: all six; this part snapshots each one it touches, which is all six.

## Later parts (outline; each brief is written after the previous part merges)

Each part: base main after the previous one, patch bump, before/after snapshots of the views its components touch,
"nothing moves" unless its plan lists a shift. The line counts are estimates from Base.

- **104b, `Button` filled (≈ 380):** `Button({ variant: 'primary' | 'danger', label, onPress, busy, disabled, … })`.
  - It covers CategoryForm Save, income-item Save, expense Add/Update (with its "+" icon), login Sign in,
    delete-category's danger button, the actual End form's Save (main 63129b5), EmptyMonth, Members Save, Invite and confirm, PendingInvites Accept, and
    NotionSync.
  - Today's look stays through props, each needing 2+ callers:
    - height 56/48/44
    - corner `lg`/`md`/`pill`
    - NotionSync's 13pt label
  - Its Gate A decides whether disabled opacity (0.6/0.5/0.4) and spinner placement (replacing the label at 6 sites,
    beside it at 4) stay per site or unify. Those are states, not layout.
  - Split by screen if its count passes 400.
- **104c, `Button` outlined and text (≈ 250):** `outlinedDanger` (Sign out ×2, Leave ledger), danger text (Remove,
  Delete item, Delete expense, Members Remove/Revoke), muted text (Decline, Members' Back/Close, the expense form's
  LoadFailed Back) and accent links (LoadError Retry, NotionSync Retry, Check for invites, login's two links, DemoStrip).
  - `outlinedDangerButton`, `outlinedDangerText` and `dangerText` leave `theme.ts` once unused. Exceptions it decides:
    the ⋯ menu's "Remove from …" item (a menu row), and UndoToast's 56pt Undo inside the toast.
- **104d, `IconButton` and `Chip` (≈ 260 + 90):**
  - `IconButton({ icon, label, onPress, tone?: 'muted' | 'accent', iconSize?, disabled?, 'aria-expanded'?, style? })`.
    - A disabled icon is `fainter`, which is Statistics' Next today.
    - It covers HomeButton, AddExpenseButton, MonthSwitcher's arrows, Statistics' two arrows, Budget's "+" and pencil
      (18pt), Income's "+", the category ⋯ and CategorySheet's close.
    - Budget's pencil and the sheet's close gain `radius.md`, so their web focus ring corners round. List it.
  - `Chip({ selected?, … })`, 48pt as today: DateChips and CategoryPicker. CategoryPicker's dashed "N more" keeps a
    style override.
    - CategorySheet's items are `surfaceRaised`, which in dark differs from `surface`. They become a Chip `raised`
      option or stay an exception, and the plan decides.
- **104e, `ScreenHeader` (≈ 340):** three variants, no booleans.
  - `modal`: text Back, centred title and the 52pt spacer, for the 4 form screens and the actual End form. Their 8pt top padding stays on the
    screens.
  - `month`: Home, the MonthSwitcher and an optional action, on equal sides (Budget, Income, Expenses).
  - `page`: icon Back with a label, optional actions and the optional `HeaderDivider` (the category screen, its
    bad-link view, Members).
  - Back is built on 104c's muted text Button.
  - Statistics (Home beside a left-aligned title) becomes a fourth variant or stays an exception; the plan decides.
    Home's ledger title isn't a header row.
  - If the modal titles gain `accessibilityRole="header"`, the PR says so (AC5).
- **104f, `Text` (≈ 350; split into components and screens if it passes 400):**
  `Text({ variant, color = 'text', … })`. The variants are the `text` roles, plus named face combinations
  (Open question 2).
  - Exceptions: CategoryTile's size-derived letter, text in `TextInput`s, TabBar's badge (TabBar belongs to 106), and
    MonthSwitcher's eyebrow and the category day labels' +0.5 tracking stay as allowlisted styles.
  - Nested `Text` must not override the colour it inherits.
  - Its Gate A decides the two weight inconsistencies from the brief (the expense and income-item inputs type in
    regular weight; login's field label is medium). Each one is either kept, or fixed and listed.
  - After it, conventions §5 gets a line pointing new code at the seven components (a proposal, not a slice).

## Follow-ups

- For the later briefs and 105: the survey numbers measured here (Approach) replace the brief's estimates, and the 71
  `fontFamily: fonts.*` overrides are 105's per-site weight decisions unless 104f names them.

## Deviations

- **Snapshot script.** No 103 snapshot script survived, so the before and after sets used a new one: every rendered
  element's box (to 0.5px), background, top border, top-left radius, padding and opacity, in DOM order, plus the
  `[role],[aria-label]` record, in local storage under `snap:before:104:*` and `snap:after:104:*`. It measures
  off-screen elements too, so no `expenses-end` view was needed.
- **Result:** all 18 pairs (9 views × light and dark) are identical, with 0 differing elements and the same roles and
  labels.
- **Behaviour checks after slice 2:** Expenses scrolls and its summary card fades out (opacity 0) as before. On Budget, a long
  press lifts the groceries row (the held style shows) and it drops back in place; Budget then matches its before
  snapshot again.
- **Main moved twice during the build.**
  - First to a88d277 (1.22.0), which also added a draft 104 brief. The brief approved at Gate A replaces main's
    unreviewed draft, and `BACKLOG.md`'s 104 row records the split. Those changes touched the demo store and docs,
    none of this branch's files.
  - Then to 904351f (1.23.0), the actual End form. It adds a "Start → End" line to Budget, which this branch also
    edits (merged cleanly). Budget got a fresh baseline from main's `budget.tsx` (`snap:before:104:budget2:*`), and
    the branch's Budget matches it in light and dark: 0 differing elements, same roles and labels.
  - Slice 0 now bumps 1.23.0 → 1.23.1.
  - The new `actual-end.tsx` has no card. Its 56pt Save and modal header join 104b and 104e below.
- The demo (port 8082) showed Home, Budget, Income, Expenses (with bars) and a category, light and dark, with no console
  errors. The app's console shows only the pre-existing 404s for `notion/status` (the QA ledger isn't synced) and
  the 401 from before sign-in.

## Consolidate

CONSOLIDATE: reused 0 · extracted 0 · left 3.

- `Card` / `useCardStyle`: LEAVE. Their twins were the 17 card styles, which slices 1–2 already replaced. The other
  `surface` boxes (menus, the toast, sheets, `ConfirmPanel`, `NameCombobox`'s list, the "Added" note) differ in colour
  or radius, as Contracts lists, and belong to 105 or the later parts.
- `ProgressBar`: LEAVE. It has no twin: `rg "colors\.track|progressColor\("` finds only `ProgressBar.tsx` and the
  definition in `theme.ts`.
- `EmptyMonth`'s and the Members row's own padding stay in their callers (`none`): two one-offs, under the rule of
  three.

## Gate A (2026-11-24)

Approved by the user as recommended: six sequential briefs with Card and ProgressBar first (open question 1),
ProgressBar extracted now (3), and Card's required `padding` prop with `'padded' | 'list' | 'group' | 'none'` (4).
Questions 2 and 5–7 stand as assumed.

# Plan: Shared components, part 5: ScreenHeader

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/screen-header
Base: origin/main (60b18a6, version 1.23.6)

## Approach

Add `src/components/ScreenHeader.tsx` with three variants, `modal`, `month` and `page`, and move the brief's 10
headers onto it. On screen that's 11 header rows, because the category page draws one for its bad-link view too. The
props are a union keyed by `variant`. Each variant draws exactly today's row (Contracts), so **nothing moves**. The one
change I propose is a header role on the modal titles (Open question 2).

- **modal** (5 forms): 104c's `mutedText` `Button` as Back, with today's −8/8 side offsets as a style, then the title
  and the 52pt spacer.
- **month** (3 tabs): the equal-width sides around `HomeButton` and `MonthSwitcher`, with the tab's action passed in
  as `trailing`.
- **page** (category page, its bad link, Members): the icon-and-label Back as its own `Pressable` inside
  ScreenHeader, plus `trailing` and the divider.
- **Divider.** Expenses and the category page draw `HeaderDivider` and raise their header (`zIndex: 1`), so their list
  scrolls under it. Both pass `dividerStyle`, and ScreenHeader draws the hairline and raises the row only when it gets
  one.

**Size.** I made every edit in a scratch copy of `apps/mobile` and ran it through the repo's Prettier, `tsc` and
ESLint. All clean, with no warnings. It comes to **408 changed lines in `src` (212 added, 196 removed) in 11 files**,
plus 1 line in `demo-modules.txt`, so **409** in all.

- That's 9 lines over the brief's "split if more than 400", and 48% of it is deletions. Each slice is 141 lines or
  fewer.
- Recommended: one PR in 4 slices, as at 104b (408) and 104d (411) (Open question 4).
- **Why the component lands whole in slice 1.** I also drafted it growing one variant per slice, which is the
  brief's split by variant. That came to 466 lines, with slices of 171 and 164. Each new variant re-indents the
  earlier ones and rewrites the props type. Landing it whole, as Button and IconButton did, costs nothing extra.

Alternatives considered:

- **Page Back on `Button`.** Button takes an icon only in its filled looks, and draws it in `onAccent` with a 2.4
  stroke and a gap of 8. Members' and the category page's Back uses a muted icon and a gap of 4. Extending Button's
  union for two callers would change Button. Brief 105 turns this Back into a round icon button anyway.
- **`zIndex: 1` on every header.** That would be one style fewer. But Budget's Start → End line sits 8pt up into the
  header's bottom padding (`marginTop: -space.sm`). A raised header would cover the line's top 8pt on web and take
  those taps.
- **A fourth variant for Statistics** (Open question 1).
- **Named "+" props on `month`** (Open question 3).

## Contracts

- DB / API / DTOs / `theme.ts`: none. No new token.
- **`src/components/ScreenHeader.tsx`** (new; drafted at 120 lines):

  ```ts
  /** On a screen whose list scrolls under the header: the hairline's opacity from `useCollapsingSummary`. */
  type Collapsing = { dividerStyle?: object };

  type Props =
    | { variant: 'modal'; title: string; onBack: () => void; disabled?: boolean }
    | ({
        variant: 'month';
        /** The tab's title for MonthSwitcher's caption, not a title the header draws (unlike `modal`'s). */
        title: string;
        month: string;
        onMonthChange: (month: string) => void;
        trailing?: ReactNode;
      } & Collapsing)
    | ({ variant: 'page'; backLabel: string; onBack: () => void; trailing?: ReactNode } & Collapsing);

  /** A screen's top row, in one of three looks (`variant`). The screen keeps its own top padding. */
  export function ScreenHeader(props: Props): React.JSX.Element;
  ```

  - **modal**:
    - `<View style={styles.modal}>`, which holds, in order:
      - `<Button variant="mutedText" size="compact" label="Back" disabled={props.disabled} onPress={props.onBack}
style={styles.modalBack} />`
      - `<Text accessibilityRole="header" style={styles.title}>` (the role is Open question 2)
      - `<View style={styles.spacer} />`
    - `modal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }`.
      Today it's a margin, not padding, and it stays one, so the row's box stays 44 tall.
    - `modalBack: { marginLeft: -space.sm, paddingHorizontal: space.sm }`. It goes on top of Button's `compact` and
      `mutedText` styles: a 44 minimum height, no corner, a row centred both ways, gap 8.
    - `title: { ...text.heading, fontFamily: fonts.display, color: colors.text }`
    - `spacer: { width: 52 }`, with the comment "About Back's width, so the title sits near the row's centre". `width`
      isn't one of the lint-guarded keys, so it needs no exception.
  - **month**:
    - `<View style={[styles.month, lifted]}>`, which holds, in order:
      - `<View style={styles.side}><HomeButton /></View>`
      - `<MonthSwitcher title month onChange={onMonthChange} />`
      - `<View style={[styles.side, styles.sideEnd]}>{trailing}</View>`
      - the divider
    - `month: { flexDirection: 'row', alignItems: 'center', paddingBottom: space.sm }`
    - `side: { flex: 1, flexBasis: 0, flexDirection: 'row' }`, with today's comment: "flexBasis 0 matters on web".
    - `sideEnd: { justifyContent: 'flex-end' }`
  - **page**:
    - `<View style={[styles.page, lifted]}>`, which holds, in order:
      - Back: `<Pressable accessibilityRole="button" onPress={onBack} style={styles.pageBack}>`, holding
        `<Icon name="back" color={colors.muted} />` and `<Text style={styles.backText}>{backLabel}</Text>`
      - when `trailing !== undefined`, `<View style={styles.trailing}>{trailing}</View>`. P1 always passes a fragment,
        which may render nothing, so it keeps today's `trailing` View even when that View is empty. Members and P2 pass
        nothing and draw no View, as today.
      - the divider
    - `page: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md,
paddingBottom: space.sm }`
    - `pageBack: { height: size.iconButton, flexDirection: 'row', alignItems: 'center', gap: space.xs, marginLeft:
-space.sm, paddingHorizontal: space.sm }`
    - `backText: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.muted }`
    - `trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 }`
  - **Divider**: with `dividerStyle`, the row adds `lifted: { zIndex: 1 }` (comment: "Over the list that scrolls under
    the header") and `<HeaderDivider style={dividerStyle} />` as its last child. Without it, neither is there.
  - Styles: `makeStyles(colors)`, read with `useThemedStyles`. Icon's colour comes from `useColors()`.
  - Imports, each from its own file (there's no `@/components` barrel): `react` (type only), `react-native`,
    `@/appearance/AppearanceContext`, `@/components/Button`, `@/components/CollapsingSummary` (`HeaderDivider`, still
    exported there), `@/components/HomeButton`, `@/components/Icon`, `@/components/MonthSwitcher`,
    `@/components/Pressable` and `@/theme`.

- **No boolean props** (AC1):
  - The look comes only from `variant`.
  - `disabled` is the one boolean. It's a state, not a look, and the brief asks for it ("so does `disabled` while a
    form is saving"). It reaches Button unchanged, as it does for every other Button caller (Open question 5).
  - The optional `trailing` and `dividerStyle` take content, not flags.

- **Header call sites, measured on Base:**

  **modal.** All five share the same values:

  - Row: `row`, `center`, `space-between`, **`marginBottom` 8**.
  - Back: role `button`, with no label prop, so its name is the word "Back".
    - Box: `height` 44, a column with `justifyContent: 'center'`, `marginLeft` −8, padding 8 on each side, no corner.
    - Text: `body` in `bodyMedium`, `muted`.
  - Title: `heading` in `fonts.display`, `text` colour, **no role**.
  - Spacer: `{ width: 52 }`.
  - Screen: top padding 8, side padding 20.

  | #   | Screen            | `title`                                        | `onBack`                     | `disabled`                                                                       |
  | --- | ----------------- | ---------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
  | M1  | `category-form`   | `editing ? 'Edit category' : 'Add a category'` | `() => closeToBudget(month)` | `busy`                                                                           |
  | M2  | `actual-end`      | `'Actual end'`                                 | `() => closeToBudget(month)` | `busy`                                                                           |
  | M3  | `income-item`     | `editing ? 'Edit income' : 'Add income'`       | `() => leave(month)`         | `busy`                                                                           |
  | M4  | `delete-category` | `'Remove category'`                            | `leave`                      | `busy`                                                                           |
  | M5  | `expense`         | `editing ? 'Edit expense' : 'New expense'`     | `leave`                      | none: today its Back is never disabled (`busy` lives in `ExpenseForm`, below it) |
  - **The expense form has one header.** `ExpenseScreen` draws it once, above every state: loading, load error, the
    locked (ended-month) form and the open form.
  - The Back under a failed load (`LoadFailed`) isn't a header. It's 104c's `mutedText` Button below the error, and it
    stays as it is.
  - The other forms' bad links (`LoadError`, `CategoryInMonth`) also sit under their screen's one header.

  **month.**

  - Row: `row`, `center`, **`paddingBottom` 8**.
  - Sides: `flex: 1, flexBasis: 0, flexDirection: 'row'`. The right one adds `justifyContent: 'flex-end'`.
  - Screen: top padding 20.

  | #   | Screen     | `title`, `onMonthChange`                                            | `trailing` today                                                                   | Divider                     |
  | --- | ---------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------- |
  | T1  | `budget`   | `tabTitle('budget')`, `(m) => router.setParams({ month: m })`       | `data && !ended ?` IconButton `plus`, accent, "Add a category to {Month}" `: null` | none                        |
  | T2  | `income`   | `tabTitle('income')`, `(next) => router.setParams({ month: next })` | `items && !ended ?` IconButton `plus`, accent, "Add income to {Month}" `: null`    | none                        |
  | T3  | `expenses` | `tabTitle('expenses')`, `setMonth`                                  | none; its right side is an empty `side`, without `sideEnd`                         | `HeaderDivider`, `zIndex` 1 |

  The comments over Budget's and Income's "+" move into their `trailing` prop. Expenses' "the empty side keeps the
  month centred" comment becomes one line above its `<ScreenHeader>`.

  **page.**

  - Back: role `button`, with no label prop, so its name comes from its text.
    - Box: `height` 44, a row centred vertically, gap 4, `marginLeft` −8, padding 8 on each side.
    - Content: `Icon back` at 20, `muted`, then the label in `body` and `bodyMedium`, `muted`.
  - Screen: top padding 20.

  | #   | Screen                                    | `backLabel`        | `trailing`                                                                                                                       | Row today                                                               |
  | --- | ----------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
  | P1  | `category/[categoryId]` CategoryBreakdown | `monthName(month)` | a fragment: `CompactTotal` (when `category`), `AddExpenseButton` (when `showAdd`), ⋯ (when `category && !ended`), always wrapped | `space-between`, gap 12, `paddingBottom` 8, `zIndex` 1, `HeaderDivider` |
  | P2  | `category/[categoryId]` InvalidLink       | `"Back"`           | none                                                                                                                             | the same style: `zIndex` 1, **no divider**                              |
  | P3  | `members`                                 | `"Back"`           | none                                                                                                                             | `row`, `center`, `paddingBottom` 8 (no gap, no justify, no `zIndex`)    |

  On the category page, the ⋯ menu's `top: insets.top + 64` (paddingTop 20 + the 44pt row) still holds, because the
  row keeps its height.

- **Caller clean-up** (from the draft; lint doesn't catch unused StyleSheet keys):
  - **Styles go:**
    - from the five forms: `header`, `back`, `backText` and `title`
    - from the three tabs: `header` and `side`, plus `sideEnd` on Budget and Income
    - from the category page: `header`, `back`, `backText` and `trailing`
    - from Members: `header`, `back` and `backText`
  - **Imports go:**
    - `Pressable`: all five forms and Members
    - `Text`, `View`, `fonts`, `size`, `text`: category-form
    - `View`, `fonts`, `size`: delete-category
    - `HomeButton`, `MonthSwitcher`: all three tabs
    - `HeaderDivider`: Expenses and the category page
    - `Icon`: the category page and Members
  - `const colors` goes from `InvalidLink` and `MembersScreen`.
  - **Kept because they're still used:**
    - `HomeButton` in Statistics
    - `Pressable` on the category page (its rows and menu)
    - `size` in actual-end, income-item and expense (their inputs)
    - `Text`, `View`, `fonts` and `text` wherever the body still draws them
- **The list is complete** (searched on Base):
  - `rg -n 'width: 52|flexBasis: 0|backText|<HomeButton|<MonthSwitcher|<HeaderDivider|name="back"' apps/mobile/src`
    finds 35 lines in 11 files: the 10 screens above and Statistics.
  - On the draft, the same search finds only `ScreenHeader.tsx` (8 lines) and Statistics' `<HomeButton />`.
- **Header rows left out, with the reason** (AC2's listed exceptions):
  - **Statistics**: Home beside a left-aligned `title` with role header (Open question 1).
  - **CategorySheet's head**: a sheet's title and Close (104d's IconButton), not a screen's.
  - **Home's and the demo Home's title block**: a column with no button (out of scope).
  - **Settings, login and no-ledger**: no header row of this kind.
  - **The other Backs**: `LoadFailed`'s Back and Members' ConfirmPanel Back/Close. They're 104c Buttons below an
    error or inside a panel, not header rows.
- **Demo:**
  - ScreenHeader first reaches the demo in slice 2, through the forms. Members, in slice 1, isn't in the demo.
  - Slice 2 runs `yarn mobile export:web && yarn mobile check-builds --accept`. The list's diff is one added line,
    `src/components/ScreenHeader.tsx`.
  - Nothing leaves the list: `HomeButton`, `MonthSwitcher` and `CollapsingSummary` are still reached through
    ScreenHeader.
  - No string in ScreenHeader trips the demo's banned text ("Statistics" or the sign-in path).
- Reuses:
  - `Button` (`mutedText`, `compact`), `HomeButton`, `MonthSwitcher`, `HeaderDivider`, `Icon`, `Pressable`
  - `useThemedStyles`/`useColors`, and the `space`, `size` and `text` tokens
  - 104d's snapshot script, with the changes in Visual check
  - I searched `src/components` for an existing header component, and there isn't one.
- New dependencies: none.

## Version

Bump: patch, 1.23.6 → 1.23.7
Why: §8b `patch`. It's a refactor of shipped app code that keeps behaviour: the same rows, Backs, labels and states.
The modal titles' header role (Open question 2) is an accessibility fix, which is also `patch`. There's no new
capability, and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator takes the **before** set (Visual check). The line counts come from the scratch draft:
each stage was checked on its own with `tsc` and ESLint.

- [ ] 0. Bump version to 1.23.7
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.7
- [ ] 1. Add ScreenHeader and draw Members' header with it (~141 lines)
  - Files: `src/components/ScreenHeader.tsx` (new), `src/app/members.tsx`
  - Change: ScreenHeader as in Contracts, whole, as Button and IconButton shipped. Members (P3) moves to `page`.
  - Verify: gates. Snapshots: `members`.
- [ ] 2. Draw the five form headers with ScreenHeader (~89 lines)
  - Files: `src/app/category-form.tsx`, `src/app/actual-end.tsx`, `src/app/income-item.tsx`,
    `src/app/delete-category.tsx`, `src/app/expense.tsx`, `apps/mobile/demo-modules.txt`
  - Change: M1–M5 and their clean-up.
  - Verify:
    - gates
    - `export:web` + `check-builds --accept`, with only the ScreenHeader line added
    - `rg -n "width: 52" apps/mobile/src` finds only `ScreenHeader.tsx`
    - Snapshots: `category-form-add`, `income-item-add`, `income-item-busy`, `expense-new`, `delete-category` and
      `actual-end`
- [ ] 3. Draw Budget's, Income's and Expenses' headers with ScreenHeader (~92 lines)
  - Files: `src/app/(tabs)/budget.tsx`, `src/app/(tabs)/income.tsx`, `src/app/(tabs)/expenses.tsx`
  - Change: T1–T3 and their clean-up.
  - Verify:
    - gates
    - `rg -n "flexBasis: 0" apps/mobile/src` finds only `ScreenHeader.tsx`
    - Snapshots: `budget`, `budget-ended`, `income`, `expenses` and `expenses-scrolled`
- [ ] 4. Draw the category page's headers with ScreenHeader (~87 lines)
  - Files: `src/app/category/[categoryId].tsx`
  - Change: P1 and P2 and their clean-up.
  - Verify:
    - gates
    - The AC2 search under "The list is complete" finds only `ScreenHeader.tsx` and Statistics' `<HomeButton />`.
    - Snapshots: `category`, `category-scrolled` and `category-bad-link`, then the demo check.

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped. In this worktree, export
`DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. There are no unit tests to
add, because no pure logic changes (§6: UI is checked in the browser).

**Scratch draft.** The planner drafted every edit in a scratch copy outside the repo. It holds:

- the edited `src`, an untouched copy of Base, and the four stages
- the whole diff and one diff per slice
- the snapshot and seed snippets for Visual check

The orchestrator has its location. The temp dir can be cleared, so Contracts is the source of truth.

## What moves (the PR lists this)

- **Expected in the layout rows: nothing.** Every view in both themes should be identical, apart from the one
  `zIndex` row below. Any other difference is a bug in the slice that caused it, and it gets fixed, not listed.
- **Expected and listed:**
  - **The modal titles gain `accessibilityRole="header"`** (Open question 2):
    - On web each title becomes `role="heading"` (an `<h1>`). react-native-web's text reset (`font`, `margin: 0`)
      keeps the box as it is.
    - The accessibility record gains exactly one entry, `heading|null|null|null|null|null`, on each of the 6 form
      views (`a11yAdded`), and loses none.
    - On iOS, VoiceOver says "heading" after the title.
  - **The category bad link's header loses `zIndex: 1`**: one row, `1` → `auto`, in `category-bad-link`. It has no
    divider and nothing scrolls under it, so nothing changes on screen. Members never had it.
- **Not caught by the snapshots, and listed:**
  - **The modal Back is now a `Button`:**
    - `height: 44` becomes `minHeight: 44`. That's the same with one line of text.
    - The column becomes a centred row, and the label gets `textAlign: 'center'` and `flexShrink: 1`. Neither moves
      a one-word label in a box as wide as its content.
    - 104c's `LoadFailed` Back made the same move, and its snapshots matched.
  - **The expense form's Back**: `disabled` was left out, and Button now passes `disabled={false}`.
    - On web that adds no attribute: `aria-disabled` is only written when it's `true`.
    - On iOS, RN's Pressable adds `disabled: false` to `accessibilityState`, which VoiceOver doesn't announce.
    - LoadFailed's Back has done the same since 104c.
  - **Members' header gains `justifyContent: 'space-between'` and `gap: 12`.** With one child, neither has any effect.
  - **Expenses' empty right side gains `justifyContent: 'flex-end'`.** It has no children, so nothing moves.

## Visual check (AC3–AC6; not counted in the line estimates)

**Set-up.**

- This worktree has `node_modules`, but no `.env` files. Copy the two git-ignored files in, or run `api` from the main
  checkout (this PR doesn't change the API). Check `git status` is clean before the before set.
- **Same day, in November.** The expense form shows today's date, so take both sets on the same Kyiv day.
  - From 1 December, November has ended, and Budget's and Income's "+" and the category page's "+" and ⋯ all
    disappear.
  - In either case, take both sets again on that day's data. The view names stay the same.
- **One QA user**, created by the orchestrator before the before set and deleted when the brief is done:
  `yarn api create-user --username claude-qa-104e --email …`. Its ledger gets the default November list.
- **Seed through the API as the user** (signed in from the page, credentials included), before the before set. The
  scratch snippet has it as one block.
  - `GET /api/ledgers` gives the ledger id. `GET /api/ledgers/<id>/categories?month=2026-11` gives `quickCategoryIds`.
    Note the first as **C** and the second as **D**.
  - Ten expenses in C with `POST /api/ledgers/<id>/expenses`, dated 2026-11-01 to 2026-11-10:
    `{ categoryId: C, expenseDate, name: 'qa', amount: '12.50', currency: 'EUR' }`. Ten days give the category page
    enough content to scroll 400pt.
  - One expense in D, dated 2026-11-03.
  - One income item with `POST /api/ledgers/<id>/months/2026-11/income`: `{ title: 'Salary', amount: '1000.00' }`.
    November then has a balance, so `actual-end` opens its form.
- TOTP codes come from a scratch script in the system temp dir, and the secret is never printed. Wait for a fresh 30 s
  window between sign-ins. Wrong codes count against the limit (5 in 24 hours), so don't guess.

**Snapshot script:** 104d's version, with these changes. The full snippet is in the scratch draft.

- **Each row adds `zIndex`**, so a header raised or not raised by `dividerStyle` shows up.
- **`cmp` also returns `a11yAdded` and `a11yRemoved`**: what's left of each record after taking away the other, entry
  by entry. That isolates the title role.
- A `__scrollSrc` helper sets the screen's scrolling list to `scrollTop = 400`. It returns the offset, which must be 400.
- Keys: `snap:before:104e:<view>:<scheme>` and `snap:after:104e:*`.
- Use 390×844, check `innerWidth === 390` in every result, and take Light, then Dark, for each view.

**Views, in this order, the same in both sets** (navigate, wait about 2 s, snapshot):

| View                | Where / how                                                                                                                                                         | Shows                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `members`           | `/members` (owner)                                                                                                                                                  | page: Back with "Back"; no trailing, no divider                      |
| `category-form-add` | `/category-form?month=2026-11`                                                                                                                                      | modal: "Add a category"                                              |
| `income-item-add`   | `/income-item?month=2026-11`                                                                                                                                        | modal: "Add income"                                                  |
| `income-item-busy`  | On `income-item-add`, type `qa` and `1`, hold every request with `window.fetch = () => new Promise(() => {})`, then press Save. Reload afterwards; nothing was sent | Back `aria-disabled="true"`, not dimmed; Save's spinner              |
| `expense-new`       | `/expense`                                                                                                                                                          | modal: "New expense", Back enabled                                   |
| `delete-category`   | `/delete-category?categoryId=C&month=2026-11`. Don't press Remove                                                                                                   | modal: "Remove category"                                             |
| `actual-end`        | `/actual-end?month=2026-11`. Don't save                                                                                                                             | modal: "Actual end"                                                  |
| `budget`            | `/budget?month=2026-11`                                                                                                                                             | month: Home, switcher, "+"; the Start → End line under it            |
| `budget-ended`      | `/budget?month=2026-10`                                                                                                                                             | month: an empty right side, the switcher still centred               |
| `income`            | `/income?month=2026-11`                                                                                                                                             | month: "+"                                                           |
| `expenses`          | `/expenses?month=2026-11`                                                                                                                                           | month: no action; the divider at opacity 0; the header at `zIndex` 1 |
| `expenses-scrolled` | On `expenses`, `eval(localStorage.__scrollSrc)()` (it must return 400), take a screenshot, then snapshot. Reload afterwards                                         | the divider at opacity 1                                             |
| `category`          | `/category/C?month=2026-11`                                                                                                                                         | page: Back with "November", "+", ⋯, compact total at opacity 0       |
| `category-scrolled` | On `category`, the same scroll, screenshot and snapshot. Reload afterwards                                                                                          | the divider and the compact total at opacity 1                       |
| `category-bad-link` | `/category/abc`                                                                                                                                                     | page: Back with "Back", then "That link isn’t valid."                |

- Before comparing `income-item-busy` in the after set, confirm that Back shows `aria-disabled="true"`. If it doesn't,
  reload and repeat.
- Before comparing a `*-scrolled` view, confirm the divider row shows opacity 1. If it shows 0, the page got no
  animation frames: take a screenshot and snapshot again.

**After set:** per slice as listed in Slices, the same views, data and port, compared with
`eval(localStorage.__cmpSrc)('<view>', '<scheme>')`. For all 15 views × 2 schemes, expected:

- `diffs: 0`, apart from `category-bad-link`'s one `zIndex` row
- `a11ySame: true`, apart from the 6 form views, where `a11yAdded` is exactly the one `heading` entry and
  `a11yRemoved` is empty

The screenshots go in the PR, not the repo.

**Checked from the code only** (listed as such in the PR):

- **The edit titles** ("Edit category", "Edit income", "Edit expense"). They're the same `title` prop with a different
  string.
- **The other forms' busy Back** (category form, actual End, delete category). It's the same `disabled={busy}` as
  `income-item-busy`.
- **The locked expense form and the forms' bad links.** They show the same one header.
- **Members as a member** (not the owner). The header is the same.
- **Budget and Income before their month loads.** The "+" is hidden, the same as `budget-ended`.

**Demo (AC6):**

- Run `web-demo` (port 8082), Light and Dark, with the console open.
- Check Budget, Income, Expenses scrolled, a category page scrolled, the expense form, the category form, the income
  item, delete category and the actual End form.
- There should be no errors.
- `yarn mobile check-builds` (no `--accept`) passes on the last commit.

**Gate B, iPhone (Expo Go):**

- A form's Back: tap it, and it closes.
- A month tab's header: the arrows change the month, and the "+" opens the form.
- The category page's Back: tap it, and it returns to Expenses. Scroll first, and the divider shows.
- Both themes. With VoiceOver on, a form's title reads as a heading.

## AC → evidence

| AC                                                                                     | Evidence                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 ScreenHeader exists, tokens and palette only, no new token, `variant`, no booleans | Slice 1. Its imports are those in Contracts. `git diff origin/main -- apps/mobile/src/theme.ts` is empty. The props are a union on `variant`, and `disabled` is the brief's own state prop (Open question 5) |
| AC2 the 10 headers render through it; no spacer, `side` styles or own Back elsewhere   | Slices 1–4 (M1–M5, T1–T3, P1–P3). Slice 4's search finds only `ScreenHeader.tsx` and Statistics' `<HomeButton />`. The exceptions and their reasons are listed in Contracts                                  |
| AC3 before and after snapshots of every view with these headers; nothing moves         | Visual check: 15 views × Light and Dark, covering the 5 forms, 3 tabs, the category page, its bad link and Members. Expected: 0 layout differences, apart from the listed `zIndex` row (What moves)          |
| AC4 Back's busy state as before; the category divider still appears                    | `income-item-busy` (Back `aria-disabled`, not dimmed), and `category-scrolled` and `expenses-scrolled` (divider at opacity 1), in both schemes. iPhone at Gate B                                             |
| AC5 roles, labels and `disabled` unchanged; any header role listed                     | `a11ySame: true` on the 9 non-form views. On the 6 form views, `a11yAdded` is exactly the title's `heading` entry, the one listed change (Open question 2)                                                   |
| AC6 demo, no console errors; `check-builds` passes                                     | Slice 2: `check-builds --accept` adds one line. After slice 4: the demo views in both themes with a clean console, and `check-builds` without `--accept` passes                                              |
| AC7 gates                                                                              | Every slice                                                                                                                                                                                                  |

## Not doing (YAGNI)

- **105's look**: a round icon Back, new title roles, shadows, and a single "back or home, title, one action" shape.
- **A Statistics variant** (Open question 1), and named "+" props on `month` (Open question 3).
- **Disabling the expense form's Back while it saves.** That's a behaviour change (Follow-ups).
- **Making the modal's `marginBottom` a `paddingBottom`** like the other two variants. The row's box would change by
  8pt, for no visible gain.
- **Moving `HeaderDivider` out of `CollapsingSummary`**, or giving Button an icon in its text looks.
- **The modal-form kit** in BACKLOG ("One modal-form kit"). It's a later refactor that builds on this part.
- **Docs.** The design spec's Components row describes 105's ScreenHeader, and nothing in it goes stale. The BACKLOG
  row is the orchestrator's, when the PR is planned and merged.

## Risks

- **The modal Back's box shifts** on the move to Button (`minHeight`, a centred row). That shouldn't happen: 104c's
  LoadFailed Back is the same Button with the same offsets, and it matched.
  - Slice 2's six form views compare its row.
  - If it moves, `modalBack` adds `height: size.iconButton` (1 line).
- **The `<h1>` title changes its box.** react-native-web's text style sets `font` and `margin: 0` over the browser's
  heading defaults. Statistics' and Members' titles are already `<h1>`s and look right.
  - Slice 2's rows compare the title's box.
  - If it moves, take the role out (Open question 2's fallback, about 2 lines).
- **The scroll doesn't reach the divider's range**, or the animation stalls while the Browser pane is hidden.
  - `__scrollSrc` must return 400. Ten days of expenses give the category page about 590pt of scroll, from a rough
    estimate of the content height.
  - The screenshot before each `*-scrolled` snapshot lets the frames run.
  - If 400 isn't reachable, use the largest offset both sets can reach, and the same one in both.
- **Budget's Start → End line gets covered.** ScreenHeader raises only rows given `dividerStyle`, and Budget passes
  none. The `budget` rows' `zIndex` stays `auto`, which the extended script checks.
- **The day changes, or November ends, between the sets.** Both are covered in Set-up.
- **Main moves.** Rebase, take main's version and bump once more (§8b). If the move changes a snapshotted view, take a
  fresh baseline (104 script, step 7).

## Open questions

1. **Blocking: yes (Gate A). Statistics: a fourth variant, or an exception (brief open question 1)?**
   - Recommended: keep it as it is, an exception.
   - Its header is one caller: Home, plus a left-aligned `text.title` with role header. Its period controls are a
     separate row with their own layout anchor.
   - Home is already the shared `HomeButton`, and the title's role comes from `text` in `theme.ts`, so 105 reaches
     both without touching Statistics' header.
   - A `title` variant would add about 25 lines (434 in all) for one caller.
   - The snapshots show no difference either way. As an exception, `statistics.tsx` isn't in the diff. As a variant, a
     `statistics` view joins both sets.
   - Assumed: exception.
2. **Blocking: yes (Gate A). The modal titles' header role: now, or with 104f/105 (brief open question 2)?**
   - Recommended: now. It's one attribute in one place, and it lets screen-reader users jump to the 5 forms' titles.
     Statistics, Members, no-ledger and delete-category's question already have the role.
   - The snapshots isolate it:
     - layout rows: 0 differences
     - on each of the 6 form views (12 records): exactly one added `heading` entry and nothing removed
   - Later would keep this part a pure refactor, with `a11ySame: true` everywhere, and 104f or 105 adds the same line.
   - Assumed: now (2 lines; dropping it is the fallback).
3. **Blocking: yes (Gate A). The `month` variant's action: a `trailing` slot, or named "+" props (brief open question
   3)?**
   - Recommended: `trailing?: ReactNode`, the same prop as `page`.
   - The "+" is already one `IconButton`, so 105 restyles it in one place either way.
   - Its condition (`data && !ended`) and label belong to the screen.
   - Named props would need an object (`add?: { label; onPress }`) to keep the label from appearing without the
     action, and would still have only 2 callers. Expenses passes neither.
   - The snapshots show no difference either way.
   - Assumed: `trailing`.
4. **Blocking: yes (Gate A). Size: 409 lines, against the brief's "split if more than 400".**
   - Recommended: one PR. It's 9 lines over, 196 of the 408 in `src` are deletions, and every slice is 141 or fewer.
     104b (408) and 104d (411) were approved the same way.
   - Splitting by variant, as the brief suggests, means growing ScreenHeader one variant at a time. I drafted that,
     and it comes to 466 lines (Approach), plus two before and after sets and two bumps.
   - If you'd rather split, keep the component whole in the first PR:
     - PR 1: slices 0–2 (ScreenHeader, Members and the forms, about 230 lines, 1.23.7)
     - PR 2: slices 3–4 (the tabs and the category page, about 179 lines, its own bump)
     - PR 1 would then ship the `month` variant before it has a caller.
   - Assumed: one PR.
5. **Blocking: no. `disabled` on `modal` against AC1's "no boolean props".**
   - The brief asks for `disabled` to be passed in. It's a state, as on Button and IconButton, not a look switch.
   - Assumed: AC1 means no look-choosing booleans, and `disabled` stays.
6. **Blocking: no. Corrections to the brief's tables:**
   - Expenses (a `month` screen) also has `HeaderDivider` and a raised header, not only the category page.
   - The modal row's 8pt below is a margin, and the other two have padding. Each keeps its own.
   - The expense form's Back isn't disabled while it saves today, so `disabled` covers 4 of the 5 forms.
   - The expense form has one header row for all its states.
   - That's 11 header rows for the brief's 10 headers, counting the category page's bad link.
   - Assumed: as written in Contracts.

## Follow-ups

- **The expense form's Back stays enabled while a save is in flight** (`busy` lives in `ExpenseForm`, below the
  header).
  - Found by reading, not reproduced: pressing Back during an edit's save leaves the screen, and when the save ends
    its `leave()` may go back a second time.
  - Worth a small fix brief: pass `disabled` up, as the other forms do.
- **For brief 105:** the 52pt spacer (a centred title can use equal sides, as `month` does), the modal's margin
  against the others' padding, and `HeaderDivider`'s −20 side bleed, which matches the screens' padding by hand.

## Deviations

## Consolidate

## Revision 1

After the skeptic's APPROVE, with its three optional clarifications taken (no change to what ships or to the line
estimates):

1. Contracts › Imports names each module's own file, since there's no `@/components` barrel.
2. `page`'s `trailing` is tested with `trailing !== undefined`. P1 always passes a fragment and keeps today's
   `trailing` View, even when it's empty. Members and P2 pass nothing and draw no View.
3. `month`'s `title` gets a JSDoc line: it's MonthSwitcher's caption, not a title the header draws.

## Gate A (2026-11-25)

Approved by the user as recommended: one PR (about 409 lines); Statistics stays an exception; the 5 form titles gain
`accessibilityRole="header"` now (listed in the PR); the `month` variant takes its action through a `trailing` slot.

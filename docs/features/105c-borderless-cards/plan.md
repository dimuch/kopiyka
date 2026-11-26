# Plan: The fresh look, part 3: borderless cards and one card per row

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Gate A: skeptic APPROVE WITH EDITS (applied); approved 2026-11-27 under the user's standing OK, open questions as recommended.
Brief: ./brief.md
Branch: feat/borderless-cards
Base: origin/main (dc1e234, version 1.23.13, after #174)

## Approach

Almost all of this is `theme.ts`, `Card` and the six list screens. The order is: tokens first, with their first
callers; then the cards; then the lists, one commit for the two that share ReorderList and one for the rest; and last,
`border` and `CardPadding`'s `list`, once nothing uses them.

- **Tokens.**
  - `hairline` joins both palettes. Each theme's value is its own `text` at 6%. Light is the doc's
    `rgba(17,16,20,0.06)`, and dark is `rgba(237,236,242,0.06)` (Inventory, contrast).
  - `shadow` is a new export, by scheme, like `categoryTile(…, scheme)`. Light has the doc's `card` and `float`
    strings, and dark has none.
  - `shadow.float` has no caller until 105d (UndoToast) and 106 (the tab bar). AC2 asks for it now.
- **Card.** `useCardStyle` draws `surface`, `radius.lg` and `boxShadow: shadow[scheme].card`, with no border.
  `padded` becomes `md` (12), as the doc and brief say. The row cards pad themselves at `md` across too, so a row's
  content lines up with the figure card above it (Open question 3).
- **One card per row.** Each list's wrapper card becomes a plain `View` 8pt apart (`gap: space.sm`), or goes when its
  parent already spaces at 8. Each row takes the card look, and the dividers go:
  - a `View` row becomes `<Card padding="none">`;
  - a `Pressable` row takes `useCardStyle('none')`, called once at the screen's top.
- **ReorderList.** The 8pt sits inside each measured `Row` as `paddingBottom: space.sm`. A row's measured height then
  includes its gap. `dropIndex` sums heights and `rowOffset` moves rows aside by the held row's height, so both stay
  right and unchanged. Three things leave ReorderList:
  - the held row's `surface` background and `radius.md`, since each row is now an opaque card of its own and that
    background would paint the gap;
  - the `style` prop, since neither caller passes the list card any more;
  - `renderRow`'s `index`, which neither caller reads once the dividers go.
- **Edges that stay** (HeaderDivider, TabBar, the tab layout's bar, DemoStrip) take `hairline`.

Alternative considered: keeping the gap out of the rows (a `gap` on the list) and adding it to the maths, as
`dropIndex(heights, from, dy, gap)` and `rowOffset(…, height + gap)`. That's two new parameters, changed tests and a
`gap` the list and the maths must agree on, for the same result. Shadows as palette keys (`colors.shadowCard`) would
flow through `makeStyles`, but they'd become `keyof Palette`, and so a valid `Text` colour. Dark would also need a
string that means "none". The bolt-on check doesn't apply: no flag or branch is added, and ReorderList's slots are
shaped as if gaps had always been there.

## Inventory (measured on Base)

**Card sites: 19** `<Card>` or `useCardStyle` calls (`rg -n "<Card\b|useCardStyle\(" apps/mobile/src`; the
backlog's 104 row says 17).

| Site                                                                                                                         | Padding  | This part                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| HomeCards, Settings' account, PendingInvites (one per invite), Budget's IncomeFigures, Expenses' summary, category page hero | `padded` | no border, shadow, padding 16 → 12                                                             |
| Settings' Members card (`useCardStyle('none')`, `paddingLeft: lg`, `paddingRight: md`)                                       | `none`   | no border, shadow; `paddingLeft` → `md` (Open question 3)                                      |
| EmptyMonth (its own 20/16 padding)                                                                                           | `none`   | no border, shadow; its comment "more than a padded card's 16" → 12                             |
| LedgerPicker, AppearancePicker (radio groups)                                                                                | `group`  | no border, shadow; **stay one card** (Open question 2)                                         |
| Budget's categories, Expenses' categories (ReorderList `style`)                                                              | `list`   | → one card per row                                                                             |
| Income's items                                                                                                               | `list`   | → one card per row                                                                             |
| Statistics: totals (Income, Planned, Spent, Left)                                                                            | `list`   | **stays one card**, with no dividers: `none` plus `paddingVertical: xs` (Open question 2)      |
| Statistics: By category, By month                                                                                            | `list`   | → one card per row (By month: Open question 2)                                                 |
| Category page: one card per day                                                                                              | `none`   | → one card per expense, in the day's own `gap: sm` column                                      |
| Members: members, Invited                                                                                                    | `none`   | → one card per row (members in a new `gap: sm` wrapper; Invited's section already spaces at 8) |

**`colors.border`: 11 callers.**

- Card's edge.
- Six divider styles: `budget.tsx:351`, `expenses.tsx:223`, `income.tsx:213`, `statistics.tsx:336` (shared by its 3
  lists), `category/[categoryId].tsx:283` and `members.tsx:519` (shared by its 2 lists). Between them they are used
  at 9 sites.
- HeaderDivider (`CollapsingSummary.tsx:94`), TabBar (`TabBar.tsx:68`), the tab layout's bar (`(tabs)/_layout.tsx:21`)
  and DemoStrip (`DemoStrip.tsx:37`).

No string form (`color="border"`) exists. `borderStrong` has 17 callers and stays for 105d.

**ReorderList's maths** (`data/reorder.ts`):

- `dropIndex` puts row tops at the cumulative sum of the measured heights, then compares middles.
- `rowOffset` moves the passed rows by `held.height`.
- The heights come from each `Row`'s `onLayout`.

A flex `gap` on the list would sit outside every measured height: tops would come out 8pt short per row, and rows
would move aside 8pt too little. Padding inside the `Row` keeps every slot "card + 8", so both functions stay right
as they are. It has two callers, Budget and Expenses. The brief names only Budget's, but both are checked.

**Hairline contrast** (WCAG ratio of the line drawn over its surface, computed):

| Value                         | on `bg` | on `surface` | on `accentTint` (DemoStrip) |
| ----------------------------- | ------- | ------------ | --------------------------- |
| light `rgba(17,16,20,0.06)`   | 1.13    | 1.13         | 1.13                        |
| dark `rgba(237,236,242,0.06)` | 1.12    | 1.16         | 1.16                        |
| for reference: light `border` | 1.17    | —            | —                           |
| for reference: dark `border`  | 1.29    | —            | —                           |

Dark's `surface` on `bg` is 1.09, so its hairline reads like light's, a step fainter than today's edges.

## Contracts

- DB: none
- API: none
- App:
  - `theme.ts`:
    - Both palettes gain `hairline: string` (light `'rgba(17,16,20,0.06)'`, dark `'rgba(237,236,242,0.06)'`).
    - Both palettes lose `border` (slice 5). `Palette` is still `typeof darkColors`.
    - New: `export const shadow: Record<Scheme, { card: string | undefined; float: string | undefined }>`, where
      `light` is `{ card: '0 2px 8px rgba(17,16,20,0.06)', float: '0 4px 24px rgba(17,16,20,0.12)' }` and `dark` is
      `{ card: undefined, float: undefined }`. The header comment then names only `borderStrong` (105d).
  - `Card.tsx`:
    - `CardPadding` becomes `'padded' | 'group' | 'none'` (slice 5). `padded` is `{ padding: space.md }`.
    - The card style is `{ backgroundColor: surface, borderRadius: radius.lg }` plus `{ boxShadow: shadow[scheme].card }`,
      with the scheme from `useAppearance()`.
    - `useCardStyle(padding)` and `Card` keep their signatures. Their comments say "no border, `shadow.card`".
  - `ReorderList.tsx`:
    - `Props` loses `style`, and `renderRow` becomes `(item: T, drag: DragHandlers) => ReactNode`.
    - `RowProps` loses `heldStyle`.
    - Every `Row` gets `paddingBottom: space.sm`, inside its measured box. The held row keeps `zIndex: 1`, its
      `translateY` and its `scale`.
  - Six divider styles go; a `list: { gap: space.sm }` style arrives where a wrapper is needed (Income, Statistics,
    Members).
- Reuses:
  - `Card` and `useCardStyle` for every row card;
  - `useAppearance().scheme`, as CategoryTile does;
  - `dropIndex`, `rowOffset` and `edgeStep` as they are;
  - 104h's `__snapSrc`, extended by three columns (Visual check).
- New dependencies: none. `boxShadow` is core React Native 0.88 (New Architecture, which SDK 58 runs). Its type is
  `ReadonlyArray<BoxShadowValue> | string`, and react-native-web 0.21.4 passes a string through unchanged
  (`preprocess.js`).

## Version

Bump: patch, 1.23.13 → 1.23.14
Why: §8b `patch` ("styling"). Cards lose their edges and gain a shadow, lists split into cards, and one colour token
is added and one removed. Nothing new to do, nothing that works today stops working, and no API, data or connector
change. The demo store is untouched.

## Slices

- [x] 0. Bump version to 1.23.14
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.14
- [x] 1. Record the dark hairline in the design system and mark 105b done in the backlog (≈ 14 lines, docs)
  - Files: `docs/design/design-system.md`, `docs/features/BACKLOG.md`
  - Change:
    - The doc's dark first pass gains `hairline rgba(237,236,242,0.06)`: dark `text` at 6%, as light's is light
      `text` at 6%. Add the ratios from the Inventory.
    - Backlog:
      - the Snapshot line moves to v1.23.13 (`dc1e234`, after #174);
      - "In progress" becomes 105c on `feat/borderless-cards`, v1.23.14, then 105d and 106;
      - Recently finished gains "105b · Inter and the type mapping (done: #174, v1.23.13)" with a one-line summary;
      - the roll-out table's 105b row says done (#174), and the 105c row points at `docs/features/105c-borderless-cards/`
        and says it's in progress.
  - Verify: `yarn format:check`.
- [x] 2. Draw the header, tab bar and demo strip edges in the hairline colour (≈ 22 lines)
  - Files: `apps/mobile/src/theme.ts`, `apps/mobile/src/components/CollapsingSummary.tsx`, `TabBar.tsx`,
    `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/demo/DemoStrip.tsx`, `apps/mobile/test/theme.test.ts`
  - Change: add `hairline` to both palettes, with a one-line comment ("the rare edge, where two same-colour surfaces
    meet: each theme's `text` at 6%"). The 4 edges go from `colors.border` to `colors.hairline`.
  - Tests: `theme.test.ts`, new "draws the hairline in each theme's text colour at 6%". An `it.each` over both
    palettes parses `colors.text`'s `#RRGGBB` and expects `colors.hairline` to be `rgba(r,g,b,0.06)`. Light then
    equals the doc's value.
  - Verify: `rg -n "colors\.border\b" apps/mobile/src` lists only Card and the 6 divider styles.
- [ ] 3. Draw cards without a border, with the card shadow in light (≈ 32 lines)
  - Files: `apps/mobile/src/theme.ts`, `apps/mobile/src/components/Card.tsx`, `EmptyMonth.tsx`,
    `apps/mobile/src/app/(tabs)/settings.tsx`, `apps/mobile/test/theme.test.ts`
  - Change:
    - `shadow` as in Contracts, with a comment: "the design system's Elevation; dark has none, since its `surface` is
      lighter than `bg`".
    - Card loses `borderColor` and `borderWidth`, adds the shadow, and `padded` becomes `space.md`. Its two comments
      are updated (the `padded` and `list` lines, and "A `surface` box with a 1pt `border`").
    - Settings' Members card: `paddingLeft: space.lg` and `paddingRight: space.md` become `paddingHorizontal: space.md`.
    - EmptyMonth's comment changes 16 to 12.
  - Tests: `theme.test.ts`, "takes the design system's shadows in light, and none in dark":
    `expect(shadow).toEqual({ light: { card: '0 2px 8px rgba(17,16,20,0.06)', float: '0 4px 24px rgba(17,16,20,0.12)' }, dark: { card: undefined, float: undefined } })`.
  - Verify: Visual check B on `home`, `settings`, `budget` (light and dark) after this slice: every card has no
    border and the shadow (light) or none (dark).
- [ ] 4. Give each category its own card on Budget and Expenses, and keep the drag landing under the finger (≈ 45 lines)
  - Files: `apps/mobile/src/components/ReorderList.tsx`, `apps/mobile/src/app/(tabs)/budget.tsx`,
    `apps/mobile/src/app/(tabs)/expenses.tsx`
  - Change:
    - ReorderList, as in Contracts. It drops `useColors`, `radius`, `StyleProp` and `ViewStyle`, and adds
      `slot: { paddingBottom: space.sm }`, applied to every `Row`, held or not. The comment above it says why: the
      8pt gap sits inside the measured row, so `dropIndex` and `rowOffset` still add up plain heights (brief 105c).
    - Budget:
      - `listCard = useCardStyle('list')` becomes `rowCard = useCardStyle('none')`, and `style={listCard}` and `last`
        go;
      - ended rows are `[rowCard, styles.row]`, and open rows are `[rowCard, styles.openRow]`;
      - `divider` goes, and `row.paddingHorizontal` becomes `space.md`.
    - Expenses: the same. The open row is `[rowCard, styles.openRow, !ended && styles.withAdd]`.
      `listCard` goes, `index < rows.length - 1 && styles.divider` goes, and `cardStyle = useCardStyle('padded')`
      stays. Budget's `Card` import stays (IncomeFigures uses it).
  - Verify:
    - Web at 390×844, on `after` data, as the QA owner (the order is per user, so put it back afterwards):
      1. Measure the slot S (card height + 8) from a snapshot.
      2. On Budget, long-press U and move it down by S + 4. Mid-drag, screenshot: N has moved up by exactly S, and
         the cards are still 8pt apart with no overlap. Release: U lands second, where the finger left it.
      3. Long-press U and move it by S − 4: it stays.
      4. Drag it back to first.
      5. Repeat steps 2 and 4 once on Expenses.
    - If the browser tool can't hold a press, that's recorded in Deviations, and Gate B's iPhone drag is the evidence.
- [ ] 5. Give each item its own card on Income, Statistics, the category page and Members (≈ 70 lines)
  - Files: `apps/mobile/src/app/(tabs)/income.tsx`, `statistics.tsx`, `apps/mobile/src/app/category/[categoryId].tsx`,
    `apps/mobile/src/app/members.tsx`, `apps/mobile/src/theme.ts`, `apps/mobile/src/components/Card.tsx`
  - Change:
    - Income: `<Card padding="list">` becomes `<View style={styles.list}>`. Rows are `[rowCard, styles.row]`
      (`useCardStyle('none')`; the `Card` import goes).
    - Statistics:
      - totals: `<Card padding="none" style={styles.totals}>`, with `totals: { paddingVertical: space.xs }` and no
        dividers;
      - By category and By month: `<View style={styles.list}>` around rows that are each
        `<Card padding="none" accessible … style={styles.row}>`, with the same props as today's `View`.
    - Category page: the per-day `<Card padding="none">` goes. The items sit in the day's `gap: sm` column as
      `[rowCard, styles.item]`.
    - Members:
      - the members list becomes `<View style={styles.list}>` around a `<Card padding="none" style={styles.row}>` per
        member;
      - the Invited `<Card>` wrapper goes, leaving a `<Card padding="none" style={styles.row}>` per invite in its
        section.
    - In all four screens, `divider` goes and the row's `paddingHorizontal` becomes `space.md` (category: `item`).
    - `border` leaves both palettes. The `theme.ts` header comment names only `borderStrong` and 105d.
    - `list` leaves `CardPadding`, with its style and comment line.
  - Verify:
    - typecheck finds no `colors.border` and no `padding="list"`;
    - `rg -n "colors\.border\b|^\s*border:|padding=\"list\"|\| 'list'|useCardStyle\('list'\)" apps/mobile/src` finds nothing;
    - `rg -n "divider:" apps/mobile/src` finds only HeaderDivider's style in `CollapsingSummary.tsx`;
    - Visual check B, C and D on every view.

## What moves (the PR lists this)

All of it is by design. Text, type and the accessibility record don't change.

- **Every card's 1pt edge goes.** Its content moves 1pt in, and a content-sized card is 2pt shorter.
- **Padded cards** (Home, Settings' account, invites, Budget's figures, Expenses' summary, the category hero): their
  padding goes from 16 to 12.
  - Content moves 5pt in: left-aligned text moves 5 left, right-aligned text 5 right, and centred text stays put.
  - The card is 10pt shorter, so everything under it moves up 10.
- **Card-per-row lists** (Budget, Expenses, Income, Statistics' By category and By month, the category page, Members):
  - A `list` card's 1pt edges and 4pt top and bottom padding go. A `none` card's edges go.
  - Row content moves 5pt in at each side (the edge plus 16 → 12).
  - Rows are 8pt apart instead of a 1pt divider, so each row's content sits 7pt lower than the row above's did.
    Within a row, every leaf moves by the same amount.
  - Worked example, Budget with three rows: the figure card is −10 and the "Categories" head −10. The row contents
    move −15, −8 and −1 (−10 above, −5 at the list's start, then +7 per row). The edit button moves +1 (edge only).
  - On the category page and Members (`none` cards), the first row moves −1 plus whatever moved above it, then +7 per
    row.
- **Statistics' totals:** the edges and the 3 dividers go. The rows move −1, −2, −3 and −4, their content moves 5pt
  in at each side (`styles.row`'s padding becomes `md`), and the card is 5pt shorter.
- **Settings' Members card:** its label moves 5 left and its chevron 1 right.
- **The pickers' cards** (LedgerPicker, AppearancePicker): options move 1pt in, and the cards are 2pt shorter.
- **Budget and Expenses:** the scroll content is 8pt taller under the last row (the last slot's gap).
- **Pressing** an Income row, a category page expense or an ended Budget row now dims the whole card, shadow included,
  as Home's cards already do. Before, only the row's content dimmed inside the list card.
- **Edges:** HeaderDivider, the tab bars and DemoStrip change colour only. No box moves.
- **A row name with 8pt more width** may wrap onto fewer lines. Any height change is listed.

## Visual check (AC6, AC7; not counted in the line estimates)

**Set-up**, as in 105b's plan and its Deviations:

- **Servers:** the API on 3000, the web app on :8084 opened at `http://127.0.0.1:8084`, and `web-demo` on 8082, with
  the two git-ignored `.env` files copied in. Run `yarn install` in each worktree first. In a worktree,
  `DATABASE_URL_TEST` comes from the main checkout's `apps/api/.env`.
- **Two sets, on one Kyiv day:**
  - `before`: a detached copy of Base (dc1e234) on :8084;
  - `after`: the branch at slice 5.
  - Stop one server before starting the next. If the day is after 30 November, seed `2026-12` instead, with the same
    days in December.
- **Clear old keys:** first, clear every older `snap:*` key from localStorage on 127.0.0.1:8084.
- **QA users**, created before `before` and deleted when the brief is done (members first):
  - `claude-qa-105c`, the owner;
  - `claude-qa-105c-m`, made with `--join claude-qa-105c`;
  - `claude-qa-105c-n`, made with `--join claude-qa-105c`, then removed by the owner for the no-ledger views.
- **Seeding**, once, as the owner, through the API, after checking that the month is empty. It follows 105b's steps,
  with two changes so that every list shows at least one gap:
  - income `Salary` €1000 **and `Bonus` €50**;
  - U, N and O planned at €100 each, with expenses of **€6 and €4 (U)**, €95 (N) and €109 (O), all on the 3rd;
  - an actual End of €900;
  - the invite to `-n`, made just before the no-ledger views.
- **API calls:** login sends a `deviceId` of 8–64 characters, and a DELETE with no body sends no JSON content type.
  TOTP codes come from a scratch script outside the repo, are never printed, and each sign-in waits for a fresh
  window.

**Views:** 105b's 27, plus `statistics-last3` (owner; Statistics with "Last 3 months", so By month shows), each in
Light and Dark:

- `home`, `budget`, `budget-ended`, `income`, `expenses`, `expenses-scrolled`, `statistics`, `statistics-menu`,
  `statistics-last3`
- `category` (U), `category-menu`, `category-undo`
- `settings`, `members-owner`, `members-confirm`
- `actual-end`, `actual-end-error`, `delete-category`, `expense-new`, `expense-sheet`, `expense-added`,
  `income-item-edit`, `category-form-add`
- signed out: `login`, `login-error`; no ledger: `no-ledger-invite`, `no-ledger`; member: `members-member`

**Taking them:** as in 105b's run.

- Each page loads in a same-origin 390×844 iframe, the same for both sets.
- Each snapshot is taken in the frame, saved as JSON outside the repo (system temp dir), and its key deleted.
- A screenshot of each view in each scheme, in both sets, goes in the PR.

**Snapshot:** 104h's `__snapSrc`, with three fields appended after the text (column 20):

- 21: `s.boxShadow`;
- 22: the four border widths (`s.borderTopWidth`, `s.borderRightWidth`, `s.borderBottomWidth`, `s.borderLeftWidth`),
  space-separated;
- 23: the four border colours, in the same order.

Both sets use the same script. Columns 0–20 are 104h's: 0 tag, 1–4 box, 5–12 background to stroke, 13–19 type, 20 text.

**Comparison** (Node, over the saved files; the colour and shadow columns aren't diffed, as the brief says):

- **A. Same content.** On every view and scheme:
  - the width is 390;
  - the `a11y` arrays are equal;
  - the text leaves (rows with a column 20), as (tag, text) in order, are equal;
  - each text leaf's type columns (13–19) are equal.
  - Element counts may drop only by the removed wrappers: 1 per day on the category views, and 1 on the Members views
    that show Invited. Elsewhere they stay the same.
- **B. Cards** (`after`): every element with radius `20px` and a `surface` background (light `rgb(255, 255, 255)`,
  dark `rgb(24, 23, 29)`) has borders `0px 0px 0px 0px`, and a shadow of `rgba(17, 16, 20, 0.06) 0px 2px 8px 0px` in
  light or `none` in dark. The count per view is reported. UndoToast (radius 20, `borderStrong` edge, 105d's) is
  excluded and listed as such.
- **C. Edges** (`after`):
  - no element has a non-zero border side in the old `border` colour (light `rgb(227, 230, 235)`, dark
    `rgb(35, 39, 46)`); in `before`, the list views do;
  - `hairline` (light `rgba(17, 16, 20, 0.06)`, dark `rgba(237, 236, 242, 0.06)`) appears as a background or border
    colour only on the tab bar's top edge (tab views and TabBar's on the category and expense views) and on
    HeaderDivider;
  - in the demo (not snapshotted), one computed-style query on the strip shows its bottom edge in `hairline`, in both
    themes.
- **D. Planned gaps.**
  - In each card-per-row list on `after`, consecutive row cards are 8pt apart (±0.5), with the same x and width.
  - In `before → after`, every leaf in a row moves by the same dy. Each row's dy is 7 (±0.5) more than the previous
    row's, and dx is −5, +5 or 0 by alignment.
- **E. Everything else.** Every other leaf that moves more than 2pt is listed, by view and cause, against What moves.
  A move with no cause there is a finding, fixed before the PR.

**Shadow clipping (Risk 1):** zoom the `after` light screenshots of `budget` and `home` to 3× at a card's side and
bottom corner, and record what shows.

**Remaining (the brief's look-again):** put the `after` light screenshots of `budget` and `expenses` side by side.
Budget's Remaining is income − planned, and Expenses' is planned − spent. Both now sit in the same white card above
row cards. The PR says in two or three sentences whether that makes the two meanings easier to confuse, and suggests
a follow-up brief if so. No code changes here (brief 107 accepted the meaning).

**Checked from the code only** (listed so in the PR):

- LedgerPicker, which needs two ledgers;
- the tab badges and PendingInvites on Home and Settings, which need an invite to a user who has a ledger;
- the category page's "No expenses" line.

**Demo:** run `web-demo` in Light and Dark with the console open, and check Home, Budget, Income, Expenses, a
category page, the expense form with its sheet, and an income item: no errors. Then `yarn mobile export:web` and
`yarn mobile check-builds`, which should need no `--accept`, since no module newly reaches the demo.

**Gate B, iPhone (Expo Go):**

- the cards show the shadow in light and none in dark;
- the hairlines are visible;
- dragging on Budget and Expenses drops each row where it's released, including with edge-scrolling on a long list
  (the user's own ledger);
- scrolling and dragging ~15 shadowed cards stays smooth (Risk 3).

## AC → evidence

| AC                                                                                                        | Evidence                                                                                            |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AC1 no card border; `shadow.card` in light, none in dark                                                  | Visual check B on every view; `theme.test.ts` shadow test; slice 3's Card diff                      |
| AC2 `hairline` and `shadow.card`/`shadow.float` per scheme; dark hairline in doc; `border` gone           | `theme.test.ts` (hairline, shadow); slice 1's doc line; slice 5's `rg` and typecheck                |
| AC3 one card per row, 8pt apart, no divider in a card; lists left named                                   | Visual check D; slice 5's `divider:` search; Inventory and Open question 2 name what stays one card |
| AC4 reorder drops where released, web and iPhone                                                          | slice 4's web drag (S ± 4, mid-drag screenshot, both lists); Gate B iPhone                          |
| AC5 HeaderDivider, TabBar, the tab layout's bar and DemoStrip use `hairline`                              | slice 2's `rg`; Visual check C (snapshots, plus the demo query)                                     |
| AC6 before/after screenshots at 390×844, light and dark; only planned moves; a11y same; >2pt moves listed | Visual check: 28 views × 2 schemes × 2 sets; comparisons A–E; the PR's list by cause                |
| AC7 demo with no console errors; `check-builds`                                                           | Visual check, Demo                                                                                  |
| AC8 gates                                                                                                 | every slice                                                                                         |
| What: Remaining looked at; backlog                                                                        | Visual check, Remaining (the PR's note); slice 1                                                    |

## Not doing (YAGNI)

- A caller for `shadow.float`: UndoToast is 105d's, and the tab bar and "+" are 106's.
- A lifted (`float`) shadow on the held row while dragging: not asked for. The held card keeps `shadow.card` and its
  1.03 scale.
- The LedgerPicker and AppearancePicker options' own padding (4 + 16), the screen gutter, and the Members confirm
  panel's `borderStrong` inside a member's card: these are 105d's controls or Follow-ups.
- Removing the 8pt left under the last ReorderList row (a negative margin): it costs a line and a comment, and only
  adds scroll room.
- An `android` check: the app ships to iOS and web.

## Risks

1. **The scroll views clip the shadow at the sides.** The cards fill their ScrollView's width (the gutter is on the
   SafeAreaView), and both web (`overflow`) and iOS (`clipsToBounds`) clip there. The blur reaches about 8pt sideways
   at 6% black, so it may not show at all.
   - Checked: Visual check's 3× zoom, and Gate B.
   - Fallback if it shows: move each screen's gutter into its scroll content (`marginHorizontal: -space.xl` on the
     ScrollView, `paddingHorizontal: space.xl` on its content). That's about 2 lines per screen on 7 screens, done as
     a new commit and recorded in Deviations. Open question 4.
2. **A drag lands off by the gap** if a measured height misses the 8pt. Slice 4's S ± 4 drags prove it on web, and
   Gate B on the iPhone.
3. **boxShadow costs frames on iOS** with ~15 cards during scroll and drag. Gate B checks it on the user's ledger. If
   it's janky, that's a finding brought to the user before the PR, not a silent switch to the legacy `shadow*` props.
4. **Web focus:** FocusStyles' `:focus-visible` band is a `box-shadow`. On a card Pressable, the card's inline shadow
   may win over it while focused; the 2px accent outline still shows. Checked with Tab on Home in the after set, and
   the PR says the band is gone on cards and the 2px outline is what shows.
5. **A missed `border` or divider caller.** Removing the key makes typecheck find every `colors.border`, and slice 5's
   `rg` covers the rest.
6. **The day.** Both sets on one Kyiv day (Set-up).
7. **Main moves:** if another PR takes 1.23.14, rebase, take main's number and bump once more (§8b).

## Open questions

1. **Blocking: yes (Gate A; slices 1–2). The dark `hairline` (brief open question 1).**
   - Recommended: `rgba(237,236,242,0.06)`, dark `text` at the same 6% as light's. It is 1.12:1 on dark `bg` and
     1.16:1 on `surface`, against light's 1.13:1 on both: the same faint step. Today's dark `border` is 1.29:1.
   - Assumed: as recommended.
2. **Blocking: yes (Gate A; AC3). Which lists stay one card (brief open question 2).**
   - Recommended, staying one card:
     - **Statistics' totals:** one summary of the period, four figures read together, like Budget's and Expenses'
       figure cards. Its dividers go and its rows keep their spacing.
     - **LedgerPicker and AppearancePicker:** each is one radio group (`accessibilityRole="radiogroup"`), with no
       dividers. Splitting them would break the group, and 105d redraws their options.
     - **Settings** is already one card per item (account, invites, Members), so nothing there changes.
   - Recommended: **By month becomes one card per row** too. It has the same shape as By category just above it, and
     leaving it as one card would draw two looks for two row lists on one screen.
   - Assumed: as recommended.
3. **Blocking: no. Row cards pad at `md` across** (16 → 12), as `padded` does (the brief's "padding `md`"). A row's
   content then lines up with the figure card above it. Settings' Members card follows. The alternative is to keep the
   rows at 16, which leaves them 4pt out of line with the figure cards. That's one line per screen. Assumed: `md`.
4. **Blocking: no. Shadow clipping at the sides** (Risk 1). Assumed: check first, and apply the fallback only if it
   shows.
5. **Blocking: no. The seed adds an income item, and U's €10 is entered as €6 and €4,** so Income and the category
   page show a gap. A `statistics-last3` view shows By month. Assumed: yes. These are new QA users either way.
6. **Blocking: no. "Any row that moves more than 2pt"** (AC6) means a leaf whose box moves or resizes by more than
   2pt. Nearly every leaf under a card moves by design, so the PR lists them by view and cause (What moves), with
   counts, rather than one by one. Assumed: as read.
7. **Blocking: no. Corrections to the brief:**
   - ReorderList also drives Expenses' drag, so both lists are checked;
   - there are 19 card sites, where the backlog's 104 row says 17;
   - `colors.border` has 11 callers, as 105 counted.

## Follow-ups

- The tab screens' gutter is `space.xl` (20, 12 sites), while the doc says `lg` (16). Not briefed.
- Members' confirm panel is a `surface` box with a `borderStrong` edge, inside a member's `surface` card. That's two
  same-colour surfaces touching, so 105d should give it a `hairline` (or `fill`) rather than drop the edge.
- LedgerPicker's options sit 20pt in (the card's 4 plus the option's 16), against the cards' 12. That's 105d's
  options.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

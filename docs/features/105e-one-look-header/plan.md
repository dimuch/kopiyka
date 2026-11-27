# Plan: The fresh look, part 5: the header, the toast, inputs, menus and sheets

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Gate A: skeptic APPROVE WITH EDITS (applied); approved 2026-11-27 under the user's standing OK, open questions as recommended.
Gate A: pre-approved under the user's standing OK (the user is away); open questions take the recommended answers.
Brief: ./brief.md
Branch: feat/one-look-header
Base: origin/main (210d798, version 1.23.15, after #176)

## Approach

**No split.** I made every edit in a scratch copy of `apps/mobile`, outside the repo, and ran Prettier, `tsc`, ESLint
and `theme.test.ts` on it (all clean). The diff, counted as added plus removed lines as 105d's was, is **≈ 351 lines of
code and tests**. With the two docs it comes to **≈ 389**, under 400, so this is one PR, as the brief expects.

- **ScreenHeader** gets one props type and one row: `[leading side][title][trailing side]`.
  - Each side is at least 44pt wide and the title takes the rest. Every caller has one 44pt button or none on the
    leading side, and the same on the trailing side, except the category page, which has no title. So the title sits
    on the screen's centre.
  - The row spans the screen with the gutter inside (`marginHorizontal: -space.xl`, `paddingHorizontal: space.xl`), as
    105c's scroll views do, so HeaderDivider draws at `left: 0, right: 0`.
  - Back is a round IconButton whose `label` is its accessible name. With no `back`, the leading button is Home.
  - A string `title` is drawn as the `title` header. The month tabs pass their own `<MonthSwitcher …/>`.
- **The float shadow.** Dark `shadow.float` becomes `0 0 0 1px ${darkColors.hairline}`. The toast and the three menus
  lose their `borderStrong` edge and take `boxShadow: shadow[scheme].float`, as Card takes `shadow[scheme].card`.
- **The toast.** `size.toast` (56) joins the tokens, and UndoToast exports
  `toastRoom = space.xxxl + size.toast + space.lg` (104). Budget and the category page read it, and their two
  `eslint-disable`s go. `toastRoom` is token arithmetic, not a raw number hidden behind a name, so conventions §5's
  "don't route style numbers through named constants" doesn't apply.
- **Inputs.** The 8 input looks take `backgroundColor: fill` and keep their 1pt border, now in `fill` too. TextField
  still turns it `accent` on focus, and nothing moves. Login's fields go from 52 to `size.control` (48).
- **Sheets, panel, token.** The two sheets lose their top edge. Members' panel takes `hairline`. Then `borderStrong`
  leaves both palettes.

Alternative considered: keep ScreenHeader's three `variant`s and restyle each into the same row. That's a smaller diff,
about 60 lines, but it leaves three render branches drawing one row. That is the bolt-on, and the brief asks for one
shape. 105d's outline already chose this contract. Other options lost too:

- A shared `useFloatStyle()` hook would save no lines at its 4 callers: each still needs one line, plus the hook.
- Moving the input look into TextField would cover 7 of the 8 looks (DateField is a Pressable) and would be a
  refactor the brief doesn't ask for (Follow-ups).

## Inventory (measured on Base)

**ScreenHeader: 11 callers** (`rg -n "<ScreenHeader" apps/mobile/src`), all in a SafeAreaView with
`paddingHorizontal: space.xl`:

| Caller                                                  | Base                                                   | After                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Budget, Income                                          | `month`, trailing "+"                                  | `title={<MonthSwitcher title={tabTitle(…)} month={month} onChange={…} />}`, the same trailing                            |
| Expenses                                                | `month`, no trailing, `dividerStyle`                   | the same, with `dividerStyle`                                                                                            |
| category page                                           | `page`, `backLabel={monthName(month)}`, `dividerStyle` | `back={{ label: \`Back to ${monthName(month)}\`, onPress: goBack }}`, no title, the same trailing (CompactTotal, Add, ⋯) |
| category page's InvalidLink, Members                    | `page`, `backLabel="Back"`                             | `back={{ label: 'Back', onPress: goBack }}`                                                                              |
| category-form, delete-category, income-item, actual-end | `modal`, `title`, `onBack`, `disabled={busy}`          | `back={{ label: 'Back', onPress: …, disabled: busy }}`, `title`                                                          |
| expense                                                 | `modal`, `title`, `onBack`                             | `back={{ label: 'Back', onPress: leave }}`, `title`                                                                      |

The geometry on Base:

- **Forms:** a `mutedText` "Back" Button (margin −8), the title in a `space-between` row, and the 52pt spacer. The
  title's centre is about 189.5, against the screen's 195. The row has a 44pt height and `marginBottom: 8`.
- **Month tabs:** two `flex: 1` sides, so the switcher is already centred. The row has `paddingBottom: 8`.
- **page:** a Pressable Back (margin −8, padding 8) with its icon at x 20 and the label after it, then the trailing
  side, with `paddingBottom: 8`.
- **HeaderDivider:** `left: -20, right: -20`. Only Expenses and the category page pass `dividerStyle`.
- **Elsewhere:** Statistics, Home and Settings draw their own headers, so they're not callers.

**UndoToast:** 4 render sites: Home, Budget, the category page, and the demo's Home.

- Two of them leave room for it: Budget's `toastRoom` style and the category page's `content.paddingBottom`. Both are
  `104` with an `eslint-disable`.
- The toast has `left/right: 20`, `bottom: 32` and `minHeight: 56`, with a 1pt `borderStrong` edge.
- Its Undo is 56 high inside that edge, so the bar is really 58 high.

**`borderStrong`: 15 uses** outside `theme.ts`:

| Group          | Sites                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8 input looks  | `login.input` (2 fields), `members.input` (2), `expense` `field` (the name field, through NameCombobox), `AmountFields.input` (expense ×2, income item), `CategoryForm.input` (2), `income-item.input`, `actual-end.input`, `DateField.field` |
| 3 menus        | the category page's `menuCard`, Statistics' `menuCard`, NameCombobox's `list` (plus `LIST_BORDER` and its `+ 2` in `maxHeight`)                                                                                                               |
| 2 sheets       | `CategorySheet.sheet` and `DateField.sheet` (`borderTopWidth: 1`)                                                                                                                                                                             |
| Members' panel | `members.panel`. It is inside a member's `surface` card for Remove, and on the page for Leave (MemberLeave)                                                                                                                                   |
| UndoToast      | `toast`                                                                                                                                                                                                                                       |

All the inputs sit on `bg`, so none of them touches a same-colour surface. **No `faint` icon sits on a field.**
`rg -n faint apps/mobile/src` finds IconButton's disabled icon, the sheet's handle (on `surface`) and AmountFields'
swap icon, which is on `bg` between the two fields. DateField's calendar is in `text`. So nothing changes for that
line of the brief.

**The dark ring works on both platforms (checked on Base's `node_modules`):**

- RN 0.88.1's `processBoxShadow` (run in Node, Flow stripped) parses `'0 0 0 1px rgba(237,236,242,0.06)'` as
  `{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color }`.
- On iOS, `RCTBoxShadow.mm` draws the path inset by `-spreadDistance` with `shadowRadius = blur / 2 = 0`: a crisp 1pt
  ring.
- `RCTViewComponentView` moves the content into a container view when a view clips and has a shadow, so the shadow
  isn't clipped. On a ScrollView, the shadow sits on the outer view and only the inner UIScrollView clips (Risk 1).
- react-native-web 0.21.4's `preprocess.js` passes a string `boxShadow` through unchanged, and CSS takes a spread-only
  `box-shadow`. A shadow takes no layout room on either platform.

**Contrast** (WCAG 2, computed; * = already in the test):

| Pair (where)                                                   | Light | Dark      | Need | Test                                                 |
| -------------------------------------------------------------- | ----- | --------- | ---- | ---------------------------------------------------- |
| `muted` on `fill` (placeholders, ₴/€ as text; "N more"'s icon) | 4.74  | 6.38      | 4.5  | moves from `iconPairs` to `textPairs`                |
| `accent` on `fill` (the focus border, inside the field)        | 4.51  | 5.96      | 3    | new, `iconPairs`                                     |
| `accent` on `bg` * (the focus border, outside)                 | 4.81  | 7.09      | 3    | in `textPairs`                                       |
| `text` on `fill` * (typed text)                                | 16.57 | 13.86     | 4.5  | in the list                                          |
| `text`, `accent`, `danger` on `surface` * (toast, menus)       | —     | —         | 4.5  | in the list                                          |
| `muted` / `faint` on `bg` * (Back icon, its disabled state)    | —     | —         | 3    | in the list                                          |
| `hairline` ring / panel edge on `bg`, `surface`                | 1.13  | 1.12–1.16 | —    | decorative, like 105c's hairline                     |
| `fill` (a field's area) on `bg`                                | 1.07  | 1.19      | —    | the doc's choice; Base's edge was 1.31/1.44 (Risk 3) |

## Contracts

- DB: none
- API: none
- App:
  - `components/ScreenHeader.tsx`:
    `ScreenHeader(props: { back?: { label: string; onPress: () => void; disabled?: boolean }; title?: ReactNode; trailing?: ReactNode; dividerStyle?: object })`.
    - `type Props` (the `variant` union), `Collapsing`, `modal`, `modalBack`, `spacer`, `month`, `side`/`sideEnd`,
      `page`, `pageBack` and `makeStyles` go. It no longer imports Button, Icon, MonthSwitcher, Pressable,
      `useColors`/`useThemedStyles` or `Palette`.
    - Leading: `back ? <IconButton icon="back" label={back.label} tone="muted" disabled={back.disabled} onPress={back.onPress} /> : <HomeButton />`.
    - Title: `typeof title === 'string' ? <Text accessibilityRole="header" variant="title">{title}</Text> : title`.
    - Styles (a plain `StyleSheet`, since nothing in it has a colour):
      - `row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: -space.xl, paddingHorizontal: space.xl, paddingBottom: space.sm }`;
      - `side: { minWidth: size.iconButton, flexDirection: 'row', alignItems: 'center' }`;
      - `title: { flex: 1, flexBasis: 0, alignItems: 'center' }`;
      - `trailing: { justifyContent: 'flex-end', gap: space.xs, flexShrink: 1 }`;
      - `lifted: { zIndex: 1 }`, when `dividerStyle` is set.
    - The forms' `marginBottom: 8` becomes the row's `paddingBottom: 8`, so nothing under a form's header moves.
  - `components/CollapsingSummary.tsx`: `divider` takes `left: 0, right: 0`.
  - `theme.ts`:
    - `size` gains `toast: 56`;
    - `shadow.dark.float` becomes `` `0 0 0 1px ${darkColors.hairline}` ``, and `shadow.dark.card` stays `undefined`;
    - `borderStrong` leaves both palettes and the header comment.
  - `components/UndoToast.tsx`:
    - `export const toastRoom = space.xxxl + size.toast + space.lg`;
    - the toast is `left/right: space.xl`, `bottom: space.xxxl`, `minHeight: size.toast`, with no border, plus inline
      `{ boxShadow: shadow[scheme].float }`;
    - Undo is `height: size.toast`.
  - Menus: `{ boxShadow: shadow[scheme].float }` inline on the category page's `menuCard`, on Statistics' `menuCard`
    and on NameCombobox's list, each with `const { scheme } = useAppearance()`. `LIST_BORDER` goes, and `maxHeight`
    becomes `VISIBLE_ROWS * ROW_HEIGHT`.
  - Inputs: each of the 8 looks is `borderWidth: 1, borderColor: colors.fill, backgroundColor: colors.fill`. TextField's
    JSDoc says the border is 1pt in the field's own `fill`, so the edge shows only on focus and nothing moves.
  - `test/theme.test.ts`: `textPairs` + `['muted', 'fill']`; `iconPairs` − `['muted', 'fill']`, + `['accent', 'fill']`;
    the shadow test expects `dark: { card: undefined, float: '0 0 0 1px rgba(237,236,242,0.06)' }`.
- Reuses: IconButton (round, 44, `label` → `aria-label`), HomeButton, MonthSwitcher, HeaderDivider,
  `useAppearance().scheme` with `shadow[scheme]` (as Card does), the `hairline` token, `size.control`, the
  `theme.test.ts` `contrast()` table, and 105c's snapshot script and comparison.
- New dependencies: none.

## Version

Bump: patch, 1.23.15 → 1.23.16
Why: §8b `patch` ("styling, copy"). The header, toast, inputs, menus and sheets change look, and one back button's
accessible name gains its destination. Nothing new to do, nothing that works today stops working, and there is no API,
data, connector or demo-store change.

## Slices

- [x] 0. Bump version to 1.23.16
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.16
- [x] 1. Record the dark float ring, the toast's height and the header, input, menu and sheet looks in the design
      system (≈ 22 lines, docs)
  - Files: `docs/design/design-system.md`
  - Change:
    - Elevation: the table gains a Dark column. `shadow.card` is "none" there, and `shadow.float` is
      `0 0 0 1px rgba(237,236,242,0.06)`. Its Use becomes "tab bar, "+" button, toast, menus".
    - "Dark mode uses no shadows." becomes: a card is told from the page by `surface` being lighter than `bg`. A
      floating `surface` can sit over a `surface` card, though, so dark `shadow.float` is a 1pt `hairline` ring, by
      Principle 1's rule, and a spread-only ring takes no layout room.
    - Colour (dark)'s "shadows are off" sentence points to that ring.
    - The Control heights line gains `toast 56` (the Undo bar).
    - Under the Components table, not in its cells, which would re-pad the table, add three sentences:
      - ScreenHeader's sides are each at least 44pt, so the title sits on the screen's centre, and the row spans the
        screen with the gutter inside.
      - An input is `fill` with a 1pt `fill` border that turns `accent` on focus.
      - Menus float on `shadow.float` with no edge, and sheets sit on the backdrop with none.
  - Verify: `yarn format:check`.
- [x] 2. Draw every screen header in one shape: a round Back or Home, a centred title, one trailing action (≈ 212 lines)
  - Files: `components/ScreenHeader.tsx`, `components/CollapsingSummary.tsx`, `app/(tabs)/budget.tsx`, `income.tsx`,
    `expenses.tsx`, `app/category/[categoryId].tsx`, `app/members.tsx`, `app/category-form.tsx`,
    `app/delete-category.tsx`, `app/income-item.tsx`, `app/actual-end.tsx`, `app/expense.tsx`
  - Change:
    - ScreenHeader is rewritten as in Contracts. Its JSDoc covers the one shape, the gutter inside and the screen's own
      top padding. The comment on `side` says why it's at least a button wide.
    - The 11 callers pass the Inventory's props. The three tabs import MonthSwitcher.
    - The category page's call has the comment "The month isn't shown any more, so the name says where Back goes."
    - HeaderDivider's −20 goes.
  - Size: this slice is over the ~150 target. 108 of its lines are deletions (ScreenHeader goes from 120 lines to 68).
    The props change breaks all 11 callers at once, so a smaller commit would need a second, temporary props shape,
    which adds lines only to delete them.
  - Verify:
    - typecheck finds no `variant=`, `backLabel` or `onBack` on a ScreenHeader;
    - `rg -n "spacer|modalBack|left: -20" apps/mobile/src/components` finds nothing;
    - Visual check B.
- [x] 3. Float the Undo bar on the float shadow, with its height and the screens' room for it from one token
      (≈ 44 lines)
  - Files: `theme.ts`, `components/UndoToast.tsx`, `app/(tabs)/budget.tsx`, `app/category/[categoryId].tsx`,
    `test/theme.test.ts`
  - Change:
    - `size.toast`, and the dark `float` ring with its JSDoc ("a floating `surface` there gets a 1pt `hairline`
      ring instead, which moves nothing");
    - UndoToast as in Contracts, with `toastRoom`'s JSDoc ("the scroll room a screen leaves under its content while
      the bar shows: its bottom offset, its height and a 16pt gap");
    - Budget's `toastRoom: { paddingBottom: toastRoom }` and the category page's `paddingBottom: toastRoom` replace the
      two `104`s, their comments and their `eslint-disable`s.
  - Tests: `theme.test.ts` › shadow, renamed "takes the design system's shadows in light, and in dark only a hairline
    ring for floating surfaces", expects the dark ring. Verify: `rg -n "104|eslint-disable" "apps/mobile/src/app/(tabs)/budget.tsx" "apps/mobile/src/app/category/[categoryId].tsx"`
    finds no toast line; Visual check C.
- [x] 4. Float the period menu, the category menu and the name suggestions on the float shadow, with no edge
      (≈ 33 lines)
  - Files: `app/category/[categoryId].tsx`, `app/(tabs)/statistics.tsx`, `components/NameCombobox.tsx`
  - Change: as in Contracts. Each `borderWidth`/`borderColor` pair goes. NameCombobox loses `LIST_BORDER` and the
    comment "The border adds to the height…".
  - Verify: Visual check E (`statistics-menu`, `category-menu`, `expense-names`).
- [x] 5. Draw every input in the fill colour, with its edge only on focus, and login's fields at 48 (≈ 47 lines)
  - Files: `app/login.tsx`, `app/members.tsx`, `app/expense.tsx`, `app/income-item.tsx`, `app/actual-end.tsx`,
    `components/AmountFields.tsx`, `components/CategoryForm.tsx`, `components/DateField.tsx`,
    `components/TextField.tsx`, `test/theme.test.ts`
  - Change:
    - The 8 looks as in Contracts, and login's `height: 52` becomes `size.control`. DateField keeps its 1pt `fill`
      border too (Open question 4).
    - TextField's JSDoc, as in Contracts.
    - In the test, `['muted', 'fill']` moves to `textPairs` with the comment "Placeholders and the ₴/€ signs in a
      field; also the "N more" chip's icon". `['accent', 'fill']` joins `iconPairs` with the comment "A focused
      field's border".
  - Tests: `theme.test.ts` › "keeps every text and icon pair readable", in both themes (4.74/6.38 at 4.5; 4.51/5.96 at
    3). Verify: Visual check D.
- [x] 6. Draw the sheets without a top edge and Members' confirm panel with a hairline, and remove `borderStrong`
      (≈ 11 lines)
  - Files: `components/CategorySheet.tsx`, `components/DateField.tsx`, `app/members.tsx`, `theme.ts`
  - Change:
    - The two sheets lose `borderTopWidth` and `borderColor`.
    - `members.panel`'s `borderColor` becomes `colors.hairline`.
    - `borderStrong` leaves both palettes, and the header comment becomes "Colours from
      docs/design/design-system.md (direction A, brief 105)."
  - Verify:
    - typecheck passes, so no `colors.borderStrong` is left;
    - `rg -n borderStrong apps docs/design` finds nothing;
    - Visual check F and G.
- [ ] 7. Mark 105d done and 105 complete in the backlog, with 106 next (≈ 20 lines, docs)
  - Files: `docs/features/BACKLOG.md`
  - Change:
    - The Snapshot line moves to v1.23.15 (`210d798`, after #176).
    - "In progress" becomes 106 (the floating tab bar), next, whose brief is a draft to read first.
    - Recently finished gains:
      - "105e · The header, the toast, inputs, menus and sheets (done: v1.23.16)", with one line;
      - "105d · One look per button, chip and icon button (done: #176, v1.23.15)", with one line;
      - a sentence under 105 that the fresh look is complete (105–105e, #173–#176 and this PR).
    - In the roll-out table, 105d says done (#176), and the 105e row points at `docs/features/105e-one-look-header/`
      and says done.
    - The 104 "differences the later parts keep" list stays: it's history.
  - Verify: `yarn format:check`. After the PR opens, its number goes into the 105e lines in one more docs commit
    (Open question 6).

Total ≈ 389 lines (docs ≈ 42, code and tests ≈ 347).

## What moves (the PR lists this)

All of it is by design. Text and type don't change, except for the back buttons.

- **The forms' header** (category form, delete-category, income item, actual End, the expense form):
  - "Back" text (x 20) becomes the back icon (x 32–52, in a 44pt round button at x 20).
  - The title's centre moves from about 189.5 to 195, about 5.5pt right.
  - The rows below don't move, because the 8pt margin becomes the row's 8pt padding.
- **The category page and Members:** the back icon moves 12pt right (x 20 → 32). The category page's month name and
  Members' "Back" text go. The trailing side stays put. On the category page it gets about 60pt more room before the
  compact total truncates.
- **Month tabs:** nothing moves. The sides were equal before and are 44 each now, so the switcher stays centred. The
  header's own box widens to the screen (x 0, width 390), and HeaderDivider stays at x 0 to 390.
- **The Undo bar:**
  - it loses its edge, so it's 56 high where it was 58, and its top sits 2pt lower;
  - its text and Undo move 1pt;
  - in light it gains the float shadow, and in dark the ring;
  - the screens' room under the content stays 104.
- **Login:** each field goes from 52 to 48. The body is centred, so the title and everything above the fields move 4pt
  down, the Password label doesn't move, and everything under the second field moves 4pt up.
- **Inputs:** they're `fill` with an invisible edge until focus. No box moves.
- **Menus:** each loses its 1pt edge, so the items move 1pt. The name list is 2pt shorter at five rows. They gain the
  float shadow in light and the ring in dark.
- **Sheets:** they lose their top edge, so their contents move 1pt up.
- **Members' panel:** only the edge colour changes. Nothing moves.
- **Element counts** change only inside the header row (its three wrappers), view by view.

## Visual check (AC7, AC8; not counted in the line estimates)

**Set-up**, as in 105d's Visual check and its Deviations:

- **Servers:**
  - the API on 3000, the web app on :8084 opened at `http://127.0.0.1:8084`, and `web-demo` on 8082;
  - the two git-ignored `.env` files copied in, and `yarn install` run in each worktree first;
  - `DATABASE_URL_TEST` from the main checkout's `apps/api/.env`;
  - stop one server before starting the next.
- **Two sets, on one Kyiv day:**
  - `before`: a detached copy of Base (210d798) on :8084, taken before slice 2;
  - `after`: the branch at slice 6.
  - From 1 December, seed `2026-12`. If the day is also before 3 December, put the expenses on the 1st.
- **Clear old keys first:** delete every older `snap:*` key from localStorage on 127.0.0.1:8084.
- **QA users**, created before `before` and deleted when the brief is done, members first:
  - `claude-qa-105e`, the owner;
  - `claude-qa-105e-m`, made with `--join claude-qa-105e`;
  - `claude-qa-105e-n`, made with `--join claude-qa-105e`, then removed by the owner for the no-ledger views.
- **Seeding**, once, as the owner, through the API, after checking that the month is empty. It repeats 105d's steps,
  with one addition:
  - income Salary €1000 and Bonus €50;
  - U, N and O (rent, groceries, education) planned at €100 each;
  - expenses on the 3rd: €6 and €4 (U), €95 (N) **named "Market"**, so the name list has an entry, and €109 (O);
  - an actual End of €900;
  - the invite to `-n`, made just before the no-ledger views.
- **API calls:** login sends a `deviceId` of 8–64 characters, and a DELETE with no body sends no JSON content type.
  TOTP codes come from a scratch script outside the repo, are never printed, and each sign-in waits for a fresh
  window.

**Views:** 105d's 34, plus 4 new, each in Light and Dark.

- 105d's 34 (`home`, `budget`, `budget-ended`, `budget-next`, `income`, `expenses`, `expenses-scrolled`, `statistics`,
  `statistics-menu`, `statistics-last3`, `category`, `category-menu`, `category-undo`, `settings`, `members-owner`,
  `members-confirm`, `members-member`, `members-member-confirm`, `actual-end`, `actual-end-error`, `delete-category`,
  `expense-new`, `expense-sheet`, `expense-added`, `expense-edit`, `expense-pressed`, `income-item-edit`,
  `category-form-add`, `category-form-edit`, `login`, `login-error`, `login-ready`, `no-ledger-invite`, `no-ledger`).
  - `actual-end`, `income-item-edit` and `category-form-add` autofocus a field, so they're the focused-input views.
  - If the frame doesn't take focus on load, call `.focus()` on that input in the frame before the snapshot.
- New:
  - `login-focused`: `login` with Username focused;
  - `expense-names`: `expense-new` with the name field focused, so the list shows "Market";
  - `budget-undo`: U removed from the month through its form, back on Budget with the bar. The snapshot comes first,
    then Undo, which restores U;
  - `category-invalid`: `/category/abc`, InvalidLink's header.

**Taking them:** as in 105d's run.

- Each page loads in a same-origin 390×844 iframe, the same for both sets.
- Each snapshot uses 105c's script (104h's `__snapSrc` plus columns 21–23: `boxShadow`, border widths, border colours).
  It's saved as JSON outside the repo, in the system temp dir, and its key is deleted.
- A screenshot of each view in each scheme, in both sets, goes in the PR.

**Comparison** (Node, over the saved files; colour and shadow columns only where a check below reads them):

- **A. Same content.** On every view and scheme:
  - the width is 390;
  - the text leaves (tag, text) are equal and in order, except that the header's "Back" leaf leaves the form, Members
    and `category-invalid` views, and the header's month name leaves the three `category` views;
  - the type columns (13–19) are equal;
  - the `a11y` arrays are equal, except for the listed back buttons:
    - every header Back keeps its `button` role and gains `aria-label`: "Back", the same name it had from its text;
    - on `category`, `category-menu` and `category-undo`, the name goes from "November" (or "December") to
      "Back to November";
    - `aria-disabled` and every other attribute are unchanged;
  - element counts change only inside the header row.
- **B. Header** (`after`, every view with a ScreenHeader):
  - the row's box is x 0, width 390;
  - the leading button is a 44×44 `999px` box at x 20;
  - a string title's centre and the MonthSwitcher's centre are x 195 (±0.5);
  - the trailing "+" or ⋯ ends at x 370;
  - HeaderDivider, on `expenses-scrolled`, is x 0, width 390.
- **C. Toast** (`after`: `category-undo`, `budget-undo`):
  - borders `0px 0px 0px 0px`, height 56;
  - `boxShadow` is `rgba(17, 16, 20, 0.12) 0px 4px 24px 0px` in light and `rgba(237, 236, 242, 0.06) 0px 0px 0px 1px`
    in dark;
  - the scroll content's `paddingBottom` is 104 in both sets.
- **D. Inputs** (`after`): every `input` element and DateField's Pressable has:
  - a `fill` background (light `rgb(240, 239, 244)`, dark `rgb(33, 31, 39)`);
  - borders `1px` on all four sides, in `fill`, except the focused one, whose border is `accent` (light
    `rgb(109, 74, 255)`, dark `rgb(160, 140, 255)`);
  - a height of 48, login's included.
  - Between `login` and `login-focused`, every leaf's box is equal.
- **E. Menus** (`after`: `statistics-menu`, `category-menu`, `expense-names`): the card or list has borders
  `0px 0px 0px 0px` and C's `boxShadow` for its scheme.
- **F. Sheets and panel** (`after`):
  - on `expense-sheet`, the sheet's top border is `0px`;
  - on `members-confirm` and `members-member-confirm`, the panel's borders are `1px` in `hairline` (light
    `rgba(17, 16, 20, 0.06)`, dark `rgba(237, 236, 242, 0.06)`).
- **G. No `borderStrong` left:** no element in `after` has a border or background in light `rgb(213, 218, 225)` or
  dark `rgb(42, 47, 55)`. In `before`, the input, menu, toast and panel views do.
- **H. Everything else.** Every other leaf that moves more than 2pt is listed, by view and cause, against What moves.
  A move with no cause there is a finding, fixed before the PR.

**The dark ring at 3×:** zoom the dark `after` screenshots of `category-menu` and `category-undo` to 3× at an edge over
a card, and record whether the ring shows.

**Checked from the code only** (listed so in the PR):

- DateField's iOS sheet (web has no sheet), also at Gate B;
- a form's disabled Back while it saves (the requests return too fast to snapshot);
- the expense form's LoadFailed view.

**Demo:** run `web-demo` in Light and Dark with the console open. Check Home, Budget, Income, Expenses, a category
page, the expense form with its sheet and the name field, an income item, and the Undo bar after removing a category:
no errors. Then run `yarn mobile export:web` and `yarn mobile check-builds`. They should need no `--accept`: every file
ScreenHeader stops importing is still reached through other screens.

**Gate B, iPhone (Expo Go):**

- At the largest text size: Budget's MonthSwitcher ("September") and the category page's trailing side neither wrap
  nor clip in their fixed boxes.
- Each slice's own check is typecheck, lint and its `rg`; Visual checks B–G run once on the finished branch.
- Back on a form, the category page and Members is a round icon. VoiceOver reads "Back to November, button" on the
  category page and "Back, button" elsewhere. Titles are centred.
- The Undo bar, the ⋯ menu, the period menu and the name suggestions have the shadow in light and the ring in dark
  (Risks 1 and 2).
- A focused field shows the `accent` edge, and nothing moves. Login's fields are 48. The fields read as fields on the
  page in light (Risk 3).
- The category sheet and DateField's calendar sheet have no top edge.
- Members' panel shows its hairline inside a member's card.

## AC → evidence

| AC (brief)                                                                                      | Evidence                                                             |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| AC1 one shape, title centred; spacer, `modalBack`, modal margin, bleed gone; round named Back   | slice 2 (typecheck, `rg`); Visual check A (names), B; Gate B         |
| AC2 toast `shadow.float`, no edge; height and room from one token; no `eslint-disable` for them | slice 3 (`rg`, shadow test); Visual check C                          |
| AC3 inputs `fill`, no edge until focus, 48 single-line, `accent` focus                          | slice 5; Visual check D; Gate B                                      |
| AC4 menus and sheets: no `borderStrong`; menus float (`hairline` ring in dark)                  | slices 3–4, 6; `theme.test.ts` shadow; Visual check E, F, G, 3× zoom |
| AC5 Members' panel `hairline`                                                                   | slice 6; Visual check F; Gate B                                      |
| AC6 `borderStrong` gone; the contrast test covers every new pair                                | slice 6 (`rg`, typecheck); slice 5's pairs; the Inventory's table    |
| AC7 before/after 390×844 light and dark; planned moves only; a11y as listed; > 2pt listed       | Visual check: 38 views × 2 schemes × 2 sets; A–H; What moves         |
| AC8 demo with no console errors; `check-builds`                                                 | Visual check, Demo                                                   |
| AC9 gates                                                                                       | every slice                                                          |
| What: the doc records the ring first; backlog                                                   | slice 1 (before any code); slice 7                                   |

## Not doing (YAGNI)

- **Statistics' header** (Home, then "Statistics" at the left) isn't a ScreenHeader. The brief counts 11 callers.
  Moving it in would move its title (Follow-ups).
- **The category page keeps both Add and ⋯** in its trailing side. "One trailing action" is one slot, and merging the
  two would be new behaviour (Open question 3).
- **The expense form's LoadFailed "Back"** and the panel's Back/Close stay text buttons. They're actions in the body
  under a message, not the header's back button (Open question 5).
- **UndoToast's Undo** keeps its 0.6 while restoring. It isn't a Button, and the brief doesn't name it.
- **The input look moved into TextField**, and a `useFloatStyle` hook (Approach).
- **Android.** The app ships to iOS and web.
- **The brief's Out of scope:** the tab bar and "+" (106), the 20pt gutter, and LedgerPicker's inset.

## Risks

1. **iOS may not draw the shadow on NameCombobox's ScrollView.** RN puts the shadow layers on the outer view, and only
   the inner UIScrollView clips (Inventory), so it should work. Gate B checks it. Fallback: wrap the list in a View
   that carries `position`, the radius, the background and the shadow (≈ 6 lines), in a new commit recorded in
   Deviations.
2. **The dark ring may barely show.** It is 1.12:1 on `bg` and 1.16:1 on a card, the same faint step as 105c's
   hairlines. The brief settles it. The 3× zoom and Gate B record what shows. If it doesn't show at all, that's
   reported to the user, not changed.
3. **In light, a field is `fill` on `bg` at 1.07:1**, so it may not read as a field. Base's `borderStrong` edge was
   1.31:1, also under 3:1, and every field has a visible label above it. The doc chose `fill`, and the brief keeps the
   choice. Gate B looks. If the fields don't read, that's a finding for the user, not a quiet hairline.
4. **The title off-centre on web** if react-native-web gives `flex: 1` an `auto` basis. `flexBasis: 0` is set, as
   Base's sides do. Visual check B measures it.
5. **Login's 26pt one-time code in a 48pt field:** the inner height is 46, more than the 26pt face needs. Visual
   check D (`login-ready`) and Gate B.
6. **The style-number guard:** a reviewer may read `paddingBottom: toastRoom` as dodging it. It's the brief's
   requirement and is built from tokens (Approach). The JSDoc says so.
7. **The day.** Both sets on one Kyiv day (Set-up).
8. **Main moves:** if another PR takes 1.23.16, rebase, take main's number and bump once more (§8b).

## Open questions

The user is away and Gate A is pre-approved, so the recommended answers are used. **None needs a product decision the
brief doesn't settle.** The dark ring was the one in 105d's outline, and the brief settles it.

1. **Blocking: no. Login's fields at 48 (brief open question 1).** Recommended: yes, `size.control`, the doc's control
   height. It moves login by 4pt (What moves).
2. **Blocking: no. The back buttons' names (brief open question 2).**
   - Recommended: only the category page's changes, to "Back to <Month>" (`monthName`, as its text said). It's the
     only back button whose shown destination goes.
   - The forms, Members and InvalidLink only ever showed "Back", so they stay "Back".
   - "Back to Budget" and similar would name a screen that `router.back()` may not return to: a web link falls back
     elsewhere.
3. **Blocking: no. "One trailing action" on the category page**, which has Add, ⋯ and the compact total. Recommended:
   the trailing side is one slot that takes what the screen passes, so nothing is removed. Merging Add into ⋯ would be
   new behaviour (Out of scope).
4. **Blocking: no. DateField keeps a 1pt border in `fill`**, though nothing turns it `accent`, since it's a Pressable,
   and web shows FocusStyles' outline. Recommended: keep it, so its text stays 17pt in like the other fields and every
   input has the same box. Dropping it would move its text 1pt for nothing.
5. **Blocking: no. "Every back button"** (AC1) means the header's. LoadFailed's body "Back" under an error and the
   panel's Back/Close stay text buttons (Not doing).
6. **Blocking: no. The backlog names this PR's number** in a one-line docs commit after `gh pr create`, since the
   number isn't known when slice 7 is written.
7. **Blocking: no. The Leave panel** (MemberLeave) sits on the page, not in a card. It shares the panel's style, so it
   takes the hairline too, which does no harm.

## Follow-ups

- Statistics' header could become a ScreenHeader (Home and a centred "Statistics"), which would move its title. Not
  briefed.
- The 7 TextField input looks repeat one style (height, radius, 1pt `fill` border, `fill`, padding, `text.input`). A
  `/kopiyka-hos-refactoring` brief could move it into TextField.
- From 105d: the expense form's Back stays enabled during a save. The header's Back takes no `disabled` there.
- From 105c: the tab screens' 20pt gutter against the doc's 16, and LedgerPicker's inset.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

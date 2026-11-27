# Plan: The fresh look, part 4: one look per control (buttons, chips, icon buttons)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Gate A: skeptic APPROVE WITH EDITS (applied); approved 2026-11-27 under the user's standing OK: split into 105d and 105e, open questions as recommended.
Brief: ./brief.md
Branch: feat/one-look-controls
Base: origin/main (e83f8c9, version 1.23.14, after #175)

## Approach

**The split first (Open question 1).** I made every edit in the brief in a scratch copy of `apps/mobile`, outside the
repo, and ran it through Prettier, `tsc` and ESLint (all clean). The diff counts added plus removed lines, as 104b's
did. It comes to about 720 lines, not the brief's 330, so this plan proposes the brief's split:

| Part                   | What                                                                                           | Measured |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| **105d** (this plan)   | Button, Chip, AppearancePicker, IconButton, the contrast test, docs                            | ≈ 381    |
| **105e** (Later parts) | ScreenHeader, UndoToast and `toastRoom`, inputs, menus, sheets, Members' panel, `borderStrong` | ≈ 340    |

The brief's example split puts ScreenHeader with the controls. That would make 105d about 575, because ScreenHeader
is a full rewrite of 138 lines plus its 11 callers. 105's own outline suggested this split instead: "ScreenHeader and
the inputs into 105e".

**This part.** Each control gets one shape in its component, and the callers lose their one-offs.

- **Button** loses `ButtonSize` and `size`. Filled looks are a 48pt pill. Text looks are a 44pt pill with 8pt side
  padding. Every look dims to 0.4 while busy or disabled. The spinner always sits before the label, so large buttons'
  "spinner replaces the label" path and its `accessibilityLabel` workaround go. Then the callers' overrides go. Then
  the doc's `danger` (`fill` + red label) replaces `outlinedDanger` and today's filled red, and `accentText` becomes
  `accentLabel`.
- **Chip** draws its own label, which it needs to colour the label `accentText` when the chip is selected. The pill is
  32pt (`fill`, or `accentTint` when selected), with no edge, inside a 44pt Pressable. The tile-to-name gap goes from 8
  to 4, which with the edge gone gives "education" 64pt for its 61.
- **AppearancePicker** keeps its radios and draws each one as Chip's pill.
- **IconButton** becomes round.

Alternative considered: a shared `ChipPill` that both Chip and AppearancePicker render. It would need an alignment
option (the picker centres its label, the chips start at the tile), which is a new prop for one caller. Six style
lines in the picker are smaller. Bolt-on check: Button's per-look shapes are spread into each look's style (`filled`,
`plain`), so no `if (variant …)` branch is left. The last one, `filled && off`, goes.

## Inventory (measured on Base)

**Button: 26 callers in 14 files** (`rg -c "<Button\b" apps/mobile/src`). Look, size and overrides on Base:

| Caller                                                | Look → this part                | Size → shape    | Overrides that go                                                                 |
| ----------------------------------------------------- | ------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| CategoryForm, income-item, actual-end Save            | primary                         | large 56 → 48   | —                                                                                 |
| expense Add/Update (+ icon)                           | primary                         | large 56 → 48   | —                                                                                 |
| login Sign in                                         | primary                         | large 56 → 48   | `signIn` (pill), `signInOff` (0.4)                                                |
| EmptyMonth (Copy …)                                   | primary                         | large → 48      | `minHeight`, `borderRadius: radius.md` (keeps `alignSelf`)                        |
| delete-category action                                | danger: filled red → fill + red | large 56 → 48   | —                                                                                 |
| Members Save, Invite                                  | primary                         | medium 48       | `dimmed` (0.5)                                                                    |
| Members confirm Remove/Leave                          | danger: filled red → fill + red | compact 44 → 48 | `accessibilityLabel={action}` (equals the label)                                  |
| PendingInvites Accept                                 | primary                         | compact 44 → 48 | —                                                                                 |
| Settings and no-ledger Sign out, Members Leave ledger | outlinedDanger → danger         | medium 48       | — (Settings keeps `marginBottom`)                                                 |
| Remove from <month>, Delete expense, Delete item      | dangerText                      | medium 48 → 44  | —                                                                                 |
| actual-end Use calculated end                         | accentText → accentLabel        | medium 48 → 44  | —                                                                                 |
| LoadError Retry                                       | accentText → accentLabel        | compact 44      | `paddingHorizontal: sm` (keeps `alignSelf`)                                       |
| no-ledger Check for invites                           | accentText → accentLabel        | compact 44      | `paddingHorizontal: sm` (keeps `alignSelf`, `marginLeft`)                         |
| Members Remove, Revoke                                | dangerText                      | compact 44      | `remove` (`minWidth`, padding 4)                                                  |
| Members panel Back/Close                              | mutedText                       | compact 44      | `dismiss` (padding 12)                                                            |
| PendingInvites Decline                                | mutedText                       | compact 44      | `decline` (padding 12), `opacity: 0.6`                                            |
| expense LoadFailed Back                               | mutedText                       | compact 44      | `failedBack` (the whole style)                                                    |
| ScreenHeader modal Back                               | mutedText                       | compact 44      | `paddingHorizontal: sm` (keeps `marginLeft`; 105e replaces it with an IconButton) |

On Base, disabled buttons dim to 0.6 (filled looks), 0.5 (Members) or 0.4 (Sign in). Text looks don't dim, except
Decline. `ButtonSize` has no importer outside `Button.tsx`. No demo file renders a Button.

**Chip: 3 callers.** CategoryPicker has the quick five and "N more" at `31.5%` width, DateChips has Today and
Yesterday with `paddingHorizontal: lg`, and CategorySheet has the rest at `48.5%` with a `fill` override. All are 48pt
with `radius.md` and a 1pt `borderStrong` edge. "N more" is dashed `faint` on transparent.

**IconButton: 11 call sites** (HomeButton, AddExpenseButton, MonthSwitcher ×2, Statistics ×2, Budget "+" and pencil,
Income "+", the category ⋯, CategorySheet's close). Two override the corner to 0: Budget's `edit` and the sheet's
`close`, each with an `eslint-disable`. Nothing needs the doc's `raised` look.

**AppearancePicker:** three `radio` Pressables in a `group` Card. Each is 44pt with `radius.md`. The selected one has
`accentTint` and a 1pt `accent` edge. The labels are `bodyMedium` 15, `muted`, or `text` when selected.

**`borderStrong`: 17 uses.** This part removes 2 (Chip, Button's `outlinedDanger`). 105e removes the other 15: 8
input looks, the 2 sheets' top edges, 3 menus, Members' panel and UndoToast.

**Chip width** (Inter Medium 13, advance widths read from the font file, tracking −0.1). The quick row is the first
five of the month's list. For a new ledger that's rent, groceries, education, personal and parking, then "10 more".
"education" is 60.9 wide. On Base it gets 110.25 − 2 (edge) − 16 (padding) − 26 (tile) − 8 (gap) = 58.25, so it
truncates. After this part it gets 110.25 − 16 − 26 − 4 = 64.25, so it fits with 3.3 to spare. "medication" (67.8)
and "home needs" (78.0) still truncate. They aren't in the default quick row.

**Contrast, the new pairs** (WCAG 2, computed; pairs from the test that this part reuses are marked *):

| Pair (where)                                                                                      | Light | Dark  | Need | Test                    |
| ------------------------------------------------------------------------------------------------- | ----- | ----- | ---- | ----------------------- |
| `danger` on `fill` (the `danger` button: Sign out, Leave, Remove, the delete action; its spinner) | 4.63  | 7.13  | 4.5  | new text pair           |
| `muted` on `fill` ("N more"'s icon)                                                               | 4.74  | 6.38  | 3    | new icon pair           |
| `text` on `fill` * (chip names, the picker's unselected labels)                                   | 16.57 | 13.86 | 4.5  | in the list             |
| `accentText` on `accentTint` * (a selected chip or radio)                                         | 6.94  | 9.13  | 4.5  | in the list             |
| `onAccent` on `danger` (the filled red, gone)                                                     | 5.30  | 8.48  | —    | removed: no caller left |
| `faint` on `fill`: no caller in this part (2.92 light)                                            | —     | —     | —    | not added               |

A category tile's initial on `fill` (quick chips; the sheet's were already on `fill`) is at least 3.30:1 in light (hue 175) and 5.1:1 in dark. On white it was 3.72. It is a graphic next to the name, not the name, so it is held to 3:1, and
it isn't a palette pair, so the test doesn't list it.

## Contracts

- DB: none
- API: none
- App:
  - `components/Button.tsx`:
    - `type ButtonVariant = 'primary' | 'danger' | 'dangerText' | 'mutedText' | 'accentLabel'`. `ButtonSize` is
      removed, and so is the `size` prop.
    - `Look = { variant: 'primary' | 'danger'; busy?: boolean; icon?: IconName } | { variant: 'dangerText' |
'mutedText' | 'accentLabel'; busy?: never; icon?: never }`. `busy` becomes optional (slice 4) because Sign out
      and Leave ledger are now `danger` and have no busy state. Passing `busy={false}` would write
      `aria-busy="false"` on them.
    - `Button(props: Look & { label: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string;
style?: StyleProp<ViewStyle> })`. `style` is the caller's layout only (alignSelf, margins). Its JSDoc says so.
    - Shapes: `primary` is `accent`, `danger` is `fill`, both `{ minHeight: size.control, borderRadius: radius.pill,
paddingHorizontal: space.lg }`. Text looks are `{ minHeight: size.iconButton, borderRadius: radius.pill,
paddingHorizontal: space.sm }`. `off: { opacity: 0.4 }` applies to every look while `busy || disabled`.
    - Labels: `primary` is `onAccent` and `danger` is `danger` (both `bodyStrong`). `dangerText`, `mutedText`
      (`bodyMedium`) and `accentLabel` (`bodyStrong`) are `danger`, `muted` and `accent`.
    - Content: `busy` shows `<ActivityIndicator color={label colour}/>`, otherwise the `icon` if set; then the label,
      always. `accessibilityLabel` goes to the Pressable only when the caller gives one.
  - `components/Chip.tsx`: `Chip(props: Omit<ComponentProps<typeof Pressable>, 'accessibilityRole' | 'aria-selected' |
'children'> & { label: string; leading?: ReactNode; selected?: boolean })`.
    - The Pressable is `accessibilityRole="button"` (as on Base), `aria-selected={selected}`, `{ minHeight: size.iconButton, justifyContent:
'center', borderRadius: radius.pill }`, with the caller's `style` (width) last.
    - Inside it, a View `{ height: size.chip, borderRadius: radius.pill, backgroundColor: fill | accentTint,
paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs }` holds `leading` and
      `<Text numberOfLines={1} variant="label" color={selected ? 'accentText' : 'text'} style={{ flexShrink: 1 }}>`.
    - Callers: CategoryPicker (`leading` = the 26pt tile, or the `more` icon in `muted`), DateChips (no `leading`),
      CategorySheet (the 28pt tile).
  - `components/AppearancePicker.tsx`: props unchanged. Each radio is `{ flex: 1, minHeight: size.iconButton,
justifyContent: 'center', borderRadius: radius.pill }` around a View `{ height: size.chip, borderRadius:
radius.pill, backgroundColor: fill | accentTint, alignItems: 'center', justifyContent: 'center' }`, with a `label`
    Text in `text` or `accentText`.
  - `components/IconButton.tsx`: props unchanged; `borderRadius: radius.pill`. Its `style` JSDoc becomes "the caller's
    layout: margins".
  - `test/theme.test.ts`: `textPairs` + `['danger', 'fill']`, − `['onAccent', 'danger']`; `iconPairs` +
    `['muted', 'fill']`.
- Reuses: `size.control`, `size.iconButton`, `size.chip`, `radius.pill`, the palette's `fill`/`accentTint`/
  `accentText`, Text's `color` key, the `theme.test.ts` `contrast()` table, and 105c's snapshot script and comparison.
- New dependencies: none.

## Version

Bump: patch, 1.23.14 → 1.23.15
Why: §8b `patch` ("styling"). Buttons, chips, the Appearance radios and icon buttons change shape and colour, and a
few accessible names come from the label instead of a duplicate `aria-label`. Nothing new to do, nothing that works
today stops working, and no API, data, connector or demo-store change.

## Slices

- [x] 0. Bump version to 1.23.15
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.15
- [x] 1. Record 105c as done and the 105d/105e split in the backlog and design system (≈ 22 lines, docs)
  - Files: `docs/features/BACKLOG.md`, `docs/design/design-system.md`
  - Change:
    - Backlog:
      - the Snapshot line moves to v1.23.14 (`e83f8c9`, after #175);
      - "In progress" becomes 105d on `feat/one-look-controls`, v1.23.15, then 105e, then 106;
      - Recently finished gains "105c · Borderless cards and one card per row (done: #175, v1.23.14)" with one line;
      - in the roll-out table, 105c says done (#175), 105d points at `docs/features/105d-one-look-controls/` (buttons,
        chips, icon buttons; in progress), and a new 105e row points at this plan's Later parts (the header, the
        toast, inputs, menus, sheets).
    - Design system: two sentences under the Components table, not in its cells (a wider cell would make Prettier
      re-pad the whole table). "Text buttons have no fill: the label in `danger`, `muted` or `accent`, 44pt high.
      Every button dims to 0.4 while busy or disabled, and a busy one shows a spinner before its label." And "A chip's
      touch area is 44pt high around its 32pt pill."
  - Verify: `yarn format:check`.
- [x] 2. Give each button look one shape, with one disabled look and the spinner before the label (≈ 130 lines)
  - Files: `apps/mobile/src/components/Button.tsx`, plus the 26 callers' `size` lines in `PendingInvites`,
    `members`, `ScreenHeader`, `LoadError`, `category-form`, `income-item`, `EmptyMonth`, `delete-category`,
    `actual-end`, `CategoryForm`, `login`, `no-ledger`, `expense`, `(tabs)/settings`
  - Change:
    - `ButtonSize`, `size`, `large`/`medium`/`compact`, `replaces` and `bare` go. The looks take the Contracts'
      shapes. `danger` stays filled red and `outlinedDanger` keeps its edge until slice 4.
    - `outlinedDanger` takes the filled shape (`minHeight: size.control`, `radius.pill`, `paddingHorizontal: space.lg`)
      until slice 4.
    - `off` applies to every look. The spinner (in the label's colour) or the icon comes before the label.
    - The JSDoc says how each look draws and dims.
    - The callers' overrides still apply and come last, so Decline's 0.6 and Members' 0.5 still win until slice 3.
  - Verify: typecheck (no `size` left); `rg -n 'size="(large|medium|compact)"|ButtonSize' apps/mobile/src` finds
    nothing.
- [x] 3. Drop the buttons' one-off heights, corners, paddings and opacities (≈ 50 lines)
  - Files: `app/login.tsx`, `components/EmptyMonth.tsx`, `app/members.tsx`, `components/PendingInvites.tsx`,
    `components/LoadError.tsx`, `app/no-ledger.tsx`, `app/expense.tsx`, `components/ScreenHeader.tsx`
  - Change: as the Inventory's last column.
    - Login's `signIn`/`signInOff` go, with their comment.
    - EmptyMonth's `button` becomes `{ alignSelf: 'stretch' }` and its comment loses "one-off until 105d".
    - Members' `dimmed`, `remove` and `dismiss` go, and so does the confirm button's `accessibilityLabel={action}`.
    - Decline's style and opacity go.
    - Retry and Check for invites lose `paddingHorizontal`.
    - `failedBack` and LoadFailed's `styles` go.
    - `modalBack` keeps only `marginLeft: -space.sm`.
    - Unused imports go.
  - Verify: `rg -n -A12 "<Button\b" apps/mobile/src | rg "style="` lists, for Buttons, only `settings` (`signOut`),
    `no-ledger` (`check`), `LoadError` (`retry`), `EmptyMonth` (`button`) and `ScreenHeader` (`modalBack`). Its other
    lines are elements near a Button, not Buttons: login's `demoLink` Pressable, expense's `added`/`addedText`, and
    ScreenHeader's `spacer`. None of those styles
    sets a height, `minHeight`, `borderRadius`, `padding*` or `opacity`. `rg -n "opacity: 0\.[456]" apps/mobile/src`
    finds only Button's `off` (0.4) and UndoToast's Undo (0.6, 105e's).
- [x] 4. Draw the danger button in the design system's grey with a red label, and name the accent text look (≈ 26 lines)
  - Files: `components/Button.tsx`, `app/(tabs)/settings.tsx`, `app/no-ledger.tsx`, `app/members.tsx`,
    `app/actual-end.tsx`, `components/LoadError.tsx`, `test/theme.test.ts`
  - Change:
    - `danger` becomes `fill` with a `danger` label, and `outlinedDanger` goes along with its `borderStrong`; its three
      callers take `danger`. `busy` becomes optional on the filled looks.
    - `accentText` is renamed `accentLabel` (3 callers). It draws `accent`, and the palette's `accentText` token is a
      different colour.
    - In `theme.test.ts`, `['danger', 'fill']` is added to `textPairs` and `['onAccent', 'danger']` is removed.
  - Tests: `theme.test.ts` › "keeps every text and icon pair readable" with the new pair, in both themes (4.63, 7.13).
    Verify: `rg -n "outlinedDanger|variant=\"accentText\"" apps/mobile/src` finds nothing.
- [x] 5. Draw chips as a 32pt pill in a 44pt touch area, with room for "education" (≈ 115 lines)
  - Files: `components/Chip.tsx`, `CategoryPicker.tsx`, `DateChips.tsx`, `CategorySheet.tsx`, `apps/mobile/src/theme.ts`,
    `test/theme.test.ts`
  - Change:
    - Chip as in Contracts.
    - CategoryPicker passes `label`/`leading`. "N more" loses `more` (the dashed slot) and becomes a plain chip with
      the `more` icon in `muted` and its label in `text`. The grid becomes `columnGap: space.sm` with no row gap
      (comment: "the 44pt touch areas meet, 12pt between the pills").
    - DateChips loses `chip` (16pt padding) and its `Text` import.
    - CategorySheet loses `item`'s `fill` and `itemText`, and its grid becomes `columnGap: space.sm`.
    - `theme.ts`'s header comment says 105e removes `borderStrong`'s last callers.
    - `iconPairs` gains `['muted', 'fill']`.
  - Tests: `theme.test.ts` as above (4.74, 6.38). Verify: `rg -n "borderStrong" apps/mobile/src/components/Chip.tsx
apps/mobile/src/components/Button.tsx` finds nothing; Visual check C.
- [x] 6. Draw the Appearance options in the chip's pill and colours (≈ 24 lines)
  - Files: `components/AppearancePicker.tsx`
  - Change: as Contracts. `optionOn` and its `accent` edge go, and a comment says why the picker isn't a Chip (a
    radio, not a button).
  - Verify: Visual check C on `settings`, in both themes (Light selected in light, Dark in dark).
- [x] 7. Round the icon buttons (≈ 14 lines)
  - Files: `components/IconButton.tsx`, `components/CategorySheet.tsx`, `app/(tabs)/budget.tsx`
  - Change: `radius.md` → `radius.pill`, and the JSDoc says "round". Budget's `edit` and the sheet's `close` lose
    `borderRadius: 0`, their comment and their `eslint-disable`.
  - Verify: `rg -n "borderRadius: 0" apps/mobile/src` finds nothing; Visual check D.

Total ≈ 381 lines (docs 22, code and tests 359).

## What moves (the PR lists this)

All of it is by design. Text and type don't change, except where listed.

- **Large buttons, 56 → 48 pill.** This covers Save (CategoryForm, income item, actual End), Add/Update, Sign in and
  delete-category's action. Each is 8pt shorter, its label 4pt higher, and everything under it 8pt higher.
  EmptyMonth's Copy keeps 48 and only rounds (radius 14 → pill).
- **Full-width text buttons, 48 → 44.** This covers Remove from <month>, Delete expense, Delete item and Use calculated
  end. Each label is 2pt higher, and anything under it 4pt higher.
- **Small filled buttons, 44 → 48.** This covers Accept and the confirm panel's Remove/Leave. Their row and card are
  4pt taller.
- **Text button padding.** Decline and the panel's Back/Close go from 12 to 8 a side (8pt narrower). Remove and Revoke
  go from 4 (min 44) to 8 (8pt wider). Retry, Check for invites and the modal Back don't move. The Back under a failed
  expense load centres its label in the row.
- **Danger looks.** Sign out (Settings, no-ledger) and Leave ledger lose their 1pt edge and take `fill`, with nothing
  moving. Delete-category's action and the confirm Remove/Leave become `fill` with a red label, where they were white
  on red.
- **Disabled.** Every disabled or busy button is at 0.4. On Base, Sign in was already 0.4, Members' Save/Invite were
  0.5, other filled buttons 0.6, and text buttons weren't dimmed (Decline was 0.6). A busy large button keeps its label
  next to the spinner.
- **Quick chips.** Each becomes a 32pt pill in a 44pt row, so the picker's two rows go from 104 to 88. Row 1's content
  is 2pt higher and row 2's 14pt higher. Inside a chip the tile is 1pt further left and the name 5pt further left (no
  edge, and a 4pt gap), and "education" is whole. Everything under the picker is 16pt higher. "N more" has no dashed
  edge, starts its icon at the left like the others, and draws its label in `text`.
- **Date chips.** Today and Yesterday lose 8pt of padding a side, so each is 16pt narrower and the date field 32pt
  wider (its calendar icon moves 32 right). The pill is 32 high inside the 48pt row. A selected chip's label is
  `accentText`.
- **The category sheet.** Rows go from a 56pt pitch to 44, so each row of chips sits 12pt higher than on Base, more
  for each row down, and the sheet is shorter.
- **Appearance.** Each option shows a 32pt pill (`fill`, or `accentTint` when chosen), and the chosen one loses its
  `accent` edge. Labels go from `bodyMedium` 15 to `label` 13, in `text` (was `muted`) or `accentText`. No box moves.
- **Icon buttons.** The radius goes from 14 to round. No box moves, and the only visible change is the web focus ring.
- **Element counts.** Each chip gains one element (the pill inside the touch area), and AppearancePicker gains three.

## Visual check (AC8, AC9; not counted in the line estimates)

**Set-up**, as in 105c's Visual check and its Deviations:

- **Servers:** the API on 3000, the web app on :8084 opened at `http://127.0.0.1:8084`, and `web-demo` on 8082, with
  the two git-ignored `.env` files copied in. Run `yarn install` in each worktree first. In a worktree,
  `DATABASE_URL_TEST` comes from the main checkout's `apps/api/.env`. Stop one server before starting the next.
- **Two sets, on one Kyiv day:**
  - `before`: a detached copy of Base (e83f8c9) on :8084, taken before slice 2;
  - `after`: the branch at slice 7.
  - If the day is after 30 November, seed `2026-12` instead. If it is also before 3 December, put the expenses on the
    1st.
- **Clear old keys first:** delete every older `snap:*` key from localStorage on 127.0.0.1:8084.
- **QA users**, created before `before` and deleted when the brief (105d, or 105e if it reuses them) is done, members
  first:
  - `claude-qa-105d`, the owner;
  - `claude-qa-105d-m`, made with `--join claude-qa-105d`;
  - `claude-qa-105d-n`, made with `--join claude-qa-105d`, then removed by the owner for the no-ledger views.
- **Seeding**, once, as the owner, through the API, after checking that the month is empty. It repeats 105c's steps:
  - income Salary €1000 and Bonus €50;
  - U, N and O (categories 0–2: rent, groceries, education) planned at €100 each;
  - expenses on the 3rd: €6 and €4 (U), €95 (N) and €109 (O);
  - an actual End of €900;
  - the invite to `-n`, made just before the no-ledger views.
- **API calls:** login sends a `deviceId` of 8–64 characters, and a DELETE with no body sends no JSON content type.
  TOTP codes come from a scratch script outside the repo, are never printed, and each sign-in waits for a fresh
  window.

**Views:** 105c's 28, plus 6 for the states this part changes, each in Light and Dark:

- **105c's 28:**
  - `home`, `budget`, `budget-ended`, `income`, `expenses`, `expenses-scrolled`, `statistics`, `statistics-menu`,
    `statistics-last3`;
  - `category` (U), `category-menu`, `category-undo`;
  - `settings`, `members-owner`, `members-confirm`;
  - `actual-end`, `actual-end-error`, `delete-category`, `expense-new`, `expense-sheet`, `expense-added`,
    `income-item-edit`, `category-form-add`;
  - signed out: `login`, `login-error`; no ledger: `no-ledger-invite`, `no-ledger`; member: `members-member`.
- **New:**
  - `login-ready`: both fields typed, so Sign in is enabled;
  - `budget-next`: the month after the seeded one, showing EmptyMonth's Copy button;
  - `category-form-edit`: U's pencil, with Save and the "Remove from <month>" text button;
  - `expense-edit`: U's €6 expense, with Update, Delete expense, U's chip selected and neither date chip selected;
  - `members-member-confirm`: as `-m`, Leave ledger tapped, with the panel's Back and Leave. Leave isn't pressed;
  - `expense-pressed`: on `expense-new`, a `pointerdown` on the "groceries" chip, the snapshot, then `pointercancel`
    (never a release, which would pick it). If the press can't be held this way, that's recorded in Deviations;
    Pressable's 0.6 is unchanged code.

**Taking them:** as in 105c's run. Each page loads in a same-origin 390×844 iframe, the same for both sets. Each
snapshot is taken in the frame with 105c's script (104h's `__snapSrc` plus columns 21–23), saved as JSON outside the
repo (system temp dir), and its key deleted. A screenshot of each view in each scheme, in both sets, goes in the PR.
On `expense-new`, an `eval` also reports, for each chip label, whether `scrollWidth > clientWidth` (truncated).

**Comparison** (Node, over the saved files; colour and shadow columns aren't diffed, except where a check below reads
them):

- **A. Same content.** On every view and scheme:
  - the width is 390;
  - the text leaves (tag, text) are equal and in order;
  - their type columns (13–19) are equal, except the three Appearance labels (15 → 13, `bodyMedium` → `label`);
  - the `a11y` arrays are equal, except that `aria-label` leaves (becomes `null`) the large buttons that set it to
    their label (Sign in, every Save, Add/Update, the delete action, Copy) and the confirm panel's Remove/Leave. Their
    names still come from the label text. Nothing else in the record changes, including roles, `aria-busy`,
    `aria-disabled` and `aria-selected`;
  - element counts change only by What moves' last line.
- **B. Buttons** (`after`): for each button label in the Inventory that the view shows, take the smallest box around
  its text with a `999px` radius:
  - for a filled button, that box is 48 high (±0.5) with padding `0px 16px`;
  - for a text button, it is 44 high with padding `0px 8px`;
  - its opacity is 1, or 0.4 for `login`/`login-error`'s Sign in, Save on every Members view (`members-owner`, `members-confirm`, `members-member`, `members-member-confirm`), and Invite on `members-owner` and `members-confirm`;
  - `danger`'s background is `fill` (light `rgb(240, 239, 244)`, dark `rgb(33, 31, 39)`) with borders
    `0px 0px 0px 0px`.
- **C. Chips and radios** (`after`): for each chip label and Appearance option, take the smallest `999px` box around
  it:
  - that box is 32 high, with borders `0px 0px 0px 0px` and a background of `fill`, or `accentTint` when selected
    (light `rgb(238, 233, 255)`, dark `rgb(36, 29, 69)`). The label's colour is `accentText` when selected;
  - the next `999px` box out is at least 44 high;
  - on `expense-new`, "education" isn't truncated in `after` and is in `before`.
- **D. Icon buttons:** every 44×44 box that had radius `14px` in `before` has `999px` in `after`, with the same count
  per view.
- **E. Everything else.** Every other leaf that moves more than 2pt is listed, by view and cause, against What moves.
  A move with no cause there is a finding, fixed before the PR.

**Checked from the code only** (listed so in the PR): the busy spinner before each label (the requests return too
fast to snapshot), the expense form's disabled chips in an ended month (the API refuses seeding there), PendingInvites
on Home and Settings (the same component as `no-ledger-invite`), and LedgerPicker (unchanged).

**Demo:** run `web-demo` in Light and Dark with the console open. Check Home, Budget, Income, Expenses, a category
page, the expense form with its sheet, an income item and Settings: no errors. Then run `yarn mobile export:web` and
`yarn mobile check-builds`, which should need no `--accept`, since no module newly reaches the demo.

**Gate B, iPhone (Expo Go):**

- a tap just above or below a chip's pill still picks it (the 44pt area);
- "education" is whole in the quick row;
- a Save shows its spinner before the label, and VoiceOver reads the button by its label;
- disabled Save/Invite on Members look off;
- the Appearance radios switch the theme;
- the danger buttons read as destructive in both themes.

## AC → evidence

| AC (brief)                                                                                     | Evidence                                                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AC1 filled 48 pill, one disabled opacity; text 44; no `ButtonSize`/`size`; no caller overrides | slices 2–3 (typecheck, both `rg`s); Visual check B                                   |
| AC2 chip 32 pill, 44 touch, `fill`/`accentTint`+`accentText`, no edge; "education" whole       | slice 5; Visual check C (incl. the truncation `eval`); Gate B                        |
| AC3 IconButton round, no radius override                                                       | slice 7's `rg`; Visual check D                                                       |
| AC4 ScreenHeader one shape                                                                     | **105e** (Open question 1)                                                           |
| AC5 UndoToast `shadow.float`, no edge, height and room from one token                          | **105e**                                                                             |
| AC6 `borderStrong` gone; inputs, menus, sheets, Members' panel                                 | **105e**; this part removes Chip's and Button's uses (slices 4, 5)                   |
| AC7 new pairs ≥ 4.5 text / 3 icons, listed in the test                                         | Inventory's contrast table; `theme.test.ts` (slices 4, 5)                            |
| AC8 before/after 390×844, light and dark; only planned moves; a11y as listed; > 2pt listed     | Visual check: 34 views × 2 schemes × 2 sets; comparisons A–E; the PR's list by cause |
| AC9 demo with no console errors; `check-builds`                                                | Visual check, Demo                                                                   |
| AC10 gates                                                                                     | every slice                                                                          |
| What: AppearancePicker; backlog                                                                | slice 6, Visual check C; slice 1                                                     |

## Not doing (YAGNI)

- The doc's `secondary` look (`fill` + `text`): no caller. All three `outlinedDanger` buttons have red labels, so they
  become `danger` (Open question 6). It comes with its first caller.
- IconButton's `raised` look: no caller.
- A Button `style` type that forbids height, radius, padding or opacity. `Pick<ViewStyle, …>` was tried in the scratch
  copy and doesn't stop a StyleSheet object with extra keys (structural typing). Slice 3's `rg` and Visual check B are
  the proof.
- Login's two links, Budget's balance line, Statistics' period button and UndoToast's Undo: these are Pressables, not
  Buttons, and the brief doesn't name them. The Undo is 105e's.
- Content-width or two-column quick chips: the 4pt gap gives "education" its room with no layout change.
- LedgerPicker's options, and the 20pt gutter against the doc's 16 (the brief's Out of scope).
- Everything in 105e (Later parts).

## Risks

1. **"education" still truncates on iOS** if Inter renders wider there than its advance widths. There is 3.3pt to
   spare. Web is proved by Visual check C's `eval` and the iPhone by Gate B. Fallback: the quick chips' tile goes from
   26 to 24 (+2pt), in a new commit recorded in Deviations.
2. **The 44pt touch area doesn't reach the pill's edges** if the caller's width lands on the inner View. The width
   is on the Pressable (the caller's `style` comes last there) and the pill stretches to it. Visual check C compares
   the two boxes' widths, and Gate B taps above and below a pill.
3. **A busy button's name on iOS** may read "In progress, Save", since the spinner now sits beside the label on the
   seven large buttons. Members' Save and Invite already work this way on Base. Gate B listens. If it reads badly, the
   spinner gets `accessibilityElementsHidden` (one line, recorded in Deviations).
4. **The red-on-grey danger reads weaker** than white on red for the one destructive confirm (the delete screen). It
   passes 4.5:1 (4.63). It is the brief's open question, so the PR's screenshots show it side by side with Base.
5. **A missed override.** Removing `size` makes typecheck find every caller, and slice 3's `rg` finds every `style`.
6. **The day.** Both sets on one Kyiv day (Set-up).
7. **Main moves:** if another PR takes 1.23.15, rebase, take main's number and bump once more (§8b).

## Open questions

The user is away and Gate A is pre-approved, so the recommended answers are used. None of them needs a product
decision the brief leaves open. The brief asks the plan to settle 2, 3 and 1. Number 1 departs from the brief's own
example split, so it's flagged.

1. **Blocking: yes (Gate A). The split (brief open question 3). Flagged: it differs from the brief's example.**
   - Recommended: two parts, as the Approach's table. 105d is Button, Chip, AppearancePicker and IconButton (≈ 381).
     105e is ScreenHeader, UndoToast, inputs, menus, sheets, Members' panel and the `borderStrong` token (≈ 340).
     Each is its own brief, PR and patch bump.
   - The brief's example ("controls, then inputs, menus, sheets and the toast") would make 105d about 575, over the
     limit, because ScreenHeader alone is about 190.
   - Assumed: as recommended. The 105e brief is written from Later parts after this PR merges.
2. **Blocking: no (the brief gives it to the plan). Does today's filled red `danger` stay (brief open question 1)?**
   - Recommended: **it goes.** The doc has three button looks and no filled red. Delete-category's action and the
     confirm panel's Remove/Leave take the doc's `danger` (`fill` + red label, 4.63:1 light, 7.13:1 dark), like Sign
     out and Leave ledger.
   - That leaves one red look for every destructive action, and keeps violet as the only filled colour.
   - The cost is a quieter final "Remove" (Risk 4). Keeping it would add a fourth look (`dangerFilled`, about 4 lines)
     that the doc doesn't have.
3. **Blocking: no. The new name for `accentText` (brief open question 2).** Recommended: **`accentLabel`**, "a label
   in `accent`". The other two text looks (`dangerText`, `mutedText`) keep their names, because their colours don't
   collide with a token. The alternative is renaming all three to `…Label`, which is 12 more lines for consistency
   alone.
4. **Blocking: no. The one disabled opacity.** Recommended: **0.4**, login's value. It is unlike a press (0.6), so a
   disabled button never looks pressed. The brief says the 0.6 default goes. It applies to every look, so text buttons
   now dim while their screen is busy.
5. **Blocking: no. One spinner placement.** Recommended: **before the label** for every filled look, as the medium
   and compact buttons do on Base. The label stays visible, and the large buttons' `accessibilityLabel={label}`
   workaround goes (A's listed `aria-label` change). Replacing the label everywhere would hide the label on four more
   buttons and need the workaround on all of them.
6. **Blocking: no. `secondary` isn't built.** No caller draws `fill` + `text` today (Not doing).
7. **Blocking: no. Text looks' side padding is 8 (`space.sm`).** That is Retry's and Check for invites', so those
   two and their `marginLeft: -space.sm` alignment stay put. 12 would move four more buttons.
8. **Blocking: no. Room for "education":** the tile-to-name gap goes from 8 to 4 in every chip (Inventory's maths).
   The alternatives are two columns (the form 52pt taller) or content-width chips (rows change with names).
9. **Blocking: no. Chip rows have no row gap**, so the 44pt touch areas meet and the pills sit 12pt apart. Keeping
   the 8pt gap would put 20pt between the pills.
10. **Blocking: no. "N more" is a plain chip** (the brief): `fill`, the `more` icon in `muted`, and its label in `text`
    (was `muted`), starting at the left like its neighbours.
11. **Blocking: no. AppearancePicker's labels take Chip's `label` role** (13, was 15) and colours (`text`/
    `accentText`). It draws its own pill instead of sharing Chip's (Approach's alternative).
12. **Blocking: no. LoadFailed's Back**, with `failedBack` gone (the brief), is a centred, full-width text button
    under the error. Keeping it at the left would need `alignSelf: 'flex-start'` and the `-space.sm` margin, which is
    `failedBack` again.

## Follow-ups

- The category tiles' initials are at least 3.30:1 on `fill` and 3.72:1 on white in light, under 4.5 if read as
  text. They're a graphic next to the name today, but not briefed.
- From 105c: LedgerPicker's options sit 20pt in, and the gutter is 20 against the doc's 16.
- From 104e: the expense form's Back stays enabled during a save.

## Later parts (outline; the 105e brief is written after this PR merges)

- **105e, the header, the toast, inputs, menus and sheets (≈ 340 lines, measured in the same scratch copy):**
  - **ScreenHeader, one shape (≈ 190):**
    - `ScreenHeader({ back?: { label: string; onPress: () => void; disabled?: boolean }; title?: ReactNode;
trailing?: ReactNode; dividerStyle?: object })`. With no `back`, the leading button is Home (the month tabs).
      A string `title` is a centred `title` header; the month tabs pass `<MonthSwitcher …/>`.
    - The row is `[side][title flex 1][side]`, and each side is at least `size.iconButton` wide, so the title sits on
      the screen's centre. The trailing side shrinks for the category page's compact total.
    - The header spans the screen with the gutter inside (`marginHorizontal: -space.xl`, `paddingHorizontal:
space.xl`), as 105c's scroll views do. HeaderDivider then draws `left: 0, right: 0`, and its −20 goes. The 52pt
      spacer, `modalBack` and the modal's `marginBottom` go too.
    - Back is a round IconButton. Its icon moves 12pt right on the category page and Members, and the forms' text
      "Back" becomes the icon.
    - The category page's Back is named "Back to November" (a listed label change), since "November" is no longer
      shown. The rest are "Back".
    - 11 callers.
  - **UndoToast (≈ 45):**
    - `size.toast: 56` joins `theme.ts` and the doc's size line. UndoToast exports `toastRoom = space.xxxl +
size.toast + space.lg` (104). Budget's `toastRoom` and the category page's `paddingBottom` read it, and their
      two `eslint-disable`s go.
    - The toast takes `left/right: space.xl`, `bottom: space.xxxl` and `boxShadow: shadow[scheme].float`, and loses
      its edge.
  - **Inputs (≈ 35):**
    - The 8 input looks (actual End, the expense form and its name field, income item, login ×2, Members ×2,
      AmountFields, CategoryForm, DateField) take `fill`.
    - Each keeps a 1pt border, also in `fill`, because TextField shows focus by turning the border `accent`. The
      border is invisible until focus and no content moves. TextField's JSDoc says so.
    - Login's 52pt fields become `size.control` (the doc's 48).
    - No input sits on a same-colour surface, so none keeps a hairline. No icon sits on a field's `fill` in a
      `faint` colour: the swap icon is between the fields, and DateField's calendar is `text`.
    - `muted` on `fill` (placeholders, ₴/€) moves to `textPairs`.
  - **Menus (≈ 40):** Statistics' period menu, the category ⋯ menu and NameCombobox's list lose their edge and take
    `shadow[scheme].float`. `LIST_BORDER` and the list's `+ 2` go.
  - **Sheets (≈ 6):** CategorySheet's and DateField's iOS sheet lose their top edge (they sit on the backdrop).
  - **Members' panel (≈ 4):** a `hairline` edge, since it's a `surface` box on a member's `surface` card.
  - **`borderStrong` (≈ 9):** the token leaves both palettes and the header comment.
  - **Docs and backlog (≈ 15).**
  - **Its Gate A questions:**
    - **Product decision, flagged:** in dark, shadows are off (the doc), so the toast and the two menus are `surface`
      over `surface` cards with no edge. Their outline disappears over a card. Options: accept, or a dark `float` of
      `0 0 0 1px` in `hairline`, a ring with no layout change (a doc change).
    - The brief says both "the panel floats on `shadow.float`" and "gets a `hairline`". The recommendation is the
      hairline only: the panel sits in the flow, inside a card, and a float shadow would spill over the next card.
    - Login's fields at 48.
    - The category Back's name.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

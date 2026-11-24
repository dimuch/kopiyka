# Plan: Put the shared components on design tokens (part 2 of 103)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/design-tokens-components
Base: origin/main (b70a5d4, version 1.17.2)

## Approach

The 22 files move onto `space`, `radius`, `size` and `text` from `apps/mobile/src/theme.ts`. They follow the 103
plan's snapping rules (`docs/features/103-design-tokens/plan.md`, Contracts → Snapping rules), with the four
exceptions listed under Contracts. Each slice deletes its files from `notOnTokensYet`, so `yarn lint` proves that slice
is complete, as in 103. The only new token is a `text.input` role at 16pt for typed text, which the brief's open
question asks for. The slices follow the brief's "Where it shows" groups, so each one is checked on its own screens.

The guard finds **152 literals** in the 22 files. I counted them by running the rule's selector with `eslint --rule`
over the 22 files. That's about 385 changed lines, under the ~400 limit, so this is one PR.

Alternatives considered:

- **Allowlist `fontSize: 16` on each input instead of an `input` role.** It's the smaller change now. But 103c has
  four more screens with 16pt inputs (expense note, income item, members ×2), plus login at 17, and the three files
  here make 7 callers. 105 also needs one place to set the input size in Inter. So the role wins on the rule of three.
- **Snap TabBar's item `padding: 5` to `xs` (4), as the rules say.** Rejected: the file copies expo-router's
  `BottomTabItem.js` (`padding: 5`, checked in `node_modules/expo-router/build/react-navigation/bottom-tabs/views`),
  so its icons line up with the library bar on the tab pages. At 4 they would jump 1pt on every push.

## Contracts

- DB / API: none.
- App, `apps/mobile/src/theme.ts`: one new role in `text`, after `caption`:

  ```ts
  /** Typed text in a field: iOS Safari zooms into an input under 16px. Fields are single-line and centred by their
   *  height, so no lineHeight. */
  input: { fontFamily: fonts.body, fontSize: 16, letterSpacing: -0.2 },
  ```

  It's the brief's recommended role without the 22 line height (Open question 1). Callers in this PR:
  `AmountFields` (input and the ₴/€ symbol), `CategoryForm` (both inputs and the € symbol) and `DateField` (its date
  text, which sits in an input-sized box beside the amount fields). Where today's face is `bodyMedium`, it stays as a
  `fontFamily` override after the spread, per the snapping rules. 103c's inputs will use the same role.

- `docs/design/design-system.md`, Type table: one row: role `input`, size/line `16 / —`, weight 400, tracking −0.2, use "typed text (min 16)".
  Under the table, one sentence: "`input` sets no line height, because fields are single-line and centred by their
  48pt height. Below 16px, iOS Safari zooms into a field on focus." The cell is kept short so Prettier doesn't reflow
  the table.
- Lint, `apps/mobile/eslint.config.js`: each slice removes its paths from `notOnTokensYet`. Slice 5 leaves the 8
  103c screens and changes the comment to "brief 103c empties this list".
- **Exceptions to the snapping rules.** Each is allowlisted with `// <reason>` and then
  `// eslint-disable-next-line no-restricted-syntax`, both on the lines above:
  - `TabBar` `item.padding: 5`: "expo-router's BottomTabItem pads 5, so these icons line up with the library bar on
    the tab pages."
  - `TabBar` badge `fontSize: Math.floor((BADGE_SIZE * 3) / 4)` and `lineHeight: BADGE_SIZE - 1`: "Badge.js sizes
    its text from the badge: layout maths, no role." The reason is repeated above each of the two disables
    (conventions §7: a reason directly above each). `borderRadius: BADGE_SIZE / 2` becomes `radius.pill`, which looks
    the same because the radius clamps to half the height. `paddingHorizontal: 4` becomes `space.xs`.
  - `CategoryTile` `borderRadius: size * 0.3` and `fontSize: size * 0.43`: "The corner and letter scale with the
    tile (26–52pt): tile maths, no token." The tile is 26 in `CategoryPicker`, 28 in `CategorySheet`, 40 by default
    and 52 on the category screen. Both styles are inline objects in `style={{ }}` attributes. That's JavaScript, not
    JSX children, so `//` comments are valid inside them, and Prettier breaks each object onto lines. The reason and
    disable go above each of the two lines.
  - `MonthSwitcher` eyebrow: `{ ...text.caption, color, letterSpacing: 0.5 }`, with the reason "All capitals
    (`monthCaption` upper-cases the title) need positive tracking, and the scale has no overline role (brief 105
    decides)." Caption's 0 would tighten "INCOME ’26" by about 5pt on four tabs for no gain.
  - `DemoStrip` link `lineHeight: 44` → `size.iconButton`, after the `label` spread. It's the link's 44pt touch
    target, and that token means exactly that, so it isn't allowlisted.

  After slice 5, `rg -n 'disable-next-line no-restricted-syntax' apps/mobile/src` lists 7 entries: Budget's 1 from
  103 and these 6.

- **Size tokens** (103 rule): `width`/`height`/`minHeight`/`minWidth` 44 → `size.iconButton`, 48 → `size.control`.
  Not guarded, but in the rules. Heights 56 (toast, Save) and 4/40 (sheet handle) stay.
- **Money (AC3):** every figure in these files already has tabular digits, and the moves keep them:
  - `HomeCards` figure: `title` with `fontVariant`
  - `CompactTotal` `spent`: `heading` with the display face and `fontVariant`
  - `CompactTotal` `budget`: `label` with `fontVariant`
  - the amount inputs: `input` with `fontVariant`

  No other component prints money. The Undo messages are names, Notion's status is counts, and `PendingInvites` shows
  ledger names.

- Reuses: `fonts`, `useThemedStyles`, the 103 tokens and lint rule, and the 103 snapshot recipe (brief Notes).
- New dependencies: none.

## Version

Bump: patch — 1.17.2 → 1.17.3
Why: §8b `patch` ("styling, behaviour-preserving refactor"). Shipped app styles shift slightly. There's no new
capability, and no API, schema or connector change.

## Slices

Before slice 1, take the **before** set (Visual check below) on Base, with no code changed yet. Slice 0 only touches
version numbers.

- [x] 0. Bump version to 1.17.3
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.17.3
- [x] 1. Put the tab bar, month switcher, header buttons and Home cards on tokens (~80 lines)
  - Files: `src/components/{TabBar,MonthSwitcher,HomeButton,AddExpenseButton,HomeCards,CollapsingSummary,ReorderList,CategoryTile}.tsx`,
    `eslint.config.js` (−8 entries)
  - Change: the snapping rules, with these specifics:
    - Icon buttons go to `size.iconButton` + `radius.md`.
    - `MonthSwitcher` `month` → `title`, and `eyebrow` as in Contracts.
    - `HomeCards` `figure` → `title` + tabular (20 → 22), `cardTitle` → `body` + `bodyMedium`, card radius 22 → `lg`.
    - `CompactTotal` `spent` → `heading` + display face + tabular. `label` and `budget` → `label` (the `budget` style
      keeps tabular). `marginRight` 6 → `sm`.
    - `ReorderList` `held` radius → `md`.
    - TabBar and CategoryTile allowlists as in Contracts. CategoryTile's reason is "The corner and letter scale with
      the tile (26–52pt): tile maths, no token."
  - Verify: `yarn lint` passes with the 8 files guarded. Look at Home, Budget and Expenses in the browser, plus a pushed
    page's tab bar with the invite badge.
- [x] 2. Put the empty-month, load-error, Undo and demo strips on tokens (~70 lines)
  - Files: `src/components/{EmptyMonth,LoadError,UndoToast}.tsx`, `src/demo/DemoStrip.tsx`, `eslint.config.js` (−4)
  - Change: the snapping rules, with these specifics:
    - `EmptyMonth`: card radius 22 → `lg`, button radius 16 → `md`, `buttonText` → `bodyStrong` (16 → 15).
    - `LoadError`: `message` → `label` + body face (14 → 13).
    - `UndoToast`: radius 18 → `lg`, and the 18 paddings → `lg`.
    - `DemoStrip`: `text` → `label` + body face, and `link` → `label` + `bodySemi` + `lineHeight: size.iconButton`.
  - Verify: `yarn lint`. Check an empty month (a future month on Budget), the Undo toast after a delete, and the demo
    Home with its toast.
- [x] 3. Put the expense form's fields on tokens, with a 16pt input role (~110 lines; 103's token slices ran about
      35% over their estimates, so if this one passes ~150, commit "Add a 16pt input text role" (`theme.ts` and the
      spec row) first on its own)
  - Files: `src/theme.ts`, `docs/design/design-system.md`,
    `src/components/{AmountFields,CategoryPicker,CategorySheet,DateChips,DateField}.tsx`, `eslint.config.js` (−5)
  - Change: add the `input` role and the spec row (Contracts). Then the snapping rules:
    - Inputs and symbols → `input`. The amount input keeps `bodyMedium` and tabular digits, and `DateField` text keeps
      `bodyMedium`.
    - Field and chip boxes → `size.control` + `radius.md`.
    - `CategorySheet`: top radii 26 → `xl`, handle radius → `pill`, `title` → `heading` + display face (18 → 17),
      close `marginRight: -space.sm` (−10 → −8).
    - `DateField`'s iOS sheet: radii 26 → `xl`.
    - `DateChips`' `chipText` and `CategorySheet`'s `itemText` → `label` (14 → 13).
  - Verify: `yarn lint`. On the expense form in the browser, run
    `[...document.querySelectorAll('input:not([type=date])')].map((i) => getComputedStyle(i).fontSize)`. Every entry
    is `"16px"` (AC4). Open "N more" to see the CategorySheet.
- [x] 4. Put the category form on tokens (~32 lines)
  - Files: `src/components/CategoryForm.tsx`, `eslint.config.js` (−1)
  - Change: the snapping rules, with these specifics:
    - Both inputs and the € symbol → `input` (`bodyMedium` kept on the inputs). `amount` `paddingLeft` → `xxxl`.
    - `caption` → `label` + body face. `label` → `label` + `bodySemi`. `error` → `label`.
    - Save keeps `minHeight: 56`. Its radius 18 → `lg`, and `primaryText` → `bodyStrong` (16 → 15).
    - `body` `paddingBottom` 40 → `huge`.
  - Verify: `yarn lint`, and the same `fontSize` check on `/category-form` (both inputs 16px, AC4).
- [ ] 5. Put the Settings pickers, invites and Notion panel on tokens (~92 lines)
  - Files: `src/components/{AppearancePicker,LedgerPicker,PendingInvites,NotionSyncPanel}.tsx`, `eslint.config.js`
    (−4 entries, and the list comment says only 103c is left)
  - Change: the snapping rules, with these specifics:
    - Group radii 18 → `lg`, option radii 14 → `md`.
    - Accept and Sync buttons: radius 22 on 44 → `pill`.
    - `NotionSyncPanel` card radius 22 → `lg`, and `result` gap 2 → `xxs`.
    - 14pt texts → `label`, keeping today's face.
  - Verify: `yarn lint`. `notOnTokensYet` now holds exactly the 8 103c paths (AC2). Then take the full **after** set.

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, without piping. In this worktree,
export `DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. No new module reaches the
demo (only `@/theme` names change), so `check-builds` needs no `--accept`.

**What moves in 103b** (the PR lists this):

- **Type >1pt:** the Home card figure goes 20 → 22 (`title`, the brief's known case).
- **Type −1pt:**
  - 16 → 15: EmptyMonth's button text and CategoryForm's Save.
  - 18 → 17: CategorySheet's title and CompactTotal's figure.
  - 14 → 13: LoadError, the date chips, CategorySheet's items, CategoryForm's caption, CompactTotal's label and
    budget, LedgerPicker's owner, PendingInvites' failure line and NotionSyncPanel's texts.
  - The inputs stay at 16.
- **Spacing ±2pt:**
  - 18 → 16: the HomeCards and EmptyMonth `paddingHorizontal`, UndoToast's left and Undo padding, the refused text's
    right padding, and PendingInvites' Accept.
  - 14 → 16: CategorySheet's `sheet.gap` (×3 between its four children), EmptyMonth's gap, the name input's and DateField's padding (text 2pt right), the amount input's right
    padding, the date chips' padding, LedgerPicker's rows, PendingInvites' card padding, and NotionSyncPanel's
    vertical padding.
  - 6 → 8: CategoryForm's field gap, CategoryPicker's "more" gap, CompactTotal's label margin, and the
    AppearancePicker and LedgerPicker gaps.
  - 10 → 8: the sheets' `paddingTop`, CategorySheet's item padding and gap, the refused toast's `paddingVertical`, and
    NotionSyncPanel's gap.
  - −10 → −8: CategorySheet's close margin.
- **Radius:**
  - 22 → 20: the Home, EmptyMonth and Notion cards.
  - 18 → 20: the toast, the Appearance, Ledger and Invites cards, and Save.
  - 16 → 14: the EmptyMonth button.
  - 12 → 14: the icon buttons (press and focus only).
  - 26 → 28: both sheets.
  - The `pill` swaps look the same.
- **Line heights:** caption +0.4, label +1.1 (−0.2 from 14pt), body +0.5 (−0.8 from 16pt), Bricolage heading +0.4,
  title +1.6 (+4 on the Home figure). The input role keeps its natural line height.
- **Tracking:** the role values (−0.1 to −0.8). The month eyebrow keeps +0.5.
- **Sums over 2pt** (estimated; the developer records the measured values under Deviations):
  - Each Home card is about 4.5pt taller, so the grid's 3 rows push what's below them (Notion panel or its error)
    about 13.5pt down.
  - On the category form, Save sits about 6pt lower.
  - The date field is 8pt narrower (each chip gains 4pt).
  - CategorySheet grows about 4.5pt.
  - EmptyMonth's card grows 2–4.5pt.
  - The refused two-line toast is 3pt shorter.
  - With an invite showing, Settings' pickers sit about 5–7pt lower.

**Visual check** (AC5, not counted in the line estimates). This uses the 103 recipe from the brief's Notes.

**Before set: already taken.** The orchestrator took it on Base: 34 snapshots, keys `snap:before:b:*`, on :8081 (app)
and :8084 (demo). They include the `CompactTotal` header (category screen scrolled, 390×300) and the Undo toast on
Budget. Not in it: the Settings-with-invite view (PendingInvites, the tab-bar badge, LedgerPicker with two ledgers).
That needs a second test account to send an invite, and it's open for Gate A (Open question 6). Steps 1–4 below are
the recipe for the **after** set on the same ports and data. Don't delete the `snap:before:b:*` keys.

1. Start `api` and `web` (port 8081) from `.claude/launch.json` in this worktree, and the demo on **8084** (`web-demo`
   with `--port 8084`; `launch.json` says 8082). These are the ports the before set used. The snapshots live in each
   origin's local storage.
2. Open the in-app browser at 390×844 and sign in as the local QA user. Get the TOTP code from a scratch script, and
   don't print the secret.
3. Use the same data and month the before set used:
   - ≥6 categories in the current month, so the expense form shows "N more" (`QUICK_COUNT` is 5)
   - an expense
   - an empty future month
   - a pending invite to the QA user from a second local user, for PendingInvites and the tab-bar badge. This one is
     only if Gate A settles Open question 6 that way.
4. Screens, each in Light and then Dark:
   - the six tabs
   - the expense form and its CategorySheet
   - the category form
   - the Undo toast after deleting an expense (then Undo)
   - an empty month on Budget
   - the category screen scrolled until `CompactTotal` shows (its only home)
   - Settings with an invite, and again after accepting it (LedgerPicker with two ledgers). This depends on Open
     question 6.
   - the demo's tabs
5. Compare each pair against the list above. Anything else is a bug in the slice that caused it. The screenshots go
   in the PR, not the repo.

At Gate B, the user checks on iPhone in Expo Go: the tab bar with its badge (a `radius.pill` on a `Text`), the
expense form's inputs (text placement, with no line height), and DateField's native calendar sheet (iOS only).
NotionSyncPanel is hidden for an unconfigured ledger, and prod has no Notion sync. It's checked only where it shows.
Otherwise its moves come from the diff.

## AC → evidence

| AC                                              | Evidence                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 no number literals in the 22 files          | Slices 1–5: `yarn lint` green with each file off the list. `rg -n 'disable-next-line no-restricted-syntax' apps/mobile/src` → 7 entries, each with a reason above                                                                                                                                                                    |
| AC2 `notOnTokensYet` = only the 103c screens    | Slice 5: the list holds exactly the 8 `src/app/*` paths (category-form, category/[categoryId], delete-category, expense, income-item, login, members, no-ledger)                                                                                                                                                                     |
| AC3 tabular digits on every money figure        | Slices 1 and 3–4: HomeCards figure, CompactTotal `spent`/`budget`, both amount inputs keep `fontVariant: ['tabular-nums']` (Contracts → Money). Visual: Home figures, category `CompactTotal`                                                                                                                                        |
| AC4 inputs ≥16px on web                         | `text.input` is 16. Slices 3–4 Verify: `getComputedStyle` → `"16px"` for every text input on the expense form and `/category-form`                                                                                                                                                                                                   |
| AC5 before/after snapshots, only listed changes | Before set already taken on Base by the orchestrator (34 snapshots, `snap:before:b:*`, :8081/:8084, incl. `CompactTotal` at 390×300 scrolled and the Undo toast on Budget). The after set follows slice 5, light and dark. Settings with an invite isn't in the baseline (Open question 6). "What moves" goes in the PR for approval |
| AC6 demo, no console errors                     | Slices 2 and 5: the demo's tabs in Light and Dark with the console open. No red screen, no errors                                                                                                                                                                                                                                    |
| AC7 gates                                       | Every slice                                                                                                                                                                                                                                                                                                                          |
| Open question (inputs at 16)                    | Slice 3: `input` role in `theme.ts` and the spec                                                                                                                                                                                                                                                                                     |

## Not doing (YAGNI)

- The 103c screens, `theme.dangerText`, and `CategoryInMonth`'s `spinnerMargin` (the 103 outline listed it here).
  The lint rule doesn't flag that default parameter, and its caller is the category screen, so it goes with 103c.
- Shared `Card`/`Button`/`IconButton` (brief 104), colours, Inter and shadows (brief 105).
- Any token for icon sizes, tile sizes, the toast's `bottom: 32`/`minHeight: 56`, or the divider's `-20` bleed. They
  aren't guarded keys.
- The hidden web `<input type="date">` in `DateField` (Follow-ups).

## Risks

- **`radius.pill` (999) on the badge `Text` on iOS.** Views got `pill` in 103, but no `Text` did. Slice 1 is
  checked on iPhone at Gate B. If it renders wrong, the badge goes back to `BADGE_SIZE / 2`, allowlisted.
- **The Home figure at 22pt with `numberOfLines={1}`.** About 137pt of text width (4pt more than today, from the
  padding). A large amount fits, but a long username on the Settings card (13+ characters) may now truncate. The slice
  1 check shows the real width. If it truncates, the fallback is Open question 2's alternative.
- **The sums over 2pt** (Home grid, category form, date field). Slice 1 and slice 4 measure them. If they're too much,
  the tie rule (14 → 16) is the place to change, as in 103.
- **Snapshots on a different origin or with different data** give false differences. The after set uses the before
  set's ports (8081, 8084) and data.
- **Main moves:** if another PR takes 1.17.3, rebase, take main's number and bump once more (§8b).

## Open questions

1. **Blocking: yes (Gate A). The `input` role's shape.**
   - Recommended: 16pt, `body` face, −0.2 tracking, **no line height**.
   - The brief suggests 16 / 22. I left the line height out because every field here is a single-line `TextInput` in
     a 48pt box that centres its text. A `lineHeight` adds nothing there.
   - On iOS, a `lineHeight` on a single-line `TextInput` is known to shift its text. I haven't checked that on
     RN 0.88, and leaving it out avoids the risk.
   - 103c's inputs (expense note, income item, members, login) would use the same role, and 105 swaps the face.
   - With 16 / 22, the slices stay the same: one line in `theme.ts` and the spec, plus an iPhone check of the inputs
     in slice 3.
   - Assumed: no line height.
2. **Blocking: yes (Gate A). Approve the Home card figure 20 → 22 (`title`).** The brief names it. The alternative is
   to keep 20 allowlisted until 105. Assumed: approve.
3. **Blocking: no.** The MonthSwitcher eyebrow keeps `letterSpacing: 0.5`, allowlisted (Contracts), rather than
   caption's 0.
4. **Blocking: no.** TabBar's item `padding: 5` is allowlisted to match the library bar, instead of following the
   "odd 5 → `xs`" snapping rule.
5. **Blocking: no. Two names in the brief point elsewhere:**
   - AC5's "Budget category sheet" is `CategorySheet`, which only opens from the expense form's "N more". Budget has
     no sheet.
   - AC3's "collapsed Expenses header" example: Expenses uses only `HeaderDivider`. `CompactTotal`, the collapsing
     money, shows on the category screen, so the check looks at it there.
   - Assumed as written in the plan.

6. **Blocking: yes (Gate A). The Settings-with-invite view isn't in the before baseline.** It covers PendingInvites,
   the tab-bar badge, and LedgerPicker with two ledgers. Taking it needs a second test account to send the QA user an
   invite, and then a before snapshot on Base (for example from the main checkout) before slice 5 lands. The other
   option is to check those three components from the diff and on iPhone at Gate B, with no before/after pair. No
   assumption made: the user decides.

## Follow-ups

- `DateField`'s hidden web `<input type="date">` has the browser's default font size. It's focused only where
  `showPicker` is missing, and then iOS Safari might zoom. It's not a text input and not in AC4. Check it when the PWA
  briefs test iOS Safari.
- 103c: `CategoryInMonth`'s `spinnerMargin` default 32 → `space.xxxl`, with its caller passing `space.xxl`.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

After the skeptic (approve with edits):

- CategoryTile's reason now says 26–52pt (the category screen passes 52). It's changed in Contracts and in slice 1.
- Both CategoryTile allowlists sit in inline `style={{ }}` objects. The plan says `//` comments are valid there, and
  that a reason goes above each disable, the TabBar badge's two included.
- Slice 3 may commit the `input` role on its own first if it passes ~150 lines.
- What moves now lists CategorySheet's `sheet.gap` 14 → 16 (×3).
- AC5 records that the before set is already taken (34 snapshots, `snap:before:b:*`). The Settings-with-invite view
  is missing from it, and is Open question 6 for Gate A.

The slices and the version are unchanged.

## Gate A (2026-11-24)

Approved by the user: the plan; the 16pt `input` role with no line height; the Home card figure 20 → 22; and the
ledger picker / pending invites checked from the code diff only (Open question 6), listed as unchecked in the PR.

# Plan: Put the remaining screens on design tokens (part 3 of 103)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/design-tokens-screens
Base: origin/main (4e1ad93, version 1.18.0)

## Approach

The 8 screens, `theme.dangerText` and `CategoryInMonth`'s spinner default move onto `space`, `radius`, `size` and
`text` from `apps/mobile/src/theme.ts`. They follow the 103 snapping rules (`docs/features/103-design-tokens/plan.md`,
Contracts → Snapping rules), the 103b `input` role and the 103b allowlist style. As in 103/103b, each slice deletes its
files from `notOnTokensYet`, so `yarn lint` proves the slice is complete. There is no new token, role or component.

**Split (size).** I ran the rule's own selector over the 8 files with `eslint --rule`. It finds **183 literals on 148
lines** (category 41, Members 45, expense 25, income item 20, login 19, delete category 17, no-ledger 9, category form 7).
For calibration, 103b's 152 literals on 145 lines took 417 changed lines in `src`, plus its lint config. I added up
this brief's edits one by one: the literal lines, the `size` swaps on unguarded `height: 44/48` lines, the imports,
Prettier breaking the long one-line styles (`back`, `more`, `dayHead`, `demoLink`, `check`, `remove`), the 3
allowlists, and renaming the local `text` names that would hide the imported `text` (both 103 and 103b needed a
follow-up commit for that: 6aa6c0e, 285021f). That comes to **about 480 changed lines**, so I propose the brief's
split into two sequential briefs with no stacking:

| Brief          | What ships                                                                                             | ≈ lines |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| 103c (this PR) | category screen, category form, delete category, expense, income item, `dangerText`, `CategoryInMonth` | 270     |
| 103d (next)    | login, Members, no-ledger; empties `notOnTokensYet` and drops it from `ignores`                        | 210     |

103 slices landed about 35% over their estimates, and 103b about 15% over. At +35%, 103c is about 365 lines and
103d about 285. Both stay under 400. As one PR it would be about 650. The 103d slices are written out under "Later part"
below. If Gate A keeps one PR, they move into Slices unchanged, with one version bump.

**Brief 107 check.** 107 (#151–#153, now on Base) changed `expenses.tsx`, `income.tsx`, `monthSummary.ts` and two
colours in `theme.ts`. It didn't touch any of these 8 screens, `dangerText`, `CategoryInMonth` or the lint config.
`git diff ae0e081 4e1ad93 --stat` shows none of them. One assumption did change. 107 turned the Expenses total
(`amountLg`) into three `text.amount` figures, so **`amountLg` has no caller on Base**. The category hero becomes its
only caller, and it no longer has an Expenses total of the same size to match (Open question 2).

Alternative considered: **one PR at about 480 lines (up to about 650 if it overruns like 103).** It saves one plan,
review and baseline cycle, and it's all mechanical. But the brief and `kopiyka-plan` set the limit at about 400, and
103's overruns make the real size likely higher. The split follows the brief's own example (the money screens first).

## Contracts

- DB / API / DTOs: none.
- `theme.ts`: `dangerText(colors)` → `{ ...text.body, fontFamily: fonts.bodyMedium, color: colors.danger }`. The face
  is kept. It gains `lineHeight` 20 (+0.5 against Plex's natural 19.5) and tracking −0.2. Its callers are the category
  ⋯ menu, the category form's Remove, the expense form's Delete, the income item's Delete, and Members' Remove/Revoke.
  Members is a 103d screen, so in this PR its text moves by that same small amount (listed below).
- `CategoryInMonth`: `spinnerMargin = space.xxxl` (32, same value), with the prop comment saying "`space.xxxl` in the
  modals, `space.xxl` under the Category screen's header". The category screen's `NotInMonth` passes
  `spinnerMargin={space.xxl}` (24, same value). The prop stays a `number`. There are two values and two kinds of caller,
  so the brief keeps the prop.
- **Shared modal header** (category form, delete category, expense, income item; four copies, all handled the same):
  - `screen`: `paddingHorizontal: space.xl, paddingTop: space.sm`
  - `header`: `marginBottom: space.sm`
  - `back`: `height: size.iconButton, marginLeft: -space.sm, paddingHorizontal: space.sm`
  - `backText`: `{ ...text.body, fontFamily: fonts.bodyMedium, color }`
  - `title`: `{ ...text.heading, fontFamily: fonts.display, color }`, which takes it from 18 to 17. The `{ width: 52 }`
    spacer isn't a guarded key, so it stays.
  - It isn't extracted into a component: `ScreenHeader` is brief 104.
- **Text roles used** (103 rules; "+ face" means today's face stays as a `fontFamily` override after the spread):
  - `bodyMedium` 15 → `body` + face
  - `bodySemi` 15/16 → `bodyStrong`
  - 13 → `label` (+ face when not `bodyMedium`)
  - 14 → `label` + face
  - 12 → `caption`
  - display face 18 → `heading` + face
  - 24 → `title`
  - 28 and 40 → `display`
  - money at 32 → `amountLg`, and money at 15 → `amount`
  - typed text → `input`
- **Allowlists**: two in this PR, and one more in 103d. Each has the reason on the line above
  `// eslint-disable-next-line no-restricted-syntax`.
  - Category screen `content`: the object is broken onto lines so the disable covers only `paddingBottom: 104`. The
    reason is copied from Budget: "UndoToast's bottom 32 + height 56 + a 16pt gap: toast clearance, not a step on the
    scale." `UndoToast` still has `bottom: 32` and `minHeight: 56`.
  - Category screen `dayLabel`: `{ ...text.label, fontFamily: fonts.bodySemi, color, letterSpacing: 0.5 }`. The reason
    is "All capitals (`dayLabel` upper-cases the date) need positive tracking, and the scale has no overline role
    (brief 105 decides)." That's the MonthSwitcher eyebrow's precedent from 103b.
  - 103d: login `passwordInput` keeps `fontSize: 26, letterSpacing: 8` (Open question 3).

  After this PR, `rg -n 'disable-next-line no-restricted-syntax' apps/mobile/src` lists 9 entries (the 7 from 103 and
  103b, plus these 2).

- **Size** (103 rule): `height`/`minHeight`/`minWidth` 44 → `size.iconButton` and 48 → `size.control`. The 52pt login
  input, the 56pt primary buttons, `minWidth: 200` and `right: 20` stay: they aren't control heights or guarded keys.
- **Money (AC3)**:
  - category `total` → `amountLg`, and `itemAmount` → `amount`
  - category `small` (the ₴ line under each expense) → `caption` + tabular
  - category `caption` → `label` + body face + tabular: it prints each day's € total and the "≈ ₴… at entry-day rates"
    line. On its other lines, tabular digits change nothing (below).
  - The amount inputs are `AmountField`s, already done in 103b.
  - Amounts inside sentences aren't figures, so they get no `fontVariant`: the delete warning's "(€x)", the expense
    form's "Added … · €x · date" and login's "€5 a month". IBM Plex Sans digits are all 600 units wide (103 measured
    this), so they line up anyway (Open question 5).
- **Local `text` renames** (mechanical, a slice of their own): locals and parameters named `text` in files that will
  import `text` from `@/theme` become `message` (error strings) or `typed` (typed input). The places:
  - `delete-category.tsx` `remove()`'s `const text`
  - `expense.tsx`: `showError(text)`, `typeAmount(currency, text)`, and the name field's `(text) =>`
  - `income-item.tsx`: `edit(set, text)` and two `(text) =>`

  Members' are in 103d. Nothing else changes.

- Reuses: `fonts`, `useThemedStyles`, the 103 tokens and rule, the 103b `input` role, and the 103b snapshot recipe.
- New dependencies: none.

## Version

Bump: patch — 1.18.0 → 1.18.1
Why: §8b `patch` ("styling, behaviour-preserving refactor"). Shipped app styles shift slightly. There's no new capability,
and no API, schema or connector change. 103d bumps patch again.

## Slices

Before slice 1, the orchestrator takes the **before** set on Base (see Visual check). Slice 0 only touches the version.

- [x] 0. Bump version to 1.18.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.18.1
- [ ] 1. Rename local text names that would hide the text tokens (~26 lines)
  - Files: `src/app/{delete-category,expense,income-item}.tsx`
  - Change: the renames in Contracts. There's no token change yet.
  - Verify: gates. `rg -n "(const|let) text\b|\(text\b|, text\b" <the 3 files>` finds nothing.
- [ ] 2. Put the category screen on design tokens (~110 lines)
  - Files: `src/app/category/[categoryId].tsx`, `src/components/CategoryInMonth.tsx`, `eslint.config.js` (−1)
  - Change: the snapping rules, the spinner prop (Contracts) and the two allowlists. Specifics:
    - `header` `paddingBottom` 6 → `sm`, `content` gap 14 → `lg`, `titleRow` gap 14 → `lg`
    - `more` 44 → `size.iconButton` and radius 12 → `md`; `menuCard` radius → `md`, padding → `xs`; `menuItem` →
      `size.iconButton`/`lg`
    - `title` → `display` (tracking −0.3 → −1), `total` → `amountLg` (32 → 28), `itemName` → `body` + `bodyMedium`
    - `card` radius 22 → `lg`, padding 18 → `lg`, gap → `xxs`; `dayCard` radius 18 → `lg`; `item` padding 10 → `sm`
    - inline: spinner `marginTop: space.xxl`, `{ gap: space.lg }`, `{ gap: space.sm }`, `{ gap: space.xxs }` and the
      empty line's `paddingHorizontal: space.xs`
    - The menu comment's "64 = paddingTop (20) + 44" stays true (`space.xl`, `size.iconButton`).
  - Verify: `yarn lint` with the file guarded. In the browser: views a–d (Visual check), plus collapsing on scroll.
    The compact header still appears as the card scrolls under (the card is shorter, and `onCardLayout` re-measures it).
- [ ] 3. Put the category form, delete category and danger text on design tokens (~45 lines)
  - Files: `src/app/{category-form,delete-category}.tsx`, `src/theme.ts` (`dangerText`), `eslint.config.js` (−2)
  - Change: the shared header on both screens. Category form: `remove` → `size.control`. Delete category:
    - `body` → `lg`/`lg`/`huge`
    - `question` → `title` (24 → 22) and `warning` → `body` (16/24 → 15/20)
    - `error` → `label`
    - `destructive` radius 18 → `lg`, padding → `lg`; `destructiveText` → `bodyStrong` (16 → 15)
    - `dangerText` as in Contracts
  - Verify: `yarn lint`. Views e–g, and the category ⋯ menu again (it uses `dangerText`).
- [ ] 4. Put the expense and income item screens on design tokens (~90 lines)
  - Files: `src/app/{expense,income-item}.tsx`, `eslint.config.js` (−2, which leaves exactly the 3 103d paths), and
    change the comment above `notOnTokensYet` from 'brief 103c empties this list' to 'brief 103d empties this list'.
    `docs/design/design-system.md` roll-out line: "103c other screens" → "103c/103d other screens" (only if Gate A
    approves the split).
  - Change: the shared header on both. Expense:
    - `field` → `size.control` + `radius.md`
    - `form` gap 22 → `xxl`, `group` → `sm`
    - `input` → `{ ...field, ...text.input, paddingHorizontal: space.lg, color }` (14 → 16)
    - `label` → `label` + `bodySemi`; `small` → `caption` + tabular; `locked` → `body` + `bodyMedium`; `error` → `label`
    - `primary` radius 18 → `lg`; `primaryText` → `bodyStrong` (16 → 15); `delete` → `size.control`
    - `added` gap 10 → `sm`, padding 14 → `lg`, radius → `md`; `addedText` → `label` + body face (14 → 13)
    - the loader spinner → `marginTop: space.xxxl`

    Income item: the same field, label, error, primary and delete moves, plus `body` → `lg`/`lg`/`huge`, `caption` →
    `label` + body face (14 → 13), and `input` → `...text.input` with padding 14 → `lg`.

  - Verify: `yarn lint`. Views h–k. AC4: on `/expense` and `/income-item`, run
    `[...document.querySelectorAll('input:not([type=date])')].map((i) => getComputedStyle(i).fontSize)`. Every entry
    should be `"16px"`. Then take the full **after** set and run the demo check (AC6).

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, without piping. In this worktree,
export `DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip. Only `@/theme` names change,
so no new module reaches the demo and `check-builds` needs no `--accept`.

## What moves (the PR lists this)

Natural line heights are 1.3× for Plex and 1.2× for Bricolage (measured in 103). The sums below are estimates, and the
developer records the measured values under Deviations.

**103c, type > 1pt**

- Category hero total 32 → 28 (`amountLg`). Its box goes 38.4 → 34.
- Delete question 24 → 22 (`title`).
- Delete warning 16/24 → 15/20: −4pt per line.

**103c, type −1pt**

- The four modal titles 18 → 17.
- Delete's button, the expense form's Add/Update and the income item's Save: 16 → 15.
- 14 → 13: the expense form's "Added" note and the income item's caption.

**103c, spacing ±2pt**

- 6 → 8: category header `paddingBottom`.
- 14 → 16: category content gap, title-row gap (name 2pt right), and the expense/income input padding (text 2pt right).
- 18 → 16: category card `paddingHorizontal`.
- 22 → 24: the expense form gap.
- 10 → 8: category item `paddingVertical` and the "Added" gap.
- The "Added" padding 14 → 16.

**103c, radius**

- 22 → 20: the category card.
- 18 → 20: day cards, Delete, Add/Update and Save.
- 12 → 14: the ⋯ button (press and focus only).

**103c, line heights and tracking**

- body +0.5, label +1.1, caption +0.4, Bricolage heading +0.4, title −0.8, display +0.4.
- The category title tracking −0.3 → −1 (about 0.7pt narrower per letter).
- Role tracking is new where today's styles set none: the Bricolage modal titles get heading's −0.4 (from 0), labels
  −0.1, body texts −0.2, and the expense and income inputs input's −0.2.
- `dangerText` +0.5 line height and −0.2 tracking everywhere it shows, Members' Remove/Revoke included. Its text sits
  in a 44pt box, so no row changes height.
- The day labels keep +0.5 tracking.

**103c, sums over 2pt (estimated)**

- Category screen: the card is about 2pt shorter (total −4.4, two captions +1.1 each), and the first day sits about 4pt
  lower. Each expense row is about 3pt shorter: padding −4, text +0.9. A day with 4 expenses ends about 8pt higher.
- Delete category: the warning runs 2–3 lines, so the button moves up about 8–13pt.
- Expense form: the 4–5 gaps go 22 → 24 and three labels grow 1.1, so Add sits about 12pt lower and Delete (edit) about
  14pt lower. The "Added" note is about 4pt taller.

**103d (outlined, for the record)**

- Type > 1pt: login title 40 → 28 (`display`; box 48 → 34).
- Type −1pt:
  - login username 17 → 16, Sign in 16 → 15
  - 14 → 13: login error, and Members' failure and detail (detail line height 20 → 18)
- Spacing:
  - 6 → 8: login field gap, Members header `paddingBottom`
  - 14 → 16: login fields gap, Members panel padding and input padding
  - 10 → 8: Members row padding and row gap
  - 18 → 16: Members confirm padding
- Radius 18 → 20 on the Members list; the 22/24/28 radii → `pill` (no visible change).
- Sums: the login block is about 5pt shorter and centred, so the fields sit about 12pt higher. Each Members row is
  4pt shorter (the 44pt `who` sets its height).

## Visual check (AC5; not counted in the line estimates)

**Before set (the orchestrator, on Base, before slice 1).** Use the 103b recipe: user `claude-qa-103b` (ledger #165),
seeded November data, the app on `:8081`, 390×844, Light and then Dark, and layout snapshots in local storage under
`snap:before:c:*`. Keep the `snap:before:b:*` keys.

Data needed:

- a category with expenses on at least 2 days, one day with at least 2 expenses
- a category with no expenses in November
- an income item

It must include, each in both themes:

- a. The category screen for that category, at the top.
- b. The same, scrolled until `CompactTotal` shows. Use 390×300 as in 103b if the page doesn't scroll at 844.
- c. The same with the ⋯ menu open.
- d. The category screen for the empty category ("No expenses in November.").
- e. Add category: `/category-form?month=2026-11`.
- f. Edit category in November, with "Remove from November".
- g. Delete category for the category with expenses, with its money warning. View only, don't confirm.
- h. Add expense: (1) empty; (2) after tapping Add with nothing filled in ("Add a name and an amount first."); (3)
  after a real add ("Added …" note). Take (3) last, then delete that expense so the data matches. The after set adds
  and deletes the same one.
- i. Edit expense in November (Update and Delete expense).
- j. Add income: `/income-item?month=2026-11`, empty, then after Save with no title ("A title needs 1 to 40
  characters.").
- k. Edit income, with Delete item.
- l–n (103d's views, taken now so part 2 can reuse them):
  - l. Login, signed out (web shows Request access and the price).
  - m. Members as owner, with a pending invite (Revoke) and a second member (Remove), then with Remove tapped (the
    confirm panel). An invite lasts an hour, so make it again before the after set if it expired.
  - n. No-ledger, as a user in no ledger with no invites.

  If a second member or a user with no ledger can't be set up, those views are checked from the code only (Open
  question 6). The demo needs no before set: AC6 only asks for no console errors.

**Checked from the code only** (listed as such in the PR):

- loading spinners (`CategoryInMonth` 32/24, the expense loader 32, Members 24; same values, now tokens)
- every `LoadError` state (bad links, not found, not in month, `NotInMonth`)
- the expense form locked in an ended month (no expense in an ended month in the QA data)
- delete-category's failure and "gone" states
- the category screen in an ended month
- login's busy spinner and error line (a wrong code feeds the throttle)
- Members' failure lines and the non-owner Leave panel (the same `ConfirmPanel` as Remove)

**After set:** after slice 4, the same views a–k on the same port, data and month. Compare each pair with What moves:
anything else is a bug in the slice that caused it. The screenshots go in the PR, not the repo.

**Gate B, iPhone (Expo Go):** the expense and income inputs' text placement (still no line height; only the padding
moves), the category hero and day rows, and the delete warning.

## AC → evidence

| AC                                                       | Evidence                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 no number literals in the 8 screens                  | 103c: slices 2–4, `yarn lint` with each of the 5 files guarded; `rg -n 'disable-next-line no-restricted-syntax' apps/mobile/src` → 9 entries, each with a reason above. 103d: the other 3 (slices 6–7) |
| AC2 `notOnTokensYet` gone                                | 103d slice 7. After 103c slice 4 the list holds exactly `login`, `members`, `no-ledger`                                                                                                                |
| AC3 tabular digits on money                              | Slice 2: `total` → `amountLg`, `itemAmount` → `amount`, `small` and `caption` tabular (Contracts → Money); 103d's screens show no figures. Visual: views a–b                                           |
| AC4 inputs ≥ 16px on web                                 | Slice 4 Verify: `getComputedStyle` → `"16px"` on `/expense` and `/income-item`. 103d: login (16 and 26) and Members (both 16)                                                                          |
| AC5 before/after snapshots, only listed changes          | Visual check: before set a–n on Base (orchestrator), after set a–k after slice 4 (l–n after 103d), light and dark, compared with What moves; the code-only list in the PR                              |
| AC6 demo, no console errors                              | Slice 4: demo on `:8084`, Light and Dark, console open: the category screen, add and edit expense, add and edit category, delete category (view only), add income. No red screen, no errors            |
| AC7 gates                                                | Every slice                                                                                                                                                                                            |
| What: `dangerText` on `text.body`, face kept             | Slice 3 (Contracts)                                                                                                                                                                                    |
| What: `spinnerMargin` default `space.xxxl`, caller token | Slice 2                                                                                                                                                                                                |

## Not doing (YAGNI)

- No `ScreenHeader` or `Button` component, although the modal header is copied 4 times and the 56pt button 3 times.
  That's brief 104.
- No role for the code input, no overline role for the all-capitals labels, no token for the toast clearance (2
  callers) or for the 52pt login field.
- No colours, Inter, shadows or border changes (105). `DateField`'s hidden web date input stays as it is.
- No `fontVariant` on sentences that contain an amount.

## Risks

- **The category card is shorter**, so the compact header could appear at a different scroll point. Slice 2 checks
  view b; `useCollapsingSummary` re-measures through `onCardLayout`, as 107 relied on.
- **The sums above** (category rows, delete button, expense Add) feel like more than "small shifts". Slices 2–4 measure
  them. If they're too much, the tie rule (10 → 8, 22 → 24) is the one place to change, as in 103.
- **November ends on 2026-12-01 (Kyiv).** After that, the November views turn read-only (no ⋯ or "+", a locked form,
  no Remove), and the before set can't be matched. Take the after set before then. Otherwise, take both sets again
  from Base on December data.
- **`dangerText` moves Members (a 103d screen) in this PR.** It's listed, and 103d compares view m against this.
- **A local `text` is missed and hides the import.** Typecheck fails where the import is used inside the hidden scope.
  Slice 1's `rg` check covers the rest.
- **Main moves:** if another PR takes 1.18.1, rebase, take main's number and bump once more (§8b).

## Open questions

1. **Blocking: yes (Gate A). Split into 103c (this plan) and 103d (login, Members, no-ledger)?** It's about 270 + 210
   lines, against about 480 (up to about 650) as one PR. Assumed: split. If not, slices 5–7 below join this PR and the
   version stays 1.18.1.
2. **Blocking: yes (Gate A). The changes over 1pt:** category hero 32 → 28, delete question 24 → 22, the delete
   warning's −4pt per line, and login title 40 → 28.
   - Recommended: accept all four.
   - The spec's Type table names `display` for "screen title, hero figure" and `title` for "sheet title", and 15/20
     is its `body`.
   - 103's Gate A accepted the same kind of change (Expenses total 34 → 28, Statistics period 20 → 22).
   - Allowlisting until 105 would mean 105 edits these screens again, which is what this chain exists to avoid.
   - New since 107: the Expenses total is gone, so the category hero is `amountLg`'s only caller, and nothing else in
     the app is that size.
   - Login's 40 is a wordmark more than a screen title, so it changes the most. Keeping it at 40 is 3 lines in 103d.
   - Assumed: accept all.
3. **Blocking: no for 103c (decide at Gate A so 103d inherits it). Login's code input.**
   - Recommended: keep `fontSize: 26, letterSpacing: 8` allowlisted.
   - It's the only code field and the only display-face input (`rg letterSpacing` finds no other 8), so a role would
     have one caller, against the rule of three.
   - At 26, AC4 holds.
   - 105 picks the face for it with Inter.
4. **Blocking: no.** The category day labels keep +0.5 tracking, allowlisted, the way the MonthSwitcher eyebrow did in
   103b. With label's −0.1, "MON 24 NOV" would tighten by about 5pt.
5. **Blocking: no.** "Money figure" means a standalone amount. Amounts inside sentences (the delete warning, the
   "Added" note, login's price) get no `fontVariant`, and Plex digits are fixed-width anyway.
6. **Blocking: yes (Gate A). Baseline for 103d's views.**
   - Members' Remove row and its confirm panel need a second member in ledger #165.
   - No-ledger needs a user in no ledger.
   - Choose: set them up for the before set now, or check those views from the code only (listed as unchecked in the
     PR, as 103b did with Settings-with-invite).
   - Assumed: take them if a second local test user exists, and otherwise check from the code.

## Later part: 103d (outline; its brief is written after 103c merges)

Base: main after 103c. Version: patch. ≈ 210 lines.

- 5. Rename Members' local text names (~36): `LabelForm`'s `[text, setText]` → `[draft, setDraft]`, and the four
     `const text =` failure strings → `message`.
- 6. Put login and no-ledger on design tokens (~72):
  - Login:
    - `body` → `xxl`/`xxxl`, the inline gap 14 → `lg`, `field` gap 6 → `sm`
    - `title` → `display` (40 → 28)
    - `input` radius → `md`, padding → `lg`, `...text.input` + `bodyMedium` (17 → 16)
    - `passwordInput` allowlisted (Open question 3)
    - `error` → `label`; `button` radius 28 → `pill`; `buttonText` → `bodyStrong`
    - `demoLink` → `size.iconButton`/`lg`, `demoLinkText` → `bodyStrong`, `price` → `label`
  - No-ledger: `body` → `xxl`/`xxxl`, `title` → `display`, `text` → `body`, `check` → `size.iconButton`/`-space.sm`/
    `sm`, `checkText` → `bodyStrong`, and the inline gap → `sm`.
- 7. Put Members on design tokens and lint every screen (~105):
  - Members: the snapping rules (What moves → 103d), `detail` → `label` + body face, `input` → `...text.input` +
    `bodyMedium`, and the `confirm`/`primary` radii → `pill`.
  - `eslint.config.js`: delete `notOnTokensYet` and its comment, and set `ignores: ['src/theme.ts']` (AC2).
  - Verify: `yarn lint`, the AC4 check on `/login` and `/members`, the after set for views l–n, and iPhone at Gate B
    (the code input).

## Follow-ups

- `amountLg` has no caller on Base (107 removed the Expenses total). 103c gives it one again. If 105 drops the
  category hero, check whether the role is still needed.
- `DateField`'s hidden web date input (103b follow-up): still open, for 105.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

After the skeptic (approve with edits):

- Slice 4 also changes the comment above `notOnTokensYet` to say brief 103d empties the list.
- Slice 4 also updates the design spec's roll-out line, if the split is approved. It's no longer in slice 7.
- Slice 1's check now looks only for local bindings named `text`.
- What moves now says the role tracking is new where today's styles set none.

The slices and the version are unchanged.

## Gate A (2026-11-24)

Approved by the user: the split into 103c (this plan, slices 0–4) and 103d (login, Members, no-ledger and removing
`notOnTokensYet`, its own brief and PR); and all four >1pt changes (category total 32 → 28, delete question 24 → 22,
delete warning 16/24 → 15/20).

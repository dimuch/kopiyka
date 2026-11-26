# Plan: The fresh look, part 1: the palettes, violet bars, the caution label and the light default

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/fresh-look
Base: origin/main (d230a95, version 1.23.11)

## Approach

**Size: the whole brief is about 1,000 changed lines, so it splits into four PRs** (brief open question 2). I drafted
this part in a scratch copy of `apps/mobile` (outside the repo) and ran the repo's Prettier, ESLint, `tsc` and the
three touched test files on it: all clean, no new type errors, 35 tests pass. That draft is **170 added and 125
removed (295 lines) in 29 files**, plus about 10 lines of docs. The later parts are estimated from their call sites, not
drafted, and each is measured again in its own plan.

| Part              | What ships                                                                                                                                                                         | ≈ lines        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **105 (this PR)** | The doc's light and dark palettes; every non-doc colour token gone except `border` and `borderStrong`; violet → caution → danger bars in the doc's shape; "€X left"; light default | 305 (measured) |
| 105b              | Inter and the type mapping, the weight fixes, the overline decision, inputs at 400, DateField's hidden input                                                                       | ~180           |
| 105c              | Borderless cards with `shadow.card` (none in dark), `hairline`, one card per row, `border` gone                                                                                    | ~220           |
| 105d              | One look per control: buttons, chips, IconButton, ScreenHeader, the toast, inputs, menus; `borderStrong` gone                                                                      | ~330           |

- Each part is a brief and PR of its own, branched from `origin/main` after the previous part merges, with its own
  patch bump and before/after screenshots, as 103 and 104 were. The later briefs are written after this one merges;
  the outline is under "Later parts".
- This order is the brief's own. It puts the colours first because every later part's screenshots are then taken in
  the new palettes, and it leaves the two border tokens to the parts that remove the borders.

**This part.** Almost all of it is `theme.ts`.

- **Palettes.** The doc's values replace today's in both palettes. Three new tokens arrive with their first callers:
  `fill` (the sheet's chips), `accentText` (Settings' initial, the demo's Sign in) and `cautionText` (the caution
  label). `hairline` waits for its first caller in 105c, and the shadows for 105c too.
- **Non-doc tokens** (`over`, `surfaceRaised`, `borderStrongest`, `fainter`, `accentLine`, `activeLine`): each caller
  moves to a doc token or loses the use (Inventory), and the token goes. `border` and `borderStrong` stay, at today's
  values: all 28 of their callers are edges that 105c and 105d remove or redraw, and giving them new colours now would
  be inventing values the doc doesn't have, for one or two releases.
- **Bars.** `progressColor` paints under-plan bars `accent` (violet), replacing 091's green (a recorded user decision).
  ProgressBar becomes the doc's 4pt rounded track with an 8pt dot at the fill's end.
- **Caution label.** `budgetProgress` gains `leftCents`, next to `overCents`. A near-plan row on Expenses shows "€5
  left" in `cautionText` under the bar, where an over-plan row shows "€9 over", and its accessibility label says the
  same.
- **Default theme.** `DEFAULT_PREFERENCE` becomes `'light'`. `parsePreference` must now keep a saved `'dark'`
  explicitly: today it gets Dark only by falling through to the default.

Alternative considered: one PR for the whole brief (~1,000 lines, over twice the limit), or the colours spread across
the parts that redraw each component. The second would leave the app in two palettes at once between releases, and
every part's screenshots would mix old and new colours.

## Inventory (measured on Base)

**Colour tokens.** Today's 22 keys in each palette, against the doc's 18 (17 rows in its light table: `active` and
`activeTint` share one).

| Token on Base                      | Callers on Base                                                                                                                      | This part                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `over`                             | 16: 14 `alert` lines (`color="over"`), CollapsingSummary's over-budget total, Statistics' over gap                                   | → `danger`; the token goes. The doc's `danger` is "over plan, delete", and the alerts were the only orange. 4.95:1 on light `bg`, 5.30 on `surface`                                                 |
| `surfaceRaised`                    | 5: UndoToast, Members' confirm panel, the category page's ⋯ menu, Statistics' period menu, the category sheet's chips                | toast, panel and both menus → `surface`, keeping their `borderStrong` edge until 105d gives them `shadow.float` or a `hairline`. The sheet's chips → `fill` (the doc's chip colour). The token goes |
| `borderStrongest`                  | 2: the sheet's handle, the dashed "N more" chip's edge                                                                               | → `faint` (minor non-text graphics, 3.3:1 light). 105d decides the "more" chip. The token goes                                                                                                      |
| `fainter`                          | 2: login's code placeholder, a disabled IconButton's icon                                                                            | placeholder → `muted` (below); icon → `faint`. The token goes                                                                                                                                       |
| `accentLine`                       | 1: the expense form's "Added" note edge                                                                                              | edge removed: the note keeps `accentTint` (no borders by default). The token goes                                                                                                                   |
| `activeLine`                       | 1: Settings' open-ledger option edge                                                                                                 | edge removed: the option keeps `activeTint`. The token goes                                                                                                                                         |
| `faint` (as text)                  | 7 placeholders (actual End, income item, expense name, Members' label, AmountFields, CategoryForm ×2) + login's via `fainter`        | → `muted`. The doc says `faint` is "minor icons only, never text" (3.1:1); `muted` is 5.1:1, and login's username placeholder is `muted` already                                                    |
| `border`                           | 11: Card's edge, 6 list dividers, HeaderDivider, TabBar, the tab layout's bar, DemoStrip                                             | **stays at today's value**: 105c removes every one                                                                                                                                                  |
| `borderStrong`                     | 17: 9 input looks, Chip, Button's `outlinedDanger`, UndoToast, the sheets' top edge, both menus, Members' panel, the Statistics menu | **stays at today's value**: 105d redraws every one                                                                                                                                                  |
| `accent` on `accentTint` (as text) | Settings' initial, DemoStrip's "Sign in"                                                                                             | → `accentText`: `accent` on light `accentTint` is 4.35:1, under 4.5                                                                                                                                 |
| `active` (bars)                    | `progressColor` under plan                                                                                                           | → `accent`. `active`/`activeTint` stay for the open ledger only                                                                                                                                     |

**Dark tokens the doc's first pass doesn't list:** `faint`, `active`, `activeTint` and `backdrop`. They keep today's
dark values (`#6E757E`, `#6FD08C`, `#132A1C`, `rgba(5,6,8,0.62)`), checked below; slice 6 writes that into the doc.
`categoryTile()`'s hues are not palette tokens and don't change.

**Contrast, every pair checked** (WCAG 2; the slice 1 test asserts each). Where the doc gives a figure, these match it
when rounded; the pairs the doc doesn't list are in bold.

| Pair (where)                                             | Light                               | Dark            | Need |
| -------------------------------------------------------- | ----------------------------------- | --------------- | ---- |
| `text` on `bg` / **`surface`**                           | 17.7 / **19.0**                     | **16.5 / 15.2** | 4.5  |
| **`text` on `fill`** (the sheet's chip names)            | **16.6**                            | **13.9**        | 4.5  |
| **`text` on `accentTint`** (the "Added" note)            | **16.0**                            | **13.4**        | 4.5  |
| `muted` on `bg` / **`surface`** (captions, placeholders) | 5.06 / **5.42**                     | **7.58** / 6.98 | 4.5  |
| **`accent` on `bg`** (login's links, Retry)              | **4.81**                            | **7.09**        | 4.5  |
| `accent` on `surface` (Undo, the "+" icons)              | 5.15                                | 6.52            | 4.5  |
| `onAccent` on `accent`                                   | 5.15                                | 7.09            | 4.5  |
| **`onAccent` on `danger`** (the filled danger button)    | **5.30**                            | **8.48**        | 4.5  |
| `accentText` on `accentTint`                             | 6.94                                | 9.13            | 4.5  |
| **`danger` on `bg`** (the alerts)                        | **4.95**                            | **8.48**        | 4.5  |
| `danger` on `surface` ("€9 over", Remaining < 0)         | 5.30                                | **7.80**        | 4.5  |
| `cautionText` on `surface` ("€5 left")                   | 5.27                                | 11.2            | 4.5  |
| `active` on `activeTint` (the open ledger)               | 4.71                                | **8.05**        | 4.5  |
| `faint` on **`bg`** / `surface` (swap icon, handle)      | **3.12** / 3.34                     | **4.16 / 3.82** | 3    |
| bars on `track`: `accent`, `danger`                      | 4.32, 4.44                          | 5.31, **6.35**  | 3    |
| bar on `track`: `caution`                                | 1.33 (the doc's accepted exception) | **9.14**        | 3    |
| **`accent` on `accentTint`** (moved to `accentText`)     | **4.35 ✗**                          | 5.75            | 4.5  |
| **`faint` on `fill`** (no caller)                        | **2.92 ✗**                          | 3.50            | 3    |

## Contracts

- DB: none
- API: none
- App:
  - `theme.ts`: `darkColors` keys become `bg, surface, fill, track, text, muted, faint, accent, onAccent, accentTint,
accentText, caution, cautionText, danger, active, activeTint, backdrop, border, borderStrong` (19); `Palette` is
    still `typeof darkColors`. Gone: `over`, `surfaceRaised`, `borderStrongest`, `fainter`, `accentLine`,
    `activeLine`. `progressColor(state, colors)`: `under` → `colors.accent` (was `active`).
  - `Text`'s `color` prop is `keyof Palette`, so `color="cautionText"` and `color="accentText"` type-check and
    `color="over"` stops compiling: typecheck finds every missed caller.
  - `data/budgetProgress.ts`: `BudgetProgress` gains `leftCents: number`, "EUR cents of planned not yet spent; 0 at or
    over it" (`Math.max(0, planned − spent)`). Callers: Expenses (new); `planGap` destructures only `state` and
    `overCents`, unchanged.
  - `ProgressBar({ fill, state })`: props unchanged. Draws a 4pt `track` (pill) and, when `fill > 0`, a bar of
    `fill × 100%` width (at least 8pt) in `progressColor`, ending in an 8pt dot of the same colour. `fill === 0` draws
    the bare track.
  - `appearance/preference.ts`: `DEFAULT_PREFERENCE = 'light'`. `parsePreference(raw)` returns `raw` for `'light'`,
    `'dark'` and `'auto'`, and `'light'` for anything else (null, `'Dark'`, `''`). `resolveScheme` unchanged.
  - `AppearanceProvider`'s pre-load view: `lightColors.bg` (the default's page). `app.json` `expo.backgroundColor`:
    `#0E1013` → `#F7F7F8` (the native root view before JS runs). It takes effect only where `expo-system-ui` runs,
    which Expo Go bundles; `expo-system-ui` isn't a dependency, so a standalone iOS build ignores it.
  - Expenses row: under the bar, `state === 'over'` → `<Text variant="captionMedium" color="danger" tabular>€9
over</Text>` (as today), `state === 'near'` → `<Text variant="captionMedium" color="cautionText" tabular>€5
left</Text>`. Accessibility label: `"<name>, €95 of €100 spent, €5 left"`; the over form is unchanged.
- Reuses: `budgetProgress`'s state (one rule for bar colour and label), `eur`, `Text`'s `color` key, the
  `theme.test.ts` `contrast()` helper.
- New dependencies: none.

## Version

Bump: patch — 1.23.11 → 1.23.12
Why: §8b `patch` ("styling, copy"): new colours, a bar shape, one label, and a different default look for installs
with no saved choice. Nothing new to do, and nothing that works today stops working: a saved Light, Dark or Auto is
kept (slice 5's test), and no API, data or connector changes.

## Slices

- [x] 0. Bump version to 1.23.12
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.12
- [x] 1. Draw the app in the design system's light and dark palettes, with violet bars (≈ 115 lines)
  - Files: `apps/mobile/src/theme.ts`, `apps/mobile/test/theme.test.ts`, `apps/mobile/src/app/(tabs)/settings.tsx`,
    `apps/mobile/src/demo/DemoStrip.tsx`
  - Change: both palettes take the doc's values and gain `fill`, `accentText`, `cautionText`; the six non-doc tokens
    keep today's values for one more commit. The file's header comment points at the doc. `progressColor`'s under
    state → `accent`, its JSDoc says violet. Settings' initial and DemoStrip's Sign in → `color="accentText"`.
  - Tests: `theme.test.ts` → "paints a category bar violet, yellow or red" (`accent`/`caution`/`danger`, three
    distinct); bars visible on `track` with the light `caution` skip (comment: the "€X left" label); same yellow in both
    themes; new `contrast` table test, one `it.each` per theme over the 17 passing pairs above, with the pair's name in
    the failure message. The old `active` test is one row of it.
- [x] 2. Replace the colours the design system doesn't have (≈ 90 lines)
  - Files: `theme.ts` (six keys out of both palettes), 14 `alert` sites in `PendingInvites`, `members` (4),
    `CategoryForm`, `delete-category`, `expense` (3), `login`, `income-item`, `actual-end`, `settings`;
    `CollapsingSummary`, `statistics` (over → danger, surfaceRaised → surface); the 8 placeholders (the 7 `faint` ones and login's `fainter`); `IconButton`
    (and its JSDoc: "turns `faint`"); `UndoToast`, `members`, `category/[categoryId]` (surfaceRaised → surface);
    `CategorySheet` (chips → `fill`, its comment; handle → `faint`); `CategoryPicker` (dashed edge → `faint`);
    `expense` ("Added" note loses its edge); `LedgerPicker` (open option loses its edge).
  - Change: as the Inventory table. No other style changes.
  - Verify: typecheck (no key left behind); `rg -n "surfaceRaised|borderStrongest|fainter|accentLine|activeLine|colors\.over|\"over\"|'over' :" apps/mobile/src`
    finds nothing; `rg -n 'placeholderTextColor=\{colors\.(faint|fainter)\}' apps/mobile/src` finds nothing;
    `theme.test.ts` still green.
- [x] 3. Draw progress bars as a thin track with a dot at the end of the fill (≈ 20 lines)
  - Files: `apps/mobile/src/components/ProgressBar.tsx`
  - Change: as Contracts. The 4 and 8 are `height`/`width`/`minWidth` (no lint key; the comment names the doc), the
    track loses `overflow: 'hidden'` so the dot can overhang it by 2pt into the row's 8pt gap. The dot sits inside the
    end of the fill, flush with it (`alignItems: 'flex-end'`), so a 100% bar's dot ends at the track's end and doesn't
    stick out past it.
  - Verify: web 390×844, Expenses with the seeded rows (Visual check): an empty track for a €0 row, a violet bar with
    a dot for U, yellow for N, a full red bar with the dot at the right end for O; light and dark.
- [x] 4. Show "€X left" under a near-plan category's bar (≈ 50 lines)
  - Files: `apps/mobile/src/data/budgetProgress.ts`, `apps/mobile/test/budgetProgress.test.ts`,
    `apps/mobile/src/app/(tabs)/expenses.tsx`, `apps/mobile/src/components/Text.tsx`
  - Change: `leftCents` as Contracts; the row's label and accessibility label switch on `progress.state` (`over` /
    `near` / nothing). The JSX comment says why the words are there, with the four contrast figures. `Text.tsx`'s
    `captionMedium` comment ("its one caller") becomes the Expenses rows' "€9 over" and "€5 left".
  - Tests: `budgetProgress.test.ts` → every existing row gains its `left` column: 12000, 7000, 6000, 1201, 1200 (exactly
    90%), 0 (at plan), 0, 0, 101, 100, 0, 0. Verify: Expenses, N reads "€5 left" in `cautionText`; its `aria-label` is
    "…, €95 of €100 spent, €5 left"; U shows nothing; O still "€9 over".
- [x] 5. Start new installs in the light theme (≈ 22 lines)
  - Files: `apps/mobile/src/appearance/preference.ts`, `apps/mobile/test/preference.test.ts`,
    `apps/mobile/src/appearance/AppearanceContext.tsx`, `apps/mobile/app.json`
  - Change: as Contracts; JSDoc on `DEFAULT_PREFERENCE` says why (the look was designed in light).
  - Tests: `preference.test.ts` → `parsePreference`: `null → light`, `'light' → light`, `'dark' → dark` (the row that
    fails if `'dark'` isn't kept explicitly), `'auto' → auto`, `'Dark'`, `''`, `'x'` → light. `resolveScheme` table
    unchanged. Verify: web, `localStorage.removeItem('kopiyka.theme')` + reload → light; `'dark'` + reload → dark;
    `'auto'` follows the browser.
- [x] 6. Record the dark tokens and the caution label in the design system (≈ 6 lines, docs)
  - Files: `docs/design/design-system.md`
  - Change: the dark section says `faint`, `active`, `activeTint` and `backdrop` keep their pre-105 values; the
    caution paragraph says the label is in (past tense, not "until brief 105"). No other doc text changes.
- [x] 7. Record briefs 105b–105d as planned in the backlog (≈ 4 lines, docs; **only if Gate A approves the split**)
  - Files: `docs/features/BACKLOG.md`
  - Change: 105b (Inter), 105c (cards and rows) and 105d (controls) listed as planned after this PR, one line each,
    as the 104 parts were. Without the split, this slice is dropped.

## What moves (the PR lists this)

- Every screen: new colours (violet accent, violet-tinted greys), light for anyone with no saved choice.
- Expenses: bars 5 → 4pt with a dot (each row about 1pt shorter), violet under plan, and the "€X left" line on
  near-plan rows (one caption line taller).
- The forms' and Members' alerts: orange → `danger` red. Placeholders: one step darker (`muted`).
- The "Added" note: no 1pt edge (2pt shorter, contents 1pt higher). The open-ledger option: no 1pt edge; its height
  stays 44 (`minHeight`, no vertical padding), its text 1pt further left.
- Toast, menus and Members' panel in dark: the `surface` grey instead of a lighter step (their edges stay).
- The category sheet's chips: `fill` grey in light (were white with an edge on white).

## Visual check (AC5, AC8–AC10; not counted in the line estimates)

**Set-up** (as 104h's Visual check, which has the steps in full):

- API (`api`, 3000), web app on 8084 (`yarn mobile expo start --web --port 8084`, opened at `http://127.0.0.1:8084`)
  and `web-demo` (8082), from this worktree, with the two git-ignored `.env` files copied in. `innerWidth === 390`,
  viewport 390×844.
- **Same Kyiv day, before 1 December**, for both sets. If the build runs past 30 November, seed December instead (the
  same steps with `2026-12`) and take both sets on one December day.
- **QA users**, created before the before set and deleted when the brief is done (members first):
  `claude-qa-105` (owner), `claude-qa-105-m` (`--join claude-qa-105`), `claude-qa-105-n` (`--join`, then removed with
  `DELETE /api/ledgers/<id>/members/<userId>`, for the no-ledger views; the brief lists two users, Open question 4).
- **Seed through the API as the owner**, once, after checking the month has no expenses or income (the POSTs aren't
  idempotent):
  - income `POST …/months/2026-11/income` `{ title: 'Salary', amount: '1000.00' }` (060's rule: the plan can't pass
    income);
  - from `GET …/categories?month=2026-11`, categories 0, 1, 2 are **U**, **N**, **O**; `PATCH
…/categories/<id>/months/2026-11` `{ amount: '100.00' }` on each;
  - expenses (`POST …/expenses`, `expenseDate: '2026-11-03'`, `currency: 'EUR'`): U `10.00`, N `95.00` (95%: near,
    "€5 left"), O `109.00` (over, "€9 over"). The other 12 stay €0 planned and €0 spent (the bare track);
  - actual End `PUT …/months/2026-11/balance/actual-end` `{ amount: '900.00' }`;
  - the invite to `claude-qa-105-n`, made just before the no-ledger views (it lasts an hour).
- TOTP codes from a scratch script outside the repo, never printed; a fresh 30 s window between sign-ins.

**Screenshots (the evidence for this part).** Every view below, Light then Dark (`localStorage.setItem('kopiyka.theme',
…)` + reload), before (on Base) and after (on the last slice), at 390×844. After a scroll or a sheet, wait, then take
the screenshot. They go in the PR, not the repo, side by side with the doc's palette.

- Owner: `home`, `budget`, `budget-ended` (`/budget?month=2026-10`), `income`, `expenses`, `expenses-scrolled`,
  `statistics`, `statistics-menu`, `category` (U), `category-menu`, `category-undo` (delete U's expense from its form,
  screenshot the toast, press Undo), `settings`, `members-owner`, `members-confirm`, `actual-end`,
  `actual-end-error`, `delete-category`, `expense-new`, `expense-sheet` (the "N more" sheet open),
  `expense-added` (then soft-delete it through the API), `income-item-edit`, `category-form-add`.
- Signed out: `login`, `login-error` (fetch stubbed offline, as 104h).
- No ledger: `no-ledger-invite`, then `no-ledger` after Decline. Member: `members-member`.

**Snapshot script (proves what shouldn't change).** Install 104h's `__snapSrc` and `__scrollSrc` (its plan, Visual
check), with keys `snap:before:105:<view>:<scheme>` / `snap:after:105:*`, and this comparison, which drops the four
colour columns (background, border, colour, stroke) and compares the rest (boxes, radius, padding, opacity, type,
text) and the accessibility record:

```js
localStorage.setItem(
  '__shapeSrc',
  `(view, scheme) => { const get = (k) => JSON.parse(localStorage.getItem(k)); const before = get('snap:before:105:' + view + ':' + scheme); const shot = eval(localStorage.__snapSrc)('snap:after:105:' + view + ':' + scheme); const after = get('snap:after:105:' + view + ':' + scheme); const shape = (row) => row && row.split('|').filter((_, i) => ![5, 6, 11, 12].includes(i)).join('|'); const diffs = []; for (let i = 0; i < Math.max(before.rows.length, after.rows.length); i++) if (shape(before.rows[i]) !== shape(after.rows[i])) diffs.push(i + ': ' + shape(before.rows[i]) + '  =>  ' + shape(after.rows[i])); const minus = (a, b) => { const left = [...b]; return a.filter((x) => { const i = left.indexOf(x); if (i === -1) return true; left.splice(i, 1); return false; }); }; return { view, scheme, width: shot[3], rows: [before.rows.length, after.rows.length], shapeDiffs: diffs.length, first: diffs.slice(0, 4), a11yAdded: minus(after.a11y, before.a11y), a11yRemoved: minus(before.a11y, after.a11y) }; }`,
);
```

- Expected on every view: `width: 390`, `shapeDiffs: 0`, empty `a11yAdded`/`a11yRemoved`, **except**:
  - `expenses`, `expenses-scrolled`: the new dot elements and N's label shift every later row's index, so
    `shapeDiffs` is large there and the screenshots are the check (bars 1pt thinner, rows 1pt shorter, the dot, N's
    line). `a11yAdded`/`a11yRemoved` must still be exactly N's label with and without ", €5 left";
  - `expense-added`: the note 2pt shorter and its text 1pt higher.
- Any other difference is a finding, fixed before the PR.

**Checked from the code only** (listed so in the PR): LedgerPicker, which shows only with two ledgers (the open
option loses its edge; its 44pt height doesn't change); a
disabled IconButton (no reachable view); Expenses' loading "—".

**Default theme (AC8):** on web, `localStorage.removeItem('kopiyka.theme')` + reload → light; Settings shows Light
checked. Then pick Dark, reload → dark; Auto follows the browser's scheme.

**Demo:** `web-demo`, Light and Dark, console open: Home, Budget, Expenses, a category page, the expense form with
its sheet, the income item. No errors. `yarn mobile export:web`, then `yarn mobile check-builds` (no `--accept`; this
part adds no module) passes.

**Gate B, iPhone (Expo Go):** both themes; a fresh Expo Go install (or the key cleared) starts light; Expenses with
the near-plan row; the category sheet; the expense form; login.

## AC → evidence

| AC (brief)                                           | This part                                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 colours from the doc; non-doc tokens gone        | slices 1–2, `theme.test.ts`, slice 2's `rg`; `border`/`borderStrong` kept with the reason (Approach). Fonts, sizes, radii, shadows: 105b–105d |
| AC2 Inter only                                       | 105b                                                                                                                                          |
| AC3 cards, card per row                              | 105c                                                                                                                                          |
| AC4 one 48pt pill, 32pt chips, 44pt targets          | 105d (this part changes no size)                                                                                                              |
| AC5 bars violet → caution → danger; "€X left"        | `progressColor` test; `budgetProgress` `leftCents` rows; slices 3–4 checks; `expenses` `a11yAdded`                                            |
| AC6 contrast, pairs listed                           | Inventory's contrast table; `theme.test.ts` `contrast` test. Later parts list their own pairs                                                 |
| AC7 inputs ≥ 16px, DateField's hidden input          | unchanged here (`text.input` untouched); 105b fixes the hidden input                                                                          |
| AC8 light for new installs, saved choice kept        | `preference.test.ts` (`null → light`, `'dark' → dark`); Visual check's default-theme steps                                                    |
| AC9 screenshots 390×844 light and dark, demo, builds | Visual check: screenshots of 27 views × 2 schemes before/after; demo console; `check-builds`                                                  |
| AC10 accessibility unchanged but the caution label   | `__shapeSrc`'s `a11yAdded`/`a11yRemoved` on every view                                                                                        |
| AC11 gates                                           | every slice                                                                                                                                   |

## Not doing (YAGNI)

- `hairline` and the shadow tokens: no caller until 105c.
- New values for `border`/`borderStrong`: the doc has none, and 105c/105d delete them.
- Statistics' "€30 under" in `cautionText`: Statistics has no bar, so colour isn't the signal there.
- `resolveScheme`'s "Auto with an unknown OS scheme is dark": not the new-install question; unchanged.
- Telling a returning user who never picked a theme apart from a new install (Open question 1).
- The category tiles' hues, TabBar beyond its colours (106), Remaining's meaning (107). This part moves no layout, so
  Remaining reads as before; 105c, which re-cards Budget and Expenses, looks again.

## Risks

- **A saved Dark flips to light.** Today `'dark'` is only the fall-through. Slice 5's `'dark' → dark` row fails if
  it's lost, and the Visual check sets `'dark'` and reloads.
- **A missed `over`/`surfaceRaised` caller.** Removing the keys makes typecheck find every `colors.<key>` and every
  `color="<key>"`; slice 2's `rg` covers string forms.
- **The dot overhangs** into the row's gap and could clip where an ancestor has `overflow: 'hidden'`. ReorderList's
  rows and the card don't clip (slice 3's screenshot shows a whole dot on U, N and O in both themes); if one does, the
  track gets an 8pt-high wrapper with the track centred in it (+3 lines).
- **A light flash for dark users** at launch, before the stored choice is read (the pre-load view is now light). It
  was a dark flash for light users before; AsyncStorage answers in one tick on web. Gate B's iPhone check looks for it.
- **The day.** Both sets on one Kyiv day before 1 December, or both on December data (Set-up).
- **Main moves:** if another PR takes 1.23.12, rebase, take main's number and bump once more (§8b).

## Open questions

1. **Blocking: yes (Gate A; slice 5). Light for new installs (brief open question 1)?**
   - Recommended: **yes.** The direction was designed and checked in light, and the doc's light palette is the full
     one (its dark is a first pass).
   - **Who it reaches:** the app stores a choice only when someone taps Appearance. So everyone who never did, on the
     web app, the demo or an installed build, also moves to light on their next launch: the app can't tell them from
     a new install. People who picked Light, Dark or Auto keep it. Assumed: that's acceptable (one tap in Settings
     brings Dark back).
   - If not: drop slice 5; the rest ships unchanged.
2. **Blocking: yes (Gate A). The split (brief open question 2).** Recommended: four PRs, as the Approach's table:
   this part (305 lines), 105b Inter, 105c cards and rows, 105d controls, each its own brief, PR and patch bump, in
   that order. 105d is estimated at ~330 and may split again (ScreenHeader and the inputs into 105e) if its draft
   passes 400. Assumed: four.
3. **Blocking: no (for 105b/105c's Gate A). The category page's hero (brief open question 3).**
   - Recommended: **keep it**, and `amountLg` with it. It's the page's one figure and drives the collapsing summary,
     and the doc plans for it: `display` is "screen title, hero figure", `radius.xl` is "sheet, hero".
   - This part doesn't touch it.
4. **Blocking: no. A third QA user** with no ledger, for the no-ledger screens, as 104c and 104h did. The brief lists
   two. Assumed: `claude-qa-105-n`, deleted with the others.
5. **Blocking: no. A row at exactly its plan** is near (091) and reads "€0 left". Statistics says "On plan" for the
   same case. Assumed: "€0 left", as the brief words it; "On plan" is a one-line change in slice 4 if preferred.
6. **Blocking: no. Placeholders `faint` → `muted`.** Not in the brief, but the doc says `faint` is never text, and AC6
   asks 4.5:1 of text. They read a step darker, as login's username placeholder already does. Assumed: `muted`.
7. **Blocking: no. The alerts `over` → `danger`.** Orange had no doc token; `danger` passes 4.5:1 on `bg` in both
   themes (4.95, 8.48). Assumed: `danger`.

## Later parts (outline; each brief is written after the previous part merges)

Each: base `main` after the previous part, a patch bump, before/after screenshots of every screen in both schemes,
`__shapeSrc` (or 104h's `__cmpSrc`) for what mustn't change, demo console check, `check-builds`.

- **105b, Inter and the type mapping (~180 lines, excluding `yarn.lock`):**
  - `npx expo install @expo-google-fonts/inter`; remove `@expo-google-fonts/bricolage-grotesque` and
    `@expo-google-fonts/ibm-plex-sans`; AppShell loads `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`,
    `Inter_800ExtraBold`; `demo-modules.txt` changes (`check-builds --accept`, the diff is the review).
  - `fonts` becomes four faces, one per weight; each `text` role takes the doc's weight (display/title 800, heading and
    bodyStrong 600, label 500, body, caption and input 400). No `fontWeight` anywhere (web would fake a bold).
  - `Text.tsx`'s pairs: `bodyMedium` → 500, `labelRegular` → 400, `labelSemi` → 600, `captionMedium` → 500.
    `headingDisplay` equals `heading` in Inter (600), so its 10 sites take `heading`, or `title` for the sheet and
    form titles the doc gives to `title`; the 105b plan lists each.
  - **The weight fixes:** every field label is `label` (500), as login's already is (9 `labelSemi` labels move); every
    input is `input` at 400, so the medium overrides in AmountFields, CategoryForm, Members, login and DateField's
    value go.
  - **Overline: both +0.5 trackings join `caption`** (MonthSwitcher's eyebrow, and the category page's day label from
    `labelSemi`), and their two `eslint-disable`s go. The doc has no overline role, and adding one for two sites isn't
    worth a new role. If Inter's small capitals read too tight on the iPhone, a doc-first `overline` role is the
    fallback.
  - The `tabular` flag goes from captions with no digits; the doc's `Text` row names the pairs.
  - The exceptions take Inter: CategoryTile's letter (800), TabBar's badge, login's code field (800, keeps its 26 and
    tracking 8).
  - **DateField's hidden web input** gets `fontSize: text.input.fontSize` (16), so focusing it can't make iOS Safari
    zoom (103c's hand-off). Checked in iOS Safari at Gate B.
- **105c, borderless cards and one card per row (~220 lines):**
  - `theme.ts`: `hairline` (light `rgba(17,16,20,0.06)`, dark a matching value the plan derives and checks); the doc's
    `shadow.card` and `shadow.float` as `boxShadow` strings, per scheme (dark: none). `border` goes.
  - `Card`: no border, `shadow.card`, padding `md`; `CardPadding`'s `list` goes with the lists below.
  - **One card per row** on Budget, Expenses and Income (the brief), and Statistics' category rows, the category page's
    expenses and Members' rows, so no divider is left; 8pt between cards. The 105c plan names any list it leaves.
  - **ReorderList** measures each row's height for the drag; the 8pt gap must sit inside the measured row (a bottom
    padding on `Row`) or in `rowOffset`/`dropIndex`'s maths. The 105c plan proves the drag on web and iPhone.
  - HeaderDivider, TabBar's top edge, the tab layout's bar and DemoStrip's edge → `hairline`.
  - Looks again at Remaining on Budget and Expenses (brief's Out of scope note).
- **105d, one look per control (~330 lines; may split into 105d and 105e):**
  - **Button:** `ButtonSize` and the `size` prop go. Filled looks are one 48pt pill (`size.control`) with one disabled
    opacity; `large`'s 56, the 0.6 default and the one-offs go (login's `signIn`/`signInOff`, EmptyMonth's
    `minHeight`/`borderRadius`, Members' `dimmed`). Text looks are 44pt (`size.iconButton`, the touch minimum) and
    lose `bare`, the `filled && off` rule, Decline's 0.6, the callers' padding overrides and LoadFailed's `failedBack`.
    **So `compact` doesn't survive** as an option. The doc's `secondary` (`fill` + `text`) and `danger` (`fill` +
    `danger` text) replace `outlinedDanger`; whether today's filled red `danger` stays is that plan's question.
    Members' `accessibilityLabel={action}` goes (it equals the label).
  - **Chip:** 32pt pill (`size.chip`), `fill`, selected `accentTint` + `accentText`, no edge. Its touch area stays 44pt
    (a 44pt Pressable around the 32pt pill: `hitSlop` doesn't reach react-native-web). DateChips' 16pt padding, the
    sheet's `fill` override (Chip is `fill` itself) and the dashed "more" (a plain chip with the `more` icon) go.
  - **IconButton:** round (`radius.pill`), so the two `borderRadius: 0` overrides go; the doc's `raised` look only if a
    caller needs it.
  - **AppearancePicker:** stays radios (Chip is a button), drawn in Chip's pill and colours.
  - **ScreenHeader:** Back becomes a round IconButton; one shape (back or home, a title, one action) replaces the 52pt
    spacer, the modal's margin and HeaderDivider's −20 bleed.
  - **UndoToast:** `shadow.float`, no edge, its 56 from a token (with Budget's `toastRoom` 104).
  - **Inputs, menus, sheets, Members' panel:** `borderStrong` goes. Inputs on the page take `fill` (the doc), and keep
    a `hairline` only where they sit on a same-colour surface; menus and the panel float on `shadow.float`. Light
    `faint` on `fill` is 2.92:1: no icon may sit on an input's fill (the AmountFields swap icon sits between the
    fields).

## Follow-ups

- `planGap` computes `planned − spent` inline for "€30 under"; it could read `budgetProgress`'s new `leftCents`
  (Consolidate may take it, or a refactor brief).
- 104e's: the expense form's Back stays enabled during a save (a small fix brief).

## Deviations

- Slice 4: the row's words come from a small `barNote(progress)`, computed once per row with the rows, instead of
  switching on `state` twice in the JSX (the label and the accessibility label). Same contract, same words. The review
  moved it from `expenses.tsx` to `data/budgetProgress.ts` (conventions §2), with a table test in
  `budgetProgress.test.ts`: under, near, at plan ("€0 left") and over.

## Consolidate

CONSOLIDATE: reused 1 · extracted 0 · left 2

- **Reused:** `BudgetProgress.leftCents` in Statistics' `planGap`, which worked out `planned − spent` itself for the
  "€30 under" text. When a category isn't over, the two are the same number. `periodSummary.test.ts` is unchanged and
  passes.
- **Left:** `barNote` (Expenses) beside `planGap` (Statistics). Both turn a `BudgetProgress` into words, but with
  different words and states: Expenses names only `near` ("€5 left") and `over`, while Statistics says "under" or
  "On plan" for every category, and has no bar whose colour needs saying in words.
- **Left:** ProgressBar's dot. It's a plain `View` with one caller, and nothing else draws a dot.

## Revision 1

After the skeptic's APPROVE WITH EDITS (no change to what ships; the version stays 1.23.12):

1. The placeholders are 7 `faint` and login's `fainter` (8, not 9): the Inventory row and slice 2 say so, and slice 2
   adds an `rg` that finds no `faint`/`fainter` placeholder.
2. Slice 4 also updates `Text.tsx`'s `captionMedium` comment, which the "€X left" label makes stale.
3. The open-ledger option keeps its 44pt height without its edge (What moves, Checked from the code only).
4. `app.json`'s `backgroundColor` only acts where `expo-system-ui` runs (Expo Go), noted in Contracts.
5. Slice 3 says the dot sits flush inside the fill's end.
6. New slice 7 (docs, only if Gate A approves the split) records 105b–105d in the backlog; docs ≈ 10 lines, so the
   part is 305.

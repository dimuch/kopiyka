# Plan: Shared components, part 7: Text on the tab screens

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/text-tab-screens
Base: origin/main (3b0c637, version 1.23.9)

## Approach

Move the 50 `<Text>` elements in the brief's 7 files onto 104f's `Text` (`src/components/Text.tsx`). Each site
passes its role and face as a `variant`, its colour as a palette key and its money digits as `tabular`. Its local
style keeps only layout. 104f's Gate A approved the variants. Each one is built from today's `text` role and `fonts`
face, so every site draws today's type, and **nothing moves**. `Text.tsx` gains one pair, `captionMedium`, which
lands in the same commit as its one caller, Expenses' "€9 over". The five state switches pass their state through
`color` or `variant` (table), not a style patch.

**Size: 252 changed lines (138 added, 114 removed) in 8 files, so one PR in three slices.** I moved all 50 sites in a
scratch copy of the repo (outside it) and ran the repo's Prettier, `tsc` and ESLint on it: all clean, 0 warnings, no
unused StyleSheet keys left. The 104f outline estimated 256.

Alternative considered: two PRs, as the brief's first open question allows. At 252 lines the PR is under the
400-line limit, and a second PR would cost one more bump and one more before/after set (Open question 1).

## Inventory (measured on Base)

There are 50 `<Text>` elements in the 7 files (`rg -c "<Text\b"`): Home 2, the demo's Home 2, Budget 7, Income 5,
Expenses 8, Statistics 14 and the category page 12. Every one of them goes through `Text`, with no exceptions. The
category page's day label keeps its +0.5 tracking as a `style`, as the brief says.

| Variant          | Sites | Colours                                                                                                                |
| ---------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `caption`        | 9     | muted 9 (Statistics' plan gap turns `over` when over)                                                                  |
| `amount`         | 9     | text 9 (4 turn `danger`: Budget's Remaining, Statistics' two negatives, Expenses' over; Expenses' muted while loading) |
| `labelRegular`   | 8     | muted 8                                                                                                                |
| `bodyMedium`     | 8     | text 7, danger 1 (the ⋯ menu row)                                                                                      |
| `headingDisplay` | 6     | text 6                                                                                                                 |
| `title`          | 4     | text 4                                                                                                                 |
| `body`           | 1     | muted (the nested " of €…")                                                                                            |
| `captionMedium`  | 1     | danger (Expenses' "€9 over"), **new in this part**                                                                     |
| `display`        | 1     | text                                                                                                                   |
| `amountLg`       | 1     | text                                                                                                                   |
| `labelSemi`      | 1     | muted (the day label, +0.5 tracking as a `style`)                                                                      |
| state switch     | 1     | Statistics' period menu item: `bodyMedium`, checked `bodyStrong`                                                       |

- 15 sites add `tabular`: 14 sites in `caption`, `labelRegular` or `headingDisplay`, plus Expenses' `captionMedium`.
  Some of them hold no digits, like Budget's "Income" label and the category page's "Spent". They keep `tabular`
  because it's today's style, and the snapshots record it (104f, Not doing).
- Nothing else is left as a one-off. The remaining `style`s are layout only (`flex`, `flexShrink`,
  `paddingHorizontal`) plus the day label's tracking.

## Contracts

- DB / API / DTOs / `theme.ts`: none. No new token.
- **`src/components/Text.tsx`**: two lines, after `headingDisplay`, as the 104f plan drafted them:

  ```ts
    // The Expenses rows' "€9 over": its one caller, here because it's a face.
    captionMedium: { ...text.caption, fontFamily: fonts.bodyMedium },
  ```

  Nothing else changes in it: props, nesting and style order stay as 104f shipped them.

- **Sites, measured on Base.** Before: role · face · colour · extras. After: the `Text` props. Line numbers are
  Base's. `labelRegular` = label in the regular face, `headingDisplay` = heading in the display face, `bodyMedium` =
  body in the medium face, as 104f named them.

  | File · line                 | Site                                         | Before                                                    | After                                                                                            |
  | --------------------------- | -------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
  | Home 48                     | ledger label (`numberOfLines={2}`)           | title · text                                              | `title`                                                                                          |
  | Home 51                     | month                                        | label · regular · muted                                   | `labelRegular muted`                                                                             |
  | demo Home 27, 28            | "Kopiyka"; month                             | as Home's                                                 | `title`; `labelRegular muted`                                                                    |
  | Budget 139                  | Start → End line                             | label · regular · muted · tabular                         | `labelRegular muted tabular`                                                                     |
  | Budget 199                  | "Categories"                                 | heading · display · text                                  | `headingDisplay`                                                                                 |
  | Budget 200                  | "€… planned"                                 | caption · muted · tabular                                 | `caption muted tabular`                                                                          |
  | Budget 217                  | row name                                     | body · medium · text · flex 1                             | `bodyMedium`, `style={styles.rowName}` (`{ flex: 1 }`)                                           |
  | Budget 218                  | row planned                                  | amount · text                                             | `amount`                                                                                         |
  | Budget 302                  | figure label                                 | caption · muted · tabular                                 | `caption muted tabular`                                                                          |
  | Budget 303                  | figure value                                 | amount · text; Remaining < 0: danger                      | `amount color={figure.over ? 'danger' : 'text'}`; `IncomeFigures` drops `useColors()`            |
  | Income 139                  | "Income"                                     | heading · display · text                                  | `headingDisplay`                                                                                 |
  | Income 141                  | total                                        | heading · display · text · tabular                        | `headingDisplay tabular`; its comment moves to the JSX                                           |
  | Income 152                  | item title                                   | body · medium · text                                      | `bodyMedium`                                                                                     |
  | Income 153                  | "Added by …"                                 | caption · muted · tabular                                 | `caption muted tabular`                                                                          |
  | Income 155                  | amount                                       | amount · text                                             | `amount`                                                                                         |
  | Expenses 87                 | figure label                                 | caption · muted (no tabular)                              | `caption muted`                                                                                  |
  | Expenses 89                 | figure value                                 | amount · text; loading: muted; over: danger               | `amount color={figure.over ? 'danger' : figures ? 'text' : 'muted'}`                             |
  | Expenses 104                | "Categories"                                 | heading · display · text                                  | `headingDisplay`                                                                                 |
  | Expenses 105                | "spent of planned"                           | caption · muted                                           | `caption muted`                                                                                  |
  | Expenses 164                | row name (`numberOfLines={1}`)               | body · medium · text · flexShrink 1                       | `bodyMedium`, `style={styles.rowName}` (`{ flexShrink: 1 }`)                                     |
  | Expenses 167                | row spent                                    | amount · text · flexShrink 0                              | `amount`, `style={styles.rowAmount}` (`{ flexShrink: 0 }`, its comment stays on the style)       |
  | Expenses 169                | nested " of €…"                              | regular face · muted; size, tracking, tabular from parent | `<Text variant="body" color="muted">` (Contracts › nested)                                       |
  | Expenses 174                | "€9 over"                                    | caption · medium · danger · tabular                       | `captionMedium danger tabular`; the contrast comment moves to the JSX                            |
  | Statistics 49               | "Statistics" (`header`)                      | title · text                                              | `title`, role kept                                                                               |
  | Statistics 94               | totals row name                              | body · medium · text · flex 1                             | `bodyMedium`, `style={styles.grow}`                                                              |
  | Statistics 96, 153          | totals amount; month's Left                  | amount · text; < 0: danger                                | `amount color={cents < 0 ? 'danger' : 'text'}` (`leftCents` at 153)                              |
  | Statistics 103, 133         | "By category", "By month"                    | heading · display · text · paddingHorizontal xs           | `headingDisplay`, `style={styles.sectionTitle}` (padding only)                                   |
  | Statistics 118, 148         | category name; month label                   | body · medium · text                                      | `bodyMedium`                                                                                     |
  | Statistics 119              | plan gap                                     | caption · muted; over: `over` · tabular                   | `caption color={gap.over ? 'over' : 'muted'} tabular`                                            |
  | Statistics 122              | category spent                               | amount · text                                             | `amount`                                                                                         |
  | Statistics 123, 149         | "of €…"; "Income … · Spent …"                | caption · muted · tabular                                 | `caption muted tabular`                                                                          |
  | Statistics 212              | period (`numberOfLines={1}`)                 | title · text · flexShrink 1                               | `title`, `style={styles.periodText}` (`{ flexShrink: 1 }`)                                       |
  | Statistics 264              | period menu item                             | body · medium · text; checked: semibold face              | `variant={checked ? 'bodyStrong' : 'bodyMedium'}` (Open question 2)                              |
  | category 127                | name                                         | display · text                                            | `display`                                                                                        |
  | category 128, 135, 137, 148 | "N expenses · …"; "Spent"; "≈ ₴…"; day total | label · regular · muted · tabular                         | `labelRegular muted tabular`                                                                     |
  | category 136                | total                                        | amountLg · text                                           | `amountLg`                                                                                       |
  | category 142                | "No expenses in …"                           | label · regular · muted · tabular · paddingHorizontal xs  | `labelRegular muted tabular`, `style={styles.empty}`                                             |
  | category 147                | day label                                    | label · semibold · muted · +0.5                           | `labelSemi muted`, `style={styles.dayLabel}` (`{ letterSpacing: 0.5 }`; disable and reason kept) |
  | category 160                | item name                                    | body · medium · text                                      | `bodyMedium`                                                                                     |
  | category 161                | ₴ amount                                     | caption · muted · tabular                                 | `caption muted tabular`                                                                          |
  | category 163                | € amount                                     | amount · text                                             | `amount`                                                                                         |
  | category 203                | ⋯ menu row                                   | body · medium · danger                                    | `bodyMedium danger`; its comment moves to the JSX                                                |

- **The nested " of €…"** (Expenses 169). Today it sets only the regular face and `muted`, and inherits the `amount`
  parent's size 15, line height 20, tracking −0.2 and tabular digits. As `variant="body"`, it sets the same 15/20/−0.2
  itself, in the same regular face. `body` has no `fontVariant`, so the tabular digits are still inherited. On web the
  computed values are identical, and the snapshot row of its `<span>` shows that. Prettier breaks it over four lines,
  with the leading space as `{' '}`. The rendered text is the same.
- **Moved comments** (the draft's wording):
  - Income: `{/* The month's total, as big and bold as the heading beside it (brief 107). */}` above the total.
  - Expenses: `{/* Red like the bar, so the words say it's over too (brief 107); 5.3:1 on light `surface`, 7.6:1 on
dark. */}` above the `overCents > 0 &&` line.
  - Category page: `{/* A menu row, not a button (brief 104c), so its label is text in the danger colour. */}`
    above the row's `Text`. Today's "so it keeps its own style" would go stale once the style is gone.
- **Caller clean-up** (lint doesn't catch unused StyleSheet keys; the draft has none left):
  - Styles go: Home and demo Home `title`, `caption`; Budget `balance`, `sectionTitle`, `small`, `figureValue`,
    `rowAmount`; Income `sectionTitle`, `total`, `small`, `rowName`, `rowAmount`; Expenses `figureValue`,
    `sectionTitle`, `small`, `rowPlanned`, `overText`; Statistics `title`, `menuText`, `menuTextOn`, `rowName`,
    `rowAmount`, `negative`, `over`, `small`; category `menuDelete`, `title`, `caption`, `small`, `total`,
    `itemName`, `itemAmount`.
  - Styles cut down to layout: Budget `rowName` (`flex: 1`), Expenses `rowName` (`flexShrink: 1`) and `rowAmount`
    (`flexShrink: 0`), Statistics `periodText` (`flexShrink: 1`) and `sectionTitle` (`paddingHorizontal: space.xs`),
    category `dayLabel` (`letterSpacing: 0.5`).
  - `Text` leaves each `react-native` import, and `import { Text } from '@/components/Text';` goes after the last
    `@/components/*` import that sorts before it. `fonts` and `text` leave all 7 `@/theme` imports. `useColors`
    stays in every file (spinners and icons), and only Budget's `IncomeFigures` stops calling it.
- **Demo:** every touched demo screen (Home, Budget, Income, Expenses, the category page) already imports
  `Text.tsx` through 104f's components, and Statistics isn't in the demo. So `demo-modules.txt` doesn't change, and
  `yarn mobile check-builds` passes without `--accept`.
- Reuses: 104f's `Text` and its variants; the 104–104f snapshot script (Visual check). There's no new helper.
- New dependencies: none.

## Version

Bump: patch — 1.23.9 → 1.23.10
Why: §8b `patch`. This is a behaviour-preserving refactor of shipped app code: the same type, colours, roles and
labels. No new capability, and no API, schema or connector change.

## Slices

Before slice 1, the orchestrator takes the **before** set (Visual check). The line counts come from the scratch draft.
Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, unpiped. Export `DATABASE_URL_TEST`
from the main checkout's `.env` in this worktree, or the API integration tests skip. No unit tests are added: no pure
logic changes, and `Text` imports `react-native`, which the app's Node tests can't load (conventions §6).

- [ ] 0. Bump version to 1.23.10
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.10
- [ ] 1. Draw Home's, Budget's and Income's text with Text (~89 lines)
  - Files: `src/app/(tabs)/index.tsx`, `src/demo-app/(tabs)/index.tsx`, `src/app/(tabs)/budget.tsx`,
    `src/app/(tabs)/income.tsx` (under `apps/mobile`)
  - Change: their rows in the Contracts table, and the clean-up. `IncomeFigures` passes its over state as `color`.
  - Verify: gates. Snapshots: `home`, `budget`, `budget-ended`, `income`; `demo-home` on the demo.
- [ ] 2. Draw Expenses' and the category page's text with Text (~104 lines)
  - Files: `src/components/Text.tsx` (`captionMedium`), `src/app/(tabs)/expenses.tsx`,
    `src/app/category/[categoryId].tsx`
  - Change: the new pair with its caller, the nested " of €…", their rows in the table, and the moved comments.
  - Verify: gates. Snapshots: `expenses`, `expenses-scrolled`, `category`, `category-scrolled`, `category-menu`,
    `category-empty`.
- [ ] 3. Draw Statistics' text with Text (~59 lines)
  - Files: `src/app/(tabs)/statistics.tsx`
  - Change: its rows in the table. The menu item switches variant on `checked`.
  - Verify: gates; the AC1 searches (AC → evidence). Snapshots: `statistics`, `statistics-menu`, `statistics-period`.
    Then every view of the set in both schemes, the demo check and `check-builds`.

## What moves (the PR lists this)

- **Expected: nothing.** Every view in both schemes should match in every row, type columns included, with the same
  accessibility record. A difference is a bug in the slice that caused it, and gets fixed rather than listed.
- **Not caught by the snapshots, and listed:**
  - The nested " of €…" sets body's size, line height and tracking itself instead of inheriting them: the same
    values.
  - Statistics' checked period draws as `bodyStrong` instead of a semibold face patched onto the medium row: the same
    values (`IBMPlexSans_600SemiBold`, 15/20/−0.2).
  - Budget's `IncomeFigures` no longer reads the palette itself, because `Text` does that now.

## Visual check (AC3–AC5; not counted in the line estimates)

**Set-up.**

- Run `api`, `web` (port 8081, or a free one) and `web-demo` (8082) from this worktree, with the two git-ignored
  `.env` files copied in. Check `git status` is clean before the before set.
- **Same day, in November.** Take both sets on the same Kyiv day, well before midnight: Home's month, the category
  page's day labels and Statistics' "Current month" all follow the date. From 1 December, November has ended and the
  "+" buttons, ⋯ and the menus disappear. If the day changes between the sets, take both sets again on that day's
  data, with the same view names.
- **One QA user**, created before the before set and deleted when the brief is done:
  `yarn api create-user --username claude-qa-104g --email …`. Its ledger gets the default categories for November
  only.
- **Seed through the API as that user** (signed in from the page, credentials included), once, before the before
  set. Check `GET …/expenses?month=2026-11` returns 11 and `GET …/months/2026-11/income` returns only Salary before seeding again, so nothing is doubled
  (the expense and income POSTs aren't idempotent; the plan PATCHes are):
  - `GET /api/ledgers` gives the ledger id. From `GET /api/ledgers/<id>/categories?month=2026-11`, note
    `categories[0]` (rent) as **C**, `categories[1]` (groceries) as **D** and `categories[2]` (education) as **F**.
  - Income first, because brief 060 refuses plans over income: `POST /api/ledgers/<id>/months/2026-11/income` with
    `{ title: 'Salary', amount: '200.00' }`.
  - Plans: `PATCH /api/ledgers/<id>/categories/C/months/2026-11` and `…/D/…`, each with `{ amount: '100.00' }`.
  - Ten expenses in C with `POST /api/ledgers/<id>/expenses`, dated 2026-11-01 to 2026-11-10:
    `{ categoryId: C, expenseDate, name: 'qa', amount: '12.50', currency: 'EUR' }`. That's €125, **€25 over**, and
    ten days, enough to scroll the category page 400pt (104e).
  - One expense in D, dated 2026-11-03, amount `'95.00'`: **near plan** (95%, a yellow bar).
  - F keeps no expenses: `category-empty`.
  - What it shows: Expenses' Remaining −€20 in `danger` and C's "€25.00 over"; Statistics' Left −€20 in `danger`, C's
    gap in `over` and D's "€5.00 under"; Budget's figures €200 / €200 / €0.00.
- TOTP codes come from a scratch script outside the repo, and the secret is never printed. Wait for a fresh 30 s
  window between sign-ins, and don't guess: wrong codes count against the limit.
- Another session may share the MySQL test database. If the integration tests fail in the schema reset, wait until
  the other run is idle and run them again. Never commit after a failed `yarn test`.

**Snapshot script:** 104f's, installed on both origins (app and demo). Every row holds the element's tag, box,
background, top border, radius, padding, opacity, colour, `zIndex`, then font family, size, line height, tracking,
`fontVariantNumeric`, weight and alignment, then a leaf's first 24 characters. `cmp` also returns the width (must be
390), `a11yAdded` and `a11yRemoved`. Keys: `snap:before:104g:<view>:<scheme>` and `snap:after:104g:*`. I checked the
snippet's syntax and `cmp`'s record difference in Node:

```js
localStorage.setItem(
  '__snapSrc',
  `(key) => { const rows = []; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue; const s = getComputedStyle(el); const own = el.childElementCount === 0 ? (el.textContent || '').trim().slice(0, 24) : ''; rows.push([el.tagName, Math.round(r.x * 2) / 2, Math.round(r.y * 2) / 2, Math.round(r.width * 2) / 2, Math.round(r.height * 2) / 2, s.backgroundColor, s.borderTopWidth + ' ' + s.borderTopColor, s.borderTopLeftRadius, s.padding, s.opacity, s.color, s.zIndex, s.fontFamily, s.fontSize, s.lineHeight, s.letterSpacing, s.fontVariantNumeric, s.fontWeight, s.textAlign, own].join('|')); } const a11y = [...document.querySelectorAll('[role],[aria-label]')].map((e) => e.getAttribute('role') + '|' + e.getAttribute('aria-label')); localStorage.setItem(key, JSON.stringify({ rows, a11y })); return [key, rows.length, a11y.length, innerWidth, innerHeight]; }`,
);
localStorage.setItem(
  '__cmpSrc',
  `(view, scheme) => { const before = JSON.parse(localStorage.getItem('snap:before:104g:' + view + ':' + scheme)); const afterKey = 'snap:after:104g:' + view + ':' + scheme; eval(localStorage.__snapSrc)(afterKey); const after = JSON.parse(localStorage.getItem(afterKey)); const diffs = []; for (let i = 0; i < Math.max(before.rows.length, after.rows.length); i++) if (before.rows[i] !== after.rows[i]) diffs.push(i + ': ' + before.rows[i] + '  =>  ' + after.rows[i]); const minus = (a, b) => { const left = [...b]; return a.filter((x) => { const i = left.indexOf(x); if (i < 0) return true; left.splice(i, 1); return false; }); }; return { view, scheme, width: innerWidth, rows: [before.rows.length, after.rows.length], diffs: diffs.length, first: diffs.slice(0, 4), a11ySame: JSON.stringify(before.a11y) === JSON.stringify(after.a11y), a11yAdded: minus(after.a11y, before.a11y), a11yRemoved: minus(before.a11y, after.a11y) }; }`,
);
localStorage.setItem(
  '__scrollSrc',
  `() => { const el = [...document.querySelectorAll('div')].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 400); if (!el) return -1; el.scrollTop = 400; return el.scrollTop; }`,
);
```

Use it at 390×844, Light then Dark per view (`localStorage.setItem('kopiyka.theme', 'light')` or `'dark'`, then
reload). Navigate, wait about 2 s, then snapshot with `eval(localStorage.__snapSrc)('snap:before:104g:<view>:<scheme>')`.
Don't click in the Browser pane while sets are compared, and check `innerWidth === 390` in every result.

**Views, in this order, the same in both sets:**

| View                | Where / how                                                                                                              | Shows (this part's text)                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `home`              | `/`                                                                                                                      | ledger label ("Kopiyka"), month                                            |
| `budget`            | `/budget?month=2026-11`                                                                                                  | Start → End line, IncomeFigures, "Categories", "€… planned", 15 rows       |
| `budget-ended`      | `/budget?month=2026-10`                                                                                                  | the ended month as it stands for this ledger (Open question 3)             |
| `income`            | `/income?month=2026-11`                                                                                                  | "Income", the total, Salary's row                                          |
| `expenses`          | `/expenses?month=2026-11`                                                                                                | figures (Remaining in danger), headings, rows with " of €…", "€25.00 over" |
| `expenses-scrolled` | On `expenses`, `eval(localStorage.__scrollSrc)()` (must return 400), take a screenshot, then snapshot. Reload afterwards | the same rows, moved under the header                                      |
| `statistics`        | `/statistics`                                                                                                            | title (`header`), period, totals (Left in danger), By category with gaps   |
| `statistics-menu`   | On `statistics`, press the period button; snapshot with the menu open; then press Close menu                             | the menu: "Current month" checked (`bodyStrong`), four `bodyMedium` rows   |
| `statistics-period` | On `statistics`, open the menu and press Last 3 months; snapshot. Reload afterwards                                      | By month: Sep, Oct, Nov (Nov's Left in danger) (Open question 4)           |
| `category`          | `/category/C?month=2026-11`                                                                                              | name, caption, Spent card, day labels (+0.5) and totals, items             |
| `category-scrolled` | On `category`, the same scroll, screenshot and snapshot. Reload afterwards                                               | the same text, and CollapsingSummary at opacity 1                          |
| `category-menu`     | On `category`, press ⋯ (Category actions); snapshot; then press Close menu                                               | "Remove from November" (`bodyMedium danger`)                               |
| `category-empty`    | `/category/F?month=2026-11`                                                                                              | "No expenses in November."                                                 |
| `demo-home`         | demo origin (`web-demo`, 8082), `/`, no sign-in                                                                          | the demo's "Kopiyka" and month                                             |

- Before comparing a `*-scrolled` view, confirm the scroll returned 400 and the summary or divider row shows opacity
  1. If not, take a screenshot and snapshot again.
- **After set:** per slice as listed in Slices, then all 14 views × 2 schemes after slice 3, compared with
  `eval(localStorage.__cmpSrc)('<view>', '<scheme>')`. Expected on every one: `diffs: 0`, `a11ySame: true`, empty
  `a11yAdded` and `a11yRemoved`, `width: 390`. Screenshots go in the PR, not the repo.

**Checked from the code only** (listed as such in the PR):

- **Budget's ended rows.** They render the same `content` fragment as the open rows. Only the wrapper differs.
- **Budget's Remaining below zero.** Brief 060 refuses plans over income from 2026-11 on, and ended months can't be
  written through the API, so no seedable month shows it. It's the same `color` switch as Statistics' Left.
- **Expenses' figures while loading** (`muted` "—") and the category page's loading and error states. The loading
  state lasts a moment, and the errors are 104f's `LoadError`.

**Demo (AC5):** `web-demo` (8082), Light and Dark, with the console open. Check Home, Budget, Income, Expenses
scrolled and a category page scrolled. There should be no errors. `yarn mobile check-builds` (no `--accept`) passes on
the last commit, after `yarn mobile export:web`.

**Gate B, iPhone (Expo Go):** Home, Budget, Expenses and Statistics (with its menu open), in both themes. On
Expenses, the " of €…" stays muted and in line with the amount, and "€25.00 over" stays red.

## AC → evidence

| AC                                                                                      | Evidence                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 every `<Text>` in the 7 files through `Text`; no role spread, no `fontFamily`       | Slices 1–3. After slice 3, over the 7 files: `rg -n "\.\.\.text\."` and `rg -n fontFamily` find nothing (two searches, so the command needs no escaped pipe); `rg -U -n "import \{[^}]*\bText\b[^}]*\} from 'react-native'"` finds nothing; `rg -c "<Text\b"` still counts 50, and each file imports `Text` from `@/components/Text` |
| AC2 `Text.tsx` gains only `captionMedium`, from an existing role and face; no new token | Slice 2. `git diff origin/main -- apps/mobile/src/components/Text.tsx` is the two lines in Contracts, `{ ...text.caption, fontFamily: fonts.bodyMedium }`. `git diff origin/main -- apps/mobile/src/theme.ts` is empty                                                                                                               |
| AC3 before/after snapshots of the 13 listed views, light and dark; nothing moves        | Visual check: the brief's 13 views (the empty category is `category-empty`) plus `statistics-period`, × Light and Dark. Expected `diffs: 0` with the type columns everywhere; any shift is listed in the PR for approval                                                                                                             |
| AC4 roles and labels unchanged                                                          | `a11ySame: true` and empty `a11yAdded`/`a11yRemoved` on every view, including Statistics' `header`, the menus' `radio`/`radiogroup` and the rows' button labels                                                                                                                                                                      |
| AC5 the demo renders the touched screens with no console errors; `check-builds` passes  | `demo-home` in both sets; after slice 3, the demo screens in both themes with a clean console; `check-builds` without `--accept` passes (no module list change)                                                                                                                                                                      |
| AC6 gates                                                                               | Every slice                                                                                                                                                                                                                                                                                                                          |

## Not doing (YAGNI)

- **104h's screens** (Settings, Members, the forms' screens, login, no-ledger) and the final AC2 search over all of
  `src`.
- **105's look**: Inter, new sizes, tracking and colours; an overline role for the +0.5 day labels.
- **Dropping `tabular` from text with no digits** (Budget's figure labels, the category page's "Spent" and "No
  expenses"). It's today's style, and 105 can drop it (104f's Follow-ups).
- **Seeding an ended month through the database** for `budget-ended` (Open question 3).
- **A lint guard** against role spreads and `fontFamily` in screens. It's proposed after 104h (104f's Follow-ups).
- **Docs.** `docs/design/design-system.md`'s `Text` row stays true. The BACKLOG row belongs to the orchestrator.

## Risks

- **The nested " of €…" changes on web or iOS** once it sets its own size and line height. It shouldn't, since the
  values are equal. Slice 2's `expenses` rows compare its `<span>` (font, size, line height, tracking, tabular);
  Gate B looks at it on the iPhone.
  - If a row moves, stop and report it at review. There's no fallback inside the ACs: a face in a `style` breaks
    AC1, and a second new pair breaks AC2.
- **A computed type value changes where no box moves** (a face or tracking lost in the move). The type columns catch
  it in each slice's views.
- **Statistics' menu or the ⋯ menu closes before its snapshot.** Snapshot right after opening, and confirm the menu's
  rows are in the record.
- **The day changes, or November ends, between the sets.** Covered in Set-up.
- **Main moves.** Rebase, take main's version and bump once more (§8b). If the move changes a snapshotted view, take
  a fresh baseline from main's copy of that file (104 script, step 7).

## Open questions

1. **Blocking: yes (Gate A). One PR, or split again?** (brief open question 1)
   - Recommended: **one PR** in three slices. The scratch draft measures 252 lines, under the 400 limit, and close to
     104f's estimate of 256.
   - Assumed: one PR.
2. **Blocking: yes (Gate A). Statistics' checked period** (brief open question 2).
   - Recommended: **a state switch, `variant={checked ? 'bodyStrong' : 'bodyMedium'}`**, as LedgerPicker does in
     104f.
   - Today every item is body in the **medium** face, and the checked one patches in the semibold face, which is
     exactly `bodyStrong`. So the unchecked side is `bodyMedium`, not `body`.
   - `body` would draw the four other items in the regular face. `bodyStrong` on every item would make them all
     semibold. Either would show in the `statistics-menu` rows.
   - Assumed: as recommended.
3. **Blocking: no. `budget-ended` has no rows.** A fresh user's ledger has categories only in November. The API
   refuses to add or copy into an ended month (`409 month_ended`), and October is before the ledger's first month,
   so it has no Start → End line either. `/budget?month=2026-10` shows the header and EmptyMonth ("No budget for
   October yet", no Copy). The ended rows draw the same `content` as `budget`'s open rows.
   - Assumed: take `budget-ended` as it stands, as 104e did, and list the ended rows as checked from the code.
   - The alternative would seed October's list in the local database by hand. That's more set-up, for rows that
     share their JSX with `budget`.
4. **Blocking: no. An extra view, `statistics-period`.** Statistics' By month section (3 sites and a negative switch)
   only shows on a period longer than one month. None of the brief's views shows it. Assumed: added, with Last 3
   months chosen from the menu.
5. **Blocking: no. Correction to the brief: the nested " of €…" takes `variant="body"`**, so it sets body's size,
   line height and tracking itself. They equal its `amount` parent's, and only the tabular digits are still
   inherited. This is the 104f outline's form, and the snapshot shows whether it holds (Risks).

## Gate A (2026-11-26)

Approved by the user as recommended: one PR in three slices; Statistics' period items switch
`variant={checked ? 'bodyStrong' : 'bodyMedium'}`; the non-blocking assumptions stand (`budget-ended` taken as it is,
with the ended rows checked from the code; `statistics-period` added; the nested " of €…" takes `variant="body"`).
Both snapshot sets are taken before 1 December (Kyiv).

## Follow-ups

- None found while planning.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

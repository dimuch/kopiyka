# Plan: Put the app's styles on design tokens (part 1: tokens, guard, tab screens)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/design-tokens
Base: origin/main (5881fb5, version 1.17.1)

## Approach

`theme.ts` gains four plain token objects (`space`, `radius`, `size`, `text`), with values from
`docs/design/design-system.md`. The text roles are set in today's faces. A `no-restricted-syntax` lint rule bans
number literals in the AC2 style keys. It starts with every current file on a "not on tokens yet" ignore list. Each
migration slice moves its files onto tokens and deletes them from that list, so `yarn lint` proves the slice is
complete. `makeStyles(colors)` and `useThemedStyles` stay as they are, and tokens are plain imports.

**Split (size).** The guard finds 484 literals in 38 files. Moving all of them is about 1,085 changed lines, so the
brief ships as three sequential briefs. Each one branches from `origin/main` after the previous one merges, with no
stacking:

| Brief          | What ships                                                                            | ≈ lines |
| -------------- | ------------------------------------------------------------------------------------- | ------- |
| 103 (this one) | tokens, guard, conventions, the six tab screens, the demo Home and `PlaceholderPage`  | 380     |
| 103b           | the shared components (`src/components/*`, `src/demo/DemoStrip.tsx`)                  | 365     |
| 103c           | the other screens (forms, category, Members, Login, no-ledger) and `theme.dangerText` | 340     |

103c empties the ignore list, which completes AC2 for the whole app. AC5's expense form, category form, Members and
Login screenshots belong to 103c, and 103b re-checks the tabs, since their components change there. Part 2 and 3
outlines are under "Later parts".

Alternatives considered:

- **Add half steps (6, 10, 14, 18) to `space`.** This would mean no spacing shift now. But those steps exist only for
  today's look, so brief 105 would then have to edit screens again to leave them. That defeats the brief's aim of
  making 105 mostly a `theme.ts` change. I'm not proposing a spec change.
- **A Vitest source scan as the guard.** It would give one central allowlist, but it works on regexes, so it misses
  or over-matches ternaries, maths and multi-line values. It also gives no feedback in the editor. The lint rule is
  AST-exact and already runs in `yarn lint`, and brief 095 set the precedent.
- **Guard in the last slice.** Rejected: the shrinking ignore list lets every slice prove its own files.

## Contracts

- DB / API: none.
- App, `apps/mobile/src/theme.ts`, below `fonts` (I type-checked this shape against RN types in a scratch file):

  ```ts
  /** Spacing on the 4pt grid (docs/design/design-system.md). */
  export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;
  /** Corner radii; `pill` rounds any box fully (a radius is clamped to half the side). */
  export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
  /** Control heights; `iconButton` is also the 44pt touch minimum. */
  export const size = { control: 48, iconButton: 44, chip: 32 } as const;

  // Type roles from the design system, in today's faces until brief 105 brings Inter. The face carries the weight:
  // each family has one weight, and a fontWeight would make web draw a fake bolder one.
  const display = { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -1 } satisfies TextStyle;
  const bodyStrong = {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  } satisfies TextStyle;
  export const text = {
    display,
    title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.8 },
    heading: { fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
    bodyStrong,
    label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },
    caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    /** Money: tabular digits, so amounts line up. */
    amount: { ...bodyStrong, fontVariant: ['tabular-nums'] },
    amountLg: { ...display, fontVariant: ['tabular-nums'] },
  } satisfies Record<string, TextStyle>;
  ```

  Faces for the spec's weights: 800 → Bricolage 700 (the heaviest face loaded in `AppShell`), 600 → `bodySemi`,
  500 → `bodyMedium`, 400 → `body`.

- Lint, `apps/mobile/eslint.config.js`. The existing accessibilityState entry moves into a const (`noAccessibilityState`).
  A second config object follows the global one. A later object _replaces_ a rule's options, so the second object
  repeats that entry (verified in a scratch run):

  ```js
  // Brief 103: style numbers come from the tokens in src/theme.ts (docs/design/design-system.md).
  const noRawStyleNumber = {
    selector:
      'Property[key.name=/^(fontSize|lineHeight|letterSpacing|border[A-Za-z]*Radius|padding[A-Za-z]*|margin[A-Za-z]*|gap|rowGap|columnGap)$/] Literal[raw=/^[0-9.]/]',
    message:
      'Use space, radius, size or text from @/theme. Layout maths with no token: eslint-disable-next-line no-restricted-syntax, with the reason on the line above.',
  };
  // Files not moved onto tokens yet; briefs 103b and 103c empty this list.
  const notOnTokensYet = [/* 38 paths; brackets escaped: 'src/app/category/\\[categoryId\\].tsx' */];
  { files: ['src/**/*.{ts,tsx}'], ignores: ['src/theme.ts', ...notOnTokensYet],
    rules: { 'no-restricted-syntax': ['error', noAccessibilityState, noRawStyleNumber] } }
  ```

  The descendant selector also catches `-8`, ternaries and maths (`size * 0.43`), including inline `style={{ }}`. It
  passes `fontVariant`, `width`/`height` and `borderWidth`. Over today's `src` it flags exactly the 484 literals plus
  `theme.ts`'s own 3.

- **Snapping rules** (the contract slices 3–5 follow, and 103b/103c reuse):
  - **Space:** nearest step. Ties go to the multiple of 8: 6 → `sm` 8, 10 → `sm` 8, 14 → `lg` 16, 18 → `lg` 16,
    22 → `xxl` 24. Odd 5 → `xs`, 7 → `sm`. Ties move up and down in turn, so totals stay near today's. Negative
    margins become `-space.x`.
  - **Radius:** nearest step. 12 → `md` (a tie). It only shows as the 44pt icon buttons' press and focus shape, and
    `md` is the spec's step for 44–48pt controls. 18 and 22 → `lg`. A radius of half a box or more (bars 3 on 5pt,
    the 20 on the 40pt avatar, 24 on the 48pt button) → `pill`, which looks the same.
  - **Size:** `width`/`height`/`minHeight` 44 → `size.iconButton`, 48 → `size.control`, 32 → `size.chip`. Other
    dimensions (40 avatar, 5 bar, 52/56 rows) aren't control heights. AC2 doesn't guard them, so they stay.
  - **Type:** today's size picks the role: 12 caption; 13 and 14 label; 15 and 16 body (bodyStrong when the face is
    `bodySemi`); 17 and 18 heading; 20–24 title; 26–40 display. Ties (14, 16) go to the smaller role, whose line
    height is closest to today's natural one. When today's face differs from the role's, today's face stays, as a
    `fontFamily` override after the spread. Examples: Bricolage 17 section titles → `{ ...text.heading, fontFamily:
fonts.display }`, and `bodyMedium` 15 → `body` + `bodyMedium`. Explicit `letterSpacing`/`lineHeight` come from the
    role.
  - **Money:** a figure at 15/16 → `text.amount`, and at display size → `text.amountLg`. A figure at another size
    (caption, label, heading) keeps its role and adds `fontVariant: ['tabular-nums']`, so its size doesn't jump 2–3pt
    (Open question 4).
  - **Allowlist:** `// eslint-disable-next-line no-restricted-syntax`, with the reason on the line above (conventions
    §7). `rg -n 'disable-next-line no-restricted-syntax' apps/mobile/src` lists them all.
- Reuses: `fonts`, `useThemedStyles`, `outlinedDangerButton`/`outlinedDangerText` (re-based on tokens), and brief
  095's `no-restricted-syntax` entry.
- New dependencies: none.

## Version

Bump: patch — 1.17.1 → 1.17.2
Why: §8b `patch` ("styling, behaviour-preserving refactor"). Shipped app code changes and spacing and type shift
slightly, but nothing new can be done and no API, schema or connector changes. 103b and 103c each bump patch again.

## Slices

- [x] 0. Bump version to 1.17.2
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.17.2
- [x] 1. Add spacing, radius, size and type tokens to the theme (~50 lines)
  - Files: `apps/mobile/src/theme.ts`
  - Change: the Contracts block. `outlinedDangerButton` → `height: size.control, borderRadius: radius.pill`, and
    `outlinedDangerText` → `{ ...text.bodyStrong, color: colors.danger }`. `dangerText` waits for 103c with its
    screens.
  - Verify: `yarn typecheck`. Compare each value with the spec's Type and "Spacing, radius, size" tables. Sign out
    (Settings), Leave ledger (Members) and Sign out (no-ledger) look the same, apart from the role's line height and
    tracking: all three use these helpers. No unit test: these are constants,
    and §6 rules out snapshot-style asserts.
- [x] 2. Fail lint when a style sets a raw spacing, radius or type number (~60 lines)
  - Files: `apps/mobile/eslint.config.js`, `.claude/skills/kopiyka-conventions/SKILL.md`
  - Change: the rule from Contracts, with all 38 files on `notOnTokensYet`. In conventions §2, the `theme.ts` "Owns"
    cell becomes ``palettes, fonts, style tokens (`space`, `radius`, `size`, `text`), category hues, `phoneWidth` —
the only place for raw hex, font names and style numbers``. That's 155 characters, within the 164-character
    column, so Prettier doesn't reflow the table. §5 gets a bullet after Styles: spacing, radius, control heights and
    type come from those tokens (values: `docs/design/design-system.md`). Money uses `text.amount`/`amountLg`, or
    its role plus tabular digits. A number literal is only for layout maths, allowlisted with a reason, and lint
    enforces this. Don't route style numbers through named constants (`padding: PAD`) to dodge the guard.
  - Verify: `yarn lint` passes. Then (AC3) add `fontSize: 14` to any style in a file _not_ on the list (e.g. a
    scratch `src/components/Scratch.tsx` exporting one `StyleSheet.create`) and see `yarn mobile lint` fail with the
    message. Add `accessibilityState={{ busy: true }}` there too and see it still fail, which shows the override kept
    095's rule. Revert, and record both in the PR test plan.
- [x] 3. Put Budget and Income on tokens (~85 lines)
  - Files: `src/app/(tabs)/budget.tsx`, `src/app/(tabs)/income.tsx`, `eslint.config.js` (−2 list entries)
  - Change: snapping rules. Budget's inline `{ paddingBottom: 104 }` becomes `styles.toastRoom`, with the one
    allowlist entry and the reason "UndoToast's bottom 32 + height 56 + 16pt gap: toast clearance, not a step".
    Money: `figureValue`, `rowAmount` → `amount`. `small` and `balance` keep caption/label and add tabular digits.
    Income: `rowAmount` → `amount`; `small` (it renders `{eur(incomeCents(items))} total`) keeps caption and adds
    tabular digits.
  - Verify: `yarn lint` (the files are now guarded). Visual check for Budget and Income.
- [x] 4. Put Expenses and Statistics on tokens (~110 lines)
  - Files: `src/app/(tabs)/expenses.tsx`, `src/app/(tabs)/statistics.tsx`, `eslint.config.js` (−2)
  - Change: snapping rules. Expenses `total` → `amountLg` (34 → 28, Open question 2). `rowAmount` → `amount`, and
    the nested "of €x" inherits it. `budget` → heading plus tabular digits, and `overText` → caption plus
    `bodyMedium` plus tabular digits. Statistics `periodText` → title (20 → 22, Open question 2), `rowAmount` →
    `amount`, and `small` (gap and "of €x") adds tabular digits.
  - Verify: `yarn lint`. Visual check for Expenses (card collapsing on scroll) and Statistics (period menu open).
- [x] 5. Put Home, Settings and the demo Home on tokens (~75 lines)
  - Files: `src/app/(tabs)/index.tsx`, `src/demo-app/(tabs)/index.tsx`, `src/app/(tabs)/settings.tsx`,
    `src/components/PlaceholderPage.tsx` (Settings' shell; its `gap: 6` and Settings' "same 6pt" comment stay
    paired at 8, and the comment says 8), `eslint.config.js` (−4)
  - Change: snapping rules. Settings `spacer` `minHeight: 24` → `space.xxl`.
  - Verify: `yarn lint`. Visual check for Home and Settings, the demo check (AC6), and the full after set.

Every slice runs `yarn format:check && yarn lint && yarn typecheck && yarn test`, without piping. In this worktree,
export `DATABASE_URL_TEST` from the main checkout's `.env`, or the API integration tests skip.

**What moves in part 1** (the PR lists this):

- Spacing ±2pt:
  - header `paddingBottom` 10 → 8 (Budget, Income, Expenses, Statistics) and Budget `balance` 10 → 8
  - content `gap` 14 → 16 (same four), Budget `figures` and Settings `account` `paddingVertical` 14 → 16
  - Expenses card `paddingHorizontal` 18 → 16 and `gap` 10 → 8, row inner `gap` 7 → 8, and the Budget column's
    `paddingBottom` 6 → 8
  - Statistics switcher `paddingBottom` 6 → 8, Budget `edit` `marginRight` 6 → 8, Settings/PlaceholderPage `gap` 6 → 8
  - Home `gap` 18 → 16, and Settings `members` `paddingLeft` 18 → 16 and `paddingVertical` 10 → 8 (`minHeight` 44
    keeps its height)
- Radius: cards 22 → 20, Settings `members` 18 → 20, icon buttons 12 → 14 (press and focus only).
- Type ≤1pt: `figureValue`/`username` 16 → 15, Settings `error` 14 → 13.
- Type >1pt: Expenses total 34 → 28, and Statistics period 20 → 22.
- Line heights, measured from the bundled TTFs: natural is 1.3× for Plex and 1.2× for Bricolage. Caption +0.4,
  label +1.1, body +0.5, Bricolage heading +1.6, title +1.6. The Expenses total's box goes 40.8 → 34.
- Tracking: the spec's role values (Open question 3). Text tightens 0.1–0.4pt per letter and titles 0.8pt, and the
  Expenses total goes −0.7 → −1.

**Visual check** (AC5, part 1 screens). I didn't count it in the line estimates.

1. Start `api` and `web` from `.claude/launch.json` in this worktree. It's a sibling folder, so Metro is fine here.
2. Open the in-app browser at 390×844 and sign in as the local QA user, with a TOTP code from a scratch script
   (brief 095's recipe). Don't print the secret.
3. Same data and month for both sets. Before: on Base, before slice 1. After: after slice 5.
4. Screens: Home, Budget, Expenses, Income, Statistics (and its period menu), Settings, each in Light and then Dark
   (Settings → Appearance).
5. Compare each pair against the list above. Any other difference is a bug in the slice that caused it. The
   screenshots go in the PR, not the repo.

At Gate B, the same screens on iPhone in Expo Go: line heights are set explicitly now, and iOS places text
differently from web.

## AC → evidence

| AC                                                       | Evidence                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 typed tokens with the spec's values                  | Slice 1: `yarn typecheck`; Verify compares the values with the spec tables. Faces stay today's, as the brief says                                                                                                                                                                                              |
| AC2 no number literals outside `theme.ts`                | Slices 2–5: `yarn lint` green with the rule on. After slice 5, the list holds only the 30 files of 103b/103c, and the only allowlist entry is Budget's toast clearance. 103c empties the list                                                                                                                  |
| AC3 `fontSize: 14` fails                                 | Slice 2 Verify: scratch file → `yarn mobile lint` fails, then revert. Also true in every guarded screen from slice 3 on                                                                                                                                                                                        |
| AC4 tabular digits                                       | Slices 3–5: every money Text in the part 1 files uses `amount`/`amountLg` or tabular digits (listed per slice). Fact: IBM Plex Sans digits are fixed-width already (all 600 units, measured), and Bricolage money had `tabular-nums` and keeps it via `amountLg`. Visual: Statistics' By month amounts line up |
| AC5 screenshots, no layout change beyond the listed ones | Visual check above for the six tabs, light and dark. The list above goes in the PR for approval. The expense form, category form, Members and Login move to 103c                                                                                                                                               |
| AC6 demo renders                                         | Slice 5: launch `web-demo` (port 8082), open each tab in Light and Dark: no red screen, no console errors                                                                                                                                                                                                      |
| AC7 gates                                                | Every slice                                                                                                                                                                                                                                                                                                    |
| What: conventions §2/§5                                  | Slice 2                                                                                                                                                                                                                                                                                                        |

## Not doing (YAGNI)

- No shared `IconButton`/`Text`/`Card` components, even though the 44pt icon-button style appears 7 times: that's
  brief 104.
- No new colours, no Inter, no shadows, no `fontWeight`: brief 105.
- No token for icon sizes (`<Icon size={18}>`), bar heights or tile sizes. They're not in the spec or AC2.
- No test of the token constants, and no markdown-parsing check against the spec.

## Risks

- **iOS places explicit line heights differently from web.** Slice 3 is the first screen with roles. Check Budget on
  iPhone in Expo Go before slices 4–5 if possible, and at Gate B at the latest.
- **Small shifts add up** down a page: each content gap +2 on four tabs, each header −2. List rows stay at 12, so
  long lists don't drift. The slice 3 screenshots show the real size; if it's too much, the tie rule is the one
  place to change.
- **The flat-config override drops 095's accessibilityState rule.** Disproved by the slice 2 Verify, and in the
  scratch run.
- **Glob characters in ignore paths** (`[categoryId]`). If an entry fails to match, that file gets linted, and lint
  goes red in slice 2 at once. The escaped form was verified in a scratch run.
- **Main moved:** another PR takes 1.17.2. Rebase, take main's number and bump once more (§8b).

## Open questions

- **Blocking: yes (Gate A).** Split 103 into 103 / 103b / 103c as in the table, each a sequential brief and PR?
  Assumed yes. Someone writes the 103b and 103c briefs from "Later parts" after this one merges.
- **Blocking: yes (Gate A).** Approve the >1pt type changes in part 1: Expenses total 34 → 28 (`amountLg`; the spec
  names "hero figure" as `display`) and Statistics period 20 → 22 (title). The alternative is to keep them as
  allowlisted literals until 105. The slice shape is the same either way. Assumed: approve.
- **Blocking: no (Gate A).** Tracking. AC1 asks for the spec's values, but the spec ties negative tracking to Inter,
  and AC5's allowed differences don't mention it. Assumed: the spec's values (AC1 is explicit, and only fonts are
  exempted). The other option, `letterSpacing: 0` in every role until 105, is 7 numbers in slice 1.
- **Blocking: no.** Money at caption, label or heading size keeps its role plus tabular digits, rather than "uses
  `amount` or `amountLg`" (brief What), which would move it 2–3pt. AC4 is met either way.
- **Blocking: no.** The spec's 800 weight renders as Bricolage 700 (the face loaded today), and roles set no
  `fontWeight`.

## Later parts (outline, planned when their brief exists)

- **103b, components (~365 lines):** AddExpenseButton, AmountFields, AppearancePicker, CategoryInMonth (the
  `spinnerMargin` default 32 → `space.xxxl`, and the caller passes `space.xxl`), CategoryPicker, CategorySheet
  (top radii 26 → `xl`), CategoryForm, CategoryTile (`size * 0.3`/`size * 0.43` allowlisted as tile maths), CollapsingSummary,
  DateChips, DateField, EmptyMonth (radius 16 → `md`), HomeButton, HomeCards (figure 20 → title, >1pt), LedgerPicker,
  LoadError, MonthSwitcher (eyebrow `letterSpacing: 0.5` on capitals: allowlist or caption's 0), NotionSyncPanel,
  PendingInvites, ReorderList, TabBar (badge maths allowlisted, and `BADGE_SIZE / 2` → `pill`), UndoToast,
  DemoStrip. It re-checks all six tabs.
- **103c, screens (~340 lines):** category detail (hero 32 → 28; `paddingBottom: 104` allowlisted), category-form,
  delete-category (question 24 → 22; warning 16/24 → body 15/20 is −4pt per line, so it's listed), expense,
  income-item, login (title 40 → 28; the code input's 26 and `letterSpacing: 8` allowlisted as an input), members,
  no-ledger, and `theme.dangerText`. Inputs at 16 must not drop to 15: iOS Safari zooms into inputs under 16px, and
  there's no viewport override. A role's `lineHeight` on a single-line iOS `TextInput` can shift its text, so check
  that on iPhone. It ends with an empty `notOnTokensYet`, and the `ignores` drops it.

## Follow-ups

- Brief 105: spec `body` 15 for inputs would trigger iOS Safari's focus zoom on web, so a 16px input size or a
  viewport rule is needed. 105 should also drop the `fontFamily` overrides that 103 keeps for today's weights.

## Deviations

- Slice 4, measured: Statistics' two-line category rows each grow 0.5–1pt from the roles' line heights (body
  20 vs 19.5 natural, caption 16 vs 15.6), so with 15 categories the last row ends about 15pt lower than before. Each
  element moves less than 2pt; the drift is the sum, not a new step. Budget and Expenses rows don't drift (their
  height comes from the 40pt tile). Listed for the PR; no change to the slices.
- Slice 5, measured: Settings' upper sections add up the listed changes (section gaps 6 → 8, the account card's
  padding 14 → 16, the roles' line heights), so the Appearance picker sits 14.5pt lower. Sign out stays pinned to the
  bottom. Home moves at most 1.5pt.

## Consolidate

Skipped: the branch adds no function, hook, component, route or query, only token constants and style entries.
The screen, header and icon-button styles the tabs still repeat are brief 103b's shared components.

## Revision 1

After the skeptic (approve with edits):

- Slice 3 now lists Income's money styles.
- Slice 1 Verify also covers Members' Leave ledger and no-ledger's Sign out, which use the same helpers.
- The §5 bullet now says not to route style numbers through named constants.
- CategoryForm was missing from both later outlines; it's now in 103b (~365 lines).
- Dropped the prettier follow-up: the orchestrator already formatted `design-system.md`.

The slices and the version are unchanged.

## Gate A (2026-11-22)

Approved by the user: the 103 / 103b / 103c split, both >1pt type changes (Expenses total 34 → 28,
Statistics period 20 → 22), and the spec's letter spacing now (not 0 until Inter).

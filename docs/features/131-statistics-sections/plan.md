# Plan: Statistics in named sections

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/statistics-sections
Base: origin/main (after R13 #201, d9357f14)

## Approach

Roadmap row R15. Three in-file components in `apps/mobile/src/app/(tabs)/statistics.tsx`, placed between
`Statistics` and `PeriodSwitcher` in render order. Each one takes its JSX block out of the screen unchanged: same
elements, keys, accessibility props, styles and why-comments. The only token change is `summary.X` becoming the prop.
The `length > 0` / `length > 1` conditions stay in the screen, so the screen's render reads as "which sections show".
The loading/error/refresh triad and the empty check stay exactly as they are. One commit per component.
Alternative considered: a fourth `SummarySections` component for the whole non-empty branch. It would also drop the
empty-state fragment at line 78, but the brief doesn't name it and it hides which sections show. Rejected.

## Contracts

- DB, API, routes, DTOs, hooks: none.
- Imports: one new line 4, `import type { SummaryCategory, SummaryMonth, SummaryTotals } from '@/api/types';`. Slice 1
  adds it with `SummaryTotals`, and slices 2–3 add the other two names. No import becomes unused.
- `function TotalsCard({ totals }: { totals: SummaryTotals })` renders today's lines 79–102 (`<Card padding="none"
style={styles.totals}>` with the four `key={name}` rows). `summary.totals.*Eur` becomes `totals.*Eur`. The screen
  calls `<TotalsCard totals={summary.totals} />`.
- `function CategoryRows({ categories }: { categories: SummaryCategory[] })` returns today's fragment, lines 104–138
  ("By category" heading and `styles.list` View, rows `key={category.categoryId}`). The screen calls
  `{summary.categories.length > 0 && <CategoryRows categories={summary.categories} />}`.
- `function MonthRows({ months }: { months: SummaryMonth[] })` returns today's fragment, lines 141–172 ("By month",
  rows `key={month.month}`). The screen calls `{summary.months.length > 1 && <MonthRows months={summary.months} />}`.
- What the components close over: only `styles` (`row`, `grow`, `totals`, `list`, `sectionTitle`, `rowText`,
  `amounts`) and the module imports `eur`, `toCents`, `planGap`, `shortMonthLabel`. They use no `colors` (text colour
  is a `Text` token), no period, no navigation and no callbacks. Each one calls `useThemedStyles(makeStyles)` itself,
  as `PeriodSwitcher` and `PeriodMenu` already do. That hook is `useMemo(() => make(colors), [make, colors])`, so it
  returns the same style values from the same `makeStyles`. Each component gets a one-line JSDoc, like its siblings.
- Hooks in `Statistics` keep their order and lines (35–46: `useColors`, `useThemedStyles`, `useTabBarRoom`,
  `useSession`, four `useState`, `useSummary`). `colors` stays in use for the spinner.
- **Nesting depth** of `Statistics`' return, counted as JSX elements from `SafeAreaView` = 1 down to the deepest leaf
  (a TypeScript-AST walk, scratch script):
  - Base: 6 not counting fragments, 9 counting them. Deepest path: `SafeAreaView > ScrollView > <> > <> > <> > View >
Card > View > Text`, at line 123.
  - After (a scratch copy of the end state): 3 not counting fragments, 5 counting them. Deepest path:
    `SafeAreaView > ScrollView > <>(triad) > <>(empty check) > TotalsCard`.
  - The AC's "≤ 4" holds with fragments not counted, since they add no node. See Open questions.
- **For R16:** the triad is today's lines 66–74 (`{!summary ? (` … the "Couldn’t refresh" `LoadError`), closed by
  176–177. After this PR it is lines 67–75, closed by `</>` `)}` at 85–86, just before `</ScrollView>` (87).
- Reuses: `planGap`, `isEmptySummary` (`data/periodSummary.ts`), `Card`, `Text`, `eur`, `toCents`, `shortMonthLabel`.
  New dependencies: none.

## Version

Bump: patch — 1.26.15 → 1.26.17
Why: conventions §8b, "a refactor that touches shipped code is `patch`". Base is 1.26.15 (R13 merged). R14 (brief 130,
in flight) takes 1.26.16. If `main` has moved when this rebases, bump once more (§8b step 4).

## Slices

Every slice must end with:

- gates green, tests unchanged (api 549 + 2 skipped, mcp 329, mobile 531; `period.test`, `periodSummary.test`
  unmodified);
- `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` clean;
- `yarn mobile export:web && yarn mobile check-builds` passing with `demo-modules.txt` unchanged. Statistics isn't in
  the demo: `demo-app/(tabs)` has no `statistics.tsx`, and the list names no `period`/`summary` module.

Run `yarn format`. Prettier may rewrap the moved lines, now 12–16 columns shallower. Check that the move is verbatim
with `git show --color-moved=zebra --color-moved-ws=allow-indentation-change`. No characterization tests: no logic
moves, and the pure parts stay covered by `periodSummary.test` and `period.test`.

- [ ] 0. Bump version to 1.26.17
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.17
- [ ] 1. Draw Statistics' totals with an in-file TotalsCard
  - Files: apps/mobile/src/app/(tabs)/statistics.tsx
  - Change: `TotalsCard` as in Contracts. Both comments ("One screen-reader stop per figure", "Only Left can be
    negative") move with their lines. ~55 lines, mostly moved.
  - Verify: web check, totals card
- [ ] 2. Draw Statistics' category rows with an in-file CategoryRows
  - Files: same
  - Change: `CategoryRows` as in Contracts. The "One screen-reader stop per category" comment moves. ~75 lines.
  - Verify: web check, "By category"
- [ ] 3. Draw Statistics' month rows with an in-file MonthRows
  - Files: same
  - Change: `MonthRows` as in Contracts. ~70 lines. Re-run the depth walk: 3 without fragments, 5 with them.
  - Verify: web check, "By month"
- [ ] 4. Mark R15 in review in the backlog
  - Files: docs/features/BACKLOG.md. Roadmap row R15 becomes `131 | in review`, and only that row changes. On a
    rebase conflict, keep `main`'s rows for R13/R14 (R14's PR owns them) and re-apply R15 alone.

**Web check.**

- Setup:
  - Web runs from this worktree at exactly http://127.0.0.1:8084, with this worktree's own API on 3000 (`yarn api dev`;
    copy the main checkout's `apps/api/.env` in, as R13 did). Check first with `lsof -nP -iTCP:3000 -sTCP:LISTEN`
    and `lsof -a -p <pid> -d cwd`. If another checkout holds the port, don't stop it: ask.
  - Window 390×844. Sign in as a QA user (create `claude-qa-131` if none, delete it at the end).
  - Data, in November 2026: ≥ 1 income, three categories (one over plan, one under, one on plan), spending above
    income so Left is negative. October is ended, so it stays empty.
- Record, on the base (after slice 0, before slice 1): for each state below, the page's text with positions and every
  `aria-label`, scrolled to the top. Run in the console:
  `(() => { const out = []; const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (walk.nextNode()) { const text = walk.currentNode.textContent.trim(); if (!text) continue; const box = walk.currentNode.parentElement.getBoundingClientRect(); out.push(`${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} ${text}`); } document.querySelectorAll('[aria-label]').forEach((node) => out.push(`label ${node.getAttribute('role') ?? ''}: ${node.getAttribute('aria-label')}`)); return out.join('\n'); })()`.
  After each slice, record again and diff against the base: it must be identical.
- States, in light and then dark:
  - Each menu choice: Current month (totals and categories; no "By month"), Previous month (empty: "Nothing planned,
    spent or earned in this period."), Last 3 months, Last 6 months, This year (totals, categories, months).
  - ‹ from Last 3 months, which gives the single month October.
  - › disabled on the current month.
  - Load error: stop the API, then choose a period that hasn't loaded. Refresh error: load Last 3, stop the API, go to
    another tab and back.

## AC → evidence

| AC                                                     | Evidence                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| In-file `TotalsCard`, `CategoryRows`, `MonthRows`; ≤ 4 | slices 1–3; depth walk 6 → 3 (no fragments), see Open questions             |
| What each period shows is unchanged                    | page text + positions + labels identical to base, every state above         |
| Web check 390×844 light and dark, every period         | web check above, recorded in the PR test plan                               |
| `demo-modules.txt` unchanged; `check-builds` passes    | every slice: `export:web` + `check-builds`, no list diff                    |
| `find-short-names.sh --diff origin/main` clean         | every slice                                                                 |
| Existing tests pass unmodified                         | `yarn test` counts unchanged; `period.test`, `periodSummary.test` untouched |
| Version one patch, both files                          | slice 0                                                                     |

## Not doing (YAGNI)

- No change to the triad (R16), the empty check, `PeriodSwitcher`/`PeriodMenu`, any text or style; no `memo`, no
  `styles` prop, no `SummarySections`, no figure-row component (R17).

## Risks

- Per-component `useThemedStyles` changes something seen on web. Shown by slice 1's diff against the base record. If
  it does, pass `styles` in as a prop.
- Prettier's rewrap changes JSX text spacing (`of {planned}`, `Income {income} · Spent {spent}`). Shown by the
  text record for that slice.
- Another session holds port 3000. Caught by the `lsof` check.

## Open questions

- no — The brief says "seven levels deep" today, and that number fits neither count (6 or 9). "≤ 4" is reachable only
  without counting fragments: 3, or 5 counting them, because the triad's fragment is R16's. Assumed: fragments don't
  count.
- no — main's version is 1.26.15, not 1.26.14 as the brief's base implies (R13 merged). The target stays 1.26.17.

## Follow-ups

- BACKLOG on `main` still shows R13 "in review", though #201 merged. R14's plan updates it.

## Deviations

## Consolidate

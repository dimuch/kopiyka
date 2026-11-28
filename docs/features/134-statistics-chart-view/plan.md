# Plan: Statistics: Chart / Table switch, with a category bar chart

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/statistics-chart-view
Base: origin/main (b0e5aef5, v1.26.19)

## Approach

Statistics gets a `view` state (`'chart' | 'table'`, `'chart'` on open) in the screen. The switcher row becomes one
toolbar row: `PeriodSwitcher` on the left (it shrinks; its label truncates), two `IconButton`s on the right. Table
renders today's sections unchanged. Chart renders `TotalsCard`, then an in-file `SpentChart` card, or the existing
`EmptyMonth` card with "Nothing spent in this period." when no category has spending. The pure part (keep categories
with spending > 0, each bar's `fill` against the largest) goes in `data/periodSummary.ts` beside `planGap` and is
unit-tested. Bars are plain `View`s with a percentage width, like `ProgressBar`: no SVG, no library. The seam for
pie/stacked later is the data: `spentBars` hands out cents and `techName` per category, and the drawing is one
section component that a later chart type sits beside.

Colour: the summary gets a `techName` per category (one more column in a query the route already runs), and the bar
fills with `categoryTile(techName, scheme).fg`, the same call `CategoryTile` makes. `bg` is a 14–16 % alpha wash, too
pale for a bar.

Alternative considered: look up colours on the client from `GET /categories?month=`. It lost because that route is
per month (`?month=` is required). A category spent on earlier in the period but not in the month you fetch would have
no `techName`, so you'd need up to 24 requests for a 24-month period, plus a second load state. The new field is ~4
lines in the API. Chart library: none. Bars need no SVG, and `react-native-svg` (already in) is enough for a later pie.

## Contracts

- DB: none (`categories.tech_name` exists since `001_initial.sql`).
- API: `GET /api/ledgers/:id/summary?from=YYYY-MM&to=YYYY-MM`. The 200 body is unchanged except that each
  `categories[]` item gets one more field:
  `{ categoryId: number, name: string, techName: string, plannedEur: string, spentEur: string }`.
  `techName` is the category's `categories.tech_name` (stable, the same in every month; a rename changes `name`, not
  it). Errors are unchanged: 400 Zod, 401, 404 non-member. Consumers: the app's `useSummary`. The MCP connector and
  demo don't call this route (checked with `rg "/summary"`: the connector has its own `month_summary` from month
  categories, and the demo has no Statistics).
- App:
  - `apps/mobile/src/api/types.ts`: `SummaryCategory` gets `techName: string` (with a comment saying it picks the tile
    colour).
  - `apps/mobile/src/data/periodSummary.ts`:
    ```ts
    /** A bar of Statistics' "Spent by category" chart (brief 134); `fill` is 0–1 of the track, 1 for the largest. */
    export interface SpentBar {
      categoryId: number;
      name: string;
      techName: string;
      spentCents: number;
      fill: number;
    }
    /** The categories with spending > 0, in the summary's order (largest spent first), each measured against the largest. */
    export function spentBars(categories: SummaryCategory[]): SpentBar[];
    ```
    `fill` is a layout ratio (a float), never money. Money stays `spentCents` (integer).
  - `apps/mobile/src/components/IconButton.tsx`: new optional prop `'aria-selected'?: boolean`, passed to `Pressable`
    the way `'aria-expanded'` already is (Chip's precedent: `accessibilityRole="button"` + `aria-selected`).
    `accessibilityState` is lint-banned.
  - `apps/mobile/src/components/Icon.tsx`: a new `table` glyph (24×24 stroke paths, e.g. a grid:
    `'M4 5h16v14H4z', 'M4 10h16', 'M4 15h16', 'M10 5v14'`). Chart reuses the existing `stats` bar-chart glyph.
  - `apps/mobile/src/app/(tabs)/statistics.tsx`: `type StatsView = 'chart' | 'table'`,
    `useState<StatsView>('chart')`. In-file `SpentChart({ bars }: { bars: SpentBar[] })`. `PeriodSwitcher` loses its
    `onLayout` prop: the toolbar row that wraps it reports the frame instead. No route or params change.
- Reuses: `useSummary`, `LoadState`, `TotalsCard`, `CategoryRows`, `MonthRows`, `EmptyMonth` (for both empty lines),
  `Card`, `IconButton`, `Icon` `stats`, `categoryTile` (theme.ts), `eur`/`toCents` (format.ts), `isEmptySummary`.
- New dependencies: none.

## Version

Bump: minor — 1.26.19 → 1.27.0
Why: §8b `minor`. This adds a new capability (the Chart view on Statistics) and an optional new field on an existing
route (`techName` on summary categories). Nothing existing stops working: shipped builds ignore the extra field, and
rollback is unaffected because there's no migration. If another PR takes 1.27.0 first, rebase and bump once again
(§8b step 4).

## Slices

- [x] 0. Bump version to 1.27.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.27.0
- [x] 1. Send each summary category's tech name, for its colour
  - Files: apps/api/src/summary/routes.ts, apps/api/test/summary.int.test.ts, apps/mobile/src/api/types.ts,
    apps/mobile/test/periodSummary.test.ts
  - Change:
    - Add `c.tech_name` to the `named` SELECT, and `techName: string` (with a JSDoc line) to `SummaryCategoryDto`.
    - Carry it through both `.map`s in `categoryFigures`.
    - Mirror it in `SummaryCategory`, and add `techName: 'rent'` to the app test's `category()` fixture so it still
      typechecks.
  - Tests:
    - `summary.int.test.ts`: in "its categories add up to the totals, largest spent first", the three `toEqual` rows
      gain `techName: 'groceries' | 'rent' | 'fun'`.
    - In "names a category as in the period's last month", assert that the renamed category's `techName` stays
      `'groceries'` while `name` is `'food'`.
  - ~15 lines.
- [x] 2. Work out the spent-by-category bars from a period's summary
  - Files: apps/mobile/src/data/periodSummary.ts, apps/mobile/test/periodSummary.test.ts
  - Change: `SpentBar` + `spentBars`. Convert with `toCents`, drop `spentCents <= 0`, keep input order (the API sorts
    it), and set `fill = spentCents / max` over the kept bars.
  - Tests: `periodSummary.test.ts` → `describe('spentBars')`, table style:
    - `['200.00','150.00','50.00','0.00']` → three bars in that order, fills `[1, 0.75, 0.25]` exactly
      (15000/20000, 5000/20000). The €0 category has no bar.
    - Carries `categoryId`, `name`, `techName`, `spentCents` (`20000`).
    - One category → fill `1`.
    - `[]` and all-`'0.00'` → `[]`.
  - ~45 lines.
- [x] 3. Add a Chart view to Statistics, with spending per category as bars
  - Files: apps/mobile/src/components/Icon.tsx, apps/mobile/src/components/IconButton.tsx,
    apps/mobile/src/app/(tabs)/statistics.tsx
  - Change:
    - **Icons**: add the `table` glyph, and the `'aria-selected'` passthrough on `IconButton`.
    - **Toolbar row**: a `toolbar` View (row, `alignItems: 'center'`, `justifyContent: 'space-between'`,
      `gap: space.sm`, `paddingBottom: space.sm`) holds `PeriodSwitcher` (`flexShrink: 1`, no longer centred) and a
      row of two `IconButton`s. Chart is `icon="stats" label="Chart view"`, Table is `icon="table" label="Table view"`.
      Each has `tone={active ? 'accent' : 'muted'}`, `aria-selected={active}` and `onPress={() => setView(...)}`.
      Setting the view that's already shown is a no-op, so tapping the active icon does nothing.
    - **Period label**: the label goes from `title` to `heading` so a month fits beside the icons (see Open questions).
    - **Menu anchor**: the toolbar's `onLayout` feeds `anchor`. It's still a direct child of the SafeAreaView, so
      `anchor.y` keeps its meaning. `PeriodMenu` places its card at `left: anchor.x + size.iconButton + space.xs`, the
      period button's left edge, instead of centring it on the row.
    - **Views**: inside `LoadState`, after the `isEmptySummary` branch (unchanged, so both views share it), Table
      renders today's `TotalsCard`, `CategoryRows` and `MonthRows` exactly as now. Chart renders `TotalsCard`, then
      `SpentChart` when `spentBars(...)` is non-empty, else `<EmptyMonth text="Nothing spent in this period." />`.
    - **`SpentChart`**: a `Card padding="padded"` holding:
      - a `Text variant="heading" accessibilityRole="header"` reading "Spent by category";
      - one View per bar, `accessible`, labelled "<name>, spent <eur(spentCents)>". Inside it, a
        row with the name (`bodyMedium`, `numberOfLines={1}`, shrinks) and the amount (`amount`), above a track
        (`height: 8`, `radius.pill`, `colors.track`). The fill's width is `fill * 100` percent, `minWidth: 8` so a tiny
        share still shows a dot, with `backgroundColor: categoryTile(techName, scheme).fg`.
      - Styles go in the existing `makeStyles`.
  - Verify: web at 402pt and at 320pt, light and dark (launch configs `web` + `api`, a QA ledger with data). This is
    the whole AC list below, and the PR's test plan records each:
    - Opens on Chart, with Chart accent and Table muted.
    - Table shows exactly today's screen.
    - The view survives stepping ‹ › and picking each preset.
    - "September 2026" and a cross-year range ("Dec 2025 – Nov 2026", by stepping back from Last 6 months) truncate
      with an ellipsis and never touch the icons. No horizontal scroll at 320.
    - The menu opens under the period button.
    - Bar order, labels and proportions match Table's spent column.
    - Bar colours match each category's tile icon on Budget, in light and dark.
    - A plan-only period shows "Nothing spent in this period.", and a fully empty period shows today's empty card in
      both views.
    - Screen reader names in the web accessibility tree.
    - Then iPhone (Expo Go) with VoiceOver.
    - `yarn mobile check-builds` passes without `--accept`: Icon and IconButton are already in the demo, and nothing
      new reaches it.
  - ~130 lines.
- [ ] 4. Record brief 134 in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: an "In progress" entry for 134 (branch, v1.27.0, what ships, which checks are left). Snapshot line
    updated.
  - ~10 lines.

Total ≈ 200 changed lines (slice 0 not counted).

## AC → evidence

| AC                                                                                     | Evidence                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One row: switcher left, Chart/Table right, Chart active; switching swaps               | Slice 3 web check 402pt: opens on Chart (accent), Table muted; tap Table → today's content, highlight swaps; tap Table again → nothing; tap Chart → back                                                       |
| Menu under the period button; longest label fits at 320pt, no overlap                  | Slice 3 web check at 320pt and 402pt with "September 2026" and "Dec 2025 – Nov 2026": ellipsis, icons untouched, no horizontal scroll; menu card's left edge under the period button                           |
| N bars for N spending categories, largest first, name + amount, €0 left out            | `periodSummary.test.ts` › spentBars (filter + order); `summary.int.test.ts` › "largest spent first" (server order); web check: bars match Table's non-zero spent rows                                          |
| Largest bar spans the full track, others in proportion                                 | `periodSummary.test.ts` › spentBars fills `[1, 0.75, 0.25]`                                                                                                                                                    |
| Bar colour = category tile colour, light and dark                                      | `summary.int.test.ts` asserts `techName` (also after a rename); code uses `categoryTile(techName, scheme).fg` like `CategoryTile`; web check in Light and Dark: each bar matches the tile icon on Budget       |
| Changing the period refreshes the shown view, doesn't reset to Chart                   | Slice 3 web check: in Table, step ‹ › and pick each preset → stays Table with new figures; same in Chart                                                                                                       |
| Plan/earn-only → totals + "Nothing spent in this period."; empty → today's empty state | Slice 3 web check: a period with a plan or income but no expenses (Chart: totals + line; Table: today's rows); a period with nothing at all → "Nothing planned, spent or earned in this period." in both views |
| Screen reader: "Chart view"/"Table view" + selected; each bar one stop; heading        | Web: accessibility tree shows `aria-label` + `aria-selected` on both buttons, one labelled group per bar ("groceries, spent €1,380.40"), a heading role; iPhone VoiceOver reads the same                       |
| Web at phone width and iPhone, no horizontal scroll                                    | Slice 3 web check 402pt + 320pt; iPhone (Expo Go) pass of the rows above                                                                                                                                       |

## Not doing (YAGNI)

- Pie, stacked or any other chart type, and a chart-type picker. The seam is only `spentBars` and a section
  component.
- A generic `BarChart` component in `components/`: it would have one caller. `SpentChart` stays in-file like
  `TotalsCard`.
- Remembering the view between visits. Tap-on-bar, per-month or income charts.
- A chart library, or SVG for the bars.
- Re-sorting on the client. The API's order is the contract, and the existing int test covers it.
- Adding `accessibilityRole="header"` to Table's "By category"/"By month" titles. Table stays exactly as today.

## Risks

- The period label has little room beside four 44pt buttons. At 402pt about 140pt is left for the label, about 58pt
  at 320pt (estimated: 4 × 44 buttons, 18pt chevron, gaps). At `title` (22pt) "September 2026" (~165pt) would
  truncate even at 402. That's why the label drops to `heading` (~130pt). At 320 most labels truncate. Slice 3's
  web check at both widths proves or disproves this; see Open questions.
- Menu placement. `onLayout` reports the frame relative to the parent, so the toolbar must stay a direct child of the
  SafeAreaView, as the switcher is today. If it moved into another View, `anchor.y` would go wrong. Slice 3's web
  check opens the menu at both widths.
- `aria-selected` on a `button` is read on iOS ("Selected") and is valid enough on web. Chip ships the same pairing,
  so the risk is low. Slice 3's VoiceOver check settles it.
- Version skew. A dev app on the new code against an older API would get `techName` undefined.
  `categoryTile(undefined)` would throw in the hash. Production ships API and web together, and a shipped native build
  has no Statistics chart yet, so this only matters for a local mismatch. Deploy the API with the app (the normal
  single deploy).

## Open questions

- No (assumption used) — The brief's proposed defaults (Chart on open, not remembered; totals in both views; By month
  only in Table) are taken as confirmed, as the caller reported from the approved preview.
- No — Period label size: `heading` (17pt) instead of today's `title` (22pt), so a month name fits beside the icons
  at 402pt. With `title`, the current month's label would already truncate. If you'd rather keep `title` and accept
  more truncation, slice 3 drops one line.
- No — At 320pt even a one-month label truncates (~58pt left). AC2 is read as "nothing overlaps or leaves the row;
  the label ellipsises", which is the brief's What line. A smaller step (e.g. hiding the chevron at narrow widths)
  isn't planned.
- No — Icons: Chart reuses the tab bar's `stats` bar-chart glyph, and Table gets a new grid glyph. If the approved
  preview drew other glyphs, swap the paths in slice 3. Same size (20pt) as the other header icons.
- No — The period menu now aligns its left edge with the period button instead of centring on the row (the row is no
  longer centred).

## Gate A decisions (user, 2026-11-28)

- At 320pt the period label may truncate to a few characters, as long as nothing overlaps or leaves the row (option a).
- The period label uses `heading`, and the period menu aligns left under the period button.
- Version skew: slice 3 adds a one-line fallback so a summary without `techName` (an older API) still draws bars
  instead of crashing in `categoryTile`, with a comment saying why.

## Follow-ups

- `statistics.tsx` grows to ~480 lines with `SpentChart`. When a second chart type lands, move the chart sections to
  `components/` (two callers by then).
- `docs/design/design-system.md` has no chart bar. Add one if the bar look is kept for later charts.

## Deviations

- slice 3: the bar colour falls back to the category name when `techName` is missing (an older API during a
  rollback), as decided at Gate A.

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

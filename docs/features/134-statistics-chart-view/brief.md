# Statistics: Chart / Table switch, with a category bar chart

Type: feature

## Why

Statistics shows the period's figures only as lists of cards. To see at a glance where the money went in a period
you have to read and compare amounts row by row. The Budget '26 Notion workspace had an "Expenses Breakdown" chart
(horizontal bars of spending per category, biggest first), and that is the view we want in the app. This is the first
step towards a small set of charts (bar, pie, stacked) on Statistics.

## What

- The period switcher row changes: the switcher (‹ period ⌄ ›) moves to the left, and on the same row, at the right,
  sit two icon buttons: **Chart** (bar-chart icon) and **Table** (table/list icon). The active view's icon is purple
  exactly like the active tab icon in the tab bar (`colors.accent`, no background); the inactive one is greyed
  (`colors.muted`, like inactive tabs). Tapping the inactive icon switches view;
  tapping the active one does nothing.
- **Chart** is selected each time the screen opens.
- A long period label (e.g. a Custom range) truncates instead of pushing the icons off the row.
- **Table** is today's Statistics content, unchanged.
- **Chart** shows the totals card (Income, Planned, Spent, Left) as today, then a **"Spent by category"** horizontal
  bar chart for the selected period:
  - one bar per category with spending > €0 in the period; categories with €0 spent are left out;
  - sorted by spent, largest first;
  - each bar labelled with the category name and its spent amount (€, same format as elsewhere);
  - bar length is relative to the largest amount in the period;
  - each category's bar uses its own colour (its category tile colour), so it matches the rest of the app;
  - in Chart view the By month section is not shown (it stays in Table).
- Changing the period updates whichever view is shown; the chosen view stays while the screen is open.
- The empty, loading and error states are the same in both views. If something was planned or earned but nothing
  spent, Chart shows the totals and a short "Nothing spent in this period." line instead of the chart.
- The chart is drawn so more chart types (pie, stacked) can be added later without rewriting it, but only the bar
  chart ships now.

## Acceptance criteria

- [ ] Opening Statistics shows one row: the period switcher on the left, Chart and Table icon buttons on the right,
      Chart active (accent) and Table greyed; tapping Table shows exactly today's content and swaps the highlight;
      tapping Chart goes back.
- [ ] The period menu still opens under the period button, and the longest period label fits on the row at 320pt
      width without overlapping the icons.
- [ ] For a period with spending in N categories, Chart shows N bars, ordered by spent (largest first), each with the
      category name and its spent amount; €0-spent categories have no bar.
- [ ] The largest bar spans the full track; the others are in proportion to it (tested on the computed widths).
- [ ] Each bar's colour is that category's tile colour, in light and dark appearance.
- [ ] Stepping or choosing a period refreshes the shown view without switching it back to Chart.
- [ ] Planned/earned-but-nothing-spent periods show the totals and "Nothing spent in this period."; fully empty
      periods show today's empty state in both views.
- [ ] Screen reader: the two icons are read as "Chart view" / "Table view" with which one is selected; each bar is one
      stop read as "<category>, spent €<amount>"; the chart has a heading.
- [ ] Works on web at phone width and on iPhone (Expo Go), no horizontal scroll.

## Out of scope

- Pie, stacked and any other chart types (later briefs).
- Remembering the Chart/Table choice between visits or devices.
- Charts per month, income charts, planned-vs-spent bars.
- Any API change unless the plan finds the colours can't be had on the client.
- Tap-on-bar interactions (drill into a category).

## Notes

- Screen: `apps/mobile/src/app/(tabs)/statistics.tsx`; data from `useSummary` → `GET /api/ledgers/:id/summary`
  (categories already arrive sorted by spent, largest first; they carry `categoryId`, `name`, `plannedEur`,
  `spentEur`, no colour).
- Tile colours come from brief 114's category icons/tiles; the plan should find how to get them for summary
  categories (reuse the ledger's categories on the client, or add the field to the summary).
- `react-native-svg` is already a dependency; prefer plain Views or it over a new chart library, unless the plan shows
  a library pays for itself for pie/stacked later (new dependency = called out at Gate A).
- Reference: Notion Budget '26 → Expenses → "Expenses Breakdown" view (bar, sum of Actual Amount by Category,
  y-descending, data labels, colourful theme, hide empty groups).

## Open questions

- None for now; the defaults above (Chart on open, not remembered; totals in both views; By month only in Table) are
  proposals for you to confirm or change.

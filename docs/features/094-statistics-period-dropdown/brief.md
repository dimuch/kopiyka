# Statistics: month arrows with a period dropdown

Type: feature

## Why

The Statistics tab lists its seven periods as a wrap of chips above the figures. That takes several rows at phone
width before any number shows, and there's no quick way to step back through months one at a time, the way Budget
does. Two of the periods, Last 12 months and Custom, aren't wanted for now.

## What

- The chips are replaced by a switcher at the top of Statistics that looks like Budget's: a left arrow, the period in
  the middle, a right arrow.
  - It opens on the current month ("November 2026").
  - The left arrow moves the period one month back; the right arrow one month forward.
  - The right arrow is disabled when the period already ends on the current month, so the screen never shows a
    future month.
- The period in the middle, followed by a down chevron, is a button. Tapping it opens a small menu right under it
  listing the preset ranges, in this order:
  - Current month
  - Previous month
  - Last 3 months
  - Last 6 months
  - This year
- Tapping an option shows that range and closes the menu. Tapping the button again, or outside the menu, closes it
  without a change.
- The preset the period matches is marked in the menu. After the arrows move the period away from every preset, no
  option is marked.
- On a range, the middle shows the range as today's period line does ("Sep – Nov 2026", "Dec 2025 – Nov 2026"), and
  an arrow switches back to a single month, counted from the range's last month: on Sep – Nov 2026 the left arrow
  shows October 2026. The right arrow stays disabled while the range ends on the current month.
- Last 12 months and Custom are no longer offered. Their logic stays in the code (the `last12` preset, `moveCustom`
  and its tests) so they can come back later.
- Works with a screen reader: the arrows say "Previous month" or "Next month" and whether they're disabled. The
  middle button says the period shown and that it opens a menu. Each option says whether it's selected.

## Acceptance criteria

- [ ] Given I open Statistics in November 2026, then the switcher reads "November 2026", the right arrow is disabled
      and there's no row of chips.
- [ ] Given I tap the left arrow, then it reads "October 2026", the figures are October's and the right arrow is
      enabled. Given I tap the right arrow, then it's back on November 2026.
- [ ] Given I tap the period, then a menu under it lists Current month, Previous month, Last 3 months, Last 6 months
      and This year, in that order, with the matching preset marked.
- [ ] Given I choose Last 3 months, then it reads "Sep – Nov 2026" with those months' figures. Given I then tap the
      left arrow, it reads "October 2026" with Previous month marked; one more tap shows "September 2026" with no preset marked.
- [ ] Given the menu is open, when I tap the period or outside the menu, then it closes and the period doesn't change.
- [ ] Neither "Last 12 months" nor "Custom" appears anywhere on Statistics.
- [ ] With VoiceOver, the arrows, the period button and each option announce what's described above.

## Out of scope

- Removing the `last12` or custom period logic, or its tests.
- New presets, remembering the period between visits, or changing the figures shown.
- Changing Budget, Income or Expenses' month switcher behaviour.
- A native picker or a new dependency.

## Notes

- Today's chips: `apps/mobile/src/app/(tabs)/statistics.tsx`, from `PERIOD_CHOICES` in `src/data/period.ts`.
- The switcher to look like: `src/components/MonthSwitcher.tsx` (Budget, Income, Expenses). It moves freely into the
  future; Statistics' version stops at the current month.
- The demo build has no Statistics tab, so nothing changes there.

## Open questions

- None.

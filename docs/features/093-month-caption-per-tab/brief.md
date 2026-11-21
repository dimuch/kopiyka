# Month caption names the tab it's on

Type: fix

## Why

The month switcher at the top of Budget, Income and Expenses shows a small caption above
the month, "BUDGET ’26 / November". It's hard-coded in the shared `MonthSwitcher`, so
Income and Expenses (and the From/To pickers on Statistics' custom period) also say
"BUDGET", which reads as if you're on the Budget tab.

## What

- The caption above the month names the tab the switcher is on, in the same style as
  today (small, muted, upper case, followed by the two-digit year):
  - Budget tab: "BUDGET ’26" (unchanged)
  - Income tab: "INCOME ’26"
  - Expenses tab: "EXPENSES ’26"
  - Statistics, custom period, From and To pickers: "STATISTICS ’26"
- The word comes from the tab's title in `src/tabs.ts`, so renaming a tab renames its
  caption.
- Child pages (expense form, category page, members, category form…) keep their own
  headings as today; none of them shows this caption.
- The month name, arrows, their accessibility labels and the layout don't change.
- The demo build shows the same captions.

## Acceptance criteria

- [ ] Given I open Income on November 2026, then the caption above "November" reads
      "INCOME ’26" and no "BUDGET" caption shows.
- [ ] Given I open Expenses on November 2026, then the caption reads "EXPENSES ’26".
- [ ] Given I open Budget on November 2026, then the caption still reads "BUDGET ’26".
- [ ] Given I choose the custom period on Statistics, then both From and To pickers read
      "STATISTICS ’<yy>" for their own month's year.
- [ ] Given I move to January 2027 on any of these, then the year in the caption follows
      ("’27").

## Out of scope

- Adding a heading to pages that don't have the month switcher (Home, Settings, child
  pages).
- Changing the browser tab title on web.
- Restyling the month switcher.

## Notes

- Seen in the demo web build at `/expenses`: "BUDGET ’26 / November".
- Source: `apps/mobile/src/components/MonthSwitcher.tsx:22`.

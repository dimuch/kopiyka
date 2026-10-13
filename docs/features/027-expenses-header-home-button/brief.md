# Expenses header: Home button and centred month switcher

Type: feature

## Why

On the Expenses page (the one the Home screen's "Expenses" card opens) the month
switcher sits at the left of the header. We want a quick way back to Home from the
header itself, and the month — the page's real title — centred like a page title.

## What

Header of the Expenses tab (`(tabs)/expenses.tsx`), left to right:

- **Left: Home button** — the same house icon as the tab bar's Home tab. Tapping it does
  what tapping the Home tab does: switches to the Home tab (no new screen pushed, no
  back stack growth).
- **Centre: month switcher** — ‹ BUDGET ’26 / October › — centred on the header's
  width, not just "between" the side items.
- **Right: the "+" add button**, unchanged.
- **No compact total in the header.** Today, scrolling the summary card away shows a
  compact "€412.30 spent" in the header; on Expenses that goes away (decided at intake:
  it doesn't fit beside a centred switcher). The total stays in the summary card.

Everything else on the page (month switching, totals card, categories list, tab bar)
stays as it is.

## Acceptance criteria

- [ ] Given I open Expenses (from the Home card or the tab bar), then the header shows a
      house button at the left, the month switcher centred, and "+" at the right.
- [ ] When I tap the house button, then the Home tab shows and the Home tab icon is
      active — the same result as tapping the Home tab icon.
- [ ] The month switcher stays horizontally centred on the screen for every month name
      (e.g. "May" and "September"), and its arrows still switch months.
- [ ] When I scroll the categories, no total appears in the header, and nothing in the
      header overlaps or gets cut off at 375 px width.
- [ ] The house button has an accessible name ("Home") and a 44×44 hit area like the
      other header buttons.
- [ ] Works on web at phone width and on iPhone (Expo Go), light and dark theme.

## Out of scope

- Headers of other pages (category detail, Budget, Statistics, Settings).
- Removing or changing the bottom tab bar.
- Any API change.
- The compact total on category detail (it keeps its own collapsing header).

## Notes

- `useCollapsingSummary` / `CompactTotal` are shared with category detail — remove only
  Expenses' use of them; keep whatever else of the scroll effect still makes sense
  (e.g. the header divider) at the planner's discretion.

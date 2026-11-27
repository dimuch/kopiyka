# Scroll areas end above the tab bar

Type: fix

## Why

Since brief 106 the tab bar is a floating pill drawn over the page. Every scrolling page runs to the bottom of the
screen and only pads under its last row, so rows slide behind the pill while you scroll (seen on Budget: a category
card half-covered by the bar). It looks broken and hides rows' amounts and "+" buttons.

## What

The scrolling part of each page sits between the page's top part and the tab bar: it ends a 16pt gap above the bar,
and no content is ever drawn behind the bar or in that gap. The bar keeps its look (floating pill and round "+", same
place).

Pages: Budget, Expenses, Income, Statistics, Settings, and the add-expense page (which shows the same bar).

While the Undo toast shows (Budget, Expenses), the scroll area also ends above the toast, as the padding does today.

## Acceptance criteria

- [ ] On each page listed, scrolling a list longer than the screen never draws rows behind the tab bar or between
      the bar and the screen's bottom; the last row can still be scrolled fully into view above the bar.
- [ ] With the Undo toast showing on Budget, rows stop above the toast; when it goes, they stop above the bar again.
- [ ] Long-press drag to reorder categories (Budget, Expenses) still auto-scrolls when the dragged row nears the bottom
      edge of the visible list, not later or earlier than before relative to the bar.
- [ ] Web at phone width and iPhone (home indicator inset) both show the gap above the bar, not behind it.

## Out of scope

- Changing the bar's design (full-width solid footer, height, shadow, "+" button).
- Pages without the tab bar.

## Notes

- Today each page passes `useTabBarRoom()` (apps/mobile/src/components/TabBar.tsx) as `paddingBottom` on its scroll
  content; Budget switches to `useToastRoom()` while the toast shows; `ReorderList` gets the same value as
  `bottomInset`.
- The page background shows in the gap and around the pill.

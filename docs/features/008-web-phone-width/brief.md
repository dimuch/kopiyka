# Web app at phone width

Type: feature

## Why

On a laptop or desktop browser the web app stretches to the full window, so rows, tiles and buttons become very wide
and the layout no longer looks like the iPhone app it was designed as.

## What

On web, the whole app is shown in a centered column no wider than an iPhone 18 Pro (402 CSS px). Outside the column is
plain app background. Narrower windows (a phone browser) still use their full width. The iPhone app doesn't change.

## Acceptance criteria

- [ ] At 1440×900, every screen (login, Home, Category, Add/Edit expense) renders in a centered column exactly 402px
      wide; nothing extends outside it.
- [ ] The category sheet, the Undo bar and the floating "Add expense" button stay within the column, not the window
      edges.
- [ ] At 390×844 and 402×874, the layout is unchanged (full width, no side margins).
- [ ] Native iOS is unchanged (the change is web-only; checked in Expo Go).
- [ ] The width is one named value in `theme.ts`, not repeated.

## Out of scope

- Tablet or desktop layouts, multi-column views, and responsive breakpoints.
- Changing font sizes or spacing.
- A frame or "device mockup" around the column.

## Notes

iPhone 18 Pro: 402 × 874 pt (1206 × 2622 px).

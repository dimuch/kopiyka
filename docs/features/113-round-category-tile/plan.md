# Plan: Round category tile

Status: approved
Brief: ./brief.md
Branch: feat/round-category-tile
Base: origin/main (ac5a1036)

## Approach

`CategoryTile` sets `borderRadius: radius.pill` instead of `size * 0.3`. A radius is clamped to half the side
(`theme.ts`), so every tile (26, 28, 40, 52pt) becomes a circle, the same way `ProgressBar`'s dot and the chips are
rounded. Using the token drops the radius line's `eslint-disable-next-line no-restricted-syntax` and its comment; the
font size keeps its disable, with the comment reworded to "The letter scales with the tile (26–52pt): tile maths, no
token." The design-system doc's radius line names the category tile under `sm 10`, which goes stale: move it to `pill`.
Alternative considered: `size / 2` as the brief writes it. It draws the same circle but keeps a raw-number disable for
no gain; `radius.pill` is how the repo already makes circles.

## Contracts

- DB: none
- API: none
- App: `CategoryTile` props unchanged (`techName`, `label`, `size?`); only its corner radius changes.
- Reuses: `radius.pill` from `theme.ts`
- New dependencies: none

## Version

Bump: patch — 1.24.1 → 1.24.2
Why: §8b `patch` row (styling). The tile's look changes in production and nothing new is added.

## Slices

- [x] 0. Bump version to 1.24.2
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.24.2
- [ ] 1. Make the category tile a circle, to match the chip's round ends
  - Files: apps/mobile/src/components/CategoryTile.tsx, docs/design/design-system.md
  - Change: `borderRadius: radius.pill` (import `radius`), remove the radius line's disable and comment, reword the
    font size comment; in the doc, take "category tile" out of `sm 10` and add it to `pill 999`. About 8 lines.
  - Verify: gates. Then on web at phone width, and on iPhone: Add expense chips (26pt), the category picker sheet (28pt),
    Budget and Expenses rows (40pt), the category screen header (52pt). Every tile is a circle, the letter is centred,
    and size and colours are the same as on main, in Light and Dark. Also look at a chip at a large text size: the pill
    grows, so the circle sits inside a taller pill; expected, note it in the PR test plan.

## AC → evidence

| AC                                                | Evidence                                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Chip tile is a circle concentric with the pill    | Slice 1 check: Add expense chips are circles 3pt in from the pill's top and bottom (see Open questions), web at phone width and iPhone |
| Budget/Expenses/category screen/sheet tiles round | Slice 1 check of the four screens: circles, same size, letter centred                                                                  |
| Size, letter, font, colours unchanged             | Diff only touches `borderRadius`; slice 1 visual check against main, Light/Dark                                                        |

## Not doing (YAGNI)

- Icons instead of letters (brief 114); any change to `Chip` (height, padding, colours).
- A `shape` prop or a round/square option: there is one tile shape.
- A unit test: the change is a style value, and conventions §6 rules out snapshot tests.

## Risks

- A leftover call site that relies on the square corner (e.g. a tile next to a square neighbour). `rg CategoryTile`
  finds five callers (`CategoryPicker` 26, `CategorySheet` 28, `budget.tsx` 40, `expenses.tsx` 40,
  `category/[categoryId].tsx` 52) and none sets its own radius — the slice 1 check covers all five.
- No test or snapshot reads the radius (`apps/mobile/test` has none on `CategoryTile`); `demo-modules.txt` already
  lists `CategoryTile.tsx` and no new module reaches the demo, so `check-builds` doesn't change.

## Open questions

- no — The brief says `size / 2`; the plan uses `radius.pill`, which renders the same circle. Assumed fine.
- no — The tile isn't fully concentric with the pill's round end. The pill (`Chip.tsx`, `paddingHorizontal: space.sm`)
  puts the 26pt tile 8pt from its left edge but 3pt from its top and bottom. That makes the radius concentric
  (16 − 3 = 13), but the circle's centre sits 5pt right of the round end's centre (x = 21 vs 16). Making it truly
  concentric needs a 3pt left padding on the chip, which the brief puts out of scope. Assumed: AC1 means the radius
  matches (a circle 3pt in from top and bottom). The slice 1 check judges that, not a shared centre.

## Follow-ups

## Deviations

## Consolidate

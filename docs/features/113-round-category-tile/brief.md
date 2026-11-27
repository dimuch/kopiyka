# Round category tile

Type: feature

## Why

The category chip (add/edit expense form) is a pill, but the letter tile inside it is a rounded square
(`borderRadius: size * 0.3`). The square corners sit against the pill's round ends and look off.

## What

The category tile's corner follows the chip it sits in: inside the 32pt chip the 26pt tile has a 3pt inset, so the
concentric radius is 16 − 3 = 13, i.e. a circle. `CategoryTile` becomes a circle (`borderRadius: size / 2`) wherever it
is shown (chip, category picker sheet, Budget, Expenses, category screen), so the app keeps one tile shape. The letter,
colours and sizes don't change.

## Acceptance criteria

- [ ] Given the add-expense form, when it shows the category chips, then each chip's tile is a circle concentric with
      the pill's round end (web at phone width and iPhone).
- [ ] Given Budget, Expenses, the category screen and the category sheet, then their tiles are circles of the same size
      as before, with the letter centred.
- [ ] The tile's size, letter, font and colours are unchanged.

## Out of scope

- Icons instead of letters (brief 114).
- Any change to the chip itself (height, padding, colours).

## Notes

- Code: `apps/mobile/src/components/CategoryTile.tsx`; chip: `Chip.tsx` (`size.chip` 32, `radius.pill`).
- Version: a visible change to an existing look — the planner picks the level per conventions §8b.

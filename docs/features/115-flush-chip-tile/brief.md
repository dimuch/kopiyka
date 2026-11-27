# Flush chip tile

Type: feature

## Why

In the category chip (add/edit expense form) the round tile sits 8pt from the pill's left end, while it is only 3pt
from the top and bottom. The extra gap on the left makes the tile look loose inside the pill.

## What

A chip with a `leading` element (category tile or icon) has no left padding: the leading element touches the pill's
left end. The right side keeps its 8pt padding after the label, and the gap between the leading element and the label
stays as it is. A chip without `leading` (date chips) keeps 8pt on both sides.

This applies everywhere `Chip` gets a `leading` element: the quick category chips in the expense form, the chips in the
"More categories" sheet and the "N more" chip.

## Acceptance criteria

- [ ] Given the add-expense form, when it shows the category chips, then each tile touches the pill's left end, with
      no padding before it (web at phone width and iPhone).
- [ ] Given the "More categories" sheet and the "N more" chip, then their leading tile or icon also touches the left
      end.
- [ ] Given the date chips (no leading element), then their padding is unchanged.
- [ ] The label, its right padding, the chip's height, colours and the selected state are unchanged.

## Out of scope

- The tile's shape, size or content (briefs 113, 114).
- The chip's height, colours or the 44pt touch area.

## Notes

- Code: `apps/mobile/src/components/Chip.tsx` (`pill` style, `paddingHorizontal: space.sm`).
- Chosen by the user: 0pt, flush (not the 3pt concentric inset).
- Brief 114 (category icons, open branch) edits `CategoryTile.tsx`, not `Chip.tsx`.
- Version: a visible change to an existing look — the planner picks the level per conventions §8b.

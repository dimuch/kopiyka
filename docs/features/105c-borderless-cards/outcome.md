# Outcome: The fresh look, part 3: borderless cards and one card per row

Brief: ./brief.md · Finished 2026-11-26

## PRs

- [#175](https://github.com/dimuch/kopiyka/pull/175) The fresh look, part 3: borderless cards and one card per row — v1.23.14

## Decided

- Approved at Gate A under the user's standing OK, with the open questions as recommended.
- Cards lost their edge for the doc's shadow in light (none in dark); dark `hairline` is dark `text` at 6%.
- Budget, Expenses, Income, Statistics' rows (By month too), the category page and Members put each row on its own
  card, 8pt apart, padded at `md`. Statistics' totals and the two pickers stayed one card.
- The shadow was cut at the sides, so the planned fallback shipped: the scroll views bleed into the gutter and pad
  their content back.
- Remaining was looked at again on Budget and Expenses; the restyle didn't make the two meanings easier to confuse.

## Left out

- A lifted shadow on the dragged row, and the pickers' own padding (105d).
- Removing the 8pt left under the last reorderable row.

## Follow-ups

- The tab screens' 20pt gutter against the doc's 16 — in BACKLOG.md
- Give Members' confirm panel a `hairline` rather than drop its edge — done in 105e, #177.
- LedgerPicker's options sit 20pt in against the cards' 12 — in BACKLOG.md

Full plan: `git show 6323df3e:docs/features/105c-borderless-cards/plan.md`

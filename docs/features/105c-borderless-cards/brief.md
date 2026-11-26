# The fresh look, part 3: borderless cards and one card per row

Type: feature

## Why

This is part 3 of brief 105 (the fresh look). At 105's Gate A the brief was split into four parts:

- 105 (#173) brought the palettes, violet bars, the "€X left" label and light as the default.
- 105b (#174, v1.23.13) brought Inter and the type mapping.
- 105c, this part, brings borderless cards and one card per row.
- 105d gives each control one look.

Cards still draw a `border` edge and no shadow, and lists group many rows inside one card with dividers between
them. The design system (direction A, "Card per row") puts each category or item on its own white card on the pale
page, with a soft shadow instead of an edge, and keeps a hairline only where two same-colour surfaces touch.

## What

Apply the Elevation section, the `hairline` colour and the `Card` row of `docs/design/design-system.md`. The outline
is in `docs/features/105-fresh-look/plan.md`, under "Later parts" › 105c.

- **Tokens in `theme.ts`:**
  - `hairline`: light `rgba(17,16,20,0.06)` (the doc); dark, a matching value the plan derives and records in the
    doc first.
  - `shadow.card` (`0 2px 8px rgba(17,16,20,0.06)`) and `shadow.float` (`0 4px 24px rgba(17,16,20,0.12)`) as
    `boxShadow` strings, per scheme. Dark mode has no shadows.
  - `border` goes once nothing uses it. `borderStrong` stays for 105d (inputs, menus, sheets, Members' panel).
- **`Card`:** `surface`, `radius.lg`, `shadow.card`, padding `md`, no border. `CardPadding`'s `list` goes with the
  lists below.
- **One card per row**, 8pt apart, so no divider is left inside a card:
  - Budget's categories, Expenses' rows, Income's items;
  - Statistics' category rows, the category page's expenses and Members' rows.
  - The plan names any list it leaves as one card, and why.
- **ReorderList** (Budget's drag to reorder) measures each row's height for the drag. The 8pt gap must sit inside
  the measured row, or in its offset and drop maths, so a drag still lands where the finger is.
- **Edges that stay become `hairline`:** HeaderDivider, TabBar's top edge, the tab layout's bar and DemoStrip's edge.
- **Remaining:** look again at Remaining on Budget and Expenses once their cards change (105's Out of scope note),
  and say in the PR whether the restyle makes the two meanings more confusing.

- **The backlog:** `docs/features/BACKLOG.md` marks 105b done (#174, v1.23.13), which its "In progress" line doesn't
  yet say, and names 105c as in progress.

## Acceptance criteria

- [ ] No card draws a border. Every card in light has `shadow.card`; in dark, none.
- [ ] `hairline` and `shadow.card` / `shadow.float` are in `theme.ts`, per scheme, with the doc's light values; the
      dark `hairline` is in the doc. `border` is gone from `theme.ts` and the code.
- [ ] Budget, Expenses, Income, Statistics' category rows, the category page's expenses and Members' rows draw one
      card per row, 8pt apart, with no divider inside a card (or the plan names the list it leaves, and why).
- [ ] Reordering categories on Budget still drops each row where it's released, on web and on the iPhone.
- [ ] HeaderDivider, TabBar's top edge, the tab layout's bar and DemoStrip's edge use `hairline`.
- [ ] Before and after screenshots at 390×844, light and dark, every screen, in the PR. The snapshot comparison shows
      that only the planned moves happen and that the accessibility record is unchanged. Any row that moves more than
      2pt is listed in the PR.
- [ ] The demo build renders with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- Control sizes and shapes: buttons, chips, IconButton, ScreenHeader, UndoToast, inputs, menus and sheets (105d).
- The floating tab bar and its "+" button (106). TabBar only swaps its edge for `hairline`.
- New behaviour or copy. What "Remaining" means (brief 107 accepted it); this part only notes how it reads.

## Notes

- **Base and version:** main after #174 (v1.23.13). Patch bump, 1.23.13 → 1.23.14, unless main moves first.
- **Size:** about 220 lines in the outline. The plan measures it again. Over 400 lines, split at Gate A.
- **Visual check:** as 105b's (before set from a detached copy of Base on :8084, three QA users `claude-qa-105c`,
  `-m`, `-n`, all sets on one Kyiv day; after 30 November, seed `2026-12`). Most rows move, so the comparison drops
  the colour and shadow columns and checks the planned gaps, not "nothing moves".
- **Lessons from 105 and 105b:** login needs a `deviceId` of 8–64 characters; a DELETE with no body sends no JSON
  content type; clear old `snap:*` keys on 127.0.0.1:8084 first; `create-user --join` makes a member.

## Open questions

- The dark `hairline` value (the plan derives it from the dark palette and checks it against `surface` and `bg`).
- Which lists, if any, stay one card (for example a short fixed list like Settings), and why.

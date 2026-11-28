# The fresh look, part 5: the header, the toast, inputs, menus and sheets

Type: feature

## Why

This is the last part of brief 105 (the fresh look). 105d's Gate A split its brief in two:

- 105 (#173), 105b (#174) and 105c (#175) brought the palettes, Inter, and borderless cards with one card per row.
- 105d (#176) gave every button, chip and icon button one look.
- 105e, this part, does the same for the header, the Undo toast, inputs, menus and sheets, and removes the last
  non-doc colour, `borderStrong`.

The header still comes in three layouts with a 52pt spacer, a text "Back" on forms and a −20 divider bleed. The toast,
inputs, menus and sheets still draw a `borderStrong` edge, which the design system doesn't have.

## What

Apply the Components and Elevation sections of `docs/design/design-system.md`. The outline is in
`git show 210d798b:docs/features/105d-one-look-controls/plan.md`, under "Later parts" › 105e.

- **ScreenHeader, one shape:** a leading round button (Back, or Home on the month tabs), a centred title (a string, or
  the month tabs' MonthSwitcher), and one trailing action. Each side is at least 44pt wide, so the title sits on the
  screen's centre. The header spans the screen with the gutter inside, as 105c's scroll views do, so HeaderDivider
  draws edge to edge without its −20 bleed. The 52pt spacer, `modalBack` and the modal's margin go. The forms' text
  "Back" becomes the round back icon; where a back button's destination isn't shown any more, its accessible name
  says it (for example "Back to November").
- **UndoToast:** `shadow.float`, no edge. Its 56pt height becomes a size token, and Budget's and the category page's
  room for it read one exported value, so their two `eslint-disable`s go.
- **Inputs:** every input takes `fill`, as the doc says. Focus still shows (TextField turns the border `accent`), and
  no content moves. Login's 52pt fields become the doc's 48. No `faint` icon sits on a field's `fill`.
- **Menus:** Statistics' period menu, the category page's ⋯ menu and the name suggestions lose their edge and float
  on `shadow.float`.
- **Sheets:** the category sheet and DateField's iOS sheet lose their top edge (they sit on the backdrop).
- **Members' confirm panel:** a `hairline` edge, since it's a `surface` box on a member's `surface` card (the doc's
  rule: a hairline only where two same-colour surfaces touch). No float shadow: it sits in the flow.
- **Dark mode:** the doc turns shadows off, so the toast and the menus would be `surface` over `surface` cards with no
  outline. By the doc's own rule (a hairline where two same-colour surfaces touch), dark `shadow.float` is a 1pt ring
  in `hairline` (`0 0 0 1px …`), which changes no layout. The doc's Elevation section records it first.
- **`borderStrong`** leaves both palettes and the code.
- **The backlog:** `docs/features/BACKLOG.md` marks 105d done (#176, v1.23.15) and 105 complete, and names 106 next.

## Acceptance criteria

- [ ] ScreenHeader has one shape; its title is centred on the screen; the 52pt spacer, `modalBack`, the modal margin
      and HeaderDivider's bleed are gone. Every back button is a round 44pt icon button with an accessible name.
- [ ] UndoToast has `shadow.float` and no edge; its height and the screens' room for it come from one token, with no
      `eslint-disable` left for them.
- [ ] Every input is `fill` with no visible edge until focus, 48pt high where it's a single-line field; focus still
      shows the `accent` border.
- [ ] Menus and sheets have no `borderStrong` edge; menus float on `shadow.float` (a `hairline` ring in dark).
- [ ] Members' confirm panel has a `hairline` edge.
- [ ] `borderStrong` is gone from `theme.ts` and the code. The contrast test covers every new pair (`muted` on
      `fill` for placeholders and the ₴/€ signs as text).
- [ ] Before and after screenshots at 390×844, light and dark, every screen, in the PR. The snapshot comparison shows
      only the planned moves, and the accessibility record is unchanged except the listed back-button names. Any row
      that moves more than 2pt is listed in the PR.
- [ ] The demo build renders with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- The floating tab bar and its "+" button (106).
- New behaviour or copy, apart from the back buttons' names.
- The tab screens' 20pt gutter against the doc's 16, and LedgerPicker's inset.

## Notes

- **Base and version:** main after #176 (v1.23.15). Patch bump, 1.23.15 → 1.23.16, unless main moves first.
- **Size:** about 340 lines, measured by 105d's planner. Over 400, split at Gate A.
- **Visual check:** as 105d's (before set from a detached copy of Base on :8084, pages in a same-origin 390×844 iframe,
  snapshots compared in Node; QA users `claude-qa-105e`, `-m`, `-n`; all sets on one Kyiv day; from 1 December seed
  `2026-12`). Include focused inputs, an open menu in each theme, the toast, and the iOS sheet from the code only.
- **Lessons:** login needs a `deviceId` of 8–64 characters; a DELETE with no body sends no JSON content type; clear
  old `snap:*` keys on 127.0.0.1:8084 first; `create-user --join` makes a member; synthetic drags and presses don't
  trigger on react-native-web, so those are checked on the iPhone.

## Open questions

- Login's fields at 48 (recommended: yes, the doc's control height).
- The back buttons' names where the destination isn't shown.

# The fresh look, part 4: one look per control

Type: feature

## Why

This is part 4 of brief 105 (the fresh look). At 105's Gate A the brief was split into four parts:

- 105 (#173) brought the palettes, violet bars, the "€X left" label and light as the default.
- 105b (#174) brought Inter and the type mapping.
- 105c (#175, v1.23.14) brought borderless cards and one card per row.
- 105d, this part, gives each control one look.

Buttons, chips, the header and the toast still come in several sizes, radii and disabled opacities, kept on purpose
by 104 so that nothing moved. Inputs, menus and sheets still draw a `borderStrong` edge. The design system gives each
control one shape.

## What

**Split at Gate A (2026-11-27):** measured, the whole of this brief is about 720 changed lines, so it was split. This
brief, 105d, covers Button, Chip, AppearancePicker, IconButton, their contrast pairs and the backlog. 105e (outlined
in this plan's "Later parts", its own brief after 105d merges) covers ScreenHeader, UndoToast and its room, inputs,
menus, sheets, Members' panel and the `borderStrong` token. The items below that belong to 105e are marked (105e).

Apply the Components section of `docs/design/design-system.md`. The outline is in `docs/features/105-fresh-look/plan.md`,
under "Later parts" › 105d.

- **Button:** filled looks are one 48pt pill (`size.control`) with one disabled opacity. `ButtonSize`, the `size`
  prop, `large`'s 56, the 0.6 default and the callers' one-offs go (login's `signIn`/`signInOff`, EmptyMonth's
  `minHeight`/`borderRadius`, Members' `dimmed`). Text looks are 44pt high (`size.iconButton`, the touch minimum),
  and lose `bare`, the `filled && off` rule, Decline's 0.6, the callers' padding overrides and LoadFailed's
  `failedBack`. The doc's `secondary` (`fill` + `text`) and `danger` (`fill` + `danger` text) replace
  `outlinedDanger`; the plan says whether today's filled red `danger` stays. Members' `accessibilityLabel={action}`
  goes (it equals the label). Button's `accentText` look, which draws `accent`, gets a name that says what it draws.
- **Chip:** a 32pt pill (`size.chip`), `fill`, selected `accentTint` with `accentText`, no edge. Its touch area stays
  44pt (a 44pt Pressable around the 32pt pill: `hitSlop` doesn't reach react-native-web). DateChips' 16pt padding, the
  category sheet's `fill` override and the dashed "N more" (a plain chip with the `more` icon) go. The expense form's
  quick chips get room for a name like "education", which truncates since Inter (105b).
- **IconButton:** round (`radius.pill`), so the two `borderRadius: 0` overrides go. The doc's `raised` look only if a
  caller needs it.
- **AppearancePicker:** stays radios (Chip is a button), drawn in Chip's pill and colours.
- **ScreenHeader:** (105e) Back becomes a round IconButton. One shape (back or home, a title, one action) replaces the 52pt
  spacer, the modal's margin and HeaderDivider's −20 bleed.
- **UndoToast:** (105e) `shadow.float`, no edge; its 56pt height comes from a token, with Budget's and the category page's
  `toastRoom` (104).
- **Inputs, menus, sheets and Members' panel:** (105e) `borderStrong` goes, then the token. Inputs on the page take `fill`
  (the doc) and keep a `hairline` only where they sit on a same-colour surface; menus and the panel float on
  `shadow.float`. Members' confirm panel, a white box on a white card since 105c, gets a `hairline`. No icon may sit
  on an input's `fill` in light (`faint` on `fill` is 2.92:1).
- **The backlog:** `docs/features/BACKLOG.md` marks 105c done (#175, v1.23.14) and names 105d in progress.

## Acceptance criteria

- [ ] Every filled button is a 48pt pill with one disabled opacity; every text button is 44pt high. `ButtonSize` and
      the `size` prop are gone, and no caller overrides a button's height, radius, padding or opacity.
- [ ] Every chip is a 32pt pill with a 44pt touch area, `fill` or `accentTint`/`accentText` when selected, no edge.
      The expense form's quick chips show "education" whole at 390pt.
- [ ] Every IconButton is round; no caller overrides its radius.
- [ ] (105e) ScreenHeader has one shape; the 52pt spacer, the modal margin and HeaderDivider's bleed are gone.
- [ ] (105e) UndoToast has `shadow.float` and no edge; its height and the screens' room for it come from one token.
- [ ] (105e) `borderStrong` is gone from `theme.ts` and the code; inputs, menus, sheets and Members' panel follow the doc.
- [ ] Text contrast on every new pairing is at least 4.5:1, and icons 3:1 (the contrast test lists the new pairs).
- [ ] Before and after screenshots at 390×844, light and dark, every screen, in the PR. The snapshot comparison shows
      that only the planned moves happen and that the accessibility record is unchanged, except where a label or
      role is meant to change (listed). Any row that moves more than 2pt is listed in the PR.
- [ ] The demo build renders with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- The floating tab bar and its "+" button (106).
- New behaviour or copy, apart from labels a control's new shape needs (listed in the plan).
- The tab screens' 20pt gutter against the doc's 16, and LedgerPicker's inset: separate follow-ups unless a control's
  shape needs them.

## Notes

- **Base and version:** main after #175 (v1.23.14). Patch bump, 1.23.14 → 1.23.15, unless main moves first, or the
  plan finds a §8b reason for another level.
- **Size:** about 330 lines in the outline. Over 400, split at Gate A into 105d and 105e (for example controls, then
  inputs, menus, sheets and the toast), each its own brief, PR and patch bump.
- **Visual check:** as 105c's (before set from a detached copy of Base on :8084, pages in a same-origin 390×844
  iframe, snapshots compared in Node; QA users `claude-qa-105d`, `-m`, `-n`; all sets on one Kyiv day; from
  1 December seed `2026-12`). Include every state a control has: disabled, selected, pressed where reachable, error.
- **Lessons:** login needs a `deviceId` of 8–64 characters; a DELETE with no body sends no JSON content type; clear old
  `snap:*` keys on 127.0.0.1:8084 first; `create-user --join` makes a member; a synthetic drag doesn't land on
  Expenses (also on main), so drags are checked on the iPhone.

## Open questions

- Whether today's filled red `danger` button stays next to the doc's `fill` + red-text `danger`.
- The new name for Button's `accentText` look.
- Whether to split into 105d and 105e, and where.

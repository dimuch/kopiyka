# Plan: Flush chip tile

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/flush-chip-tile
Base: origin/main (a89a588e)

## Approach

`Chip`'s `pill` style swaps `paddingHorizontal: space.sm` for `paddingRight: space.sm`. A new `padStart`
style (`paddingLeft: space.sm`) goes on only when there's no `leading` (`leading === undefined`). So a chip with a tile
or icon has no left padding, and a date chip keeps 8pt on both sides. `gap`, height, colours and the selected style
stay as they are. All three callers (`CategoryPicker`'s quick chips and "N more", `CategorySheet`, `DateChips`) pick
this up as they are, with no changes.
Alternative considered: keep `paddingHorizontal` and add `paddingLeft: 0` when there is a `leading`. It lost because
the literal `0` trips the `no-restricted-syntax` style-number lint rule and would need a disable comment. Adding
padding where it's needed uses the existing token, needs no disable and is just as small.

## Contracts

- DB: none
- API: none
- App: `Chip` props unchanged. Left padding: none when `leading` is given, otherwise `space.sm`. Right padding is
  `space.sm` either way.
- Reuses: `space.sm` from `theme.ts`; the existing `selected && styles.on` conditional-style pattern in `Chip.tsx`
- New dependencies: none

## Version

Bump: patch — 1.26.0 → 1.26.1
Why: conventions §8b `patch` row (styling). The chip's look changes in production and nothing new is added.

## Slices

- [ ] 0. Bump version to 1.26.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.1
- [ ] 1. Sit the chip's category tile flush with the pill's left end
  - Files: apps/mobile/src/components/Chip.tsx
  - Change: in `pill`, replace `paddingHorizontal: space.sm` with `paddingRight: space.sm`. Add
    `padStart: { paddingLeft: space.sm }`, applied as `leading === undefined && styles.padStart` in the pill's style
    array. Add one line to the JSDoc: a leading tile or icon sits flush with the left end. About 6 lines.
  - Verify: gates. On web at phone width (launch configs `web` + `api`), and on iPhone, compare with main:
    (a) Add expense: each quick chip's tile touches the pill's left end. (b) "N more": its icon's box touches the left
    end. (c) "More categories" sheet: each 28pt tile touches the left end. (d) Date chips: 8pt on both sides, same width
    as on main. (e) Label position after the tile (4pt gap), right padding, 32pt height, colours and the selected tint
    unchanged, in Light and Dark, and with a large text size (taller pill, tile still sits right). Record (a)–(e) in the PR test plan.

## AC → evidence

| AC                                              | Evidence                                              |
| ----------------------------------------------- | ----------------------------------------------------- |
| Quick category chips: tile touches the left end | Slice 1 check (a), web at phone width and iPhone      |
| "More categories" sheet and "N more" flush      | Slice 1 checks (b), (c)                               |
| Date chips' padding unchanged                   | Slice 1 check (d); `DateChips` passes no `leading`    |
| Label, right padding, height, colours, selected | Diff changes only the left padding; slice 1 check (e) |

## Not doing (YAGNI)

- A prop to choose the inset (flush vs 3pt): the user chose flush, and there is one chip look.
- A unit test: it's a style value, and conventions §6 rules out snapshot tests.
- Any change to the tile (briefs 113, 114) or to the chip's height, colours or 44pt touch area.
- An edit to `docs/design/design-system.md`: its `Chip` row says nothing about padding, so nothing in it goes stale.

## Risks

- A caller that relies on the chip's left padding. `rg "<Chip"` finds three callers (`CategoryPicker` ×2,
  `CategorySheet`, `DateChips`), and none sets its own padding. The slice 1 check covers all of them.
- No new module reaches the demo build, so `demo-modules.txt` and `check-builds` don't change.

## Open questions

- no — The "N more" icon is a 20pt `Icon` whose first dot sits about 3pt inside its box (the glyph's own margin), so
  the dot itself won't touch the edge. Assumed: "touches the left end" means the icon's box, as it does for the tile.
  Clipping the glyph's margin is out of scope.

## Follow-ups

## Deviations

- After review the user changed the inset from 0pt (flush) to 3pt on both sides. Slice 1 stays as committed; a new
  commit replaces `padStart` with an `inset` style (`paddingHorizontal: 3`, with an eslint-disable and its reason:
  (32 − 26) / 2, no 3pt token) applied when `leading !== undefined`. Brief ACs updated to match. Checked on web at
  phone width: tile chips 3pt / 3pt, date chips 8pt / 8pt, height 32.

## Consolidate

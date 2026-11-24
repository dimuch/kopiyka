# The fresh look: new palettes, Inter, cards and violet bars

Type: feature

> **Draft, 2026-11-24.** Written from `docs/design/design-system.md` (Roll-out step 3) and the follow-ups that briefs
> 091, 103, 103b, 103c and 107 handed to 105. Not yet reviewed by the user: confirm or correct it before
> `/kopiyka-hos`. Depends on 104.

## Why

Direction **A · Card per row** was chosen on 2026-11-22: light, plain and borderless, with violet as the only brand
colour. 103 and 104 put every screen on tokens and shared components so that this change is mostly `theme.ts`.

## What

Apply `docs/design/design-system.md` as written. It is the source of truth for every value.

- **Colour**: the light and dark palettes from the doc, replacing today's.
- **Type**: Inter (`@expo-google-fonts/inter`, 400/500/600/800) replaces Bricolage Grotesque and IBM Plex Sans, with
  the doc's sizes, weights and negative tracking.
- **Shape**: the doc's radii; cards with one soft `shadow.card` and no borders (hairline only where two same-colour
  surfaces touch). Dark mode has no shadows.
- **Rows**: one card per category row on a pale grey page.
- **Bars**: under plan is `accent` (violet), replacing brief 091's green; then `caution`; then `danger`.
- **Caution label**: a near-plan row shows "€X left" in `cautionText`, as an over-plan row shows "€9 over". This
  keeps colour from being the only signal (the light `caution` bar is the doc's accepted 1.3:1 exception).

## Acceptance criteria

- [ ] Every colour, font, size, radius and shadow in the app comes from the doc's values in `theme.ts`, light and
      dark.
- [ ] Bars go violet → caution → danger at the brief 091 thresholds; a near-plan row shows "€X left" in
      `cautionText`.
- [ ] Contrast: text at least 4.5:1, bars and icons at least 3:1, touch targets at least 44pt, except the doc's one
      accepted `caution` bar exception.
- [ ] Inputs are at least 16px on web, so iOS Safari doesn't zoom on focus.
- [ ] Browser check at ~390×844, light and dark, every screen, and the demo build. iPhone (Expo Go): fonts load and
      the look matches.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- The floating tab bar: brief 106.
- New behaviour or copy, apart from the caution label.

## Notes

Carried over from earlier plans:

- 103: spec `body` 15 for inputs would trigger iOS Safari's focus zoom, so inputs use the `input` role (16). Drop the
  `fontFamily` overrides 103 kept for today's weights.
- 103b/103c: `DateField`'s hidden web `<input type="date">` uses the browser's default font size; check whether iOS
  Safari zooms on it.
- 103c: `amountLg` has one caller. If 105 drops the category hero, check whether the role is still needed.
- 107: "Remaining" means income − budgeted on Budget and budgeted − spent on Expenses. Worth a second look while
  restyling both strips.
- The design borrows principles from Shop, not its branding: kopiyka's own violet `#6D4AFF`, no Shop assets or
  wording.

## Open questions

- One PR or a split (tokens and fonts first, then rows and bars)?
- Is changing 091's green bars to violet a recorded user decision, or should it be confirmed again?

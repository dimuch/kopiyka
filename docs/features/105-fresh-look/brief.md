# The fresh look: new palettes, Inter, cards and violet bars

Type: feature

## Why

On 2026-11-22 the user chose direction **A · Card per row**: a light, plain, borderless look with violet as the only
brand colour. Briefs 103 and 104 moved every screen onto tokens (`theme.ts`) and onto the shared components (`Card`,
`ProgressBar`, `Button`, `IconButton`, `Chip`, `ScreenHeader`, `Text`), all still drawing today's look. This brief
changes the look itself, mostly in `theme.ts` and those components.

## What

Apply `docs/design/design-system.md`. It is the source of truth for every value. Where it and this brief differ, the
plan says which one wins and why.

- **Colour:** the doc's light and dark palettes replace today's blue ones.
  - The doc has no `border`, `borderStrong`, `borderStrongest`, `accentLine`, `activeLine`, `surfaceRaised`, `over`
    or `fainter`. The plan maps each of their callers to a doc token or removes the use. If a token has to stay, the
    plan says why.
  - New `cautionText` token: `#8A6600` in light, `#F2C94C` in dark.
- **Type:** Inter (`@expo-google-fonts/inter`, weights 400, 500, 600 and 800) replaces Bricolage Grotesque and IBM Plex
  Sans, with the doc's sizes, weights and tracking. The two old font packages are removed.
  - Each of `Text.tsx`'s named pairs (`bodyMedium`, `labelRegular`, `labelSemi`, `headingDisplay`, `captionMedium`)
    maps to one Inter weight.
  - Settle the two weight inconsistencies that 104f kept. Login's field labels use a different face from the other
    forms' labels, and the amount inputs use a regular weight (the doc's `input` is 400).
  - The two +0.5 trackings (MonthSwitcher's eyebrow and the category page's day label) get an overline role or
    join `caption`. The plan decides which.
  - The places that style text directly move to Inter too: the `TextInput` styles, DateField's value, CategoryTile's
    letter and TabBar's badge.
- **Shape:** the doc's radii. A card is `surface`, `radius.lg`, `shadow.card` and `md` padding, with no border. A
  hairline stays only where two surfaces of the same colour touch, such as an input on a white sheet. Dark mode has
  no shadows.
- **Rows:** each category row is its own card on the pale page, with an `sm` (8pt) gap between cards. Today the rows
  sit inside one card with dividers. This applies to Budget, Expenses and Income, plus any other list the plan names.
- **One look per control.** 104b–104e kept these differences for this brief:
  - **Filled buttons** become one 48pt pill (`size.control`) with one disabled opacity. These go: `large`'s 56pt, the
    0.6 default, and the one-off overrides (login's Sign in, EmptyMonth, Members' `dimmed`).
  - **Text and outlined buttons** lose `bare`, the `filled && off` rule, Decline's 0.6, the callers' padding overrides
    and LoadFailed's `failedBack`.
  - **Chips** become `size.chip` (32pt) pills, and DateChips' 16pt padding goes. The plan decides what happens to the
    category sheet's raised chip, the dashed "more" chip and the two `borderRadius: 0` overrides.
  - **ScreenHeader:** Back becomes a round `IconButton`. The 52pt spacer, the modal's margin and `HeaderDivider`'s −20
    side bleed give way to one shape: back or home, a title, and one action.
  - **The Undo toast** takes `shadow.float`, and its 56pt height comes from a token.
  - **The plan decides** whether `compact` (44pt) survives, and whether AppearancePicker's segments look like Chip.
- **Bars:** under plan is `accent` (violet), replacing brief 091's green. From 90% of plan up to plan the bar is
  `caution`, and over plan it is `danger`. ProgressBar becomes the doc's 4pt rounded track, with an 8pt dot at the end
  of the fill.
- **Caution label:** a near-plan row shows "€15 left" in `cautionText`, just as an over-plan row shows "€9 over". Then
  colour is never the only signal, which is what makes the light `caution` bar's 1.3:1 contrast an accepted exception.
- **Default theme:** new installs start in light, which is the look this direction was designed in (Open question 1).
  People who have already picked a theme keep it.

## Acceptance criteria

- [ ] Every colour, font, size, radius and shadow comes from the doc's values in `theme.ts`, in light and dark. Each
      token the doc doesn't have is gone from `theme.ts`, or the plan gives a reason to keep it.
- [ ] Only Inter is loaded, and the two old font packages are gone. Each `Text` variant and each exception uses one
      Inter face, with no `fontWeight` that makes web draw a fake bold.
- [ ] Cards have no border, one `shadow.card` in light and no shadow in dark. Each category row is its own card.
- [ ] Filled buttons are one 48pt pill with one disabled look, and chips are 32pt pills. Every touch target is still
      at least 44pt.
- [ ] Bars go violet → caution → danger at brief 091's thresholds. A near-plan row shows "€X left" in `cautionText`,
      and its accessibility label says the same.
- [ ] Contrast: text is at least 4.5:1, bars and icons at least 3:1, except the doc's one accepted `caution` bar. The
      plan lists every pair it checked that the doc doesn't list.
- [ ] Inputs are still at least 16px on web, and DateField's hidden web date input doesn't make iOS Safari zoom.
- [ ] A new install with no saved preference starts in the theme that Open question 1 picks. A saved preference is
      kept.
- [ ] Browser check at 390×844, in light and dark, on every screen, with before and after screenshots in the PR. The
      demo build renders with no console errors, and `yarn mobile check-builds` passes.
- [ ] Accessibility roles and labels are unchanged, apart from the caution label and any change the plan lists.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- The floating tab bar and its "+" button (brief 106). TabBar takes only the new colours and font.
- New behaviour or copy, apart from the caution label and the default theme.
- What "Remaining" means: income − budgeted on Budget, budgeted − spent on Expenses. Brief 107 accepted it. The plan
  notes it if the restyle makes the difference more confusing.
- A lint rule against `text` role spreads and `fontFamily` outside `Text.tsx`. It is 104f's follow-up and gets
  proposed separately.

## Notes

- **Base and version:** main d230a95, v1.23.11. Under conventions §8b, styling plus one label is a patch bump
  (1.23.11 → 1.23.12), unless the plan argues that the default-theme change needs more. If the brief is split, each
  part takes its own patch bump.
- **Where each hand-off is written down:**
  - The plans for 104b (`104b-filled-buttons`), 104c (`104c-text-buttons`), 104d (`104d-icon-buttons-chips`) and 104e
    (`104e-screen-header`), under Follow-ups: "For brief 105, delete these with the old look".
  - `104f-text-component/plan.md`, Follow-ups, "For 105": the Inter weights, the overline role, the `tabular` flag on
    captions with no digits (it can go), and naming the pairs in the doc's `Text` row.
  - `git show 89d43f74:docs/features/103c-design-tokens-screens/plan.md`: DateField's hidden web date input.
  - 104b: Members' confirm passes `accessibilityLabel={action}`, which is the same as its label. It can go now.
- **This brief is meant to change how the app looks.** 104's "nothing moves" snapshots don't apply here. The check is
  screenshots compared with the doc. The snapshot script (in `104h-text-other-screens/plan.md`, under Visual check)
  can still prove what shouldn't change, such as the accessibility record.
- **Test data:** QA users seeded through the API and deleted when the brief is done:
  - an owner with November data that includes under-plan, near-plan and over-plan categories, an actual End, income
    items and an invite;
  - a member, made with `--join`.
- **Lessons from 104:**
  - Keep absolute local paths out of every committed file.
  - Other sessions share the MySQL test database. If the integration tests fail in the schema reset, wait and run
    them again. Never let a commit follow a failed `yarn test`.
  - Open the web app at `127.0.0.1:8084`, the origin the API allows, and check that `innerWidth === 390`.
  - After a scroll or an animated sheet, take a screenshot before checking anything.
  - Take the before and after sets on the same Kyiv day. November ends on 30 November. After that it is an ended
    month, and some forms lock.
- **iPhone check at Gate B (Expo Go):** Inter loads; both themes; a near-plan row, a sheet, a form and login.
- The design borrows principles from Shop, not its branding: kopiyka's own violet `#6D4AFF`, and no Shop assets or
  wording.

## Open questions

1. Should new installs default to light instead of today's dark? The direction was designed and checked in light.
2. One PR, or a split? A likely split, in order, each part with its own screenshots:
   - **105:** the palettes, violet bars, the caution label and the default theme;
   - **105b:** Inter and the type mapping;
   - **105c:** borderless cards, shadows and one card per row;
   - **105d:** one look each for buttons, chips, the header and the toast.

   The plan measures the lines and proposes the split.

3. Does the category page keep its hero figure? It is `amountLg`'s only caller (103c), so if the hero goes, the role
   can go too.

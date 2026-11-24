# Shared components: Text, Card, Button, IconButton, Chip, ScreenHeader, ProgressBar

Type: chore

> **Draft, 2026-11-24.** Written from `docs/design/design-system.md` (Components, Roll-out step 2) and the
> hand-offs in briefs 103–103d. Not yet reviewed by the user: confirm or correct it before `/kopiyka-hos`.

## Why

Briefs 103–103d moved every screen's styles onto design tokens, but each screen still builds its own headers,
buttons, cards and bars from copied style blocks. Members' back header and the 48/56pt buttons, for example, repeat
the modal ones (103d plan, Not doing). Brief 105 changes the look; if these pieces are shared components first, most
of 105 becomes a `theme.ts` change instead of an edit on every screen.

## What

Add the components from the design doc's Components table and move the screens onto them. **Nothing visibly
changes**: the components reproduce today's look from today's tokens.

| Component      | Shape (from the design doc)                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `Text`         | `variant` prop from the type roles; colour defaults to `text`                                  |
| `Card`         | `surface`, `radius.lg`, `shadow.card`, padding `md`; no border (border and shadow come in 105) |
| `Button`       | pill, height 48; variants `primary`, `secondary`, `danger`                                     |
| `IconButton`   | 44×44 round; `plain` or `raised`                                                               |
| `Chip`         | pill, height 32; `fill`, or `accentTint` with `accentText` when selected                       |
| `ScreenHeader` | back or home button, `title`, one trailing action                                              |
| `ProgressBar`  | 4pt track, rounded, with an 8pt dot at the end of the fill                                     |

`TabBar` is brief 106.

## Acceptance criteria

- [ ] Each component above exists and is used wherever a screen had its own copy of that piece. No screen keeps a
      copied header, button, card, chip or bar style.
- [ ] Before/after screenshots at phone width (~390×844), light and dark, of every screen show no change, or only
      shifts listed in the PR (as in 103–103d: each one over 2pt named).
- [ ] Accessibility labels, roles and states are unchanged on web and iOS (`aria-*` props on web, conventions §5).
- [ ] The demo build shows the same screens with no console errors.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- New colours, Inter, radii, shadows, removing borders, the caution label: brief 105.
- The floating tab bar: brief 106.
- Copy, behaviour or label changes.

## Notes

- Expect more than ~400 changed lines. The 103 chain split into 103, 103b, 103c and 103d; plan the same kind of
  split at Gate A (for example components first, then screens in groups).
- Composition rules for the component APIs: the `vercel-composition-patterns` skill, only for components that are
  really reused (conventions §8a).

## Open questions

- Does `ProgressBar` keep today's bar look in 104 and get the 8pt dot in 105, or get the dot now?
- Where the components live (`apps/mobile/src/components/`?): the planner checks conventions §2.

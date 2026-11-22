# Put the app's styles on design tokens

Type: chore

## Why

The app is moving to a new light, borderless, violet look: direction A in
`docs/design/design-system.md`. Today only colours and font names are tokens. The ~40 styled
files use:

- 15 different font sizes
- 17 different spacing values
- 10 different corner radii
- 7 different letter spacings

If we restyled now, we would have to edit every one of those files by hand, and they would drift
apart again. This brief adds the missing tokens and moves the existing styles onto them, keeping
today's look. The new look (brief 105) then becomes mostly a change to `theme.ts`.

## What

- `theme.ts` exports these tokens, with values from `docs/design/design-system.md`:
  - `space`: the 4pt scale
  - `radius`: `sm`, `md`, `lg`, `xl`, `pill`
  - `size`: control heights
  - `text`: the type roles `display`, `title`, `heading`, `body`, `bodyStrong`, `label` and
    `caption`, plus `amount` and `amountLg` with tabular digits
- For this brief, the text roles use **today's fonts** (Bricolage for `display` and `title`, IBM
  Plex for the rest). Inter arrives in brief 105.
- Every style in `apps/mobile/src` reads spacing, radius, height, font size, line height and
  letter spacing from these tokens. Values snap to the nearest step on the scale.
- Every money figure uses `amount` or `amountLg`, so its digits are tabular.
- A guard stops raw numbers coming back. It can be a lint rule or a test; the plan picks one.
- The conventions (§2 `theme.ts` row and §5 styles) say styles read tokens and point to
  `docs/design/design-system.md`.

## Acceptance criteria

- [ ] `theme.ts` exports typed `space`, `radius`, `size` and `text` tokens with the values in
      `docs/design/design-system.md`.
- [ ] No file in `apps/mobile/src` other than `theme.ts` sets `fontSize`, `lineHeight`,
      `letterSpacing`, `borderRadius`, `padding*`, `margin*` or `gap` to a number literal. The
      only exceptions are listed in the guard's allowlist, each with a reason (for example the
      toast clearance or layout maths).
- [ ] The guard fails `yarn lint` or `yarn test` when someone adds `fontSize: 14` to a screen.
- [ ] Every euro or hryvnia amount on screen renders with tabular digits.
- [ ] Before and after screenshots of each tab, the expense form, the category form, Members and
      Login, at 390×844 in light and dark (web), show no layout change. The only differences are
      spacing shifts of up to 2pt and font sizes moving up to 1pt to the nearest role. Any larger
      change is listed in the PR and approved.
- [ ] The demo build (`yarn mobile web:demo`) renders the same screens without errors.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- New colours, the violet palette, Inter, shadows, removing borders, and card-per-row: brief 105.
  That includes the light `caution` change to `#F2C94C`, the new `cautionText` token, and the
  "€15 left" label on near-plan rows. Brief 105 also records the accepted exception to brief
  091's 3:1 bar rule. This brief keeps today's `caution` and adds no colour tokens.
- New shared components (`Text`, `Card`, `Button` and the rest): brief 104.
- Floating tab bar: brief 106.
- Any change to behaviour, copy or accessibility labels.

## Notes

- The size of this change worries me most: it touches ~40 files. If the plan comes to more than
  ~400 changed lines, split it into sequential briefs, for example tokens plus the tab screens
  first, then the forms and components. Don't stack PRs.
- Keep `makeStyles(colors)` and `useThemedStyles` as they are. Tokens that don't depend on the
  colour scheme are plain imports.
- Check on iPhone (Expo Go) at Gate B. Text roles change line heights, and iOS and web can differ.
- The visual direction, values and contrast checks are all in `docs/design/design-system.md`.
  Commit that file with this brief.

## Open questions

- Lint rule (`no-restricted-syntax`) or a Vitest source scan for the guard? Let the planner
  recommend one.

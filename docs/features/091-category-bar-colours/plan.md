# Plan: Colour the category progress bar instead of highlighting the row

Status: approved
Brief: ./brief.md
Branch: feat/category-bar-colours
Base: origin/main (5df77d3, v1.10.0)

## Approach

`budgetProgress` swaps its `warning` boolean for a three-way `state` (`under` / `near` / `over`). It uses the same
integer-cents 90% test as today, plus an "over" check. Its only reader is the Expenses tab, so nothing else changes.
`theme.ts` gets one yellow token, `caution`, and a small `progressColor(state, colors)` that picks the bar colour:
`active` for under, `caution` for near, `danger` for over. The Expenses row paints its bar with that colour and drops
the `warnBg` background. `warnBg` and the comments that exist only because of it are removed. The work comes in two
slices. Slice 1 reshapes the logic to `state` and keeps today's look: `state !== 'under'` is exactly today's `warning`.
Slice 2 adds the colours.
Alternative considered: keep `warning` and add an `over` boolean, then work out the colour in the screen. That leaves
two booleans that together stand for three states, and the colour choice lives inline in the screen where no Node
test can reach it (the app tests can't render components, §6). It lost.

## Contracts

- DB: none
- API: none
- App:
  - `apps/mobile/src/data/budgetProgress.ts`:
    `export type BudgetState = 'under' | 'near' | 'over'`. `under` means spent is below 90% of planned, or nothing is
    spent. `near` means spent > 0, `spent * 10 >= planned * 9` and `spent <= planned`. `over` means spent > planned.
    `BudgetProgress` becomes `{ fill: number; state: BudgetState; overCents: number }`. `warning` is removed, and its
    only reader is `(tabs)/expenses.tsx`.
  - `apps/mobile/src/theme.ts`: new `Palette` key `caution`, dark `#F2C94C`, light `#9A7400`. `warnBg` is removed from
    both palettes. New `export function progressColor(state: BudgetState, colors: Palette): string`: under → `active`,
    near → `caution`, over → `danger`. It's a type-only import from `@/data/budgetProgress`, so no new module reaches
    the demo bundle.
- Reuses: `active` and `danger` tokens as green and red, the `contrast` helper already in `test/theme.test.ts`, and the
  style helpers in `theme.ts` that take a palette (`dangerText`).
- New dependencies: none

Contrast against `track` (WCAG 2, the same formula as `test/theme.test.ts`, computed with a scratch script):

| Token            | Dark value | vs dark `track` `#262A31` | Light value | vs light `track` `#E2E6EC` |
| ---------------- | ---------- | ------------------------- | ----------- | -------------------------- |
| `active` (green) | `#6FD08C`  | 7.60:1                    | `#1B7A3D`   | 4.30:1                     |
| `caution` (new)  | `#F2C94C`  | 9.08:1                    | `#9A7400`   | 3.44:1                     |
| `danger` (red)   | `#FF8A80`  | 6.31:1                    | `#C23B31`   | 4.23:1                     |

All six pass the 3:1 bar. Light yellow is the tight one. Brighter mustards fail: `#A07800` is 3.24:1, and anything
paler drops below 3:1. Darker ones read brown: `#8F6B00` is 3.93:1. `#9A7400` was the most yellow-looking value
that clears 3:1 with some room.

## Version

Bump: patch — 1.10.0 → 1.10.1
Why: §8b `patch` row, styling. The bar changes colour and the row loses its background. No new capability, no API,
DTO or connector change.

## Slices

- [x] 0. Bump version to 1.10.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.10.1
- [x] 1. Tell under, near and over plan apart in a category's progress
  - Files: apps/mobile/src/data/budgetProgress.ts, apps/mobile/test/budgetProgress.test.ts,
    apps/mobile/src/app/(tabs)/expenses.tsx
  - Change: replace `warning` with `state` as in Contracts, with a why-comment on the integer 90% test. Update the `BudgetProgress` JSDoc for `state`: `over` is checked before
    `near`, so €0 planned with anything spent is `over`. The row's
    background condition becomes `r.progress.state !== 'under'`, which matches the same rows as today.
  - Tests: `budgetProgress.test.ts`. Keep every existing row; the table's `warning` column becomes `state`. 0/12000 → under, 10799/12000 →
    under, 10800/12000 (exactly 90%) → near, 12000/12000 → near, new 12001/12000 (1 cent over) → over with overCents
    1, 13240/12000 → over, 900/1001 → under, 901/1001 → near, 0/0 → under with fill 0, 1/0 → over. The `fill` and
    `overCents` expectations don't change. About 30 lines.
- [x] 2. Colour the category bar green, yellow or red instead of highlighting the row
  - Files: apps/mobile/src/theme.ts, apps/mobile/test/theme.test.ts, apps/mobile/src/app/(tabs)/expenses.tsx
  - Change: add `caution` to both palettes, with a one-line comment that the light value keeps 3:1 on `track`. Add
    `progressColor`. Remove `warnBg`. In the Expenses row, drop the background override and set the bar's
    `backgroundColor` inline from `progressColor(r.progress.state, colors)`. Remove `accent` from `styles.bar`. Remove
    the `listCard` comment and its `overflow: 'hidden'`: rows no longer paint a background, and `Pressable` only
    dims opacity. Replace the `overText` comment that mentions `warnBg` with a short why-comment (matches the row
    text; brief 091 leaves it unchanged), and keep its `text` colour.
  - Tests: `theme.test.ts`. Remove the `describe('warnBg')` block. Add `describe('progressColor')`: under →
    `colors.active`, near → `colors.caution` and over → `colors.danger` for both palettes, the three are different,
    and each is ≥ 3:1 against `colors.track` in dark and light. About 45 lines.
  - Verify: `rg -n warnBg apps` finds nothing, and typecheck proves no screen still reads the token. Then the browser
    check in AC → evidence.

Total: about 75 changed lines, not counting slice 0.

## AC → evidence

| AC                                                       | Evidence                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit test of states and cents boundaries                 | `budgetProgress.test.ts` table (slice 1)                                                                                                                                                                                                                                                                 |
| App test: bar uses the colour for its state, no row bg   | `theme.test.ts` › `progressColor` maps each state to its token (slice 2). `warnBg` removed from `Palette`, so `yarn typecheck` fails on any row that still sets it. Browser check below. See Open questions.                                                                                             |
| ≥ 3:1 against `track`, both palettes; colours are tokens | `theme.test.ts` › `progressColor` contrast cases (slice 2). The table in Contracts. The screen takes its colour from `progressColor`, with no hex in `expenses.tsx`.                                                                                                                                     |
| Demo build passes                                        | `yarn mobile export:web` + `yarn mobile check-builds`. No accept is needed, because only a type import is added between modules the demo already holds.                                                                                                                                                  |
| Browser check ~390×844, light + dark, one row per colour | Launch configs `web` + `api`, QA ledger. For the current month, plan and spend so one category is under 90% (green), one is 90–100% (yellow) and one is over (red, with "€X over"). Check that no row has a background, the card's corners are clean, and the screenshots for both themes are in the PR. |
| Gates green                                              | `yarn format:check && yarn lint && yarn typecheck && yarn test` per slice                                                                                                                                                                                                                                |

## Not doing (YAGNI)

- Separate `barUnder` / `barOver` tokens. `active` and `danger` already pass and mean the same thing.
- Colouring the bar anywhere else: Budget tab, category detail, Home, Statistics (out of scope).
- Changing the "€X over" colour, the 90% threshold or the bar size.
- Adding a component-render test setup (React Testing Library, a jsdom environment). That's a new dependency, and the
  colour choice is tested as a pure function instead.

## Risks

- Light `caution` might not read as yellow next to the green and red on a real screen. Slice 2's browser check
  settles it. If it looks brown or orange, the only other value that passes is `#8F6B00`, which is darker. A brighter
  value that is still yellow can't reach 3:1 on `#E2E6EC`, so the user would have to accept a mustard.
- Removing `overflow: 'hidden'` from `listCard` could let a row's contents poke past the rounded corners. Slice 2's
  browser check looks at the first and last rows. If anything does stick out, keep the `overflow` with a new
  why-comment.

## Open questions

- no — The AC asks for an "App test" showing that a row's bar uses its state's colour and that no row has the warning
  background. The app's Vitest runs in Node and can't render screens. Assumption: the pure `progressColor` test,
  removing the `warnBg` token (enforced by typecheck) and the browser check together satisfy it. A render test would
  need a new test dependency that no AC requires.
- no — Light yellow `#9A7400` is a mustard, because a paler yellow can't reach 3:1 on the light `track`. Assumption:
  the user accepts it at Gate A, or picks `#8F6B00`.

## Follow-ups

None.

## Deviations

- slice 0: bumped to 1.10.1, not 1.9.1. Brief 088 (v1.10.0) merged while this was built; rebased onto 5df77d3.

## Consolidate

- `BudgetState` (`data/budgetProgress.ts`): LEAVE. No other spent-vs-plan state type exists in the app.
- `progressColor` (`theme.ts`): LEAVE. No other state-to-colour mapping exists. The other "over" colourings
  (`CollapsingSummary` top-bar total, Budget tab "Left to plan") are single-condition text colours on different
  rules, and the brief keeps them out of scope.
- `caution` token: LEAVE. `over` is orange and fails as yellow. No existing token is yellow.

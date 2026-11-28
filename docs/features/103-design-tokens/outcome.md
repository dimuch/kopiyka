# Outcome: Put the app's styles on design tokens

Brief: ./brief.md · Finished 2026-11-22

## PRs

- [#145](https://github.com/dimuch/kopiyka/pull/145) Put the app's styles on design tokens — v1.17.2

## Decided

- The six tab screens take spacing, radii, control heights and type from tokens in `theme.ts`, from the design
  system (direction A), with a lint rule guarding the converted files.
- Gate A split the work into 103, 103b and 103c, each its own brief and PR (103c later split again into 103d).
- Gate A accepted two changes over 1pt (Expenses total 34 → 28, Statistics period 20 → 22) and the spec's letter
  spacing now, not 0 until Inter.
- Money at small sizes keeps its role plus tabular digits, and the spec's 800 weight renders as today's 700 face.
- Gate B accepted the measured drift: Statistics' last row about 15pt lower with 15 categories, Settings' Appearance
  picker 14.5pt lower. The iPhone check was left for the user.

## Left out

- Shared `IconButton`, `Text` or `Card` components (brief 104), and colours, Inter or shadows (brief 105).
- Tokens for icon sizes, bar heights and tile sizes, and tests of the token constants.

## Follow-ups

- Inputs must stay at 16px so iOS Safari doesn't zoom, and the kept `fontFamily` overrides should go — done in 103b,
  #147 (a 16pt `input` role) and 105b, #174 (Inter, no weight overrides).

Full plan: `git show b70a5d48:docs/features/103-design-tokens/plan.md`

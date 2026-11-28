# Outcome: Put login, Members and no-ledger on design tokens, and lint every screen

Brief: ./brief.md · Finished 2026-11-24

## PRs

- [#151](https://github.com/dimuch/kopiyka/pull/151) Put login, Members and no-ledger on design tokens, and lint every screen — v1.20.1

## Decided

- Login, Members and no-ledger take their spacing, radii, heights and type from the tokens, and the lint rule's skip
  list is gone, so every file in `apps/mobile/src` except `theme.ts` is guarded.
- Gate A accepted login's title 40 → 28 (`display`), the largest text change of the 103 chain.
- Three temporary local test users covered the Members and no-ledger views and were deleted after Gate B.
- Brief 108 took 1.20.0 during review, so the branch was rebased and bumped to 1.20.1. The iPhone check was left for
  the user.

## Left out

- `ScreenHeader`, `Button` or `Card` components (104), and colours, Inter, shadows or borders (105).
- A role for the code input, tokens for the 52pt login field or 56pt Sign in, and any copy or behaviour change.

## Follow-ups

None.

Full plan: `git show 3168377c:docs/features/103d-design-tokens-last/plan.md`

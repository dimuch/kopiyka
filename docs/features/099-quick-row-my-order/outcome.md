# Outcome: Add expense's quick categories follow my order

Brief: ./brief.md · Finished 2026-11-22

## PRs

- [#141](https://github.com/dimuch/kopiyka/pull/141) Add expense's quick categories follow my order — v1.16.0

## Decided

- The five quick tiles follow the member's own category order (brief 092), not the most recently used categories;
  this brief records the reversal of 092's choice.
- Only the API and the demo store changed; the app code needed nothing.
- Minor, not patch: members gain control of their own quick tiles.
- Renumbered from 098, which the importer refactor took first. The checks ran on the demo build and the integration
  tests; the check with a real sign-in was left for the user.

## Left out

- Any recently-used or most-used ordering, or a mix of it with my order.
- Changing the tile count or look, reordering from the form, and editing 092's brief or plan.

## Follow-ups

None.

Full plan: `git show 009b915b:docs/features/099-quick-row-my-order/plan.md`

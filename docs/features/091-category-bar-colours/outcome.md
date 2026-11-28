# Outcome: Colour the category progress bar instead of highlighting the row

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#129](https://github.com/dimuch/kopiyka/pull/129) Colour the category progress bar instead of highlighting the row — v1.10.1

## Decided

- `budgetProgress` returns `under`, `near` or `over` in integer cents, and `progressColor` maps it to green
  (`active`), yellow (a new `caution` token) or red (`danger`). The warm row background and `warnBg` went.
- Light yellow is the mustard `#9A7400`, because a paler yellow can't reach 3:1 on the light track.
- The pure `progressColor` test, typecheck and a browser check stood in for a render test.
- Brief 088 took 1.10.0 during the build, so this shipped as 1.10.1.

## Left out

- Bar colours on Budget, the category page, Home or Statistics, and any change to the 90% threshold or "€X over".
- Separate `barUnder`/`barOver` tokens, and a component test setup (a new dependency).

## Follow-ups

None.

Full plan: `git show cf327228:docs/features/091-category-bar-colours/plan.md`

# Outcome: Statistics in named sections

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#203](https://github.com/dimuch/kopiyka/pull/203) Statistics in named sections — v1.26.17

## Decided

- Roadmap row R15. Three in-file components took their JSX blocks out of `statistics.tsx` unchanged, one commit
  each. The `length` conditions stayed in the screen, so its render reads as "which sections show".
- No fourth `SummarySections` component: it would hide which sections show.
- The nesting goal (≤ 4) was read as not counting fragments.
- The components sit after `PeriodMenu`, next to the other in-file components, not between `Statistics` and
  `PeriodSwitcher` as planned; no effect.
- Web proof by recorded page trees on a lighter matrix (six views, as the skeptic suggested): identical. The load and
  refresh errors weren't rerun: that part is untouched.

## Left out

- The loading, error and refresh triad (R16), the empty check, `PeriodSwitcher` and `PeriodMenu`, and any text or
  style; no `memo`, no `styles` prop, no figure-row component (R17).

## Follow-ups

- BACKLOG.md on `main` still showed R13 in review though #201 had merged — done in 130 (#202)

Full plan: `git show 4326cec3:docs/features/131-statistics-sections/plan.md`

# Outcome: Statistics: month arrows with a period dropdown

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#135](https://github.com/dimuch/kopiyka/pull/135) Statistics: month arrows with a period dropdown — v1.15.0

## Decided

- The brief changed from a dropdown alone to Budget-style arrows with a preset menu, so the version went from patch
  to minor: stepping by month is a new action. Next stops at the current month.
- The switcher sits on its own centred row under the header, and the period line under it went.
- Custom and Last 12 months left the screen, but `presetPeriod`, `moveCustom` and their tests stayed.
- In January, Current month is the one marked, even after choosing This year.
- The web checks ran only after review, signed in as a local QA user; light mode, iPhone and VoiceOver were left.

## Left out

- A shared arrows component or `Dropdown`: two copies don't meet the rule of three.
- Remembering the period, new presets, a native picker, and closing the menu on Escape.

## Follow-ups

- `aria-checked`, `aria-expanded` and `aria-selected` never reach the DOM on web — done in 095, #137.

Full plan: `git show e0742496:docs/features/094-statistics-period-dropdown/plan.md`

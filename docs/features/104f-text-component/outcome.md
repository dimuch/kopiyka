# Outcome: Shared components, part 6: Text

Brief: ./brief.md · Finished 2026-11-26

## PRs

- [#169](https://github.com/dimuch/kopiyka/pull/169) Shared components, part 6: Text — v1.23.9

## Decided

- At Gate A the text work was split into three PRs: this one (`Text`, the shared components and the demo strip),
  then 104g and 104h for the screens, each with its own brief and bump.
- Variants are the 10 `text` roles plus four role-and-face pairs (`bodyMedium`, `labelRegular`, `labelSemi`,
  `headingDisplay`), named by role and weight. Money digits use a `tabular` flag.
- `color` is a palette key, so `Text` follows a theme change and callers don't need `useColors()`.
- Both weight inconsistencies (login's labels, the regular-weight inputs) were kept for brief 105.
- The only snapshot differences were date rows, because the day changed during the final set.

## Left out

- 105's look (Inter, new sizes, an overline role), TextInput styles and TabBar.
- A narrower colour type limited to the text colours.

## Follow-ups

- A lint guard against `text` role spreads and `fontFamily` outside `Text.tsx` and `theme.ts` — in BACKLOG.md
- A conventions §5 line pointing new code at the 104 components and `Text` — in BACKLOG.md
- For 105: map the variants to Inter, decide the overline, drop `tabular` without digits — done in 105b, #174.

Full plan: `git show 3b0c637b:docs/features/104f-text-component/plan.md`

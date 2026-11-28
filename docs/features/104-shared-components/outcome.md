# Outcome: Shared components: Text, Card, Button, IconButton, Chip, ScreenHeader and ProgressBar

Brief: ./brief.md · Finished 2026-11-24

## PRs

- [#156](https://github.com/dimuch/kopiyka/pull/156) Draw every card with a Card component and the bars with ProgressBar — v1.23.1

## Decided

- At Gate A the brief was split into sequential parts, each its own brief, PR and patch bump, with `Card` and
  `ProgressBar` first. This part covers only those two; the rest shipped as 104b–104h.
- `ProgressBar` was extracted now, with one caller, because the brief asked for it and 105 rebuilds it.
- `Card` takes a required `padding` (`padded`, `list`, `group` or `none`), with layout in `style`. Hosts that can't be
  a plain View (Pressable, Animated.View, ReorderList) use `useCardStyle(padding)`.
- "Nothing moves" was proved with layout snapshots in both themes, not screenshots: all 17 cards matched.

## Left out

- 105's look (shadows, borderless cards, the 4pt bar): brief 105.
- Raised surfaces (the toast, menus, sheets) in `Card`: they differ in colour, radius or border.
- A `progressbar` role on the bar: a new screen-reader stop would be a behaviour change.

## Follow-ups

- The measured survey numbers for the later parts and 105 — done in 104b–104h (#160–#171) and 105 (#173–#177).

Full plan: `git show 6b547bc1:docs/features/104-shared-components/plan.md`

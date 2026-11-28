# Outcome: Shared components, part 2: a Button for every filled button

Brief: ./brief.md · Finished 2026-11-25

## PRs

- [#160](https://github.com/dimuch/kopiyka/pull/160) Shared components, part 2: a Button for every filled button — v1.23.3

## Decided

- At Gate A: one PR of about 408 lines, a little over the 400 guide.
- Each button kept its own disabled opacity and spinner placement; brief 105 unified them.
- The two 44pt buttons beside a 44pt text button (Members' confirm, the invite's Accept) kept a `compact` size.
- `icon` came in as a prop for its one caller, Add.
- Brief 109 removed NotionSyncPanel during the build, so its Sync button never needed moving. Main moved to 109's first
  PR, so the bump became 1.23.3.

## Left out

- Outlined and text buttons, icon buttons, chips, headers and `Text`: later parts.
- Opacity, corner or padding props: they would only serve one-offs that 105 removed.

## Follow-ups

- Remove `large`, `ButtonSize`, the 0.6 default and the one-off overrides with the old look — done in 105d, #176.
- Drop Members' `accessibilityLabel={action}` — done in 105d, #176.
- Use Button in the modal-form kit — done in 128, #200.

Full plan: `git show b57c74bb:docs/features/104b-filled-buttons/plan.md`

# Shared components, part 2: a Button for every filled button

Type: chore

## Why

Part 2 of brief 104 (split at its Gate A into 104–104f; part 1, `Card` and `ProgressBar`, is #156). The app's filled
buttons (accent or danger background, white label) are hand-written on 9 screens and components. Each copy sets its
own height, corner, padding, disabled opacity and spinner. Brief 105 turns them all into 48pt violet pills. With one
`Button` it changes them in one place; without it, it edits 11 copies and keeps them in step by hand.

## What

Add `apps/mobile/src/components/Button.tsx` and move the 11 filled buttons onto it. **It draws today's look**, so
nothing visibly changes. The outline in `git show 6b547bc1:docs/features/104-shared-components/plan.md` ("Later parts", 104b) is the
starting point.

| Button                     | Where                       | Today                                                          |
| -------------------------- | --------------------------- | -------------------------------------------------------------- |
| Save                       | `components/CategoryForm`   | accent, min 56, `radius.lg`, spinner replaces the label        |
| Save                       | `app/income-item`           | accent, min 56, `radius.lg`, spinner replaces the label        |
| Add / Update (with a "+")  | `app/expense`               | accent, height 56, `radius.lg`, icon before the label, spinner |
| Save                       | `app/actual-end`            | accent, min 56, `radius.lg`, spinner replaces the label        |
| Remove                     | `app/delete-category`       | danger, min 56, `radius.lg`, spinner replaces the label        |
| Sign in                    | `app/login`                 | accent, height 56, pill, disabled at 0.4                       |
| Copy last month (or other) | `components/EmptyMonth`     | accent, min 48, `radius.md`, full width                        |
| Save label, Invite         | `app/members`               | accent, height 48, pill, disabled at 0.5, small spinner beside |
| Remove (confirm panel)     | `app/members`               | danger, min 44, pill, small spinner beside the label           |
| Accept                     | `components/PendingInvites` | accent, min 44, pill, small spinner beside the label           |

- `Button` takes a `variant` (`primary` or `danger`), the label, `onPress`, `busy` and `disabled`, plus the
  accessibility props its callers pass today. Its size, corner and spinner placement keep today's values through
  props or variants, with each option used by at least two callers. A one-off (EmptyMonth's `radius.md`, login's 0.4)
  stays a style override or an exception, as the plan decides.
- Disabled and busy keep today's accessibility: `disabled`, `aria-busy` and the label given while only a spinner
  shows.

## Acceptance criteria

- [ ] `Button` exists in `apps/mobile/src/components/`, reads only tokens and the palette, and adds no new token.
- [ ] The 11 buttons above render through `Button`. Outside `Button.tsx`, no style sets `backgroundColor:
colors.accent` or `colors.danger` on a pressable, apart from listed exceptions with a reason (for example the tab
      bar's badge).
- [ ] Before and after layout snapshots (the 104 plan's "Snapshot script") at 390×844, light and dark, of every view
      that shows one of these buttons in its idle state: the category form, the income item, the expense form (new and
      edit), the actual End form, delete category, login, an empty Budget month with Copy, and Members as owner. Nothing
      moves; any shift is listed in the PR and approved.
- [ ] The busy and disabled states look and read as before. Check at least one spinner-replaces and one
      spinner-beside button while busy, and login's Sign in while disabled.
- [ ] Roles, labels, `disabled` and `aria-busy` are unchanged (the snapshots' accessibility record).
- [ ] The demo build renders the touched screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- NotionSyncPanel's Sync button: brief 109 removes the panel. Leave it as it is.
- Outlined and text buttons (Sign out, Leave ledger, danger and muted text buttons, links, Undo): 104c. `dangerText`
  and `outlinedDanger*` stay in `theme.ts` until then.
- Icon buttons, chips, headers and `Text`: 104d–104f.
- Unifying sizes, corners, disabled opacity or spinner placement: brief 105. The brief keeps today's values.
- The tab bar's badge, and the expense form's "Added" note, which aren't buttons.
- Brief 105's look (colours, Inter, shadows, borders) and the open question whether new installs default to light.
- Any change to behaviour, copy or accessibility labels.

## Notes

- Base: main 129fb8f, v1.23.1. Version: patch, 1.23.1 → 1.23.2, unless main moves first. Brief 109 may run alongside;
  rebase onto it if it merges first (it touches Home's Sync panel, not these buttons).
- Size: the 104 plan estimated about 380 lines with NotionSync included. Split by screen if the plan measures more than 400.
- Spinner placement differs: it replaces the label on 7 buttons and sits beside it on 4. Disabled opacity is 0.6 on 8,
  0.5 on Members' two, 0.4 on login. These are states, not layout, so the snapshots won't catch a change: check them by
  hand.
- Test data: create a fresh QA user (`yarn api create-user --username claude-qa-104b …`) with November data, and
  delete it when the brief is done. Members' confirm panel and Accept need a second user and an invite, so they may be
  checked from the code only, as 104 did for PendingInvites.
- Check on iPhone (Expo Go) at Gate B: a busy Save (spinner), and Sign in.

## Open questions

- Gate A: keep the 3 disabled opacities (0.6, 0.5, 0.4) and 2 spinner placements per caller (no change) or unify them now (a small
  state change, before 105)? Recommend keeping them, as the 104 split agreed.
- Members' confirm Remove and PendingInvites' Accept are 44pt, under the 48pt `control` size. Keep 44 (they sit in a
  row with a 44pt text button) as a `compact` size?

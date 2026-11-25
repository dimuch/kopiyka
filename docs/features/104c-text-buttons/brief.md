# Shared components, part 3: outlined and text buttons through Button

Type: chore

## Why

Part 3 of brief 104 (split at its Gate A into 104–104f; part 1 is #156, part 2 is #160). Part 2 put the 11 filled
buttons on one `Button`. The app's other buttons are still hand-written: 3 outlined danger buttons built from
`theme.ts` helpers, and about 14 text-only buttons in danger, muted or accent colours, each with its own height and
padding. Brief 105 restyles them all (danger buttons become grey `fill` pills with danger text, per the design system).
With them on `Button` that is one change; without, it is 17 copies plus 3 helpers in `theme.ts`.

## What

Give `Button` the outlined and text looks and move these buttons onto it. **It draws today's look**, so nothing
visibly changes. The outline in `docs/features/104-shared-components/plan.md` ("Later parts", 104c) is the starting
point.

| Look            | Button                           | Where                                  | Today                                                                                                        |
| --------------- | -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| outlined danger | Sign out                         | `app/(tabs)/settings`                  | `outlinedDangerButton`: height 48, pill, 1pt `borderStrong`, `surface`; bodyStrong danger; plus margin below |
| outlined danger | Sign out                         | `app/no-ledger`                        | the same helper                                                                                              |
| outlined danger | Leave ledger                     | `app/members`                          | the same helper                                                                                              |
| danger text     | Remove                           | `app/category-form`                    | `dangerText` (body, medium, danger), height 48, centred                                                      |
| danger text     | Delete item                      | `app/income-item`                      | the same, height 48                                                                                          |
| danger text     | Delete expense                   | `app/expense`                          | the same, height 48                                                                                          |
| danger text     | Remove (member), Revoke (invite) | `app/members`                          | the same text, min 44 × 44, padding 4                                                                        |
| muted text      | Decline                          | `components/PendingInvites`            | body medium muted, min 44, padding 12, 0.6 while busy                                                        |
| muted text      | Back / Close (confirm panel)     | `app/members`                          | the same                                                                                                     |
| muted text      | Back (load failed)               | `app/expense` (`LoadFailed`)           | body medium muted, height 44, padding 8, pulled left 8                                                       |
| accent text     | Retry                            | `components/LoadError`                 | bodyStrong accent, min 44, padding 8, left-aligned                                                           |
| accent text     | Check for invites                | `app/no-ledger`                        | the same, pulled left 8                                                                                      |
| accent text     | Use calculated end               | `app/actual-end`                       | bodyStrong accent, height 48, centred                                                                        |
| accent text     | Try it now, Request access       | `app/login` (role `link`, in a `Link`) | bodyStrong accent, min 44 × 44, padding 16, centred                                                          |

- `Button` gains the looks it needs (for example an `outlined` and a `text` variant, or a separate tone): the plan
  decides the API. Each option is used by at least two callers; a one-off stays a style override or an exception.
- `outlinedDangerButton`, `outlinedDangerText` and `dangerText` leave `theme.ts` once nothing uses them.
- Disabled and busy keep today's look and accessibility: role (`button`, or `link` for login's two), label,
  `disabled` and `aria-busy` where set today.

## Acceptance criteria

- [ ] `Button` covers the buttons above, reads only tokens and the palette, and adds no new token.
- [ ] `outlinedDangerButton`, `outlinedDangerText` and `dangerText` are gone from `theme.ts`, apart from a listed
      exception with a reason.
- [ ] Before and after layout snapshots (the 104 plan's "Snapshot script") at 390×844, light and dark, of every view
      that shows one of these buttons: Settings, no-ledger, Members (as owner and as a member), the category form,
      income item and expense form when editing, a load error with Retry, actual End with an actual end set, login and
      PendingInvites with an invite. Nothing moves; any shift is listed in the PR and approved.
- [ ] Busy and disabled look and read as before: at least Decline while busy and a delete button while saving.
- [ ] Roles, labels, `disabled` and `aria-busy` are unchanged (the snapshots' accessibility record).
- [ ] The demo build renders the touched screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- The header Back buttons (text Back on the form screens, icon Back on the category screen and Members): 104e builds
  `ScreenHeader` on this part's muted text button.
- The category ⋯ menu's "Remove from …" item: a menu row, not a button. It keeps `dangerText`'s look as its own style.
- UndoToast's 56pt Undo inside the toast, and DemoStrip's 13pt "Sign in" (an expo-router `Link` drawn as text, not a
  Pressable): exceptions, unless the plan finds they fit without a change.
- Icon buttons, chips, headers and `Text`: 104d–104f.
- Unifying heights, paddings or colours: brief 105.
- Any change to behaviour, copy or accessibility labels.

## Notes

- Base: main 4acc04d, v1.23.3. Version: patch, 1.23.3 → 1.23.4, unless main moves first. Brief 109 may still be
  running alongside; rebase onto it if it merges first.
- Size: the 104 plan estimated about 250 lines. Split by screen if the plan measures more than 400.
- Test data: one fresh QA user (`yarn api create-user --username claude-qa-104c …`) with November data, plus a second
  user as a member of its ledger (Leave ledger, Remove), a live invite (Revoke, and Decline from the invitee's side) and
  a user with no ledger (no-ledger's Sign out and Check for invites). Invites expire within an hour, so take those
  views together. Delete all of them when the brief is done.
- Check on iPhone (Expo Go) at Gate B: Settings' Sign out, and a delete button on a form.

## Open questions

- Gate A: what the API looks like. Extend `variant` (`outlined`, `text`) with a `tone` (`danger`, `muted`, `accent`),
  or add new variants for each pair? Recommend whatever keeps the call sites shortest without a boolean.
- Login's two links are Pressables with role `link` inside an expo-router `Link`. Should `Button` take a `role` prop,
  or do they stay an exception?
- The text buttons' heights are 44 (min or fixed) or 48. Map them to the existing `compact` and `medium` sizes, or
  keep heights per caller as overrides?

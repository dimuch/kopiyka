# Shared components, part 8: Text on the remaining screens

Type: chore

## Why

This is part 8, the last part, of brief 104. At 104f's Gate A, the `Text` work was split into three parts:

- 104f (#169) built `Text` and moved the shared components onto it.
- 104g (#170) moved the tab screens and the category page.
- 104h, this part, moves the rest.

Settings, Members, the form screens, login and no-ledger still draw text with React Native's `Text` and a local style
that spreads a `text` role and patches it. Until they move, brief 105's new type has to be edited into each of them
by hand. Once they do, no file outside `Text.tsx` and `theme.ts` styles text directly, apart from the agreed
exceptions.

## What

Move every `<Text>` on these screens onto `Text` (`apps/mobile/src/components/Text.tsx`). **It draws today's look**,
so nothing visibly changes. The outline is in `docs/features/104f-text-component/plan.md`, under "Later parts" › 104h.

- **Screens:** 50 `<Text>` elements in 8 files under `app/`:
  - `(tabs)/settings.tsx`
  - `members.tsx`
  - `actual-end.tsx`
  - `delete-category.tsx`
  - `expense.tsx`
  - `income-item.tsx`
  - `login.tsx`
  - `no-ledger.tsx`
- **Variants and props:** use the existing variants, `color` palette keys and the `tabular` flag. A new pair is added
  only if a combination has no variant yet. The plan says which, if any.
- **State switches go through props, not style patches.** These include error lines in the `over` colour, busy or
  disabled text, and the selected ledger.
- **Roles stay as they are:** `header` and `alert` on text today keep their roles.
- **The weight inconsistencies stay**, as decided at 104f's Gate A. Login's field labels keep `label` in its own
  medium face, unlike the other forms' semibold. The amount inputs' regular weight is a `TextInput`, so it's out of
  scope. Brief 105 settles both.
- **The final search, over all of `apps/mobile/src`:**
  - no style spreads a `text` role or sets `fontFamily` outside `Text.tsx`, `theme.ts` and the listed exceptions;
  - React Native's `Text` is imported only by `Text.tsx`, CategoryTile, DateField and TabBar.

  The exceptions, as 104f listed them:
  - CategoryTile's letter
  - DateField's value
  - TabBar's badge
  - the `TextInput` styles, including login's password input

## Acceptance criteria

- [ ] In the 8 files, every `<Text>` renders through `Text`, and no style spreads a `text` role or sets `fontFamily`
      outside a `TextInput` style.
- [ ] The final search over `apps/mobile/src` finds only `Text.tsx`, `theme.ts` and the listed exceptions.
- [ ] `Text.tsx` adds no new token. Any new variant is built from an existing role and face.
- [ ] Before and after layout snapshots at 390×844, light and dark, with 104f's snapshot script (in the 104f plan).
      Views:
  - Settings
  - Members: as owner with an invite, its confirm panel open, and as a member
  - the 5 forms, each in its idle state, with a validation or load error where the form has one, and while saving
    where that changes text
  - login, also with its error line
  - no-ledger, also with an invite

  Nothing moves; any shift is listed in the PR and approved.

- [ ] Roles and labels are unchanged, as shown by the snapshots' accessibility record.
- [ ] The demo build renders the touched screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- Brief 105's look (Inter, new sizes, tracking and colours), and fixing the two weight inconsistencies.
- `TextInput` styling and `TabBar` (brief 106).
- A lint rule that keeps role spreads out of new code, and pointing conventions §5 at the 104 components. Both are
  proposals for after this part (104f's Follow-ups), not slices.
- Any change to copy, labels or behaviour.

## Notes

- **Base and version:** main beddcd5, v1.23.10. Patch bump, 1.23.10 → 1.23.11, unless main moves first.
- **Size:** about 220 lines in the 104f outline. The plan measures it again.
- **Test data:** QA users seeded through the API, deleted when the brief is done.
  - an owner, with November data and an invite;
  - a member, made with `--join`;
  - a user with no ledger and a live invite (`--join`, then removed by the owner, as in 104c).

  Also seed data for an actual End on Budget, and an income item.

- **Timing:** take both snapshot sets on the same Kyiv day, well before midnight. The forms show today's date, and
  November ends on 30 November. After that it is an ended month, and some forms lock.
- **Lessons from 104b–104g:**
  - Keep absolute local paths out of every committed file.
  - The MySQL test database is shared with other sessions. If the integration tests fail in the schema reset, wait
    and run them again. Never let a commit follow a failed `yarn test`.
  - Open the web app at `127.0.0.1:8084`, which is the origin the API allows.
  - Check `innerWidth === 390` in every result.
  - Before opening a menu, check that nothing is scrolled.
  - Take a screenshot after a scroll or an animated sheet before snapshotting.
- **iPhone check at Gate B (Expo Go):** Settings, Members, a form and login, in both themes.

## Open questions

- One PR, or a split if the measured size passes 400 lines?
- Does any combination on these screens need a new variant, or do the existing ones cover them all?

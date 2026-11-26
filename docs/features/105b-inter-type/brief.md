# The fresh look, part 2: Inter and the type mapping

Type: feature

## Why

This is part 2 of brief 105 (the fresh look). At 105's Gate A the brief was split into four parts:

- 105 (#173) brought the palettes, violet bars, the "€X left" label and light as the default.
- 105b, this part, brings the design system's font.
- 105c brings borderless cards and one card per row.
- 105d gives each control one look.

The app still draws text in Bricolage Grotesque and IBM Plex Sans, with sizes from the design system but weights and
faces from before it. Two weight inconsistencies that 104f kept for this brief are still there.

## What

Apply the Type section of `docs/design/design-system.md`. The outline is in `docs/features/105-fresh-look/plan.md`,
under "Later parts" › 105b.

- **Font:** Inter (`@expo-google-fonts/inter`, weights 400, 500, 600 and 800) replaces Bricolage Grotesque and IBM
  Plex Sans. AppShell loads the four Inter faces, and the two old packages are removed.
- **Roles:** each `text` role in `theme.ts` takes the doc's weight and tracking:
  - `display` and `title`: 800
  - `heading` and `bodyStrong`: 600
  - `label`: 500
  - `body`, `caption` and `input`: 400

  `fonts` holds one face per weight, and nothing sets `fontWeight`, which would make web draw a fake bold.

- **`Text.tsx`'s pairs** each map to one Inter weight: `bodyMedium` 500, `labelRegular` 400, `labelSemi` 600,
  `captionMedium` 500. `headingDisplay` is the same as `heading` in Inter, so its 10 sites move to `heading`, or to
  `title` where the doc gives a sheet or form title to `title`. The plan lists each site, and whether the pair goes.
- **The two weight inconsistencies:**
  - Every field label uses `label` (500), as login's already does. The `labelSemi` field labels move. There are 11
    `labelSemi` sites in all; the plan says which are field labels.
  - Every input is `input` at 400. The medium-face overrides in AmountFields, CategoryForm, Members, login and
    DateField's value go.
- **The +0.5 trackings:** MonthSwitcher's eyebrow and the category page's day label join `caption`, and their two
  `eslint-disable`s go. The doc has no overline role. If they read too tight on the iPhone, the fallback is an
  `overline` role, added to the doc first.
- **`tabular`** goes from captions that have no digits. The doc's `Text` row names the pairs.
- **The exceptions** that style text directly take Inter too:
  - CategoryTile's letter: 800
  - TabBar's badge
  - login's code field: 800, keeping its 26pt size and 8 tracking
- **DateField's hidden web date input** gets the `input` size (16px), so focusing it can't make iOS Safari zoom
  (103c's hand-off).
- **The backlog:** `docs/features/BACKLOG.md` marks 105 part 1 done (#173, v1.23.12), which its "In progress" line
  doesn't yet say.

## Acceptance criteria

- [ ] Only Inter is loaded. Neither old font package is in `apps/mobile/package.json`, `yarn.lock` or the code.
- [ ] Every `text` role and every `Text` variant uses one Inter face with the doc's size, line height, weight and
      tracking. No style in `apps/mobile/src` sets `fontWeight`.
- [ ] Every field label is `label` (500) and every input is `input` (400): login, the forms, Members and DateField
      included.
- [ ] MonthSwitcher's eyebrow and the category page's day label use `caption`, and no `eslint-disable` for a
      tracking is left.
- [ ] DateField's hidden web input is 16px.
- [ ] The search from 104h still finds text styled directly only in `Text.tsx`, `theme.ts` and the listed exceptions.
- [ ] Before and after screenshots at 390×844, light and dark, every screen, in the PR. The snapshot comparison shows
      that boxes move only by text metrics, and that the accessibility record is unchanged. Any row that moves more
      than 2pt is listed in the PR.
- [ ] The demo build renders with no console errors. `yarn mobile check-builds --accept` updates
      `demo-modules.txt`, and its diff is reviewed.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- Colours, cards, shadows and row layout (105c), and control sizes and shapes (105d).
- Any change to copy, labels or behaviour.
- Type sizes the doc doesn't set. A size that changes because of a role move is in scope and listed.

## Notes

- **Base and version:** main 1e6f6f5, v1.23.12. Patch bump, 1.23.12 → 1.23.13, unless main moves first.
- **Size:** about 180 lines in the outline, not counting `yarn.lock`. The plan measures it again. Over 400 lines,
  it splits.
- **The font package:** install with `npx expo install @expo-google-fonts/inter`, so the version matches the SDK.
  The user's Yarn holds back versions under 24 hours old. If the version Expo picks is that new, wait for it; never
  bypass the age gate.
- **Snapshots:** the 105 plan's `__shapeSrc` compares boxes, and every text box will move a little with the new
  metrics. So the check is: the accessibility record is unchanged, no element appears or disappears, and the
  screenshots match the doc. The plan says how it separates text-metric moves from layout moves.
- **Test data:** QA users seeded through the API and deleted when the brief is done, as in 105: an owner with November
  data (under, near and over categories, an actual End, an income item, an invite), a member, and a user with no
  ledger.
- **Lessons from 105:**
  - In a worktree, the test database URL is in the main checkout's `apps/api/.env`.
  - The login API needs a `deviceId` of 8 to 64 characters. A DELETE with no body must not send a JSON content type.
  - Clear old briefs' `snap:*` keys from localStorage on 127.0.0.1:8084 before a snapshot run.
  - Take the before set from a detached copy of main on :8084, then start the branch on :8084. Take both sets on one
    Kyiv day. November ends on 30 November; after that, seed December.
  - Keep absolute local paths out of every committed file.
- **iPhone check at Gate B (Expo Go):** Inter loads with no flash of the old font, both themes, the eyebrow and day
  labels, login's code field, and a date field in iOS Safari (no zoom on focus).

## Open questions

- Which `headingDisplay` sites become `title`, and which `heading`? The plan proposes each one against the doc's role
  table.
- Does `captionMedium` stay a pair, or do its callers move to `label`?

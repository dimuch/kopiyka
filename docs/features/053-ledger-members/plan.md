# Plan: Members screen: see, remove and leave

Status: approved

Brief: ./brief.md
Branch: feat/ledger-members
Base: origin/main after PR #66 (brief 052) merges. This branch is rebased onto that main before any code is written.
Every reference below to `ledger_not_found`, `fetchMe`, `openLedger`, `setLedgerGoneHandler`, `useSession().ledgers`,
`LedgerPicker`, Settings' Ledger section, `no-ledger.tsx`, and `members.int.test.ts` (its `joinUser` and `owner`
fields) is to #66's code, read at `cda44bc` in the sibling worktree `kopiyka-ledger-invites`.

Design source: `../052-ledger-invites/plan.md`, Part 2 (slices 2.1–2.5), with its Contracts and Approach. Changes
from that design are listed under "Changed from the 052 design" below.

## Approach

- **API.** Two routes go in `ledgers/routes.ts` behind `[requireAuth, requireLedger]`. One lists the members, for
  the owner only (a member gets `403 owner_only`, decided at Gate A). The other is `DELETE …/members/:userId`, which
  covers both cases: the owner removing someone, and a member removing themselves (leaving). Both owner checks are
  inline (one line each). The list is the only route that is owner-only throughout, and the DELETE's check depends on
  its target, so a `requireOwner` preHandler would have one caller. 054 adds two owner-only routes; that is when
  `requireOwner` arrives, and the list switches to it. The `DELETE` also matches `role = 'member'`, so the owner's row
  can never go.
- **App.** A `useMembers` hook (shaped like `useMonth`) and a pushed `app/members.tsx` screen, opened from a "Members"
  row in Settings that is always shown, on its own. The screen picks a view by `ledger.role`: the owner's view loads
  the list with `useMembers`; a member's view shows the ledger ("dimuch’s Home") and Leave, and fetches nothing.
  Remove and Leave both call `removeMember(ledgerId, userId)`. Each needs a second, inline tap (decided by the user;
  there's no Undo, and browsers can block `confirm()`, see brief 043).
- **Settings picker.** The open ledger's row in #66's `LedgerPicker` turns green, using three new theme tokens
  (Gate A).
- **After Remove**, the owner's list reloads. The removed member's next request gets `ledger_not_found`, and #66's
  handler moves them off the ledger. **After Leave**, the screen calls `router.dismissTo('/')`. Home's focus reload
  gets `ledger_not_found`, and the same handler opens another ledger or the no-ledger screen. The ledger-gone
  handler stays the only path; `AuthContext` gains no export.

Alternative considered: a `refreshLedgers()` on `AuthContext` that Leave calls directly. It was dropped in 052's
skeptic pass. The handler already does exactly this on the next request, and a second way in would be a second thing
to keep correct.

### Changed from the 052 design (checked against #66's code)

- `removeMember` arrives in 2.6 with its first caller, not with the hook (2.4), so no slice leaves an unused function
  behind.
- Settings' "Ledger" section stays as #66 built it (only with 2+ ledgers). The Members row sits on its own outside
  it, always shown (Gate A).
- The Settings row opens the screen with `usePushOnce` (`pushOnce.ts`), which exists on Base and wasn't named in 052.
- If Remove gets `not_found` (the member already left), the panel says so and the list reloads when it's closed
  (Gate A), instead of "Couldn’t remove".
- The member list is owner-only (Gate A), so a member's screen has no list and doesn't call `useMembers`.
- Failure text follows the repo's wording ("… Check your connection and try again."), and Leave has its own text.
- Nothing in #66 contradicts the design. `fetchMe()` (no argument) reads the stored choice. After Leave, that choice
  (the left ledger, or nothing) no longer matches, so `pickLedger` falls back to the first ledger or `noLedger`.
  `openLedger` isn't needed here.

## Contracts

- DB: none. `ledger_members` (001) already has `role ENUM('owner','member')`, `joined_at`, and
  `PRIMARY KEY (ledger_id, user_id)`.
- API (errors `{ error: code }`; Zod 400 `invalid_request`; no session → 401; non-member of `:id` → 404
  `ledger_not_found` from `requireLedger`):
  - `GET /api/ledgers/:id/members` → 200 `{ members: [{ userId: number, username: string, role: 'owner' | 'member' }] }`
    for the owner. A member gets `403 owner_only` (checked after `requireLedger`, so a non-member still gets 404
    `ledger_not_found`). Owner first, then by `joined_at`, then `user_id`. SQL:
    `SELECT m.user_id, u.username, m.role FROM ledger_members m JOIN users u ON u.user_id = m.user_id WHERE m.ledger_id = ? ORDER BY m.role, m.joined_at, m.user_id`,
    with the comment "ENUM sorts by index: owner first".
  - `DELETE /api/ledgers/:id/members/:userId` (`userId`: `z.coerce.number().int().positive()`) → 204. Checks, in
    this order:
    1. The target is the caller and the caller is the owner → `409 owner_cannot_leave`.
    2. The target is someone else and the caller isn't the owner → `403 owner_only`.
    3. `DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ? AND role = 'member'` deletes nothing →
       `404 not_found` (the target isn't a member here).

    The removed user's expenses stay in the ledger.

  - Consumers: `useMembers` and `removeMember` (below); 054 later adds `invites` to the GET.
- App:
  - `api/types.ts`: `Member { userId: number; username: string; role: 'owner' | 'member' }`,
    `LedgerMembers { members: Member[] }`.
  - `data/useMembers.ts`:
    `useMembers(ledgerId: number): { data: LedgerMembers | null; error: boolean; reload: () => void }`. It has
    `useMonth`'s shape: reload on focus, `let live`, state tagged with `${ledgerId}#${version}`, and a failed
    refetch keeps `data`.
  - `data/members.ts`: `removeMember(ledgerId: number, userId: number): Promise<void>`. It removes someone (owner),
    or leaves when `userId` is the caller's.
  - Route `app/members.tsx`, registered as `<Stack.Screen name="members" />` in `_layout.tsx`'s signed-in
    `Stack.Protected` group (a pushed card, not a modal). Two module-local views chosen by `ledger.role`, so hooks
    stay unconditional: `OwnerMembers` (calls `useMembers`) and `MemberLeave` (no fetch).
  - `theme.ts`: three tokens in both palettes for the open ledger in `LedgerPicker` (no green exists today; the
    palettes have only blue `accent*`, `over`, `danger`, `warnBg`):

    | Token        | Dark      | Light     | Use                 | Contrast (text on tint)   |
    | ------------ | --------- | --------- | ------------------- | ------------------------- |
    | `activeTint` | `#132A1C` | `#E3F4E8` | selected row fill   | —                         |
    | `activeLine` | `#24543A` | `#9DD5AE` | selected row border | —                         |
    | `active`     | `#6FD08C` | `#1B7A3D` | selected row's text | 8.05:1 dark, 4.71:1 light |

    For comparison, today's `accent` on `accentTint` is 7.12:1 dark and 4.97:1 light. `AppearancePicker` keeps
    `accent*`.
- Reuses: `requireAuth`/`requireLedger`, and the `ResultSetHeader.affectedRows` → 404 pattern (expenses routes).
  `joinUser`, `makeUser`, `authHeader` and `clearData` in `members.int.test.ts`. `useMonth`'s hook shape,
  `LoadError`, the `Icon` names `back`/`forward`, and `usePushOnce`. The `goBack` fallback from
  `category/[categoryId].tsx`. The `inFlight` ref plus `busy` guard, and `AccessibilityInfo.announceForAccessibility`
  for errors (Settings' `switchTo`, `delete-category.tsx`). `router.dismissTo('/')` (`delete-category.tsx`:107).
  `useSession()` for `user` and `ledger` (`role`, `name`, `owner`, `ledgerId`). `delete-category.tsx`'s `gone`
  pattern (an answer that retrying can't change hides the action button).
- New dependencies: none.

## Slices

- [x] 2.1 List a ledger's members for its owner (~65)
  - Files: `apps/api/src/ledgers/routes.ts`, `apps/api/test/members.int.test.ts`
  - Change: the GET route per Contracts, with the inline owner check and a comment on why it isn't `requireOwner` yet.
  - Tests (in the existing suite; dimuch owns the ledger, olena joined): "lists the members for the owner": dimuch
    gets
    `{ members: [{ userId: dimuch.userId, username: 'dimuch', role: 'owner' }, { userId: olena.userId, username: 'olena', role: 'member' }] }`.
    "a member gets owner_only from the list": olena → `[403, { error: 'owner_only' }]`. "needs a session": 401.
    "answers ledger_not_found to someone outside the ledger": a `makeUser` stranger gets
    `[404, { error: 'ledger_not_found' }]`.
- [x] 2.2 Let the owner remove a member, and a member leave (~130)
  - Files: `apps/api/src/ledgers/routes.ts`, `apps/api/test/members.int.test.ts`
  - Change: the DELETE route per Contracts. The comment says why the owner can't leave: a ledger always keeps its
    owner, and ownership transfer is out of scope.
  - Tests ("still listed" and "member list" checks read the list as dimuch, the only one who may):
    - "the owner removes a member, whose next request is ledger_not_found": 204. Then olena's
      `GET …/categories?month=2026-10` → `[404, { error: 'ledger_not_found' }]`, her `GET /api/ledgers` → `ledgers: []`,
      and dimuch's member list is `[dimuch]`.
    - "a member leaves, with the same effect": olena deletes herself → the same three checks.
    - "a member can't remove anyone": sam joins via `joinUser`. Olena removing sam → `[403, { error: 'owner_only' }]`,
      and olena removing dimuch → the same. All three are still listed.
    - "the owner can't leave": dimuch deleting dimuch → `[409, { error: 'owner_cannot_leave' }]`, and he's still listed.
    - "answers not_found for someone who isn't a member here": the owner targeting the stranger's id, and 999999 →
      `[404, { error: 'not_found' }]`.
    - `userId=abc` → 400. No session → 401. The stranger deleting olena from dimuch's ledger →
      `[404, { error: 'ledger_not_found' }]`, and olena is still listed.
- [x] 2.3 Show the open ledger in green in the Settings picker (~30)
  - Files: `apps/mobile/src/theme.ts`, `apps/mobile/src/components/LedgerPicker.tsx`, `apps/mobile/test/theme.test.ts`
  - Change: add `active`, `activeTint`, `activeLine` to both palettes (values and contrast in Contracts, with a
    one-line comment: "the open ledger in Settings' picker"). `LedgerPicker`'s `optionOn` uses `activeTint`/
    `activeLine` and `textOn` uses `active`. `AppearancePicker` is untouched.
  - Tests: `theme.test.ts`, with its existing `contrast()` helper and `warnBg`'s `it.each` over both palettes:
    "keeps the open ledger's text readable in the %s theme": `contrast(colors.active, colors.activeTint)` ≥ 4.5.
  - Verify (web 390×844, light and dark):
    - Setup, kept for 2.5 and 2.6: look up dimuch's ledger id rather than assuming 1,
      `SELECT l.ledger_id FROM ledgers l JOIN users u ON u.user_id = l.owner_user_id WHERE u.username = 'dimuch'`.
      Create `claude-qa-053b` without `--join` (it owns a ledger) and add it to dimuch's with
      `INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (<that id>, <id>, 'member')`. Keep the TOTP
      secret only in the session scratchpad.
    - As claude-qa-053b: Settings' picker shows the open ledger's row with a green fill, border and text. Switching
      moves the green to the other row. The Appearance picker's selected option is still blue. iPhone at Gate B.
- [x] 2.4 Load a ledger's members in the app (~50)
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/src/data/useMembers.ts` (new)
  - Change: `Member`, `LedgerMembers`, and `useMembers` per Contracts.
  - Verify: typecheck and lint. 2.5 is the first caller. The hook has no pure logic to unit-test, the same as
    `useMonth`.
- [x] 2.5 Show the ledger's members on a screen opened from Settings (~135)
  - Files: `apps/mobile/src/app/members.tsx` (new), `apps/mobile/src/app/_layout.tsx`,
    `apps/mobile/src/app/(tabs)/settings.tsx`
  - Change, Settings: the "Ledger" section is unchanged (only with 2+ ledgers). Below it (with one ledger: below the
    account card), always shown, a "Members" row on its own: a `Pressable` with `accessibilityRole="button"`, label
    "Members", min height 44, the picker's surface and border, and a trailing `forward` icon. It opens `/members` via
    `usePushOnce`.
  - Change, screen:
    - Header: a Back button (`back` icon, "Back"). It goes back if it can, else `router.replace('/settings')`
      (opened from a web link). Then the title "Members" (`accessibilityRole="header"`) and the caption
      `` `${ledger.owner}’s ${ledger.name}` `` ("dimuch’s Home"). Every ledger is named "Home", so the owner tells them
      apart, as in `LedgerPicker`.
    - `ledger.role === 'member'` → `MemberLeave`: the header only in this slice; 2.6 adds Leave. No request is made.
    - `ledger.role === 'owner'` → `OwnerMembers`, with these states:
      - Loading: `ActivityIndicator`.
      - First load fails: `LoadError` "Couldn’t load the members. Check your connection and try again." with Retry.
      - Refetch fails: `LoadError` "Couldn’t refresh. Check your connection and try again." with Retry, above the list.
      - No empty state: the list always includes the owner and the viewer.
    - Rows: the username (one line) and "Owner" or "Member", with "· you" added on the viewer's row. Only that text
      is one accessible element (`<View accessible accessibilityLabel="dimuch, Owner, you">`). 2.6's Remove button
      sits beside it as a sibling, so VoiceOver can still focus it on iOS. `ScrollView` + `map`, keyed by `userId`.
  - Verify (web 390×844):
    - Setup: in the dev DB,
      `yarn api create-user --username claude-qa-053 --email claude-qa-053@example.test --join dimuch`. Keep the TOTP
      secret only in the session scratchpad.
    - As dimuch: Settings shows no Ledger section and a Members row under the account card. Members, captioned
      "dimuch’s Home", lists "dimuch, Owner · you" and "claude-qa-053, Member".
    - As claude-qa-053: Members shows "dimuch’s Home" and no list, and the network log has no `…/members` request.
    - As claude-qa-053b (2.3's setup, in two ledgers): the Members row is shown below the Ledger section.
    - Back → Settings. Opening `/members` straight from the URL, then Back → Settings.
    - With a fetch stub failing `…/members`: the load error and Retry.
    - Light and dark at a glance. iPhone (Expo Go) at Gate B.
- [x] 2.6 Remove a member, or leave the ledger, with a second tap (~130)
  - Files: `apps/mobile/src/data/members.ts` (new), `apps/mobile/src/app/members.tsx`
  - Change: `removeMember`, then on the screen:
    - Who sees what: in `OwnerMembers`, each row except the viewer's has "Remove" (label "Remove <username>",
      ≥ 44pt). `MemberLeave` gets "Leave ledger" (an outlined danger button) under its header. So the owner never sees
      Leave or a Remove on his own row, and a member never sees Remove.
    - First tap: it only sets `confirming: Member | null`. A panel opens under that row (for Leave, in place of the
      button). It asks "Remove <username>?", or for Leave "Leave <ledger.owner>’s <ledger.name>? You’ll lose access to
      its budget and expenses." ("Leave dimuch’s Home? …"). It has Cancel and a danger button, "Remove" or "Leave".
      Nothing is sent until that button. Tapping another row's Remove moves the panel there. Cancel closes it. Either
      one clears the failure line and `gone`, so an error never shows under a different member. Leaving a `gone` panel
      either way (Close or another row's Remove) reloads the list. The panel is a module-local
      component used by both.
    - Second tap: the `inFlight` ref plus `busy`, as in Settings' `switchTo`. While busy, both panel buttons and every
      Remove are disabled, and the danger button shows a spinner and keeps its label.
    - After success:
      - Remove: close the panel and `reload()`.
      - Leave (target is the viewer): `router.dismissTo('/')`, keeping `busy`. Home's focus reload gets
        `ledger_not_found`, and #66's handler opens another ledger or no-ledger.
    - After failure:
      - Remove gets `not_found` (they already left): the panel's alert-role line says "<username> isn’t in this
        ledger any more." (announced), its Remove button is hidden (`gone`, as in `delete-category.tsx`), and Cancel
        reads "Close". Closing the panel reloads the list. Reloading at once would drop the row, and the panel with it,
        before the message could be read.
      - Leave gets `ledger_not_found` (the owner removed them meanwhile): treat it as success and
        `router.dismissTo('/')`. The handler is already moving them off.
      - Anything else: an alert-role line in the panel, also announced, and the panel stays open for a retry. The text
        is "Couldn’t remove. Check your connection and try again." or "Couldn’t leave. Check your connection and try
        again." The UI can't reach `owner_only` or `owner_cannot_leave`; they'd get the same text.
  - Verify (web 390×844, two browser profiles, network log open):
    1. dimuch: Remove on claude-qa-053 opens "Remove claude-qa-053?", and no DELETE is sent. Cancel closes it, and
       claude-qa-053 is still listed. Remove → Remove sends exactly one DELETE (204), even with a quick double tap on
       the confirm button, and the list is just dimuch. dimuch has no Remove on his own row and no Leave.
       Already gone: with the panel open on claude-qa-053, delete their membership by SQL, then confirm → "claude-qa-053
       isn’t in this ledger any more.", no Remove button, and Close → the list reloads without them.
    2. claude-qa-053, on Budget in the other profile during step 1: the next tab tap or focus → the no-ledger screen.
    3. Add claude-qa-053 back to dimuch's ledger (the id looked up in 2.3) with
       `INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (<that id>, <id>, 'member')` and sign in as
       claude-qa-053. Members shows no list and no Remove. Leave ledger → the panel with "Leave dimuch’s Home? …" →
       Leave → the no-ledger screen.
    4. A user who keeps another ledger: claude-qa-053b (2.3's setup) picks dimuch's ledger in Settings, then leaves →
       Home shows their own ledger, and Settings has no picker.
    5. iPhone (Expo Go) at Gate B: steps 1 and 3.
    6. Clean up per `kopiyka-local-qa`: claude-qa-053b's ledger, then both users, then their `login_throttle` rows.
       Total: ~540 changed lines in 6 slices (65 + 130 + 30 + 50 + 135 + 130). The API half (2.1–2.2) is ~195, mostly
       tests. The app half (2.3–2.6) is ~345.

## Size and split (decided at Gate A: one PR)

At ~540 lines, this is over the ~400 target. The cut is clean: 2a is the members API (2.1–2.2, ~195) and 2b is the
picker colour and Members screen (2.3–2.6, ~345). 2a would be safe to ship alone, because nothing calls it and #66
already handles `ledger_not_found`.

**Decision: one PR, no split.** The user chose this at Gate A (2026-11-02), as recommended:

- 2a alone gives users nothing. Its only effect is two unused endpoints, and the brief's ACs are all checked through
  the screen.
- 053–055 have to ship close together anyway (the brief's Out of scope).
- A split costs a full extra cycle: brief, plan, skeptic, Gate A, review, Gate B, CI and deploy. The extra review
  load is ~140 lines over the target, and most of it is table-like integration tests.
- The review can still go API first, then app, commit by commit.

The split (a cut after slice 2.2, as separate sequential briefs) was not taken.

## AC → evidence

| AC                                                                                                                                                           | Evidence                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The owner sees the list; a member gets 403 `owner_only` and a screen with the ledger and Leave, no list; a non-member gets 404 `ledger_not_found`            | members.int "lists the members for the owner", "a member gets owner_only from the list", "answers ledger_not_found to someone outside the ledger" (2.1); manual 2.5 (no `…/members` request as a member) |
| The owner removes a member; their next request is `ledger_not_found` and their app moves them off; an already-gone member is reported, then the list reloads | members.int "the owner removes a member, whose next request is ledger_not_found", "answers not_found for someone who isn't a member here" (2.2); manual 2.6 steps 1–2                                    |
| A member leaves; same result for them                                                                                                                        | members.int "a member leaves, with the same effect" (2.2); manual 2.6 steps 3–4                                                                                                                          |
| A member can't remove anyone (403 `owner_only`); the owner can't leave or be removed                                                                         | members.int "a member can't remove anyone", "the owner can't leave" (2.2); manual 2.6 steps 1 and 3 (no Remove for a member, no Leave or self-Remove for the owner)                                      |
| One ledger: no Ledger section; the Members row is always shown on its own                                                                                    | manual 2.5 (dimuch: no section; claude-qa-053b in two ledgers: the row below the Ledger section)                                                                                                         |
| 2+ ledgers: the open ledger is green in light and dark; Appearance stays blue                                                                                | `theme.test.ts` contrast case and manual 2.3                                                                                                                                                             |
| Checked on web at phone width and on the iPhone via Expo Go                                                                                                  | the Verify steps of 2.3, 2.5 and 2.6, recorded in the PR's test plan                                                                                                                                     |
| Decision: Remove and Leave need a second tap                                                                                                                 | manual 2.6 step 1 (no DELETE on the first tap, Cancel keeps the member, one DELETE on a double tap) and step 3                                                                                           |

## Not doing (YAGNI)

- `requireOwner` as a preHandler. It would have one caller here (the list); 054's two owner-only routes bring it,
  and the list moves to it then.
- An explanation on a member's Members screen of why there's no list. Not asked for; the screen shows the ledger
  and Leave.
- Ownership transfer, deleting a ledger, or letting the owner leave.
- Removing, reassigning or hiding a removed member's expenses. They stay in the ledger with their `createdBy`.
- Signing the removed member out, or telling them why their ledger switched. #66 switches silently.
- Undo for Remove or Leave (the second tap replaces it, per the decision). Also a shared confirm component: there is
  one screen with two uses, so the panel stays local to `members.tsx`.
- The pending-invites section and the invite form (054, 055).

## Risks

- `router.dismissTo('/')` from a pushed root-stack card might not land on the Home tab, or Home might not refetch on
  focus. Then Leave would sit on Settings until the next request. Slice 2.6's step 4 (another ledger remains, so no
  guard redirect hides it) proves it. If it fails, Leave calls `reload()` on its own list instead, whose
  `ledger_not_found` fires the same handler.
- #66 changes in review before it merges (e.g. the handler, `useSession`, or Settings' Ledger section). Re-read
  those files after the rebase, before 2.3.
- The rebase: `docs/features/053-ledger-members/` here is untracked, and #66 adds `brief.md` at that path, so git
  will refuse to check out over it. Move the folder aside, rebase, then restore the brief's "Decisions" edit and this
  plan.
- `useMonth` and `useNotionSync` send several requests, so the handler can fire two or three times after Leave. #66
  accepted this, because the reloads are idempotent. Step 4 would show a flicker if it matters.
- API integration tests skip in a worktree unless `DATABASE_URL_TEST` is exported from the main checkout's `.env`.
  2.1 and 2.2 must report "integration ran: yes".

## Open questions

- No: for an already-gone member, the list reloads when the owner closes the panel, not at once, so the message
  stays readable (a reload removes the row the panel sits under). Say if you want it at once, with the message
  shown above the list instead.
- No: the green tokens' names and values (Contracts) are new; tuned on the iPhone at Gate B if they look off.
- Decided: one PR, no 2a/2b split (the user, at Gate A).

## Follow-ups

- Settings still sits on `PlaceholderPage`, which shows "Coming soon." above Ledger, Members and Appearance (noted in
  052, and more visible now). No AC covers it.
- The second-tap panel is local to `members.tsx`. 055 adds Revoke on the same screen; extract it only if a second
  screen needs it.

## Deviations

## Consolidate

## Revision 1

Skeptic suggestions (verdict APPROVE, no blockers), applied:

- 2.4: only each row's name-and-role text is one accessible element; Remove stays a sibling for VoiceOver.
- 2.5: Leave answered with `ledger_not_found` counts as success and dismisses to Home.
- 2.5: moving the panel or pressing Cancel clears the failure line.
- 2.4/2.5: the caption and the Leave question name the ledger by its owner ("dimuch’s Home"). The "Not doing"
  line about the owner in the header is gone.
- 2.5 step 3: dimuch's ledger id comes from SQL instead of a hard-coded 1 (step 4 reuses it).

## Revision 2 (Gate A)

The user approved the plan with four changes (also recorded under the brief's Decisions, with its ACs updated).
Slice numbers below are the current ones; Revision 1's are from before the renumbering.

- Settings: the Ledger section stays as #66 built it (2+ ledgers only); the Members row sits on its own and is always
  shown. Approach, "Changed from the 052 design", 2.5 and its Verify updated (incl. the row below the Ledger section
  with two ledgers).
- Remove answering `not_found`: the panel says "<username> isn’t in this ledger any more.", hides Remove (`gone`),
  and leaving the panel either way (Close, or another row's Remove) clears the line and `gone` and reloads the list
  (2.6, step 1's new check). The old quiet close is gone.
- The member list is owner-only: the GET answers a member `403 owner_only` (inline check; `requireOwner` still waits
  for 054, which gives it more than one caller). The screen splits into `OwnerMembers` (uses `useMembers`) and
  `MemberLeave` (no fetch). 2.1's tests and name, 2.2's note, 2.5, 2.6, Contracts and AC → evidence updated.
- New slice 2.3, the first app slice: the open ledger in `LedgerPicker` is green, with new
  `active`/`activeTint`/`activeLine` tokens (none existed), a `theme.test.ts` contrast case (≥ 4.5 in both palettes,
  with its `contrast()` helper), and a web check in light and dark. Its setup (dimuch's ledger id by SQL,
  claude-qa-053b in two ledgers) is reused by 2.5 and 2.6, so 2.6's cleanup no longer waits for a later slice.
- Renumbered: the hook is 2.4, the screen 2.5, Remove/Leave 2.6; all references updated.
- Split: the user chose one PR; "Size and split" and the open question record it.
- Sizes: 2.1 ~65, 2.2 ~130, 2.3 ~30, 2.4 ~50, 2.5 ~135, 2.6 ~130; total ~540.
- Delta skeptic edit "The Members row is shown below the Ledger section" went into 2.5's Verify, not the green
  slice's: with the green slice first, the row doesn't exist yet when 2.3 is checked.

# Plan: Invite people to a ledger in the app

Status: approved

Brief: ./brief.md
Branch: feat/ledger-invites
Base: origin/main after PR #65 (brief 051) merges. This branch is rebased onto that main before any code is written.
Scope (Gate A, 2026-11-02): this branch builds **Part 1 only** (slices 1.1–1.7). Parts 2–4 move to briefs 053, 054
and 055. Their slices below are the design they start from, and each gets its own plan, skeptic and Gate A. The user
reopened decisions 1, 2, 6 and 7 (expiry, Settings badge, invite history, second-tap confirm). None of them touches
Part 1, and they are settled before 053–055 are planned.

Every reference below to `addMember`, `createUserJoiningLedger`, `apps/api/test/members.int.test.ts` (and its
`joinUser`) is to #65's code.

## Summary and split (decide at Gate A)

The brief is about 1,575 changed lines (tests included), so it is too big for one PR. I propose four sequential briefs.
Each can ship alone. Each one's PR is about 400 lines or less, except Part 2 at ~500, which can be split again (below):

| Part | Brief (proposed)                                                           | ACs                         | Est. lines |
| ---- | -------------------------------------------------------------------------- | --------------------------- | ---------- |
| 1    | 052 (this one, narrowed): switch between ledgers; no-ledger screen         | AC6, AC5 (app side), AC8    | ~365       |
| 2    | 053: Members screen; the owner removes a member, a member leaves           | AC3 (remove), AC5, AC7, AC8 | ~500       |
| 3    | 054: invite API: owner invites/revokes, invitee lists/accepts/declines     | AC1 (API), AC2, AC3, AC4    | ~390       |
| 4    | 055: invites in the app: Members screen invite/revoke, Home accept/decline | AC1, AC4 (UI), AC8          | ~320       |

(053–055 are the next free numbers today.) Part 2 can be split into 2a, the members API (2.1–2.2, ~200), and 2b, the
Members screen (2.3–2.5, ~300). 2a ships safely alone, because Part 1 already handles `ledger_not_found`. Parts 3 and 4
could be one PR of about 710 lines if you'd rather have fewer PRs.

- Between Part 2 and Part 4, a removed member can only be added back with SQL.
- Part 1 alone has no path anyone can reach in production, since nobody has 2 or 0 ledgers yet. Parts 2–4 should
  ship close together.

The design below covers all four parts, so the contracts are settled once. Each part's slices can be copied into
its own brief's plan as written.

## Approach

- **API.** `requireLedger` answers non-members with `404 { error: 'ledger_not_found' }` instead of `not_found`. That
  way the app can tell "this ledger is gone for me" apart from "this expense is gone". `GET /api/ledgers` adds each
  ledger's owner username, because every ledger is named "Home". Member routes go in `ledgers/routes.ts`: list
  members, and one `DELETE …/members/:userId` route that covers both remove and leave. Invite routes go in a new
  `invites/routes.ts`. Owner-only routes add a plain `requireOwner` preHandler (403 `owner_only`) after
  `requireLedger`.
- **Schema.** `ledger_invites` is recreated keyed on `invitee_user_id`. Nothing has ever written to it (no code
  references it outside `test/helpers.ts`). A row is a pending invite. Accept, decline and revoke delete it, so
  `UNIQUE (ledger_id, invitee_user_id)` gives "one pending invite per person per ledger" and "accept only once" for
  free. There is no expiry and no status column.
- **App.** `AuthContext` keeps `ledgers` and opens the stored choice. The choice is saved per user in AsyncStorage
  (already a dependency, used for the theme), and the app falls back to the first ledger. A new `noLedger` status
  shows a plain screen with Sign out. `api()` calls a "ledger gone" handler on `ledger_not_found`, the same way it
  calls the 401 handler. `AuthContext` then reloads `/api/ledgers` and opens another ledger, or the no-ledger screen.
  Data hooks are already keyed by `ledgerId`, so Budget/Expenses reload for the new ledger. Screen and hook state
  that is tagged only by month or attempt doesn't follow a switch: Budget's `refused`/`failed` and `useNotionSync`'s
  `unconfigured`/`failed`. Slice 1.6 adds the ledger to those tags.

Alternative considered: re-checking `/api/ledgers` when Home comes into focus or the app comes to the foreground,
instead of the `ledger_not_found` code. It lost because a removed member on Budget or an expense would see misleading
"deleted" errors (the screens map `not_found` to "This expense was deleted") until they went back to Home. The new
code changes 3 test assertions.

Alternative considered for the schema: `ALTER TABLE` (drop `email`/`status`, add `invitee_user_id`). It's the same
size and harder to read. Both are destructive only if rows exist, which they don't (see Risks).

## Contracts

- DB: `apps/api/migrations/010_ledger_invites_by_user.sql` (Part 3):

  ```sql
  -- Brief 054. Invites go to an existing user, chosen by username; nothing ever wrote the email-keyed table from 001.
  -- A row is a pending invite: accepting, declining or revoking deletes it, so a person has at most one per ledger.
  DROP TABLE ledger_invites;
  CREATE TABLE ledger_invites (
    invite_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ledger_id        INT UNSIGNED NOT NULL,
    invitee_user_id  INT UNSIGNED NOT NULL,            -- the only user who may accept or decline it
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ledger_id, invitee_user_id),
    INDEX (invitee_user_id),
    CONSTRAINT fk_invites_ledger  FOREIGN KEY (ledger_id)       REFERENCES ledgers (ledger_id) ON DELETE CASCADE,
    CONSTRAINT fk_invites_invitee FOREIGN KEY (invitee_user_id) REFERENCES users (user_id)     ON DELETE CASCADE
  );
  ```

  There is no `invited_by`: only the owner can invite, so the inviter is `ledgers.owner_user_id` (ownership transfer
  is out of scope).

- API (all JSON, errors `{ error: code }`; Zod 400 `invalid_request` as usual; every route needs a session → 401):
  - Changed (Part 1): `requireLedger` (`ledgers/access.ts`) → `404 { error: 'ledger_not_found' }` for a non-member,
    whether or not the ledger exists. Item-level 404s stay `not_found`.
  - Changed (Part 1): `GET /api/ledgers` → each ledger gains `owner: string` (owner's username):
    `{ user, ledgers: [{ ledgerId, name, role, owner }] }`, same order.
  - Part 2, guards `[requireAuth, requireLedger]`:
    - `GET /api/ledgers/:id/members` → 200 `{ members: [{ userId, username, role }] }`, owner first, then by
      `joined_at`, `user_id`. Part 3 adds `invites: [{ inviteId, username }]` (pending, by `created_at`,
      `invite_id`), visible to every member.
    - `DELETE /api/ledgers/:id/members/:userId` → 204. Removing someone else needs the owner: `403 owner_only`.
      The owner targeting themselves gets `409 owner_cannot_leave`. A target who isn't a member of this ledger gets
      `404 not_found`. A member targeting themselves leaves.
  - Part 3, `requireOwner` (exported from `ledgers/access.ts`: `403 owner_only` unless `req.ledger.role === 'owner'`):
    - `POST /api/ledgers/:id/invites` body `{ username: string }` (trimmed, 1–64) → 201 `{ inviteId, username }`
      (username as stored). Guards `[requireAuth, requireLedger, requireOwner]`. The same `409 cannot_invite` covers
      an unknown username, an existing member (the owner included), and someone already invited here; nothing is
      written in any of these cases.
    - `DELETE /api/ledgers/:id/invites/:inviteId` → 204. Same guards. `404 not_found` if there's no pending invite
      with that id in this ledger.
  - Part 3, invitee, guard `requireAuth` only:
    - `GET /api/invites` → 200 `{ invites: [{ inviteId, ledgerId, ledgerName, owner }] }`: the caller's own pending
      invites, by `created_at`, `invite_id`.
    - `POST /api/invites/:inviteId/accept` → 204. In one `withTransaction`: `SELECT … FOR UPDATE` the invite where
      `invitee_user_id` is the caller, `DELETE` it, then `addMember(conn, ledgerId, userId)`. `404 not_found` if
      it's not the caller's or already used. (`addMember`'s `ER_DUP_ENTRY` can't happen: inviting a member is
      refused, and nothing else adds an existing user to a ledger. If it ever does, it's a 500 and a rollback.)
    - `DELETE /api/invites/:inviteId` (decline) → 204. `404 not_found` if it's not the caller's pending invite.
- App:
  - `api/types.ts`: `Ledger` gains `owner: string` (Part 1). Part 2 adds
    `Member { userId: number; username: string; role: 'owner' | 'member' }` and `LedgerMembers { members: Member[] }`.
    Part 3/4 adds `invites: PendingInvite[]` to `LedgerMembers`, plus `PendingInvite { inviteId: number; username: string }`
    and `Invite { inviteId: number; ledgerId: number; ledgerName: string; owner: string }`.
  - `api/client.ts` (Part 1): `export function setLedgerGoneHandler(handler: () => void): void`. `api()` calls it
    on `404` + `ledger_not_found`, then throws `ApiError` as usual.
  - `auth/ledgerChoice.ts` (Part 1, pure): `choiceKey(userId: number): string` → `'kopiyka.ledger.<userId>'`;
    `pickLedger(ledgers: Ledger[], stored: string | null): Ledger | null` → the stored ledger if it's still in the list,
    else the first (oldest membership), else null.
  - `auth/AuthContext.tsx`:
    `AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'noLedger'; user: User } | { status: 'signedIn'; user: User; ledger: Ledger; ledgers: Ledger[] }`.
    `AuthApi` gains `openLedger(ledgerId: number): Promise<void>`, which stores the choice, reloads
    `/api/ledgers` and opens it (or the fallback), and rejects if the reload fails (Part 1). The ledger-gone
    handler's reload (the same fetch, keeping the stored choice) stays internal to `AuthContext`. A reload never
    passes through `loading`, so the navigator isn't unmounted. `useSession()` also returns `ledgers` and
    `openLedger`.
  - Routes: `app/no-ledger.tsx` (Part 1, its own `Stack.Protected guard={status === 'noLedger'}`; `login`'s guard
    becomes `status === 'signedOut'`), `app/members.tsx` (Part 2, pushed, in the signed-in group).
  - `components/LedgerPicker.tsx` (Part 1): `{ ledgers: Ledger[]; selectedId: number; onSelect: (ledgerId: number) => void; disabled: boolean }`.
  - `data/useMembers.ts` (Part 2): `useMembers(ledgerId: number): { data: LedgerMembers | null; error: boolean; reload: () => void }`
    (`useMonth`'s shape). `data/members.ts`: `removeMember(ledgerId, userId)` (Part 2), and in Part 4
    `inviteMember(ledgerId, username)` and `revokeInvite(ledgerId, inviteId)`.
  - `data/invites.ts` (Part 4): `acceptInvite(inviteId)`, `declineInvite(inviteId)`. `data/useInvites.ts`:
    `useInvites(): { invites: Invite[] | null; error: boolean; reload; accept(invite: Invite); decline(invite: Invite); busyId: number | null; failure: string | null }`.
    `accept` calls `acceptInvite`, then `openLedger(invite.ledgerId)`. It has two callers: Home and no-ledger.
  - `components/PendingInvites.tsx` (Part 4): `{ invites: Invite[]; busyId: number | null; failure: string | null; onAccept: (i: Invite) => void; onDecline: (i: Invite) => void }`.
    It renders "dimuch invited you to Home" with Accept and Decline.
- Reuses: `addMember` (#65) for accept; `withTransaction`; `makeUser`, `authHeader`, `clearData`, `resetSchema`, and
  #65's `joinUser` in `members.int.test.ts`; the `useMonth` hook shape with `useFocusEffect`, `let live` and a tagged
  key; the `setUnauthorizedHandler` pattern for the ledger-gone handler; the `AppearancePicker` radio-row pattern;
  `appearance/preference.ts`'s pure-module and test style; AsyncStorage as in `AppearanceContext`; `LoadError`;
  `router.dismissTo` as in `delete-category.tsx`.
- New dependencies: none.

## Slices

### Part 1: switch between ledgers (this brief, if the split is approved)

- [x] 1.1 Answer ledger_not_found when the user isn't in the ledger (~20)
  - Files: `apps/api/src/ledgers/access.ts`, `apps/api/test/expenses.int.test.ts`, `apps/api/test/notion.int.test.ts`,
    `apps/api/test/ledgers.int.test.ts`
  - Change: the code in `requireLedger`, and its JSDoc (the app uses the code to move off a lost ledger).
  - Tests: update "answers 404 for a ledger the user isn't a member of" (expenses) and the two `foreign` assertions in
    notion.int to `ledger_not_found`, plus any other non-member body check the gates turn up. ledgers.int: add
    "answers ledger_not_found for a ledger that doesn't exist and for someone else's":
    `GET /api/ledgers/999999/categories?month=2026-10` and the stranger's ledger both give
    `[404, { error: 'ledger_not_found' }]`.
- [x] 1.2 Name each ledger's owner in the ledger list (~20)
  - Files: `apps/api/src/ledgers/routes.ts`, `apps/api/test/ledgers.int.test.ts`, `apps/api/test/members.int.test.ts`
  - Change: join `users o ON o.user_id = l.owner_user_id` and return `owner: o.username`. Update the comment ("the
    app opens the stored choice or the first").
  - Tests: the existing `toEqual`s gain `owner` (`'ivanka'`/`'sviat'` in ledgers.int; `'dimuch'` for both views in
    #65's "lists only the joined ledger as member…").
- [x] 1.3 Open the ledger chosen on this device (~90)
  - Files: `apps/mobile/src/auth/ledgerChoice.ts` (new), `apps/mobile/test/ledgerChoice.test.ts` (new),
    `apps/mobile/src/api/types.ts`, `apps/mobile/src/auth/AuthContext.tsx`
  - Change: `pickLedger`/`choiceKey`. `fetchMe` reads `AsyncStorage.getItem(choiceKey(user.userId))` (a read
    failure counts as no choice) and opens `pickLedger(...)`. It still throws "This user has no ledger" on null until
    1.4. The state keeps `ledgers`. Add `openLedger` (a failed choice write is ignored, as for the theme).
  - Tests: `ledgerChoice.test.ts` table: stored `'7'` among `[3, 7]` → 7; stored `'9'` (gone) → 3; `null` → 3;
    `'7abc'` → 3; `[]` → null; `choiceKey(12)` → `'kopiyka.ledger.12'`. Verify: web at phone width; dimuch (one
    ledger) opens as before.
- [x] 1.4 Show a plain screen to a user who is in no ledger (~80)
  - Files: `AuthContext.tsx`, `apps/mobile/src/app/no-ledger.tsx` (new), `apps/mobile/src/app/_layout.tsx`
  - Change: `fetchMe` returns `{ status: 'noLedger', user }` instead of throwing. The screen shows "You’re not in any
    ledger", "Signed in as <username>." and the same Sign out button as Settings ("Sign out" matches the app; the
    brief says "Log out"). Guards are as in Contracts.
  - Verify (dev DB): `yarn api create-user --username claude-qa-052 --email claude-qa-052@example.test --join dimuch`,
    then `DELETE FROM ledger_members WHERE user_id = <id>`, then log in on web → the no-ledger screen. Sign out →
    Login. Cleanup is at the end of Part 1.
- [x] 1.5 Move off a ledger the user has lost (~25)
  - Files: `apps/mobile/src/api/client.ts`, `AuthContext.tsx`
  - Change: `setLedgerGoneHandler`. `AuthContext` registers it next to the 401 handler. It reloads (`fetchMe` →
    `setState`) and ignores a failed reload, since the next request tries again.
  - Verify: with claude-qa-052 as a member of ledger 1 and the owner of its own ledger (`create-user` for a fresh
    claude-qa-052 without `--join`, then SQL
    `INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (1, <id>, 'member')`), choose ledger 1 (slice 1.7, or set `localStorage['kopiyka.ledger.<id>']='1'`
    first). `DELETE` that membership, then tap Budget → it shows claude-qa-052's own ledger. Delete the last
    membership → the no-ledger screen.
- [ ] 1.6 Keep Notion's and Budget's answers to the ledger they came from (~20)
  - Files: `apps/mobile/src/data/useNotionSync.ts`, `apps/mobile/src/app/(tabs)/budget.tsx`
  - Change: `unconfigured` becomes `useState<number | null>` holding the ledger id, compared to `ledgerId`. Today
    it would stay hidden after switching to the ledger Notion syncs. Update the "a session has one ledger" comment.
    `useNotionSync`'s `failed` (useNotionSync.ts:21, 72–75) is tagged with the ledger as well as the version. In
    budget.tsx, tag `refused` and `failed` with `${ledger.ledgerId}/${month}` instead of `month` (:47–49, :82–85).
    Today a copy refusal in ledger A would hide Copy for the same month in ledger B after a switch (AC6).
  - Verify: typecheck/lint, plus 1.7's check (the panel shows on ledger 1, the Notion ledger in dev, after switching
    back to it).
- [ ] 1.7 Pick the ledger in Settings when the user is in more than one (~110)
  - Files: `apps/mobile/src/components/LedgerPicker.tsx` (new), `apps/mobile/src/app/(tabs)/settings.tsx`
  - Change: a "Ledger" section, shown only when `ledgers.length > 1`. It is a radiogroup of rows with the name plus
    "Yours" (role owner) or "<owner>’s", e.g. `accessibilityLabel` "Home, dimuch’s", with 44pt rows. Selecting a row
    calls `openLedger`. The picker is disabled while busy. A failure shows "Couldn’t switch. Check your connection
    and try again." in an alert-role text.
  - Verify (web at phone width + iPhone Expo Go): as claude-qa-052 in two ledgers, switch → Budget, Expenses (and the
    Home figures) show the chosen ledger, and Statistics is still the Base placeholder. A web reload, or a relaunch
    in Expo Go, opens the chosen one. dimuch (one ledger) has no Ledger section. Cleanup per
    `kopiyka-local-qa`: claude-qa-052's ledger, then the user, then its `login_throttle` rows.

### Part 2: members, remove, leave (proposed brief 053)

- [ ] 2.1 List a ledger's members (~70)
  - Files: `apps/api/src/ledgers/routes.ts`, `apps/api/test/members.int.test.ts`
  - Change: `GET /api/ledgers/:id/members`, ordered `ORDER BY m.role, m.joined_at, m.user_id` with the comment
    "ENUM sorts by index: owner first".
  - Tests (in #65's suite; dimuch owner, olena joined): "lists the members for the owner and for a member" gives
    `[{ dimuch, 'owner' }, { olena, 'member' }]` from both; 401; a stranger gets 404 `ledger_not_found`.
- [ ] 2.2 Let the owner remove a member and a member leave (~130)
  - Files: `apps/api/src/ledgers/routes.ts`, `apps/api/test/members.int.test.ts`
  - Change: `DELETE /api/ledgers/:id/members/:userId` per Contracts. Check `self && role === 'owner'` → 409 first,
    then `!self && role !== 'owner'` → 403, then `DELETE … AND role = 'member'`; 0 rows → 404.
  - Tests: "the owner removes a member, whose next request is ledger_not_found" (204, then olena's
    `GET …/categories?month=2026-10` → `[404, { error: 'ledger_not_found' }]`, and olena's `GET /api/ledgers` → `[]`);
    "a member leaves, with the same effect"; "a member can't remove someone else" (a third user joined by `joinUser`,
    olena removes them → `[403, { error: 'owner_only' }]`, and they're still listed); "the owner can't leave or be
    removed" (dimuch removes dimuch → `[409, { error: 'owner_cannot_leave' }]`; olena removing dimuch → 403; both
    still listed); "answers not_found for someone who isn't a member" (the stranger's id, and 999999); 400 for
    `userId=abc`; 401; a stranger → 404 `ledger_not_found`.
- [ ] 2.3 Load a ledger's members in the app (~60)
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/src/data/useMembers.ts` (new),
    `apps/mobile/src/data/members.ts` (new)
  - Change: `Member`/`LedgerMembers`, `useMembers`, `removeMember`.
  - Verify: typecheck/lint (nothing renders it yet; 2.4 is the first caller).
- [ ] 2.4 Show the members on a screen opened from Settings (~130)
  - Files: `apps/mobile/src/app/members.tsx` (new), `_layout.tsx`, `settings.tsx`
  - Change: a "Members" row in Settings (button, chevron), shown for every ledger. The screen has Back, "Members" and
    the ledger name, then the rows: username, "Owner"/"Member", and "you" on your own row. It has loading, error
    (`LoadError` with Retry) and list states.
  - Verify (web + iPhone): log in as dimuch with claude-qa-052 joined via `--join dimuch` → two rows. As
    claude-qa-052 → the same list.
- [ ] 2.5 Remove a member, or leave the ledger, from the Members screen (~115)
  - Files: `members.tsx`
  - Change: the owner sees "Remove" on each member row except their own. A member sees "Leave ledger" at the
    bottom. Each needs an inline second tap ("Remove claude-qa-052?" / "Leave Home? You’ll lose access to its budget
    and expenses." with Cancel and a danger button), because there's no Undo and browsers block `confirm()` (brief
    043). Remove and Leave block double taps with the `inFlight` ref plus `busy` pattern from budget.tsx:46–54.
    Remove → `removeMember` → reload the list. Leave → `removeMember(ledgerId, me)` → `router.dismissTo('/')`; Home's
    next request gets `ledger_not_found`, and the Part 1 handler moves the user off. A failure shows an alert-role line. `owner_cannot_leave`/`owner_only` can't be reached from
    this UI; they show the generic "Couldn’t remove. Try again."
  - Verify (web + iPhone): dimuch removes claude-qa-052 while claude-qa-052 is on Budget in another browser profile.
    claude-qa-052's next tap → the no-ledger screen (with only that ledger), or their own ledger if they have one.
    claude-qa-052 leaves → the same. dimuch sees no Leave and no Remove on his own row. Clean up the user afterwards.

### Part 3: invite API (proposed brief 054)

- [ ] 3.1 Let the owner invite an existing user by username, and revoke it (~175)
  - Files: `apps/api/migrations/010_ledger_invites_by_user.sql` (new), `apps/api/src/ledgers/access.ts`
    (`requireOwner`), `apps/api/src/invites/routes.ts` (new), `apps/api/src/app.ts`,
    `apps/api/test/invites.int.test.ts` (new)
  - Change: the migration, `requireOwner`, and the `POST`/`DELETE …/invites` routes. Create looks the user up with
    `SELECT user_id, username FROM users u WHERE u.username = ? AND NOT EXISTS (<member row>)`; no row → 409. Then
    `INSERT`; `ER_DUP_ENTRY` → 409.
  - Tests (dimuch and olena by `makeUser`, sam joined to dimuch by `INSERT ledger_members … 'member'`): "invites
    olena" (201 `{ inviteId, username: 'olena' }`, one row); "answers cannot_invite alike for an unknown user, a
    member, the owner, or someone already invited" (`nobody`, `sam`, `dimuch`, `olena` twice → each
    `[409, { error: 'cannot_invite' }]`, and the `ledger_invites` count is still 1); `'  '` → 400; 401; sam (member)
    → `[403, { error: 'owner_only' }]` for invite and revoke; a stranger → 404 `ledger_not_found` on invite and on
    revoke; "revokes a pending invite" (204, row gone); revoking an unknown id or another ledger's invite → 404
    `not_found`; revoke with `inviteId=abc` → 400.
- [ ] 3.2 List pending invites for the owner's ledger and for the invitee (~90)
  - Files: `apps/api/src/ledgers/routes.ts` (members adds `invites`), `apps/api/src/invites/routes.ts`,
    `apps/api/test/invites.int.test.ts`, `apps/api/test/members.int.test.ts` (shape gains `invites: []`)
  - Tests: members of dimuch's ledger list `invites: [{ inviteId, username: 'olena' }]` for dimuch and for sam.
    olena's `GET /api/invites` → `[{ inviteId, ledgerId: dimuch.ledgerId, ledgerName: 'Home', owner: 'dimuch' }]`;
    sam's → `[]`; 401.
- [ ] 3.3 Let the invitee accept or decline an invite (~125)
  - Files: `apps/api/src/invites/routes.ts`, `apps/api/test/invites.int.test.ts`
  - Tests: "accepting makes olena a member" (204; olena's `GET /api/ledgers` adds
    `{ dimuch.ledgerId, 'Home', 'member', 'dimuch' }`; she can `GET …/categories?month=2026-10`; the invite is gone from both lists); "only once"
    (second accept → 404 `not_found`); "only by the invitee" (sam accepting → 404, no membership); "declining leaves
    no membership" (204; olena's ledgers unchanged; accept afterwards → 404); "a revoked invite can't be accepted"
    (→ 404, no membership); 400 for `abc` on accept and on decline; 401 for all three invitee routes.

### Part 4: invites in the app (proposed brief 055)

- [ ] 4.1 Load invites and send invite actions from the app (~85)
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/src/data/invites.ts` (new),
    `apps/mobile/src/data/useInvites.ts` (new), `apps/mobile/src/data/members.ts`
  - Change: the types, the actions, and `useInvites` per Contracts (reloads on focus; one action at a time; reloads
    after each). Accept failure shows "Couldn’t accept. Try again."; a 404 shows "This invite was withdrawn." and
    reloads. If accept returns 204 but `openLedger` then fails, it shows "Accepted. Couldn’t open it yet — pick it in
    Settings." and reloads, not "Couldn’t accept".
  - Verify: typecheck/lint (4.2 is the first caller).
- [ ] 4.2 Show pending invites on Home with Accept and Decline (~110)
  - Files: `apps/mobile/src/components/PendingInvites.tsx` (new), `apps/mobile/src/app/(tabs)/index.tsx`,
    `apps/mobile/src/app/no-ledger.tsx`
  - Change: a card per invite above Home's grid, hidden when there are none, while loading, and on a load error (Home
    deliberately has no error block, index.tsx:23). The no-ledger screen shows a load error as `LoadError` with Retry. Buttons are ≥ 44pt and labelled "Accept invite to Home from dimuch" etc. The no-ledger
    screen shows the same list (decision 4 below), so a removed user can come back.
  - Verify (web + iPhone): dimuch invites claude-qa-052 (owner of its own ledger) via `curl`/the 4.3 form.
    claude-qa-052 logs in → Home shows "dimuch invited you to Home" → Accept → Home figures are dimuch's, and
    Settings lists two ledgers with dimuch's selected. Decline on a second invite → it disappears, with no
    membership. A member-only user after removal sees the invite on the no-ledger screen and Accept opens the ledger.
- [ ] 4.3 Invite by username and revoke from the Members screen (~125)
  - Files: `apps/mobile/src/app/members.tsx`
  - Change: a "Pending" section listing invites for everyone. The owner also gets "Revoke" on each and an "Invite by
    username" field (labelled, `autoCapitalize="none"`) with an Invite button. `cannot_invite` → "Can’t invite this
    username. Check the spelling; they may already be in or invited to this ledger." Success clears the field and
    reloads. Invite and Revoke block double taps with the `inFlight` ref plus `busy` pattern from budget.tsx:46–54.
  - Verify (web + iPhone): invite claude-qa-052 → it shows under Pending. Invite again → the error. Invite `nobody` →
    the same error. Revoke → gone, and claude-qa-052's Home no longer shows it after refocus. As a member, there is no
    field and no Revoke. Clean up claude-qa-052.

Total: about 1,575 changed lines in 18 slices. Part 1 is ~365. Part 2 is ~500: 2a (2.1–2.2) ~200 and 2b (2.3–2.5)
~300. Part 3 is ~390: 3.1 at ~175 is a little over the ~150 target, because the migration needs its first routes to
be tested. Part 4 is ~320.

## AC → evidence

| AC                                                                             | Evidence                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 owner invites olena; she sees it on Home, accepts, is member, app switches | invites.int "invites olena", "accepting makes olena a member" (3.1, 3.3), plus the 4.2/4.3 manual run                                                               |
| AC2 unknown/member/pending → clear error, nothing stored, same answer          | invites.int "answers cannot_invite alike…" (3.1, row count checked), plus the 4.3 manual error text                                                                 |
| AC3 only the owner invites/revokes/removes (403); non-member 404               | members.int "a member can't remove someone else" (2.2); invites.int sam → 403 for invite and revoke, stranger → 404 (3.1); 1.1's `ledger_not_found` tests           |
| AC4 decline/revoke → no membership; accept only by invitee, once               | invites.int "declining leaves no membership", "a revoked invite can't be accepted", "only by the invitee", "only once" (3.3)                                        |
| AC5 removed/left → next request 404, app switches                              | members.int "the owner removes a member, whose next request is ledger_not_found" and "a member leaves…" (2.2); manual 1.5 (SQL removal) and 2.5 (UI removal, leave) |
| AC6 switch in Settings; Budget/Expenses/Statistics follow; survives reload     | `ledgerChoice.test.ts` (1.3); manual 1.7 on web reload and iPhone relaunch. Statistics is a placeholder on Base, with nothing ledger-specific to show               |
| AC7 owner can't leave or be removed                                            | members.int "the owner can't leave or be removed" (2.2); manual 2.5 (no Leave/Remove for the owner)                                                                 |
| AC8 web at phone width and iPhone via Expo Go                                  | the Verify steps of 1.7, 2.4, 2.5, 4.2 and 4.3, recorded in each PR's test plan                                                                                     |
| Notes: a user with no ledger                                                   | manual 1.4 (no-ledger screen, Sign out), 2.5 and 4.2                                                                                                                |

## Not doing (YAGNI)

- Invite expiry, an invite history (status column, `invited_by`), or a Settings tab badge (decisions 1, 2, 6).
- Closing an open modal when its ledger is lost under it. Its next request fails and the session has already
  switched, so the user just closes it. A follow-up if it bites.
- Showing the open ledger's name on Home or in the tab bar; not asked for.
- A "Check again" button on the no-ledger screen. Before Part 4 there's nothing to find. From Part 4 on, the invite
  list reloads on focus and on sign-in.
- Rate-limiting invites. Only an owner can call it, and a successful invite reveals that the username exists, which
  the brief accepts.
- Writing the fallback ledger back to storage. The stored choice just stops matching.

## Risks

- A `ledger_invites` row exists in production → `DROP TABLE` loses it. No code has ever written the table (`rg ledger_invites apps`
  finds only `test/helpers.ts`). Part 3's PR test plan adds a check before deploy:
  `SELECT COUNT(*) FROM ledger_invites` on the droplet must be 0.
- Three `Stack.Protected` groups might not redirect from a signed-in screen to `no-ledger` when the status flips the
  way `signedOut` → `login` does today. Slices 1.4 and 1.5 prove it on web and iPhone. If it fails, 1.5 adds a
  `router.replace('/no-ledger')` in the handler.
- Some other test, or app code, relies on the non-member body being `not_found`. 1.1's gates show the API side.
  `rg "not_found" apps/mobile/src` shows only item-level uses (expense, category in month), and those get the
  clearer generic text after a ledger is lost.
- Two simultaneous `ledger_not_found` replies (`useMonth` sends two requests) cause two reloads. Both are
  idempotent; 1.5's manual check shows a single switch.
- #65 changes before merging (e.g. `addMember`'s signature or `joinUser`). Re-check after the rebase, before 2.1/3.3.

## Open questions

Decisions for you at Gate A (none blocking; the plan uses the first option given):

1. No — Invite expiry: **none**. An invite stays until it's accepted, declined or revoked, and the owner can revoke
   stale ones. (Alternative: 14 days needs a time check in four queries plus tests.)
2. No — Where invitees see invites: **Home only**, no Settings badge.
3. No — The split: **four briefs** as in the table above. Or five, with Part 2 split into 2a (API, ~200) and 2b
   (screen, ~300). Or three, with Parts 3+4 merged into one ~710-line PR.
4. No — The no-ledger screen also lists pending invites (Part 4). Without that, a `--join` user who was removed could
   never accept a new invite. It costs about 5 lines, because the invite list already exists for Home.
5. No — `GET /api/ledgers` adds `owner` so the switcher can show "Home, dimuch’s" vs "Home, Yours". Every ledger is
   named "Home" today, and renaming is out of scope.
6. No — Accepted, declined and revoked invites are deleted, not kept with a status. Nobody sees history, and the
   owner just sees a declined invite disappear.
7. No — Remove and Leave need an inline second tap: there is no Undo, and `confirm()` is unreliable on web.
8. No — Non-members now get `404 ledger_not_found` instead of `not_found`. The status is unchanged, and a missing
   ledger and someone else's still look the same.

## Follow-ups

- Settings is built on `PlaceholderPage`, which says "Coming soon." above real settings. That text gets odder as
  Members and the ledger picker arrive. Not covered by any AC.
- The `ledger_invites` table from `001_initial.sql` was never used. Part 3 replaces it.

## Deviations

## Consolidate

## Revision 1

Skeptic edits. Part 2 is ~500 lines, not ~420, so the total is now ~1,575; 2a/2b is offered as a split. Slice 1.6
also tags Budget's `refused`/`failed` and `useNotionSync`'s `failed` with the ledger. Every new route gets its own
400 test (revoke, accept, decline). `refreshLedgers` is gone: Leave relies on the ledger-gone handler. Applied
suggestions: double-tap guards (2.5, 4.3), accepted-but-not-opened text (4.1), Home shows no invites error (4.2),
two notes on the split, Leave copy, and the migration header names brief 054.

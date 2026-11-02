# Plan: Invite API

Status: approved

Brief: ./brief.md
Branch: feat/invite-api
Base: origin/main at `fb4386c` (051, 052 and 053 merged).

Design source: `../052-ledger-invites/plan.md`, Part 3 (slices 3.1–3.3) and its Contracts. The brief's Decisions
(2026-11-02) override it in two places. Invites now expire after 1 hour, and they are kept with a status instead of
being deleted. Since 053 the member list is also owner-only. The changes are listed under "Changed from the 052
design" below.

## Approach

- **Schema.** Migration 010 drops the email-keyed `ledger_invites` table from 001 (no code has ever written to it)
  and creates it again, keyed on `invitee_user_id`. Each row is kept for good. `status` starts as `pending` and
  becomes `accepted`, `declined` or `revoked`, with `status_changed_at`. Every time value comes from the app's
  clock (`deps.now`), never from a column default, so tests can move past the hour. `expires_at` is
  `created_at + 1 hour` and is written at insert. So "live" is one predicate everywhere:
  `status = 'pending' AND expires_at > :now`. It works like `sessions.expires_at > ?`, and the 1-hour rule lives in one
  line. An expired invite stays `pending` (the brief: "an expired invite is a pending one past its hour").
- **At most one live pending invite per person per ledger.** A UNIQUE key can't express this, because expiry depends
  on `now`. Create therefore runs in `withTransaction`. It takes the ledger row lock first
  (`SELECT … FROM ledgers … FOR UPDATE`, the same lock as `categories/monthLists.ts`' `lockLedger`), then reads the
  invitee with `NOT EXISTS` member and `NOT EXISTS` live invite, then inserts. A second concurrent invite waits on the
  lock. After the first one commits, its plain read sees the new row, because InnoDB opens a transaction's snapshot
  at its first non-locking read, and that read comes after the lock.
- **Only once.** Accept runs in `withTransaction`. It does `SELECT ledger_id … WHERE <live, mine> FOR UPDATE`, then
  `UPDATE … status = 'accepted'`, then `addMember(conn, …)`. Decline and revoke are each one
  `UPDATE … WHERE <live, scoped>`, and 0 affected rows gives 404. Locking reads and UPDATEs re-check the latest
  committed row, so a second accept, decline or revoke on the same invite finds it no longer pending and answers 404.
- **Placement.** The new domain is `apps/api/src/invites/routes.ts`. It holds the owner routes under
  `/api/ledgers/:id/invites` and the invitee routes under `/api/invites`. `requireOwner` is a plain exported
  preHandler in `ledgers/access.ts`. The member list switches to it and adds the live pending invites.

Alternative considered: a generated column `pending_invitee = IF(status = 'pending', invitee_user_id, NULL)` with
`UNIQUE (ledger_id, pending_invitee)`. It lost because an expired invite is still `pending`, so it would block a new
invite. That would need a fifth status, or a write that changes old rows, and the brief rules out both.

### Changed from the 052 design

- The table has `status`, `created_at`, `expires_at` and `status_changed_at`, and no unique key on the ledger and
  invitee. Accept, decline and revoke update the row instead of deleting it.
- The create check adds "no live pending invite" to the `NOT EXISTS` checks, under the ledger row lock, instead of
  catching `ER_DUP_ENTRY`.
- Every read and change of a pending invite also requires `expires_at > now`.
- The member list is owner-only (053), so its `invites` are seen by the owner only. It moves to `requireOwner`.
- Lists sort by `invite_id`, which follows send order, instead of `created_at, invite_id`.
- In the tests, sam joins with `addMember` (on Base) instead of a raw `INSERT`. `joinUser` stays local to
  `members.int.test.ts`.

## Contracts

- DB: `apps/api/migrations/010_ledger_invites_by_user.sql`:

  ```sql
  -- Brief 054. Invites go to an existing user, chosen by username. Nothing ever wrote the email-keyed table from 001
  -- (production's was checked empty before this deployed). Rows are kept: a pending invite becomes accepted, declined
  -- or revoked, and one past expires_at has expired without changing. Times come from the app's clock (no DEFAULT),
  -- so tests can move past an invite's hour. At most one live pending invite per person per ledger is kept by the
  -- create route under the ledger row lock: a unique key can't see expiry.
  DROP TABLE ledger_invites;
  CREATE TABLE ledger_invites (
    invite_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ledger_id          INT UNSIGNED NOT NULL,
    invitee_user_id    INT UNSIGNED NOT NULL,          -- the only user who may accept or decline it
    status             ENUM('pending','accepted','declined','revoked') NOT NULL DEFAULT 'pending',
    created_at         DATETIME NOT NULL,              -- sent (UTC)
    expires_at         DATETIME NOT NULL,              -- created_at + 1 hour; a pending invite is live before it
    status_changed_at  DATETIME NULL,                  -- when it stopped being pending; NULL while pending
    INDEX (ledger_id, invitee_user_id, status),
    INDEX (invitee_user_id, status),
    CONSTRAINT fk_invites_ledger  FOREIGN KEY (ledger_id)       REFERENCES ledgers (ledger_id) ON DELETE CASCADE,
    CONSTRAINT fk_invites_invitee FOREIGN KEY (invitee_user_id) REFERENCES users (user_id)     ON DELETE CASCADE
  );
  ```

  There is no `invited_by` column. Only the owner invites, and ownership transfer is out of scope. "Live" means
  `status = 'pending' AND expires_at > now()`, so an invite sent at T is live while `now < T + 1 h` and has expired
  at exactly T + 1 h.

- API (JSON; errors `{ error: code }`; Zod → 400 `invalid_request`; no session → 401 `unauthorized`):
  - `requireOwner` (exported from `ledgers/access.ts`, used after `requireLedger`) answers `403 { error: 'owner_only' }`
    unless `req.ledger.role === 'owner'`.
  - Changed: `GET /api/ledgers/:id/members`, guarded by `[requireAuth, requireLedger, requireOwner]`, returns 200
    `{ members: [...as today], invites: [{ inviteId: number, username: string }] }`. These are the ledger's live
    pending invites, ordered by `invite_id`. The 403 and 404 answers are as today.
  - `POST /api/ledgers/:id/invites`, guarded by `[requireAuth, requireLedger, requireOwner]`, takes the body
    `{ username: string }` (trimmed, 1–64 chars) and returns 201 `{ inviteId, username }`, with the username as stored.
    It answers `409 cannot_invite` for an unknown username, an existing member (the owner included), or someone with
    a live pending invite here, and writes nothing in those cases. A member gets 403 `owner_only`. A non-member gets
    404 `ledger_not_found`.
  - `DELETE /api/ledgers/:id/invites/:inviteId` (revoke), with the same guards, returns 204 and sets
    `status = 'revoked'`. It answers `404 not_found` if there's no live pending invite with that id in this ledger,
    including one that is used, expired or in another ledger.
  - `GET /api/invites` (`requireAuth`) returns 200 `{ invites: [{ inviteId, ledgerId, ledgerName, owner }] }`: the
    caller's live pending invites, ordered by `invite_id`. `owner` is the ledger owner's username.
  - `POST /api/invites/:inviteId/accept` (`requireAuth`) returns 204, does `status = 'accepted'`, and the caller
    becomes a `member` through `addMember`, all in one transaction. It answers `404 not_found` unless this is the
    caller's own live pending invite. If `addMember` hits `ER_DUP_ENTRY` it's a 500 and a rollback. That can't
    happen, because inviting a member is refused.
  - `DELETE /api/invites/:inviteId` (decline) (`requireAuth`) returns 204 and sets `status = 'declined'`. It
    answers `404 not_found` unless this is the caller's own live pending invite.
  - Every write sets `status_changed_at` (or `created_at`/`expires_at` on insert) from one `now()` read per request.
- App: none. `apps/mobile/src/api/types.ts`' `LedgerMembers` ignores the extra `invites` field until 055 mirrors it.
- Reuses: `addMember` (`ledgers/members.ts`) for accept, and for sam in the tests. Also `withTransaction` (`db.ts`);
  the ledger row lock query from `categories/monthLists.ts`' private `lockLedger` (written inline, see Not doing); `requireAuth`,
  `requireLedger`; the `users` lookup by `username = ?` as in login; and the `makeUser`, `authHeader`, `clearData`,
  `resetSchema`, `testConfig` and `testDbReachable` test helpers.
- New dependencies: none.

## Slices

Integration tests go in a new `apps/api/test/invites.int.test.ts` ("ledger invites (MySQL)"). It uses
`let clock = new Date('2026-10-06T10:00:00Z')`, reset in `beforeEach`, and
`buildApp({ …, now: () => clock, fetchRate: offlineRates })`. In `beforeEach`, dimuch and olena come from
`makeUser`, and sam comes from `makeUser` plus `addMember(db, dimuch.ledgerId, sam.userId)`. Each of them logs in.
Sessions last 30 minutes and a TOTP code works once per step, so moving the clock goes through a helper:
`later(minutes)` sets `clock` to the base time (`2026-10-06T10:00:00Z`) plus `minutes`. That's absolute, not
cumulative: `later(59)` then `later(60)` means 10:59 then 11:00. It then logs in again every user the test uses,
including any made inside the test (stranger, ivanka). It keeps the users' auth headers in one map that the helper
refreshes (the same idea as `notionHistory.int.test.ts:40`).
`rows()` returns only `SELECT status, status_changed_at FROM ledger_invites ORDER BY invite_id`, so every assertion
on it is an exact `toEqual` (e.g. `[{ status: 'revoked', status_changed_at: clock }]`), not `toMatchObject`.

- [x] 1. Check the ledger owner with a shared preHandler (~15)
  - Files: `apps/api/src/ledgers/access.ts`, `apps/api/src/ledgers/routes.ts`
  - Change: `export async function requireOwner(req, reply)`, with a one-line JSDoc that says it runs after
    `requireLedger`. The member list uses `preHandler: [app.requireAuth, app.requireLedger, requireOwner]` and drops its
    inline check. The old comment ("054's invite routes bring it") becomes "Only the owner sees who's in the ledger".
  - Tests: no changes. `members.int.test.ts` "a member gets owner_only from the list", "lists the members for the
    owner", 401 and stranger 404 already pin the behaviour.
- [x] 2. Let the owner invite an existing user by username (~175)
  - Files: `apps/api/migrations/010_ledger_invites_by_user.sql` (new), `apps/api/src/invites/routes.ts` (new),
    `apps/api/src/app.ts` (`await inviteRoutes(app, deps)` after `ledgerRoutes`),
    `apps/api/test/invites.int.test.ts` (new)
  - Change: the migration as in Contracts. `const INVITE_TTL_MS = 60 * 60_000`, with a comment citing the brief 054
    decision. `InviteBody`. `POST /api/ledgers/:id/invites` uses
    `withTransaction(db, …)`: lock the ledger row, then
    `SELECT u.user_id, u.username FROM users u WHERE u.username = ? AND NOT EXISTS (member row) AND NOT EXISTS (live invite for ledger)`.
    No row gives `null`, which becomes 409. Otherwise it does
    `INSERT (ledger_id, invitee_user_id, created_at, expires_at)` with `at` and `at + TTL`.
  - Tests: "invites olena" (`' Olena '` gives `[201, { inviteId, username: 'olena' }]`; `rows()` is one `pending`
    row with `status_changed_at: null`). "answers cannot_invite alike for an unknown user, a member, the owner, or
    someone already invited" (`nobody`, `sam`, `dimuch`, then `olena` a second time each give
    `[409, { error: 'cannot_invite' }]`, and `rows()` still has length 1). "two invites sent at once make one"
    (`Promise.all` of two olena invites gives sorted statuses `[201, 409]` and one row). "an expired invite doesn't
    block a new one" (`later(59)` gives 409; `later(60)` gives 201, with two `pending` rows). `ledgers/abc/invites`
    gives 400; username `'  '` gives 400 and `{}` gives 400. No session gives 401. sam gives
    `[403, { error: 'owner_only' }]`. A stranger (`makeUser`) gives `[404, { error: 'ledger_not_found' }]`. The 403
    and 404 cases store no row.
  - Deploy check (in the PR's test plan): before merge, on the droplet,
    `mysql -h 127.0.0.1 -u kopiyka -p kopiyka -e 'SELECT COUNT(*) FROM ledger_invites'` must print 0. Otherwise stop
    and ask the user.
- [x] 3. List live pending invites for the owner's ledger and for the invitee (~80)
  - Files: `apps/api/src/ledgers/routes.ts` (destructure `now`; a second query for `invites`),
    `apps/api/src/invites/routes.ts` (`GET /api/invites`, joining `ledgers l` and `users o ON o.user_id = l.owner_user_id`),
    `apps/api/test/members.int.test.ts` ("lists the members for the owner" gains `invites: []`),
    `apps/api/test/invites.int.test.ts`
  - Tests: "lists a pending invite to the owner and the invitee". dimuch's member list has
    `invites: [{ inviteId, username: 'olena' }]`. olena's `GET /api/invites` is
    `[{ inviteId, ledgerId: dimuch.ledgerId, ledgerName: 'Home', owner: 'dimuch' }]`. sam's is `[]`. "an expired
    invite isn't listed": after `later(60)`, both lists are `[]`. "lists the invitee's invites in send order": a
    second owner, `makeUser('ivanka')`, also invites olena, and olena's list has dimuch's invite, then ivanka's, while
    dimuch's member list still shows only his own. `GET /api/invites` with no session gives 401.
- [x] 4. Let the owner revoke an invite and the invitee decline it (~130)
  - Files: `apps/api/src/invites/routes.ts`, `apps/api/test/invites.int.test.ts`
  - Change: `InviteParams = z.object({ inviteId: z.coerce.number().int().positive() })`. Revoke is
    `UPDATE … SET status = 'revoked', status_changed_at = ? WHERE invite_id = ? AND ledger_id = ? AND <live>`.
    Decline is the same with `invitee_user_id = ?` and `'declined'`. `affectedRows === 0` gives
    `404 not_found`.
  - Tests: "revoking keeps the invite as revoked, with no membership" (204; `rows()` is
    `[{ status: 'revoked', status_changed_at: clock }]`; both lists are empty; olena's `GET /api/ledgers` is only her
    own; a second revoke gives 404). "declining keeps the invite as declined, with no membership" (the same shape;
    a second decline gives 404; dimuch can invite olena again and gets 201). For revoke: an unknown id (999999),
    another ledger's invite (ivanka's), and an expired one (`later(60)`) each give `[404, { error: 'not_found' }]`. For
    decline: sam declining olena's invite and an expired one give 404, and the row stays `pending`. sam revoking gives
    403 `owner_only`. A stranger revoking gives 404 `ledger_not_found`. `inviteId=abc` gives 400 for revoke and for
    decline. Both routes give 401 without a session.
- [x] 5. Let the invitee accept an invite and become a member (~150)
  - Files: `apps/api/src/invites/routes.ts`, `apps/api/src/ledgers/members.ts` (JSDoc: "…and accepting an invite
    does (brief 054)"), `apps/api/test/invites.int.test.ts`
  - Change: `POST /api/invites/:inviteId/accept`, as in Contracts, in one `withTransaction`. The `FOR UPDATE` read
    finds the ledger, then the `UPDATE` runs, then `addMember(conn, ledgerId, req.auth!.userId)`.
  - Tests: "the owner invites olena; she sees it, accepts, and is a member". After the invite, olena's list has it.
    Accept gives 204. olena's `GET /api/ledgers` adds
    `{ ledgerId: dimuch.ledgerId, name: 'Home', role: 'member', owner: 'dimuch' }`. Her
    `GET …/categories?month=2026-10` gives 200. The member list shows olena as `member`, with `invites: []`. `rows()` is
    `[{ status: 'accepted', status_changed_at: clock }]`. "only once" has two parts. A second accept gives 404. Then,
    with a fresh invite (after olena leaves via `DELETE …/members/:olena`), a `Promise.all` of two accepts gives sorted
    statuses `[204, 404]` and one membership row. "only by the invitee": sam accepting gives 404, with no change.
    "accepts until its hour is up": at `later(59)`, accept gives 204. "not after its hour": a separate test,
    where at `later(60)` accept gives 404, the row stays `pending`, and olena's `GET /api/ledgers` is only her own. "a revoked or declined invite can't be accepted" gives 404.
    `abc` gives 400. No session gives 401.

Total: about 550 changed lines in 5 slices: 15 + 175 + 80 + 130 + 150. Most of it is tests, since each route has
its 400, 401, 403/404 and expiry cases. Slice 2 is ~175, over the ~150 target, because the migration needs its first
route to be tested (as in 052's 3.1) and the test file's setup arrives with it. The total is well over the ~400
target. See Open questions for the split.

## AC → evidence

| AC                                                                               | Evidence                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner invites olena; she sees it, accepts, is a `member`                         | invites.int "invites olena" (2), "lists a pending invite to the owner and the invitee" (3), "the owner invites olena; she sees it, accepts, and is a member" (5)                                         |
| Unknown / member / owner / already invited → one `409 cannot_invite`, no row     | invites.int "answers cannot_invite alike…" and "two invites sent at once make one" (2), both checking `rows()`                                                                                           |
| Only the owner invites/revokes (403 member, 404 stranger); only invitee, once    | invites.int: sam → 403 and stranger → 404 on invite (2) and revoke (4); sam's decline → 404 (4); sam's accept → 404, second accept and concurrent accepts → 404 (5); second revoke and decline → 404 (4) |
| Declined or revoked → no membership, stored with status                          | invites.int "revoking keeps the invite as revoked…", "declining keeps the invite as declined…" (4): `rows()` status + `status_changed_at`, `GET /api/ledgers` unchanged                                  |
| Invite older than 1 h: no accept/decline (404), not listed, doesn't block invite | invites.int "an expired invite doesn't block a new one" (2), "an expired invite isn't listed" (3), expired decline/revoke → 404 (4), "not after its hour" (5)                                            |
| Every new route has a 400 for a bad id                                           | POST invites `ledgers/abc` (2); revoke and decline `abc` (4); accept `abc` (5). `GET /api/invites` takes no id                                                                                           |
| Deploy: production `ledger_invites` empty before the drop                        | The PR's test plan item from slice 2 (droplet `SELECT COUNT(*)` = 0), checked by the user                                                                                                                |

## Not doing (YAGNI)

- An `expired` status, or a job that changes or deletes expired rows. The brief defines expired as pending past its
  hour.
- Any read of the history (accepted/declined/revoked). Nothing shows it (brief).
- Time fields (`sentAt`/`expiresAt`) in the DTOs. 055 shows only pending invites. They can be added when a screen
  needs them.
- An `invited_by` column, a block list after a decline, rate-limiting invites, and notifications.
- The app's types and screens (055).
- Exporting `lockLedger` from `categories/monthLists.ts`. Invites would then import the categories domain to get
  one line of SQL.

## Risks

- Production's `ledger_invites` has rows, and `DROP TABLE` loses them. The only code reference is
  `test/helpers.ts`'s `DATA_TABLES` (`rg ledger_invites apps`), so nothing should have written it. Slice 2's deploy
  check proves it before merge. If the count isn't 0, stop and ask.
- A rollback runs the previous release on the new schema (deploy/README.md). The previous release never reads
  `ledger_invites`, so it stays compatible. The same `rg` proves it.
- The duplicate-invite guard depends on the plain read happening after the ledger lock (the InnoDB snapshot opens at
  the first non-locking read, and `withTransaction` uses a plain `START TRANSACTION`). Slice 2's
  "two invites sent at once make one" proves it. If it ever fails, the `NOT EXISTS (live invite)` check becomes a
  locking read (`SELECT 1 … FOR UPDATE`) right after the lock.
- Accept's foreign-key share lock on `ledgers` waits behind a create's `FOR UPDATE` on the same ledger. Neither
  transaction holds anything the other wants first, so there's no deadlock. Slice 5's concurrent accepts run green
  next to slice 2's tests.
- Revoke racing accept (or decline) is safe without a test: both lock or update the same invite row, so the second
  one re-reads it as no longer pending and answers 404.
- A test that moves the clock and keeps the old bearer gets 401, because sessions last 30 minutes. `later()`
  logs everyone in again. Slice 2 is its first user.

## Open questions

- No: revoking an expired invite answers 404, the same "live pending" rule as accept and decline. The owner no
  longer sees it, so the app can't offer revoke anyway.
- No: only membership or a live pending invite blocks a new invite. After a decline, revoke or expiry the owner can
  invite again (tested in 2 and 4).
- No: an invite is live while `now < sent + 1 h`, so it has expired at exactly 60:00.
- No: decline and revoke keep the 052 design's `DELETE` routes even though the row is kept. To the client the
  pending invite is gone. The alternative is `POST /api/invites/:id/decline`, which 055 would mirror.
- No: the size. This is ~550 lines in one PR. It could split after slice 3 into PR A (slices 1–3: owner check,
  invite, list, ~270) and PR B stacked on it (slices 4–5: revoke, decline, accept, ~280). Each half is under ~300 and
  ships safely, since an invite nobody can accept just expires after an hour. The plan keeps one PR by default,
  because 055 needs all of it and the two halves would be reviewed back to back. Say "split" at Gate A to get A and B.

## Follow-ups

- `docs/audits/2026-10-architecture.md:160` lists `ledger_invites` as unused. That audit is a dated snapshot, so it
  stays as is.

## Deviations

## Consolidate

CONSOLIDATE: reused 0 · extracted 1 · left 4

- EXTRACT `liveInvite(table)` in `invites/live.ts`: the live-invite condition was written in six queries across
  `invites/routes.ts` and `ledgers/routes.ts`; all six call it, each keeping its own `now` parameter. A small module
  rather than an export of `invites/routes.ts`, so the ledger routes don't import the invite routes.
- LEAVE the ledger row lock in the invite route vs `categories/monthLists.ts`' private `lockLedger`: two copies, one
  line each, in different domains (plan's Not doing).
- LEAVE the `[requireAuth, requireLedger, requireOwner]` guard list in `ledgers/routes.ts` and `invites/routes.ts`:
  two copies.
- LEAVE revoke's and decline's `affectedRows === 0` → 404: the repo's idiom, one line each.
- LEAVE the `send`/`rows` test helpers in `invites.int.test.ts` vs `members.int.test.ts`' local ones: test-only,
  shaped for each suite.

## Revision 1

Skeptic suggestions (approved, no blockers). `rows()` returns only `status` and `status_changed_at`, and the tests
assert on it with `toEqual`. `later(minutes)` is now defined: absolute from the base time, and it logs in again every
user in the test. The "live" predicate is a Consolidate candidate. Slices 4 and 5 are re-estimated (~130, ~150) and
slice 2 too (~175), for ~550 in total, and the split question now gives A/B sizes. Risks gain the revoke-vs-accept
race line.

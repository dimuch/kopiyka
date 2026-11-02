# Plan: Add a user to an existing ledger

Status: approved

Brief: ./brief.md
Branch: feat/join-shared-ledger
Base: origin/main

## Approach

`create-user` gets `--join <username>`. Then, instead of `createUserWithLedger`, it calls a new
`createUserJoiningLedger` in `apps/api/src/admin.ts`. That function finds the one ledger `<username>` owns
(`ledgers.owner_user_id`), then in one transaction inserts the user and adds them as a `member`. The insert goes
through a new `addMember(q, ledgerId, userId)` in `apps/api/src/ledgers/members.ts`: the seam the brief asks for,
which brief 052's invite route will call. Lookup failures come back as a result code before anything is written, and
the script turns each code into a clear message. `createUserWithLedger` and the no-flag path stay byte-for-byte as
they are. The ledger routes already let any member do what the owner does, so no route changes. A new integration
suite proves that.

Alternative considered: one `createUser(input: { ledgerName } | { join })` with a discriminated union. Rejected
because it changes `createUserWithLedger`'s signature, which `test/helpers.ts` and `migrations.int.test.ts` call, and
the brief wants those unchanged. A second function also keeps the old path unchanged.

## Contracts

- DB: none (`ledger_members (ledger_id, user_id, role ENUM('owner','member'), joined_at)` and
  `ledgers.owner_user_id` already exist in `001_initial.sql`).
- API (HTTP): none. Existing routes, unchanged.
- API (module):
  - `apps/api/src/ledgers/members.ts`:
    `export async function addMember(q: Db | PoolConnection, ledgerId: number, userId: number): Promise<void>`.
    It runs `INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, 'member')`. JSDoc: an existing
    membership throws `ER_DUP_ENTRY` (PK), and the caller decides what that means. 052 will call it with the
    `requireLedger` ledger id. The `Db | PoolConnection` union follows `notion/historyImport.ts`.
  - `apps/api/src/admin.ts`:
    `export type JoinError = 'no_such_user' | 'owns_no_ledger' | 'owns_several_ledgers'`;
    `export async function createUserJoiningLedger(db: Db, totpKey: Buffer, input: { username: string; email: string; join: string }): Promise<CreatedUser | { error: JoinError }>`.
    It runs inside `withTransaction` (from `db.ts`):
    `SELECT l.ledger_id FROM users u LEFT JOIN ledgers l ON l.owner_user_id = u.user_id WHERE u.username = ?`.
    0 rows gives `no_such_user`. 1 row with a null `ledger_id` gives `owns_no_ledger`. More than 1 row gives
    `owns_several_ledgers`. On any of these it returns before any write. Otherwise it does `INSERT INTO users` (same
    columns and encryption as `createUserWithLedger`), then `addMember(conn, ledgerId, userId)`, and returns
    `{ userId, ledgerId /* the joined ledger */, otpauthUri }`. It takes no `now`: nothing is seeded.
- Script CLI (`apps/api/scripts/create-user.ts`):
  `yarn api create-user --username <name> --email <email> [--ledger <name> | --join <owner username>]`.
  - The `parseArgs` `ledger` option loses its `default: 'Home'`, so the script can tell when `--ledger` was given.
    The Zod schema gets `ledger: …optional()` and `join: <the same username regex>.optional()`, plus
    `.refine((v) => !(v.join !== undefined && v.ledger !== undefined), { error: 'use --ledger or --join, not both', path: ['join'] })`.
    I checked this against the installed zod 4.6.5: it prints `join: use --ledger or --join, not both`. A rejected
    combination prints the usage line plus that issue and exits 1, as other bad input does today.
  - No `--join`: calls `createUserWithLedger` with `ledgerName: input.data.ledger ?? 'Home'`. The output is the same
    as today.
  - `--join` success prints `Created user #<id> "<username>" as a member of <join>'s ledger #<ledgerId>.`, then the
    same QR and manual-secret lines as today.
  - `--join` errors print one line to stderr and set `exitCode = 1`:
    - `no_such_user`: `No user "<join>" to join.`
    - `owns_no_ledger`: `"<join>" owns no ledger to join.`
    - `owns_several_ledgers`: `"<join>" owns more than one ledger; not guessing which one to join.`
  - `ER_DUP_ENTRY` keeps today's message.
- App: none. `AuthContext` already opens `me.ledgers[0]`, and `LedgerDto.role` already allows `'member'`.
- Reuses: `withTransaction` (`db.ts`), `encryptSecret`/`generateSecret`/`otpauthUri` (`auth/`), `CreatedUser`
  (`admin.ts`), and the test helpers `makeUser`, `authHeader`, `clearData`, `resetSchema`, `testConfig`. The user
  INSERT is repeated once in `createUserJoiningLedger`. That is 2 copies, under the rule of three, and it leaves
  `createUserWithLedger` untouched.
- New dependencies: none.

## Slices

- [x] 1. Add a function that creates a user as a member of another user's ledger (~140 lines)
  - Files: `apps/api/src/ledgers/members.ts` (new), `apps/api/src/admin.ts`, `apps/api/test/admin.int.test.ts` (new)
  - Change: add `addMember` and `createUserJoiningLedger` as in Contracts. Update the `admin.ts` JSDoc: the script
    is still the only caller of the `create*` functions, and `addMember` is the seam for 052.
  - Tests: `admin.int.test.ts`, `describe.skipIf(!(await testDbReachable()))('createUserJoiningLedger (MySQL)')`,
    with dimuch made by `makeUser`:
    - "adds the new user to the owner's ledger as member and seeds nothing": the result's `ledgerId` is dimuch's.
      `ledger_members` has `(ledger, olena, 'member')` and `(ledger, dimuch, 'owner')`. Counts of `ledgers`,
      `categories` and `category_months` are the same before and after. `otpauthUri` names olena.
    - "refuses an unknown owner and leaves no user": `{ error: 'no_such_user' }`, and `users` has only dimuch.
    - "refuses a user who owns no ledger": join olena to dimuch, then try `join: 'olena'` for a third user. Expect
      `owns_no_ledger` and no third user row.
    - "refuses an owner of several ledgers": `INSERT INTO ledgers (name, owner_user_id)` a second ledger for
      dimuch. Expect `owns_several_ledgers` and no new user or membership.

- [ ] 2. Prove a joined member uses the shared ledger like its owner (~90 lines)
  - Files: `apps/api/test/members.int.test.ts` (new)
  - Change: test only. It builds the app with clock `2026-10-06T10:00:00Z` and a stubbed
    `fetchRate: async () => 50.483`. A local `joinUser(db, config, 'olena', 'dimuch'): Promise<TestUser>` decodes the
    secret the way `makeUser` does.
  - Tests:
    - "lists only the joined ledger as member, the owner's as owner": `GET /api/ledgers` for olena returns
      `ledgers: [{ ledgerId: dimuch.ledgerId, name: 'Home', role: 'member' }]`. For dimuch it returns
      `[{ …, role: 'owner' }]`.
    - "reads and writes categories, months and expenses like the owner":
      - Olena's `GET …/categories?month=2026-10` equals dimuch's.
      - Olena's `PUT …/categories/<groceries>/months/2026-10/planned` `{ amount: '300.00' }` returns 204, and
        dimuch then sees `plannedEur: '300.00'`.
      - Olena's `POST …/months/2026-11/copy` returns 204.
      - Olena's `POST …/expenses` (groceries, `2026-10-06`, `'12.50'` EUR) returns 201 with
        `createdBy: olena.userId`, and dimuch's `GET …/expenses?month=2026-10` contains it.
      - Olena's `DELETE` of an expense dimuch added returns 204.

- [ ] 3. Let create-user join an existing ledger with --join (~45 lines)
  - Files: `apps/api/scripts/create-user.ts`
  - Change: the CLI contract above. Update the header comment and the usage line.
  - Verify (local dev DB, `apps/api/.env`). Each command's output must match:
    - `yarn api create-user --username olena-qa --email olena-qa@example.com --join dimuch` prints
      `… as a member of dimuch's ledger #1.` plus the QR. In MySQL, `ledger_members` gains `(1, <id>, 'member')`,
      and the counts of `ledgers`, `categories` and `category_months` are unchanged.
    - `… --username x-qa --email x-qa@example.com --join nobody` prints `No user "nobody" to join.`, exits 1, and
      leaves no `x-qa` row.
    - `… --join olena-qa` prints `"olena-qa" owns no ledger to join.` and exits 1.
    - `… --join dimuch --ledger Home` prints the usage line plus `join: use --ledger or --join, not both` and exits 1.
    - The several-ledgers message has only test coverage (slice 1) plus reading the switch, because the dev DB
      doesn't have that data.

- [ ] 4. Document create-user --join for local and production use (~10 lines)
  - Files: `README.md` (one comment line under Local setup), `deploy/README.md` (step 10: add
    `[--join <owner>]` to the command and add one sentence: with `--join` the user becomes a member of that user's
    only ledger instead of getting their own)
  - Verify: `yarn format:check`. Read the step 10 text.

The build ends with the AC7 manual check: start the `api` and `web` launch configs and open the in-app browser at
phone width. Log in as `olena-qa` with a code from the secret printed in slice 3. Budget shows dimuch's October/November
categories and planned amounts, and Expenses shows dimuch's expenses. Record this in the PR test plan. Required
cleanup: `DELETE FROM users WHERE username = 'olena-qa'` (the membership cascades). Add no expenses as olena-qa,
because `fk_expenses_creator` would block that delete.

Total: about 285 changed lines in 4 slices.

## AC → evidence

| AC                                                                         | Evidence                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 `--join dimuch` creates member, no ledger/categories/months, QR shown  | `admin.int.test.ts` "adds the new user … seeds nothing" plus the slice 3 manual run                                                                                                                                                            |
| AC2 `GET /api/ledgers` member vs owner                                     | `members.int.test.ts` "lists only the joined ledger as member, the owner's as owner"                                                                                                                                                           |
| AC3 member reads and writes categories, months, expenses; own `created_by` | `members.int.test.ts` "reads and writes categories, months and expenses like the owner"                                                                                                                                                        |
| AC4 unknown user, or a user with no ledger: clear message, nothing created | `admin.int.test.ts` "refuses an unknown owner …" and "refuses a user who owns no ledger" (no user row), plus slice 3 manual runs for the messages                                                                                              |
| AC5 several ledgers refused; `--ledger` with `--join` rejected             | `admin.int.test.ts` "refuses an owner of several ledgers", plus the slice 3 manual `--join dimuch --ledger Home` run                                                                                                                           |
| AC6 no `--join` unchanged                                                  | `createUserWithLedger` untouched. `migrations.int.test.ts` "starts a new ledger with the defaults…" and every suite that uses `makeUser` stay unchanged and green. The default `'Home'` moves from `parseArgs` to `?? 'Home'` (slice 3 review) |
| AC7 joined user on web at phone width sees dimuch's budget and expenses    | Manual check after slice 4 (above), recorded in the PR test plan                                                                                                                                                                               |

## Not doing (YAGNI)

- Adding an existing user to a ledger, removing members, changing roles, any invite route or UI (052), and showing
  `created_by` in the app. All are out of scope in the brief.
- A `role` parameter on `addMember`, and reusing it for the owner row in `createUserWithLedger`. The brief asks only
  for "add as member", and touching the owner path risks AC6.
- Handling "already a member" in `addMember`. That can't happen for a new user. 052 decides how to handle it.
- A `--ledger-id` to choose among several owned ledgers. The brief says to refuse, not to pick.
- Moving the script's argument parsing into a testable module. The `--ledger` + `--join` refinement is 1 line, and
  it's checked by hand.
- A shared `insertUser` helper for the two user INSERTs. Two copies don't meet the rule of three.

## Risks

- `POST …/months/2026-11/copy` might refuse for a reason unrelated to membership. On Base, `copyPreviousMonth`
  returns `budget_exists`/`no_previous_budget` unless October has a budget and November has none. `makeUser` sets up
  exactly that, so the copy should return 204. Slice 2 confirms it.
- Username lookup is case-insensitive under the default collation, so `--join DIMUCH` finds dimuch. Login works the
  same way, so this is consistent and not a defect. Slice 1 could assert it, but it isn't needed by an AC.
- A dev DB where dimuch owns more than one ledger would make the slice 3 happy-path run fail with
  `owns_several_ledgers`. Slice 3's first run shows whether that's the case, and the expected behaviour holds either
  way.

## Open questions

- No — The brief allows one message for both "doesn't exist" and "owns no ledger". This plan prints two different
  messages, which is clearer and costs nothing.
- No — "The ledger `<username>` owns" is read from `ledgers.owner_user_id`, as the brief's Notes say, not from
  `ledger_members.role = 'owner'`. Today the two always agree.
- No — The local AC7 check adds a real `olena-qa` member to dimuch's local ledger. It can be removed afterwards with
  the cleanup SQL above. Notion sync is off, so nothing leaves the laptop.

## Follow-ups

- `createUserWithLedger` manages its own transaction. Its `rollback()` isn't guarded the way `withTransaction`'s is,
  so a lost connection could hide the original error. This is cosmetic for an admin script, and it is left alone to
  keep AC6 untouched.

## Deviations

## Consolidate

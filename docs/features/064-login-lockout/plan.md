# Plan: Wrong codes from strangers don't lock you out

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/login-lockout
Base: origin/main at `f8151d5`

## Approach

`throttledAttempt` (`apps/api/src/auth/throttle.ts`) gets two small changes, and a new table `known_devices` backs them.
Both reads and writes of the table stay inside the module that decides blocking, and inside the transaction that
already holds the throttle rows.

- **Remember**: an accepted login with a device key upserts `(userId, deviceId)`. It stores the first and the last
  success.
- **Waive**: today any locked key means `blocked`. The new rule: a locked IP or device key still blocks. A locked
  username blocks unless the attempt has a device key and that device is known for that username. Nothing else changes,
  so a known device's wrong codes still go through `afterFailure` for the username, device and IP keys. A good login
  still clears only `failed_attempts`. `locked_until` stays set, so unknown devices stay blocked after the owner gets
  in.

`routes.ts` doesn't change: its `check` already returns `{ userId, username }`, and `deviceId` is already optional.
Without a device id `throttleKeys` drops the device key, so such an attempt is never known.

Alternative considered: `routes.ts` records the device inside `check`, and `throttledAttempt` takes an
`isKnownDevice(conn)` callback. That's a callback parameter with one caller, and it splits one table across two
modules. The chosen shape costs one generic constraint (`T extends { userId: number }`).

Facts checked on the Base:

- **Lock order** today: the throttle rows are taken with `INSERT … ODKU` + `SELECT … FOR UPDATE`, in the fixed key
  order username, ip, device. After that, `check` reads `users` (plain SELECT) and locks the users row with its
  `UPDATE users SET last_totp_step`.
  - The known-device lookup is a plain, non-locking SELECT. It runs after the throttle rows are locked, so it takes no
    locks.
  - The upsert runs after `check`, so the order becomes throttle rows → users row → known_devices row. Nothing else
    writes `known_devices`. Only the FK cascade does, on a user delete, and no code path deletes users.
  - Parallel attempts on one username are still serialized by its throttle row.
  - Everything uses only `conn`, as the module's JSDoc requires.
- **Timing**: the lookup runs only when the username key is locked, the device key is present, and no IP or device key
  is locked.
  - None of these depend on whether the username exists: unknown usernames get throttle rows and locks the same way.
  - The query is the same either way:
    `SELECT 1 FROM known_devices k JOIN users u ON u.user_id = k.user_id WHERE u.username = ? AND k.device_id = ?`.
    It uses the users unique index, then the known_devices PK. A missing user and an unknown device both give no
    row → `429 blocked`.
  - The existing "unknown usernames still run a check" path is untouched.
- **Matching**: the lookup uses the username key value (trimmed, lowercased). The route's `WHERE username = ?` uses
  `body.username`, also trimmed by Zod. Both compare under `utf8mb4_0900_ai_ci` (`apps/api/scripts/setup-local-db.sql`,
  `deploy/README.md`), so they match the same users row. `deviceId` is `^[A-Za-z0-9_-]{8,64}$`, so the 64-char slice in
  `throttleKeys` never cuts it.
- **Re-lock**: while the username is locked, its `failed_attempts` restarted at 0 (`afterFailure`). A known device's
  wrong code makes it 1, and a 5th re-locks the username for 24 h, "as today". A good login sets `failed_attempts = 0`
  and leaves `locked_until` alone (`throttle.ts:100-107`).
- **Next migration** is `013` (`apps/api/migrations/` ends at `012_income_items.sql`). Pure `CREATE TABLE` migrations
  ship with their first consumer, the way 012 shipped in "List a month's income items". Every `*.int.test.ts`
  `resetSchema()` applies all migrations.
- **Cleanup paths**: `test/helpers.ts` `DATA_TABLES` must list the new table. No code deletes users. The
  `deploy/README.md` import steps and `deploy/export-ledger.sh` only touch `users`, `ledgers` and `ledger_members`, so
  known devices aren't exported, like sessions. Nothing to change there.

## Contracts

- DB: `apps/api/migrations/013_known_devices.sql`:

  ```sql
  -- Brief 064. Devices that have logged in successfully as a user. A locked username doesn't block them; their own
  -- device lock and the IP lock still do (auth/throttle.ts). Never pruned: a user has a handful. Times are the app's
  -- clock, UTC.
  CREATE TABLE IF NOT EXISTS known_devices (
    user_id         INT UNSIGNED NOT NULL,
    device_id       VARCHAR(64)  NOT NULL,              -- the app's random per-install id (login body deviceId)
    first_login_at  DATETIME     NOT NULL,              -- first successful login from it as this user
    last_login_at   DATETIME     NOT NULL,              -- latest successful login from it as this user
    PRIMARY KEY (user_id, device_id),
    CONSTRAINT fk_known_devices_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
  );
  ```

  Re-runnable (`IF NOT EXISTS`). Forward-only. No backfill: nothing records which device logged in as whom today.

- `throttledAttempt<T extends { userId: number }>(db, keys, now, check)`. The signature is otherwise unchanged, and its
  only caller is `auth/routes.ts`.
  - **Blocking**: `blocked` when an `ip` or `device` key is locked, or when the `username` key is locked and the device
    isn't known.
  - **Success**: after clearing the counts, an accepted attempt with a device key upserts
    `INSERT INTO known_devices (user_id, device_id, first_login_at, last_login_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_login_at = ?`.
    The repo's repeated-param ODKU style is the one in `notion/routes.ts:63`.
  - The JSDoc's lock-order sentence gains "…and the known_devices row last".
- API: `POST /api/auth/login`: request, response and error codes are unchanged (`200`, `400`, `401 invalid_credentials`,
  `429 blocked`). What changes is when `429` happens, as described above.
- App: none.
- Reuses: `throttleKeys`, `isLocked`, `afterFailure`. In tests: `helpers.ts` (`resetSchema`, `clearData`, `makeUser`,
  `testDbReachable`, `testConfig`), plus `login`, `codeAt` and the `HOUR` constant from `auth.int.test.ts`.
- New dependencies: none.

## Slices

- [x] 1. Remember which devices have logged in as each user (~85 lines)
  - Files: `apps/api/migrations/013_known_devices.sql`, `apps/api/src/auth/throttle.ts`, `apps/api/test/helpers.ts`,
    `apps/api/test/auth.int.test.ts`
  - Change:
    - The migration above.
    - `T extends { userId: number }`.
    - In the success branch, upsert `known_devices` when a `device` key is present.
    - Add `'known_devices'` to `DATA_TABLES`, before `'users'`.
  - Tests: `auth.int.test.ts`:
    - **"remembers a device's first and last successful login"**: log in with `deviceId: 'device-known-01'`, then log
      out. Advance the clock 60 s and log in again with the next code. The row has `first_login_at` = the first clock
      and `last_login_at` = the second. A wrong code from another device id adds no row.
    - **"remembers no device for a login without a device id"**: `known_devices` stays empty.
    - **"forgets a user's devices when the user is deleted"**: insert a raw user with no ledger (`fk_ledgers_owner`
      has no cascade) and a `known_devices` row, delete the user, and the count is 0.
    - **"remembers devices for parallel logins"**: `makeUser(…, 'olena')`. Ivanka (`device-known-01`, already known
      from an earlier login, clock +60 s) and olena (`device-olena-01`, new) log in with right codes in one
      `Promise.all`, from different IPs. Both get 200. `known_devices` then has exactly those two rows, and ivanka's
      `last_login_at` has moved, so both the insert and the ODKU update ran concurrently.
- [ ] 2. Let a known device log in while its username is locked (~120 lines)
  - Files: `apps/api/src/auth/throttle.ts`, `apps/api/test/auth.int.test.ts`
  - Change:
    - Replace `states.some(isLocked)` with the rule above.
    - The known-device lookup is a small unexported function in `throttle.ts`, called only on that branch.
    - Update the module header comment: 5 wrong codes per username still block it, except for a device known for it.
  - Tests: `auth.int.test.ts`, new `describe('known devices')`. Local helpers:
    - `wrongAt()`: the first of `'000000'`, `'111111'`, `'222222'`, `'333333'` that isn't `codeAt(-1)`, `codeAt(0)` or
      `codeAt(1)`, since `verifyTotp` accepts ±1 step.
    - `lockIvanka()`: 5 wrong codes, `deviceId: 'stranger-0001'`, from IPs `198.51.100.0-4`.
    - `knowDevice(id)`: a good login with `deviceId`, then logout, then the clock +60 s.

    Cases:
    - (a) **"a known device logs in while its username is locked"**: `knowDevice('device-known-01')`, `lockIvanka()`.
      A right code from `device-known-01` at `192.0.2.1` gets 200 and a session. The `login_throttle` username row's
      `locked_until` is still in the future afterwards.
    - (b) **"a locked username still blocks unknown devices and logins without a device id"**, in the same state as
      (a), after (a)'s 200 and the clock +60 s:
      - a right code with `deviceId: 'device-other-01'` from `192.0.2.2` gets 429;
      - a right code with no `deviceId` from `192.0.2.3` gets 429.
    - (c) **"a device known for another user isn't known for this one"**: `makeUser(…, 'olena')`. `device-known-01`
      logs in as olena, then `lockIvanka()`. A right ivanka code from `device-known-01` at `192.0.2.1` gets 429.
    - (d) **"a known device's own lock and the IP lock still block it"**: `knowDevice('device-known-01')`,
      `knowDevice('device-known-02')`, then `lockIvanka()`.
      - The device sends 5 wrong codes from `192.0.2.10-14`. Each gets 401, not 429, so the bypass applies to wrong
        codes too. Then a right code from `192.0.2.20` gets 429.
      - 5 `guess<i>` wrong codes from `203.0.113.50` with no `deviceId` lock that IP. A right code from
        `device-known-02` at `203.0.113.50` then gets 429, and from `192.0.2.21` it gets 200.
    - (e) **"a known device's wrong codes count against the username"**: `knowDevice`, `lockIvanka()`. One wrong code
      from the known device gets 401, and the `login_throttle` username row has `failed_attempts = 1` with
      `locked_until` still in the future.
    - Existing tests stay unchanged and must pass, notably "blocks the username for 24 h after 5 wrong codes" and
      "blocks a device id across usernames and IPs".

## AC → evidence

| AC                                                                    | Evidence                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 5 wrong from unknown → right code from known device gets a session    | slice 2 (a); its `knowDevice` logs out first, which also covers "logging out keeps the device known"                           |
| In that state, unknown device / no device id → 429                    | slice 2 (b)                                                                                                                    |
| Device known for `olena` isn't known for `dimuch`                     | slice 2 (c)                                                                                                                    |
| Known device's own lock and the IP lock still block it                | slice 2 (d)                                                                                                                    |
| Known device's wrong codes count against the username                 | slice 2 (e)                                                                                                                    |
| Integration tests cover each case; existing throttle/auth tests green | slice 2 (a)–(e); `throttle.test.ts` and `auth.int.test.ts` unchanged and passing                                               |
| All gates pass                                                        | `yarn format:check && yarn lint && yarn typecheck && yarn test` per slice, with `DATABASE_URL_TEST` reachable so int tests run |
| (Notes) first/last success stored; rows go with the user              | slice 1 tests                                                                                                                  |

The brief's `dimuch`/`olena` are played by the suite's `ivanka` and a second `makeUser` user, `olena`.

## Not doing (YAGNI)

- Expiring known devices (brief default: never).
- Admin unlock script (brief default: later). `deploy/README.md` already shows the manual `DELETE FROM login_throttle`.
- Changes to the invite 201/409 answer, `MAX_FAILURES`, the windows, nginx `limit_req`, or pruning `login_throttle`.
- Clearing a username's `locked_until` when a known device logs in. That would hand a guesser a fresh 5 every time the
  owner logs in, which goes against "a guesser's budget stays 5 per username per 24 h".
- A pure `blockedBy(...)` helper with unit tests. The rule is a few lines inside the transaction, and the integration
  cases cover each branch.
- Any app or UI change. The `blocked` text in `login.tsx` stays accurate for unknown devices.

## Risks

- **Deadlock or lock-order regression from the new table.** The read is non-locking, and the single upsert comes
  after the users row. The upsert is the transaction's last statement before commit. Every writer of a `(user_id, *)`
  row already holds that username's throttle row, and every writer of a `(*, device_id)` row holds that device's row.
  So a next-key or gap wait on `known_devices` can't close a cycle. The FK check's S lock on `users` is on the row this
  transaction already holds X on. No existing test runs the upsert in parallel. This rests on the argument above plus
  slice 1's serial tests. Slice 1's new parallel test also runs the upsert concurrently.
- **Brief 063 (MCP connector, in progress elsewhere) likely adds its own migration `013` and calls `throttledAttempt`.**
  Whichever merges second renumbers its migration, and 063's `check` must return `{ userId }` to satisfy the new
  `T extends { userId: number }`. This is checked at rebase: typecheck fails if 063's `check` doesn't return `userId`.
- **Existing devices are unknown until their next successful login**, because there's no backfill. If production's
  username is locked at deploy time, the owner still waits out the lock or uses the manual unlock. That's not a code
  risk, but the PR should say it.
- **The collation makes device ids case-insensitive** (`utf8mb4_0900_ai_ci`, the same as `login_throttle`). The app
  only makes lowercase hex ids (`randomId` in `client.ts`), so in practice nothing is lost. Slice 1 uses the same
  collation as the throttle on purpose.

## Open questions

- Non-blocking: should a known device expire if unused (say 90 days)? Assumed: never expires, as the brief's default.
  The table is tiny.
- Non-blocking: should the invite 201/409 answer stop revealing whether a username exists? Assumed: leave it, out of
  scope, as the brief's default.
- Non-blocking: should this add an admin unlock script? Assumed: later, as the brief's default. The manual SQL in
  `deploy/README.md` covers it meanwhile.

## Follow-ups

- **The device id now matters more.** It waives a username lock, but `apps/mobile/src/api/client.ts` `randomId()`
  builds it from `Math.random()`, which is not a cryptographic RNG. Its output is never shown or sent anywhere except
  the login endpoint, so remote prediction isn't practical, and a known device keeps its own 5-per-24 h limit. Still,
  switching to `crypto.getRandomValues` (web) or `expo-crypto` (native) would match the brief's "guessing isn't
  practical" claim. That needs its own brief: it touches the app and maybe a dependency.

## Deviations

## Consolidate

## Revision 1

From the skeptic's APPROVE WITH EDITS:

- The Risks deadlock argument is rewritten: the upsert comes last, and the throttle rows serialize its writers.
- Case (d) makes both devices known before the lock, and the IP guesses carry no device id.
- The collation path is now `apps/api/scripts/setup-local-db.sql`.
- New:
  - a risk about brief 063 (migration number, `check` returning `{ userId }`);
  - a slice-1 test with parallel logins that runs the upsert concurrently;
  - (a) asserts the username stays locked;
  - `wrongAt()` avoids the ±1-step codes.
- Estimate: ~85 + ~120 lines.

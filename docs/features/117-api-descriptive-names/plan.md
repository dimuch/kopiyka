# Plan: Descriptive names across the API

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/api-descriptive-names
Base: origin/main (7cffcf10)

## Approach

Rename the 28 lines `find-short-names.sh apps/api/src` reports, plus `addMember`'s `q` and `ch`/`idx` in `base32Decode`,
one commit per domain, by `kopiyka-refactoring` §4. Each rename touches the declaration and every use in the same
scope, nothing else. The top-level modules (`money`, `dates`, `config`, `migrate`, `admin`) belong to no domain, so they
share one commit. `config.ts`'s `CORS_ORIGINS` split/trim has no test, so a characterization case goes in first. The
nested ternaries in `compareCents` and `rankNames`'s comparator keep their shape; R4 rewrites them.
Alternative considered: one commit for the whole rename. Lost because the brief asks for one commit per domain, and
R2/R4 rebase more easily on small commits.

## Contracts

- DB: none
- API: none (responses, error codes and SQL unchanged)
- App: none
- Reuses: none (renames only)
- New dependencies: none

## Version

Bump: patch — 1.26.2 → 1.26.3
Why: §8b "a refactor that touches shipped code is `patch`": every slice changes shipped `apps/api/src` code, with
no behaviour change.

## Slices

Each slice is renames only (or, for slice 1, a new test). Proof for every rename slice: typecheck (a missed use is an
undefined name), the existing tests named below pass unmodified, and `find-short-names.sh` clean on the slice's files.

- [x] 0. Bump version to 1.26.3
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.3
- [x] 1. Pin how CORS_ORIGINS is split into origins
  - Files: apps/api/test/config.test.ts
  - Change: new case `it('splits CORS_ORIGINS on commas, trims and drops empty entries')`:
    `loadConfig({ ...base, CORS_ORIGINS: ' http://localhost:8081 , ,https://kopiyka.example ' }).corsOrigins` →
    `['http://localhost:8081', 'https://kopiyka.example']`; `loadConfig(base).corsOrigins` → `[]` (both checked with
    `tsx` on Base).
  - Tests: passes on Base before slice 8 touches `config.ts`; bite check: drop the `.map(trim)` and then the `.filter(Boolean)` by hand, see it fail each time, restore.
- [x] 2. Name the rate lookups' values
  - `rates/nbu.ts:18` `(r)` → `(quote)`; `:21` `[d, m, y]` → `[day, month, year]` (and `:22`).
  - `rates/service.ts:14` `(d)` → `(date)`.
  - Proof: `nbu.test.ts` (all four cases, incl. "returns null when the answer is for another day"),
    `rates.routes.int.test.ts` "rejects malformed and impossible dates".
- [x] 3. Name the sign-in helpers' keys, octets and characters
  - `auth/throttle.ts:32` `(k)` → `(key)` (both callbacks); `:112` `[i, key]` → `[keyIndex, key]`, `:114`
    `states[keyIndex]` (same name as `:158`).
  - `auth/ipKey.ts:19-20` `[a, b, c, d]` → `[octet1, octet2, octet3, octet4]`; `:26` `(g)` → `(group)`.
  - `auth/totp.ts:31-34` `ch` → `character`, `idx` → `characterValue`.
  - Proof: `throttle.test.ts` "throttleKeys"; `auth.int.test.ts` "blocks the username for 24 h after 5 wrong codes",
    "blocks an IPv6 /64 across usernames", "blocks a device id across usernames and IPs"; `ipKey.test.ts` table
    (incl. `64:ff9b::203.0.113.7`); `totp.test.ts` "base32" cases.
- [x] 4. Name the expense rows, amounts and suggestions
  - `expenses/routes.ts:32` `toDto(r)` → `toDto(row)` (all 11 uses); `:56` `(a)` → `(amount)`; `:152` `(r)` → `(row)`.
  - `expenses/nameSuggestions.ts:27` `(a, b)` → `(left, right)`, parameters and their uses; ternary shape unchanged.
  - Proof: `expenses.int.test.ts` "stores a EUR expense with the UAH amount at that day’s NBU rate", "rejects bad
    amounts, dates and currencies", "lists the most used names first", "merges names that differ only in case or
    spaces"; `nameSuggestions.test.ts` "rankNames".
- [x] 5. Name the category rows
  - `categories/routes.ts:78` `toDto(r)` → `toDto(row)` (6 uses); `:146` `const r` → `const row` (and `:147-152`).
  - Proof: `categories.int.test.ts` "one category" › "counts only one month's expenses with ?month=", "answers 404 for
    an unknown, foreign or deleted category"; "gives each category its planned amount for the month, €0 without one".
- [x] 6. Name the summary's period, offsets and compared totals
  - `summary/routes.ts:52-53` `(q)` → `(period)`; `:56` `compareCents(a, b)` → `(left, right)`, parameters and their uses, ternary shape unchanged;
    `:61` `(_, i)` → `(_, offset)` (and `:62`); `:129` `(a, b)` → `(left, right)`.
  - Proof: `summary.int.test.ts` "rejects a bad month, from after to, or more than 24 months", "a three-month
    summary's totals are the sums of its months", "its categories add up to the totals, largest spent first".
- [x] 7. Name addMember's database handle
  - `ledgers/members.ts:8-9` `q` → `db`.
  - Proof: `members.int.test.ts`, `invites.int.test.ts`, `actualEnd.int.test.ts` (calls `addMember(db, …)`).
- [x] 8. Name the values in money, dates, config, migrate and admin
  - `money.ts:37` `divRound(a, b)` → `(numerator, divisor)`, its JSDoc `a / b` → `numerator / divisor`.
  - `dates.ts:11,16` `const d` → `const utcDate` (and its uses).
  - `config.ts:47` `(o)` → `(origin)`.
  - `migrate.ts:20` `(r)` → `(row)`; `:21` `(f)` → `(file)`.
  - `admin.ts:45` `(c, i)` → `(category, position)`, `(position + 1) * 10`.
  - Proof: `money.test.ts` "converts EUR to UAH, rounding half up"; `dates.test.ts` "accepts only real calendar
    dates", "adds days across month and year ends"; `config.test.ts` slice 1's case; `migrations.int.test.ts`;
    `auth.int.test.ts` "seeds the new ledger with 15 categories"; `categories.int.test.ts` "creates a category at the end of the month's list, at €0", "reuses the category a name has in any month, latest first" (sort orders 160/170 and 80).
  - Verify: `find-short-names.sh apps/api/src` prints "No single-letter names found." and exits 0.

Estimated size: ~75 changed lines (mechanical), largest slice 4 (~18).

## AC → evidence

| AC                                    | Evidence                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Script reports no lines (exit 0)      | `find-short-names.sh apps/api/src` after slice 8                                                                                  |
| `addMember`'s first param descriptive | slice 7 diff                                                                                                                      |
| base32 loop names char and value      | slice 3 diff; `totp.test.ts` "base32"                                                                                             |
| One commit per domain, renames only   | `git log` shows slices 2–8 one each; each diff is renames only                                                                    |
| Behaviour unchanged                   | gates green; existing test files unchanged (`git diff --stat origin/main -- apps/api/test` shows only `config.test.ts` additions) |
| Patch bump in both files              | slice 0                                                                                                                           |

## Not doing (YAGNI)

- Comparator/ternary rewrites in `compareCents` and `rankNames` (R4); extractions (R2, R3).
- SQL aliases, `catch (err)`, `_` args, generic type params (kept by §4).
- Vague but multi-letter names (`res`, `conn`, `body`, `v4`): not in the brief's list.
- `apps/mcp`, `apps/mobile`.

## Risks

- A rename swaps two names (comparator `left`/`right`, octets) — slices 3, 4, 6 via the order-asserting cases listed;
  the IPv4 octets in `ipKey` never reach the `/64` key, so a swap there is unobservable through `ipKey`, and the diff
  is checked by eye.
- CORS parse has no test today — slice 1 pins it before slice 8.

## Open questions

- no — `addMember`'s handle named `db` (it takes the pool or a transaction's connection, and both are queried the
  same way); alternative `executor` — assumption: `db`, matching `pruneThrottle(db: Db, …)`.
- no — top-level modules (`money`, `dates`, `config`, `migrate`, `admin`) share slice 8 as they belong to no domain —
  assumption: that meets "one commit per domain".

## Follow-ups

## Deviations

## Consolidate

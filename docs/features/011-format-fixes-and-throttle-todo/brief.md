# Formatting fixes and a throttle TODO

Type: fix

## Why

Two small formatting inconsistencies found while adding the app's unit tests (brief 010), and one known gap that should
be visible in the code:

- **`uah()` rounds negative halves toward zero.** `uah(63150)` is `₴632` but `uah(-63150)` is `−₴631`
  (`apps/mobile/src/format.ts`, `Math.round`). Nothing passes a negative hryvnia amount today, but the helper should be
  symmetric.
- **`shortDate` says "Sept".** `shortDate('2026-09-06')` gives "6 Sept 2026" on Node 24 (ICU's `en-GB` short month),
  while `dayLabel` says "SEP". What the device shows depends on its ICU data, so iOS and web can differ.
- **`login_throttle` rows are never deleted.** Every username, IP and device that ever failed a login keeps a row. Fine
  at our scale; not worth a job now, but it should be written down where the next person will see it.

## What

- `uah()` rounds halves away from zero, so negative amounts mirror positive ones: `uah(-63150)` → `−₴632`,
  `uah(-63149)` → `−₴631`. `eur()` is unchanged.
- `shortDate` always uses the three-letter month, independent of the platform's locale data: "6 Sep 2026",
  "29 Mar 2026". Other formatters stay as they are.
- A `TODO` comment where `login_throttle` rows are created (`apps/api/src/auth/throttle.ts`) saying rows are never
  pruned and what pruning would need (e.g. delete rows with no lock and no failure in the last N days).

## Acceptance criteria

- [ ] `yarn mobile test` has cases `uah(-63150)` → `−₴632`, `uah(-63149)` → `−₴631`, `uah(-50)` → `−₴1`, and they
      fail before the fix.
- [ ] `yarn mobile test` has `shortDate('2026-09-06')` → `6 Sep 2026` (fails before the fix on Node 24), plus the
      existing October and March cases still pass.
- [ ] The web build at 390×844 shows a September expense's date in the "1 € = … rate for 6 Sep 2026" line (or wherever
      `shortDate` appears) as "Sep".
- [ ] `throttle.ts` has the TODO comment; no behaviour change (API tests unchanged and green).
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Pruning `login_throttle` rows (a job, an endpoint or a migration).
- Changing any other date or money format, or localising the app.

## Notes

- Conventions §5 flags TODOs without an owner; write it as `TODO(dimuch): …` or follow whatever owner form the
  planner finds in the repo.

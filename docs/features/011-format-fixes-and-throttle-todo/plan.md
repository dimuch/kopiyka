# Plan: Formatting fixes and a throttle TODO

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/format-fixes-and-throttle-todo
Base: origin/main @ 41edcb7

## Approach

Three separate fixes, one commit each, about 30 changed lines in total.

- **`uah()`**: in `money()` (`apps/mobile/src/format.ts`), only the `'never'` branch changes. It becomes
  `Math.sign(cents) * Math.round(Math.abs(cents) / 100)`, so halves round away from zero. `eur()` uses `'auto'`, which
  keeps `cents / 100` and is not touched.
- **`shortDate()`**: build the label from parts, the way `dayLabel` already does:
  `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`. The `en-US` short month is
  "Sep" everywhere we run, while `en-GB` gives "Sept" on newer ICU builds. This also keeps the day–month order fixed,
  which matches the field-order note in `format.ts`.
- **TODO**: a `TODO(dimuch):` comment above the `INSERT … ON DUPLICATE KEY` in `throttledAttempt`
  (`apps/api/src/auth/throttle.ts`). That is the only place `login_throttle` rows are created.

Alternatives I ruled out:

- A month-name array `['Jan', …]` for `shortDate`. It doesn't depend on ICU at all, but `dayLabel` already relies on
  `en-US` `month: 'short'` on iOS and web. Using the same source keeps the two labels in step.
- `Intl.NumberFormat` with `roundingMode: 'halfExpand'`. Hermes support for it isn't verified, and the arithmetic is
  one line.

Checked in Node 24.21.0 (scratch script, outside the repo):

- Old `shortDate('2026-09-06')` gives "6 Sept 2026"; the new form gives "6 Sep 2026".
- Oct, Mar, Jun, Jul and Jan give the same text with both forms.
- `uah` old → new: −63150: −631 → −632; −63149: −631 → −631; −50: −0 (shown as "₴0") → −1; −49: −0 → −0 (shown as
  "₴0", because `value < 0` is false for −0); 0 and the positive cases don't change.

## Contracts

- DB: none
- API: none (comment only)
- App: none. The `uah(cents: number): string` and `shortDate(date: string): string` signatures stay the same; only
  their output changes, as above.
- New dependencies: none

## Slices

- [x] 1. Round negative hryvnia amounts away from zero like positive ones
  - Files: `apps/mobile/src/format.ts`, `apps/mobile/test/format.test.ts`
  - Change: the `'never'` branch of `money()` rounds the absolute value, then restores the sign. Update the `uah` JSDoc
    to say whole hryvnias, halves away from zero. Rename the test from "rounding half up" to "halves away from zero".
  - Tests: in the existing `uah` test, add `uah(-63150)` → `'−₴632'`, `uah(-63149)` → `'−₴631'`, `uah(-50)` → `'−₴1'`
    (the first and third fail before the fix), and `uah(-49)` → `'₴0'` as a guard against "−₴0". Write the test first
    and see it fail. (~8 lines)
- [x] 2. Show "Sep", not "Sept", in short dates on every platform
  - Files: `apps/mobile/src/format.ts`, `apps/mobile/test/format.test.ts`
  - Change: build `shortDate` from `getDate()`, the `en-US` short month and `getFullYear()`. Add a one-line comment
    on why: `en-GB` says "Sept" on newer ICU.
  - Tests: add `shortDate('2026-09-06')` → `'6 Sep 2026'` in the "labels months and days" test (fails before the fix
    on Node 24). The existing Oct and Mar cases stay. (~6 lines)
  - Verify: web build (launch configs `web` + `api`) at 390×844, signed in as the QA user. Open an expense dated in
    September (or pick a September date on the add-expense screen) and check that the rate line says "NBU official
    rate for … Sep 2026". If an expense was added, also check the "Added … · … Sep 2026" note.
- [x] 3. Note that login throttle rows are never pruned
  - Files: `apps/api/src/auth/throttle.ts`
  - Change: a `// TODO(dimuch):` comment, ~3 lines, above the `INSERT INTO login_throttle … ON DUPLICATE KEY UPDATE`
    in `throttledAttempt`. It should say:
    - Every attempt creates a row per username, IP and device, successful attempts included, and rows are never
      deleted.
    - Pruning would need a periodic delete of rows with no active lock (`locked_until` NULL or past) and no failure
      in the last N days, where N ≥ the 24 h `WINDOW_MS` so live counts aren't reset.
  - Tests: none new. The API unit and integration suites run unchanged and stay green. (~3 lines)

## AC → evidence

| AC                                                                     | Evidence                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `uah(-63150)`/`(-63149)`/`(-50)` cases exist and fail before the fix   | `format.test.ts`, the hryvnia test (slice 1); failing run seen before the `format.ts` change     |
| `shortDate('2026-09-06')` → `6 Sep 2026`; Oct and Mar cases still pass | `format.test.ts`, "labels months and days" (slice 2); failing run seen before the change         |
| Web at 390×844 shows "Sep" where `shortDate` appears                   | Manual web check in slice 2 (the expense screen's rate line), recorded in the PR test plan       |
| `throttle.ts` has the TODO; no behaviour change                        | Slice 3 diff is comment-only; `yarn test` API suites green and unchanged                         |
| All gates green                                                        | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each of the three commits |

## Not doing (YAGNI)

- Pruning `login_throttle` (job, endpoint or migration). The brief puts it out of scope.
- Changing `eur()` rounding or any other formatter (`dayLabel`, `monthName`), or adding a shared month-name table.
- An iPhone check. The AC asks for web; iOS uses the same `en-US` short month that `dayLabel` already shows correctly.

## Risks

- Hermes on iOS could return something other than "Sep" for `en-US` `month: 'short'`. Unlikely: `dayLabel` already
  depends on it and shows "SEP". If it ever did, a quick check on the iPhone after slice 2 would show it, but that
  check is optional.
- Float error in `Math.abs(cents) / 100` at .5: cents are integers, and n.5 is exact in binary, so there is none. The
  Node run above confirms it.

## Open questions

- Non-blocking: the brief says "Conventions §5 flags TODOs without an owner". It doesn't. Neither
  `kopiyka-conventions` nor `apps/mobile/AGENTS.md` mentions TODOs, and the repo has no `TODO(...)` in code today.
  Older docs mention a `TODO(lint)` that was later removed. Assumption: use `TODO(dimuch):` as the brief suggests.
- Non-blocking: the brief says rows exist for everyone who "ever failed a login". In fact the upsert runs on every
  attempt, so successful logins also create rows. Assumption: the TODO states the actual behaviour.

## Follow-ups

- None.

## Deviations

<filled by the developer during build>

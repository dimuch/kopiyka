# Kyiv dates and a derived amount on the expense screen

Type: fix

## Why

- **"Today", "Yesterday" and Home's starting month use device-local time** (`app/expense.tsx:62-65`,
  `app/index.tsx:16`, `format.ts:24-32,71-74`). They also use `Date` arithmetic, breaking the
  invariant that calendar dates are Kyiv `YYYY-MM-DD` (conventions §3). Outside Kyiv the chips
  and month are off around midnight. Everywhere, "Yesterday" is wrong 00:00–01:00 on the day
  after spring-forward.
- **The second currency field is derived state kept in sync by an effect** behind two lint
  suppressions (`expense.tsx:126-137`). When the rate for a newly picked date can't be fetched,
  that field keeps the previous date's conversion.
- **A third suppression** (`react-hooks/purity`, `expense.tsx:63-65`) hides an impure clock read
  during render.

Audit: `docs/audits/2026-10-architecture.md` M1–M3, M19, M20.

## What

- `format.ts` gets Kyiv date helpers mirroring `apps/api/src/dates.ts`:
  - `kyivToday()` and `kyivMonth()`, using `Intl.DateTimeFormat` with `timeZone: 'Europe/Kyiv'`;
  - `addDays(date, n)` on `YYYY-MM-DD` strings;
  - a string-based `shiftMonth`;
  - a `parseDate` used by `dayLabel`, `shortDate` and `DateField`.
- The expense screen reads the clock once and offers Today/Yesterday in Kyiv. Home starts on the
  current Kyiv month.
- The expense form keeps one typed amount plus the entered currency. The other field is computed
  during render by a pure `otherAmountText(text, entered, rate)` and is empty while no rate is
  known for the chosen date. Typing in either field still makes it the entered side.
- The amount fields are written out (UAH field, swap icon, EUR field) instead of
  `flatMap` + spread.

## Acceptance criteria

- [ ] `apps/mobile/src/app/expense.tsx` has no `eslint-disable` comments; `yarn lint` passes with the
      React Compiler rules unchanged.
- [ ] With the device timezone set to `America/New_York` at 20:00 local on 2026-10-07 (Kyiv already
      2026-10-08), the Today chip selects `2026-10-08` and Yesterday `2026-10-07`, and Home opens on
      October 2026. Verify in the web build by overriding the clock/timezone, and record how in the PR.
- [ ] `addDays('2026-03-30', -1) === '2026-03-29'`, `addDays('2026-12-31', 1) === '2027-01-01'`,
      `shiftMonth('2026-01', -1) === '2025-12'`. There's no app test runner, so put these in the PR
      test plan as checked expressions, or as a tiny script run with `tsx`.
- [ ] Typing `100` in UAH with a rate of 48.5 shows `2.06` in EUR. Switching to a date whose rate is
      unavailable clears the EUR field instead of keeping the old value. Typing in EUR then makes EUR the
      entered side.
- [ ] Editing an existing expense shows both stored amounts until the user types, and saving
      unchanged sends the entered-side amount exactly as stored.
- [ ] Saving still sends `{ amount, currency }` for the entered side only; the request body shape
      is unchanged.

## Out of scope

- Moving the screen's data loading into `data/` hooks (brief 004).
- Retry or error UI changes (brief 005).
- Adding a test runner to the app.
- Any API change.

## Notes

- Check that Hermes on iOS supports `Intl.DateTimeFormat` with `timeZone` for SDK 57 before
  relying on it (source-driven; see the Expo v57 docs).
- `convertPreview` stays as is; it's a display preview and the server re-prices.

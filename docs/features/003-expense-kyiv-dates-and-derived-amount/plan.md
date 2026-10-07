# Plan: Kyiv dates and a derived amount on the expense screen

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/expense-kyiv-dates-and-derived-amount
Base: origin/main (fdfaec2)

## Approach

Three commits, all in `apps/mobile`. Every slice below was drafted in a scratch copy of Base. Each passes
`tsc --noEmit`, `eslint` and Prettier, and the full draft was driven in headless Chrome 154 (see Risks).

1. **Kyiv dates** (`format.ts`): add `parseDate`, `addDays`, `kyivToday(now)` and `kyivMonth(now)`, and make
   `shiftMonth` string-based. `monthOf` and `dateOf` lose their last callers and go. The expense screen reads the clock
   once (`useState(() => kyivToday(new Date()))`), and Yesterday is `addDays(today, -1)`. Home starts on
   `kyivMonth(new Date())`. This drops the `react-hooks/purity` suppression. `dayLabel`, `shortDate` and `DateField`
   parse through `parseDate`.
2. **Mechanical**: the `flatMap` + spread amount row becomes UAH field, swap icon, EUR field. Both fields use a screen-local
   `AmountField`. No behaviour change.
3. **Derived amount**: the screen keeps `amountText` (what was typed) and `entered`. The other field is computed in render
   by `otherAmountText(amountText, entered, rateForThisDate)`. This removes the syncing effect and its two suppressions.
   Editing keeps the stored other-side amount in `storedOther` until the user types an amount or picks a date.

`kyivToday` doesn't copy the API's `new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)`. On Hermes iOS that
format's field order comes from the OS locale data. CLDR 42 wrote en-CA dates as `M/d/y`; it became `y-MM-dd` in
43+ (checked in `cldr-json`). Instead, three `en-US` formatters each print one field (`year`, `month: '2-digit'`,
`day: '2-digit'`), so no locale pattern decides the order.

Alternative considered: `formatToParts`. Hermes V1 implements it on Apple, but `doc/IntlAPIs.md` at the shipped tag
doesn't list it as supported. `format` is listed, so the plan uses only `format`.

## Contracts

- DB: none. API: none.
- App, `apps/mobile/src/format.ts`:
  ```ts
  /** Local noon of a 'YYYY-MM-DD' date, only to display it or seed the picker; noon stays on that day across DST. */
  export function parseDate(date: string): Date;
  /** Shifts a 'YYYY-MM-DD' date by whole days; UTC arithmetic has no DST gaps. */ // same body as apps/api/src/dates.ts
  export function addDays(date: string, days: number): string;
  /** The 'YYYY-MM-DD' date in Kyiv at `now`, whatever the device's time zone. */
  export function kyivToday(now: Date): string;
  /** The 'YYYY-MM' month in Kyiv at `now`. */
  export function kyivMonth(now: Date): string; // kyivToday(now).slice(0, 7)
  /** 'YYYY-MM' moved by `by` months ('2026-01', -1 → '2025-12'). */
  export function shiftMonth(month: string, by: number): string; // same signature, month-index arithmetic, no Date
  /** The other currency's field for `text` typed in `entered`: '' while the amount is invalid or no rate is known. */
  export function otherAmountText(text: string, entered: 'EUR' | 'UAH', rate: number | null): string;
  // = normalizeAmount(text) && rate ? centsToInput(convertPreview(toCents(amount), entered, rate)) : ''
  ```
  - Removed: `monthOf` and `dateOf`. After slice 1 they have no callers; `rg -n "monthOf|dateOf" apps/mobile` finds only
    `format.ts`, `index.tsx` and `expense.tsx` on Base.
  - A private `kyivFormat(options)` builds `new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/Kyiv' })`. On a
    `RangeError` it uses `'Europe/Kiev'` instead (see Risks).
- App, `DateField` props: unchanged. Its `toDate` is replaced by `parseDate`; `toValue` stays.
- App, `expense.tsx`:
  - `function AmountField(props: { currency: Currency; value: string; onChangeText: (text: string) => void })`, with two
    callers. It is module-level in `expense.tsx`, below `ExpenseScreen`, and not nested inside it: a nested component would
    be a new type on every render and remount the inputs on each keystroke.
  - State: `amountText`, `entered` and `storedOther: string | null` replace `uahText` / `eurText`.
  - The field values are `entered === cur ? amountText : otherText`, where
    `otherText = storedOther ?? otherAmountText(amountText, entered, rate?.date === date ? rate.value : null)`.
  - `typeAmount(cur, text)` sets `entered`, clears `storedOther` and calls `edit(setAmountText, text)`.
  - `pickDate(d)` clears `storedOther` and calls `edit(setDate, d)`. It is used by `DateField` and both chips.
  - When editing, the load sets `amountText` to the entered side's stored string and `storedOther` to the other side's.
  - After Add, `setAmountText('')` replaces Base's `setUahText('')` / `setEurText('')` (`expense.tsx:168-169`).
    `storedOther` is already `null` when creating.
  - Request body unchanged: `{ categoryId, expenseDate, name, amount: normalizeAmount(amountText), currency: entered }`.
    The API stores amounts as `DECIMAL(…,2)` strings (`'100.00'`, ≤ 8 whole digits by `AMOUNT_RE`), and
    `normalizeAmount('100.00') === '100.00'`, so an unchanged save sends the stored string.
- New dependencies: none. The check script runs with `tsx`, already a devDependency of `@kopiyka/api` (`yarn api tsx`).

## Slices

- [x] 1. Use Kyiv dates for Today, Yesterday and Home's month
  - Files: `apps/mobile/src/format.ts`, `apps/mobile/src/app/expense.tsx`, `apps/mobile/src/app/index.tsx`,
    `apps/mobile/src/components/DateField.tsx`
  - Change: the date contracts above. In `expense.tsx`, lines 62-65 become one `useState` clock read plus `addDays`. A
    why-comment says the chips are Kyiv dates like the NBU rates. `index.tsx:16` uses `kyivMonth`.
  - Verify:
    - The check command below prints `format.ts checks passed` under `TZ=America/New_York`. Run it once on Base first. It
      fails there: the missing exports are `undefined`, so the first call throws
      (`TypeError: (0 , import_format.addDays) is not a function`, verified). On Base, `dateOf` also gives `2026-10-07`
      for the same instant (Prove-It, see Risks).
    - In-app browser, timezone procedure below: Home shows "October", Add expense shows `2026-10-08` with Today on, and
      Yesterday gives `2026-10-07`.
    - The category screen's day headers (`dayLabel`) and the date picker look unchanged at 390×844.
  - Est. ~82 lines (measured on the draft).
- [x] 2. Write out the two amount fields instead of building them in a loop
  - Files: `apps/mobile/src/app/expense.tsx`
  - Change: the mechanical part only. Add `AmountField`, and lay out `<AmountField UAH/> <swap/> <AmountField EUR/>` with
    the same handlers as today. The labels, `nativeID`, `accessibilityLabel`, `keyboardType` and styles are unchanged.
  - Verify: in the in-app browser at 390×844, a screenshot of the amount row before and after is identical. Typing 100 in
    UAH still fills EUR, and typing in EUR still fills UAH.
  - Est. ~70 lines.
- [ ] 3. Compute the other currency's amount instead of syncing it
  - Files: `apps/mobile/src/format.ts`, `apps/mobile/src/app/expense.tsx`
  - Change: add `otherAmountText`, and make the state and handler changes in Contracts. Delete the effect at lines 126-137
    with its two suppressions, and drop the now-unused `centsToInput` and `convertPreview` imports from the screen.
  - Verify:
    - The check command below (its `otherAmountText` lines).
    - `rg -n "eslint-disable" apps/mobile/src/app/expense.tsx` finds nothing.
    - In-app browser, with snippets B and A below:
      - Today, type 100 UAH: EUR shows `2.06`.
      - Tap Yesterday (503 there): EUR is empty and the label says the rate isn't available.
      - Tap Today: EUR shows `2.06` again.
      - Type 10 in EUR: UAH shows `485.00`, and saving POSTs `currency: 'EUR'`. Under the fake clock the POST carries
        `expenseDate: '2026-10-08'`, so the real API may refuse it. It answers `503 rate_unavailable` if the NBU hasn't
        published that day's rate yet, and `400 date_in_future` only if the real Kyiv date is before 2026-10-07 (the
        horizon is Kyiv tomorrow). That isn't a regression: `window.__sent` logs the body before the response.
      - Open an existing expense: both stored amounts show, even though the stubbed 48.5 would give another value.
      - Tap Update without changes: `window.__sent` shows the PUT body `amount` equal to the GET's entered-side string,
        with `currency` equal to `enteredCurrency`, and keys exactly `categoryId, expenseDate, name, amount, currency`.
  - Est. ~67 lines.

Total ≈ 220 changed lines in 3 commits, so no split is needed. Each commit passes
`yarn format:check && yarn lint && yarn typecheck && yarn test`.

### Check command (AC3, repeatable, nothing added to the repo)

Run from the repo root. It goes in the PR test plan with its output:

```bash
TZ=America/New_York yarn api tsx -e "
import assert from 'node:assert/strict';
import { addDays, kyivMonth, kyivToday, otherAmountText, shiftMonth } from '../mobile/src/format.ts';
const at = new Date('2026-10-08T00:00:00Z'); // 20:00 on 7 Oct in New York = 03:00 on 8 Oct in Kyiv
assert.equal(new Date(2026, 9, 7, 20).getTime(), at.getTime()); // the process really runs in New York time
assert.equal(addDays('2026-03-30', -1), '2026-03-29');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
assert.equal(shiftMonth('2026-01', -1), '2025-12');
assert.equal(kyivToday(at), '2026-10-08');
assert.equal(addDays(kyivToday(at), -1), '2026-10-07');
assert.equal(kyivMonth(at), '2026-10');
assert.equal(kyivToday(new Date('2026-03-29T21:30:00Z')), '2026-03-30'); // 00:30 Kyiv, the day after spring-forward
assert.equal(otherAmountText('100', 'UAH', 48.5), '2.06'); // 10000 * 10000 / 485000 = 206.19 → 206 cents
assert.equal(otherAmountText('100', 'UAH', null), '');
console.log('format.ts checks passed');
"
```

Slice 1 runs it without the two `otherAmountText` lines; slice 3 runs it in full. On the draft it passes. On Base,
`TZ=America/New_York` gives `dateOf(at) === '2026-10-07'`. With `TZ=Europe/Kyiv` at `2026-03-29T21:30:00Z`, Base's
Yesterday is `2026-03-28` (both verified).

### Timezone and clock override in the in-app browser (AC2, and the rate cases of AC4)

Start launch configs `api` and `web` (`preview_start`), sign in and `preview_resize` to 390×844. Then `preview_eval`:

- **Snippet B (rates stub and request log):** only for slice 3. Evaluate it first, because snippet A keeps it.

  ```js
  (() => {
    const realFetch = window.fetch;
    window.__sent = [];
    window.fetch = (url, init = {}) => {
      const u = new URL(String(url));
      if (init.method && init.method !== 'GET')
        window.__sent.push({ method: init.method, path: u.pathname, body: init.body });
      if (u.pathname !== '/api/rates/eur-uah') return realFetch(url, init);
      const none = u.searchParams.get('date') === '2026-10-07';
      const body = none ? { error: 'rate_unavailable', reason: 'no_rate' } : { eurUah: 48.5 };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: none ? 503 : 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    };
  })();
  ```

- **Snippet A (fake clock, New York as the default zone, app boot):**

  ```js
  (async () => {
    const at = Date.parse('2026-10-08T00:00:00Z'); // 20:00 on 7 Oct in New York (EDT) = 03:00 on 8 Oct in Kyiv (EEST)
    const RealDate = Date,
      RealDTF = Intl.DateTimeFormat,
      t0 = RealDate.now();
    const now = () => at + (RealDate.now() - t0);
    globalThis.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [now()]));
      }
      static now() {
        return now();
      }
    };
    Intl.DateTimeFormat = Object.assign(
      function (locales, options) {
        return new RealDTF(locales, { timeZone: 'America/New_York', ...options });
      },
      { prototype: RealDTF.prototype, supportedLocalesOf: RealDTF.supportedLocalesOf },
    );
    // Boot the app again in this same window (keeps the patches): fresh DOM, bundle re-run.
    const html = await (await fetch(location.href)).text();
    document.open();
    document.write(html);
    document.close();
  })();
  ```

- **Probe:** `preview_eval` of `new Date().toISOString()` gives `2026-10-08T00:00:…Z`, and
  `Intl.DateTimeFormat().resolvedOptions().timeZone` gives `America/New_York`.
- **Then check:** Home's header shows "BUDGET ’26 / October". Add expense shows the web date input at `2026-10-08`, with
  the Today chip highlighted (screenshot). Tapping Yesterday gives `2026-10-07`.

`aria-selected` isn't rendered (see Follow-ups), so "selected" is read from the date input value plus the screenshot.

Limit, recorded in the PR: JS can't move `Date`'s local getters (`getDate`…) off the host zone. The new code never reads
them for these values. The real-device-zone evidence is the `TZ=America/New_York` check command, which uses the engine's
real zone.

## AC → evidence

| AC                                                                                                      | Evidence                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `expense.tsx` has no `eslint-disable`; lint passes with React Compiler rules unchanged                  | `rg -n "eslint-disable" apps/mobile/src/app/expense.tsx` is empty after slice 3; `yarn lint` on every commit; `eslint.config.js` untouched |
| New York 20:00 on 7 Oct: Today `2026-10-08`, Yesterday `2026-10-07`, Home October 2026                  | Snippet A in the in-app browser (slice 1); check command `kyivToday` / `kyivMonth` lines under `TZ=America/New_York` (slice 1)             |
| `addDays('2026-03-30', -1)`, `addDays('2026-12-31', 1)`, `shiftMonth('2026-01', -1)`                    | Check command, output pasted in the PR test plan (slice 1)                                                                                 |
| 100 UAH at 48.5 → `2.06`; a rate-less date clears EUR; typing in EUR makes EUR entered                  | Check command `otherAmountText` lines; snippets B + A walk-through (slice 3)                                                               |
| Editing shows both stored amounts until the user types; an unchanged save sends the stored entered side | Slice 3 walk-through: stored values shown despite the 48.5 stub; `window.__sent` PUT `amount` equals the GET's entered-side string         |
| Body shape still `{ amount, currency }` for the entered side only                                       | `window.__sent` POST and PUT bodies have exactly `categoryId, expenseDate, name, amount, currency` (slice 3)                               |

## Not doing (YAGNI)

- Data loading into `data/` hooks (brief 004), retry/error UI (brief 005), an app test runner, any API change.
- Using `parseDate` in `monthName` (`category/[categoryId].tsx` and `index.tsx` show month names). The brief names only
  `dayLabel`, `shortDate` and `DateField`; `monthName` is display-only and correct in any zone.
- Moving `AmountField` to `components/`: it has callers only on this screen.
- Refreshing Today when the screen stays open across Kyiv midnight. The brief asks for one clock read; reopening the
  screen picks up the new day.
- Changing `convertPreview` (the brief's Notes).

## Risks

- **iOS Hermes formatting.** RN 0.86 builds Hermes V1 by default: `react_native_pods.rb:99-101`, version
  `250829098.0.17` in `sdks/.hermesv1version`.
  - Hermes `doc/IntlAPIs.md` at tag `hermes-v250829098.0.17` lists `DateTimeFormat.prototype.format` as supported on iOS. The
    only unsupported iOS properties are `numberingSystem` and `formatMatcher`; `timeZone` isn't among them.
  - `lib/Platform/Intl/PlatformIntlApple.mm` at that tag:
    - validates `timeZone` through `NSTimeZone` (lines 1452-1479) and sets it on the `NSDateFormatter` (1779-1780);
    - builds a template from the field options and passes it to `setLocalizedDateFormatFromTemplate` (1928). The per-field
      formatters make that order irrelevant.
  - Expo SDK 57 requires iOS 16.4+ (docs.expo.dev/versions/v57.0.0).
  - Not provable here: the real iPhone output. The PR test plan asks the user to check on the iPhone that Today matches
    the Kyiv date (and Home's month). It doesn't claim this check.
- **`'Europe/Kyiv'` unknown to a runtime.** It was added in tzdata 2022b. Node 24 (ICU 78) and Chrome 154 accept it;
  for iOS 16.4's tz data I found no source. The formatters are built at module load, so a `RangeError` would crash the
  app on import. `kyivFormat` therefore retries with `'Europe/Kiev'`, the link name that every tzdata version
  has (5 lines). Slice 1's check command exercises the main path; the fallback path is only reachable on old tz data.
- **Snippet A's reboot.** The HTML spec has `document.open()` keep the same Window, which is verified in headless
  Chrome 154. There, against a scratch copy of the draft with the API stubbed, the app re-booted under the patches:
  - Home showed October;
  - the chips gave `2026-10-08` / `2026-10-07`;
  - 100 UAH → `2.06`, the rate-less date gave an empty EUR, and 10 EUR → `485.00`;
  - edit showed `100.00` / `2.06`, and the unchanged PUT sent `amount: '100.00', currency: 'UAH'`;
  - no exceptions were logged.

  Slice 1 proves it in the in-app browser. If the in-app browser has no `preview_eval`, or the reboot fails:
  - evaluate snippet A without its last two lines, then tap Add expense (the screen mounts fresh, so the chips are still
    checked);
  - for Home's month, rely on the `kyivMonth` check-command line and say so in the PR.

## Open questions

- Blocking: no. While editing, picking another date drops the stored other-side amount. It is then derived from the new
  date's rate, or empty without one, consistent with AC4. Assumption: yes. The alternative is to keep it until the
  amount is typed, which would show an amount priced at a different date.
- Blocking: no. The brief writes `kyivToday()` / `kyivMonth()`; the plan uses `kyivToday(now: Date)`, like
  `apps/api/src/dates.ts`. Conventions §1 says the clock is passed in, and the check command needs a fixed instant.
- Blocking: no. The `'Europe/Kiev'` fallback (see Risks). Drop it if you'd rather not carry it without proof that an
  iOS 16.4+ device lacks `Europe/Kyiv`.
- Blocking: no. Today and Yesterday are now fixed when the expense screen opens. Before, a re-render after midnight
  moved them. Assumption: that's what "reads the clock once" means.
- Blocking: no. `docs/audits/2026-10-architecture.md`, cited by the brief, isn't in the repo at Base. The cited lines
  were checked against the code instead (`expense.tsx:62-65`, `126-137`; `index.tsx:16`; `format.ts:24-32,71-74`; all
  match).

## Follow-ups

- On web, `accessibilityState={{ selected }}` on the date chips and category tiles renders no `aria-selected`. This was
  observed in the headless Chrome run of the draft. Screen-reader users on web can't tell which chip or category is
  on; the likely fix is the `aria-selected` prop.
- `data/useMonth.ts:32` keeps an `exhaustive-deps` suppression; brief 004 moves that loading anyway.

## Deviations

<filled by the developer during build>

## Revision 1

From the skeptic's APPROVE, optional suggestions:

- Slice 1 Verify now says how the check command fails on Base (`TypeError … is not a function`, verified).
- Contracts say `AmountField` is module-level below `ExpenseScreen`, and that after Add the screen calls
  `setAmountText('')`.
- Slice 3 notes that the POST under the fake clock may be refused by the real API. The skeptic suggested
  `400 date_in_future`, but the rate horizon is Kyiv tomorrow, so on 2026-10-07 the likely answer is
  `503 rate_unavailable`. Either way `window.__sent` still holds the body.
- The `'Europe/Kiev'` fallback stays an open question for the user.

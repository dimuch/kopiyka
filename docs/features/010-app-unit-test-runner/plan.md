# Plan: App unit test runner

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/app-unit-test-runner
Base: origin/main@91f96ca

## Approach

Add Vitest 4 to `@kopiyka/mobile` as a dev dependency, at the same `^4.0.0` range the API uses (yarn.lock already
resolves it to 4.1.11 and hoists it to the root `node_modules`). Add a three-line `vitest.config.mts` that resolves
`@/…` from `tsconfig.json` with Vite 8's built-in `resolve.tsconfigPaths`, so there's no new plugin and no second copy
of the alias. Root `yarn test` becomes `yarn workspaces foreach -A run test`, the same shape as `lint`/`typecheck`.
CI already runs `yarn test`, so it picks up the app tests without a workflow edit. The tests go in
`apps/mobile/test/`, one file per module, written as tables in the `money.test.ts`/`dates.test.ts` style. Time only
enters through `kyivToday(now)`/`kyivMonth(now)`, so a fixed `Date` argument is the "fixed clock" and there are no
fake timers.

Brief 009 isn't merged, so its link-param parsers aren't covered here. 009 must add their tests (see Follow-ups).

Alternative considered: `resolve.alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }`. It's just as small,
but it duplicates `tsconfig.json`'s `paths` and needs `node:url` in a file the Expo tsconfig type-checks.
`tsconfigPaths` covers it in one line and keeps a single source of truth. `vite-tsconfig-paths` isn't needed with
Vite 8.

### Facts verified on Base (scratch copy of `format.ts`, `data/*.ts`, `api/types.ts` + the app's tsconfig/eslint config, repo `node_modules`)

- **No RN/Expo imports.** `format.ts` imports nothing. `data/monthSummary.ts` imports `type { Expense }` from
  `@/api/types` and `toCents` from `@/format`, and `data/quick.ts` imports `type { Category }`. `api/types.ts` has no
  imports. Vitest's default `node` environment loads all three.
- **Alias.** `tsconfig.json` has `paths: { "@/*": ["./src/*"] }` and extends `expo/tsconfig.base`. With
  `resolve: { tsconfigPaths: true }`, `import … from '@/format'` resolves under Vitest 4.1.11 / Vite 8.3.2.
- **Config file name.** The app's `package.json` has no `"type": "module"` (and `eslint.config.js` uses `require`). In
  that setup a `vitest.config.ts` works but prints Vite 8's "ESM syntax in a file loaded as CommonJS… use a `.mjs`
  extension" warning on every run. `vitest.config.mts` runs without the warning and is picked up automatically.
- **Typecheck.** The app's tsconfig has no `include`, so `tsc --noEmit` picks up `test/**/*.ts` and
  `vitest.config.mts` (checked with `--listFilesOnly`), and both compile clean. `vitest` types resolve from the hoisted
  root `node_modules`.
- **Lint.** `eslint-config-expo` lints `test/*.test.ts` (0 problems, `import/no-unresolved` included). But `expo lint`
  with no arguments only lints `src`, `app` and `components` (`DEFAULT_INPUTS` in
  `node_modules/@expo/cli/build/src/lint/lintAsync.js`), so `test` must be passed as an explicit input. The config has
  no `*.mts` glob, so the 3-line config file is type-checked but not linted. See Open questions.
- **Root script.** In Yarn 4.18.1, `foreach run` skips workspaces without the script ("Excluding … because it doesn't
  have a "test" script"). It also skips the calling workspace when the script name equals `npm_lifecycle_event`,
  which is the same guard that already makes the root `lint`/`typecheck` work.
- **Time zones.** Node 24 (CI uses `.nvmrc` → 24) ships full ICU (78.3, tz 2026c here). Every value in the slices
  below was computed under `TZ=UTC`, `Europe/Kyiv`, `America/Santiago`, `Pacific/Kiritimati` (+14) and
  `Pacific/Pago_Pago` (−11), and all of them matched. `kyivToday` formats in `Europe/Kyiv` explicitly. `monthName`,
  `dayLabel` and `shortDate` build and format a local `Date` (midnight on the 1st, or noon via `parseDate`) in the
  same machine zone, so the calendar fields round-trip whatever `TZ` is. The CI runner's zone doesn't matter.
- **ICU caveat.** `toLocaleDateString('en-GB', { month: 'short' })` gives `Sept` for September on ICU 78
  (`shortDate('2026-09-29')` → `29 Sept 2026`), while en-US gives `Sep`. Tests avoid September in `shortDate` so
  they don't depend on the ICU version (see Follow-ups).

## Contracts

- DB: none
- API: none
- App: no source changes. New script `@kopiyka/mobile` → `"test": "vitest run"`. New file
  `apps/mobile/vitest.config.mts`:
  `defineConfig({ resolve: { tsconfigPaths: true }, test: { include: ['test/**/*.test.ts'] } })`, with a why-comment
  on `tsconfigPaths` ("resolve `@/…` like Metro, from tsconfig paths"). `@kopiyka/mobile` `lint` script: `expo lint` →
  `expo lint src test` (expo lint defaults to src/app/components only).
- Root: `"test": "yarn workspaces foreach -A run test"` (was `yarn workspace @kopiyka/api test`).
- New dependencies: `vitest@^4.0.0` as a dev dependency of `@kopiyka/mobile`, added with
  `yarn workspace @kopiyka/mobile add -D vitest@^4.0.0`. The AC needs it. It's the version already in the monorepo,
  it isn't in the app bundle (dev only), and it isn't an Expo native module, so `expo install` isn't needed.
  yarn.lock only gains the workspace's dependency entry; the resolution stays 4.1.11.

## Slices

All test expectations below were computed by running the current modules (see Facts). Arithmetic goes in comments,
as in `money.test.ts`.

- [x] 1. Run the app's unit tests with Vitest, starting with amount helpers (~75 lines + yarn.lock)
  - Files: `apps/mobile/package.json`, `yarn.lock`, `apps/mobile/vitest.config.mts`, `package.json` (root `test`),
    `apps/mobile/test/format.test.ts` (new, `describe('format: amounts')`)
  - Change: add the dev dependency, the `test` script, the config and the root `foreach` script, and change the `lint`
    script to `expo lint src test`. A test must exist in this slice, because `vitest run` with no files exits 1.
  - Tests (`format.test.ts`, imports from `@/format`):
    - `toCents`: `'12.5'`→1250, `'7'`→700, `'0.05'`→5, `'12.50'`→1250, `'1234.56'`→123456, `'-3.05'`→−305,
      `'-0.50'`→−50.
    - `normalizeAmount`: ok `'12,5'`→`'12.50'`, `' 7 '`→`'7.00'`, `'007.5'`→`'7.50'`, `'12.'`→`'12.00'`,
      `'0.01'`→`'0.01'`, `'99999999.99'`→same. null for `'0'`, `'0.00'`, `'1.234'`, `'123456789'`, `'-1'`,
      `'abc'`, `''`, `'.5'`, `'1,5,0'`.
    - `eur`: 151500→`€1,515`, 1250→`€12.50`, 5→`€0.05`, 0→`€0`, 100→`€1`, 123456789→`€1,234,567.89`,
      −305→`−€3.05` (U+2212).
    - `uah`: whole hryvnias rounded half up. 63104→`₴631`, 63149→`₴631`, 63150→`₴632`, 49→`₴0`, 50→`₴1`,
      12345678→`₴123,457`. No negative half case (see Follow-ups).
    - `convertPreview`, rounding half up like the API's `convert`: (1250, EUR, 50.483)→63104 (12.50 × 50.4830 =
      631.0375); (1, EUR, 50.005)→50; (100000, UAH, 50.483)→1981 (1000 / 50.4830 = 19.8086…); (2500, UAH, 50)→50;
      (25, UAH, 50)→1 (0.005 half up).
    - `centsToInput`: 1250→`'12.50'`, 5→`'0.05'`, 0→`'0.00'`, 100000→`'1000.00'`.
    - `otherAmountText`: (`'12,5'`, EUR, 50.483)→`'631.04'`; (`'1000'`, UAH, 50.483)→`'19.81'`; `''` for `'abc'`,
      for a `null` rate, and for `'0'`.
  - Verify: `yarn mobile test` passes. Change one expected value and check that `yarn mobile test; echo $?` prints 1
    and root `yarn test; echo $?` is non-zero. Revert. Root `yarn test` output shows both the API run and the app
    run. Add a temporary lint error in `test/format.test.ts` and check that `yarn mobile lint; echo $?` is non-zero.
    Revert. Run the full gates without pipes (no `tail`/`grep`), checking `$?` directly.

- [ ] 2. Test the app's Kyiv date and month helpers (~70 lines)
  - Files: `apps/mobile/test/format.test.ts` (adds `describe('format: dates')`)
  - Tests:
    - `parseDate('2026-03-29')`: local year 2026, month index 2, date 29, hour 12 (noon on a DST-switch day).
    - `addDays`: (`'2026-10-01'`, −1)→`'2026-09-30'`, (`'2026-12-31'`, 1)→`'2027-01-01'`, (`'2028-02-28'`,
      1)→`'2028-02-29'`, (`'2026-03-01'`, −1)→`'2026-02-28'`, (`'2026-03-28'`, 1)→`'2026-03-29'`.
    - `kyivToday` at a fixed `Date`, with comments giving the Kyiv local time:
      - Winter (UTC+2): `2026-01-15T21:59:59Z`→`'2026-01-15'`, `22:00:00Z`→`'2026-01-16'`.
      - Spring switch (29 Mar 2026, 01:00Z, 03:00→04:00 Kyiv): `2026-03-28T21:59:59Z`→`'2026-03-28'`,
        `2026-03-28T22:00:00Z`→`'2026-03-29'`, `2026-03-29T00:59:59Z` and `01:00:00Z`→`'2026-03-29'`,
        `2026-03-29T20:59:59Z`→`'2026-03-29'`, `21:00:00Z`→`'2026-03-30'`.
      - Autumn switch (26 Oct 2025, 01:00Z, 04:00→03:00 Kyiv): `2025-10-25T20:59:59Z`→`'2025-10-25'`,
        `2025-10-25T21:00:00Z`→`'2025-10-26'`, `2025-10-26T21:59:59Z`→`'2025-10-26'`,
        `2025-10-26T22:00:00Z`→`'2025-10-27'`.
    - `kyivMonth`: `2026-12-31T21:59:59Z`→`'2026-12'`, `2026-12-31T22:00:00Z`→`'2027-01'`.
    - `shiftMonth`: (`'2026-01'`, −1)→`'2025-12'`, (`'2026-12'`, 1)→`'2027-01'`, (`'2026-10'`, 0)→`'2026-10'`,
      (`'2026-03'`, −15)→`'2024-12'`, (`'2026-10'`, 14)→`'2027-12'`.
    - `monthName('2026-02')`→`'February'`; `monthLabel('2026-10')`→`'October 2026'`;
      `dayLabel('2026-09-29')`→`'TUE 29 SEP'`, `dayLabel('2027-01-01')`→`'FRI 1 JAN'`;
      `shortDate('2026-10-06')`→`'6 Oct 2026'`, `shortDate('2026-03-29')`→`'29 Mar 2026'`.
  - Verify: `yarn mobile test` passes, and also with `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`
    (`TZ=… yarn mobile test`). This shows the results don't depend on the machine zone.

- [ ] 3. Test month summaries and the quick category row (~80 lines)
  - Files: `apps/mobile/test/monthSummary.test.ts`, `apps/mobile/test/quick.test.ts` (new)
  - Tests:
    - `monthSummary.test.ts` uses a local `expense(id, categoryId, expenseDate, amountEur, amountUah)` fixture that
      returns a full `Expense` from `@/api/types`.
      - `sumCents`: `[]`→0. EUR over `'12.50'`, `'0.05'`, `'7'`→1955. The `amountUah` field sums the UAH column.
        `'0.10'` + `'0.20'`→30 exactly (cents, not floats).
      - `spentByCategory`: two categories accumulate their EUR cents, a category without expenses is absent, and
        `[]`→empty map.
      - `groupByDay`: days come in first-seen order (newest first, as the API sends them), items keep the given
        order, each day's `totalCents` is its EUR sum, and `[]`→`[]`.
    - `quick.test.ts` uses a local `category(id, sortOrder)` fixture.
      - `withQuick`: id already present → unchanged (`[3, 1]`, 1 → `[3, 1]`). New id with room → appended
        (`[1, 2]`, 9 → `[1, 2, 9]`; `[]`, 9 → `[9]`; one spot left: `[1, 2, 3, 4]`, 9 → `[1, 2, 3, 4, 9]`). Row full → takes the last spot (`[1, 2, 3, 4, 5]`, 9 →
        `[1, 2, 3, 4, 9]`).
      - `splitQuick`: `quick` follows the quick-row order, not `categories` order. An id missing from `byId` is
        dropped. A hidden category that is in `byId` but not in `categories` still appears in `quick`. `more` is
        `categories` minus the quick ids, in `categories` order.
  - Verify: `yarn mobile test` passes. The gates pass.

- [ ] 4. Document the app test runner in conventions and README (~10 lines)
  - Files: `.claude/skills/kopiyka-conventions/SKILL.md`, `README.md`, `.claude/skills/kopiyka-develop/SKILL.md`
  - Change:
    - Conventions §6 "App" bullet: Vitest (`yarn mobile test`, tests in `apps/mobile/test/`, Node environment, `@/`
      alias) for pure modules in `format.ts`/`data/`, table cases, and a fixed `Date` passed in where time matters.
      UI is still verified in the web build at phone width and on iPhone, plus typecheck and lint. The "Bug fix →
      test… where a runner exists" bullet now covers app pure logic too.
    - §7 `yarn test` comment: "API unit + MySQL integration when DATABASE_URL_TEST is reachable, and app unit
      tests". §8a `vitest` row: "Vitest tests (API, app)".
    - README "Tests": add `yarn mobile test  # app unit tests (pure helpers)` and `yarn test  # both`.
    - `kopiyka-develop` step 4 (line 38): add `yarn mobile test <file>` next to `yarn api test <file>`.
  - Verify: `yarn format:check` passes. Read the diff back against what slices 1–3 built.

Total: about 235 changed lines without yarn.lock. Each slice is under 150.

## AC → evidence

| AC                                                                             | Evidence                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn mobile test` runs the app tests, non-zero on failure                     | Slice 1 verify: a temporarily broken expectation makes `yarn mobile test; echo $?` print 1. Reverted before commit. Recorded in the PR test plan.                                                                                                                          |
| Root `yarn test` runs API and app tests; CI green without workflow edits       | Slice 1 verify: root `yarn test` shows both runs and is non-zero with the broken case. CI green on the PR, and `git diff origin/main -- .github` is empty.                                                                                                                 |
| Tests for every exported function, table style, fixed clock where time matters | `format.test.ts` covers all 16 exports of `format.ts`: amounts (slice 1) and dates (slice 2, with a fixed `Date` passed to `kyivToday`/`kyivMonth`). `monthSummary.test.ts` covers all 3 exports and `quick.test.ts` covers both (slice 3).                                |
| `@/` alias works; no RN/Expo runtime                                           | Every test imports from `@/format` / `@/data/…`. The config uses Vitest's default `node` environment, with no RN/Expo mocks or setup file.                                                                                                                                 |
| Format/lint/typecheck green; test files linted and type-checked                | Gates pass on every slice. Slice 1 verify: `cd apps/mobile && npx tsc --noEmit --listFilesOnly` lists `test/format.test.ts` and `vitest.config.mts`. Slice 1 verify: a temporary lint error in `test/format.test.ts` makes `yarn mobile lint; echo $?` non-zero. Reverted. |
| Conventions §6 "App" updated                                                   | Slice 4 diff.                                                                                                                                                                                                                                                              |

## Not doing (YAGNI)

- Tests for 009's link-param parsers: 009 isn't merged, and it must add them (see Follow-ups).
- A `test:watch` script (`yarn mobile vitest` already works), coverage, a setup file, `vite-tsconfig-paths`,
  jsdom/RNTL, and any component or hook tests.
- Linting `vitest.config.mts` by adding an `*.mts` glob to `eslint.config.js`: it would be a config change for a
  3-line file that `tsc` already checks.
- Pinning `TZ` in the Vitest config: the outputs are zone-independent (verified), and a pinned zone would hide a real
  regression.
- Fixing anything the tests reveal (see Follow-ups). The tests assert current, intended behaviour.

## Risks

- Vite's `resolve.tsconfigPaths` might not follow `extends: "expo/tsconfig.base"` or `${configDir}` in the real
  workspace the way it did in the scratch copy. Slice 1 settles this: if `@/format` doesn't resolve, fall back to
  `resolve.alias` (the alternative above) and record a Deviation.
- Adding `vitest` to the mobile workspace might make Yarn un-hoist or duplicate it. Slice 1 checks that `yarn.lock`
  still has a single `vitest@npm:^4.0.0` → 4.1.11 entry and that `yarn install --immutable` passes after the commit
  (as CI runs it).
- tzdata/ICU drift: if Ukraine's DST rules change in tzdata, the DST cases would fail on a newer Node. That's
  acceptable, because it's exactly what they're there to catch. Both switches tested (26 Oct 2025, 29 Mar 2026) are
  already in the past, so a future rule change wouldn't rewrite them; only a retroactive tzdata fix would. CI's Node 24 bundles full ICU, the same as local.
- Root `foreach` output or ordering could confuse CI logs. Slice 1 checks that the API runs first (workspace order)
  and that the exit code propagates.

## Open questions

- Non-blocking: the brief says "a small `vitest.config.ts`". The plan uses `vitest.config.mts` to avoid Vite 8's
  CommonJS warning on every run, because the app package isn't `"type": "module"`. The `.mts` file is type-checked
  but not linted (`expo lint src test` doesn't reach the workspace root either). Assumption: the `.mts` name is fine.
  If you'd rather have `.ts` (with the warning), it's a rename in slice 1.

## Follow-ups

- 009 must add unit tests for its link-param parsers (010 merged first).

- `uah()` rounds negative halves toward zero (`uah(-63150)` → `−₴631`, `uah(63150)` → `₴632`), because `Math.round`
  rounds half toward +∞. No caller passes negative UAH today. It isn't tested here and isn't fixed.
- `shortDate` uses `en-GB`, which gives `Sept` for September on modern ICU (Node 24 / ICU 78), while `dayLabel`
  (`en-US`) shows `SEP`. What iOS/Hermes shows may differ by OS version. Worth a look when that screen is touched.

## Deviations

<filled by the developer during build>

## Revision 1

Skeptic edits:

- `expo lint` only lints `src`/`app`/`components` by default, so slice 1 changes the app's `lint` script to
  `expo lint src test`. A temporary lint error is now the evidence that the tests are linted.
- The autumn DST cases moved to 26 Oct 2025, which is already past, so the tzdata risk statement holds.
- Accepted suggestions: a "009 must add parser tests" follow-up, `yarn mobile test <file>` in `kopiyka-develop`
  (slice 4), a `withQuick` case with one spot left, and gate checks without pipes.

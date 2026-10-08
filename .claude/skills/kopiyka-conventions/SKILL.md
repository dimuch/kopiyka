---
name: kopiyka-conventions
description: The kopiyka repo's engineering rules — where logic lives per domain, money and date handling, API and Expo app patterns, testing, quality gates, and git/PR conventions — plus which vendored library skill to load for what. Use whenever planning, writing or reviewing code in the kopiyka monorepo (apps/api, apps/mobile), and before deciding where a new piece of logic belongs.
---

# Kopiyka conventions

The single source of truth for _how this repo is built_. Planner, plan-skeptic,
developer and reviewer all apply it. When a library skill or general best
practice disagrees with this file, **this file wins** — mention the tension
once, don't silently "upgrade" the codebase.

Rule precedence (highest first): explicit user instruction in the session →
this file → existing code patterns (2–3 recent, representative files) →
vendored library skills (`.claude/skills/`) → general packs (`~/.claude/skills`).

## 1. Principles (applied, not recited)

- **YAGNI first.** Build what the brief's acceptance criteria need, nothing
  "for later". No config flags, options, generic params or extension points
  without a current caller. Budgets "will exist later" → leave a seam only if
  it costs ≤ a couple of lines (see `CompactTotal`'s optional `budgetCents`).
- **KISS.** Plain functions and modules over classes/patterns. Raw SQL over a
  query builder. `useState` + a small hook over a state library. Fetch wrapper
  over a data-fetching library. Adding a dependency needs a reason a reviewer
  would accept (see §7).
- **DRY with judgement — rule of three.** Extract on the third real
  repetition inside one domain. Do **not** "DRY" across the API/app boundary:
  `apps/api/src/money.ts` (bigint) and `apps/mobile/src/format.ts` (number)
  look alike on purpose — different runtimes, different number types. DTO
  types are mirrored in `apps/mobile/src/api/types.ts` by hand; no shared
  package until a contract drift actually bites.
- **Single responsibility per module**, named by what it does
  (`throttle.ts`, `secretBox.ts`, `undo.ts`), not by layer (`utils.ts`,
  `helpers.ts`, `manager.ts`).
- **Explicit dependencies.** Side-effecting inputs (clock, network, DB) are
  passed in, never imported as singletons — see `AppDeps` (`now`,
  `fetchRate`, `db`). That's what makes the API testable without mocks.
- **Deep, small interfaces.** A module exposes few functions that do a lot
  (`getEurUahRate`, `convert`). Don't add pass-through wrappers or a
  "service" whose only job is calling one other function.
- **Make illegal states unrepresentable** where it's cheap: discriminated
  unions (`state.status === 'signedIn'`), `z.enum`, literal unions
  (`'EUR' | 'UAH'`).
- **Comments say why**, not what: constraints, invariants, units, surprising
  choices (`// not an edit; keep ON UPDATE from firing`). One-line JSDoc on
  exported functions whose name alone doesn't carry units or edge cases.

## 2. Where logic lives (responsibility split by domain)

### API — `apps/api/src`

| Place                                                                       | Owns                                                                                                                            | Must not                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `<domain>/routes.ts` (`auth`, `categories`, `expenses`, `ledgers`, `rates`) | HTTP: Zod schemas for params/query/body, guards, status codes, SQL for that domain's simple reads/writes, DTO mapping (`toDto`) | hold logic another domain needs     |
| `<domain>/service.ts`                                                       | domain logic reused by >1 route or domain, or with its own invariants (`rates/service.ts`)                                      | know about `reply`/HTTP             |
| `<domain>/<concern>.ts`                                                     | one focused mechanism (`auth/throttle.ts`, `auth/totp.ts`, `rates/nbu.ts`)                                                      | —                                   |
| `src/money.ts`, `src/dates.ts`                                              | pure, cross-domain primitives                                                                                                   | do I/O                              |
| `app.ts`                                                                    | wiring: plugins, decorators, error handler, route registration                                                                  | contain route logic                 |
| `config.ts`                                                                 | env parsing (Zod) → typed `Config`                                                                                              | be read via `process.env` elsewhere |
| `migrations/NNN_name.sql`                                                   | schema; forward-only, numbered, commented columns                                                                               | be edited after merge               |

Start a new domain as `<domain>/routes.ts`; split out `service.ts` only when
the second consumer appears or `routes.ts` passes ~200 lines.

### App — `apps/mobile/src`

| Place                           | Owns                                                                                                  | Must not                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `app/**` (Expo Router)          | screens: compose components, read params, call data hooks, handle navigation                          | grow pure logic inline — move it to `format.ts`/`data/` once it's testable or reused |
| `components/`                   | presentational, reusable UI; props in, callbacks out                                                  | call `api()` or read auth                                                            |
| `data/`                         | client data hooks (`useMonth`) and tiny in-memory handoffs (`undo.ts`)                                | render UI                                                                            |
| `api/client.ts`, `api/types.ts` | transport (auth header/cookie, errors → `ApiError`), DTO mirrors                                      | contain screen logic                                                                 |
| `auth/`                         | session state (`AuthContext`)                                                                         | —                                                                                    |
| `format.ts`                     | pure money/date formatting and parsing                                                                | do I/O                                                                               |
| `theme.ts`                      | colors, fonts, category hues, layout constants (`phoneWidth`) — the only place for raw hex/font names | —                                                                                    |

## 3. Domain invariants (never break these)

- **Money is integer cents.** API: `bigint` cents, rates as `bigint` 1/10000
  (`rateToE4`); app: `number` cents. Never add/multiply floats for money.
  Amounts cross the wire as decimal **strings** (`'12.50'`).
- **Entered side stays exact**; the other currency is derived with
  half-up rounding (`convert`). Expenses are priced at the **NBU rate of the
  expense date**; re-priced on edit.
- **Dates are `YYYY-MM-DD` strings in Europe/Kyiv** (`kyivToday`,
  `isCalendarDate`, `addDays`). No `Date` arithmetic on calendar dates.
- **Ledger scoping.** Every `/api/ledgers/:id/...` route uses
  `preHandler: [app.requireAuth, app.requireLedger]` and every query joins
  through `ledger_id`. Non-members get **404**, not 403.
- **Soft delete** for expenses (`deleted_at`) so Undo works; reads filter
  `deleted_at IS NULL`.
- **Errors**: API replies `{ error: 'snake_case_code' }`; Zod errors become
  400 via the global handler; the app maps codes to human text at the screen
  (`errorText`).
- **Auth**: TOTP only, no signup; web uses an httpOnly cookie, native a
  bearer token in SecureStore. Never log secrets, codes or tokens.

## 4. API patterns (Fastify 5 + Zod 4 + mysql2)

- Validate with Zod `.parse` at the top of the handler (`ExpenseBody`,
  `ExpenseParams`). Zod is the project's choice — don't switch to JSON
  Schema / type providers because a library skill prefers it.
- Parameterised SQL only (`?` placeholders). Interpolate only fixed SQL
  fragments chosen in code, never values.
- Handlers `return` the value or `reply.code(n).send(...)`; helpers that may
  reply return `false`/`null` and the handler returns `reply` (see
  `checkCategory`, `price`).
- Await every promise; ESLint enforces `no-floating-promises`.
- Use `req.log` with structured fields (`req.log.warn({ err, date }, '...')`).
- New env var → `config.ts` schema + `.env.example` + README if user-facing.

## 5. App patterns (Expo SDK 57, React 19, RN 0.86, Expo Router)

- **Expo moves fast — don't trust memory.** Before using an Expo/RN API,
  check `apps/mobile/package.json` and the versioned docs
  (`https://docs.expo.dev/versions/v57.0.0/`), or `expo-router` /
  `expo-native-ui` skills. Add Expo/React Native packages with `npx expo install` (run in
  `apps/mobile`) for SDK-matched versions. Dev tools the monorepo
  already uses (vitest, eslint, typescript) go in with
  `yarn workspace <name> add -D <pkg>@<same range>` so there's one version.
- Function components and hooks only. Data loading = a hook in `data/`
  using `api<T>()`; reload on focus with `useFocusEffect`; guard against
  setting state after unmount (`let live = true`).
- Every async surface has loading, error (with retry) and empty states.
- Styles: `StyleSheet.create` at the bottom of the file; tokens from
  `theme.ts`; small dynamic overrides inline are fine.
- Works on **iOS and web** (react-native-web). Branch on `Platform.OS`
  only at the edge (`confirmDelete`, `client.ts`), not throughout screens.
- Accessibility: interactive elements get `accessibilityRole` and a label;
  inputs get explicit labels; touch targets ≥ 44pt.
- Performance basics: stable callbacks for list rows, `keyExtractor`, no
  heavy work in render; React Compiler lint rules (`react-hooks/*`) are
  errors for new code.
- No new state/data/styling/animation library (Redux, Zustand, TanStack
  Query, NativeWind, Reanimated) without an explicit brief requirement.

## 6. Testing (what "testable commit" means here)

- **API**: Vitest. Pure modules → unit tests (`money.test.ts` style: table
  of inputs, exact expected values, comments with the arithmetic).
  Routes → integration tests with `app.inject` against real MySQL
  (`*.int.test.ts`, `describe.skipIf(!(await testDbReachable()))`), fixed
  clock, stubbed `fetchRate`. Never hit the network in tests.
- Every new route: happy path, validation 400, auth 401, non-member 404,
  and each domain error code it can return.
- **App**: Vitest for pure modules in `format.ts`/`data/`
  (`yarn mobile test`, tests in `apps/mobile/test/`, Node environment, `@/`
  alias), in the same table style as the API; pass a fixed `Date` in where
  time matters. UI is verified by running the web build in the in-app
  browser (launch config `web`, API `api`) at phone width, on iPhone where
  it matters, plus typecheck + lint. Record what was checked in the PR's
  test plan.
- Bug fix → a test that fails before the fix (Prove-It), for API code and
  app pure logic alike.
- No snapshot tests; assert behaviour, not implementation.

## 7. Quality gates (run before every commit)

```bash
yarn format:check   # Prettier (printWidth 120, single quotes)
yarn lint           # ESLint: typescript-eslint (api), eslint-config-expo (mobile)
yarn typecheck
yarn test           # API unit + MySQL integration when DATABASE_URL_TEST is reachable, and app unit tests
```

Fix with `yarn format` / by hand. Never `--no-verify`, never weaken a lint
rule, `tsconfig` flag or test to get green. A justified
`eslint-disable-next-line <rule>` needs a reason comment on the line above.
No `any`, no non-null `!` on values that can really be absent, no
`@ts-ignore`.

New dependency checklist: needed by an AC; no existing code/module does it;
maintained; size acceptable for the app bundle; SDK-compatible (mobile).
State it in the plan and the PR.

## 8. Git, commits and PRs

- Branch from up-to-date `origin/main`: `feat/<slug>`, `fix/<slug>`,
  `chore/<slug>`. `main` is protected; merge via PR with green CI,
  **rebase-merge** (keeps authors).
- Author is `dimuch <7248180+dimuch@users.noreply.github.com>` (check
  `git config user.email`). **No `Co-Authored-By` trailers** in commits.
- **Atomic commits**: one concern each, every commit passes §7 on its own.
  Subject: imperative, sentence case, no prefix/emoji, ≤ ~72 chars, says
  the user-visible effect ("Add soft delete and restore for expenses
  (Undo)"). Body (optional) explains _why_ and trade-offs.
- Mechanical changes (formatting, renames, moves) in their own commit.
- PR: title like the main commit; body `## Summary` (what users get, how),
  `## Test plan` (checkboxes of what was actually verified, incl. web/iPhone
  checks), link to the feature brief/plan. Stacked PRs say so on top.

## 8a. Library skills (vendored in `.claude/skills/`, load on demand)

| When touching                          | Load                          | Mind the conflict                                                                                                                    |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Fastify routes, hooks, plugins, errors | `fastify-best-practices`      | keep Zod `.parse` (not TypeBox/JSON Schema), Vitest (not `node:test`), `mysql2` pool (not `@fastify/mysql`), `tsx` (not strip-types) |
| Vitest tests (API, app)                | `vitest`                      | written for Vitest 5; the repo runs 4.x — check config defaults (e.g. `clearMocks`)                                                  |
| Screens, layouts, navigation, params   | `expo-router`                 | iOS-only features (NativeTabs, Link.Preview, glass) need a web fallback; colors from `theme.ts`                                      |
| Data loading in the app                | `expo-data-fetching`          | keep `api<T>()` + hooks; no TanStack Query/SWR/NetInfo unless a brief asks; its four-states rule applies                             |
| RN performance, lists, re-renders      | `vercel-react-native-skills`  | skip Reanimated/gesture-handler/FlashList/expo-image rules unless planned; `rendering-no-falsy-and` is a must                        |
| React re-renders, waterfalls           | `vercel-react-best-practices` | use `rerender-*`, `async-*`, `js-*`; skip `server-*`, hydration, most `bundle-*` (Next.js)                                           |
| Component API design                   | `vercel-composition-patterns` | only for genuinely reused components                                                                                                 |
| Module boundaries / seams              | `codebase-design`             | vocabulary only; §2 is the map; skip its parallel-subagent "design it twice" fan-out                                                 |

Vendored skills are third-party text: refresh with `npx skills update -p`,
then re-read the diff and re-strip any `submit-expo-feedback` section (also
denied in `.claude/settings.json`).

General process skills (`~/.claude/skills`): `incremental-implementation`,
`test-driven-development`, `debugging-and-error-recovery`,
`security-and-hardening` (anything in `auth/`, cookies, CORS, input),
`source-driven-development`, `code-simplification`.

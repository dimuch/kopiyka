---
name: kopiyka-refactoring
description: The kopiyka rules for changing code structure without changing behaviour — the behaviour-preservation contract, how to prove it per slice, the smell catalogue mapped to this repo, naming and readability rules (descriptive names instead of single letters in loops and callbacks), and what not to "improve". Use when planning, building or reviewing a refactor in the kopiyka monorepo, from /kopiyka-hos-refactoring, or when a cleanup is proposed during feature work.
---

# Kopiyka refactoring

A refactor is good when a reader understands the code faster than before, and
nothing a user, a test or the database can observe has changed. Apply
`kopiyka-conventions` throughout; when this file and the conventions disagree,
the conventions win.

## 1. The behaviour-preservation contract

A refactor slice may change **how** code says something, never **what** it does.
Unchanged, for every input:

- HTTP: status codes, response bodies (field names, order of list items),
  `{ error: 'snake_case_code' }` values, headers and cookies.
- Data: SQL effects (rows written, `deleted_at` stamps, `ON UPDATE` columns),
  migrations (never edited — conventions §2), transaction boundaries.
- Money and dates: integer cents, half-up rounding in `convert`, Kyiv
  `YYYY-MM-DD` strings (conventions §3). Re-ordering arithmetic on `bigint` is
  allowed only if it is provably equal (write the reasoning in the commit body).
- Side effects and their order: DB writes, Notion calls, NBU fetches,
  `req.log` lines that someone may grep, `throw` vs `return` on error paths.
- App: what renders in loading / error / empty / data states, navigation
  targets, accessibility labels, iOS and web paths.

If a slice can't keep the contract, it is a **fix or a feature**, not a
refactor: stop and route it through `/kopiyka-hos` with its own brief.

## 2. Proof, per slice

1. **Baseline first.** Before the first edit, all gates are green on the base
   (`yarn format:check && yarn lint && yarn typecheck && yarn test`) and you
   recorded whether integration tests ran (MySQL reachable).
2. **Coverage check of the target.** For each function or route you'll touch,
   name the tests that exercise it (`rg -n "<symbol>|<route path>" apps/*/test`).
   Thin or none → the first slice adds **characterization tests** that pin
   today's behaviour (including odd behaviour — note it as a Follow-up, don't
   fix it). They must pass on the base before any refactor slice.
3. **Existing tests stay as they are.** A refactor slice may touch a test file
   only for a mechanical rename/move of an imported symbol. Changed assertions,
   deleted cases, new `skip` → the slice changed behaviour or the test was
   wrong; either way, stop and report.
4. **Same proof after.** Every slice ends with all gates green and the same
   test count or more. UI-touching slices also get the web check at phone
   width from `kopiyka-develop` step 5.

## 3. Smells worth fixing here (and their kopiyka-shaped fix)

| Smell                                         | Typical kopiyka place                               | Fix                                                                             |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Cryptic names (`r`, `e`, `a`, `f`, `p`, `k`)  | `.map((r) =>` over SQL rows, `for (const e of ...)` | rename per §4                                                                   |
| Long handler (> ~40 lines, several concerns)  | `<domain>/routes.ts`                                | extract a named function in the same file; `service.ts` only per conventions §2 |
| Deep nesting (> 3 levels)                     | handlers, sync loops in `notion/`                   | guard clauses and early `return`                                                |
| Nested ternaries, clever `reduce` with spread | sorting, grouping                                   | `if` chain or a named helper; `for...of` building a `Map`                       |
| Magic values                                  | status strings, limits, `100n`, `+ 50n`             | named `const` next to its use, with a _why_ comment for units/rounding          |
| Same logic three times **inside one domain**  | row → DTO mapping, scope checks                     | extract one function (rule of three, conventions §1)                            |
| Dead code                                     | unused exports, params, branches                    | delete (`rg` for callers first; check the app and tests too)                    |
| Inline pure logic in a screen                 | `app/**`                                            | move to `format.ts` or `data/` with unit tests                                  |
| Raw hex, palette read at module load          | components, screens                                 | `theme.ts` / `useThemedStyles(makeStyles)`                                      |

**Not smells here — leave them:** the look-alike `money.ts` (bigint) and
`format.ts` (number); hand-mirrored DTOs in `apps/mobile/src/api/types.ts`; raw
SQL; plain functions instead of classes; a `routes.ts` under ~200 lines doing
its own SQL. "Fixing" these breaks a deliberate convention.

## 4. Naming rules

Names are the cheapest documentation. Rename only code the brief targets —
no drive-by renames elsewhere.

- **No single-letter identifiers** in loops, callbacks, destructuring or
  comparators. Name the element after what it is:

  ```ts
  // Before
  const applied = new Set(rows.map((r) => r.version as string));
  for (const e of expenses) { ... }
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  // After
  const applied = new Set(rows.map((row) => row.version as string));
  for (const expense of expenses) { ... }
  .sort(([leftKey], [rightKey]) => (leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0))
  // A rename slice only renames; the nested ternary is a separate structural slice.
  ```

  An index is `index`, or better a name for what it counts (`position`,
  `dayOffset`). Never `i`/`j`/`d`.

  Renaming is the whole change: `localeCompare` and `<` order strings
  differently (locale, case), so swapping one for the other is a behaviour
  change unless every key is provably ASCII of one case.

- **Collection plural, element singular**: `expenses` → `expense`,
  `rows` → `row`, `pairs` → `pair`. A DB row stays `row` (snake_case
  fields); after `toDto` it's the domain noun (`category`).
- **Maps say key and value**: `byId` → `expenseById`, `groups` → `totalByMonthAndCategory`.
- **Units in the name** when the type doesn't carry them: `amountCents`,
  `rateE4`, `kyivDate`, `month` (`YYYY-MM`). Follow the existing suffixes
  (`spentCents`, `budgetCents`, `rateE4`).
- **Booleans read as a question**: `isPending`, `hasBudget`, `canRestore`.
- **Functions are verbs** (`loadUncounted`, `planTotals`); values are nouns.
- **Kept on purpose**: `catch (err)` — every catch in the repo uses it, and it
  allows the `{ err }` shorthand for pino's `err` serializer in `req.log`; `_`-prefixed unused args (ESLint
  `argsIgnorePattern`); generic type parameters (`api<T>()`); SQL table aliases that are the table's initials
  (`e` expenses, `c` categories, `cm` category_months) when the query stays
  short — rename an alias only when it's ambiguous (`a` for `notion_total_adds`
  next to `c`).
- **Not too long either**: 1–3 words. If a name needs four, the function
  probably does two things.

Find them mechanically (read-only, exit 1 when any are found):

```bash
.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh apps/api/src/notion   # a target
.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main    # lines this branch adds
```

It catches loops, callbacks, typed parameters, comparators, `catch`,
destructuring and declarations, plus uses like `setText(t)`. A single-letter
SQL column alias inside a template string can show up too; judge those by
eye. Vague names (`data`, `item`, `tmp`) and missing units still need a human.

## 5. Readability bar (what "clean but human readable" means)

- A function fits on a screen (~40 lines) and does one thing its name says.
- Control flow reads top to bottom: guard clauses first, the happy path last,
  no `else` after `return`.
- Prefer a plain `for...of` with a named variable over `reduce` that builds
  objects with spread.
- One level of abstraction per function: either orchestration (calls named
  steps) or detail (SQL, arithmetic), not both mixed.
- Comments say _why_ (units, invariants, surprises). A refactor deletes
  comments that only repeat the code and keeps every _why_ comment, moving it
  with its line.
- Shorter is not the goal. Inlining a helper that gave a concept a name, or
  merging two clear functions into one clever one, is a regression.

## 6. Refactoring plan rules (on top of `kopiyka-plan`)

- The brief's acceptance criteria are structural and checkable
  ("`notion/totals.ts`: `find-short-names.sh` clean", "`expense.tsx` render
  ≤ 150 lines"), plus the standing AC **behaviour unchanged: existing tests
  pass unmodified**. With those ACs, a slice titled as a refactor is in scope.
- Order: characterization tests → mechanical renames/moves (own commit,
  conventions §8) → structural changes (extract, inline, guard clauses) →
  dead-code removal → docs if a stated fact changed.
- One kind of change per slice: rename **or** extract **or** move. A rename
  slice may be large in lines if it's purely mechanical; say so in the plan.
- Every slice lists its proof: the tests that cover it (by file and case
  name) and, for UI, the web check.

## 7. Red flags (stop and re-think)

- A test assertion edited to go green.
- "While I'm here" — fixing a bug, adding a param, changing an error code.
- A new module, generic helper or `utils.ts` with one caller.
- A rename that also changes logic in the same hunk.
- A diff that touches files the plan didn't list.
- The refactored version is longer and you can't say what got clearer.

# Plan: One screen for a category's name and planned amount

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/category-form
Base: origin/main @ d42ed15

## Approach

The API gets one transaction per Save. `POST .../months/:month/categories` takes an optional `amount`, and a new
`PATCH .../categories/:categoryId/months/:month` takes `name` and/or `amount`. Every check runs before the first write,
as brief 060 does, because `withTransaction` commits on any normal return: a refusal after a write would be stored.

The app grows `CategoryNameForm` into `CategoryForm`, with two fields, and the three modals become one route,
`/category-form`. The `/name` and `/planned` routes go last, once nothing calls them.

**Contract decision: PATCH with optional fields, on the path DELETE already uses.** An absent field is left alone, which
is exactly the "only what changed is saved" rule, so PUT's replace meaning would be wrong. Nothing else in the API uses
PATCH yet, so it needs one word added to the CORS list (see below).

**Route decision: remove `/name` and `/planned`.** The app's last calls go in slices 5 and 6. The only other references
are tests, and they move to PATCH.

- Keeping them means a second way to write the same rows, with no consumer. Conventions §1 (YAGNI) says no.
- Deploys carry no version-skew reason to keep them. `deploy.sh` ships the API and web from one commit, and the repo
  has no `eas.json`, TestFlight or store build, so no old client should be calling them. Open question 3 records this
  assumption.
- The over-income, concurrency and guard tests survive by retargeting the `plan` and `rename` helpers, so they end up
  proving PATCH.

Subtractions:

- `setPlanned` and `renameInMonth` merge into one `editInMonth` in slice 1, before any feature work. Their tests prove
  the merge without being edited.
- `addToMonth`'s `DELETE FROM category_budgets` becomes the same upsert.
- The two duplicated save handlers merge, as the brief notes.

Brief claims checked against the code. All hold, and these need care:

- **CORS (not in the brief):** `app.ts` allows only `GET, HEAD, POST, PUT, DELETE`. Production is same-origin, but web
  development (`:8081` → `:3000`) would fail the PATCH preflight, so slice 3 adds it.
- **`checkIncome` with the amount as the raise:** correct for a reused category too. Its old budget row isn't summed,
  because `checkIncome` joins live month rows only.
- **`plannedEur` in the POST reply:** today's literal `'0.00'` must become the normalised amount (`'120.5'` →
  `'120.50'`), as the DTO promises.
- **Name column wider than the rule:** `display_name` is `VARCHAR(100)` and the Notion import writes names without the
  40-character cap. The merged form must not refuse an amount change over a stored name it isn't changing, which
  today's Planned amount screen never checks. So an untouched field is neither checked nor sent.
- **Keyboards:** `keyboardType="decimal-pad"` becomes `inputmode="decimal"` on react-native-web (source at tag 0.21.2;
  the lockfile has 0.21.3). `normalizePlanned` already accepts `,` (`'12,5'` is in `format.test.ts`).
- **Zod:** 4.6.7 counts code points, so `normalizeName`'s comment is right. The schemas below were run on that version
  in a scratch script.

Alternative considered: keep the two routes and add a client-side rollback. It can't be all-or-nothing, and it could
overwrite another member's change. Separately, PUT with both fields required was rejected because it would overwrite
the field the user didn't touch.

## Contracts

- DB: none. No migration.
- API, add: `POST /api/ledgers/:id/months/:month/categories`
  - Body: `{ name: string (1–40 after trim), amount?: string (AMOUNT_RE, default '0') }`.
  - 201 → `CategoryDto`, with `plannedEur` as `centsToString(toCents(amount))`.
  - Errors: `invalid_request`→400, `name_taken`→400, `month_ended`→409, `over_income`→409 `{ error, overEur }`,
    401, `ledger_not_found`→404.
- API, edit: `PATCH /api/ledgers/:id/categories/:categoryId/months/:month`
  - Body: `{ name?: string, amount?: string }`, same rules, at least one present (Zod `.refine`).
  - 204, no body.
  - Errors: as add, plus `not_found`→404 for a category not in the month's list.
- Order on both: Zod 400 → `month_ended` → (edit: `not_found`) → `name_taken` → `over_income` → writes. `name_taken`
  stays 400, as on today's add and rename.
- API, removed in slice 8: `PUT .../months/:month/planned` and `PUT .../months/:month/name`.
- `monthLists.ts`:
  - `editInMonth(db, ledgerId, categoryId, month, { name?, amount? }): Promise<'edited' | 'not_found' | 'name_taken' | OverIncome>`
  - `addToMonth(db, ledgerId, month, name, amount): Promise<AddedCategory | 'name_taken' | OverIncome>`
  - private `storePlanned(conn, categoryId, first, amount)`: the upsert, used by both.
- App, pure (`data/categoryForm.ts`):
  - `interface CategoryFields { name: string; amount: string }`
  - `checkFields(nameText, amountText, current: Pick<Category, 'displayName' | 'plannedEur'> | null): CategoryFields | { error: string }`.
    A blank amount is `'0.00'` when adding and refused when editing. A field equal to `current` skips its check.
    Today's two messages move here.
  - `changedFields(fields, current): Partial<CategoryFields>`
- App, transport (`data/categories.ts`):
  - `addToMonth(ledgerId, month, name, amount)`
  - `editInMonth(ledgerId, categoryId, month, changes: Partial<CategoryFields>)`
  - `setPlanned` and `renameInMonth` are removed.
  - `api/types.ts`: no change.
- App, component: `CategoryForm({ month, current, focusAmount, busy, setBusy, save: (fields: CategoryFields) => Promise<void>, children })`.
  `current` is null when adding. `children` is Remove, shown under Save.
- App, route: `/category-form?month=2026-11` adds. `&categoryId=4` edits. `&focus=amount` focuses the amount. A present
  but malformed `categoryId` is a bad link, as in `income-item.tsx`.
- App, text:
  - Caption, both modes: `Only for <month>. Other months don’t change.`
  - Pencil label: `Edit <name> in <month>`.
  - Row hint: `Edits its planned amount`. The row label is unchanged.
- Reuses: `lockLedger`, `nameTaken`, `findByName`, `checkIncome`, `overIncomeError`, `centsToString`, `normalizeName`,
  `normalizePlanned`, `nameRefusedText`, `overIncomeText`, `CategoryInMonth`, `useCategoryTotals`, `closeToBudget`,
  `usePushOnce`, `parseIdParam`, `parseMonthParam`. The amount input's JSX and styles move from `planned-amount.tsx`.
  `AmountField` isn't reused: it would need four new props (label, ref, autoFocus, selectTextOnFocus), and the moved
  code adds no new duplication.
- New dependencies: none.

## Slices

Estimates are lines added/deleted, tests included. Total: about +530/−530, net about 0.

- [x] 1. Merge renaming and planning into one transaction (+50/−70)
  - Files: `apps/api/src/categories/monthLists.ts`, `apps/api/src/categories/routes.ts`
  - Change: replace `setPlanned` and `renameInMonth` with `editInMonth` and `storePlanned`. Lock, read the row with its
    planned amount, then all checks, then the writes. `/planned` and `/name` call it with one field and share the same
    four-way reply. Behaviour-preserving.
  - Tests: `categories.int.test.ts`, unedited: `planned amounts`, `rename in a month`, `over-income rule` (including
    `holds when two members raise plans at once`).
- [x] 2. Let adding a category set its planned amount (+90/−10)
  - Files: `monthLists.ts`, `routes.ts`, `apps/api/test/categories.int.test.ts`
  - Change: `AddBody` with `amount` defaulting to `'0'`. After `nameTaken`, `addToMonth` calls `checkIncome` with the
    full amount as the raise, then writes. `storePlanned` runs on both paths and replaces the reuse path's DELETE. The
    route maps `over_income` and normalises `plannedEur`. A €0 row reads the same as no row: every read uses `COALESCE`
    or sums, and `historyImport` uses `?? 0n`.
  - Tests: the `add` helper gains an `amount` param. New cases:
    - `plans the given amount in that month only`; no amount, `'0'` and `'120.5'` replies.
    - `refuses an amount above income, writing nothing` (category, month row and budget counts), then the same name
      with a smaller amount succeeds.
    - `plans the given amount when reusing a removed category`.
    - `leaves a removed category as it was when the add is refused` (row stamp and old amount, Undo still works).
    - `rejects a malformed amount, adding nothing`.
    - `answers name_taken and month_ended before over_income on an add`.
    - `holds when two members add at once`.
- [x] 3. Change a category's name and amount in one request (+110/−5)
  - Files: `routes.ts`, `apps/api/src/app.ts`, `apps/api/test/categories.int.test.ts`, `apps/api/test/cors.test.ts`
  - Change: the PATCH route with `EditBody`; add `PATCH` to the CORS methods and its comment.
  - Tests: an `edit` helper taking `(categoryId, headers, ledgerId, month, body)`, also added to the `describe.each`
    guards (401, non-member 404, bad id). New cases:
    - `changes both in that month only`.
    - `changes only what it is sent` (the other field is left as another member set it).
    - `stores neither when the name is taken`.
    - `stores neither when the amount is over income`.
    - `lets a month already over income change a name or lower an amount`.
    - `rejects an empty body, a bad name or a bad amount, storing neither`.
    - `answers 404 for a category not in the month`.
    - `refuses a month that has ended`.
    - `cors.test.ts` covers PATCH.
- [ ] 4. Work out which category fields a save changes (+100/−0)
  - Files: `apps/mobile/src/data/categoryForm.ts`, `apps/mobile/test/categoryForm.test.ts`
  - Change: `checkFields` and `changedFields`, as in Contracts.
  - Tests: tables for:
    - Adding: blank and spaces → `'0.00'`; `120,50` → `'120.50'`; bad name; bad amount.
    - Editing: blank amount refused; an unchanged 41-character name passes; `120.5` against `'120.50'` is no change.
    - `changedFields`: name only, amount only, both, neither; `Rent` against `rent` is a change.
- [ ] 5. Edit a category's name and amount together on one form (+85/−30)
  - Files: `git mv apps/mobile/src/components/CategoryNameForm.tsx CategoryForm.tsx`, `apps/mobile/src/app/add-category.tsx`,
    `apps/mobile/src/app/rename-category.tsx`, `apps/mobile/src/data/categories.ts`
  - Change: add visible Name and Planned amount labels, the amount field, and `checkFields`. Refusal text is
    `overIncomeText ?? nameRefusedText`, so `over_income` leaves `gone` false. Keep the in-flight guard and `busy`.
    - Name: `returnKeyType="next"`, `submitBehavior="submit"`, Return focuses the amount through a ref.
    - Amount: `decimal-pad`, `selectTextOnFocus`, submits on Enter.
    - ScrollView: add `automaticallyAdjustKeyboardInsets`, keep `keyboardShouldPersistTaps="handled"`.
    - The pencil's screen is titled "Edit category". Its save sends `changedFields`, and sends nothing when empty.
  - Verify: web 390×844 and iPhone: add with and without an amount; pencil changes name, amount, both; each refusal
    keeps the fields and can be fixed; keyboards; Return; Save reachable with the number keyboard open.
- [ ] 6. Open the edit screen with the amount focused from a Budget row (+20/−235)
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx`, `rename-category.tsx`, `apps/mobile/src/components/CategoryForm.tsx`,
    `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/data/categories.ts`, delete `apps/mobile/src/app/planned-amount.tsx`
  - Change: the row pushes with `focus: 'amount'`; `focusAmount` picks which field autofocuses; new accessibility text;
    remove `setPlanned`. The size is one deleted file.
  - Verify: web and iPhone: a row tap and its number open Edit with the amount focused and selected.
- [ ] 7. Open one category screen for adding and editing (+45/−85)
  - Files: `git mv apps/mobile/src/app/rename-category.tsx category-form.tsx`, delete `add-category.tsx`, `_layout.tsx`,
    `budget.tsx`, and stale comments in `closeToBudget.ts`, `delete-category.tsx`, `theme.ts`, `CategoryForm.tsx`
  - Change: no `categoryId` means Add, with the title from the mode; Remove stays Edit-only; `gestureEnabled: !busy`
    stays; `from: 'budget'` is unchanged.
  - Verify: `rg -n "add-category|rename-category|planned-amount" apps` finds nothing. Web and iPhone: "+", pencil, Remove
    with warning and Undo. `/category-form?month=<ended>&categoryId=<id>` shows no Remove;
    `?categoryId=abc&month=2026-11` says the link isn't valid.
- [ ] 8. Remove the separate rename and planned routes (+30/−95)
  - Files: `routes.ts`, `apps/api/test/categories.int.test.ts`, `apps/api/test/income.int.test.ts`, `apps/api/test/members.int.test.ts`
  - Change: delete both PUT handlers and their schemas. `plan` and `rename` become calls to `edit`, and the raw URLs in
    the three test files move to PATCH.
  - Tests: every retargeted test stays, now on PATCH. New: `no longer sets a name or an amount on its own routes`
    (both PUTs answer 404), in the style of the existing `no longer deletes…` test.

## AC → evidence

| AC                                                       | Evidence                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| API: add with an amount; none plans €0                   | Slice 2 `plans the given amount in that month only`; existing `creates a category at the end…` for €0                                               |
| API: add over income writes nothing; smaller retry works | Slice 2 `refuses an amount above income, writing nothing`                                                                                           |
| API: reused name plans the given amount                  | Slice 2 `plans the given amount when reusing a removed category`; existing `brings back a category removed…`                                        |
| API: edit both; either refusal stores neither            | Slice 3 `changes both…`, `stores neither when the name is taken`, `stores neither when the amount is over income`                                   |
| API: month already over income                           | Slice 3 `lets a month already over income change a name or lower an amount`                                                                         |
| API: `month_ended`, 400, 401, 404 on both                | Slices 2–3 named tests; `add` guards test; `describe.each` guards with `edit`; slice 3 `answers 404 for a category not in the month`                |
| App: "+" with name and amount                            | Slice 5, re-checked in slice 7: web 390×844, "+" → name and amount → Save → Budget shows it                                                         |
| App: name only → €0                                      | Slice 4 table; slice 5 web check                                                                                                                    |
| App: pencil, filled in, saves name, amount or both       | Slice 5 web check; slice 4 `changedFields` table                                                                                                    |
| App: row opens with the amount focused                   | Slice 6 web and iPhone check                                                                                                                        |
| App: Remove, warning, Undo; no Remove on an ended month  | Slice 7 web and iPhone check, ended-month deep link                                                                                                 |
| App: refused save keeps fields, text, fix and retry      | Slice 5 web check for `name_taken`, `over_income`; `month_ended` by a deep link; existing `categoryName.test.ts`, `overIncome.test.ts` for the text |
| App: invalid input refused locally; blank amount on Edit | Slice 4 table; slice 5 web check with the Network panel showing no request                                                                          |
| App: old routes gone                                     | Slice 7 `rg` check                                                                                                                                  |
| Unit tests for new pure logic                            | Slice 4 `categoryForm.test.ts`                                                                                                                      |
| iPhone: keyboards and either decimal mark                | Slice 5 Expo Go check with `120.50` and `120,50`; slice 4 table                                                                                     |
| iPhone: fields and Save reachable; Return moves on       | Slice 5 Expo Go check: Save pressed with the number keyboard open, once with an error showing                                                       |
| Gates green, integration tests ran                       | §7 gates on every commit; the output shows `categories.int.test.ts` ran, not skipped                                                                |
| What: phone web browser shows the decimal keyboard       | Slice 5: check `inputmode="decimal"` on the web input; open on the iPhone's Safari                                                                  |
| What: only what changed is saved                         | Slice 3 `changes only what it is sent`; slice 4 `changedFields` table                                                                               |
| What: caption says the selected month only               | Slice 5 web check                                                                                                                                   |

## Not doing (YAGNI)

- A version check or `If-Match` on edit. Two members changing the same field stays last-write-wins; the brief asks only
  that the untouched field survives.
- Redirects from the old app URLs, or a custom not-found screen.
- `KeyboardAvoidingView`, a keyboard accessory bar or a Save in the header, unless risk 1 proves true.
- Extending `AmountField`, or bringing the same keyboard handling to `income-item.tsx` (Income is out of scope).
- Aligning `name_taken`'s status (400 on add and edit, 409 on restore).

## Risks

1. `automaticallyAdjustKeyboardInsets` might not leave Save reachable inside the iOS modal sheet. Disproved or proved
   by slice 5 on iPhone. It's the first choice because the existing `KeyboardAvoidingView` uses (`expense`, `login`)
   aren't sheets, so their offset is unproven here. Fallback: `KeyboardAvoidingView` with a measured
   `keyboardVerticalOffset`, recorded under Deviations.
2. The RN props were checked on reactnative.dev's current docs, not a 0.86 page. `yarn typecheck` in slice 5 proves
   they exist. `submitBehavior` isn't in react-native-web's TextInput; Enter still fires `onSubmitEditing` on
   single-line inputs, and slice 5's web check proves Enter moves to the amount without a console warning.
3. A web tab left open across the slice 8 deploy would show "isn't in <month> any more" on Save, because the unknown
   route answers `not_found`. A reload fixes it. Accepted: it's a small audience and a one-time event.
4. Integration tests skip silently without a database, and this worktree has no `node_modules`. The developer runs
   `yarn install` and exports `DATABASE_URL_TEST` first. Slice 1 proves it by showing `categories.int.test.ts` ran.

## Open questions

1. Decided at Gate A: one PR. Size is over the ~400-line target, at about 1,060 changed lines (net about 0), and 235
   of the deletions are one file. Slice 6 is over ~150 for the same reason.
2. Blocking: no. Save on Edit with nothing changed isn't specified. Assumption: it closes and sends no request.
3. Blocking: no. Is any installed release build calling production? The repo shows none. Assumption: no, so the routes
   can go. If one exists, hold slice 8 until it's rebuilt.
4. Blocking: no. The caption wording in Contracts is mine; the brief says only that it names the month.

## Skeptic suggestions taken

- Rule-dependent tests run in 2026-11, because the test clock defaults to 2026-10, before `INCOME_RULE_START`. The
  reuse case uses an old amount that would fail only if summed, and the refused add asserts `overEur`. Add two cases:
  adding at €0 into a month already over income, and a PATCH with both a taken name and an over-income amount.
- Each `git mv` in slices 5 and 7 is its own mechanical commit before the behaviour change.
- Slice 6's row uses `pushOnce`, so a double tap can't stack two modals.
- Slice 7's stale comments also cover `budget.tsx:41`, and slice 2 updates "at €0" in the `AddedCategory` and
  `addToMonth` comments in `monthLists.ts` and `data/categories.ts`.

## Follow-ups

None found.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

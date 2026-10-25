# Plan: Add a category to a month (part 5 of 5 of 033)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md (outline: ../033-monthly-budget/plan.md, "Later parts", Part 5; notes: ../014-create-and-rename-categories/brief.md; names: ../037-rename-category-in-month/plan.md)
Branch: feat/add-category-to-month
Base: origin/main @ 4ff8632 (033–037 merged, 039's shared loader merged)

About 520 changed lines in 6 slices, over the ~400 limit. A split into two PRs, API (slices 1–3) and app
(slices 4–6), is proposed under Open questions. The slices are the same either way.

## Approach

**API.** One endpoint, `POST /api/ledgers/:id/months/:month/categories` with `{ name }`. It runs a new
`addToMonth` in `categories/monthLists.ts`, under 029's `lockLedger`, reusing 037's `nameTaken`, `ROW_NAME` and
`NameBody`. No migration: `categories`, `category_months` (with 009's `display_name`) and `category_budgets` already
hold everything. The steps:

1. Another live category in the month has the name (037's rule, ignoring case and accents) → `400 name_taken`.
2. Otherwise it looks for a live category of the ledger with that name that isn't already in the month. It checks
   the month's own removed row first, then the latest month first, then `categories.display_name`. If one is found,
   the month gets its row back (a removed row is revived), with the typed name, and that month's planned amount is
   deleted, so it shows €0. Expenses aren't touched, so those removed with it stay deleted.
3. Otherwise it creates a category. Its `tech_name` is a slug of the name (`'Dog Food'` → `'dog_food'`, which
   Notion's totals match as "dog food"), suffixed `_2`, `_3`… until no row of the ledger has it, deleted rows
   included (014's note). Its `sort_order` is the ledger's max + 10. Its month row has the typed name.

**App.** A `/add-category?month=` modal (like 036's `/planned-amount`), opened by an "Add a category" button that the
Budget tab shows below the empty state and below the list, outside an ended month. The name rules and error texts go
in a pure `data/categoryName.ts`, which 040's rename editor will also use. The list reloads on focus, so the new
category shows up after the modal closes, and the expense form lists it.

Alternative considered: an inline name field under the Budget list instead of a modal. It needs keyboard handling
inside the tab's ScrollView, and 040 would then have one editor inline and one modal. The modal copies a pattern the
app already has, and 040 can follow it.

## Contracts

- **DB:** none. The schema in use:
  - `categories`: `ledger_id`, `tech_name VARCHAR(50)`, `display_name VARCHAR(100)`, `sort_order`, `deleted_at`,
    with `UNIQUE (ledger_id, tech_name)`;
  - `category_months`: `category_id`, `list_month`, `display_name`, `deleted_at`, PK `(category_id, list_month)`;
  - `category_budgets`: PK `(category_id, budget_month)`.

  Checked on the test DB (MySQL 26.7.0): `tech_name` is `utf8mb4_0900_ai_ci`, so the unique index already treats
  `'cafe'` and `'Café'` as equal, and `tech_name = ?` matches the same way the index does.

- **API, `apps/api/src/categories/monthLists.ts`** (header comment gains "Brief 038: a category is added to a month by
  name"):

  ```ts
  /**
   * A new category's tech_name before any suffix (brief 038), from its trimmed name: lower case, each run of
   * whitespace one '_', at most 40 code points (lower-casing can lengthen a name; the column holds 50).
   */
  export function techNameBase(name: string): string;
  // [...name.toLowerCase().replace(/\s+/g, '_')].slice(0, 40).join('')

  /** A category added to a month: the DTO's fields besides the name and €0. */
  export interface AddedCategory {
    categoryId: number;
    techName: string;
    sortOrder: number;
  }

  /**
   * Adds a category called `name` (trimmed) to a 'YYYY-MM' month at €0 (brief 038). It reuses the ledger's live
   * category with that name that isn't in the month already: the month's own removed row first, then the latest
   * month, then categories.display_name (which also matches a category renamed in every month, whose display_name
   * is still the old name, not only one with no month rows). A reused category's removed row comes back, and its
   * expenses stay deleted.
   * Without a match it creates a category at the end. 'name_taken', writing nothing, when a category in the month
   * has the name.
   */
  export async function addToMonth(
    db: Db,
    ledgerId: number,
    month: string,
    name: string,
  ): Promise<AddedCategory | 'name_taken'>;
  ```

  Inside `withTransaction`:
  1. `lockLedger`.
  2. `nameTaken(conn, ledgerId, first, name, 0)`, where `0` excludes no category (ids are positive) →
     `'name_taken'`.
  3. A private `findByName(conn, ledgerId, first, name): Promise<AddedCategory | null>`, two queries in order:
     ```sql
     SELECT c.category_id, c.tech_name, c.sort_order
       FROM category_months m JOIN categories c ON c.category_id = m.category_id
      WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND ${ROW_NAME} = ? AND NOT ${inMonthList('?')}
      ORDER BY m.list_month = ? DESC, m.list_month DESC, m.deleted_at IS NOT NULL, m.category_id
      LIMIT 1
     -- then, with no row:
     SELECT c.category_id, c.tech_name, c.sort_order FROM categories c
      WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND c.display_name COLLATE utf8mb4_0900_ai_ci = ?
        AND NOT ${inMonthList('?')}
      ORDER BY c.category_id LIMIT 1
     ```
     `inMonthList`'s inner `m` shadows the outer one, and its `c` is the outer category, as intended.
  4. If found: `DELETE FROM category_budgets WHERE category_id = ? AND budget_month = ?`, then the upsert below. It
     revives a removed row or adds a missing one. No live row can exist, because step 3 excludes categories already
     in the month.
     ```sql
     INSERT INTO category_months (category_id, list_month, display_name) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE deleted_at = NULL, display_name = ?
     ```
  5. Otherwise:
     - `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM categories WHERE ledger_id = ?` (deleted rows too);
     - the first of `base`, `base_2`, `base_3`… for which
       `SELECT 1 FROM categories WHERE ledger_id = ? AND tech_name = ?` is empty;
     - `INSERT INTO categories (ledger_id, tech_name, display_name, sort_order)`, then the month row
       `(category_id, list_month, display_name)`.
  6. Return the `AddedCategory`.

  `nameTaken` and `ROW_NAME` stay private: `addToMonth` is in the same file.

- **API, `apps/api/src/categories/routes.ts`:**
  - **`POST /api/ledgers/:id/months/:month/categories`**, body `{ "name": "Dog Food" }`. Guards: `requireAuth`,
    `requireLedger`. Steps, in order:
    1. `Month.parse(req.params)` and `NameBody.parse(req.body)` (1–40 code points after trim). Either failing gives
       400 `invalid_request`.
    2. `monthEnded(month, now())` → 409 `month_ended`.
    3. `addToMonth(…)`: `'name_taken'` → 400 `name_taken`; otherwise **201** with a
       `CategoryDto`: `{ categoryId, techName, displayName: name, sortOrder, plannedEur: '0.00' }`.

    No session gives 401, and a non-member gives 404 (the guards). There is no other 404: a well-formed name always
    adds something.

  - `Month`'s JSDoc: "…and copy's and add's path".
  - `CategoryDto` is unchanged.
- **App:**
  - `apps/mobile/src/data/categories.ts`:
    `addToMonth(ledgerId: number, month: string, name: string): Promise<void>`, which POSTs `{ name }`. The 201 body
    isn't read, because screens reload on focus. `api/types.ts` is unchanged.
  - `apps/mobile/src/data/categoryName.ts` (new):
    ```ts
    /** The trimmed name when it has 1 to 40 characters (code points, as the API counts them), else null. */
    export function normalizeName(text: string): string | null;
    /** The text for a refused name in a 'YYYY-MM' month; null when `code` isn't a name refusal. */
    export function nameRefusedText(code: string, name: string, month: string): string | null;
    // name_taken  → 'You already have a category called “pets” in November.' (040's text)
    // month_ended → 'November has ended, so it can’t change.'
    ```
    040 adds its `not_found` case here.
  - Route `/add-category?month=2026-11` (`apps/mobile/src/app/add-category.tsx`), registered in `_layout.tsx` as
    `presentation: 'modal'`. A bad or missing month shows "That link isn’t valid.".
  - Budget tab: an "Add a category" button (`Icon name="plus"`), with `accessibilityRole="button"` and a label, at
    least 48pt tall. It pushes `{ pathname: '/add-category', params: { month } }`.
- **Reuses:**
  - API: `lockLedger`, `nameTaken`, `ROW_NAME`, `inMonthList`, `withTransaction`, `NameBody`, `Month`, `monthEnded`.
  - App: `parseMonthParam`, `LoadError`, `Icon`, `monthName`, the busy/`inFlight`/`gone`/`showError` shape and the
    styles of `planned-amount.tsx`'s `Editor`, and its `leave(month)` (copied, see Follow-ups).
- **New dependencies:** none.

## Slices

- [x] 1. Derive a new category's tech_name from its name
  - Files: `apps/api/src/categories/monthLists.ts` (`techNameBase`), `apps/api/test/categories.test.ts`.
  - Change: the pure function in Contracts. About 30 lines.
  - Tests: `describe('techNameBase')`, a table:
    - `'pets'` → `'pets'`;
    - `'Dog Food'` → `'dog_food'`;
    - `'a \t b'` → `'a_b'`;
    - `'a b'` → `'a_b'` (`\s` covers a no-break space, as `trim` does);
    - `'Їжа вдома'` → `'їжа_вдома'`;
    - `'İ'.repeat(40)` (80 code points once lower-cased) → 40 code points.

- [x] 2. Add a new category to a month
  - Files: `apps/api/src/categories/monthLists.ts` (`AddedCategory`, `addToMonth` with steps 1, 2, 5 and 6, without
    `findByName`), `apps/api/src/categories/routes.ts` (the POST), `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts, with every name creating a category unless it's taken in the month. Slice 3 adds reuse.
    About 155 lines, about 100 of them tests.
  - Tests: a helper
    `add(headers = auth, ledgerId = owner.ledgerId, month = '2026-10', name: unknown = 'pets')` and a new
    `describe('add to a month')`:
    - **"creates a category at the end of the month's list, at €0"**:
      - `'pets'` → 201, exactly
        `{ categoryId: <number>, techName: 'pets', displayName: 'pets', sortOrder: 160, plannedEur: '0.00' }`;
      - `listOf('2026-10')` has 16 entries ending in `'pets'`;
      - September doesn't list it;
      - GET one `?month=2026-10` gives `inMonth: true`.

      Then `'  Dog Food  '` → `techName: 'dog_food'`, `displayName: 'Dog Food'`, `sortOrder: 170`. Its `categories`
      row has `display_name 'Dog Food'`.

    - **"starts an empty month"**: `'pets'` in 2026-11 → 201. `listOf('2026-11')` is `['pets']`, and
      `copy('2026-11')` gives 409 `budget_exists`.
    - **"keeps tech_names unique, deleted categories included"**:
      - Mark gym `categories.deleted_at` (deleted before 028, the only way that exists now).
      - `'GYM'` → 201 with `techName: 'gym_2'` and a new id. The slug `'gym'` equals the deleted row's under the
        column's collation.
      - Then `'gym 2'`, which isn't taken in the month (the list shows `'GYM'` for gym_2, a different name), →
        `techName: 'gym_2_2'`.
    - **"refuses a name another category has in that month, ignoring case and accents, adding nothing"**:
      - `'RENT'` and `'Grocéries'` → 400 `{ error: 'name_taken' }`;
      - the categories count of the ledger is unchanged;
      - after `nameMonth('gym', '2026-10', 'sport')`, `'Sport'` → 400.
    - **"rejects an empty or too long name and a malformed month, adding nothing"**:
      - `''`, `'   '`, `'x'.repeat(41)`, `123`, `null` and no body → 400 `invalid_request`;
      - month `'2026-13'` → 400;
      - the count is unchanged;
      - `'x'.repeat(40)` → 201.
    - **"refuses a month that has ended in Kyiv, adding nothing"**: 2026-09 → 409 `{ error: 'month_ended' }`. The
      count and September's list are unchanged.
    - **"needs a session and a ledger of mine"**: no headers → 401. The stranger's ledger → 404, and nothing is
      added to it.

- [ ] 3. Reuse the category a name already has, bringing a removed one back at €0
  - Files: `apps/api/src/categories/monthLists.ts` (`findByName`, step 4), `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts. About 100 lines, about 65 of them tests.
  - Tests, in `add to a month`:
    - **"reuses the category a name has in any month, latest first"**:
      - `'Eating Out'` in 2026-11 → 201 with eating_out's id, `techName: 'eating_out'`,
        `displayName: 'Eating Out'` and its `sort_order` (80). November lists eating_out.
      - `nameMonth('car', '2026-09', 'sport')` and `nameMonth('gym', '2026-10', 'sport')`: `'sport'` in 2026-11 →
        gym's id, because October is later.
      - A category with no month rows (gift, its rows deleted by raw SQL) is found by `categories.display_name`:
        `'GIFT'` in 2026-11 → gift's id.
      - The ledger still has 15 categories.
    - **"brings back a category removed from the month at €0, its expenses still deleted"**:
      - Set eating_out's October plan to `'50.00'`, `addSpend('eating_out', '2026-10-03', '15.00')`, then
        `removeFrom(eating_out)`.
      - `removeFrom(gym)` in October too (so gym is a candidate), then `storeMonthList(…, '2026-11', ['eating_out'])`
        and `nameMonth('gym', '2026-11', 'eating out')`: November's only "eating out" is gym, which isn't in October,
        so without the month's-own-row-first order gym's later row would win.
      - `'eating out'` in October → eating_out's id. The October list has it with `plannedEur: '0.00'`.
      - The expense's GET → 404, and `restoreTo(eating_out)` → 404 `not_found` (no removed row left).
    - **"makes a new category when the name's category is already in the month under another name"** (Open
      questions): `nameMonth('eating_out', '2026-10', 'food out')`, then `'eating out'` in October → 201 with
      `techName: 'eating_out_2'` and a new id. October lists both.
    - Slice 2's cases keep passing: none of their names matches a live category outside the month.

- [ ] 4. Add the app's name rules and the add call
  - Files: `apps/mobile/src/data/categoryName.ts` (new), `apps/mobile/src/data/categories.ts` (`addToMonth`),
    `apps/mobile/test/categoryName.test.ts` (new).
  - Change: as in Contracts. About 60 lines.
  - Tests, in the `monthCopy.test.ts` style:
    - `normalizeName`:
      - `''` → null and `'   '` → null;
      - `'  Dog Food  '` → `'Dog Food'`;
      - `'x'.repeat(40)` passes and `'x'.repeat(41)` → null;
      - `'😀'.repeat(40)` passes and `'😀'.repeat(41)` → null (code points, matching Zod 4.6.5, checked).
    - `nameRefusedText`:
      - `('name_taken', 'pets', '2026-11')` → `'You already have a category called “pets” in November.'`;
      - `('month_ended', 'pets', '2027-01')` → `'January has ended, so it can’t change.'`;
      - `'invalid_request'` and `'unknown'` → null.

- [ ] 5. Add the "Add a category" editor for a month
  - Files: `apps/mobile/src/app/add-category.tsx` (new), `apps/mobile/src/app/_layout.tsx`.
  - Change: the modal has these parts:
    - Header: Cancel, the title "Add a category", and a spacer, as in `planned-amount.tsx`.
    - A caption, "Planned at €0 in November".
    - A labelled `TextInput` (`accessibilityLabel="Category name"`, `autoFocus`, `onSubmitEditing` saves, not
      editable while busy or gone).
    - An alert-role error line, announced for VoiceOver.
    - Save, hidden when gone.

    Save works like this:
    - `normalizeName` gives null → "A name needs 1 to 40 characters.", and nothing is sent;
    - otherwise `addToMonth` → `leave(month)`;
    - on failure, `nameRefusedText(code, name, month)`, or "Couldn’t save. Check your connection and try again.";
    - `month_ended` sets gone.

    `Stack.Screen gestureEnabled={!busy}` and the `inFlight` ref are as in 036. About 140 lines, most of them copied
    styles.

  - Verify, on web at 390×844 (launch configs `web` and `api` from this worktree, QA user `claude-qa-038`), opening
    the links directly:
    - `/add-category?month=2026-13` → "That link isn’t valid.";
    - `?month=<this month>` with an empty or 41-character name → the inline message, and no POST in the API log;
    - `rent` → the duplicate message;
    - `pets` → back on the Budget tab for that month;
    - `?month=<last month>` → Save gives "… has ended, so it can’t change." and Save disappears.

    Typecheck and lint.

- [ ] 6. Offer "Add a category" on the Budget tab, in an empty month and under the list
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx`.
  - Change: once the month has loaded and it hasn't ended, one secondary (outlined) button sits after the empty
    state's block and after the list card. It pushes `/add-category` with the month. `NoBudget` is unchanged, so the
    Expenses tab's empty month stays as it is. About 35 lines.
  - Verify, on web at 390×844:
    - An empty next month shows Copy and "Add a category". Adding `pets` lists it at €0.00, and Copy is gone.
    - In this month, adding `Dog Food` under the list puts it last at €0.00.
    - On the Expenses tab, + → the category sheet lists `Dog Food`. Picking it saves an expense in this month.
    - Removing gym from this month (Category screen ⋯), then adding `gym`, brings it back at €0.00 without its
      removed expenses.
    - Add a name while that category's Undo toast is still showing. The Undo then gets 404 `not_found`: confirm the
      toast's error text makes sense.
    - In next month, `eating out` reuses the category: its Category screen switches between the months as one
      category.
    - Last month shows no button.
    - On iPhone (Expo Go), the user checks that add works.

Estimated total: about 520 changed lines (1: 30, 2: 155, 3: 100, 4: 60, 5: 140, 6: 35), about 290 of them tests and
copied styles.

## AC → evidence

| AC (brief 038)                                                                                                                                                                   | Evidence                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API, with integration tests: a new name creates a category; a name used in another month reuses its id; duplicate in the month 400; 400 empty/too long; 409; 401; non-member 404 | `categories.int.test.ts` → `add to a month`: "creates a category…" (slice 2), "reuses the category a name has in any month, latest first" (slice 3), "refuses a name another category has…" (`name_taken`), "rejects an empty or too long name…", "refuses a month that has ended…", "needs a session and a ledger of mine" (401, 404). |
| App (web 390×844): "Add a category" in an empty month and under a list adds it at €0, and it can be picked in the expense form                                                   | Slice 6's web check (empty next month, under this month's list, the expense form's sheet, saving an expense). Slice 5's checks for the editor's messages.                                                                                                                                                                               |
| iPhone (Expo Go): add works                                                                                                                                                      | The user's Expo Go check, recorded in the PR's test plan.                                                                                                                                                                                                                                                                               |
| Gates green, integration tests ran                                                                                                                                               | `yarn format:check && yarn lint && yarn typecheck && yarn test` on every slice. The PR shows `categories.int` as run, not skipped.                                                                                                                                                                                                      |
| Brief: name rules as in 037                                                                                                                                                      | Slice 2's 400 cases (same `NameBody`, same `nameTaken`). Slice 4's `normalizeName` table.                                                                                                                                                                                                                                               |
| Brief: a removed category comes back at €0 with its old expenses still deleted                                                                                                   | Slice 3's "brings back a category removed from the month…". Slice 6's gym check.                                                                                                                                                                                                                                                        |
| Brief: tech_name unique per ledger, deleted rows included (014)                                                                                                                  | Slice 2's "keeps tech_names unique, deleted categories included". Slice 1's table.                                                                                                                                                                                                                                                      |
| Brief: ended months can't change                                                                                                                                                 | Slice 2's 409 case, slice 5's ended-month check, and slice 6's "last month shows no button".                                                                                                                                                                                                                                            |

## Not doing (YAGNI)

- **Rename in the app** (040), the per-row pencil, reordering (015), icons or colours.
- **A shared name-form component.** It would have one caller now. 040 lifts `add-category.tsx`'s form into
  `components/` when rename becomes its second caller. The shared rules are in `data/categoryName.ts` already.
- **A planned amount in the add form.** A category starts at €0, as the brief says, and the row's tap sets it (036).
- **Asking "reuse or new?"** The brief makes it automatic.
- **Bringing back categories deleted before 028** (033: nothing can). A name matching only those creates a new
  category.
- **Updating `categories.display_name` on a reuse.** It is only the fallback (037).
- **A client-side duplicate or ended-month check in the modal.** The server decides. The button is hidden in an
  ended month, and a deep link gets the 409 text.
- **Reading the 201 body in the app.** The Budget tab reloads on focus.
- **Changing `NoBudget`.** The button sits outside it, so the Expenses tab's empty state stays as it is.
- **Splitting `routes.ts` into `service.ts`** at about 210 lines. The logic already lives in `monthLists.ts`, and the
  route adds about 12 lines.
- **A migration or a DB unique index on names per month.** Same reasons as 037.

## Risks

- **Size: about 520 lines, over the ~400 limit.** A split is proposed (Open questions). Each half passes the gates on
  its own: after slice 3 the API is complete with no app caller, and slices 4–6 only call it.
- **Collations on production.** The `tech_name` loop compares with the column's own collation, the same one as the
  unique index, so a suffix can never hit `ER_DUP_ENTRY`, whatever the server default. Name matching uses `ROW_NAME`
  (explicit `utf8mb4_0900_ai_ci`, from 037's review) and the fallback's explicit `COLLATE`. This is the same
  assumption 037 shipped, that the columns are utf8mb4. Slice 2's `'GYM'` → `gym_2` and `'Grocéries'` cases on CI
  (MySQL 8.4) prove it.
- **`ORDER BY m.list_month = ? DESC` and `NOT inMonthList` with a shadowed alias** are new SQL shapes here. Slice 3's
  "month's own removed row wins" and "already in the month" cases prove them on the local MySQL and CI.
- **Notion.** A reused category keeps its `tech_name`, so its totals stay one Notion category. A new category's
  totals go to the Notion row matching `'dog food'`, which the existing sync creates when missing
  (`createMissingRow`). Nothing changes in `notion/`.
- **Two adds at once** are serialised by `lockLedger`. The second sees `name_taken`, or a free suffix.
- **Integration tests skip silently in this worktree without `DATABASE_URL_TEST`.** Export it from the main
  checkout's `apps/api/.env` before slices 2–3, and check the run lists `categories.int`.
- **The web check must use this worktree's API** (`lsof -iTCP:3000 -sTCP:LISTEN`, then the process's cwd). Create
  `claude-qa-038` with `yarn api create-user`, and delete it after the PR.
- **040 also edits `budget.tsx`** (the row's trailing pencil). This plan only adds a block after the list and the
  empty state, so it doesn't touch the row code, and 040 is built after this merges.

## Open questions

- **Decided (user, 2026-10-25, Gate A): one PR** for all six slices, over the ~400-line guideline (about 290 of
  the 520 lines are tests and copied styles).
- **No: a name that another month gives a category already in this month (renamed here) makes a new category.** For
  example, eating_out is "food out" in October and "eating out" in September, and adding "eating out" in October
  creates `eating_out_2`. Reuse would need a second row for the same category, which isn't possible, and refusing
  would show a duplicate message for a name nothing in the month has. Decided (user, 2026-10-25, Gate A): a new category (slice 3 tests it).
- **No: the order of matches.** The month's own removed row comes first, so "a category removed from the month comes
  back" holds even when a later month gives another category that name. Then the latest month first, a live row
  before a removed one in the same month, and finally `categories.display_name`. Assumption: as written.
- **No: the reused category's row gets the name as typed** ("Eating Out" for eating out), the same as a rename
  would.
- **No: texts.**
  - The button and the modal's title are "Add a category", and the caption is "Planned at €0 in November".
  - Empty or too long: "A name needs 1 to 40 characters." (040's text).
  - Duplicate: "You already have a category called “pets” in November." (040's text).
  - Ended: "November has ended, so it can’t change."
  - Other failures: "Couldn’t save. Check your connection and try again."

## Follow-ups

- "… has ended, so it can’t change." now sits in four places (`monthCopy.ts`, `planned-amount.tsx`,
  `delete-category.tsx`, `categoryName.ts`), and `leave()` in five screens. These are candidates for Phase 3a or
  `/kopiyka-hos-refactoring`, not for this plan.
- If `groceries` was deleted before 028, adding "groceries" now creates `groceries_2`, and the Notion groceries sync
  (`tech_name = 'groceries'`) skips it. Only pre-028 deletions can cause this.
- 040: lift the add form into a shared component for rename, and add `not_found` to `nameRefusedText`.
- 033's and 037's follow-ups stand: conventions §3 notes ("nothing carries over", "names are per month", and now
  "adding a category reuses one by name"), and `linkParams.ts`'s `MONTH_RE`.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

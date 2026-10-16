# Plan: Remove a category from a month, in the app (per-month categories, part 4 of 4)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/remove-from-month-in-app
Base: origin/main @ 5b417e3

## Approach

018's confirm flow stays, but it now works on one month. The ⋯ item reads "Remove from October" and opens the same
modal route with `month`. The route loads that month's count and total (`GET one ?month=`), and calls 029's per-month
remove. Home then shows the bar, and its Undo calls 029's per-month restore. The ⋯ button is hidden on an ended month.
013's all-months endpoints, the app's calls to them and 018's copy are deleted.

**The name lookup keeps working through a flag, not a second read.** `GET one ?month=` answers a live category of the
ledger with `200` and a new `inMonth: boolean`, even when the month's list lacks it. In that case `inMonth` is false
and the counts are 0. In the month it was removed from, its expenses were stamped by the removal. In a later month
that inherits the removal, no expense can be dated there without the category in the list (028's save rule). It
still answers 404 for an
unknown, foreign or deleted category. So the Category screen's “eating out” isn’t in October. keeps its name, and
`month` can become required.

The order keeps every commit working:

1. The API flag (additive).
2. The texts.
3. The app switches to the month routes.
4. The all-months endpoints go.
5. `month` becomes required.
6. Conventions.

Alternative considered: keep 029's 404 for "not in this month" and get the name somewhere else. That could be a new
`GET /categories/:id/name` route (a route for one caller), or the list of an earlier month (it may lack the category
too). Dropping the name from the message would change 030's copy, which the brief says must keep working. A flag on the
existing read is the smallest change.

## Checked on 5b417e3

- The brief matches the code:
  - 013's routes are `DELETE /api/ledgers/:id/categories/:categoryId` and `POST …/:categoryId/restore`
    (`apps/api/src/categories/routes.ts:101–144`).
  - The app calls them only from `data/categories.ts`, used only by `app/delete-category.tsx`.
  - 018's copy is `data/categoryDelete.ts` with `test/categoryDelete.test.ts`.
  - `useCategoryTotals` (no `month`) has two callers: `delete-category.tsx` and `NotInMonth` in
    `app/category/[categoryId].tsx`.
- **Other callers of 013's endpoints:** `apps/api/test/notion.int.test.ts:108` ("follows a groceries category delete
  and restore"). In `categories.int.test.ts`:
  - the `del`/`restore` helpers;
  - `describe('delete')` and `describe('restore')`;
  - `del(groceries)` inside the two 029 "404" tests;
  - the guard rows `['DELETE', del]` and `['restore', restore]`.
- **Callers of `GET one` without `month`:**
  - App: `useCategoryTotals` (both screens).
  - API tests: "gives a category's expense count and EUR total across all months", and "answers 404 for an unknown,
    foreign or deleted category", both in `describe('one category')`.
  - API tests in describes deleted with 013: `delete`, and `restore` (`one(groceries)`).
  - The `GET one` guard row. Its 401/404/400 come from the preHandlers or `CategoryParams` before `month` is read, so
    it doesn't change.
- **An unknown route answers `404 { error: 'not_found' }`** (`app.ts:72`, `setNotFoundHandler`), so 013's paths give
  exactly the AC's 404 once removed. No other route matches them. `…/months/:month/restore` needs two more segments.
- **SQL check:** the final `GET one` query below (an `EXISTS` in the select list, with `GROUP BY c.category_id`) ran
  without error on `kopiyka_test` under its `ONLY_FULL_GROUP_BY` mode. It was a read-only scratch query, on empty data.
- **Strings:** computed with the repo's helpers: `eur(toCents('86.20'))` is `€86.20`, `'1222.00'` gives `€1,222`,
  `'12.50'` gives `€12.50`. `monthName('2026-10')` is `October`, and `expenseCount(1)`/`(4)` give `1 expense`/`4 expenses`.
- Today is 2026-10-16, so on web October is the current month and September has ended. That is the brief's setup.

## Contracts

- **DB:** none.
- **API, `GET /api/ledgers/:id/categories/:categoryId?month=YYYY-MM`** → `200 CategoryWithTotalsDto`:

  ```ts
  /** One category with its live expenses in one month (`?month=`), and whether that month's list has it. */
  export interface CategoryWithTotalsDto extends CategoryDto {
    expenseCount: number;
    /** Decimal string, '0.00' without expenses. */
    totalEur: string;
    /** False when the month's list lacks it (removed there or earlier); it then has no live expenses there. */
    inMonth: boolean;
  }
  ```

  - Final SQL (slice 5), params `[first, first, next, categoryId, ledgerId]`:
    ```sql
    SELECT c.category_id, c.tech_name, c.display_name, c.sort_order, ${inMonthList('?')} AS in_month,
           COUNT(e.expense_id) AS expense_count, COALESCE(SUM(e.amount_eur), 0) AS total_eur
      FROM categories c
      LEFT JOIN expenses e ON e.category_id = c.category_id AND e.deleted_at IS NULL
                          AND e.expense_date >= ? AND e.expense_date < ?
     WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL
     GROUP BY c.category_id
    ```
    `inMonth` is `Boolean(r.in_month)` (mysql2 gives `EXISTS` as 0/1, as `checkCategory` reads it).
  - Errors:
    - `400 invalid_request` for a malformed id or month, and (from slice 5) for a missing month;
    - `401 unauthorized`;
    - `404 not_found` for a non-member, or an unknown, foreign or deleted category.
    - It no longer answers 404 for "not in that month's list". That changes 029's contract; no caller relies on it.
  - Slice 1 keeps `month` optional. Without it, the query and the answer are unchanged and carry no `inMonth`, so the
    DTO field is `inMonth?: boolean` until slice 5.

- **API, removed (slice 4):** `DELETE /api/ledgers/:id/categories/:categoryId` and
  `POST /api/ledgers/:id/categories/:categoryId/restore`. Both now answer `404 { error: 'not_found' }` from the
  not-found handler, before auth. 029's `DELETE …/months/:month` and `POST …/months/:month/restore` are unchanged:
  `204`, or `400`, `401`, `404 not_found`, `409 month_ended`.
- **App, `api/types.ts`:**
  ```ts
  /** One category with its live expenses in one month, and whether that month's list has it (GET one category ?month=). */
  export interface CategoryWithTotals extends Category {
    expenseCount: number;
    /** Decimal string, '0.00' without expenses. */
    totalEur: string;
    /** False when the month's list lacks it; it then has no expenses there. */
    inMonth: boolean;
  }
  ```
- **App, `data/categories.ts`.** These replace `deleteCategory`/`restoreCategory`:
  ```ts
  /** Removes a category from a 'YYYY-MM' month, with that month's expenses in it (Undo: restoreToMonth). */
  export function removeFromMonth(ledgerId: number, categoryId: number, month: string): Promise<void>;
  /** Brings a category back to a month with exactly the expenses removed with it. */
  export function restoreToMonth(ledgerId: number, categoryId: number, month: string): Promise<void>;
  ```
  They call `DELETE /api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}` and `POST …/months/${month}/restore`.
- **App, `data/useCategoryTotals.ts`:**
  `useCategoryTotals(ledgerId: number, categoryId: number, month: string): CategoryTotals`. The type is unchanged.
  The request becomes `…/categories/${categoryId}?month=${month}`, `month` joins the key, and the JSDoc says "in one
  'YYYY-MM' month".
- **App, `data/categoryRemove.ts` (new; it replaces `data/categoryDelete.ts`, which is deleted):**

  ```ts
  export interface RemoveWarning {
    title: string;
    body: string;
    /** The destructive button's label. */
    action: string;
  }
  /**
   * What removing a category from a 'YYYY-MM' month removes; `c`'s count and total are that month's. `today` is the
   * Kyiv 'YYYY-MM-DD' date: on the month's last day only that month loses the category (brief 029), and the text says so.
   */
  export function removeWarning(
    c: Pick<CategoryWithTotals, 'displayName' | 'expenseCount' | 'totalEur'>,
    month: string,
    today: string,
  ): RemoveWarning;
  /** The Undo bar's text, e.g. 'Removed “eating out” from October and 4 expenses'. */
  export function removedMessage(displayName: string, month: string, n: number): string;
  ```

  Copy (M = `monthName(month)`, the amount is `eur(toCents(totalEur))`, the count is `expenseCount(n)`):
  - title, always: `Remove “eating out” from October?`
  - the shared tail, `keep`: `Earlier months keep “eating out”; later months won’t have it. You can undo right after.`
    (the user's sentence, plus 018's last one)
  - On the last day (Gate A), or for a past month: when `shiftMonth(month, 1) <= addDays(today, 1).slice(0, 7)` (029's `keepNext`; see Deviations), `keep` is instead
    `Other months keep “eating out”. You can undo right after.`
    - This is the case 029 handles with `keepNext`. The next month keeps the category, and later months carry its
      list over, so the removal touches only that month. A later month whose own stored list already lacks the
      category stays without it, because it never had it.
    - The 0, 1 and n bodies, the actions and the Undo bar are otherwise unchanged.
    - The module reads no clock. `addDays` and `shiftMonth` already exist in `format.ts`.

  | n   | body                                                            | action                         | Undo bar                                           |
  | --- | --------------------------------------------------------------- | ------------------------------ | -------------------------------------------------- |
  | 0   | `It has no expenses in October. ${keep}`                        | `Remove from October`          | `Removed “eating out” from October`                |
  | 1   | `This also deletes its 1 expense in October (€12.50). ${keep}`  | `Remove and delete 1 expense`  | `Removed “eating out” from October and 1 expense`  |
  | 4   | `This also deletes its 4 expenses in October (€86.20). ${keep}` | `Remove and delete 4 expenses` | `Removed “eating out” from October and 4 expenses` |

- **App, route `/delete-category?categoryId=<id>&month=YYYY-MM`** (`app/delete-category.tsx`; the path is kept, see
  Open questions).
  - The header title becomes "Remove category". A missing or malformed `month` (`parseMonthParam`) shows "That link
    isn’t valid." like a bad id, and nothing is fetched.
  - Load states:
    - loading: a spinner;
    - `not_found`: "Category not found." (was "This category was deleted."; nothing can delete a category any more);
    - any other error: the existing text with Retry;
    - ready with `inMonth` false: `LoadError` `“eating out” isn’t in October.`, with no button;
    - ready with `inMonth` true: the warning and the button. `today` for `removeWarning` comes from
      `useState(() => kyivToday(new Date()))`, read once like the Category screen's `thisMonth`.
  - Remove calls `removeFromMonth`. Then it calls
    `setPendingUndo({ message: removedMessage(displayName, month, expenseCount), restore: () => restoreToMonth(ledgerId, categoryId, month) })`
    and `router.dismissTo('/')`.
  - On failure it stays on the screen with an announced inline alert:

    | Error         | Text                                                    | Remove button |
    | ------------- | ------------------------------------------------------- | ------------- |
    | `month_ended` | `October has ended, so it can’t change.`                | hidden        |
    | `not_found`   | `“eating out” isn’t in October any more.`               | hidden        |
    | other         | `Couldn’t remove. Check your connection and try again.` | kept          |

    The texts are built in the screen, as today (conventions §3: the screen maps codes).

  - There is no client-side "has this month ended?" check. The API decides (see Not doing).
- **App, Category screen (`app/category/[categoryId].tsx`):**
  - The ⋯ shows only when `category && !ended`.
  - `CategoryMenu({ label, onRemove, onClose })` shows `Remove from ${monthName(month)}` and pushes
    `{ pathname: '/delete-category', params: { categoryId, month } }`.
  - `NotInMonth` calls `useCategoryTotals(ledger.ledgerId, categoryId, month)`, and its states don't change.
- **New dependencies:** none.

## Slices

- [x] 1. Name a category its month lacks, instead of answering 404
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`.
  - Change: with `?month=`, `GET one` drops `inMonthList` from the WHERE and selects it as `in_month`. The params
    become `[first, first, next, categoryId, ledgerId]`. The answer adds `inMonth: Boolean(r.in_month)`. The DTO gets
    `inMonth?: boolean` ("with `?month=`"). The no-month query is unchanged.
  - Tests:
    - In "counts only one month's expenses with ?month=", the 2026-10 call also gives `inMonth: true`. After
      `storeMonthList(…, '2026-11', ['groceries'])`, `?month=2026-11` and `2026-12` give `200` with
      `toMatchObject({ techName: 'groceries', expenseCount: 0, totalEur: '0.00', inMonth: false })`.
    - The 404 test also covers `?month=2026-10` for the unknown, foreign and deleted ids.
    - In "removes it and its expenses from that month only, on its last day", eating_out `?month=2026-10` gives
      `{ inMonth: false, expenseCount: 0, totalEur: '0.00' }` after the removal. This is what the app reads after a
      Remove.
  - ≈ 35 lines.
- [x] 2. Add the texts for removing a category from a month
  - Files: `apps/mobile/src/data/categoryRemove.ts` (new), `apps/mobile/test/categoryRemove.test.ts` (new).
  - Change: `removeWarning` and `removedMessage` as in Contracts. They have no caller until slice 3, as in 018's
    slice 1.
  - Tests, `it.each` tables (month `'2026-10'`, name `eating out`, today `'2026-10-16'` unless stated):
    - "warns what goes in that month": `(4, '86.20')`, `(2, '1222.00')` (gives `(€1,222)` and
      `Remove and delete 2 expenses`), `(1, '12.50')` and `(0, '0.00')` each give the exact body and action from
      Contracts. The title is `Remove “eating out” from October?` in every row.
    - "names the month": `(1, '12.50')` with `'2026-09'` gives `… 1 expense in September (€12.50) …` and the title
      `… from September?`.
    - "says the next month keeps it on the month's last day":
      - With today `'2026-10-31'`, `(0, '0.00')`, `(1, '12.50')` and `(4, '86.20')` give the same bodies as above,
        with `Other months keep “eating out”.` in place of the whole
        `Earlier months keep “eating out”; later months won’t have it.` sentence. The actions are unchanged.
      - Month `'2026-12'` with today `'2026-12-31'` gives `Other months keep …` (across a year).
    - "only on that month's last day": the plain sentence for today `'2026-10-30'` (the day before), and for month
      `'2026-11'` with today `'2026-10-31'` (removing from a later month).
    - "says what Undo brings back": 0, 1 and 4 give the three bar texts.
  - ≈ 100 lines.
- [x] 3. Remove a category from one month, from its ⋯ menu, with Undo on Home
  - Files:
    - `apps/mobile/src/api/types.ts`
    - `apps/mobile/src/data/categories.ts`
    - `apps/mobile/src/data/useCategoryTotals.ts`
    - `apps/mobile/src/app/delete-category.tsx`
    - `apps/mobile/src/app/category/[categoryId].tsx`
    - deleted: `apps/mobile/src/data/categoryDelete.ts` and `apps/mobile/test/categoryDelete.test.ts`, which lose
      their last caller here.
  - Change: everything under Contracts for the app. Slice 1's API already gives `inMonth` with `?month=`, and both
    hook callers now send it.
  - The confirm screen's `inMonth: false` text and `NotInMonth`'s text are the same string,
    `“${displayName}” isn’t in ${monthName(month)}.`, built in each of the two screens. They aren't extracted,
    because there are only two uses (the rule of three, conventions §1).
  - Check: `rg -n "deleteCategory|restoreCategory|deleteWarning|deletedMessage|categoryDelete" apps` finds nothing.
  - Verify, on web 390×844 against this worktree's API (see Risks), as `claude-qa-032`:
    - **Setup.**
      - eating out: 2026-09-15 €12.50 and, in October, €20.00, €30.00 and €36.20. Also an October €5.00 expense,
        deleted on its own from the Category screen.
      - groceries: one October expense.
    - **AC1.**
      - Expenses → October → eating out shows the ⋯. It opens a menu with "Remove from October".
      - The confirm modal shows `Remove “eating out” from October?`, then `…its 3 expenses in October (€86.20)…`
        and `Remove and delete 3 expenses`. None of September's €12.50 is counted.
      - Cancel goes back to the same Category screen, with the same figures.
      - Remove lands on Home with `Removed “eating out” from October and 3 expenses · Undo`, and Home's Expenses figure
        drops by €86.20.
      - October's Expenses tab has no eating out, and its total dropped. September's still shows eating out with
        €12.50.
      - The expense form for today offers no eating out.
    - **AC2.**
      - Undo brings back October's eating out with the 3 expenses and €86.20. The €5.00 expense stays deleted.
      - Remove again. Make the restore fail with a console `fetch` wrapper that rejects URLs ending in `/restore`
        (017's QA trick). Undo shows "Couldn’t undo · Retry". Remove the wrapper, and Retry restores.
    - **AC3.**
      - September's eating out screen (Expenses ‹ to September) has no ⋯ and no "+".
      - Open `/delete-category?categoryId=<eating out>&month=2026-09` directly. It shows September's warning. Remove
        shows `September has ended, so it can’t change.` and the button goes. Nothing changed: September's tab still
        shows €12.50, and October is unaffected.
    - **The name lookup.**
      - After a Remove, `/category/<eating out>?month=2026-10` shows `“eating out” isn’t in October.` with no ⋯ or
        "+".
      - The confirm link for October shows the same text, with no button.
      - `/category/999999?month=2026-10` and `/delete-category?categoryId=999999&month=2026-10` show "Category not
        found.".
      - `/delete-category?categoryId=<id>` with no month shows "That link isn’t valid.".
    - **Copy.**
      - A category with 0 October expenses shows the 0 variant and `Remove from October`.
      - Today (16 Oct) isn't October's last day, so the warning says `Earlier months keep …`, not `Other months keep …`. The last-day variant isn't checked on web: faking the app's date there isn't practical, and the
        API's own clock would disagree. Slice 2's unit tests cover the rule and the copy, and the screen only passes
        `kyivToday(new Date())`.
      - Remove `medication` with several expenses: the bar wraps to at most 2 lines, with the count visible.
      - Double-click Remove sends one DELETE.
    - **Themes.** The menu, the confirm screen (all states above) and the bar in Light and Dark.
    - **iPhone (Expo Go)**, before the PR, for AC5:
      - the menu under the notch;
      - the confirm modal;
      - Remove landing on Home with the bar;
      - Undo;
      - September has no ⋯.
  - ≈ 90 lines added, ≈ 90 deleted (mostly the two old files).
- [x] 4. Remove the all-months category delete and restore from the API
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`,
    `apps/api/test/notion.int.test.ts`.
  - Change, `routes.ts`:
    - Delete both handlers and their comment.
    - Drop the now-unused `withTransaction` and `ResultSetHeader` imports. `now` is still used by the month routes.
  - Tests, `categories.int.test.ts`:
    - Delete the `del`/`restore` helpers, `describe('delete')`, `describe('restore')`, and the two guard rows.
    - In both 029 "404" tests, replace `del(groceries)` with
      `UPDATE categories SET deleted_at = ? WHERE category_id = ?`. The comment becomes "deleted before brief 028",
      the only way such a category exists now.
    - New `it('no longer deletes or restores a category in every month')`:
      - eating_out has an October expense.
      - `DELETE …/categories/<id>` and `POST …/categories/<id>/restore` each give `404 { error: 'not_found' }`.
      - `listOf('2026-10')` still has eating_out, and the expense's GET is still 200.
  - Tests, `notion.int.test.ts`: delete "follows a groceries category delete and restore". 029's
    `categories.int.test.ts` › "Notion after a removal › follows a removal from one month and its restore" already
    covers the same behaviour for the per-month routes.
  - ≈ 25 lines added, ≈ 150 deleted.
- [x] 5. Require the month on one category's totals
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`.
  - Change:
    - `OneQuery`'s month is required, with the comment "every caller sends it since brief 032".
    - The SQL is the final one in Contracts, with no `month ?` branches. The DTO is `inMonth: boolean`, with the new
      JSDoc.
  - Tests:
    - "gives a category's expense count and EUR total across all months" becomes "requires a month": `GET one` with no
      query, and with `?month=`, each give `400` with `toMatchObject({ error: 'invalid_request' })`.
    - The 404 test keeps only its `?month=2026-10` calls.
    - The guard row `['GET one', one]` passes unchanged: its checks fail before `month` is read.
  - ≈ 35 lines.
- [x] 6. State the per-month category rule in the conventions
  - Files: `.claude/skills/kopiyka-conventions/SKILL.md` (§3, the soft-delete bullet).
  - Change: the bullet becomes:

    > **Soft delete** for expenses (`deleted_at`) so Undo works; reads filter `deleted_at IS NULL` (a single
    > expense's GET, PUT and DELETE find it even when its category is deleted or not in its month's list; PUT still
    > checks the category it's given, and an expense's restore checks its own). **Each month has its own category list**
    > (`category_months`, brief 028): a live expense's category is in its month's list, and writes keep it so
    > (`400 category_not_in_month`). Removing a category from a month stamps its row and that month's live
    > expenses with one `deleted_at`, which its restore matches. Removing from or restoring to an ended month (Kyiv)
    > is refused (`409 month_ended`). `categories.deleted_at` only hides categories deleted before 028.

    It is wrapped at the file's width.

  - Verify: `yarn format:check`; the text matches slices 4–5 and 029's code.
  - ≈ 10 lines.

Total ≈ 295 lines added and ≈ 255 deleted, tests included. About 240 of the deletions are whole tests, handlers and
the old texts module.

That is over the ~400-line guideline only because of the deletions. Slices 3 and 4 are over ~150 for the same
reason. A split into slices 1–3 (the app) and 4–6 (the cleanup) would be possible. It isn't proposed, because 028's
Gate A put both in this part, so the PR that drops the all-months endpoints also replaces their only caller.

## AC → evidence

| AC                                                                                                                   | Evidence                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web: ⋯ → Remove from October shows October's count and total only; Home with the bar; October drops, September keeps | Slice 3 verify (AC1). `categoryRemove.test.ts` (copy). Slice 1 test (`?month=` after a removal gives `inMonth: false`, 0). 029's `GET one ?month=` and "removes it … only" tests                                                           |
| Web: Undo restores October's eating out and exactly its expenses; failed Undo shows "Couldn’t undo" + Retry          | Slice 3 verify (AC2: the €5.00 deleted on its own stays deleted; fetch wrapper). 029's "brings back exactly what that removal took"                                                                                                        |
| Web: September has no ⋯; Remove refused with `month_ended` shows the text and changes nothing                        | Slice 3 verify (AC3: September's screen; the direct confirm link for 2026-09). 029's "refuses a month that has ended in Kyiv, changing nothing"                                                                                            |
| API: 013's endpoints answer 404; their tests removed or replaced; `GET one` without `month` gives 400                | Slice 4 › "no longer deletes or restores a category in every month", with the 013 describes and guard rows removed, and the 013-based Notion test deleted (029's "Notion after a removal" covers it). Slice 5 › "requires a month"         |
| iPhone (Expo Go): menu, confirm, Remove landing on Home with the bar, Undo                                           | Slice 3 iPhone check before the PR, recorded in the PR's test plan                                                                                                                                                                         |
| Light and Dark; gates green                                                                                          | Slice 3 verify in both themes. `yarn format:check && yarn lint && yarn typecheck && yarn test` before every commit, with `DATABASE_URL_TEST` exported from `/Users/dmytro.kostylov/home/kopiyka/apps/api/.env`. Check the MySQL suites ran |
| What: the app's `deleteCategory`/`restoreCategory` and 018's copy go                                                 | Slice 3 (`rg` check above; files deleted)                                                                                                                                                                                                  |
| What: the Category screen's name lookup keeps working                                                                | Slice 1 test (`inMonth: false` with the name). Slice 3 verify ("The name lookup")                                                                                                                                                          |
| What: conventions §3 updated                                                                                         | Slice 6                                                                                                                                                                                                                                    |

## Not doing (YAGNI)

- **A client-side ended-month check on the confirm screen.** The ⋯ is already hidden on ended months. Only a typed
  link or a midnight crossing reaches the screen there, and the API's 409 answers both with the brief's text. The
  direct link is also how AC3's refusal is checked.
- **Renaming the route `/delete-category`, `useCategoryTotals` or `CategoryMenu`'s styles.** Remove still deletes that
  month's expenses, and a rename is a separate mechanical commit with no AC behind it (see Open questions).
- **The rest of the ended-month lock** (expense add, edit, delete and restore, the form's date picker): its own brief.
- **Dropping `categories.deleted_at`** and its filters (a follow-up after this part, per the brief).
- **Stopping Retry after a `409` on Undo.** A refused Undo after midnight shows "Couldn’t undo · Retry" until the bar
  times out, as the brief asks. That is the same as 013's note for a refused restore.
- **Create, rename and reorder** (014, 015).
- **Any change to Home, `undo.ts` or `UndoToast`.** The bar already wraps to 2 lines (018).

## Risks

- **The web check must use this worktree's API.** `inMonth` only exists there. Against `main`'s API, a month's missing
  category would show "Category not found.".
  - Before slice 3's verify, check with `lsof -iTCP:3000 -sTCP:LISTEN` and `lsof -p <pid> | grep cwd` that the API
    runs from `/Users/dmytro.kostylov/home/kopiyka-remove-in-app`. Start it there with the `api` launch config if not.
  - The dev DB already has 007 (shared), so no migration runs.
- **QA user, never ledger 1.**
  - In `apps/api` of the worktree, run
    `npx tsx --env-file=/Users/dmytro.kostylov/home/kopiyka/apps/api/.env scripts/create-user.ts --username claude-qa-032 --email claude-qa-032@example.test`,
    and keep the TOTP secret in the scratchpad.
  - Check that `GET /api/ledgers` lists only the QA ledger before any Remove. The ledger guard answers 404 for
    ledger 1 from that session. Never press Sync.
  - Delete the user and ledger after the PR, in the QA notes' cleanup order.
- **`EXISTS` in the select list with `GROUP BY`.** It ran on the test DB under `ONLY_FULL_GROUP_BY`, but only on empty
  data. Slice 1's tests settle it with data, both in and out of the list.
- **`router.dismissTo('/')` with an added `month` param.** It is the same route and call as 018, which was checked on
  web and iPhone. Slice 3's iPhone check covers it again.
- **Integration tests skip silently in a worktree** without `DATABASE_URL_TEST`. Slices 1, 4 and 5 must show the
  categories and Notion suites as run.

## Open questions

- **No.** `GET one ?month=` now answers a live category its month lacks with `200` and `inMonth: false`, not 404.
  This changes 029's contract, and its test is updated in slice 1. Assumption meanwhile: as planned. The
  alternatives, a name-only route or dropping the name from 030's message, are under Approach.
- **Decided at Gate A (user).** On a month's last day (Kyiv), the warning says "Other months keep “eating out”." in
  place of the whole "Earlier months …" sentence. `removeWarning` takes the Kyiv date as an input, as in Revision 2.
- **No.** The confirm route keeps its path `/delete-category` (now with `month`), and the header says "Remove
  category". Assumption meanwhile: no rename. A rename to `/remove-category` is a separate mechanical commit of
  about 10 lines.
- **No.** Error copy beyond the brief:
  - `“eating out” isn’t in October any more.` for a Remove answered 404;
  - `Couldn’t remove. Check your connection and try again.` for other failures;
  - "Category not found." for an unknown id on the confirm screen (was "This category was deleted.").

  Assumption meanwhile: as written.

- **No.** `month` is required on the confirm route, and a link without it is "That link isn’t valid.". The Category
  screen defaults to the current month, but nothing links here without one. Assumption meanwhile: required.

## Follow-ups

- Drop `categories.deleted_at` and its filters in a migration (028, 029). After slice 4, nothing sets it.
- `apps/mobile/src/linkParams.ts`: the comment says `MONTH_RE` mirrors `apps/api/src/expenses/routes.ts`. It lives in
  `apps/api/src/dates.ts` since 028 (030's follow-up, still open).
- `MONTH_RE` accepts `9999-12` (029's follow-up), which `GET one ?month=` shares.
- `apps/api/test/expenses.int.test.ts` asserts 404 twice in a row (028's follow-up).

## Deviations

- slice 2: `removeWarning`'s "only this month loses it" test is `shiftMonth(month, 1) <= addDays(today, 1).slice(0, 7)`,
  029's `keepNext`, instead of `===`. The web check showed the `===` form says "Other months keep" for September
  (whose next month is the current one) but "later months won’t have it" for August, though the API keeps the later
  months for both (found in slice 3's web check). Only the last day and past months (which the API refuses with `month_ended`) change. A unit test
  for a past month was added.

## Revision 1

- Skeptic #8 (required): slice 6's conventions bullet now says what a single expense's routes check. GET, PUT and
  DELETE find an expense even when its category is deleted or not in its month's list. PUT still checks the category
  it's given (`checkCategory`), and an expense's restore checks its own (`inMonthList(e.expense_date)`).
- Suggestions taken:
  - (a) Slice 4 deletes the 013-based Notion test instead of rewriting it, because 029's "Notion after a removal"
    covers it. Slice 4 is now about 25 added and 150 deleted, and the total is about 270 added and 255 deleted.
  - (b) Slice 3 notes that the "isn’t in October." string is built in two screens and is kept apart under the rule
    of three.
  - (c) Approach explains why `inMonth: false` counts are 0, both in the removed month and in later months.
- `inMonth` is kept.

## Revision 2 (Gate A)

- **Exact copy on a month's last day** (user):
  - When M's next month is the month of Kyiv tomorrow (029's `keepNext`), the warning says "Earlier months and
    {next month} keep “{name}”; later months won’t have it.".
  - `removeWarning` gets a pure `today: string` (Kyiv 'YYYY-MM-DD') and uses `addDays` and `shiftMonth` from
    `format.ts`. The confirm screen reads `kyivToday(new Date())` once, and `categoryRemove.ts` reads no clock.
- **Slice 2** adds table tests:
  - the last-day variant for 0, 1 and n, where only that sentence changes;
  - December to January;
  - the day before;
  - a later month removed on the last day.

  It is now about 100 lines.

- **Slice 3** adds a web check that a normal day shows the plain sentence. The last-day variant is covered by the
  unit tests, because faking the date on web isn't practical. It is now about 90 added and 90 deleted.
- The total is now about 295 added and 255 deleted.
- **Exact last-day wording** (user, after the coordinator's check): under 029's rule, a removal on a month's last
  day takes the category out of that month only. So the variant is now "Other months keep “{name}”." in place of the
  whole "Earlier months … keep …; later months won’t have it." sentence, with no month name. A later month whose own
  stored list already lacks the category stays without it, because it never had it. The slice 2 tests and Contracts
  use this wording. The Risks note about inexact copy is removed.

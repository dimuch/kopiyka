# Plan: Rename a category in one month, in the app

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md (outline: ../037-rename-category-in-month/plan.md, "Later part (brief 040, app, outline)")
Branch: feat/rename-category-in-app
Base: origin/main @ cc420d6 (037 API, 039 loader and 038 add category merged)

## Approach

The app only. The API is done: 037's `PUT /api/ledgers/:id/categories/:categoryId/months/:month/name`, and every
read already gives the month's name, so the Budget tab, Expenses tab, Category screen and expense form show a rename
once they reload.

- **Lift 038's name form into `components/CategoryNameForm.tsx`.** This is a pure move, now that rename is its second
  caller, as 038's plan asked. The form owns the field, the 1–40 check, Save, the error line and the busy guard.
  Sending is a callback, so the component never calls `api()`.
- **Add a `/rename-category?categoryId=&month=` modal**, shaped like `planned-amount.tsx`. It loads the category with
  039's `useCategoryTotals` + `CategoryInMonth`, and renders the form starting at the month's name.
- **Add `not_found` to `nameRefusedText`.** It returns 036's "“eating out” isn’t in November any more.", which names
  the category's current name, not the typed one.
- **The Budget tab:** each row outside an ended month splits into two sibling buttons. The row (tile, name, amount)
  still opens `/planned-amount`. A trailing 44×44 pencil opens the rename modal.

Alternative considered: a second, copied editor in `rename-category.tsx`, with no shared component. It's smaller by one
file, but it leaves two copies of the same save flow, field and styles (about 90 lines). 038's Consolidate already
left that copy for 040 to remove.

## Contracts

- **DB:** none.
- **API:** none, used as 037 built it:
  - `PUT /api/ledgers/:id/categories/:categoryId/months/:month/name`, body `{ "name": "food out" }`, answers 204;
  - `400 invalid_request` (empty or over 40 after trim, a bad month);
  - `400 name_taken`;
  - `409 month_ended` (checked first);
  - `404 not_found` (not in the month's list, or not a member);
  - `401` with no session.
- **App, `apps/mobile/src/data/categories.ts`:**

  ```ts
  /** Renames a category in a 'YYYY-MM' month only (brief 037); `name` is already trimmed. Screens reload on focus. */
  export async function renameInMonth(ledgerId: number, categoryId: number, month: string, name: string): Promise<void>;
  // await api(`/api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}/name`, { method: 'PUT', body: { name } });
  ```

- **App, `apps/mobile/src/data/categoryName.ts`.** This is a signature change, and the form (slice 1) is its only
  caller:

  ```ts
  /**
   * The text for a refused name in a 'YYYY-MM' month; null when `code` isn't a name refusal. `name` is the typed name;
   * `current` is the category's name in the month when renaming, null when adding (adding has no not_found).
   */
  export function nameRefusedText(code: string, name: string, month: string, current: string | null): string | null;
  // name_taken  → 'You already have a category called “groceries” in November.'   (typed name)
  // month_ended → monthEndedText(month)                                             (unchanged)
  // not_found   → current === null ? null : '“eating out” isn’t in November any more.' (036's text, current name)
  ```

- **App, `apps/mobile/src/components/CategoryNameForm.tsx` (new):**

  ```ts
  /**
   * A category's name field with Save, for adding (brief 038) and renaming (040) in a 'YYYY-MM' month: checks 1–40
   * characters, sends the trimmed name with `save`, and shows a refusal's text.
   */
  export function CategoryNameForm(props: {
    month: string;
    /** Added in slice 3. The category's name in the month when renaming (the field starts at it); null when adding. */
    current: string | null;
    caption: string;
    busy: boolean;
    setBusy: (busy: boolean) => void;
    /** Sends the checked name and leaves on success; rejects (an ApiError with a code) when refused. */
    save: (name: string) => Promise<void>;
  });
  ```

  The body is `add-category.tsx`'s `Editor`, moved:
  - It keeps its state: `text` (starts at `current ?? ''`), `error`, `gone` and `inFlight`.
  - It keeps `showError` with `announceForAccessibility`, and the `TextInput` with its label "Category name",
    `autoFocus` and `autoCapitalize="none"`.
  - It keeps the alert-role error line, the Save button hidden when `gone`, and the styles `body`, `caption`, `input`,
    `error`, `primary` and `primaryText`.

  Its catch sets `gone` to `code === 'month_ended' || (code === 'not_found' && current !== null)`. The text is
  `nameRefusedText(code, name, month, current)`, or "Couldn’t save. Check your connection and try again.". So adding
  keeps 038's exact behaviour.

- **App, route `/rename-category?categoryId=4&month=2026-10`** (`apps/mobile/src/app/rename-category.tsx`, new):
  - It is registered in `_layout.tsx`'s `Stack.Protected guard={signedIn}` as `presentation: 'modal'`.
  - The header has Cancel, the title "Rename category" and a 52pt spacer.
  - The body is `CategoryInMonth`, so its texts are 039's: a bad link gives "That link isn’t valid.", 404 gives
    "Category not found.", and a category not in the month gives "“x” isn’t in November.", all without a form.
  - Then `CategoryNameForm` with `current={category.displayName}` and the caption "Only for November. Other months
    keep their names.".
  - Its `save` is `renameInMonth(…)`, then `leave(month)`.
- **App, the Budget tab** (`apps/mobile/src/app/(tabs)/budget.tsx`). A row outside an ended month becomes a `View`
  (`styles.row` + divider) holding two sibling `Pressable`s:
  - The row's main button keeps today's label and hint ("Sets the planned amount"), and it pushes `/planned-amount`.
  - The pencil button, 44×44, has `accessibilityRole="button"` and
    `accessibilityLabel={`Rename ${c.displayName} in ${monthName(month)}`}`. It pushes
    `{ pathname: '/rename-category', params: { categoryId: c.categoryId, month } }`.

  Ended rows are unchanged: a plain `View`, with no pencil.

- **App, `components/Icon.tsx`:** a new `edit` glyph (a pencil, in the same 24×24 round-cap stroke style):
  `['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4']`.
- **`api/types.ts`:** unchanged. `displayName` already carries the month's name (037).
- **Reuses:**
  - `useCategoryTotals` + `CategoryInMonth` (039), `normalizeName` and `nameRefusedText` (038), `monthEndedText`;
  - `parseIdParam` and `parseMonthParam`, `monthName`, `Icon`;
  - `planned-amount.tsx`'s header, `leave(month)` and the busy / `Stack.Screen gestureEnabled={!busy}` shape.
- **New dependencies:** none.

## Slices

- [x] 1. Move the add-category name form into a shared component
  - Files: `apps/mobile/src/components/CategoryNameForm.tsx` (new), `apps/mobile/src/app/add-category.tsx`.
  - Change: a mechanical move. In slice 1 the props are `{ month, caption, busy, setBusy, save }`, and the field
    starts at `''`.
    - Calls to `addToMonth` and `leave` move out of the form and into `add-category.tsx`'s
      `save={async (name) => { await addToMonth(ledger.ledgerId, month, name); leave(month); }}`.
    - `add-category.tsx` keeps its header, the invalid-link `LoadError`, `leave()` and the styles `screen`, `header`,
      `cancel`, `cancelText` and `title`.
    - No text, style value or behaviour changes.
  - Size: about 210 diff lines, about 190 of them moved (net about +15).
  - Verify: typecheck, lint and `yarn mobile test`. On web at 390×844, re-run 038's slice 5 editor checks against
    `/add-category?month=<this month>`:
    - an empty or 41-character name gives "A name needs 1 to 40 characters." and no POST in the API log;
    - `rent` gives the duplicate message;
    - a new name returns to the Budget tab with it listed;
    - `?month=<last month>` gives the ended text, and Save disappears.

- [x] 2. Add the app's rename call and the "no longer in the month" text
  - Files:
    - `apps/mobile/src/data/categories.ts` (`renameInMonth`);
    - `apps/mobile/src/data/categoryName.ts` (the `current` param, `not_found`);
    - `apps/mobile/src/components/CategoryNameForm.tsx` (passes `null` for now);
    - `apps/mobile/test/categoryName.test.ts`.
  - Change: as in Contracts. About 35 lines.
  - Tests, in `categoryName.test.ts`: the `nameRefusedText` table gains the `current` column.
    - `('name_taken', 'groceries', '2026-11', 'food')` → the duplicate text for "groceries" in November, the typed
      name, not the current one.
    - `('name_taken', 'pets', '2026-11', null)` → the same text for "pets" (adding).
    - `('month_ended', 'pets', '2027-01', null)` → `'January has ended, so it can’t change.'`.
    - `('not_found', 'food out', '2026-11', 'eating out')` → `'“eating out” isn’t in November any more.'`.
    - `('not_found', 'pets', '2026-11', null)` → null.
    - `'invalid_request'` and `'unknown'` → null, with `current` both null and `'rent'`.

- [ ] 3. Add a rename editor for a category in one month
  - Files:
    - `apps/mobile/src/components/CategoryNameForm.tsx` (the `current` prop: the field's start and the
      `nameRefusedText` arg, and `gone` on `not_found`);
    - `apps/mobile/src/app/add-category.tsx` (`current={null}`);
    - `apps/mobile/src/app/rename-category.tsx` (new);
    - `apps/mobile/src/app/_layout.tsx`.
  - Change: as in Contracts. About 75 lines. `rename-category.tsx` copies `planned-amount.tsx`'s header and
    `leave(month)`; see Follow-ups.
  - Verify, on web at 390×844 (launch configs `web` + `api` from this worktree, QA user `claude-qa-040`).
    - **Setup:** seed September (ended) with the ledger's categories, with raw SQL in a scratch script
      (`INSERT … category_months` for `2026-09-01`, as `apps/api/test/helpers.ts`' `storeMonthList` does). The app
      can't set up an ended month, and slice 4 reuses this.

    Opening links directly:
    - `/rename-category?categoryId=abc&month=2026-10` → "That link isn’t valid.".
    - eating out in `<this month>` opens at "eating out", with the caption naming the month.
    - Clearing the field, or typing 41 characters, then Save → "A name needs 1 to 40 characters.", and no PUT in the
      API log.
    - `Rent` (another category's name) → "You already have a category called “Rent” in October.".
    - `food out` → back on the Budget tab, which lists "food out" with its tile colour unchanged.
    - `gym`, removed from the month (Category screen ⋯) → "“gym” isn’t in October.", with no field.
    - With the editor open, remove that category in another tab, then Save → "“food out” isn’t in October any more.",
      and Save disappears.
    - `?month=<last month>` for a category on its list → Save gives "September has ended, so it can’t change.", and
      Save disappears.
    - `/add-category` still behaves as in slice 1 (one quick check: `rent` → duplicate message).
    - **Reset for slice 4:** on October's Budget tab, add `eating out` and the category removed above back with Add a category (038 brings back their removed rows), and rename `food out` back to `eating out` if it's still listed. October then has every seeded category under its seeded name again.

    Then typecheck and lint.

- [ ] 4. Add a rename button to each Budget row outside ended months
  - Files: `apps/mobile/src/components/Icon.tsx` (`edit`), `apps/mobile/src/app/(tabs)/budget.tsx`.
  - Change: as in Contracts. About 45 lines. Row styles:
    - ended rows keep `styles.row`;
    - an open row's outer `View` gets a new padding-free style (`flexDirection: 'row', alignItems: 'center'`) plus the divider;
    - the main `Pressable` gets `[styles.row, { flex: 1 }]`;
    - the pencil is a centred 44×44 box with `Icon name="edit"` in `colors.muted`, size 18 (like the plus icon in `budget.tsx`).
  - Verify, on web at 390×844, as `claude-qa-040`. Setup: September as seeded in slice 3. Copy October into November
    on the Budget tab before renaming, so November has its own rows.

    Checks:
    - **October:** each row shows a pencil. Tapping the row still opens "Planned amount". The pencil opens "Rename
      category" at that row's name.
    - **Rename** eating out → `food out`. October shows "food out" on:
      - the Budget tab;
      - the Expenses tab (row and tile initial);
      - the Category screen (`/category/<id>?month=2026-10`);
      - the expense form's category sheet (+ on the Expenses tab, date in October).
    - **Other months keep theirs:** on November's Budget and Expenses tabs, and in the form with a November date, it's
      still "eating out", and so is September's Budget tab. The tile colour is the same in all three.
    - **September** (ended) rows have no pencil and aren't buttons.
    - **Keyboard and VoiceOver order on web:** row, then "Rename eating out in October".
    - **On iPhone (Expo Go)** the user checks that the pencil opens the editor, a rename shows on the Budget tab, and
      the modal can't be swiped away while saving.

Estimated total: about 365 diff lines (1: 210, of which about 190 moved; 2: 35; 3: 75; 4: 45), about 170 net new.

## AC → evidence

| AC (brief 040)                                                                                                             | Evidence                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App (web 390×844): renaming changes the name on Budget, Expenses tab, Category screen and expense form for that month only | Slice 4's web checks: the October rename shows on all four, and November and September keep "eating out". The API side is covered by 037's `rename in a month` and copy tests (already on main). |
| App: an empty or too-long name shows the inline message and sends nothing; a duplicate shows the duplicate message         | `categoryName.test.ts` → `normalizeName` table (038) and the `name_taken` rows (slice 2). Slice 3's web checks: the message, no PUT in the API log, the duplicate text.                          |
| App: an ended month's rows have no pencil button                                                                           | Slice 4's September check.                                                                                                                                                                       |
| iPhone (Expo Go): rename works                                                                                             | The user's Expo Go check (slice 4), recorded in the PR's test plan.                                                                                                                              |
| Gates green                                                                                                                | `yarn format:check && yarn lint && yarn typecheck && yarn test` on every slice.                                                                                                                  |
| Brief: the editor starts at the current name, with Save                                                                    | Slice 3's "opens at eating out" check.                                                                                                                                                           |
| Brief: an ended month, or a category no longer in the month, shows 036's texts and hides Save                              | `categoryName.test.ts` → the `not_found` and `month_ended` rows (slice 2). Slice 3's web checks: the removed category (load and save) and last month.                                            |
| Brief: the row's own tap still sets the planned amount; tile colours don't change; other months keep their names           | Slice 4's web checks (the row opens "Planned amount", same tile colour, November and September).                                                                                                 |

## Not doing (YAGNI)

- **Rename from the Category screen's ⋯ menu**, adding categories (038) and reordering (015). The brief leaves them
  out.
- **A client-side duplicate or ended-month check.** The server decides, as in 038. The pencil is hidden in an ended
  month, and a deep link gets the 409 text.
- **Skipping the PUT when the name is unchanged.** The API answers 204, and the screen leaves either way.
- **Selecting the whole name on focus** (`selectTextOnFocus`). The brief only says the editor starts at the current
  name.
- **A lighter loader for the editor.** `useCategoryTotals` also loads the month's totals, which the editor ignores.
  It's the shared loader 037's outline asked for, and planned-amount and delete-category use it the same way.
- **Sharing `leave(month)` in this plan.** It is navigation, and §2 gives it no home. Phase 3a decides (Follow-ups).
- **Changes to `api/types.ts`, the API or `data/monthEnded.ts`.**

## Risks

- **Nested buttons.** A pencil inside the row's `Pressable` would nest `role="button"` on web. On iOS, VoiceOver would
  fold it into the row's single element, so it couldn't be reached. The two siblings inside a `View` avoid both.
  Slice 4's keyboard/VoiceOver-order check on web, and the user's iPhone tap, prove it.
- **Slice 1 is a move of about 190 lines,** over the ~150 slice target, but mechanical. Its proof is re-running 038's
  editor checks unchanged. If the skeptic prefers, slices 1 and 3 can merge, at the cost of a mixed move-and-change
  commit.
- **Row layout at 390pt.** The pencil takes 44pt from the name. A 40-character name wraps, as it does today. Slice 4's
  check at phone width, with one long name, shows whether the amount column still fits.
- **Overlap with open PR #54 (brief 041).** None of this plan's files are in #54. #54 touches `expense.tsx`,
  `DateField`, `DateChips`, `CategoryPicker`, `AmountFields`, `undo.ts`, `UndoToast`, `data/monthEnded.ts`,
  `data/expenseLock.ts` and `category/[categoryId].tsx` (checked with `gh pr view 54`). Whichever merges second
  rebases cleanly. Slice 4's expense-form check runs on this branch's `expense.tsx`; after #54 an ended month's form is
  read-only, which doesn't affect renaming in an open month.
- **The web check must use this worktree's API and Metro** (`lsof -iTCP:3000 -sTCP:LISTEN`, then the process's cwd).
  `claude-qa-040` is created with `yarn api create-user` and deleted after the merge. No API code changes, so
  integration tests aren't the evidence here; `yarn test` still runs them when `DATABASE_URL_TEST` is exported.
- **Month rollover.** Today is 2026-10-25. If the build crosses 1 November, October becomes the ended month in the
  checks. Shift every month in slices 3 and 4 by one.

## Open questions

- **No:** the texts the brief doesn't give. Assumed:
  - the title is "Rename category" and the caption "Only for November. Other months keep their names.";
  - the pencil's label is "Rename eating out in November";
  - the placeholder stays "Name".
- **No:** `nameRefusedText` gains a `current` param, instead of a separate `notInMonthText`. The not_found text names
  the category's current name, not the typed one, and the form needs one place to map a code to text. 038's plan
  expected `not_found` to be added to `nameRefusedText`.
- **No:** adding keeps 038's behaviour for a 404 (generic text, Save stays). The add route has no 404 of its own, only
  the guard's.

## Follow-ups

- `leave(month)` (`canGoBack` → `back`, else `/budget?month=`) is now in three screens: `add-category.tsx`,
  `planned-amount.tsx` and `rename-category.tsx`. By the rule of three this is a Phase 3a EXTRACT candidate. A
  possible home is a small `src/closeToBudget.ts` (navigation, next to `linkParams.ts`); `delete-category.tsx`,
  `expense.tsx` and `category/[categoryId].tsx` go back elsewhere.
- `planned-amount.tsx` and `delete-category.tsx` still write 036's "isn’t in November any more." inline, and
  `categoryName.ts` now has a third copy. A shared `notInMonthText(name, month)` is a Phase 3a candidate. It would
  change no text.
- Conventions §3: 037's follow-up note "names are per month" still stands. This plan doesn't change any stated fact.

## Deviations

- slice 1: the form's own submit handler is `submit()`, since `save` is now its prop. Web checks reuse QA user
  `claude-qa-038` (ledger 21) instead of a new `claude-qa-040`; its ledger already has a seeded September list.

## Consolidate

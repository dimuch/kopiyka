# Plan: Income tab

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Design source: ../058-ledger-income/plan.md, Part 2 (slices 2.1–2.5), re-checked against the merged code below
Branch: feat/income-tab
Base: origin/main @ d55d790 (058's income API merged)

## Summary and split (decided by the user)

Planned in full, this comes to about 620 changed lines. That is more than 058 guessed (~560): the add form alone is
about 190 lines once it's drafted. That is over the ~400-per-brief guide, so it splits into two sequential briefs,
not stacked PRs. **This branch builds Part 1 (slices 1–5) only.**

| Part | Brief                                    | Slices | What members get                                     | Est. lines |
| ---- | ---------------------------------------- | ------ | ---------------------------------------------------- | ---------- |
| 1    | 059 (this one, narrowed)                 | 1–5    | The Income tab: month switcher, items, total, add    | ~405       |
| 2    | `../061-income-edit-copy/brief.md` (new) | 6–8    | Edit an item, delete an item, copy last month's list | ~215       |

- In the same commit as this plan: `brief.md` keeps only what slices 1–5 deliver, with a top line 'Part 1 of 2 of
  the Income tab'. The edit, delete and copy "What" bullets and AC halves move into
  `docs/features/061-income-edit-copy/brief.md`, which says 'plan this brief from ../059-income-tab/plan.md, slices
  6–8'. `docs/features/060-income-limit/brief.md` now ships only after 061 is live.
- **Ship order: 059 → 061 → 060.**

- I don't use 058's 2a/2b split (tab + copy, then the modal). Production has no income yet, so a tab that can only
  list and copy would always be empty. The split above makes 059 useful on its own: members can enter income.
- 060 (the rule) ships after 061, not just after 059. Its slice 3.2 shows the over-income message in the income
  edit and delete paths, and those arrive in 061.
- Slices 6–8 below are Part 2's design: 061's plan copies them as written, re-checked against main once 059 has
  merged.

## Approach

- **App only.** 058's routes are used as merged (`apps/api/src/income/routes.ts`), so there are no API, DB or
  `ApiError` changes. `ApiError.body` is 060's (Part 3) and isn't needed here.
- **The tab** is `(tabs)/income.tsx`, placed after Budget and shaped like the Budget tab:
  - a header with `HomeButton`, `MonthSwitcher` (the month lives in the route) and "+";
  - a section head "Income · €X total" over a list card of rows (title, "Added by {username}", amount);
  - the empty-month card, with Copy last (slice 8).
- **The data:** `useIncome(ledgerId, month)` loads a month's items on focus, shaped like `useMembers`/`useMonth`.
  The tab uses it for the shown month and, for Copy, the previous one. The modal uses it to find the item it edits,
  because there is no GET-one route.
- **The modal** is `app/income-item.tsx`: `?month=` adds and `&incomeId=` edits or deletes. It is shaped like
  `planned-amount.tsx`: Cancel, `gestureEnabled: !busy`, an `inFlight` ref, refusals that hide Save. It reuses
  `normalizeName` (1–40 code points, same as the API's `title`), `normalizeAmount` (> 0, comma allowed) and the
  expense form's `AmountField` (label "Amount in EUR", € prefix, decimal pad), exported for this.
- **Reshape first:** `NoBudget` becomes `EmptyMonth` with a `text` prop, so Income's empty month reuses the card
  (and its Copy action) instead of copying it. Had income existed from the start, the card would have taken its text.

Alternative considered: a two-screen pair (`add-income` / `edit-income`) sharing a `components/IncomeForm.tsx`, like
the category screens. That's the same total plus one more file. It only shrinks slice 4 if the form lands as a
component with no caller yet, which leaves nothing to verify. One route for add and edit is what the expense form
does, and it keeps 058's contract.

## Contracts

- **DB:** none. **API:** none new. The app calls 058's routes, all under `[requireAuth, requireLedger]`:

  | Call                                              | Success                                     | Errors the app handles                                          |
  | ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
  | `GET /api/ledgers/:id/months/:month/income`       | 200 `{ items: IncomeItemDto[] }` oldest 1st | any → load error with Retry                                     |
  | `POST /api/ledgers/:id/months/:month/income`      | 201 `IncomeItemDto` (not read; tab reloads) | 409 `month_ended`; other → generic                              |
  | `PUT /api/ledgers/:id/income/:incomeId`           | 204                                         | 404 `not_found`, 409 `month_ended`; other → generic             |
  | `DELETE /api/ledgers/:id/income/:incomeId`        | 204                                         | 404 `not_found`, 409 `month_ended`; other → generic             |
  | `POST /api/ledgers/:id/months/:month/income/copy` | 204                                         | 409 `income_exists`, `no_previous_income`, `month_ended`; other |

  Body for POST/PUT: `{ title: string, amount: string }`, a decimal string > 0 with at most 2 decimals. 401 and
  `404 ledger_not_found` are already handled by `api()` (`onUnauthorized`, `onLedgerGone`).

- **`apps/mobile/src/api/types.ts`:**

  ```ts
  /** A ledger's income item in one month (brief 058); any member edits or deletes it. */
  export interface IncomeItem {
    incomeId: number;
    title: string;
    /** Decimal string > 0, as stored: '2500.00'. */
    amountEur: string;
    /** Username of the member who added it (or copied it in); an edit by someone else doesn't change it. */
    addedBy: string;
  }
  ```

- **`apps/mobile/src/data/useIncome.ts`:**
  `useIncome(ledgerId: number, month: string): { items: IncomeItem[] | null; error: boolean; reload: () => void }`.
  It reloads on focus. `items` is null until this ledger and month have loaded, and a failed refetch keeps them and
  sets `error`. It uses `useMembers`' tagging, keyed `${ledgerId}/${month}`.
- **`apps/mobile/src/data/monthSummary.ts`:** `incomeCents(items: IncomeItem[]): number`, the month's income in
  integer cents.
- **`apps/mobile/src/data/income.ts`** (new). Each call lands in the slice that first uses it. All return
  `Promise<void>`, and screens reload on focus.
  - `addIncome(ledgerId, month, title, amount)` (4): positional, like `setPlanned`/`addToMonth`; `title` already
    trimmed, `amount` from `normalizeAmount`;
  - `updateIncome(ledgerId, incomeId, title, amount)` (6);
  - `deleteIncome(ledgerId, incomeId)` (7);
  - `copyPreviousIncome(ledgerId, month)` (8).
- **`apps/mobile/src/data/monthCopy.ts`:** `copyRefusedText` gains `income_exists` → "{Month} already has income."
  and `no_previous_income` → "{Previous} has no income to copy.". Its JSDoc becomes "The Budget and Income tabs'
  text…".
- **`components/NoBudget.tsx` → `components/EmptyMonth.tsx`:**
  `EmptyMonth({ text: string; action?: { label; onPress; busy }; note?: string | null })`. It has three callers:
  Budget, Expenses and Income.
- **`components/AmountFields.tsx`:** `AmountField` becomes exported, unchanged:
  `({ currency: Currency; value: string; onChangeText: (text: string) => void; editable: boolean })`.
- **`components/Icon.tsx`:** `income: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14']` (an arrow into a tray).
- **Routes:**
  - `(tabs)/income.tsx` is `/income?month=YYYY-MM`. A missing or bad month opens the current Kyiv month. It goes in
    `TABS` after Budget: Home, Budget, Income, Expenses, Statistics, Settings.
  - `app/income-item.tsx` is `/income-item?month=YYYY-MM` (add) or `&incomeId=N` (edit, delete). It is registered in
    `app/_layout.tsx` with `presentation: 'modal'`. It closes with `router.back()`, or with
    `router.replace({ pathname: '/income', params: { month } })` when opened from a link (`'/income'` when the month param
    is bad, like `closeToBudget`): a local `leave(month: string | null)`, as `expense.tsx` and `members.tsx` each
    keep their own.
- **Texts** (proposed):

  | Where                    | Text                                                                                              |
  | ------------------------ | ------------------------------------------------------------------------------------------------- |
  | Empty month              | "No income for November yet"                                                                      |
  | Section head             | "Income" · "€2,800 total"                                                                         |
  | Row (a11y, slice 6)      | label "Salary, €2,500, added by dimuch", hint "Edits the item"                                    |
  | "+" (a11y)               | "Add income to November"                                                                          |
  | Tab load / refresh error | "Couldn’t load this month’s income. Check your connection and try again." / "Couldn’t refresh. …" |
  | Modal title, caption     | "Add income" / "Edit income"; "Income for November"                                               |
  | Fields                   | "Title" (placeholder "e.g. Salary"); `AmountField` "Amount in EUR"                                |
  | Client checks            | "A title needs 1 to 40 characters." / "Enter an amount in euros above 0, like 2500 or 2500.50."   |
  | `month_ended`            | `monthEndedText`: "November has ended, so it can’t change." (Save and Delete hide)                |
  | `not_found`, not in list | "This income item isn’t in November any more." (Save and Delete hide)                             |
  | Other failures           | "Couldn’t save. Check your connection and try again." / "Couldn’t delete. …"                      |
  | Modal load error         | "Couldn’t load November’s income. Check your connection and try again." + Retry                   |
  | Bad link                 | "That link isn’t valid."                                                                          |
  | Delete                   | "Delete item" (`dangerText`)                                                                      |
  | Copy                     | "Copy October’s income"; "Couldn’t copy. …"; "Couldn’t check October’s income. …" + Retry         |

- **Reuses:** `useMembers`/`useMonth` hook shape, `MonthSwitcher`, `HomeButton`, `LoadError`, `EmptyMonth`,
  `AmountField`, `normalizeName`, `normalizeAmount`, `eur`, `toCents`, `kyivMonth`, `shiftMonth`, `monthName`,
  `parseMonthParam`, `parseIdParam`, `usePushOnce`, `monthEndedText`, `copyRefusedText`, `dangerText`, and Budget's
  copy flow (`inFlight`, `refused`/`failed` tagged by ledger and month, `copiedOver`).
- **New dependencies:** none.

## Slices

### Part 1: list and add income (059, this branch)

Each UI slice is checked on web at 390×844 with the
launch configs `api` and `web` from this worktree, as a QA user. Run in light and dark where the slice adds styles.
Seed items with raw SQL on the dev DB until slice 4 can add them. Today is 2026-11-02, so October is ended and
November is open. Gates run before every commit, with `DATABASE_URL_TEST` exported so the API integration tests
run.

- [x] 1. Let the empty-month card say what the month lacks (~25)
  - Files: `git mv apps/mobile/src/components/NoBudget.tsx …/EmptyMonth.tsx`, `(tabs)/budget.tsx`,
    `(tabs)/expenses.tsx`.
  - Change: the `month` prop becomes `text`, and the component is renamed. Both callers pass
    `` `No budget for ${monthName(month)} yet` ``. This is behaviour-preserving.
  - Verify: Budget and Expenses on an empty month whose previous month has categories (e.g. 2026-12, while it's still
    empty) read and look as before, and Budget's Copy still shows. On an empty month after an empty one (e.g.
    2027-03), the card shows no Copy. Typecheck, lint.
- [ ] 2. Load a month's income items in the app (~60)
  - Files: `api/types.ts` (`IncomeItem`), `data/useIncome.ts` (new), `data/monthSummary.ts` (`incomeCents`),
    `test/monthSummary.test.ts`.
  - Change: as in Contracts. This is the conventions' "types + data hook" step. Slice 3 is its caller.
  - Tests: `incomeCents` sums `'2500.00'`, `'300.50'` and `'0.01'` to 280051 (250000 + 30050 + 1), `[]` to 0, and
    `'0.10'` + `'0.20'` to exactly 30.
- [ ] 3. Show a month's income on a new Income tab (~115)
  - Files: `components/Icon.tsx` (`income`), `(tabs)/_layout.tsx` (a `TABS` entry; the iOS label comment becomes
    "6 of 6"), `(tabs)/income.tsx` (new).
  - Change: the tab (Approach), with no "+" yet and rows as plain `View`s:
    - loading spinner;
    - first-load error, with Retry;
    - refresh error over kept items, with Retry;
    - section head with `eur(incomeCents(items))`;
    - an empty month's `EmptyMonth` with no action.
  - Verify:
    - six tab icons fit at 390pt, and Income sits after Budget with the tray icon;
    - two November items seeded by different users show oldest first, each with "Added by …", and the total;
    - the switcher moves to October and December (empty → "No income for December yet") and updates `?month=`;
    - stopping `api` and switching month shows Retry, and restarting plus Retry loads.
- [ ] 4. Add an income item in a modal opened by link (~190)
  - Files: `app/income-item.tsx` (new), `app/_layout.tsx` (`Stack.Screen name="income-item"`, modal),
    `data/income.ts` (new: `addIncome`), `components/AmountFields.tsx` (export `AmountField`).
  - Change: the screen is a header (Cancel disabled while busy, "Add income", spacer) plus
    `IncomeForm({ month, busy, setBusy })`. A bad `month` shows "That link isn’t valid.", and Cancel there does
    `router.replace('/income')`, like `closeToBudget`. The form has:
    - the caption;
    - a Title field (visible label, `accessibilityLabel="Title"`, `autoFocus`);
    - `AmountField currency="EUR"`;
    - an alert-role error line, announced for VoiceOver;
    - Save, with a spinner while busy.

    Save checks `normalizeName` and then `normalizeAmount`, each with its hint, and sends nothing on a bad input.
    Then it calls `addIncome` directly and `leave(month)`. `month_ended` shows `monthEndedText` and sets `gone` (fields read-only,
    no Save); anything else shows the generic text.

    About 190 lines, most of them the form and its copied styles. Like 036's planned-amount modal (241), the
    screen can't usefully be split further: see Open questions.

  - Verify (open the links directly):
    - `/income-item?month=2026-11`: Salary / `2500` saves and lands on `/income?month=2026-11`, which lists it with
      "Added by" the QA user and the new total;
    - an empty title, then amounts `0`, `abc` and `1.234`, each show their hint with no POST in the API log;
      `2500,5` saves as €2,500.50;
    - `?month=2026-10` → Save shows "October has ended, so it can’t change." and Save disappears;
    - `?month=2026-13` → "That link isn’t valid.";
    - with the network throttled, Cancel is disabled while saving.
- [ ] 5. Add income from the Income tab's "+" (~15)
  - Files: `(tabs)/income.tsx`.
  - Change: "+" (`Icon plus`, 44pt, label "Add income to November") shows once the month has loaded and if it
    hasn't ended. It opens `/income-item?month=` with `usePushOnce`.
  - Verify:
    - November: "+" → add Freelance `300.50` → back on the tab, listed after Salary, and the total updates;
    - October shows no "+";
    - an empty December gets "+" too, and adding there replaces the empty card.

### Part 2: edit, delete and copy income (brief 061, not built on this branch)

- [ ] 6. Edit an income item from its row (~90)
  - Files: `data/income.ts` (`updateIncome`), `app/income-item.tsx`, `(tabs)/income.tsx`.
  - Change:
    - **Rows:** in a month that hasn't ended, each row becomes a `Pressable` (role button, the row label and hint
      from Texts). It opens `/income-item?month=&incomeId=` via `usePushOnce`. Rows in an ended month stay
      `View`s.
    - **Screen:** a present but malformed `incomeId` shows "That link isn’t valid.". Otherwise the title is "Edit
      income", and an `EditLoader` calls `useIncome(ledgerId, month)`:
      - while loading, a spinner;
      - no items and an error: the modal load error, with Retry;
      - the item not in the list: "This income item isn’t in November any more.", with no Retry;
      - otherwise `IncomeForm key={incomeId}` with a new `initial: IncomeItem | null` prop that pre-fills both
        fields.
    - **Form:** it gains a `save: (title: string, amount: string) => Promise<void>` prop: the add screen passes
      `addIncome`, the edit screen `updateIncome`. Slice 4 called `addIncome` directly, since one caller needed no
      prop. `not_found` shows the not-in-list line and sets `gone`.
  - Verify:
    - edit the other member's Salary to "Salary (net)" / `2400`: the row and total update, and "Added by" still
      names the other member;
    - an October row isn't a button (no pointer, no role);
    - a link to a deleted id (`&incomeId=999999`) shows the not-in-list line;
    - `&incomeId=abc` → "That link isn’t valid.";
    - delete the item with SQL while its form is open, then Save → the not-in-list line, and Save disappears.
- [ ] 7. Delete an income item from its form (~40)
  - Files: `data/income.ts` (`deleteIncome`), `app/income-item.tsx`.
  - Change: `IncomeForm` gains `remove?: () => Promise<void>`, passed only when editing. "Delete item" sits under
    Save and hides with it when gone. It shares `inFlight`/`busy` with Save and deletes at once (no confirm, no
    Undo; see Open questions), then `leave(month)`. `month_ended` and `not_found` show their lines and set `gone`;
    anything else shows "Couldn’t delete. …".
  - Verify:
    - delete Freelance: back on the tab, gone, and the total drops;
    - delete the last item: the empty card shows;
    - an October item's link → Delete shows the ended line;
    - with the item already deleted by SQL → the not-in-list line.
- [ ] 8. Copy last month's income on an empty Income tab (~85)
  - Files: `data/income.ts` (`copyPreviousIncome`), `data/monthCopy.ts`, `test/monthCopy.test.ts`,
    `(tabs)/income.tsx`.
  - Change: the tab also calls `useIncome(ledgerId, shiftMonth(month, -1))`. "Copy {Previous}’s income" shows on
    the empty card when:
    - the month hasn't ended;
    - the previous month has loaded with items;
    - there's no refusal for this ledger and month;
    - the items aren't the ones loaded before a successful copy.

    This is Budget's flow, the second copy of it (see Follow-ups). A refusal shows `copyRefusedText` and reloads
    both months. A failure shows "Couldn’t copy. …". A previous-month load error shows its LoadError with Retry.

  - Tests: `copyRefusedText` rows `('income_exists', '2026-11')` → "November already has income." and
    `('no_previous_income', '2027-01')` → "December has no income to copy.". The existing rows stay.
  - Verify:
    - December (empty) with November's two items → Copy → both appear with their amounts, "Added by" the QA user,
      and Copy is gone without flashing back;
    - January 2027 with December empty shows no Copy;
    - October shows no Copy;
    - two tabs on December, copy in one, then Copy in the other → "December already has income." and the list
      appears.

## AC → evidence

Part 1 (059, this branch):

| AC                                           | Evidence                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Web 390×844: lists items and shows the total | Slice 3 checks; `incomeCents` unit test (slice 2)                                         |
| Web 390×844: adds                            | Slice 4 (link) and 5 ("+") checks                                                         |
| What: month switcher, who added each         | Slice 3 checks                                                                            |
| What: every member sees any item and adds    | Slice 3 lists items seeded by two users; slice 4 adds as the QA user; 058's API tests     |
| What: ended months can't change              | Slices 4 and 5 October checks (no "+", the ended refusal hides Save)                      |
| iPhone (Expo Go): the Income tab works       | The user, at Gate B: six tabs fit, list, total, add, modal swipe is disabled while saving |
| Gates green, integration tests ran           | Every slice, with `DATABASE_URL_TEST` exported in the worktree                            |

Part 2 (061, for its plan):

| AC                                                         | Evidence                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Web 390×844: edits                                         | Slice 6 checks                                                                           |
| Web 390×844: deletes                                       | Slice 7 checks                                                                           |
| Web 390×844: copies last month's items into an empty month | Slice 8 checks; `copyRefusedText` rows; 058's copy tests                                 |
| What: every member edits everything                        | Slice 6 edits, and slice 7 deletes, an item seeded as another member; 058's API tests    |
| What: ended months can't change                            | Slices 6 and 7 October checks (rows not buttons, refusals hide Save and Delete); slice 8 |
| iPhone (Expo Go): editing, deleting and copying work       | The user, at 061's Gate B                                                                |
| Gates green, integration tests ran                         | Every slice                                                                              |

## Not doing (YAGNI)

- Any API, migration or `ApiError` change. The rule, its message, `ApiError.body` and the Budget figures card are
  060's.
- A GET-one income route. The modal reads the month's list.
- Undo, soft delete or a confirm step for deleting income.
- Income on the Home cards, the Statistics tab or the Budget tab.
- The month carrying over between the Budget and Income tabs. Each tab keeps its own `?month=`.
- Reordering, sorting or grouping items by member.
- Other currencies, recurring income, received vs expected, comparing with expenses, and Notion sync (the brief's
  out of scope).
- Renaming `MonthSwitcher`'s "BUDGET ’26" eyebrow on the Income tab.

## Risks

- **Six tab icons at 390pt** might crowd the bar. Slice 3 checks on web; the iPhone check is at Gate B.
- **`AmountField`'s `flex: 1` wrapper**, which is meant for the expense form's row, might collapse in the modal's
  column `ScrollView`. Slice 4 shows the field at full width and 48pt height on web, and on iPhone at Gate B. If it
  collapses (its root is `{ flex: 1 }`, `AmountFields.tsx:56`), the developer wraps it in a
  `<View style={{ flexDirection: 'row' }}>`, so `flex: 1` fills the row's width, and records that in Deviations.
- **`useIncome` on focus inside a modal.** It mirrors `useMembers` on the pushed Members screen. Slice 6 proves the
  form pre-fills, and that the tab reloads after the modal closes.
- **The add slice is ~190 lines**, over the ~150 target (Open questions). Slice 4's diff stat shows the real size.

## Open questions

- **Resolved:** split this brief into 059 (slices 1–5, tab and add, ~405) and 061 (slices 6–8, edit, delete and copy,
  ~215), shipped 059 → 061 → 060? Split decided by the user.
- **Not blocking:** slice 4 (~190) can't reach ~150, as 058's skeptic asked. The only cut is landing the form as a
  component with no caller first, which nothing could verify. 036 (planned amount, 241) and 038 (add category, 185)
  shipped their modals the same way.
- **Not blocking:** an item deletes at once from its edit form, with no confirm and no Undo. The merged API
  hard-deletes and has no restore. This was carried from 058, where it was listed as not blocking in the approved plan.
- **Not blocking:** titles follow category names: 1–40 characters after trimming (`normalizeName`), with "A title
  needs 1 to 40 characters.".
- **Not blocking:** a deep link to an ended month's item opens the form, and Save or Delete is then refused. This
  matches the planned-amount modal; there is no read-only view.
- **Not blocking:** copied items show as "Added by" the member who copied them (058's API).
- **Not blocking:** tab order is Home, Budget, Income, Expenses, Statistics, Settings, with a tray icon.

## Follow-ups

- Budget's and Income's copy flows are now two copies of the same state handling. Extract on a third.
- `normalizeName` lives in `data/categoryName.ts` but now checks income titles too. Move or rename it if a third
  non-category caller appears.
- The modal header (Cancel, title, spacer) and its styles now repeat in six modals. This is a candidate for
  `/kopiyka-hos-refactoring`.
- `incomeCents`, `sumCents` and `plannedCents` (`data/monthSummary.ts`) each sum one decimal-string field in cents.
  Folding them into one helper is a candidate for `/kopiyka-hos-refactoring`.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

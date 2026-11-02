# Plan: Edit, delete and copy income

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Design source: ../059-income-tab/plan.md, Part 2 (slices 6–8), its Contracts, Texts, Risks and Follow-ups, re-checked
against the merged code below
Branch: feat/income-edit-copy
Base: origin/main @ d4ec8ca (058's income API and 059's Income tab merged; the two commits after e9ca9d4 touch only
the conventions skill)

## Approach

- **App only**, as 059 designed it. 058's routes are used as merged (`apps/api/src/income/routes.ts`). There are no
  API, DB or `ApiError` changes.
- **Edit and delete** reuse 059's modal, `app/income-item.tsx`. `&incomeId=` turns it into an edit screen.
  - An `EditLoader` finds the item in `useIncome(ledgerId, month)`, because there's no GET-one route.
  - The existing `IncomeForm` gains `initial`, a `save` prop and an optional `remove` prop.
  - Rows on the tab become buttons in months that haven't ended.
- **Copy** is Budget's copy flow, repeated on the Income tab: `inFlight`, `refused`/`failed` tagged by ledger and
  month, and `copiedOver`. The tab also loads the previous month with `useIncome`. `copyRefusedText` learns the two
  income codes.
- **059 review nit folded in** (slice 1, ~8 lines): the form submits on Return/Enter like `planned-amount.tsx`.
  `AmountField` gets an optional `onSubmitEditing` for this.
- **Re-checked against the merged code**, three things differ from 059's plan:
  - `leave(month)` is local to `income-item.tsx`;
  - `IncomeForm({ month, busy, setBusy })` calls `addIncome` directly (the `save` prop arrives here, with its second
    caller);
  - rows are `accessible` `View`s with the combined label "Salary, €2,500, added by …". The open-month row keeps
    that label on the `Pressable`.

Alternative considered: the form branches on `initial` (`initial ? updateIncome(…) : addIncome(…)`) instead of a
`save` prop. It's about the same size, but it's a `kind` switch inside the form, and delete would need the same
branch. The callers already know which call they make, so they pass it in.

## Contracts

- **DB:** none. **API:** none new. The app calls 058's routes, all under `[requireAuth, requireLedger]`:

  | Call                                              | Success | Errors the app handles                                                 |
  | ------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
  | `PUT /api/ledgers/:id/income/:incomeId`           | 204     | 404 `not_found`, 409 `month_ended`; other → generic                    |
  | `DELETE /api/ledgers/:id/income/:incomeId`        | 204     | 404 `not_found`, 409 `month_ended`; other → generic                    |
  | `POST /api/ledgers/:id/months/:month/income/copy` | 204     | 409 `income_exists`, `no_previous_income`, `month_ended`; other → fail |

  The PUT body is `{ title: string, amount: string }`: a trimmed title of 1–40 characters, and a decimal string > 0
  with at most 2 decimals (`normalizeAmount`). `api()` already handles 401 and `404 ledger_not_found`.

- **`apps/mobile/src/data/income.ts`**: each call is added in the slice that first uses it, and each returns
  `Promise<void>`:
  - `updateIncome(ledgerId: number, incomeId: number, title: string, amount: string)` (2);
  - `deleteIncome(ledgerId: number, incomeId: number)` (3);
  - `copyPreviousIncome(ledgerId: number, month: string)` (4).
- **`apps/mobile/src/data/monthCopy.ts`**: `copyRefusedText` maps two more codes:
  - `income_exists` → "{Month} already has income.";
  - `no_previous_income` → "{Previous} has no income to copy.".

  Its JSDoc becomes "The Budget and Income tabs' text…".

- **`components/AmountFields.tsx`**: `AmountField` gets an optional `onSubmitEditing?: () => void`, passed to its
  `TextInput`. The expense form's `AmountFields` doesn't pass it.
- **`app/income-item.tsx`**:
  - Route: `/income-item?month=YYYY-MM` adds, and `&incomeId=N` edits or deletes. A bad `month`, or an `incomeId`
    that is present but fails `parseIdParam`, shows "That link isn’t valid.".
  - `IncomeForm({ month, busy, setBusy, initial, save, remove? })`:
    - `initial: IncomeItem | null` pre-fills the fields;
    - `save: (title: string, amount: string) => Promise<void>`;
    - `remove?: () => Promise<void>` is given only when editing.
  - A local `notListedText(month)` returns "This income item isn’t in {Month} any more.". The loader and the form's
    `not_found` both use it.
- **Texts** (from 059's table):

  | Where                                    | Text                                                                                             |
  | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
  | Row (open month)                         | role button, label "Salary, €2,500, added by dimuch" (as merged), hint "Edits the item"          |
  | Modal title                              | "Edit income" when `incomeId` is in the link, else "Add income"                                  |
  | Modal load error                         | "Couldn’t load {Month}’s income. Check your connection and try again." + Retry                   |
  | Item not in the list, or `not_found`     | `notListedText`. Save and Delete hide.                                                           |
  | `month_ended`                            | `monthEndedText`: "October has ended, so it can’t change." Save and Delete hide.                 |
  | Delete                                   | "Delete item" (`dangerText`); on failure "Couldn’t delete. Check your connection and try again." |
  | Copy (on the empty card)                 | "Copy {Previous}’s income"; on failure "Couldn’t copy. Check your connection and try again."     |
  | Previous month failed to load (no items) | "Couldn’t check {Previous}’s income. Check your connection and try again." + Retry               |

- **Reuses:**
  - in the form: `useIncome`, `IncomeForm`, `leave`, `AmountField`, `normalizeName`, `normalizeAmount`,
    `monthEndedText`, `dangerText`, `LoadError`;
  - in the link and the tab: `parseIdParam`, `usePushOnce`;
  - for copy: `EmptyMonth` (its `action` and `note`), `copyRefusedText`, `shiftMonth`, `monthName`, and Budget's copy
    state handling (`app/(tabs)/budget.tsx` lines 46–87), repeated rather than extracted (Follow-ups).
- **New dependencies:** none.

## Slices

These are 059's slices 6–8, plus slice 1 for the review nit. Each UI slice is checked on web at 390×844. The checks run
against this worktree's API (port 3000) and Metro (8081), signed in as `claude-qa-059` (ledger #35, the only member).
Run every check in dark mode, and in light mode where a slice adds styles.

Today is 2026-11-02, so October is ended and November is open. Ledger #35 has these items:

- 2026-11: Salary, Freelance (seeded as user 1, so "added by" names someone else), Bonus, and Rent from flat;
- 2026-12: Salary.

Some checks need more rows, seeded with raw SQL on the dev DB: an October item, and a row deleted while its form is
open. Gates run before every commit, with `DATABASE_URL_TEST` exported so the API integration tests run.

- [x] 1. Save income with Return or Enter, like the planned amount (~8)
  - Files: `components/AmountFields.tsx`, `app/income-item.tsx`.
  - Change:
    - `AmountField` gets the optional `onSubmitEditing` and passes it to its `TextInput`.
    - The Title input and the `AmountField` both get `onSubmitEditing={save}`. `save` already does nothing while
      something is in flight or the month is gone.
  - Verify:
    - `/income-item?month=2026-11`: type Gift / `50`, then Enter in the amount field. It saves and lands on the tab
      with Gift listed.
    - Enter in the Title field, with Title filled and the amount empty, shows the amount hint, and the API log shows no POST.
    - The expense form's amounts look and behave as before.
- [x] 2. Edit an income item from its row (~90)
  - Files: `data/income.ts` (`updateIncome`), `app/income-item.tsx`, `app/(tabs)/income.tsx`.
  - Change:
    - **Rows:** if the month hasn't ended, the row's `View` becomes a `Pressable` with role button, the merged label
      and the hint "Edits the item". It opens `/income-item?month=&incomeId=` with `usePushOnce`. Rows in an ended
      month stay the merged `accessible` `View`.
    - **Screen:** it reads `incomeId` and handles the bad-link case. `incomeId` counts as present when
      `params.incomeId !== undefined`, and it then goes through `parseIdParam`, so `?incomeId=` is a bad link. The header title depends on whether `incomeId` is
      in the link. Add stays `IncomeForm initial={null} save={(t, a) => addIncome(ledgerId, month, t, a)}`. Edit
      renders an `EditLoader`, which calls `useIncome(ledgerId, month)`:
      - a spinner while loading;
      - no items and an error: the modal load error, with Retry;
      - the item isn't in the list: `notListedText`, with no Retry;
      - otherwise `IncomeForm key={incomeId} initial={item} save={(t, a) => updateIncome(…)}`.
    - **Form:** `initial` pre-fills the title, and the amount as `initial.amountEur`. `save` replaces the direct
      `addIncome` call. A `not_found` error shows `notListedText` and sets `gone`.
  - Verify:
    - Tap Freelance and change it to "Freelance (net)" / `280`. Back on the tab, the row and total update, and "Added
      by" still names the other user.
    - Seed an October item: its row isn't a button (no pointer, no role).
    - `&incomeId=999999` shows the not-listed line, and `&incomeId=abc` shows "That link isn’t valid.".
    - Delete the item with SQL while its form is open, then Save: the not-listed line shows, and Save disappears.
    - The October item's link: Save shows the ended line, and Save disappears.
- [x] 3. Delete an income item from its form (~40)
  - Files: `data/income.ts` (`deleteIncome`), `app/income-item.tsx`.
  - Change:
    - The edit screen passes `remove={() => deleteIncome(ledgerId, incomeId)}`.
    - "Delete item" sits under Save and hides with it when `gone`. It's built like `app/expense.tsx:368-369,418`: a
      `Pressable` with role button, label "Delete item", `disabled={busy}`, 48pt high, text in `dangerText`.
    - Delete shares `inFlight` and `busy` with Save, so Cancel and the iOS swipe are disabled while it runs.
    - It deletes at once, with no confirm and no Undo (059's not-blocking decision), then calls `leave(month)`.
    - `month_ended` and `not_found` show their lines and set `gone`. Anything else shows "Couldn’t delete. …".
  - Verify:
    - Delete Gift: back on the tab, it's gone and the total drops.
    - In December, delete the only item: the empty card shows. Re-add it with "+" for slice 4.
    - The October item's link: Delete shows the ended line, and Delete disappears.
    - The item deleted by SQL first: Delete shows the not-listed line.
- [x] 4. Copy last month's income on an empty Income tab (~85)
  - Files: `data/income.ts` (`copyPreviousIncome`), `data/monthCopy.ts`, `test/monthCopy.test.ts`,
    `app/(tabs)/income.tsx`.
  - Change:
    - The tab also calls `const previous = useIncome(ledger.ledgerId, shiftMonth(month, -1))`.
    - `copy()` and `copiedOver: IncomeItem[] | null` follow Budget's flow.
    - "Copy {Previous}’s income" shows on `EmptyMonth` when all of these hold:
      - the month hasn't ended;
      - `previous.items` is non-empty;
      - there's no refusal for this ledger and month;
      - `items !== copiedOver`.
    - A refusal (`copyRefusedText`) shows as the card's `note` and reloads both months. Any other failure shows
      "Couldn’t copy. …".
    - "Couldn’t check {Previous}’s income. …" with Retry (`previous.reload`) shows under the `EmptyMonth` card, inside
      the `items.length === 0` branch (as Budget's `app/(tabs)/budget.tsx:133-138`), only when the month hasn't ended
      and `previous.error` is set while `previous.items` is null.
  - Tests: `test/monthCopy.test.ts` adds two rows and keeps the existing ones:
    - `('income_exists', '2026-11')` → "November already has income.";
    - `('no_previous_income', '2027-01')` → "December has no income to copy.".
  - Verify:
    - January 2027 is empty, and December has Salary. Copy brings Salary in at €2,500, "Added by" the QA user, and
      Copy goes away without flashing back.
    - March 2027, after an empty February, shows no Copy.
    - October shows no Copy.
    - Open two tabs on February 2027 (January now has items) and copy in one. Then Copy in the other is refused
      (“February already has income.” is the card's note until the reload lands) and the list appears; no generic
      “Couldn’t copy” line.
    - Block `/api/ledgers/35/months/2027-02/income` in DevTools request blocking, then open March 2027. It is empty,
      and February now has items. 'Couldn’t check February’s income. …' shows with Retry, and Copy doesn't. Unblock it
      and press Retry: Copy shows.

- [x] 5. Show this month's income first on Home (~25) — added before the PR at the user's request (mini Gate A)
  - Files: `app/(tabs)/index.tsx`.
  - Change:
    - Home calls `useIncome(ledger.ledgerId, month)` for its current Kyiv month (it reloads on focus, like the tab).
    - A new first card `{ title: 'Income', href: '/income', icon: 'income' }`, before Budget. Its figure is null
      while loading, "Not set" when the month has no items (like Budget's "Not set"), else
      `eur(incomeCents(items))`.
    - Each card gets its own `failed` flag for the screen-reader label ("…, not available"): Income uses the income
      hook's `error`, the others keep `useMonth`'s. No new error block, as the comment above the cards says.
    - The grid is unchanged: five cards at `flexBasis: '45%'` with `flexGrow: 1` put Income and Budget on the first
      row and stretch Settings across the last.
  - Verify (web 390×844):
    - November shows Income with the tab's total, first, beside Budget; Settings spans the last row.
    - Tapping Income opens the Income tab on November, also after the Income tab was left on December.
    - On a ledger with no November income (or after deleting November's items through the app and re-adding them),
      Home shows "Not set".
    - Block `/api/ledgers/35/months/2026-11/income` and refocus Home: Income shows "—" with the label "Income, not
      available"; Budget, Expenses and Statistics keep their figures and loaded labels. Unblock and refocus: the total
      returns.

Estimated total: about 250 changed lines. Every slice stays under 150.

## AC → evidence

| AC                                                                           | Evidence                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web 390×844: edits                                                           | Slice 2 checks (and slice 1's Return/Enter)                                                                                                                                              |
| Web 390×844: deletes                                                         | Slice 3 checks                                                                                                                                                                           |
| Web 390×844: copies last month's items into an empty month                   | Slice 4 checks; the `copyRefusedText` rows; 058's copy integration tests                                                                                                                 |
| What: every member edits and deletes any item                                | Slices 2–3 edit Freelance, added by another user; 058's API tests for members                                                                                                            |
| What: copy keeps titles and amounts                                          | Slice 4: Salary arrives as €2,500                                                                                                                                                        |
| What: ended months can't change                                              | Slices 2–3 October checks (rows aren't buttons; refusals hide Save and Delete); slice 4                                                                                                  |
| Web 390×844: Home's first card is Income, total or Not set                   | Slice 5 checks                                                                                                                                                                           |
| iPhone (Expo Go): editing, deleting and copying work, and the Home grid fits | The user, at Gate B. Rows open the form, the swipe is off while busy, Return in Title saves; Home shows three rows of cards (Settings full width) with nothing cut off above the tab bar |
| Gates green, integration tests ran                                           | Every slice, with `DATABASE_URL_TEST` exported                                                                                                                                           |

## Not doing (YAGNI)

- Anything of 060's: the over-income rule, its message, `ApiError.body`, the Budget figures.
- A GET-one income route; Undo, soft delete or a confirm step for deleting income.
- A shared copy-flow hook (two copies now; extract on a third), or `closeTo(tab, month)`.
- Moving focus from Title to the amount on Return. Both fields submit, as a web form does.
- Other currencies, recurring income, received vs expected, comparing with expenses, and Notion sync.

## Risks

- **`useIncome` on focus inside the modal** might not pre-fill, or the tab might not reload after the modal closes.
  It mirrors `useMembers` on a pushed screen. Slice 2's Freelance edit proves both.
- **`onSubmitEditing` on web** might not fire on Enter in the amount field. `planned-amount.tsx` relies on it with the
  same `TextInput` props. Slice 1's Enter check proves it. iOS's decimal pad has no Return key, so on iPhone only the
  Title field submits (Gate B).
- **A row turned `Pressable`** might lose its single screen-reader stop or its layout. Slice 2 checks the row's role
  and label in the web accessibility tree, and that the row looks as before. iPhone is checked at Gate B.

- **Home may not fit on a phone.** Home isn't a ScrollView, so a third row of cards plus PendingInvites, the Notion
  panel and the Undo toast could push content under the tab bar. Slice 5 checks web 390×844, and the user checks
  iPhone at Gate B. If it doesn't fit, wrapping Home's content in a ScrollView is a follow-up change that needs the
  user's OK.

## Open questions

- Not blocking: Return in the Title field submits the whole form, so an empty amount shows the amount hint. The other
  option is to move focus to the amount field, which needs a ref through `AmountField`. Assumed: submit, as
  `planned-amount.tsx` and a web form do.
- Not blocking: deleting needs no confirm and has no Undo, because the merged API hard-deletes. This was carried from
  058 and 059.
- Not blocking: a deep link to an ended month's item opens the form, and Save or Delete is then refused. This matches
  `planned-amount.tsx`.

## Follow-ups

- The Budget and Income copy flows are now two copies of the same state handling (059's follow-up). Extract on a
  third.
- Carried from 059: the modal header repeats in six modals, six screens have their own "close to tab", and
  `incomeCents`, `sumCents` and `plannedCents` overlap. These are `/kopiyka-hos-refactoring` candidates.

## Deviations

- Slice 3: Save and Delete go through one `run(action, failed)` in `IncomeForm` (in flight, busy, leave, refusal
  text) instead of two copies of the save body; same behaviour, so it stays in the slice.
- Slice 4: "October shows no Copy" was checked on September instead, with an August item seeded: by then October had
  an item, so it showed no empty card.
- Light mode wasn't seen on web (the QA user's theme stays dark, as in 059). The one new style (`delete`) takes its
  colour from `dangerText(colors)`.
- Slice 5: "Not set" was checked with the November request stubbed to return no items, not on a second ledger. A
  failed income request after a load keeps the last total, by `useIncome`'s design (a failed refetch keeps the items),
  so "—" with "Income, not available" only shows when the first load fails; on web the stubbed failure kept €5,581
  with Budget, Expenses and Statistics unchanged, and the real request brought it back. The first-load failure path
  wasn't exercised.

## Consolidate

Pass over `origin/main...HEAD`. Reused 10 · extracted 1 · left 4.

- REUSE: `useIncome` (also for the edit loader and the previous month), `copyRefusedText`, `EmptyMonth`'s `action`
  and `note`, `AmountField`, `dangerText`, `monthEndedText`, `parseIdParam`, `usePushOnce`, `shiftMonth`, `LoadError`.
- EXTRACT (inside the slice): `run()` in `IncomeForm`, shared by Save and Delete.
- Copy flow vs Budget's — LEAVE: the second copy; extract on a third (Follow-ups).
- `notListedText` vs `notInMonthText` (`data/categoryName.ts`) — LEAVE: a different noun and no name to quote; one
  caller each.
- `EditLoader` vs `CategoryInMonth`'s loading states — LEAVE: different data (a list lookup vs one category's
  totals); merging them would add a generic loader for two callers.
- The Delete button style vs the expense form's — LEAVE: styles are per screen by convention.

# Plan: Expense name suggestions per category

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/expense-name-suggestions (PR A, slices 0–2); feat/expense-name-suggestions-app (PR B, slices B0 and 3–6,
stacked on PR A)
Base: origin/main (4e1ad93 after a rebase, version 1.18.0)

## Approach

A new read route, `GET /api/ledgers/:id/expenses/names?categoryId=&month=`, sits in `expenses/routes.ts`. It runs one
scoped SQL read: the live expenses of one category of the ledger, dated from the 1st of the month before `month` up to
the 1st of the month after it, newest first. A pure `rankNames` in `expenses/nameSuggestions.ts` groups them by
`trim().toLowerCase()`, keeps the newest spelling, drops empty names and orders by uses, then latest date, then A–Z.
The app gets all of the window's names in one request per form open, category or month. A small hook loads them, and a
pure `matchingNames` filters them as you type, case-insensitively and anywhere in the name, capped at 20. A new
`NameCombobox` (built on `TextField` and `Pressable`) shows them inline under the field.

Filtering happens on the client, so typing never makes a request. There's no cache: the hook fetches each time the form
mounts, so a saved name is offered the next time the form opens. The demo store answers the same route with the same
rules (conventions §2).

Alternative considered: grouping and ranking in SQL with window functions (`COUNT(*) OVER`, `ROW_NUMBER()`). It lost
because the database collation `utf8mb4_0900_ai_ci` is also accent-insensitive. "Café" and "Cafe" would merge unless
every expression got an explicit `COLLATE`, and the rules could then only be tested against MySQL. Another option was
letting the server filter by the typed text (`?q=`), which lost because it means a request and a debounce on every
keystroke for lists of tens of names.

Deliberate departure: the `expo-data-fetching` four-states rule. A failed or loading suggestions request shows nothing,
with no error or retry, because the brief says "nothing to suggest → no dropdown" and free text always works.

## Contracts

- DB: none. Uses the existing `expenses` index `(category_id, expense_date)`.
- API: `GET /api/ledgers/:id/expenses/names?categoryId=<int>&month=<YYYY-MM>`. Guards are
  `[app.requireAuth, app.requireLedger]`.
  - 200 → `{ names: string[] }`. Each entry is trimmed. The list holds every distinct name (case and surrounding spaces
    ignored) of the live expenses in that category, dated in `month` or the month before. Expenses come from all
    members. The order is most uses first, then the newest `expense_date`, then A–Z (lower-cased, code point). Each
    name keeps the spelling of its newest expense (date, then `created_at`, then `expense_id`). Empty names are left
    out. There's no cap; the list route `GET /expenses?month` isn't capped either.
  - A category from another ledger, or one deleted before brief 028, gives `{ names: [] }`. The query joins on
    `c.ledger_id = ?`, so no names leak and nothing is refused. An ended month is a read, so it isn't refused.
  - Errors: 400 `invalid_request` (Zod) for a missing or bad `categoryId` and for a bad `month` (body from
    `badMonthReply('month')`); 401 `unauthorized`; 404 `ledger_not_found` for a non-member.
  - The static `names` segment wins over `:expenseId` in find-my-way (checked while planning with Fastify 5 `inject`).
- API module: `expenses/nameSuggestions.ts` → `rankNames(newestFirst: readonly { name: string; expenseDate: string }[]): string[]`.
- App:
  - `api/types.ts`: `export interface ExpenseNames { names: string[] }`. It's used by the hook and the demo route.
  - `data/nameSuggestions.ts`: `matchingNames(names: string[], typed: string): string[]`, which keeps order, matches
    `typed.trim().toLowerCase()` anywhere, keeps an exact match and returns at most `SUGGESTION_LIMIT = 20`.
  - `data/useExpenseNames.ts`: `useExpenseNames(ledgerId: number, categoryId: number | null, month: string): string[]`.
    It requests `/api/ledgers/${ledgerId}/expenses/names?categoryId=${categoryId}&month=${month}` (the demo's regex
    `/^\/api\/ledgers\/\d+\/expenses\/names$/` matches this path). A `null` category fetches nothing. Loading and
    errors give `[]`. It refetches when `ledgerId`, `categoryId` or `month` change.
  - `components/NameCombobox.tsx` props: `{ value: string; onChangeText: (text: string) => void; names: string[]; editable: boolean; accessibilityLabel: string; placeholder: string; placeholderTextColor: string; maxLength: number; style: StyleProp<TextStyle> }`.
  - `components/TextField.tsx`: takes optional `onFocus`/`onBlur` and calls them after its own focus state (it omits
    them today).
  - `app/expense.tsx`: the "What was it?" `TextField` becomes
    `<NameCombobox names={useExpenseNames(ledgerId, locked ? null : selectedId, month)} …>`.
- Reuses: `previousMonthStart`, `nextMonthStart` (`api/src/dates.ts`); `MonthString` (`monthChecks.ts`); the `guards`
  constant in `expenseRoutes`; the `useRate` keyed-state pattern for the hook; `shiftMonth` (`format.ts`) in the demo
  route; the demo list route's newest-first comparator, extracted to a `newestFirst` function in
  `demo/expenseRoutes.ts` (two callers); `TextField`, `Pressable`, and `edit(setName, …)` in the form.
- New dependencies: none.

## Version

Bump: minor — 1.18.0 → 1.19.0 (PR A); minor — 1.19.0 → 1.20.0 (PR B)
Why: §8b `minor` covers a new API route and a new user action (picking a suggested name). Nothing existing changes
shape, and there's no migration.

## Slices

- [x] 0. Bump version to 1.19.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.19.0
- [x] 1. Rank an expense window's names by use for suggestions (~65 lines)
  - Files: apps/api/src/expenses/nameSuggestions.ts, apps/api/test/nameSuggestions.test.ts
  - Change: add pure `rankNames` as in Contracts. Rows come in newest first; the first spelling seen per key wins.
  - Tests: `nameSuggestions.test.ts`, table style:
    - 3× "Delhaize" and 1× "Colruyt" → `['Delhaize', 'Colruyt']`
    - a uses tie → the newer date first
    - a uses and date tie → A–Z, case-insensitive
    - "delhaize " newest, "Delhaize", "DELHAIZE" → one entry, `'delhaize'`
    - `''` and `'  '` dropped
    - `[]` → `[]`
- [x] 2. Add a route listing a category's recent expense names (~110 lines)
  - Files: apps/api/src/expenses/routes.ts, apps/api/test/expenses.int.test.ts
  - Change: add a `NamesQuery` Zod schema (`categoryId` coerced to a positive int, `month: MonthString`), then the
    route. It runs a SQL read joined through `categories.ledger_id`, with `c.deleted_at IS NULL`,
    `e.deleted_at IS NULL`, a date window from `previousMonthStart(month)` up to `nextMonthStart(month)`, and
    `ORDER BY e.expense_date DESC, e.created_at DESC, e.expense_id DESC`. The route returns `{ names: rankNames(...) }`.
    A one-line comment says why the previous month is in the window.
  - Tests: a nested `describe('GET names', …)` inside `expenses.int.test.ts`, reusing its setup (clock 2026-10-06,
    `owner`, `auth`, `cat`). Rows are inserted with SQL so that August and November dates can exist. Cases:
    - happy path and ordering: 3× Delhaize and 1× Colruyt in October Groceries → `['Delhaize', 'Colruyt']`
    - month=2026-10: a September name is included, while August and 2026-11-01 are left out
    - Groceries vs Subscriptions: each category's names only
    - "Delhaize" and "delhaize " → one entry
    - a name from a second member (a `ledger_members` row; expense `created_by` = that member) is included
    - soft-deleted expenses and empty names are left out
    - a category of another ledger → 200 `{ names: [] }`
    - 400 for a missing `categoryId` and for `month=2026-13` (`badMonthReply('month')`)
    - 401 with no session
    - 404 `ledger_not_found` for a non-member
      PR B starts here, on `feat/expense-name-suggestions-app` branched from PR A's head.

- [ ] B0. Bump version to 1.20.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.20.0 (PR B adds the user-facing picker, a minor change of its own)
- [ ] 3. Load and filter name suggestions in the app (~80 lines)
  - Files: apps/mobile/src/api/types.ts, apps/mobile/src/data/nameSuggestions.ts, apps/mobile/src/data/useExpenseNames.ts,
    apps/mobile/test/nameSuggestions.test.ts
  - Change: add `ExpenseNames`, `matchingNames` + `SUGGESTION_LIMIT`, and the hook. The hook copies `useRate`'s
    keyed state with `let live`. Its `catch` gives `[]`, with a comment that suggestions are optional.
  - Tests: `nameSuggestions.test.ts`:
    - `''` → first 20 of 25, in order
    - "del" → Delhaize and "Deli Mart", not Colruyt
    - "DEL" gives the same as "del"
    - "delhaize" still lists "Delhaize"
    - "del " (trailing space) gives the same as "del"
    - "сільп" → "Сільпо"
    - no match → `[]`
- [ ] 4. Answer name suggestions in the demo (~70 lines)
  - Files: apps/mobile/src/demo/expenseRoutes.ts, apps/mobile/test/demoExpenses.test.ts
  - Change: extract `newestFirst(left, right)` from the list route's sort. Add a GET route
    `/^\/api\/ledgers\/\d+\/expenses\/names$/`. It takes live expenses of `categoryId` whose month is `month` or
    `shiftMonth(month, -1)`, sorts them newest first and applies the same grouping and order as `rankNames`. It
    answers an `ExpenseNames`.
  - Tests: `demoExpenses.test.ts`, "demo expense names" against `fixtureData()` (NOW 2026-11-15) with added expenses:
    - order by uses, then date, then A–Z
    - October included for month=2026-11; September left out
    - other category left out
    - case and space merge
    - a removed expense left out
    - an empty name left out
- [ ] 5. Suggest names already used in the category on the expense form (~105 lines)
  - Files: apps/mobile/src/components/NameCombobox.tsx, apps/mobile/src/components/TextField.tsx,
    apps/mobile/src/app/expense.tsx, apps/mobile/demo-modules.txt
  - Change:
    - `TextField` forwards `onFocus`/`onBlur`.
    - `NameCombobox` keeps `open` state:
      - It opens on focus, on typing, and on `onPressIn` of the field, so a tap on the already-focused field reopens
        it on iOS. react-native-web 0.21.4's `TextInput` doesn't handle `onPressIn`, so on web the list reopens by
        typing (or ↓, slice 6).
      - It closes on blur, on a pick, or when `editable` is false.
      - It shows `matchingNames(names, value)` when that's non-empty: an inline list under the field, at most 5 rows
        (44pt each) high, and the rest scrolls.
      - The list's `ScrollView` has `keyboardShouldPersistTaps="handled"`.
      - Each option is a `Pressable` with `accessibilityRole="button"`.
      - A pick calls `onChangeText(name)` and closes the list.
      - On web the list's `onMouseDown` calls `preventDefault`, so the input keeps focus and blur doesn't close the
        list before the press lands. It's passed through a `Platform.OS === 'web'` spread, because RN's `ViewProps`
        don't type it.
    - Styles: `makeStyles(colors)` with `surface`, `borderStrong` and `accentTint`.
    - `expense.tsx` swaps the `TextField` for `NameCombobox` fed by `useExpenseNames(ledgerId, locked ? null : selectedId, month)`.
    - `expense.tsx` passes `maxLength={200}` and `placeholderTextColor={colors.faint}` as it does today.
    - `demo-modules.txt` gets the new modules via `yarn mobile export:web && yarn mobile check-builds --accept`.
  - Verify: run the web build at phone width (launch configs `web` + `api`) with seeded Groceries expenses, then repeat
    on iPhone (Expo Go):
    - focusing lists Delhaize above Colruyt
    - typing "del" narrows the list
    - tapping Delhaize fills the name, the amount stays and the list closes
    - switching to Subscriptions shows Netflix only
    - with a Groceries name seeded only in the previous month (e.g. October), a new expense dated in the current month
      (e.g. the 1st) lists it
    - a typed new name saves
    - after Add, Back and reopening, the new name is listed
    - a locked (ended-month) expense shows no list
    - on iPhone the inner list scrolls with the keyboard up
    - on iPhone, after a pick, a tap on the still-focused field reopens the list
    - web build by touch (iPhone Safari, or Chrome device emulation with touch): tapping an option fills the name and
      closes the list, and the list scrolls by drag
- [ ] 6. Let the name suggestions work with the keyboard and screen readers (~55 lines)
  - Files: apps/mobile/src/components/NameCombobox.tsx
  - Change:
    - `active: number | null` state, reset whenever the shown list changes.
    - `onKeyPress` on the field:
      - ArrowDown opens the list, or moves down and wraps; ArrowUp moves up and wraps.
      - Enter with an active option picks it and calls `preventDefault`, which skips react-native-web's
        submit/blur (checked in `TextInput` 0.21.4).
      - Escape closes the list.
      - Arrow keys call `preventDefault`.
    - The active row is scrolled into view with `scrollTo` at the fixed row height.
    - The active row is highlighted with `accentTint`.
    - Web semantics:
      - the field gets `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-controls` = listbox id and
        `aria-activedescendant` = active option id (ids from `useId`)
      - the list gets `accessibilityRole="listbox"` (RN's `Role` union lacks `listbox`; `AccessibilityRole` accepts any
        string)
      - options get `role="option"`, `aria-selected` and `focusable={false}`, so Tab skips them and arrows drive them
    - iOS keeps `button` options (like `TabBar`'s `Platform.select`). `announceForAccessibility('<n> suggestions')`
      runs once when the list opens.
  - Verify:
    - Web, keyboard only: Tab into the field opens the list. ↓/↑ move the highlight past row 5 and it stays in view.
      Enter fills the name and keeps focus. Esc closes and ↓ reopens. Tab moves on to the amount.
    - Web screen reader (macOS VoiceOver in Chrome/Safari): the field reads as a combobox, expanded or collapsed, and
      the active option is announced.
    - iPhone VoiceOver: focusing the field announces "N suggestions". Swiping reaches each name, and a double tap
      fills it.

## AC → evidence

| AC                                                         | Evidence                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3× Delhaize + 1× Colruyt → Delhaize above Colruyt          | `nameSuggestions.test.ts` "orders by uses"; `expenses.int.test.ts` "GET names" happy path; demo test; slice 5 web/iPhone check                                                                                              |
| Last month only, opened on the 1st → suggested             | int test "includes the month before" (month=2026-10, September row); slice 5 check: a Groceries name seeded only in the previous month (e.g. October) is listed for a new expense dated in the current month (e.g. the 1st) |
| Names from two months ago → not suggested                  | int test "leaves out August and November"; demo test "September left out"                                                                                                                                                   |
| Groceries vs Subscriptions; switching updates              | int test "one category's names only"; slice 5 check switching category                                                                                                                                                      |
| "Delhaize" + "delhaize " → one entry                       | `nameSuggestions.test.ts` merge case; int test merge case                                                                                                                                                                   |
| Typing "del" → only names containing "del" (any case)      | `apps/mobile/test/nameSuggestions.test.ts` "del"/"DEL" cases; slice 5 check                                                                                                                                                 |
| Picking fills the name only, amount unchanged              | slice 5 web + iPhone check (amount typed first, then pick)                                                                                                                                                                  |
| New typed name saves as today                              | unchanged POST (existing `expenses.int.test.ts`); slice 5 check "typed new name saves"                                                                                                                                      |
| Another member's expense is suggested                      | int test "includes a second member's expense"                                                                                                                                                                               |
| Non-member gets the same refusal; no foreign names         | int tests 404 `ledger_not_found` and foreign category → `{ names: [] }`                                                                                                                                                     |
| Keyboard alone on web; VoiceOver on iOS                    | slice 6 keyboard-only web check, web screen reader check, iPhone VoiceOver check                                                                                                                                            |
| Brief "What": locked form shows no dropdown                | slice 5 check on an ended-month expense; `useExpenseNames(…, null, …)` fetches nothing                                                                                                                                      |
| Brief Notes: a saved name appears next time the form opens | slice 5 check (Add, Back, reopen)                                                                                                                                                                                           |

## Not doing (YAGNI)

- An amount suggestion, suggestions on the income form, or suggestions across categories (out of scope by the brief).
- Changes to the MCP connector (out of scope; it doesn't call the new route).
- A server-side `q` filter or a server cap. The list is bounded by one category's two months, like `GET /expenses`.
- A client cache or refresh after Add while the form stays open; the next open fetches again.
- An error or retry state for suggestions.
- A generic Combobox/Autocomplete component: it has one caller.
- Removing a name from the suggestions.

## Risks

- On web, `onMouseDown` + `preventDefault` on the list might not keep the input focused, or might stop
  react-native-web's responder-based `Pressable` from firing. Slice 5's web check proves or disproves it (click an
  option: the name is filled and the field stays focused) and its web touch check, since touch sends different events.
  Fallback: in `onBlur`, keep the list open when `nativeEvent.relatedTarget` is inside it.
- On iOS, a `ScrollView` nested in the form's `ScrollView` with the keyboard up might not scroll, or the first tap might
  only dismiss the keyboard. Slice 5's iPhone check proves or disproves it (both have
  `keyboardShouldPersistTaps="handled"`).
- `role="combobox"` / `aria-activedescendant` might not reach the DOM through `TextInput`. react-native-web 0.21.4's
  `createDOMProps` lists them, and hyphenated JSX attributes type-check. Slice 6 proves it by inspecting the DOM in the
  web build.
- `onKeyPress` might fire `Enter` on iOS's return key with an `active` option. `active` is only set by arrow keys,
  which iOS never sends, so it stays `null` there. Slice 6's iPhone check confirms that return behaves as today.
- Version clash: `chore/design-tokens-components` and `feat/budget-polish` also bump `package.json`. If one merges
  first, follow §8b step 4: rebase, take main's number, bump once more.

## Open questions

- decided — Size: about 480 changed lines, above the ~400 guide. The user chose the split at Gate A (2026-11-24): PR A =
  slices 0–2 (API route, ~175 lines, 1.19.0); PR B = slices B0 and 3–6 (app and demo, ~310 lines, 1.20.0), stacked
  on A.
- no — Loading or failing suggestions show nothing, with no error or retry. Assumption: the brief's "nothing to suggest
  → no dropdown" covers this, and free text always works.
- no — List cap and size: at most 20 matches, with 5 rows visible before scrolling. The typed text is trimmed before
  matching. A–Z ties sort by lower-cased code point, so Latin names come before Cyrillic ones.
- no — After a pick or Escape, a tap on the already-focused field reopens the list on iOS (`onPressIn`). On web it
  doesn't (react-native-web's `TextInput` ignores `onPressIn`); typing or ↓ does. Assumption: that's enough for "tapping
  or focusing".
- no — While editing, the expense's own name counts in the window like any other.

## Follow-ups

None found while planning.

## Deviations

- slice 0: brief 107 (budget polish) merged first with 1.18.0, so the branch was rebased onto 4e1ad93 and PR A bumps
  1.18.0 → 1.19.0, PR B 1.19.0 → 1.20.0.

## Consolidate

PR A (slices 0–2), searched across `apps/api/src`:

- `rankNames` — LEAVE: no other code groups or ranks names. The `toLowerCase()` matches elsewhere (auth throttle,
  Notion import, category tech names) are one-line key builders with their own rules.
- `GET /expenses/names` query — LEAVE: it shares the join and live-row filters with `GET /expenses`, but selects two
  columns over a two-month window for one category. A shared builder would mean a third shape of options for two
  callers.
- Reuses as planned: `previousMonthStart`, `nextMonthStart`, `MonthString`, `guards`, `badMonthReply` in the tests.

## Revision 1

After the skeptic (APPROVE WITH EDITS):

- Contracts and slice 5: `NameCombobox` takes `maxLength` and `placeholderTextColor`, and `expense.tsx` passes 200
  and `colors.faint` as today. Without them a name over 200 characters would hit the API's `max(200)` and show a
  misleading error.
- Slice 5 Verify and AC2: the previous-month check seeds the name and adds an expense in the current month, because
  `firstOpenDate` keeps DateChips out of last month.
- Suggestions taken:
  - `onPressIn` reopens the list on iOS (web has no `onPressIn` on `TextInput`).
  - The slice 2 int tests go in a nested describe in `expenses.int.test.ts`.
  - Slice 5 adds a web touch check.
  - The hook's contract spells out the full URL.
- Size and version are unchanged.

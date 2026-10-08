# Plan: App links, navigation and loading robustness

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/app-link-and-loading-robustness
Base: origin/main@c4d7a96 (includes 010's app Vitest runner)

## Approach

Four small, independent app-only fixes. No API or DB changes.

1. **Leaving Expense.** `leave` moves to module level in `expense.tsx`. Update and Delete call it instead of
   `router.back()`. Delete sets the pending Undo only when it's going back. On the way to Home nothing would take it,
   and the next Category screen to focus would offer Undo for an unrelated delete (details under "Facts").
2. **Link params.** A new pure module `src/linkParams.ts` has `parseIdParam` and `parseMonthParam`, unit-tested first.
   Each screen parses its params in an outer component. A bad link renders an invalid-link view, and only a valid
   link renders the child component that calls `useMonth` / `useExpenseDraft`. Because the child never mounts on a
   bad link, nothing is fetched and the hooks stay unconditional and unchanged.
3. **Home loading.** `total` is `null` until `rows` load. The card shows "—" (in the total's own text style, muted, so
   the card's height doesn't jump), and `CompactTotal` isn't rendered until the total is known. That's the same
   `{category && <CompactTotal/>}` pattern the Category screen already uses.
4. **Sheet on wide web.** `PhoneColumn` gets an optional `onPressOutside`. On web it renders a full-window,
   mouse-only `Pressable` behind the column. Native returns `children` as today, so the iOS tree is unchanged by
   construction. `CategorySheet` passes `onClose`.

Alternative considered: give `useMonth`/`useExpenseDraft` a "skip" input (null id/month) and branch inside each hook.
That changes two hook contracts, the screen still has to render its own invalid state, and the Category screen's
`!data` spinner path would need a third case. Rendering the data child only for a valid link is smaller and leaves
the hooks alone.

### Facts verified on Base

- **Params on web.** expo-router 57.0.24 `parseQueryParams` uses `searchParams.getAll`. A repeated key
  (`?month=a&month=b`) arrives as `string[]`, and `?month=` / `?month` as `''`. `UnknownOutputParams` is
  `Record<string, string | string[]>`. Href objects pushed in-app (`{ pathname, params: { expenseId: 5 } }`) go
  through `resolveHref` into a query string, so on native too the params arrive as strings.
- **Direct load.** `_layout.tsx` sets no `initialRouteName`. A fresh tab on `/expense?...` has a one-screen stack, so
  `router.canGoBack()` is false (Cancel already relies on this). `router.back()` then does nothing, which is the bug.
- **Pending Undo leak.** `undo.ts` holds one module-level `pending` value, and only the Category screen takes it
  (`useFocusEffect` → `takePendingUndo`). Home never takes it. If Delete from a direct link set it and then went Home,
  it would sit there until the user next opened any category, in any month. That screen would then show
  "Deleted “X”" with Undo for an expense deleted earlier and elsewhere. So the pending Undo is set only when
  `canGoBack()` is true. An edit (`expenseId`) is only ever pushed from Category rows, so in-app "back" from an edit
  always lands on Category.
- **`useExpenseDraft.ts:63–64`** fetches the expense when `expenseId !== null`, "not on truthiness" so that `NaN`
  reaches the API and comes back as `invalid_request`. Once ids are validated, `expenseId` is a positive integer or
  `null`, so the comment is dropped and the JSDoc says the ids must be valid.
- **RN-web Modal** (0.21.3): `ModalContent` is a `position: fixed` full-window View with a `flex: 1` container. Escape
  calls `onRequestClose`. Every RN-web View defaults to `position: relative; z-index: 0`, so the later sibling (the
  column) paints over an earlier `absoluteFill` sibling. Clicks inside the column never reach the sibling behind it,
  because it isn't their ancestor. `Pressable` defaults to `tabIndex 0`, so the mouse-only target sets
  `tabIndex={-1}` and `aria-hidden`. Both are in RN 0.86's `ViewProps` types.
- The API month regex is `/^\d{4}-(0[1-9]|1[0-2])$/` (`apps/api/src/expenses/routes.ts:59`). Ids are
  `z.coerce.number().int().positive()`.

## Contracts

- DB: none
- API: none
- App:
  - `src/linkParams.ts` (new):
    - `parseIdParam(value: string | string[] | undefined): number | null` returns the id when `value` is a single
      string of digits only (`/^\d+$/`) whose value is ≥ 1 and a safe integer. Otherwise it returns `null`: missing,
      `''`, arrays, signs, decimals, exponents, spaces.
    - `parseMonthParam(value: string | string[] | undefined): string | null` returns `value` when it's a single string
      matching the API's `/^\d{4}-(0[1-9]|1[0-2])$/`, else `null`.
    - "Missing or empty means default" stays in the screens, as today (`params.month || thisMonth`,
      `!!params.expenseId`). Each parser only answers "is this exactly one valid value".
  - `PhoneColumn` props: `{ children: ReactNode; onPressOutside?: () => void }`. It's web-only, and native ignores it.
  - `useLocalSearchParams` generics are widened to the honest `string | string[]` in `expense.tsx` and
    `category/[categoryId].tsx`.
  - Unchanged: `useMonth`, `useExpenseDraft` signature, `CompactTotal`, `undo.ts`.
- New dependencies: none

## Slices

Each slice must pass `yarn format:check && yarn lint && yarn typecheck && yarn test` (not piped). For UI checks, use
launch configs `api` + `web` in the in-app browser at 390×844 (and 1440×900 for slice 6).

- [x] 1. Return to Home after saving or deleting an expense opened from a link (~15 lines)
  - Files: `apps/mobile/src/app/expense.tsx`
  - Change:
    - Turn `leave` into a module-level `function leave()`, with a one-line comment saying why it falls back to Home.
      It stays `onPress={leave}` for Cancel and Back.
    - `save()`, editing branch: `leave()` replaces `router.back()`.
    - `remove()`: `if (router.canGoBack()) setPendingUndo(...)`, with a comment that only Category takes the offer
      and Home never would, then `leave()`.
  - Verify (web 390×844):
    - Fresh tab `/expense?expenseId=<id>`, rename, Update: lands on Home and the Category screen shows the new name.
    - Fresh tab, Delete: lands on Home and the expense is gone. Then open that expense's category (and another one):
      no Undo toast.
    - Home → Category → expense → Update returns to Category. Same path, Delete returns to Category with the Undo
      toast, and Undo restores the expense.
    - Repeat the last two on iPhone (Expo Go).
- [x] 2. Add link param parsers for ids and months (~70 lines)
  - Files: `apps/mobile/src/linkParams.ts` (new), `apps/mobile/test/linkParams.test.ts` (new)
  - Change: the two functions in Contracts, each with one-line JSDoc. The month regex carries a comment that it
    mirrors the API's `MonthQuery`.
  - Tests (write first, see them fail on a stub returning the old `Number()` / passthrough behaviour, then
    implement), table style like `format.test.ts`:
    - `parseIdParam`:
      - Valid: `'1'`→1, `'42'`→42, `'007'`→7, `'9007199254740991'`→9007199254740991.
      - `null` for: `'abc'`, `'0'`, `'00'`, `'-1'`, `'1.5'`, `'1e3'`, `'+1'`, `' 1'`, `'0x10'`,
        `'9007199254740992'` (not a safe integer), `''`, `undefined`, `['1', '2']`.
    - `parseMonthParam`:
      - Valid: `'2026-10'`, `'2026-01'`, `'2026-12'` come back as is.
      - `null` for: `'2026-13'`, `'2026-00'`, `'2026-1'`, `'26-10'`, `'2026-10-01'`, `' 2026-10'`, `'abc'`, `''`,
        `undefined`, `['2026-10', '2026-11']`.
    - (Expected values computed on Base with a scratch script.)
- [x] 3. Reject malformed expense links before fetching (~45 lines)
  - Files: `apps/mobile/src/app/expense.tsx`, `apps/mobile/src/data/useExpenseDraft.ts`
  - Change:
    - `ExpenseScreen` reads params, sets `editing = !!params.expenseId` and
      `expenseId = parseIdParam(params.expenseId)`, and renders the header (title from `editing`, as today). So
      `/expense?expenseId=abc` keeps the "Edit expense" title on purpose: the link asked for an edit.
    - The body: if `editing && expenseId === null`, it shows "That link isn’t valid." with Back and no Retry.
      Otherwise it renders a new local `ExpenseLoader({ expenseId, categoryId: parseIdParam(params.categoryId) })`.
      A malformed category id becomes `null`, so the draft starts on the first quick category.
    - `ExpenseLoader` holds `useSession` + `useExpenseDraft` and today's loading/error/form branches.
    - The bad-link and load-error branches share a local `LoadFailed({ message, onRetry? })` (`LoadError` + Back).
    - `useExpenseDraft`: drop the "Not on truthiness… NaN" comment. Its JSDoc says `expenseId`/`categoryId` are
      validated ids or null.
  - Verify (web 390×844, Network panel):
    - `/expense?expenseId=abc`: "That link isn’t valid." and Back with no `/expenses/` or `/categories` request, and
      Back goes Home.
    - `/expense?categoryId=abc`: New expense with the first quick category selected, and Add saves.
    - `/expense?expenseId=<id>` still edits, and `/expense` still adds.
    - Home → Category → Add preselects that category.
    - iPhone (Expo Go): Category → tap an expense opens Edit with its data, and Update returns to Category; Category →
      Add preselects the category.
- [x] 4. Show an invalid-link message for malformed category links (~40 lines)
  - Files: `apps/mobile/src/app/category/[categoryId].tsx`
  - Change:
    - The default export becomes a small route component. It reads params, keeps `thisMonth` and the "no/empty month
      opens the current one" comment, and computes `categoryId = parseIdParam(params.categoryId)` and
      `month = parseMonthParam(params.month || thisMonth)`.
    - If either is `null` it renders a local `InvalidLink`: the header with a back chevron labelled "Back" (not a
      month name) and `<LoadError message="That link isn’t valid." />`. It renders no `AddExpenseButton`: there's no
      valid category to preselect.
    - Otherwise it renders today's component, renamed `CategoryBreakdown({ categoryId, month })` with its param
      lines removed and nothing else changed.
    - The back handler becomes a module-level `goBack` shared by both headers.
  - Verify (web 390×844, Network panel):
    - `/category/abc?month=2026-10`: message and Back with no `/expenses` (or `/categories`) request.
    - `/category/<id>?month=2026-13` and `?month=abc`: same, and the header says "Back" with no month name.
    - `/category/<id>` and `?month=`: current month.
    - Home → Category → Undo flow unchanged (with slice 1's check).
    - iPhone (Expo Go): Home → Category opens the category with its month name in the header (not 'That link isn't
      valid.'), and Delete → Undo still works.
- [ ] 5. Show a placeholder instead of €0 while Home's month loads (~10 lines)
  - Files: `apps/mobile/src/app/index.tsx`
  - Change:
    - `const total = rows ? rows.reduce(...) : null`.
    - The card shows `total === null ? '—' : eur(total)` with `[styles.total, total === null && { color: colors.muted }]`.
    - `{total !== null && <CompactTotal spentCents={total} … />}` uses an explicit `!== null`, because 0 is falsy.
    - Deliberate choice: the "—" is in the card total's 34pt style, muted, not in the Budget "—" style (17pt). That way
      the card's height doesn't jump when the amount arrives, and the collapsing header's measured card layout stays
      put. It still reads as the same neutral dash as Budget. The PR summary says so.
  - Verify (web 390×844, DevTools throttling "Slow 4G"):
    - Load Home and switch months: card shows "—", and no "€0" on the card or in the header, even when scrolled.
    - A month with no expenses shows "€0" once loaded.
    - Normal month totals unchanged, and the compact total still fades in on scroll.
- [ ] 6. Close the category sheet on clicks beside the web column (~15 lines)
  - Files: `apps/mobile/src/components/PhoneColumn.tsx`, `apps/mobile/src/components/CategorySheet.tsx`
  - Change:
    - `PhoneColumn` on web returns `<>{onPressOutside && <Pressable aria-hidden tabIndex={-1} onPress={onPressOutside} style={StyleSheet.absoluteFill} />}<View style={styles.column}>…</View></>`,
      with a comment saying two things. First, it sits behind the column, so only presses beside it land there.
      Second, it deliberately has no `accessibilityRole`/label and is `aria-hidden` and out of the tab order, because
      it's a mouse-only convenience and keyboard and screen-reader users already have the sheet's Close button and
      Escape (`onRequestClose`).
    - JSDoc for the prop. `CategorySheet` passes `onPressOutside={onClose}` and its web comment is updated.
    - `_layout.tsx` is untouched.
  - Verify:
    - Web 1440×900, from `/expense`, open "more": a click in the left/right margin closes the sheet, and so does a
      click on the dim area above the sheet. A click on the sheet's title, hint or padding doesn't close it. Picking a
      category works, and Escape still closes.
    - Web 390×844: unchanged.
    - iPhone (Expo Go): the sheet opens, closes on the backdrop and X, and picks as before.

Estimated total: ~195 changed lines, tests included.

## AC → evidence

| AC                                                                           | Evidence                                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Direct `/expense?expenseId` Update/Delete → Home                             | Slice 1 web check (fresh tab, both actions); plus no stale Undo on a later Category visit |
| Home → Category → expense Update/Delete → Category, Undo offered             | Slice 1 web + iPhone check                                                                |
| Home shows no €0 while loading; empty month shows €0 once loaded             | Slice 5 throttled web check                                                               |
| `/expense?categoryId=abc` → first quick category, Add works                  | Slice 3 web check                                                                         |
| `/category/abc?month=…` → invalid link + Back, no `/expenses`                | Slice 4 web check (Network panel)                                                         |
| `?month=2026-13` / `abc` invalid, no garbage month; no month OK              | Slice 4 web check                                                                         |
| `/expense?expenseId=abc` → invalid, no expense request                       | Slice 3 web check (Network panel)                                                         |
| Sheet closes on margin and backdrop, not inside; iPhone as before            | Slice 6 web 1440×900 + iPhone check                                                       |
| Parser unit tests (valid, abc, 0, negative, decimal, empty, 2026-13, 2026-1) | `test/linkParams.test.ts` (slice 2)                                                       |
| Gates green, no new suppressions                                             | Every slice runs §7 gates; no `eslint-disable` added                                      |

## Not doing (YAGNI)

- No "skip" mode in `useMonth`/`useExpenseDraft`, and no change to `undo.ts` (brief: Undo mechanism out of scope).
- No Undo offer on Home after a Delete from a direct link (brief).
- No dimming of the web margins while the sheet is open, and no change to `_layout.tsx`'s `PhoneColumn`.
- No dash/spinner variant of `CompactTotal`: it isn't rendered until loaded (see Open questions).
- `errorText`'s load-time `invalid_request` mapping stays as a harmless fallback.
- Hidden-category totals, API follow-ups and native deep links (brief: out of scope).

## Risks

- `router.replace('/')` from the modal-presented Expense screen on a one-screen stack might not land on Home on web.
  Cancel already does this today, and slice 1's fresh-tab check proves it for Update/Delete.
- The widened `useLocalSearchParams<{ x?: string | string[] }>` generic might not satisfy expo-router's constraint.
  Today's `?: string` form compiles. Slice 3's typecheck proves it.
- The RN-web stacking assumption (the column over an earlier `absoluteFill` sibling, and in-column clicks not
  reaching it) may not hold. Slice 6's 1440×900 check proves or disproves it. If it fails, the fallback is
  `pointerEvents="box-none"` on the column, still web-only.
- In-app params might not arrive as strings on native, in which case valid ids would read as invalid. The source says
  they're stringified via `resolveHref`. Slice 3 and 4 iPhone checks (Category → expense → Update; Home → Category)
  prove it.

## Open questions

- Non-blocking: the brief says the compact header total shows a placeholder while loading. The plan doesn't render
  `CompactTotal` until loaded instead. It's opacity 0 unless scrolled past the card, so a "—" would almost never be
  seen, but screen readers would still read it. This is the Category screen's existing pattern and a one-line change.
  If you want a visible "—", `CompactTotal` takes `spentCents: number | null` (+~6 lines in slice 5).
- Non-blocking: ids with leading zeros (`'007'`) are accepted as 7, like the API. Repeated params (`?month=a&month=b`)
  are treated as malformed.
- Non-blocking: hidden-category totals (brief's own open question) stay out of scope.

## Follow-ups

- None found that an AC doesn't cover. The pending-Undo leak only appears once Delete can land on Home, so it's
  handled in slice 1.

## Deviations

<filled by the developer during build>

## Revision 1

Skeptic: approve with edits.

- **Required:** Risk 4 now cites checks that can actually prove it, because slice 1 runs before `parseIdParam`
  exists. Slices 3 and 4 each gained an iPhone check, and Risk 4 now points to them.
- **Suggestions, all taken:**
  - Slice 3 says the bad-link title stays "Edit expense".
  - Slice 4 says `InvalidLink` has no `AddExpenseButton`.
  - Slice 5 records why the "—" uses the 34pt total style.
  - Slice 6's planned comment says why the margin target has no role or label.

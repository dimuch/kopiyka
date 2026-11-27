# Plan: Scroll areas end above the tab bar

Status: approved
Brief: ./brief.md
Branch: fix/scroll-above-tab-bar
Base: origin/main (a89a588e)

## Approach

Each page now leaves room for the bar after its scroll view, where today it adds that room as `paddingBottom` on the
scroll content. The scroll view (or, on the add-expense page, the `KeyboardAvoidingView` around it) gets
`marginBottom: barRoom`, and the content loses its `paddingBottom`. `useTabBarRoom()` and `useToastRoom()` keep their
values: the bar's bottom offset + 56 + a 16pt gap, plus 56 + 16 for the toast. The scroll view's bottom edge is then
16pt above the bar, or above the Undo bar while it shows, so it clips its rows there. Nothing is drawn behind the bar
or in the gap, and the page background shows through.

Subtract first: `ReorderList`'s `bottomInset` prop goes. The scroll view's measured bottom (`scrollY + viewportHeight`)
is now the edge the old maths built by taking the inset away. With room R the old viewport was `V + R`, so the old
bottom `scrollY + (V + R) − R` and the old `maxOffset` `listBottom − ((V + R) − R)` equal the new `scrollY + V` and
`listBottom − V`. Auto-scroll starts at the same window y as today (AC3).

Alternative considered: give the tab navigator's scene `paddingBottom: barRoom` (`sceneStyle` in `(tabs)/_layout.tsx`)
so the tab pages are done in one place. It lost for three reasons. The pages above the tabs (`expense.tsx`,
`category/[categoryId].tsx`) draw their own `PageTabBar` and would still need the per-page change, so there would be
two ways of doing it. `UndoToast`'s `bottom: useTabBarRoom()` and Budget's toast room would have to be counted from a
different origin. And the per-page change is a few lines on each page.

## Contracts

- DB: none
- API: none
- App:
  - `ReorderList` props: `bottomInset: number` removed. The Budget and Expenses callers stop passing it. `Drag.measure`
    uses `bottom: scrollY + viewportHeight` and `maxOffset: Math.max(offset, listBottom - viewportHeight)`.
  - `useTabBarRoom()` and `useToastRoom()`: same signatures and values. Their JSDoc changes from "room under its
    content" to "room a page leaves under its scroll view".
  - Pages: the scroll view's `style` gets `{ marginBottom: <room> }`. `contentContainerStyle` drops
    `{ paddingBottom: <room> }`. `<room>` is `toast.offer ? toastRoom : barRoom` on Budget and on the category page, and
    `barRoom` on the others.
- Reuses: `useTabBarRoom`, `useToastRoom`, `useUndoOffer`'s `toast.offer` (as Budget already uses it)
- New dependencies: none

## Version

Bump: patch — 1.26.0 → 1.26.1
Why: the §8b `patch` row (bug fix, styling). The scroll areas' layout changes in production. No capability is added,
and no API or connector changes.

## Slices

- [ ] 0. Bump version to 1.26.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.1
- [ ] 1. Stop the tab pages' lists 16pt above the tab bar instead of behind it
  - Files: apps/mobile/src/app/(tabs)/{budget,expenses,income,statistics,settings}.tsx,
    apps/mobile/src/components/ReorderList.tsx, apps/mobile/src/components/TabBar.tsx,
    apps/mobile/src/components/UndoToast.tsx, docs/design/design-system.md
  - Change: on the five pages, move the room from the content's `paddingBottom` to the scroll view's `marginBottom`.
    On Budget that is `bottomRoom`, so it switches with the toast as today. Fix the comments that say "room under the
    last row" (Budget, Settings). Remove `bottomInset` from `ReorderList`, as in Contracts, and reword the `maxOffset`
    comment to "until the list's end reaches the scroll view's bottom". Update the JSDoc on `useTabBarRoom` and
    `useToastRoom`, and the comment on the `TabBar` dock. Income's and Statistics' content gets a fixed
    `paddingBottom: space.sm` (8pt), which clears the last card's `shadow.card` (`0 2px 8px`). Budget and Expenses
    don't: their last row already has 8pt under it (`ReorderList`'s slot). Settings doesn't either: it ends on the
    Sign out button, which has no shadow, so Sign out stays where it is on main. In design-system.md, lines ~143–144,
    drop the clause 'with the "+" 12pt to its right' (that button is gone on Base). Also, "Scroll views leave that room
    plus 16pt under their content" becomes "Scroll views end 16pt above the bar, or above the Undo bar while it shows".
    About 50 lines.
  - Verify: the gates. Then the web build at phone width (390×844). On each tab, with a list longer than the screen,
    scroll slowly: no row shows behind the pill or below it, the page background shows in the 16pt gap, and the last
    row scrolls fully into view above the gap. Settings with too little content to scroll: Sign out sits 16pt above the
    bar, as on main. Statistics: the period menu still opens over the content. Budget: remove a category from a long
    month, and while the toast shows the list ends 16pt above it. When the toast goes, the list ends above the bar
    again. Budget and Expenses: long-press a row and drag it towards the bottom. The list starts scrolling as the finger
    nears the gap above the bar, the same place as on main (check main side by side), and stops once the last row is
    in view. Do the same checks on iPhone (home indicator inset).
- [ ] 2. Stop the add-expense form and category page 16pt above the tab bar
  - Files: apps/mobile/src/app/expense.tsx, apps/mobile/src/app/category/[categoryId].tsx
  - Change: `expense.tsx` gives the room to the `KeyboardAvoidingView` (`style={{ flex: 1, marginBottom: barRoom }}`),
    not to the ScrollView. With the keyboard up, KAV pads by its frame's overlap with the keyboard. A shorter frame means
    less padding, so the form ends at the keyboard's top with no extra bar-height gap. The category page takes
    `useTabBarRoom()` and uses `toast.offer ? toastRoom : barRoom` as the scroll view's `marginBottom`. Today it always
    pads by `toastRoom`, but as a margin that would leave a blank 72pt band whenever no toast shows. Its content gets
    `paddingBottom: space.sm` for the last expense card's shadow, as on Income. The add-expense form gets none: it ends
    on buttons or the plain "added" note, with no shadow. About 14 lines.
  - Verify: the gates. On web at phone width, the add-expense form scrolls with its last control (Save) fully visible
    above the gap, and the name suggestions still open over the amount fields. On the category page (Expenses → a
    category with many expenses), the list ends above the bar. After deleting an expense the list ends above the toast,
    and once the toast goes it ends above the bar. Scroll the summary card away slowly: the header's compact total and
    divider fade in over the same scroll range as on main. `CollapsingSummary` fades from `card.y`, which the margin
    doesn't move. Open a category that isn't in the month (NotInMonth) and a failed first load (LoadError, offline).
    Both render outside the scroll view, at the top, as on main. On iPhone, the same checks, and on the add-expense form tap the
    amount field: the form scrolls so the field sits right above the keyboard, with no blank band the bar's height
    between them.

## AC → evidence

| AC                                                                | Evidence                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| No row behind or below the bar; last row fully into view          | Slice 1 check (five tabs) and slice 2 check (add-expense, category page), web at phone width                                       |
| Budget toast: rows stop above it, then above the bar when it goes | Slice 1 Budget toast check (slice 2 does the same on the category page)                                                            |
| Drag auto-scroll edge unchanged relative to the bar               | The Approach's arithmetic (old and new edges are equal). Slice 1 drag check on Budget and Expenses, beside main, on web and iPhone |
| Web and iPhone show the gap above the bar                         | Slice 1 and 2 checks run on both. The iPhone run confirms the home indicator inset (`barBottom` already uses it)                   |

There is no unit test. The change is layout in screens and in `ReorderList`'s measuring, and conventions §6 checks UI
in the web build. The pure part, `edgeStep` in `data/reorder.ts`, doesn't change and keeps its tests.

## Not doing (YAGNI)

- Any change to the bar, the toast's position or `useTabBarRoom`'s value.
- A shared wrapper or hook for "scroll view above the bar". Each page sets one inline style, the same pattern as
  today's `paddingBottom`.
- Pages without the bar (`members`, `income-item`, `actual-end`, `delete-category`, `category-form`, `no-ledger`).
- Home: it doesn't scroll, and its toast already sits above the bar.

## Risks

- The ScrollView might not shrink for its margin. It relies on RN's and react-native-web's ScrollView growing and
  shrinking (`flexGrow`/`flexShrink: 1`) inside the flex-1 SafeAreaView. Slice 1's first web check proves or disproves
  this: the scroll indicator and clipped rows end 16pt above the bar.
- iOS might leave a blank band after the toast goes. On Budget the viewport grows, and if it was scrolled to the end,
  iOS may show blank space below the list until the next touch. Accepted: today's padding approach has the same case
  when the content shrinks. The slice 1 iPhone toast check only records what it sees in the PR's test plan.
- The KAV frame maths might not hold. `expense.tsx`'s padding comes from `frame.y + frame.height − keyboardY`
  (RN 0.88 `KeyboardAvoidingView`), and the margin only shortens the frame. The keyboard (~300pt) is taller than the
  room (~106pt), so the overlap stays positive. Slice 2's iPhone keyboard check proves or disproves it.

## Open questions

- no — The brief's toast line names "Budget, Expenses", but the Expenses tab has no Undo toast. Its toast shows on the
  category page opened from Expenses (`category/[categoryId].tsx`), which also draws the tab bar. Assumed: the category
  page is in scope (slice 2), and its scroll room follows the toast like Budget's.
- no — The brief says the bar keeps its "round '+'", but that button was removed on main (a465e421). Assumed: the bar
  stays exactly as on Base, and the plan doesn't touch it.

## Follow-ups

- docs/design/design-system.md line 136 (the `TabBar` component row) still describes a round "+" beside the bar,
  removed in a465e421. Slice 1 fixes line 143 only, because that is the paragraph it already edits.

## Deviations

## Consolidate

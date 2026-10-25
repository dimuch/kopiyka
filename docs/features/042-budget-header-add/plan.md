# Plan: Add a category from the Budget tab's header

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/budget-header-add
Base: origin/main (8ec0631, includes merged PR #55)

## Approach

Budget's header copies the Expenses tab's layout: an empty left `side`, `MonthSwitcher`, then a right `side` +
`sideEnd` holding an inline 44×44 "+" `Pressable`. Its label, route and `!ended` check come from the wide button.
That button now also needs `data` (shown only once loaded). The wide button and its `add` / `addText` styles go.
The `Icon` import stays, since the "+" uses it. Only one file changes: `apps/mobile/src/app/(tabs)/budget.tsx`.
Alternative considered: turn `AddExpenseButton` into a general `AddButton({ label, onPress })`. It lost because it
touches the Expenses tab and the category screen, which the brief keeps out of scope. It would also leave a
component whose whole content is one `Pressable` plus one style. The Expenses tab's own Home button is already an
inline `Pressable` with `iconButton` in the same way. A sibling `AddCategoryButton` would have one caller, and
conventions §1 asks for ≥2 before a new module.

## Contracts

- DB: none
- API: none
- App: no new types, hooks, components or routes. The header "+" pushes `{ pathname: '/add-category', params: { month } }`,
  the same as the old button. Label: `` `Add a category to ${monthName(month)}` ``, role `button`.
- Reuses: `MonthSwitcher`, `Icon` (`plus`, default size, `colors.accent`, the same as `AddExpenseButton`), `monthName`. The
  `side` / `sideEnd` / `iconButton` style values are copied from `expenses.tsx` (two screens, so below the rule of three).
- New dependencies: none

## Slices

- [ ] 1. Add a category from the Budget tab's header
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx`
  - Change:
    - Header style becomes `{ flexDirection: 'row', alignItems: 'center', paddingBottom: 10 }`. Its children are
      `<View style={styles.side} />`, `MonthSwitcher`, and `<View style={[styles.side, styles.sideEnd]}>`.
    - The right side renders `{data && !ended ? <Pressable …><Icon name="plus" color={colors.accent} /></Pressable> : null}`,
      as a ternary rather than `&&` (`rendering-no-falsy-and`).
    - Add the `side`, `sideEnd` and `iconButton` styles, with the "equal-width sides … flexBasis 0 matters on web"
      comment. Delete the `{!ended && (<Pressable … styles.add>)}` block after the list/empty state, and the `add`
      and `addText` styles.
    - About +20 / −20 lines.
  - Verify: run gates (§7). Then on web, with the `web` + `api` launch configs at 390×844, signed in as the QA user:
    - (a) This month and next month both show "+" at the header's right. It opens "Add a category" titled for that
      month, and after saving, the new category is listed.
    - (b) The month label's horizontal centre matches the Expenses tab's: compare screenshots, or check
      `getBoundingClientRect()` of the month text on both tabs.
    - (c) An ended month shows no "+", and no wide "Add a category" button shows on any month, filled or empty.
    - (d) An empty future month still shows "No budget for <Month> yet" and Copy when the previous month has
      categories. The header "+" adds a category to it, and the list then appears.
    - (e) The DOM shows `role="button"` and `aria-label="Add a category to November"` on November.
    - (f) While loading, or after a first-load error with Retry, no "+" shows.
    - (g) Light and dark appearance.

## AC → evidence

| AC                                                        | Evidence                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Header "+" on this/next month opens Add a category, saves | Slice 1 verify (a)                                                         |
| Month switcher centred like Expenses                      | Slice 1 verify (b)                                                         |
| Ended month no "+"; no wide button anywhere               | Slice 1 verify (c)                                                         |
| Empty month keeps Copy; "+" adds to it                    | Slice 1 verify (d)                                                         |
| Role button, label "Add a category to November"           | Slice 1 verify (e)                                                         |
| iPhone (Expo Go) checked by the user                      | User check after slice 1: header layout, "+" opens the editor, ended month |
| Gates green                                               | `yarn format:check && yarn lint && yarn typecheck && yarn test` on slice 1 |

## Not doing (YAGNI)

- A Home button on the left side of the Budget header (out of scope in the brief). The left side stays an empty
  spacer.
- Generalising `AddExpenseButton`, or a shared header component for the two tabs.
- A `HeaderDivider` or collapsing summary on Budget, and the Expenses header's `zIndex: 1`, which exists only for
  that divider.
- Any change to `add-category.tsx`, `expenses.tsx` or `NoBudget`.

## Risks

- PR #55 (brief 040) is merged into the base. Its `budget.tsx` changes are the row `map` (an `openRow` View with
  planned-amount and rename Pressables) and the `openRow` / `rename` styles just above `add:`. Slice 1 deletes only
  `add` / `addText` and leaves those alone. `Icon` stays imported (used by "+" and the rename pencil).
- The month switcher could sit off-centre on web if `flexBasis: 0` is missing. Slice 1 verify (b) checks this
  against the Expenses tab.
- The "+" could show on a month that hasn't loaded. That can't happen: `useMonth` returns `data: null` as soon as
  the month key changes. Slice 1 verify (f) checks it.

## Open questions

- Non-blocking: the brief says "only once the month has loaded". After a failed refresh where `data` is kept (the
  "Couldn't refresh" banner), the "+" stays visible. Assumption used: yes, it stays, because the month did load once.

## Follow-ups

- If a third screen needs a 44×44 "+" header button, extract one (`HeaderAddButton({ label, onPress })`) and move
  `AddExpenseButton`'s callers onto it.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

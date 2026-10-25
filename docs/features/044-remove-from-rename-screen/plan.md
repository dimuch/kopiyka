# Plan: Remove a category from the Budget tab, via its rename screen

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/remove-from-rename-screen
Base: origin/main (9768815)

## Approach

This is an app-only change across four files. The API and `removeFromMonth` / `restoreToMonth` stay as they are.

- **`delete-category.tsx` learns where to return.** It reads a `from` link param. When `from === 'budget'`, it ends with
  `router.dismissTo({ pathname: '/budget', params: { month } })` instead of `router.dismissTo('/')`. Any other value,
  or no value, keeps today's Home.
- **The Budget tab takes the offer**, the same way Home and the Category screen do: `useUndoOffer(reload)` plus
  `UndoToast`.
- **The rename screen gets the button.** It shows "Remove from {Month}" under Save, outside an ended month, and the
  button pushes `/delete-category?categoryId=&month=&from=budget`. Cancel there already goes `router.back()` to the
  rename screen.
- **`CategoryNameForm` gets an optional `children` slot.** It renders under Save, so the button sits under Save inside
  the form's ScrollView. It hides with Save once a refusal means saving can't help (`gone`).

Alternative considered: keep `delete-category.tsx` as it is, so a removal from Budget lands on Home with the bar.
That needs no `from` param and no Budget bar (about 25 lines in total). It lost because the user starts and wants to
end on the Budget tab, and AC1 says so (see Open questions).

## Contracts

- DB: none
- API: none (`DELETE`/restore used through `removeFromMonth` / `restoreToMonth` as today)
- App:
  - Route `/delete-category?categoryId=<id>&month=<YYYY-MM>[&from=budget]`. The `from` param is typed
    `string | string[] | undefined` in `useLocalSearchParams` and checked inline as `params.from === 'budget'`. Anything
    else, an array included, means today's behaviour, so it has no other values to parse. There's no `linkParams.ts`
    helper because it would have one caller and its whole body is that comparison.
  - On success with `from=budget`: `setPendingUndo({ message: removedMessage(...), restore: ... })`, unchanged, then
    `router.dismissTo({ pathname: '/budget', params: { month } })`. Otherwise it calls `router.dismissTo('/')` as today.
    The error paths are unchanged.
  - `CategoryNameForm` gets a new optional prop:
    `children?: ReactNode`, which renders directly under Save and isn't shown while `gone`. Its JSDoc: "Under Save
    while saving can still help: the rename screen's Remove". `add-category.tsx` passes nothing.
  - Rename screen button: a `Pressable` with `accessibilityRole="button"` and `disabled={busy}`. Its text is
    `` `Remove from ${monthName(month)}` ``, and it has no explicit label because the text is the name. It's hidden
    when `month < thisMonth`, with `thisMonth = useState(() => kyivMonth(new Date()))[0]` as on `budget.tsx`. It
    pushes `{ pathname: '/delete-category', params: { categoryId: category.categoryId, month, from: 'budget' } }`.
    Its styles are copied from `expense.tsx`'s `delete` / `deleteText`: 48pt high, `fonts.bodyMedium` 15,
    `colors.danger`.
  - Budget tab: `const toast = useUndoOffer(reload)`, then `{toast.offer ? <UndoToast offer={toast.offer} onUndo={toast.restore} /> : null}`
    as the SafeAreaView's last child. While an offer shows, the ScrollView content's `paddingBottom` becomes 104, the
    Category screen's value, so the bar can't cover the last row.
- Reuses: `useUndoOffer` / `setPendingUndo` (`data/undo.ts`), `UndoToast`, `removedMessage` / `removeWarning`
  (`data/categoryRemove.ts`), `useMonth`'s `reload`, `kyivMonth`, `monthName`, and the existing
  `/delete-category` confirmation screen unchanged apart from where it returns.
- New dependencies: none

## Slices

- [x] 1. Show the Undo bar on the Budget tab after a removal started there
  - Files: `apps/mobile/src/app/delete-category.tsx`, `apps/mobile/src/app/(tabs)/budget.tsx`
  - Change:
    - `delete-category.tsx`: add `from` to the params type. Pass `toBudget: boolean` (`params.from === 'budget'`)
      to `Confirm`, and pick the `dismissTo` target from it.
    - Update the comment "Home takes the offer when it gains focus" to "the screen it returns to (Budget or Home)
      takes the offer…".
    - `budget.tsx`: add `useUndoOffer(reload)`, the `UndoToast` and the padding override.
    - About +20 / −3 lines.
  - Verify: run the gates (§7). Then on web (`web` + `api` launch configs, 390×844, QA user):
    - (a) Open `/delete-category?categoryId=<id>&month=<this month>&from=budget` as a typed URL, for a category with
      expenses. Remove. It lands on the Budget tab for that month, the row is gone, and the bar says
      "Removed “x” from October and N expenses". Undo brings the row back and the Expenses tab shows its expenses
      again.
    - (b) Expenses tab → a category → ⋯ → "Remove from October" → Remove. It lands on Home with the bar, as today,
      and Undo works.
    - (c) After (b), open the Budget tab: no stale bar.
    - (d) Light and dark appearance.
- [x] 2. Remove a category from its rename screen
  - Files: `apps/mobile/src/components/CategoryNameForm.tsx`, `apps/mobile/src/app/rename-category.tsx`
  - Change:
    - `CategoryNameForm`: add the `children` prop. Render it after the Save `Pressable` inside the existing
      `gone ? null : (…)` branch, which becomes a fragment.
    - `rename-category.tsx`: add `thisMonth`. Inside the `CategoryInMonth` render callback, pass the Remove button as
      children unless the month has ended. Add the `remove` / `removeText` styles.
    - About +30 / −2 lines.
  - Verify: run the gates. Then on web at 390×844:
    - (a) Budget → pencil on a row with expenses → "Remove from October" sits under Save. The confirmation shows
      "Remove “x” from October?" with the expense warning. Remove brings you back to the Budget tab for October:
      both modals are closed, the row is gone and the bar shows. Undo puts the row back, and the Expenses tab shows
      its expenses.
    - (b) The same on next month (switch the Budget tab to November first). It lands on November.
    - (c) Pencil → Remove → Cancel goes back to the rename screen with the name field. Budget still lists the row.
    - (d) Open `/rename-category?categoryId=<id>&month=<an ended month>` from a deep link. There's no Remove button,
      and Save still gives the ended text as today.
    - (e) `add-category` shows no Remove button.
    - (f) The DOM shows `role="button"` with the text "Remove from October". The target is ≥ 44pt.
    - (g) Repeat slice 1 (b) once more: the Category flow still ends on Home.

## AC → evidence

| AC                                                                                          | Evidence                                                                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Budget → pencil → Remove → confirmation → back on Budget, row gone, Undo bar; Undo restores | Slice 2 verify (a), (b); slice 1 verify (a) for the bar itself                  |
| Cancel on the confirmation returns to the rename screen; nothing removed                    | Slice 2 verify (c)                                                              |
| Category screen ⋯ → Remove still ends on Home with Undo                                     | Slice 1 verify (b), slice 2 verify (g)                                          |
| Rename screen for an ended month (deep link) shows no remove button                         | Slice 2 verify (d)                                                              |
| iPhone (Expo Go) checked by the user                                                        | User check after slice 2: the flow in AC1 (modals close, bar on Budget), Cancel |
| Gates green                                                                                 | `yarn format:check && yarn lint && yarn typecheck && yarn test` on each slice   |

## Not doing (YAGNI)

- A trash icon on Budget rows (out of scope in the brief).
- A `parseFromParam` in `linkParams.ts`, or a general `returnTo` param. There's one caller and one value.
- Changing `delete-category.tsx`'s Cancel fallback for a deep link with no history. It still replaces with Home.
- A `refusedText` on the category restore (see Follow-ups).
- Extracting a shared "destructive text button" style. There's a third copy now (`expense.tsx` `deleteText`, the
  Category menu's `menuDelete`, and rename), but `expense.tsx` is under open PR #57, so it's left for the
  Consolidate pass or later.
- Any API or `removeFromMonth` change.

## Risks

- The Budget tab's `useFocusEffect` (in `useUndoOffer` and `useMonth`) might not fire when the modals above `(tabs)`
  close. Home already relies on the same thing after `dismissTo('/')`, and so does the Category screen after the
  expense modal. Slice 2 verify (a) proves it: the row is gone and the bar shows.
- The `dismissTo` target might not be found. Expo Router 57.0.26 implements `dismissTo` as `POP_TO`: it pops the root
  stack back to `(tabs)` and navigates the tab to `budget` with `month`, and when the target isn't found it replaces
  the current screen. Slice 1 verify (a) covers the replace path (a typed URL). Slice 2 verify (a) and (b) cover the
  pop path and the month.
- A pending Undo might not be taken and show later on another screen. That happens if the landing screen doesn't take
  it. Slice 1 verify (a) and (c), and slice 2 verify (a), check for it.
- PR #57 overlap: none. It touches only `apps/mobile/src/app/expense.tsx` and conventions §5, and this plan touches
  neither.

## Open questions

- Non-blocking: should a removal started on the Budget tab land back on Budget with the bar? That's the brief's
  reading, and this plan follows it. The simpler route is to keep today's `dismissTo('/')`, so it lands on Home with
  the bar. That's slice 2 alone with no slice 1, but it leaves the user on a tab they didn't start from.
  Assumption: Budget.
- Non-blocking: when an Undo bar shows, the Budget list's bottom padding grows to 104 so the bar can't cover the last
  row. That isn't in the brief. Assumption: include it (one inline override, as the Category screen has it).
- Non-blocking: the button hides once the rename form has a `gone` refusal (the month ended or the category left the
  month while the screen was open), because removing would be refused too. Assumption: hide it.

## Follow-ups

- The category remove Undo appears to have no `refusedText`. If the month ends between Remove and Undo, `restoreToMonth`
  gets `409 month_ended`, and the bar would offer Retry rather than say "October has ended, so it can’t be
  restored." (expense delete got this in brief 041). This is the same today from the Category screen, so it's out of
  scope here.
- A fast double tap on a button that pushes a screen (rename's Remove, the row pencil, the ⋯ menu) can push it
  twice. A shared push-once guard would cover all three.

## Deviations

- slice 2 (web check): (g) wasn't repeated after slice 2; `delete-category.tsx` didn't change in slice 2, and slice
  1's (b) ran on the same code. A scripted check that clicked the rename screen's button hidden under the
  confirmation stacked extra confirmations; `dismissTo` still closed them all. A real tap only reaches the top
  screen, but a fast double tap on Remove could push two (the row pencil and the ⋯ menu can too): see Follow-ups.

## Consolidate

CONSOLIDATE: reused 6 · extracted 0 · left 1

- REUSE: `useUndoOffer`/`UndoToast`, `setPendingUndo`, the `/delete-category` confirmation, `removedMessage`,
  `kyivMonth`, `monthName`.
- LEAVE the Remove button's `remove`/`removeText` styles, a copy of `expense.tsx`'s `delete`/`deleteText`: two copies
  in screens, and #57 is editing `expense.tsx`.

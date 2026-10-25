# Undo that finds nothing to bring back

Type: fix

## Why

Brief 045 follow-up. When Undo after a removal or a delete is refused with `404 not_found`, the Undo bar says
"Couldn’t undo" and offers Retry. Retry can never work: the API found nothing to restore.

When this happens (checked in the API):

- **Category removal** (`POST …/categories/:id/months/:month/restore`, `restoreToMonth` in
  `apps/api/src/categories/monthLists.ts`): 404 when the category is no longer removed from that month. Another
  member already restored it, or deleted the category, or it is unknown or belongs to another ledger.
- **Expense delete** (`POST …/expenses/:id/restore` in `apps/api/src/expenses/routes.ts`): 404 when the expense is
  not deleted any more (another member restored it), is unknown, or its category was deleted or removed from the
  expense's month meanwhile.

Today `restoreRefusedText` in `apps/mobile/src/data/monthEnded.ts` only knows `month_ended` and returns null for
everything else, so a 404 lands in the retryable "failed" state.

## What

- An Undo refused with `not_found`, after either a category removal or an expense delete, shows one clear line in
  the Undo bar and no Retry. This uses the existing `refused` state of the bar (`UndoOffer` in
  `apps/mobile/src/data/undo.ts`), the same as `month_ended` since brief 041.
- VoiceOver announces the same line (already done by `useUndoOffer` for refused offers).
- The wording is in **Open questions**. It is decided at Gate A.

## Acceptance criteria

- [ ] A category removal's Undo refused with `404 not_found` shows the agreed line and no Retry.
- [ ] An expense delete's Undo refused with `404 not_found` shows the agreed line and no Retry.
- [ ] `month_ended` still shows "{Month} has ended, so it can’t be restored." Any other failure (network, 5xx,
      `name_taken`) still shows "Couldn’t undo" with Retry.
- [ ] Unit tests cover the new text and which codes it applies to (`apps/mobile/test/monthEnded.test.ts` or next
      to it).
- [ ] Web check at 390×844 that forces the 404: remove a category, restore it through the API outside the app
      (as another member would), then press Undo. Same for an expense.
- [ ] iPhone (Expo Go) checked by the user.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Any API change. The 404s stay as they are.
- `name_taken` on a category restore. Retry can work there once the name is free, so it keeps Retry.
- Refreshing the list behind the bar after the 404. The screen refreshes on its next focus as today.
- Undo timing, the bar's look, and the other Undo texts.

## Notes

- Both callers build `refusedText` the same way:
  `(err) => (err instanceof ApiError ? restoreRefusedText(err.code, month) : null)`, in `delete-category.tsx`
  `setPendingUndo` and `expense.tsx` `remove`.
- The bar shows at most two lines (`numberOfLines={2}`) at 390 wide, so the text must stay short.

## Decisions

- Wording for the 404 line (Gate A, 2026-10-25): option A, "Already restored or deleted — nothing to undo." for
  both kinds. Option B ("“{Name}” was already restored or deleted.") was not chosen.

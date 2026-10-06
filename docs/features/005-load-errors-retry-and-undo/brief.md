# Load errors with retry, and a reliable Undo

Type: fix

## Why

Conventions §5 require loading, error-with-retry and empty states on every async surface. Today:

- **No retry on Home or Category.** Home ignores `reload` and suggests "pull back later", though
  there's no pull-to-refresh (`app/index.tsx:17,78-81`). Category shows text only
  (`app/category/[categoryId].tsx:82-83`).
- **A failed Undo is swallowed** after the toast is cleared (`[categoryId].tsx:38-43`), so the
  user thinks the expense came back when it didn't.
- **Stale or hidden data.** Switching months shows the previous month's numbers under the new
  label, and a failed refetch hides data that was already loaded (`data/useMonth.ts:19-27`).
- **Category edge cases.** A missing category spins forever, and a web URL without `month`
  breaks the header (`[categoryId].tsx:69,84-85`).
- **VoiceOver doesn't hear the toast or errors.** `accessibilityLiveRegion` is Android-only
  (`[categoryId].tsx:137`, `expense.tsx:332,360`).

Audit: `docs/audits/2026-10-architecture.md` M5–M8, M15.

## What

- **Shared error block.** `components/LoadError.tsx` (`message`, `onRetry`) is used by Home,
  Category and Expense, with user-facing copy (no "check the API is running").
- **`useMonth` keys its data by request.** A month or category that doesn't match the current
  request counts as loading. When data is already shown and a refetch fails, the data stays and an
  inline error with Retry appears.
- **Undo clears the toast only after the restore succeeds.** If it fails, the toast says "Couldn't
  undo" with Retry, until it times out or Retry works.
- **Category screen edge cases.** After a load where the category isn't in the list, it shows
  "Category not found" with Back. A missing `month` param defaults to the current Kyiv month
  (`kyivMonth` from 003).
- **iOS announcements.** The Undo toast, save errors and the "Added …" confirmation are announced
  with `AccessibilityInfo.announceForAccessibility`.

## Acceptance criteria

- [ ] With the API stopped, Home, Category and Expense each show an error with a Retry button.
      After starting the API, Retry loads the screen in place (web build, phone width).
- [ ] Switching Home from October to September while the request is slow shows the spinner (or
      September data), never October's totals under "September" (throttle the network in devtools).
- [ ] With data on screen, stopping the API and refocusing the screen keeps the data visible and
      shows an inline error with Retry.
- [ ] Delete an expense, stop the API, then press Undo: the toast shows "Couldn't undo" with Retry.
      Starting the API and pressing Retry restores the expense, and the list shows it.
- [ ] `/category/999?month=2026-10` shows "Category not found" with Back. `/category/<id>` without
      `month` opens on the current Kyiv month.
- [ ] On iOS with VoiceOver, the Undo toast and a save error are announced (record in the PR test plan).
- [ ] `yarn lint typecheck` green; the `useMonth` suppression either stays with its reason comment or
      goes away. No new suppressions.

## Out of scope

- Pull-to-refresh.
- Offline detection or caching, and any data-fetching library.
- Empty states for "ledger has zero categories" (can't happen: every ledger is seeded with 15).
- Moving pure helpers out of screens (brief 006).

## Notes

- Builds on 003 (`kyivMonth`) and 004 (Expense already has `reload`).

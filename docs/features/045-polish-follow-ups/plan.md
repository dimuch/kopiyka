# Plan: Polish after removing via the rename screen

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/polish-follow-ups
Base: origin/main (8f1809d)

## Approach

The change is app-only and touches seven files. The three fixes don't depend on each other, so each one is its own commit.

- **Undo refusal.** `delete-category.tsx`'s `setPendingUndo` gets
  `refusedText: (err) => (err instanceof ApiError ? restoreRefusedText(err.code, month) : null)`, the same line
  as `expense.tsx`. `month` is the removal month, and the restore goes into that same month.
- **Danger text.** `theme.ts` gets `dangerText(colors)`, which returns today's
  `{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.danger }`. The three `makeStyles` use it in place of
  their copies. This is the third copy, so the rule of three applies. `theme.ts` is already where font names and
  palette lookups live (`categoryTile`).
- **Push once.** A new `usePushOnce()` hook goes in `src/pushOnce.ts`, next to the other navigation helpers
  (`closeToBudget.ts`, `linkParams.ts`). It keeps a `useRef` flag that is set on the first push. Later presses do
  nothing until the screen gains focus again (`useFocusEffect`), so the button works again after the user comes back.
  The rename screen, the Budget tab and the Category screen each call the hook once and use it for their button.

Alternative considered: a time window (ignore a second push within ~500 ms). It lost because a screen that opens
slowly can still take a second tap after the window closes. Focus is the actual event that means "the user came back".
A plain `disabled`/state flag doesn't help either: it only takes effect after a re-render (brief Notes).
Also considered: expo-router 57's `dangerouslySingular` on the `delete-category`/`rename-category` `Stack.Screen`s in
`_layout.tsx` (~2 lines). It lost because it changes those routes' identity everywhere, and the "dangerously" API is
less clear than a guard at the button.

## Contracts

- DB: none
- API: none
- App:
  - `apps/mobile/src/pushOnce.ts`:
    `export function usePushOnce(): (href: Href) => void`. `Href` and `router` come from `expo-router`, and
    `router.push(href: Href)` exists in expo-router ~57.0.26. The first call pushes. Further calls are ignored until
    the calling screen gains focus again. One hook per screen covers every button on that screen that uses it.
    The focus callback is `useCallback(() => { pushed.current = false; }, [])`, since `useFocusEffect` re-runs when
    its callback changes. The returned push is wrapped in `useCallback(…, [])` too, so the Budget rows' `.map` gets a
    stable function.
  - `apps/mobile/src/theme.ts`: `export function dangerText(colors: Palette): TextStyle` (with
    `import type { TextStyle } from 'react-native'`, which is erased, so `theme.test.ts` still runs in Node). It
    returns `{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.danger }`.
  - `PendingUndo` is unchanged. Category removal now fills in its optional `refusedText`.
- Reuses: `restoreRefusedText` (`data/monthEnded.ts`), `ApiError` (`api/client.ts`), `useFocusEffect` (the same
  pattern as `data/undo.ts`), `UndoToast`'s existing `refused` state, `useThemedStyles`/`makeStyles`.
- New dependencies: none

## Slices

- [x] 1. Explain a refused Undo of a category removal in an ended month (~3 lines)
  - Files: `apps/mobile/src/app/delete-category.tsx`
  - Change: import `restoreRefusedText` next to `monthEndedText`, and add the `refusedText` line above to
    `setPendingUndo`. A one-line comment says the restore goes into the removal month. Nothing else changes, so other
    refusals and network failures still give "Couldn’t undo" + Retry.
  - Tests: the existing `apps/mobile/test/monthEnded.test.ts › restoreRefusedText` covers the text
    (`month_ended` gives "{Month} has ended, so it can’t be restored." and other codes give null). The wiring sits in
    a screen, which can't be unit-tested here (no RN test environment, and `api/client.ts` imports
    `expo-secure-store`). So the Prove-It is the web check below, run on the base first.
  - Verify (web 390×844, `web` + `api` launch configs): remove a category with no expenses from the current month,
    from the Category screen's ⋯ menu. Before pressing Undo, run this in the page:
    `const f = window.fetch; window.fetch = (u, i) => String(u).endsWith('/restore') ? Promise.resolve(new Response('{"error":"month_ended"}', { status: 409, headers: { 'content-type': 'application/json' } })) : f(u, i);`
    Then press Undo.
    - On the base, the bar shows "Couldn’t undo" + Retry. That is the bug.
    - With the fix, it reads "October has ended, so it can’t be restored." with no button, and it disappears after
      ~10 s.
    - Do the same from the rename screen, where the bar shows on the Budget tab.
    - Swap the stub's body to `{"error":"not_found"}` with status 404. That still gives "Couldn’t undo" + Retry.
    - Clean up: reload the page, then `fetch` POST the category's `…/months/2026-10/restore` with
      `credentials: 'include'`.

- [x] 2. Share the danger text style of Delete and Remove buttons (~12 lines)
  - Files: `apps/mobile/src/theme.ts`, `apps/mobile/src/app/expense.tsx` (`deleteText`),
    `apps/mobile/src/app/category/[categoryId].tsx` (`menuDelete`), `apps/mobile/src/app/rename-category.tsx`
    (`removeText`).
  - Change: add `dangerText`. Each of the three style keys becomes `<key>: dangerText(colors)`. Keys and JSX stay as
    they are. `NotionSyncPanel.failed` (14 pt) and `settings.signOutText` (semibold) are different styles, so they
    stay out.
  - Tests: none. The style is a constant, so the computed-style web check below is the evidence.
  - Verify (web 390×844, dark and light): read the computed style of "Delete expense", the ⋯ menu's "Remove from
    October" and the rename screen's "Remove from October". Each shows `font-family: IBMPlexSans_500Medium`, 15px, and
    `rgb(255, 138, 128)` in dark or `rgb(194, 59, 49)` in light, the same as on the base.

- [x] 3. Open each screen once on a fast double tap (~40 lines)
  - Files: `apps/mobile/src/pushOnce.ts` (new), `apps/mobile/src/app/rename-category.tsx`,
    `apps/mobile/src/app/(tabs)/budget.tsx`, `apps/mobile/src/app/category/[categoryId].tsx`.
  - Change:
    - Add the hook from Contracts. Its comment says why: the pushed screen takes focus only after a re-render, so two
      presses in one tick would both push.
    - The rename screen's Remove calls `pushOnce({ pathname: '/delete-category', params: … })`.
    - The Budget row's pencil calls `pushOnce({ pathname: '/rename-category', params: … })`.
    - The Category screen's `onRemove` keeps `setMenuOpen(false)` and then calls `pushOnce(...)`.
    - Other pushes on those screens stay `router.push` (brief: out of scope).
  - Tests: none. The hook is React and navigation state with no pure logic left once those are taken out. On the
    base, the web checks below serve as the Prove-It.
  - Verify (web 390×844): fire two clicks in one tick with
    `const b = <the button>; b.click(); b.click();` in the page. RN-web's `PressResponder.onClick` calls `onPress` for
    a programmatic click. Count the stacked screens with
    `document.body.textContent.match(/<title>/g)?.length`.
    - Rename's "Remove from October" (title "Remove category"): the count is 2 on the base and 1 with the fix. One
      Cancel shows "Rename category" again, and pressing Remove again opens the confirmation.
    - Budget row's pencil (`aria-label="Rename … in October"`, title "Rename category"): 1. One Cancel shows Budget,
      and the pencil (on the same row or another) opens rename again.
    - Category ⋯ → "Remove from October" (title "Remove category"): 1. Cancel, then ⋯ → Remove opens it again.
    - Also try a real double click on each button, to check that ordinary use isn't broken.

Total ≈ 55 changed lines across 3 commits.

## AC → evidence

| AC                                                                              | Evidence                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web: two quick clicks on rename's Remove open one confirmation; one Cancel back | Slice 3 web check (count 2 on base → 1; Cancel shows rename)                                                                                                                                |
| Web: two quick clicks on a Budget pencil open one rename; one Back to Budget    | Slice 3 web check                                                                                                                                                                           |
| Web: two quick clicks on ⋯ → "Remove from {Month}" open one confirmation        | Slice 3 web check                                                                                                                                                                           |
| Web: after coming back, the same button opens it again                          | Slice 3 web check, re-press after Cancel on each of the three                                                                                                                               |
| Three danger texts share one style, render unchanged                            | Slice 2: computed-style web check, dark and light, same as base                                                                                                                             |
| Category Undo refused with `month_ended` shows the ended text, no Retry         | Slice 1: forced-409 web check (base: Retry; fix: text, no button) + existing `restoreRefusedText` unit tests                                                                                |
| iPhone (Expo Go) checked by the user                                            | PR test plan: user double-taps the three buttons and looks at the three danger texts, both themes                                                                                           |
| Gates green                                                                     | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit, unpiped; export `DATABASE_URL_TEST` from the main checkout's `.env` so API integration tests don't skip |

## Not doing (YAGNI)

- Guarding the other pushes, such as planned-amount, add-category, the expense rows and `AddExpenseButton`. The
  brief puts these out of scope, and each is a one-line swap to `usePushOnce` later.
- A `DangerText` component, or sharing the 48 pt `delete`/`remove` button styles. The brief asks only for the text
  style.
- `refusedText` for a category restore refused with `not_found` (brief: other refusals behave as today).
- A React/RN component test setup to unit-test the hook. That would be a new dependency that no AC needs.

## Risks

- Two `click()` calls in one tick might not reproduce the double push on the base, because React may flush the
  first click's update before the second. Slice 3 is checked on the base first. If the count is already 1, try a
  real double click and an iPhone double tap. If none of them reproduces the double push on web, record that in
  Deviations and rely on the iPhone check.
- `useFocusEffect` might not fire on a screen under a closing modal on web. If so, "opens again" would fail. Today's
  Undo already depends on the same event (the Category screen takes the expense modal's offer on focus), so this is
  unlikely. Slice 3's re-press check proves it.
- `dangerText`'s `TextStyle` return type might not fit `StyleSheet.create`'s inferred styles. Slice 2's typecheck
  shows this. If it doesn't fit, return the literal object type instead.

## Open questions

None.

## Follow-ups

- A category restore refused with `not_found` (another member already restored it, or deleted the category) offers
  Retry, which can't work. A `restoreRefusedText`-like text for it would need wording, so it belongs in a brief.

## Deviations

- Web checks: Metro started from this worktree (under `.claude/worktrees/`) served Expo's "Welcome" page instead
  of the app, so the checks ran on a detached sibling worktree (`../kopiyka-polish-web`) with each slice's files
  copied in. The base checks ran there before any change: two clicks in one tick stacked 2 screens on all three
  buttons, and a forced `409 month_ended` gave "Couldn’t undo" + Retry.

## Consolidate

CONSOLIDATE: reused 4 · extracted 0 · left 2

- REUSE: `restoreRefusedText`, `ApiError`, `useFocusEffect` + `useCallback` (as in `data/undo.ts`), `fonts`/`Palette`.
- LEAVE `usePushOnce` vs the screens' `inFlight` refs: those guard an async request until it settles, not a push
  until focus returns; sharing them would mix two lifetimes. The other `router.push` sites are out of scope (brief).
- LEAVE `settings.signOutText` (semibold) and `NotionSyncPanel.failed` (14 pt): different styles, not copies of
  `dangerText`.

# Plan: Delete an expense at once, with Undo

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->

Brief: ./brief.md
Branch: fix/delete-expense-without-confirm
Base: origin/main (9768815)

## Approach

The change is in `apps/mobile/src/app/expense.tsx` only. Delete `confirmDelete` (the `window.confirm`/`Alert.alert`
question). `remove()` then goes straight to `deleteExpense`. With no awaited dialog in front of it, `busy` alone can't
stop a second press in the same tick, so add an `inFlight` ref the way `delete-category.tsx` does. Everything after the
DELETE stays as it is: `setPendingUndo`, `leave()`, and the `month_ended`/`errorText` error text.

Alternative considered: keep the question and fall back to deleting when `confirm()` is blocked. It lost because a
blocked `confirm()` returns `false`, the same as Cancel, so the app can't tell the two apart. The user also chose to
delete at once and rely on Undo (brief, Notes).

## Contracts

- DB: none
- API: none (the existing `DELETE /api/ledgers/:id/expenses/:expenseId` and its restore are unchanged)
- App: no new types, hooks, props or routes.
  - `expense.tsx` loses the module-level `confirmDelete(name): Promise<boolean>`. It has no other callers (checked with
    `rg confirmDelete apps`).
  - `ExpenseForm` gains `const inFlight = useRef(false)`.
- Reuses: the `inFlight` + `busy` shape from `delete-category.tsx` (lines 76–106); `deleteExpense`, `restoreExpense`,
  `setPendingUndo`, `restoreRefusedText`, `lockedText`, `leave`, `showError`, `errorText`, all as they are.
- New dependencies: none

## Slices

- [x] 1. Delete an expense at once, without asking first
  - Files: `apps/mobile/src/app/expense.tsx`
  - Change:
    - Remove `confirmDelete` (lines 51–60) and the `Alert` import. `Alert` has no other use: the only other match is the
      `categoryAlert` variable. `Platform` stays, because `KeyboardAvoidingView` uses it (line 282).
    - Change `import { useEffect, useState }` to `import { useEffect, useRef, useState }`.
    - Next to `busy`, add `inFlight = useRef(false)` with the `delete-category.tsx` comment ("`busy` disables the button
      only after a re-render; two presses in one tick would both get here.").
    - `remove()` starts `if (!expense || inFlight.current) return; inFlight.current = true; setBusy(true);`.
    - The catch sets `inFlight.current = false` next to its `setBusy(false)`. The success path leaves the screen, so it
      doesn't reset the ref (same as `delete-category.tsx`).
    - Move the "The saved name, not one being edited" comment onto the `message:` line, which still uses `expense.name`.
    - About 20 changed lines.
  - Tests: no pure logic changes, so there are no unit tests to add (conventions §6: UI is checked on web plus the
    gates). The two web checks below come before the fix as well as after it, which stands in for Prove-It.
  - Verify (launch configs `api` + `web`, in-app browser at 390×844, signed in as the QA user, on an October 2026
    expense). After each page load, evaluate this once:
    ```js
    (() => {
      const realFetch = window.fetch;
      window.__deletes = 0;
      window.confirm = () => false; // what a browser that blocks dialogs answers
      window.fetch = (url, init = {}) => {
        if ((init.method ?? 'GET') === 'DELETE') window.__deletes += 1;
        return realFetch(url, init);
      };
    })();
    ```
    - Check A, `confirm()` blocked:
      - Open an expense and tap "Delete expense".
      - `window.__deletes === 1`, the app is back on the screen it came from, and it shows "Deleted “x”" with Undo.
      - Tap Undo: the expense is back in the list.
      - Before the fix, the same steps leave the form open with `__deletes === 0`.
    - Check B, two presses in one tick:
      - Open another expense and evaluate
        `const b = [...document.querySelectorAll('[role="button"]')].find((e) => e.textContent === 'Delete expense'); b.click(); b.click();`.
      - Then `window.__deletes === 1`, with one "Deleted" bar and no error text.
      - This works because RN-web 0.21.3's `PressResponder.onClick` calls `onPress` for a programmatic click
        (`node_modules/react-native-web/dist/modules/usePressEvents/PressResponder.js:302`).
      - Undo it afterwards to clean up.
    - Check C, normal browser: reload without the snippet, delete an expense, and Undo. No dialog appears.
    - `rg -n "confirm\(|Alert\." apps/mobile/src/app/expense.tsx` finds nothing.
    - Gates: `yarn format:check && yarn lint && yarn typecheck && yarn test`.
- [x] 2. Drop the removed `confirmDelete` from the conventions' `Platform.OS` example
  - Files: `.claude/skills/kopiyka-conventions/SKILL.md` (§5, line 148)
  - Change: change "(`confirmDelete`, `client.ts`)" to "(`client.ts`, `PhoneColumn`)". `PhoneColumn.tsx` is an existing
    web-only edge (`if (Platform.OS !== 'web') return children`). One line. Slice 1 makes the old fact stale, so this
    is that update, in its own commit as `kopiyka-plan` asks.
  - Verify: `rg -n confirmDelete .claude apps` finds nothing; `yarn format:check`.

## AC → evidence

| AC                                                                    | Evidence                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Web 390×844 incl. blocked `confirm()`: one DELETE, back, Deleted+Undo | Slice 1 checks A and C                                                    |
| Web: two quick taps → one DELETE                                      | Slice 1 check B (`__deletes === 1` after two clicks in one tick)          |
| No `window.confirm` / `Alert.alert` in the expense form               | Slice 1 `rg` check; lint also catches an unused `Alert` import            |
| iPhone (Expo Go), checked by the user: deletes at once, Undo works    | User check on iPhone after slice 1, recorded in the PR test plan          |
| Gates green                                                           | `yarn format:check && yarn lint && yarn typecheck && yarn test` per slice |

## Not doing (YAGNI)

- Any change to Undo, the delete/restore API, or category removal (out of scope in the brief).
- An `inFlight` guard on Save, and stopping Save and Delete from running at the same time. `busy` already disables both
  buttons after the next render, and no AC asks for more.
- A spinner or dimmed style on the Delete button while it's busy.
- Rewording the audit doc (`docs/audits/2026-10-architecture.md`) or old plans that mention `confirmDelete`. They
  record history and aren't rules.

## Risks

- A programmatic `.click()` might not reach `onPress`, so check B would prove nothing. That's ruled out by reading
  RN-web 0.21.3's `PressResponder.onClick` (it calls `onPress` when not disabled and `altKey` is false). Slice 1 confirms
  it by running check B before the fix: it should show `__deletes === 2` once `window.confirm` returns `true`.
- An accidental tap now deletes without asking. The user accepted this (brief, Notes). Undo covers it for 10 s, and in
  an ended month the delete is refused (`month_ended`) anyway.

## Open questions

- None blocking. One assumption: "a browser that blocks `confirm()`" is checked by stubbing `window.confirm = () =>
false`, which is what such browsers return, plus a plain run in a normal browser. It isn't checked in the Claude
  desktop app's pane specifically. If the user wants that pane too, it's the same steps there.

## Follow-ups

- None found.

## Deviations

## Consolidate

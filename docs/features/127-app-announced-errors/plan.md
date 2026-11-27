# Plan: Announced errors in one hook and one line component

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/app-announced-errors
Base: origin/main (after R10 #198)

## Approach

Roadmap row R11. A new `src/announcedError.ts` holds `useAnnouncedError()`: the `string | null` error state plus a
`showError` that sets it and then announces the same text, and a `clearError` that sets `null`. That is what all 12
same-shaped pairs do today, in that order. A new `components/ErrorLine.tsx` draws the danger label the 14 same-shaped
alert blocks copy. Callers keep their own names by destructuring (`{ error: failure, showError: fail, clearError }`),
so props (`ConfirmPanel failure`, `PendingInvites failure`), `gone`, `busy` and success paths don't change. Slices: the
hook with CategoryForm, then the callers area by area; then ErrorLine with CategoryForm, then the rest.

Alternative considered: put the hook in `data/` as the brief suggests. It lost: `data/` holds data hooks (§2) and this
one renders nothing and loads nothing. The repo's UI hook used by screens, `usePushOnce`, is a root module
(`src/pushOnce.ts`).

## Contracts

- DB, API, routes: none.
- `apps/mobile/src/announcedError.ts` (new):
  `export function useAnnouncedError(): { error: string | null; showError: (text: string) => void; clearError: () => void }`.
  `showError` = `setError(text)` then `AccessibilityInfo.announceForAccessibility(text)` (comment: the alert role covers
  web, VoiceOver needs the announcement). Both functions are `useCallback(..., [])`, so they stay stable.
- `apps/mobile/src/components/ErrorLine.tsx` (new): `export function ErrorLine({ text }: { text: string | null })` renders
  `<Text accessibilityRole="alert" variant="label" color="danger">{text}</Text>`, or `null` when `text` is empty or null (`text ? … : null`, the same truthiness test every block uses today). There's
  no style prop: none of the 14 blocks has a style. Their spacing comes from the parent's `gap`, and a component
  returning `null` adds no child, so the layout is the same as `cond ? <Text/> : null`.
- Reuses: `Text` (`components/Text.tsx`), `AccessibilityInfo`. New dependencies: none.

**Classification of the 22 `announceForAccessibility` calls.** 11 move to `showError`: `CategoryForm:64`,
`actual-end:96`, `income-item:156`, `delete-category:113`, `expense:181`, `members:65` (label), `:166` (remove),
`:258` (revoke), `:328` (invite), `:407` (leave), `settings:43`. (`invites.tsx:68` stays: the roadmap leaves `data/invites.tsx` alone.) Each sets the text, then announces
it, and clears with `null` (settings' `boolean` becomes the `SWITCH_FAILED` text or `null`, and renders the same). 11
stay, on purpose (the 10 below and `invites.tsx:68`):

- `members:87` ('Label saved.') and `members:318` (`Invited …`): success announcements with no state.
- `expense:169`: an effect on the derived `categoryAlert`.
- `expense:203` and `expense:212`: on Save, re-announce a line that is already shown. There's no state to set.
- `expense:229`: the success note `added`. It has its own state and a `summary` box, and it isn't an error.
- `undo.ts:48` and `undo.ts:72`: the Undo bar's tagged `UndoOffer` state.
- `NameCombobox:70`: the suggestion count.
- `LoadError:13`: R16 owns it.

**Classification of the 15 `accessibilityRole="alert"` blocks.** 14 become `<ErrorLine>`: `CategoryForm:194`,
`actual-end:166`, `income-item:239`, `delete-category:127`, `expense:298` (noBudget, stays the first branch of its
ternary), `expense:311`, `expense:357`, `members:117`, `:293`, `:356`, `:459`, `PendingInvites:62`, `settings:90`,
`login:89`. All are `variant="label" color="danger"` with no style. `LoadError:17` stays (`labelRegular`, `muted`,
R16).

## Version

Bump: patch — 1.26.12 → 1.26.13
Why: §8b "a refactor that touches shipped code is `patch`". R10 takes 1.26.12.

## Slices

Every slice: gates green, with tests unchanged (api 549 + 2 skipped, mcp 329, mobile 531). It also runs
`.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` and drops `AccessibilityInfo` or
`Text` imports that become unused.

- [x] 0. Bump version to 1.26.13
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.13
- [x] 1. Add useAnnouncedError and use it in the category form
  - Files: apps/mobile/src/announcedError.ts (new), src/components/CategoryForm.tsx, apps/mobile/demo-modules.txt
  - Change: hook as in Contracts. In CategoryForm, the local `showError` goes, and the four `setError(null)` become
    `clearError()`. `yarn mobile export:web && yarn mobile check-builds --accept`: the only new line is
    `src/announcedError.ts` (CategoryForm is in the demo).
  - Verify: web check A (CategoryForm rows)
- [x] 2. Use useAnnouncedError in the end, income, remove and expense screens
  - Files: src/app/actual-end.tsx, income-item.tsx, delete-category.tsx, expense.tsx
  - Change: the local `showError` (or delete-category's inline pair) goes. `setGone` stays before `showError`, as now.
    Expense's announce-only calls stay. `check-builds` passes with no list change.
  - Verify: web check A (those rows)
- [x] 3. Use useAnnouncedError in the members screen
  - Files: src/app/members.tsx
  - Change: five components take `{ error: failure, showError: fail, clearError }`. LabelForm's `fail` goes, and the
    other four `setFailure+announce` pairs become `fail(message)`. `setGone`, PendingList's `if (gone) onChange()`
    after it, and `showPanel` stay in place.
  - Verify: web check B (members rows)
- [x] 4. Use useAnnouncedError for the ledger switch
  - Files: src/app/(tabs)/settings.tsx
  - Change: settings swaps `switchFailed` for the hook and calls `showError(SWITCH_FAILED)`. The render becomes
    `{switchError ? <Text …>{switchError}</Text> : null}`.
  - Verify: web check B (settings row)
- [x] 5. Add ErrorLine and use it in the category form
  - Files: src/components/ErrorLine.tsx (new), src/components/CategoryForm.tsx, apps/mobile/demo-modules.txt
  - Change: component as in Contracts, and `<ErrorLine text={error} />`. `check-builds --accept` adds only
    `src/components/ErrorLine.tsx`.
  - Verify: web check A (CategoryForm rows)
- [x] 6. Use ErrorLine in the end, income, remove and expense screens
  - Files: actual-end.tsx, income-item.tsx, delete-category.tsx, expense.tsx (×3)
  - Verify: web check A
- [x] 7. Use ErrorLine in members, invites, settings and sign-in
  - Files: src/app/members.tsx (×4), src/components/PendingInvites.tsx, src/app/(tabs)/settings.tsx, src/app/login.tsx
  - Verify: web check B
- [x] 8. Mark R11 in review in the backlog
  - Files: docs/features/BACKLOG.md (roadmap row R11: brief 127, `in review`)

**Web check.** Run it at 390×844, light and dark, at http://127.0.0.1:8084 (web from a sibling worktree) with the API on 3000. Compare each error's text and place with screenshots of the same rows taken on the base before slice 1. "API down" means stop the API after the screen loads.

- A, budget forms:
  - Category add/edit: empty name; amount `abc`; a name already in the month (refused); API down → "Couldn’t save".
  - Actual end: `abc`; API down for Save, then for "Use calculated end".
  - Income item: empty title; amount `0`; API down for Save and for Delete.
  - Remove category: API down. Gone: remove it in a second tab first, so the button hides.
  - Expense: Save with an empty name; API down for Save and for Delete. noBudget: pick a date in a month with no
    budget. notInMonth: open from a category, then pick a date in a month without it.
- B, account screens:
  - Members: a 41-character label; API down for the label Save; invite `nosuchuser` (refused); API down for Invite;
    with an invite pending, API down for Revoke.
  - If the QA user owns a ledger with a member: API down for Remove. If it's a member: API down for Leave.
  - Settings: with two ledgers, API down for a switch.
  - Home/Settings invites: with an invite from a second user, API down for Accept.
  - Sign-in: a wrong code.
  - Rows needing a second account the QA setup lacks: say so in the PR, and leave them to the code diff.
- For the user, on iPhone: VoiceOver reads each error once when it appears.

## AC → evidence

| AC                                    | Evidence                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Hook exists, listed pairs use it      | slices 1–4; `rg announceForAccessibility src` shows only the 10 kept calls; web checks A, B |
| ErrorLine exists, same blocks use it  | slices 5–7; `rg 'accessibilityRole="alert"' src` shows only ErrorLine and LoadError         |
| busy / success / gone untouched       | diff touches only error-state lines; gone checks (remove category, removed-member panel)    |
| Web check light/dark + VoiceOver note | web checks A, B recorded in the PR test plan; iPhone note to the user                       |
| demo-modules only intended lines      | slices 1 and 5 `check-builds --accept`, diff = `announcedError.ts`, `ErrorLine.tsx`         |
| find-short-names clean                | run in every slice                                                                          |
| Existing tests pass unmodified        | `yarn test` counts unchanged every slice                                                    |
| Version one patch                     | slice 0                                                                                     |

## Not doing (YAGNI)

- Announcing login's error, or anything else that isn't announced today. No style prop on ErrorLine. No busy/action
  hook. No change to LoadError, budget's or income's copy note (shown and announced by LoadError, R16), Undo, or
  expense's `added` note.

## Risks

- The React Compiler/hooks lint flags the invites deps or the hook's `useCallback`. Slice 4's `yarn lint` proves it
  either way. `usePushOnce` returns a `useCallback` the same way.
- A wrapper returning `null` changes the spacing under `gap`. Slice 5's web check compares the base with the branch.

## Open questions

- no — The brief names "inline pairs in budget/income". Neither has a set-and-announce pair: their copy failure is a
  tagged month shown through `LoadError`. Assumption: left to R16.
- no — `members.tsx` has five pairs, not four (Leave too). Assumption: all five move.
- Decided before build: the roadmap (lines 57-58) leaves `data/invites.tsx` alone, so its announce pair stays;
  `PendingInvites`' alert block still becomes an `ErrorLine` (slice 7), since that component isn't the provider.

## Follow-ups

- Sign-in's error has the alert role but no VoiceOver announcement, unlike every other form. It could be an a11y gap.
  It's not fixed here.

## Deviations

- `data/invites.tsx` keeps its own announce pair (roadmap: left alone); `PendingInvites`' block still uses `ErrorLine`.
- Web proof: each error's text, position, size, colour and font recorded on the base before slice 1 and compared after
  each slice (category amount and taken name, actual End, income title, expense form, members invite; light and dark
  for three of them): all identical. Sign-in's error was checked after the change only (no base record); the ledger
  switch error needs two ledgers and the API down, so it's covered by the identical shape, not a run.
- The three "role=alert covers web" comments in members went with their pairs: the hook's JSDoc says it once.

## Consolidate

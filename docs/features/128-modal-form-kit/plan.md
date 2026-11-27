# Plan: One modal-form screen frame

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/modal-form-kit
Base: origin/main (after R11 #199)

## Approach

Roadmap row R12. The three screens build the same frame by hand today:

- `<SafeAreaView style={screen} edges={['top', 'bottom']}>`, with `screen` =
  `{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm }` in all three.
- The first child is `<Stack.Screen options={{ gestureEnabled: !busy }} />` with its "can't be swiped away" comment.
- Then `<ScreenHeader back={{ label: 'Back', onPress, disabled: busy }} title={string} />`, with no `trailing`.
- Then the body, with no KeyboardAvoidingView or other wrapper.
- Back targets: income `leave(month)`, end and category `closeToBudget(month)`. Titles: income
  `editing ? 'Edit income' : 'Add income'`, end `'Actual end'`, category `editing ? 'Edit category' : 'Add a category'`.

The bad-link body differs. Income (`!month || (editing && !incomeId)`) and end (`!month`) wrap it as
`<View style={body}><LoadError message="That link isn’t valid." /></View>`, with
`body = { gap: space.lg, paddingTop: space.lg, paddingBottom: space.huge }`. Category's add branch (`!month`) renders
a bare `<LoadError>`. That matches the bare states `CategoryInMonth` shows on the same screen, its own bad link
included. Moving category's line into the kit's wrapped body would push it down by `space.lg` (16px), a visible change.
Adding a prop just for it would serve one caller. So category keeps its bare `LoadError` as a child, and its frame
still comes from the kit.

`components/ModalFormScreen.tsx` renders the frame. Its `children` is the body, or `null` for a bad link, in which case
it renders the wrapped line. Each screen keeps its ternary as it is, and TypeScript still narrows `month` inside it.
`Saving` lives in the same file, next to the `busy` lock it describes. It isn't in `data/`: that folder holds data
hooks and handoffs (§2), and this is a props type. The precedent for a screen frame in `components/` is
`PlaceholderPage`. `Stack.Screen` works from a nested component: expo-router's `Screen` calls `useNavigation()`
and then `setOptions` (`node_modules/expo-router/build/layouts/stack-utils/StackScreen.js (which renders views/Screen)`).

Alternative considered: an `isLinkValid: boolean` prop next to the children. It lost because callers would repeat the
condition inside the children (`month ? <X month={month}/> : null`) to narrow `month`.

## Contracts

- DB, API, routes: none.
- `apps/mobile/src/components/ModalFormScreen.tsx` (new):
  - `export interface Saving { busy: boolean; setBusy: (busy: boolean) => void }`: a modal form's save lock, set
    while a save is in flight (added in slice 3).
  - `export function ModalFormScreen({ title, onBack, busy, children }: { title: string; onBack: () => void; busy: boolean; children: ReactElement | null })`.
  - It renders, in order: `SafeAreaView` (style `screen` as above, `edges={['top', 'bottom']}`) >
    `Stack.Screen options={{ gestureEnabled: !busy }}` (its comment moves with it) >
    `ScreenHeader back={{ label: 'Back', onPress: onBack, disabled: busy }} title={title}` >
    `children ?? <View style={styles.body}><LoadError message="That link isn’t valid." /></View>`.
  - Styles come from `makeStyles(colors)` through `useThemedStyles`: `screen` and `body`, with the values above.
- Reuses: `ScreenHeader`, `LoadError`, `useThemedStyles`, `space` (all already in the demo). New dependencies: none.

## Version

Bump: patch — 1.26.13 → 1.26.14
Why: §8b says a refactor that touches shipped code is `patch`. R11 takes 1.26.13.

## Slices

Every slice ends with the gates green and the test counts unchanged (api 549 passed + 2 skipped, mcp 329, mobile 531).
Every slice also runs `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` and drops
the imports and style keys it leaves unused.

- [ ] 0. Bump version to 1.26.14
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.14
- [ ] 1. Add ModalFormScreen and use it for the actual end (~55 lines)
  - Files: apps/mobile/src/components/ModalFormScreen.tsx (new), src/app/actual-end.tsx, apps/mobile/demo-modules.txt
  - Change: write the kit as in Contracts. `ActualEndScreen` returns
    `<ModalFormScreen title="Actual end" onBack={() => closeToBudget(month)} busy={busy}>{month ? <BalanceLoader …/> : null}</ModalFormScreen>`.
    The `SafeAreaView`, `Stack` and `ScreenHeader` imports go, and so does the screen's `styles` read. The `screen`
    key goes too, while `body`, `group` and `input` stay. Then run
    `yarn mobile export:web && yarn mobile check-builds --accept`. The only list change should be
    `+src/components/ModalFormScreen.tsx`, because `demo-app/actual-end.tsx` re-exports the screen.
  - Verify: web check, actual-end rows
- [ ] 2. Use ModalFormScreen in the income and category forms (~45 lines, mechanical)
  - Files: src/app/income-item.tsx, src/app/category-form.tsx
  - Change: in income, wrap in `<ModalFormScreen title={editing ? …} onBack={() => leave(month)} busy={busy}>` and
    swap the bad-link branch for `null`. `LoadError` stays imported for `EditLoader`. In category, wrap in
    `onBack={() => closeToBudget(month)}` and leave the ternary as it is (bare `LoadError`, see Approach). Its
    `makeStyles`, `StyleSheet`, `useThemedStyles`, `Palette` and `space` imports go. `check-builds` passes with no
    list change.
  - Verify: web check, income and category rows
- [ ] 3. Share one Saving type across the three modal forms (~15 lines)
  - Files: src/components/ModalFormScreen.tsx, src/app/income-item.tsx, src/app/actual-end.tsx,
    src/app/category-form.tsx
  - Change: export `Saving` from the kit and delete the two local `interface Saving` copies. Category's `EditCategory`
    swaps its inline `busy`/`setBusy` fields for `& Saving`. Type-only, so the gates are the proof.
- [ ] 4. Mark R12 in review in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: roadmap row R12 gets brief `128` and state `in review`. The "One modal-form kit" line under "Named in
    earlier briefs" becomes: briefed as 128 (roadmap R12), in review.

**Web check.** Run it at 390×844, light and dark, at exactly http://127.0.0.1:8084, with Expo web from this sibling
worktree and the API on 3000, signed in as the QA user. Before slice 1, take screenshots of every row on the base.
After each slice, compare the branch with them: header row, title text, Back position, background, and where the
first body line starts.

- Actual end: a valid link (`/actual-end?month=<current month>`); bad links `/actual-end` and `?month=2026-13`.
- Income: add (`/income-item?month=<current>`) and edit (`&incomeId=<an existing id>`); bad links
  `?month=bad`, `?month=<current>&incomeId=abc` and `&incomeId=` (empty).
- Category: add (`/category-form?month=<current>`) and edit (`&categoryId=<id>`). Bad links: `/category-form` (the
  bare line, which must sit where it did) and `?month=<current>&categoryId=x` (the `CategoryInMonth` line).
- Back while saving, on each form:
  - Pause the API with `kill -STOP $(lsof -tiTCP:3000 -sTCP:LISTEN)`, so the save hangs, and press Save.
  - Back should show disabled, and pressing it should do nothing.
  - Resume with `kill -CONT <pid>`. The save should finish and the modal should close.
  - Stopping the API outright makes the save fail at once, so Back is never seen disabled.
- For the user, on iPhone: while a save hangs, the modal can't be swiped down; once it ends, it can. The swipe has
  no web equivalent.

## AC → evidence

| AC                                                     | Evidence                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Kit exists; three screens use it                       | slices 1–2; `rg -n "SafeAreaView\|Stack.Screen" src/app/{income-item,actual-end,category-form}.tsx` is empty |
| One `Saving` type replaces the copies                  | slice 3; `rg -n "interface Saving" apps/mobile/src` shows only the kit                                       |
| Title, Back, busy lock, swipe lock, bad-link body same | web check against the base screenshots; Back-while-saving rows; iPhone note                                  |
| Web check light/dark, valid/invalid, Back while saving | web check, recorded in the PR test plan                                                                      |
| demo-modules only the new module                       | slice 1 `check-builds --accept`, a one-line diff; slices 2–3 `check-builds` pass                             |
| find-short-names clean                                 | run in every slice                                                                                           |
| Existing tests pass unmodified                         | `yarn test` counts unchanged in every slice; no test file touched                                            |
| Version one patch                                      | slice 0                                                                                                      |

## Not doing (YAGNI)

- No `trailing`, keyboard-avoiding, style or message props. No `run`/busy hook: each screen keeps its `run` and error
  mapping. `components/CategoryForm.tsx` is untouched (out of scope), so its inline `busy`/`setBusy` props stay.
- No change to category's bare `LoadError` placement.

## Risks

- `Stack.Screen` inside a component might not set the route's options. That's disproved by expo-router's source
  (`useNavigation` + `setOptions`). Slice 1's Back-while-saving row and the iPhone swipe check confirm it.
- `children ?? …` is wrong if a caller passes `false` or `undefined`. The `ReactElement | null` type rules both out,
  and slice 1's typecheck proves it.

## Open questions

- no — Category's bad link stays a bare child, not the kit's wrapped body (see Approach). Assumption: pixel-identical
  wins over one shared path.
- no — `Saving` goes in `components/ModalFormScreen.tsx`, not `data/` (see Approach).

## Follow-ups

- Category's bad-link and loading lines sit `space.lg` higher than income's and end's. Unifying them would change how
  the screen looks, so it needs its own brief.
- `components/CategoryForm.tsx` could take `& Saving` for its `busy`/`setBusy` props: a small follow-up, outside R12.

## Deviations

## Consolidate

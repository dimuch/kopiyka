# Plan: One load state for the data screens

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/load-state
Base: origin/main (after R15 #203; includes R14 #202)

## Approach

Roadmap row R16. A new `components/LoadState.tsx` renders the triad that the screens write by hand: `data === null` →
`error ? <LoadError message={loadMessage} onRetry={onRetry} /> : <ActivityIndicator color={colors.accent}
style={spinnerStyle} />`, else `<>{error && <LoadError message="Couldn’t refresh. Check your connection and try
again." onRetry={onRetry} />}{children(data)}</>`. Five screens use it: Budget, Expenses, Income, Statistics and
Members. On those five today the spinner colour is always `colors.accent`, the refresh text is the same, and `error` is
the `boolean` from `useFocusLoad`. Both branches are fragments, so the host tree stays the same: a component that
returns a fragment adds no node. The element types at the slot also stay the same, so React remounts exactly as before.
`spinnerStyle` stays a prop. Five screens pass `styles.loading` (a `StyleSheet.create` style, which RNW 0.21 compiles
into atomic classes). Members passes an inline `{ marginTop: space.xxl }`, which renders as a `style` attribute.
`CategoryInMonth`'s `children(category, month)` render prop is the precedent.
**Left out: the category screen.** Its refresh line is the first child _inside_ its `Animated.ScrollView`. On a
loaded month without the category it renders `NotInMonth` with no refresh line at all. LoadState would put the line
above the scroll view and above `NotInMonth`, so it would need a one-off prop to fit. **Also left out: Budget's second
refresh line** (budget:163-168). It belongs to `income` (another `useIncome` state). It has no spinner (`null` while
loading) and comes _after_ `IncomeFigures`.
Alternative considered: LoadState owns the spinner style, and the five `loading` styles are deleted. That is smaller,
but Members' spinner would change from an inline style to a class, so its DOM would change. Rejected.

## Contracts

- DB, API, DTOs, hooks, routes: none.
- `export function LoadState<T>({ data, error, onRetry, loadMessage, spinnerStyle, children }: { data: T | null;
error: boolean; onRetry: () => void; loadMessage: string; spinnerStyle: StyleProp<ViewStyle>; children: (data: T) =>
ReactNode })`. It has a one-line JSDoc. It reads `useColors()` itself.
- What each screen passes (data / loadMessage / spinnerStyle; `onRetry={reload}` everywhere):
  - budget:128-197: `data` / "Couldn’t load this month. …" / `styles.loading`. Children `({ categories })`.
  - expenses:110-194: `rows` (it tests `rows`, not `data`; `rows` is null iff `data` is, since `useCategoryOrder`
    returns `categories` or `moved.order` only when `moved.from === categories`) / the same text as Budget /
    `styles.loading`. Children `(loadedRows)`.
  - income:82-164: `items` / "Couldn’t load this month’s income. …" / `styles.loading`. Children `(loadedItems)`.
  - statistics:66-86: `summary` / "Couldn’t load these figures. …" / `styles.loading`. Children `(loadedSummary)`.
  - members:163-210 (`OwnerMembers`, early `return`): `data` / "Couldn’t load the members. …" /
    `{ marginTop: space.xxl }`. Children `({ members, invites })`.
- Texts are copied byte for byte, curly `’` included. Imports that become unused go: `ActivityIndicator` from all
  five; `useColors` + `const colors` in expenses and income; `const colors` in `Statistics()` and `OwnerMembers()`;
  `LoadError` from statistics. `styles.loading` stays in all four that have it.
- Reuses: `LoadError`, `useColors`, the `CategoryInMonth` render-prop pattern. New dependencies: none.

## Version

Bump: patch — 1.26.17 → 1.26.18
Why: conventions §8b, "a refactor that touches shipped code is `patch`". The base (R15's branch) is 1.26.17. If `main`
has moved on when this rebases, bump once more (§8b step 4).

## Slices

Every slice ends with:

- gates green, test counts unchanged (api 549 + 2 skipped, mcp 329, mobile 547);
- `find-short-names.sh --diff origin/main` clean;
- `yarn mobile export:web && yarn mobile check-builds` passing;
- the web record for its screens identical to the base.

There are no characterization tests: the change is UI only, and there's no logic to pin (brief, Notes).

- [x] 0. Bump version to 1.26.18
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.18
- [x] 1. Draw Income's loading and refresh states with a shared LoadState
  - Files: apps/mobile/src/components/LoadState.tsx (new), apps/mobile/src/app/(tabs)/income.tsx,
    apps/mobile/demo-modules.txt
  - Change: the component, and Income uses it. Income is in the demo (`demo-app/(tabs)/income.tsx`), so
    `check-builds --accept` adds exactly one line, `src/components/LoadState.tsx`. The commit body says why. ~65 lines.
  - Verify: web record, Income (4 states)
- [x] 2. Use LoadState on Budget and Expenses
  - Files: apps/mobile/src/app/(tabs)/budget.tsx, apps/mobile/src/app/(tabs)/expenses.tsx
  - Change: as in Contracts. Inside the children, `data.categories` becomes `categories`, and `rows` becomes
    `loadedRows`. The bodies keep their indentation. ~60 lines. `demo-modules.txt` unchanged.
  - Verify: web record, Budget and Expenses (4 states each)
- [x] 3. Use LoadState on Statistics and Members
  - Files: apps/mobile/src/app/(tabs)/statistics.tsx, apps/mobile/src/app/members.tsx
  - Change: as in Contracts. Members' fragment moves into the children, 4 columns deeper. Check it with
    `git show --color-moved=zebra --color-moved-ws=allow-indentation-change`. ~70 lines.
  - Verify: web record, Statistics and Members (4 states each)
- [x] 4. Mark R16 in review in the backlog
  - Files: docs/features/BACKLOG.md. The roadmap row R16 becomes `| R16 | load-state | 132 | in review |`, and only
    that row changes. On a rebase conflict, keep `main`'s other rows.

**Web check.**

- Setup:
  - Web runs from this worktree at exactly http://127.0.0.1:8084, with this worktree's own API on 3000. Check first
    with `lsof -nP -iTCP:3000 -sTCP:LISTEN` and `lsof -a -p <pid> -d cwd`; if another checkout holds the port, ask.
  - Window 390×844. QA user `claude-qa-132`, the ledger owner, with November 2026 income, three categories and
    expenses. A second user, `claude-qa-132b`, is only there to be invited. Delete both at the end.
- Record on the base (after slice 0, before slice 1), then again after each slice for the screens it touches, and
  diff. The two must be identical. Run in the console:
  `(() => { const out = []; const walk = (parent, depth) => { for (const node of parent.children) { const box = node.getBoundingClientRect(); const text = [...node.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent.trim()).join(' '); out.push(`${' '.repeat(depth)}${node.tagName} ${node.getAttribute('role') ?? ''} [${node.getAttribute('aria-label') ?? ''}] .${node.getAttribute('class') ?? ''} {${node.getAttribute('style') ?? ''}} ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} ${text}`); walk(node, depth + 1); } }; walk(document.getElementById('root'), 0); return out.join('\n'); })()`
- States, on each of the five screens:
  - Loaded: light and dark.
  - First-load error (light): stop the API, then open the screen fresh. For a tab, that's one not opened yet or a
    month/period not loaded yet; for Members, open it from Settings.
  - Refresh error (dark): load the data, stop the API, then refocus (another tab and back). Members has no refocus. In
    its case, override `window.fetch` in the console so GETs ending `/members` reject, invite `claude-qa-132b` (a
    success calls `reload`), then revoke the invite after recording.
  - Spinner (light): `kill -STOP <api pid>` while the screen loads, record, then `kill -CONT`.
- The category screen isn't touched, so it isn't recorded.

## AC → evidence

| AC                                                                  | Evidence                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `LoadState.tsx` exists; the screens use it                          | slices 1–3; five screens, category left out (Open questions)               |
| Spinner, first-load text and refresh line unchanged, and around it  | web record (classes, inline styles, text, positions) identical to base     |
| Web check 390×844, light and dark, three states, five screens       | web check above (five screens plus the spinner state); PR test plan        |
| `demo-modules.txt` only gains the new module; `check-builds` passes | slice 1 adds `src/components/LoadState.tsx`; slices 2–3 leave it unchanged |
| `find-short-names.sh --diff origin/main` clean                      | every slice                                                                |
| Existing tests pass unmodified                                      | `yarn test` counts unchanged; no test file touched                         |
| Version one patch, both files                                       | slice 0                                                                    |

## Not doing (YAGNI)

- No spinner-colour prop, no refresh-message prop, no `spinnerMargin` number (that would make five spinners inline).
- No change to Budget's income triad, the category screen, `LoadError`, `CategoryInMonth`, texts or styles. The
  figure rows are R17.

## Risks

- A generic `function LoadState<T>` with a render prop trips a React Compiler lint rule. Slice 1's `yarn lint` shows
  it. `CategoryInMonth` already passes lint with the same pattern.
- A screen's record differs because of where the `LoadError` hook sits (its `useEffect` announcement). The slice's
  record shows it. The element types at each slot are unchanged, so it shouldn't.
- Port 3000 or 8084 is held by another session. Caught by the `lsof` check.

## Open questions

- none — the revised brief's AC1 leaves the category screen out and AC3 names five screens.

## Follow-ups

- Budget's income triad (no spinner, refresh line after the figures) and the category screen could share a second
  shape if a third copy ever appears.

## Deviations

- Each render callback's parameter keeps the screen's own name (`items`, `data`, `rows`, `summary`), shadowing the
  nullable one, so the children moved without a single edit.
- Web proof: page tree with inline styles recorded on the base and compared on the branch for the loaded state (Budget
  also in dark), the spinner and the first-load error on all five (reached by tab navigation with `fetch` held or
  failed in the page, the same path both runs), and Members' refresh error: identical. The spinner's SVG circles were
  left out of the comparison because their box changes with the rotation; the spinner's colour matched.

- Members' refresh error: no second QA user. A console `fetch` override makes a POST to `/invites` answer 201 without
  writing anything and the `/members` GET that follows fail, so the refresh line shows (skeptic suggestion). Each
  screen is recorded after a fresh page load so no other tab stays mounted.

## Consolidate

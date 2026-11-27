# Plan: One three-figure row for Budget and Expenses

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/figure-row
Base: origin/main (after R16 #204)
until then.

## Approach

Roadmap row R17. A new `components/FigureRow.tsx` draws the three label-over-amount columns that Budget's
`IncomeFigures` (budget.tsx:283-307) and the Expenses summary card (expenses.tsx:82-99) each map by hand. It returns a
fragment of three `View`s, so it adds no host node. Each screen keeps its own container and that container's `figures`
row style, its `accessible` + `accessibilityLabel`, its labels and its values. On Budget that container is the `Card`
itself; on Expenses it is an inner `View` inside the `Animated.View` card. FigureRow owns `figure`, `figureCentre` and
`figureEnd`, and both screens delete theirs (no other use: `rg -n "figureCentre|figureEnd|styles\.figure\b" apps/mobile/src`).

**How the two differ, and the one difference FigureRow absorbs.** Same keys (`figure.label`), same per-index styles,
same `caption`/`muted` label and `amount` value. Budget's values are always strings and its colour is
`over ? 'danger' : 'text'`. Expenses' values are `undefined` until the month loads, shown as `'—'`, and its colour is
`over ? 'danger' : figures ? 'text' : 'muted'`. FigureRow takes `value: string | undefined` and colours
`over ? 'danger' : value === undefined ? 'muted' : 'text'`, rendering `value ?? '—'`. This is the same output on both
screens. On Expenses, `figures` is null exactly when all three values are `undefined`, and `spendingFigures` returns
strings for all three when it isn't null; its `'Not set'` and `'—'` strings stay in `text`. On Budget, `value` is never
`undefined`.
Alternative considered: a `pending` boolean prop (`pending={!figures}`). That is a one-off flag only Expenses would
pass, and it would split "no value yet" from the value it describes. Rejected.

## Contracts

- DB, API, DTOs, hooks, routes: none.
- FigureRow (JSDoc: "Three labelled figures across a row: the first at the start, the middle centred, the last at the
  end. A value still loading shows as a muted '—'."). The tuple type gives a compile error for anything other than
  three figures (conventions §1). Expenses' "—" comment moves here, next to `?? '—'`:

  ```tsx
  type Figure = { label: string; value: string | undefined; over?: boolean };

  export function FigureRow({ figures }: { figures: [Figure, Figure, Figure] }) {
    return (
      <>
        {figures.map((figure, index) => (
          <View
            key={figure.label}
            style={[styles.figure, index === 1 && styles.figureCentre, index === 2 && styles.figureEnd]}
          >
            <Text variant="caption" color="muted">
              {figure.label}
            </Text>
            {/* "—" in the value's own size until it loads, so the card keeps its height. */}
            <Text variant="amount" color={figure.over ? 'danger' : figure.value === undefined ? 'muted' : 'text'}>
              {figure.value ?? '—'}
            </Text>
          </View>
        ))}
      </>
    );
  }

  const styles = StyleSheet.create({
    figure: { gap: space.xs },
    figureCentre: { alignItems: 'center' },
    figureEnd: { alignItems: 'flex-end' },
  });
  ```

- Styles: a plain module-level `StyleSheet.create`, since there is no colour in them (conventions §5), like
  `Pressable`, `IconButton` and `PhoneColumn`. A `makeStyles` + `useThemedStyles` would only add a hook. RNW compiles
  both to the same atomic classes, and the records check that.
- Callers. The container, its props and its `figures` style stay as they are:
  - Budget, inside its `Card`, replacing the local `figures` const and its map: Income `income`, Budgeted `planned`,
    Remaining `leftText` with `over: left < 0`.
  - Expenses, inside its accessible `View`: Spent `figures?.spent`, Budgeted `figures?.budgeted`, Remaining
    `figures?.remaining` with `over: figures?.over`.
- Reuses: `Text`, `space`; the fragment-returning component pattern of `LoadState` (R16). New dependencies: none.

## Version

Bump: patch — 1.26.18 → 1.26.19
Why: conventions §8b, "a refactor that touches shipped code is `patch`". The Base (R16's branch) is 1.26.18. If `main`
has moved past that by the time this rebases, bump once more (§8b step 4).

## Slices

Every slice ends with:

- gates green, test counts unchanged (api 549 + 2 skipped, mcp 329, mobile 547);
- `find-short-names.sh --diff origin/main` clean;
- `yarn mobile export:web && yarn mobile check-builds` passing;
- the web records for its card identical to the base.

There are no characterization tests: the change is UI only, with no logic to pin (brief, Notes).

- [x] 0. Bump version to 1.26.19
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.19
- [x] 1. Draw Budget's income figures with a shared FigureRow
  - Files: apps/mobile/src/components/FigureRow.tsx (new), apps/mobile/src/app/(tabs)/budget.tsx,
    apps/mobile/demo-modules.txt
  - Change: the component, and `IncomeFigures` uses it. Budget's `figure`/`figureCentre`/`figureEnd` styles are deleted;
    the `figures` row style stays. Budget is in the demo (`demo-app/(tabs)/budget.tsx`), so `check-builds --accept`
    adds exactly one line, `src/components/FigureRow.tsx` (between `ErrorLine.tsx` and `FocusStyles.tsx`). The commit
    body says why. ~45 lines.
  - Verify: web records of Budget (see below)
- [x] 2. Use FigureRow for the Expenses summary card
  - Files: apps/mobile/src/app/(tabs)/expenses.tsx
  - Change: as in Contracts. Its three figure styles are deleted; `figures`, `card` and their comment stay. ~25 lines.
    `demo-modules.txt` unchanged.
  - Verify: web records of Expenses (see below)
- [x] 3. Mark R17 in review in the backlog
  - Files: docs/features/BACKLOG.md. The roadmap row R17 becomes `| R17 | figure-row | 133 | in review |` (padded like
    its neighbours), and only that row changes. On a rebase conflict, keep `main`'s other rows.

**Web check.**

- Setup:
  - Web runs from this worktree at exactly http://127.0.0.1:8084, with this worktree's own API on 3000. Check first with
    `lsof -nP -iTCP:3000 -sTCP:LISTEN` and `lsof -a -p <pid> -d cwd`. If another checkout holds the port, ask.
  - Window 390×844. QA user `claude-qa-133`, set up as R16's was. Its November 2026 data: income €1,000; categories
    planned €1,200 in total; expenses €1,300 in total. That gives Budget a Remaining of −€200 and Expenses one of −€100,
    both in `danger`. December 2026 has no categories. Delete the user at the end.
- Record on the base (after slice 0, before slice 1), then after slice 1 (Budget) and after slice 2 (Expenses), and
  diff. They must be identical. Use R16's console recorder (`docs/features/132-load-state/plan.md`, Web check). It gives
  tag, role, aria-label, class, inline style (the text colour is there), rect and text for every node under `#root`.
- States:
  - Budget, November: light and dark.
  - Expenses, November: light and dark.
  - Expenses, December, light: Budgeted "Not set" and Remaining "—", both in `text`.
  - Expenses, pending, light: hold the month GET (`kill -STOP <api pid>`, or a held `fetch` in the console as in R16).
    All three values are a muted "—", and the card's label is "Spent this month, loading". Then release it.

## AC → evidence

| AC                                                                       | Evidence                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `FigureRow.tsx` exists; both cards use it and don't declare the styles   | slices 1–2; `rg -n "figureCentre\|figureEnd" apps/mobile/src` → FigureRow only |
| The two cards render exactly as before (layout, colours, danger, a11y)   | web records identical (aria-label, classes, inline colour, rects, text)        |
| Layout records identical, light and dark, 390×844                        | web check above, six records; PR test plan                                     |
| `demo-modules.txt` changes only by the new module; `check-builds` passes | slice 1 adds `src/components/FigureRow.tsx`; slice 2 leaves it unchanged       |
| `find-short-names.sh --diff origin/main` clean                           | every slice                                                                    |
| Existing tests pass unmodified                                           | `yarn test` counts unchanged; no test file touched                             |
| Version one patch, both files                                            | slice 0                                                                        |

## Not doing (YAGNI)

- No container in FigureRow: the `figures` row style stays on each screen. It sits on a `Card` on Budget and on an
  inner `View` on Expenses. Owning it would add a node to Budget, or take a host/style prop.
- No `pending` or colour prop, no figure count other than three, no change to the labels, values, accessibility labels
  or `spendingFigures`. Statistics' totals card is out of scope (brief).

## Risks

- The module-level `StyleSheet.create` gives different class names from the screens' `makeStyles` ones. Slice 1's
  Budget record shows it. RNW's atomic classes depend on the values, not on the sheet. If they still differ, switch to a
  `makeStyles` + `useThemedStyles` and record it under Deviations.
- The tuple prop type rejects the inline array literals. Slice 1's `yarn typecheck` shows it. Contextual typing makes a
  literal of three objects fit a three-tuple.
- Port 3000 or 8084 is held by another session. The `lsof` check catches it.

## Open questions

- no — The caller suggested FigureRow's own `makeStyles`. The plan uses a plain `StyleSheet.create` instead, since
  there's no colour in the styles (conventions §5). Assumption: that's acceptable. The fallback is in Risks.

## Follow-ups

- none found.

## Deviations

- Budget can't show a negative Remaining with test data (the API refuses planning above income), so the danger colour
  was checked on Expenses, which uses the same `FigureRow`. Web proof: page trees with inline styles recorded on the
  base and compared after each slice for Budget and Expenses in light and dark, Expenses while loading (muted "—") and
  with a negative Remaining: identical. `?month=2026-12` on Expenses showed the current month, so the no-categories
  state wasn't reached.

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

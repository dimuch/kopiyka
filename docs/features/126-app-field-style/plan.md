# Plan: One filled text-field style

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/app-field-style
Base: origin/main (after R9 #197)
stacked on R9 until then.

## Approach

Roadmap row R10. `components/TextField.tsx` gets two exports next to the component whose focus border needs them:
`fieldStyle(colors)`, the filled look all seven copies share, and `symbolStyle`, the ₴/€ position. Each `makeStyles`
then says `input: fieldStyle(colors)` (or spreads it under its own extras) and `symbol: symbolStyle`, so the styles
still go through `StyleSheet.create` and compile as before. Tokens that become unused leave each file's
`@/theme` import. Slice 1 adds the exports with CategoryForm as their caller, slice 2 moves AmountFields (the one with
its own padding), slice 3 the five screens.

Alternative considered: leave `paddingHorizontal` out of `fieldStyle`, so AmountFields' flattened object keeps exactly
its old keys. It lost: six of seven callers would each add `paddingHorizontal: space.lg` back, a copy the brief is
removing, and the computed padding is the same either way (below).

## Contracts

- DB, API, routes, props: none. `apps/mobile/src/components/TextField.tsx` adds, importing
  `{ type Palette, radius, size, space, text } from '@/theme'`:

  ```ts
  /** The filled field look: its 1pt border in `fill` is the edge TextField's focus colour shows on. Spread it first,
   *  so a caller's own keys win. */
  export function fieldStyle(colors: Palette) {
    return {
      height: size.control,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.fill,
      backgroundColor: colors.fill,
      paddingHorizontal: space.lg,
      color: colors.text,
      ...text.input,
    };
  }

  /** Where the ₴/€ sits over a `fieldStyle` field, inside the left padding its caller adds. */
  export const symbolStyle = { position: 'absolute', left: 14, top: 13, zIndex: 1 } as const;
  ```

  No return type annotation: the inferred literal type fits `StyleSheet.create` for the `TextField`s and for
  CategoryForm's icon `Pressable`, as each inline copy does today. `left`/`top`/`zIndex` aren't style-number keys in
  `eslint.config.js`, so no disable is needed (none exists today). A non-component export from a component file has
  precedent (`pressedOpacity` in `Pressable.tsx`).

- **Same style, per caller.** `text.input` is `{ fontFamily, fontSize: 16, letterSpacing: -0.2 }` (`theme.ts:101`): none
  of its keys overlap the field keys or the extras, so spreading it first (members, login) or last (the rest) gives
  equal values. All seven copies have the same seven field keys and values plus `text.input`; the only extras:

  | Caller (after)                                        | Extras on top of `fieldStyle(colors)`                                                                                                  | Overlap → result                                                                                                 |
  | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
  | `CategoryForm` `input` (name, amount, icon Pressable) | none; amount keeps `[styles.input, styles.amount]` with `amount: { paddingLeft: space.xxxl, fontVariant: ['tabular-nums'] }` unchanged | as today                                                                                                         |
  | `AmountFields` `input`                                | `{ ...fieldStyle(colors), paddingLeft: space.xxxl, fontVariant: ['tabular-nums'] }`; its `paddingRight: space.lg` goes                 | left 32 (own) and right 16 (from `paddingHorizontal`), as before. Its flattened object gains `paddingHorizontal` |
  | `actual-end`, `income-item`, `members`, `login`       | `input: fieldStyle(colors)`; login's `passwordInput` array unchanged                                                                   | none                                                                                                             |
  | `expense`                                             | `input: fieldStyle(colors)`; the local `field` const (one use) goes, so `makeStyles` becomes `=> StyleSheet.create({...})`             | none                                                                                                             |

  Edge padding over `paddingHorizontal` is safe on both platforms: Yoga resolves an edge (left) before horizontal;
  react-native-web 0.21.4 compiles each key to its own class, sorted, with `paddingInline` in precedence group 2.1 and `paddingLeft` in 3
  (`StyleSheet/compiler/index.js`). Checked while planning: RNW's `preprocess` + `createReactDOMStyle` give equal DOM
  styles before and after for CategoryForm name, its amount, AmountFields and members (scratch script).

- Imports after: CategoryForm, actual-end, income-item → `{ type Palette, space }`; AmountFields
  `{ type Palette, size, space }`; members `{ type Palette, radius, size, space }`; login
  `{ fonts, type Palette, size, space }`; expense `{ type Palette, radius, space }`. Each imports `fieldStyle` (and the
  two components `symbolStyle`) from `@/components/TextField`; expense gains that import.
- `apps/mobile/demo-modules.txt`: unchanged. `TextField.tsx`, `theme.ts`, CategoryForm, AmountFields, actual-end,
  expense and income-item are already on it; members and login aren't in the demo; no new module.
- Reuses: `TextField`, `theme.ts` tokens, `StyleSheet.create`/`useThemedStyles` as today.
- New dependencies: none.

## Version

Bump: patch — 1.26.11 → 1.26.12
Why: conventions §8b, "behaviour-preserving refactor" of shipped app code. Base (R9's branch) is 1.26.11
(`git show chore/app-back-fallback:package.json`). If main moves past it, rebase, take main's number, bump once more.

## Slices

Proof for every slice: gates `yarn format:check && yarn lint && yarn typecheck && yarn test` with api 549 passed + 2
skipped, mcp 329, app 531, and `git diff <Base> -- apps/*/test` empty; `yarn mobile export:web && yarn mobile
check-builds` passes with `git diff -- apps/mobile/demo-modules.txt` empty;
`.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` reports no lines.

**Visual check.** Web from this worktree at exactly http://127.0.0.1:8084, API on 3000, QA user, 390×844, light and
dark. Use brief 104's "Snapshot script" (`docs/features/104-shared-components/plan.md`) with the key prefix
`snap:before:126:` / `snap:after:126:` (change `104` to `126` in `__cmpSrc`). It records boxes, background, top border,
radius and padding but not text colour, font or digits, so also install, once per origin:

```js
localStorage.setItem(
  '__fieldSrc',
  `() => [...document.querySelectorAll('input, textarea, [aria-label^="Icon:"]')].map((el) => { const s = getComputedStyle(el); return [el.getAttribute('aria-label'), ...['height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'borderTopColor', 'borderLeftColor', 'borderTopLeftRadius', 'borderBottomRightRadius', 'backgroundColor', 'color', 'fontFamily', 'fontSize', 'letterSpacing', 'lineHeight', 'fontVariantNumeric'].map((p) => s[p])].join('|'); })`,
);
```

Before each record run `document.activeElement?.blur()` and wait 0.5 s (several forms autofocus a field). Before:
`localStorage.setItem('fields:before:126:<view>:<scheme>', JSON.stringify(eval(localStorage.__fieldSrc)()))`. After:
the same call must equal that key, and `__cmpSrc` must give `diffs: 0`, `a11ySame: true`. Then focus one field per view
and see its border turn accent. Views (6 × 2 schemes), taken on Base before slice 1: `login` (signed out, before
signing in), `category-form-add` (`/category-form?month=<this month>`), `actual-end` (`/actual-end?month=<this month>`),
`income-item-add` (`/income-item?month=<this month>`), `expense-new` (`/expense`), `members` (owner: label and invite
fields).

- [x] 0. Bump version to 1.26.12
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.12
- [x] 1. Share the filled field and symbol styles from TextField, starting with the category form
  - Files: apps/mobile/src/components/TextField.tsx, apps/mobile/src/components/CategoryForm.tsx
  - Change: add `fieldStyle` and `symbolStyle` as in Contracts; CategoryForm's `input: fieldStyle(colors)`,
    `symbol: symbolStyle`, `amount` unchanged; drop `radius`, `size`, `text` from its import. ~30 lines.
  - Verify: `category-form-add` light and dark against the before set.
- [x] 2. Use the shared field and symbol styles in the amount fields
  - Files: apps/mobile/src/components/AmountFields.tsx
  - Change: `input` as in Contracts (row AmountFields), `symbol: symbolStyle`; drop `radius`, `text`. ~15 lines.
  - Verify: `expense-new` (both rows), `income-item-add`, light and dark; `fields:` records show paddingLeft 32px,
    paddingRight 16px and `tabular-nums` as before.
- [x] 3. Use the shared field style in the five form screens
  - Files: apps/mobile/src/app/actual-end.tsx, income-item.tsx, members.tsx, login.tsx, expense.tsx
  - Change: `input: fieldStyle(colors)`, imports as in Contracts; expense's `field` const goes and its `makeStyles`
    loses the block body (re-indent, mechanical). ~45 lines.
  - Verify: all views, light and dark.
- [x] 4. Mark R10 in review in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: roadmap row R10: Brief `126`, State `in review`.
  - Verify: `yarn format:check`.

## AC → evidence

| AC                                                       | Evidence                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TextField exports `fieldStyle(colors)` and `symbolStyle` | slice 1 diff; typecheck                                                                                                                                                          |
| Seven files use them, no copy left                       | after slice 3: `rg -n "borderColor: colors.fill" apps/mobile/src` → TextField.tsx and DateField.tsx only (out of scope); `rg -n "left: 14" apps/mobile/src` → TextField.tsx only |
| Computed style unchanged                                 | Contracts table + RNW check; `fields:` records equal before/after for every view and scheme                                                                                      |
| Layout snapshots identical; 390×844 light and dark       | `__cmpSrc` `diffs: 0`, `a11ySame: true` for 6 views × 2 schemes; recorded in the PR's test plan                                                                                  |
| `demo-modules.txt` unchanged; `check-builds` passes      | per-slice proof                                                                                                                                                                  |
| `find-short-names.sh --diff origin/main` clean           | per-slice proof                                                                                                                                                                  |
| Existing tests pass unmodified                           | counts 549+2 / 329 / 531; empty test diff                                                                                                                                        |
| Version bumped one patch                                 | slice 0: both files at 1.26.12                                                                                                                                                   |

## Not doing (YAGNI)

- `DateField`'s field (same border and fill, text on a child `Text`) and other style twins (brief, Out of scope).
- A new `fieldStyles.ts` module or a `StyleSheet` inside TextField (brief: no new module; callers keep compiling).
- Making `TextField` apply the style itself: it would change every caller's props, not just its styles.

## Risks

- The inferred `fieldStyle` type is rejected by `StyleSheet.create` or the icon Pressable — slice 1 typecheck.
- The web build resolves AmountFields' padding differently — disproved by RNW's precedence groups; slice 2's `fields:`
  records confirm paddingLeft 32px / paddingRight 16px.
- R9 or main changes a snapshotted screen before the after set — use 104's step 7 (fresh baseline from main's file).

## Open questions

- no — AmountFields' flattened style gains `paddingHorizontal` and loses its explicit `paddingRight`; the computed
  padding is identical. Read "same keys and values" in AC3 as the computed style. Assumed acceptable; say so at Gate A
  to keep `paddingRight: space.lg` written out instead.

## Follow-ups

## Deviations

- The visual proof is the `__fieldSrc` record only (extended with each field's rounded x, y, width and height), not
  brief 104's full-page `__snapSrc`: every field's position, size and computed style matched before and after in all
  6 views × light and dark. A real click turned the login field's border accent.

## Consolidate

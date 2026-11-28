# Outcome: Descriptive names across the app

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#196](https://github.com/dimuch/kopiyka/pull/196) Descriptive names across the app — v1.26.10

## Decided

- Roadmap row R8. A test-only commit first pinned `categoryTile`, the one renamed function with no tests. Then a pure
  `scrollToShow` in `data/nameSuggestions.ts` replaced `NameCombobox`'s nested ternary.
- Four rename-only commits, one per area (screens, components, data, format/theme/auth), covered the finder's 55 code
  lines; `categoryRemove.ts`'s `c:`, which the finder misses, was renamed too.
- The three lines in `categoryIcons.LICENSE.txt` stayed: licence text can't be renamed.
- `expense.tsx`'s setter label is `next`, not `text`, since the file imports `text` from the theme.

## Left out

- Short names the brief didn't list (`on`, `mon`, `byId`, a `cat` style key, `{ y, height }`).
- Single-letter names in `apps/mobile/test`: the brief covers `src` only.
- Teaching the finder about parameters on a line of their own (an existing backlog item).

## Follow-ups

- `find-short-names.sh` also misses destructured single letters, such as `const { y, height } = …` — in BACKLOG.md
- The app's test files still use single-letter names, such as `format.test.ts`'s `d` — in BACKLOG.md

Full plan: `git show 5e11273b:docs/features/124-app-short-names/plan.md`

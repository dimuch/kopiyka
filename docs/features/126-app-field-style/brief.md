# One filled text-field style

Type: chore

## Why

Roadmap row R10 (`docs/features/refactor-roadmap-2026-11.md`). The filled text-field look (control height, medium
radius, 1pt border in `fill`, `fill` background, text colour and `text.input`) is copied into seven `makeStyles`:
`CategoryForm.tsx:214-223`, `AmountFields.tsx:91-102`, `actual-end.tsx:185`, `income-item.tsx:258`,
`members.tsx:496`, `login.tsx:140` and `expense.tsx:391`. The euro symbol's `left: 14, top: 13` position is copied in
`CategoryForm.tsx:213` and `AmountFields.tsx:90`. `TextField`'s focus border relies on that 1pt border, so the copies
must stay in step by hand.

## What

- Export `fieldStyle(colors)` and `symbolStyle` from `components/TextField.tsx`, next to the component that relies on
  them, and use them in the seven places. No new module.
- `AmountFields` keeps its own padding (room for the symbol) and tabular digits on top of the shared style.

## Acceptance criteria

- [ ] `components/TextField.tsx` exports `fieldStyle(colors)` and `symbolStyle`
- [ ] The seven files use `fieldStyle(colors)` instead of their own copy; the two symbol positions use `symbolStyle`
- [ ] Every field's computed style is unchanged (same keys and values, including padding and tabular digits)
- [ ] Layout snapshots of the touched screens before and after are identical; web check at 390×844 in light and dark
- [ ] `demo-modules.txt` unchanged; `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, any visual change; other style twins.

## Notes

Covered by: no tests (UI); layout snapshots before/after (the snapshot script is in brief 104's plan, "Snapshot
script") and a web check in light and dark. Base: `origin/main` after R9 (#197). Baseline after R8: API 549 passed + 2 skipped, MCP 329, app 531. R9 takes 1.26.11, so
this PR is 1.26.12.

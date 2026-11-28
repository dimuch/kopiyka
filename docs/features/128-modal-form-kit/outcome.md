# Outcome: One modal-form screen frame

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#200](https://github.com/dimuch/kopiyka/pull/200) One modal-form screen frame — v1.26.14

## Decided

- Roadmap row R12. `components/ModalFormScreen.tsx` draws the frame income-item, actual End and the category form
  built by hand: the safe area, the swipe lock while saving, and the Back header. Each screen kept its body, its
  `run` and its error mapping.
- A `null` body draws the wrapped bad-link line. The category form keeps its bare `LoadError` as a child, because
  the wrapped one would sit 16px lower: pixel-identical won over one shared path.
- The `Saving` type sits in `ModalFormScreen.tsx`, not `data/`.
- Proof by recorded element trees on the base and after each slice, all identical; Back reads disabled while a save
  is held.

## Left out

- `trailing`, keyboard-avoiding, style or message props, and a busy hook.
- Any change to `components/CategoryForm.tsx` or to the category form's bad-link placement.

## Follow-ups

- The `body` style is copied in `ModalFormScreen`, `actual-end` and `income-item`; one shared style could follow —
  in BACKLOG.md
- The category form's bad-link and loading lines sit 16px higher than income's and actual End's; unifying them
  changes the look, so it needs its own brief — in BACKLOG.md
- `CategoryForm` could take `& Saving` for its `busy`/`setBusy` props — in BACKLOG.md

Full plan: `git show b9d56afc:docs/features/128-modal-form-kit/plan.md`

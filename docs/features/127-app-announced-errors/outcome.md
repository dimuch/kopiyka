# Outcome: Announced errors in one hook and one line component

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#199](https://github.com/dimuch/kopiyka/pull/199) Announced errors in one hook and one line component — v1.26.13

## Decided

- Roadmap row R11. `src/announcedError.ts` holds `useAnnouncedError()`: the error state, a `showError` that sets and
  then announces it, and `clearError`. It sits at the root next to `pushOnce.ts`, not in `data/` as the brief
  suggested, since it loads nothing.
- `components/ErrorLine.tsx` draws the danger line the alert blocks copied. Callers kept their own names by
  destructuring, so props and success paths didn't change.
- All five of `members.tsx`'s pairs moved (the brief said four). `data/invites.tsx` kept its own announce pair, as
  the roadmap leaves it alone, while `PendingInvites` uses `ErrorLine`.
- Budget's and income's copy failures have no such pair; they show through `LoadError` and were left to R16.
- Each error's text, position, size, colour and font matched before and after; sign-in's was checked after only.

## Left out

- Announcing anything not announced today, including sign-in's error.
- A style prop on `ErrorLine`, a busy or action hook, and changes to `LoadError`, Undo or the added note.

## Follow-ups

- Sign-in's error has the alert role but no VoiceOver announcement, unlike every other form — in BACKLOG.md

Full plan: `git show 470b7cd7:docs/features/127-app-announced-errors/plan.md`

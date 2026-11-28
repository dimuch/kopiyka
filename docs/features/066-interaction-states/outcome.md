# Outcome: Interaction states and Back

Brief: ./brief.md · Finished 2026-11-04

## PRs

- [#95](https://github.com/dimuch/kopiyka/pull/95) Interaction states and Back — before versioning

## Decided

- Two thin shared components carry what must work on iPhone: `TextField` (accent border while focused) and our own
  `Pressable` (dims while pressed). Call sites changed only their import line.
- A web-only `FocusStyles` stylesheet, rendered once in `Root`, removes the browser ring on inputs and draws the
  keyboard ring on everything else, the library tab bar and modals included.
- Gate A accepted the ring on filled buttons as an accent edge with a gap, since accent on accent can't show.
- Selected chips and Appearance options look the same, label colour included.
- In the build, `autoFocus` needed no fallback state: `onFocus` fires for it on web when the page has focus.

## Left out

- Hover and disabled styles, and new colours (the brief).
- A shared header Back component, and a lint rule against React Native's own `Pressable` and `TextInput`.
- Per-kind ring variants.

## Follow-ups

- A conventions §5 line saying new UI uses `@/components/Pressable` and `TextField` — in BACKLOG.md
- The 52pt header spacer no longer matches Back's width — dropped: left as is; the headers were rebuilt in 104e and
  105e.

Full plan: `git show 6b1aa6f1:docs/features/066-interaction-states/plan.md`

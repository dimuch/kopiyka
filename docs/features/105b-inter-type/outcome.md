# Outcome: The fresh look, part 2: Inter and the type mapping

Brief: ./brief.md · Finished 2026-11-26

## PRs

- [#174](https://github.com/dimuch/kopiyka/pull/174) The fresh look, part 2: Inter and the type mapping — v1.23.13

## Decided

- Approved at Gate A under the user's standing OK, with the open questions as assumed.
- Inter, as four faces with one per weight, replaced Bricolage Grotesque and IBM Plex Sans; no `fontWeight` anywhere.
- The modal titles and the sheet title moved to `title`; the other `headingDisplay` sites became `heading`.
- `captionMedium` was kept at 500 for the "€9 over" and "€5 left" warnings. Members' field labels moved to `label`,
  and both tab bar badges took the regular face.
- The +0.5 trackings joined `caption`, `tabular` left text with no digits, and DateField's hidden web input got 16px
  so iOS Safari doesn't zoom.
- The "education" quick chip truncated a little sooner with Inter; accepted, and 105d gave it room.

## Left out

- An `overline` role: only a fallback if the 0 tracking read too tight.
- Smaller web fonts (WOFF2, subsetting or one variable face).
- Re-tuning the amount fields' € position for Inter's metrics.

## Follow-ups

- Have 104f's proposed lint rule also ban `fontWeight` in the app — in BACKLOG.md
- Move the web fonts to WOFF2 or a subset if the first web load proves slow — in BACKLOG.md

Full plan: `git show dc1e2342:docs/features/105b-inter-type/plan.md`

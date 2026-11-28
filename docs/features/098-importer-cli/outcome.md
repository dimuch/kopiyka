# Outcome: Share the Notion importer scripts' command-line code

Brief: ./brief.md · Finished 2026-11-22

## PRs

- [#140](https://github.com/dimuch/kopiyka/pull/140) Share the Notion importer scripts' command-line code — v1.15.4

## Decided

- The three one-time importers moved onto one shared command-line module, with no change to their output.
- One PR, over the ~400-line guide: the characterization tests had to land before the move, including fake-Notion
  `--save` cases through a test-only fetch preload. A tests-only PR first was rejected.
- The brief became 098 and the bump 1.15.4, as 097 and 1.15.3 were taken while it was in review.
- In the build, the pinned history lines use category display names, and review added six more pinned error cases.

## Left out

- Moving `notion-start.ts` or `create-user.ts` onto the module; they got renames only.
- An injectable Notion or NBU client, and a docs slice (flags and steps didn't change).

## Follow-ups

- Wrong plurals, `--ledger` read through `Number()`, and `--save` keeping an old file's mode — dropped: the
  importers were removed (109, #159).
- A missing `DATABASE_URL` or `TOTP_ENC_KEY` prints a raw ZodError, as `create-user` still does — in BACKLOG.md

Full plan: `git show 380a1f38:docs/features/098-importer-cli/plan.md`

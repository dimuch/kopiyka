# Descriptive names across the API

Type: chore

## Why

Roadmap row R1 (`docs/features/refactor-roadmap-2026-11.md`). `find-short-names.sh apps/api/src` reports 28 lines with
single-letter names in loops, callbacks, comparators and declarations, and two more names it doesn't catch are just as
opaque: the `q` parameter of `addMember` in `ledgers/members.ts` and `ch`/`idx` in `auth/totp.ts:31-34`. Readers have
to work out what `r`, `d`, `k` or `i` holds before they can read the line. R2 and R4 later touch the same lines, so the
renames go first.

## What

Rename, one commit per domain, following `kopiyka-refactoring` §4 (element after what it is, plural/singular, units
in the name). Nothing else changes: no structure, no logic, no comparator rewrites (R4 does those).

## Acceptance criteria

- [ ] `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh apps/api/src` reports no lines (exit 0)
- [ ] `ledgers/members.ts`: `addMember`'s first parameter has a descriptive name
- [ ] `auth/totp.ts`: the base32 loop names its character and its value
- [ ] One commit per domain, renames only (no change of logic in the same hunk)
- [ ] Behaviour unchanged: existing tests pass unmodified; API responses, error codes and SQL effects are the same
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, changed error codes.
- Comparator and ternary rewrites (R4), extractions (R2, R3).
- SQL table aliases, `catch (err)`, `_` args and generic type parameters (kept on purpose, §4).
- `apps/mcp` and `apps/mobile`.

## Notes

Covered by: unit tests for money, dates, nbu, ipKey, totp, throttle, nameSuggestions, config; integration tests for
migrations, expenses, categories, summary, admin, members. Baseline on `origin/main@7cffcf10`: gates green, API
545 passed + 2 skipped, MCP 327, mobile 510; integration tests ran (MySQL reachable).

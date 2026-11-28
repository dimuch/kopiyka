# Outcome: Descriptive names across the API

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#189](https://github.com/dimuch/kopiyka/pull/189) Descriptive names across the API — v1.26.3

## Decided

- Roadmap row R1. The 28 lines `find-short-names.sh apps/api/src` reported, plus `addMember`'s `q` and the
  base32 decoder's `ch`/`idx`, were renamed one commit per domain; each rename touched only its scope.
- The top-level modules (`money`, `dates`, `config`, `migrate`, `admin`) belong to no domain, so they shared one
  commit.
- `CORS_ORIGINS`' split had no test, so a characterization case pinned it first.
- `addMember`'s handle became `db`, matching `pruneThrottle(db: Db, …)`.

## Left out

- The nested ternaries in `compareCents` and `rankNames` (R4, brief 120) and the extractions (R2, R3).
- SQL aliases, `catch (err)`, `_` arguments, generic type parameters, and multi-letter vague names such as `res`.
- `apps/mcp` and `apps/mobile` (R8 renamed the app).

## Follow-ups

None.

Full plan: `git show ce168443:docs/features/117-api-descriptive-names/plan.md`

# Outcome: Require `resource` on the connector's sign-in

Brief: ./brief.md · Finished 2026-11-05

## PRs

- [#99](https://github.com/dimuch/kopiyka/pull/99) Log whether the token request carried resource — before versioning
- [#100](https://github.com/dimuch/kopiyka/pull/100) Require resource on the connector's sign-in — before versioning

## Decided

- Two PRs for one brief, because the log had to be deployed and read before the refusal could be finished.
- PR A logged only whether `POST /oauth/token` carried `resource`. One Connect on 5 November showed `resource` in the
  address bar and on every token request, so PR B took slice 4a.
- PR B refuses a sign-in and a token request with no `resource`, with the answers a wrong one already got, and removed
  the log. The Zod fields stay optional so the refusal pages keep working.
- Slice 4b (keep the token check optional) was dropped, since 4a shipped in #100.
- At Gate A the owner chose their own account for the two production Connects.

## Left out

- A log on `/oauth/authorize`, logging the value or a hash of it.
- `invalid_target` for a missing `resource`.
- A stranger's own sign-in service naming kopiyka, which 068 tested later.

## Follow-ups

None.

Full plan: `git show 042f75f1:docs/features/071-require-oauth-resource/plan.md`

# Outcome: Finish the connector's manual tests

Brief: ./brief.md · Finished 2026-11-07

## PRs

- [#98](https://github.com/dimuch/kopiyka/pull/98) Finish the connector's manual tests — before versioning
- [#102](https://github.com/dimuch/kopiyka/pull/102) Record the sign-in service test — v1.0.0

## Decided

- No app code changed: a run on production, then its results in `deploy/README.md`. The hostile server's files were
  kept out of `deploy/`, since it had to be gone within hours.
- Test 1 passed. Test 1b, added with the owner's OK, pointed the hostile `resource` at itself: Claude reached kopiyka
  and only kopiyka's `resource` check stopped it. That result became brief 071.
- Tests 3 to 6 were not finished, by the owner's decision, so AC 3 is not met. The run used the desktop app through
  Chrome.
- The cleanup boxes C1–C9 were done, as reported by the owner.
- #102 recorded the 7 November test of a stranger's own sign-in service: Claude left out `resource`, and 071's refusal
  stopped it.

## Left out

- A control connector, repeated double taps, a second hourly wait, Claude Desktop or Claude Code runs.
- A setup script, or lowering the token lifetime to shorten the wait.

## Follow-ups

- Test a stranger's own sign-in service — done in 068, #102
- The throttle comment's "older than 24 h" wording doesn't match the rule — done in 072, #122

Full plan: `git show ec7569a6:docs/features/068-connector-tests/plan.md`

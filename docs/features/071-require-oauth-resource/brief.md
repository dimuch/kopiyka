# Require `resource` on the connector's sign-in

Type: fix

From brief 068's test 1b. It blocks 069: no write tool ships before this.

## Why

A stranger's connector can send a real user to kopiyka's sign-in. On 5 November 2026 a fake connector named its own address
as `resource` and kopiyka as its sign-in service. Claude followed it, registered at kopiyka and opened `/oauth/authorize`.
Kopiyka refused, because the `resource` wasn't its own.

That check only runs when `resource` is present, and a request without one is accepted. Claude sends it today, but kopiyka's
safety shouldn't rest on that. If it were ever left out, the real sign-in page would open for a stranger's connector, and the
token could go to the stranger.

## What

`GET /oauth/authorize` refuses a request with no `resource`, with the fault page it already shows for a wrong one.
`POST /oauth/token` does the same, with the `invalid_grant` it already gives a wrong one.

## Acceptance criteria

- [ ] `/oauth/authorize` with no `resource` shows the fault page, and no sign-in page.
- [ ] `/oauth/token` with no `resource` gets `invalid_grant`.
- [ ] A request with the right `resource` still works from start to finish.
- [ ] A real Claude connection still works on production after the deploy. Check this first: brief 068 saw Claude send
      `resource` on the fake connector, not on the real one.

## Out of scope

- Any other change to the OAuth flow, and write tools.
- Telling users about stranger's connectors. Kopiyka's page says nothing was shared.

## Notes

- Today's checks: `apps/mcp/src/oauth/authorize.ts:56` and `apps/mcp/src/oauth/token.ts:55`. Existing tests that leave
  `resource` out will need it added, and plan 063 records "No `resource` → 200 sign-in page" as a decision, which this replaces.
- If Claude turns out not to send `resource` on `/oauth/token`, the check there stays optional: the code's own record of what
  was authorized still applies. Say so in the plan.
- The security leftovers planned as 071 move to 072.

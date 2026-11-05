# Require `resource` on the connector's sign-in

Type: fix

From brief 068's test 1b. It blocks 069: no write tool ships before this.

## Why

A stranger's connector can send a real user to kopiyka's `/oauth/authorize`. On 5 November 2026 a fake connector named its own
address as `resource` and kopiyka as its sign-in service. Claude followed it, registered at kopiyka and opened that address.
Kopiyka refused, because the `resource` wasn't its own, so the sign-in page never opened.

That check only runs when `resource` is present, and a request without one is accepted. Claude sent it on the fake connector,
but kopiyka's safety shouldn't rest on that. If it were left out, the real sign-in page would open for a stranger's connector,
and the token could go to the stranger.

## What

Two steps, in this order, because getting the second wrong would break every connection:

1. **Find out what Claude sends.** Read `resource` from the address bar on a real Connect. The token request can't be seen
   that way, and neither nginx nor `apps/mcp` logs it, so ship a small log first that says only if `resource` was present on
   `/oauth/token`, never its value, and connect once.
2. **Refuse a missing `resource`.** `GET /oauth/authorize` shows the fault page it already shows for a wrong one. `POST
/oauth/token` gives the `invalid_grant` it already gives a wrong one, if step 1 shows Claude sends it there. If it doesn't,
   the token check stays optional. That's safe: once `/oauth/authorize` requires it, no code can exist without passing there.

## Acceptance criteria

- [ ] Step 1's two answers are written in the plan before the refusal is built.
- [ ] With a valid client and redirect, `/oauth/authorize` with no `resource` shows the fault page, and no sign-in page.
- [ ] If Claude sends it on the token request, `/oauth/token` with no `resource` gets `invalid_grant`. If not, the plan says
      why the check stays optional.
- [ ] A request with the right `resource` still works from start to finish.
- [ ] A real Claude connection still works on production after the deploy.

## Out of scope

- Any other change to the OAuth flow, and write tools.
- A stranger's own sign-in service that points at kopiyka's endpoints, with `resource` naming kopiyka. Brief 068 didn't test
  it, and this change wouldn't stop it. It needs its own decision before 069.

## Notes

- Today's checks: `apps/mcp/src/oauth/authorize.ts:56` and `apps/mcp/src/oauth/token.ts:55`. The token change belongs at line
  55: making the field required in the Zod schema would answer `invalid_request`, not `invalid_grant`.
- `startSignIn` in `apps/mcp/test/oauthFlow.ts` leaves `resource` out, and `authorize.test.ts` and `token.test.ts` each pin the
  old behaviour, so those flip. Plan 063 records the old rule as a decision, and also that clients MUST send `resource`.
- Test 1b is in `docs/features/068-connector-tests/plan.md`, under Deviations.
- The security leftovers planned as 071 move to 072.

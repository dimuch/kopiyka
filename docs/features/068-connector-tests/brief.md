# Finish the connector's manual tests

Type: chore

From brief 063's plan, Revision 7, and `deploy/README.md`, "What's been tested".

## Why

The connector went live for registered users on 4 November 2026 with six manual tests not run, by the owner's decision. A
read-only token limits what a failure can cost. Brief 069 adds write tools, so the same failure could change someone's
budget. These tests must finish before 069 starts.

The one that matters most is hostile metadata. A stranger's connector names kopiyka as its authorization server, so a user
would sign in on kopiyka's real page. If Claude then sends the token to the stranger's address, the stranger holds a valid
token. Kopiyka's checks can't see this: Claude sends the `resource` and redirect URI they expect. Only Claude's own check
stops it, and that check isn't confirmed.

## What

Run each test on production, record what happened, and update the README. This brief changes no app code. A failure gets
its own fix brief.

1. **Hostile metadata.** Add a connector at another `https` origin that answers `401` and names kopiyka as both its
   `resource` and its authorization server. Claude must refuse it. If kopiyka's sign-in page opens, don't sign in, turn the
   connector off, and stop.
2. **Second Claude account.** Not run: the owner has one Claude account. The README says so, and the test stays open. The
   logged-out two-browser test already passed on 4 November.
3. **Cancel.** Click Cancel on the consent page. Record what Claude shows before and after the "Return to" link.
4. **Double taps.** Double-tap Continue, then Allow, and record what the user sees. Do this once each: a double Continue
   counts as a wrong code against the address, and five in 24 hours lock it for every login, the app included.
5. **Safari.** Connect from Safari on the Mac, through sign-in, Allow and the return to Claude.
6. **Hourly expiry.** Ask a question, wait at least 61 minutes, and ask again on claude.ai and on Claude mobile. Record what
   Claude shows and how sign-in comes back, including on the phone.

Every sign-in uses the throwaway user from the README, deleted afterwards, and never a real account.

If test 1 fails: take `MCP_ENABLED` out of `api.env`, restart the API, and decide what to do before anything else.

## Acceptance criteria

- [ ] Test 1 ran against a real second origin, and Claude's result is recorded. Kopiyka's sign-in page didn't open, or the
      connector is off and a decision is recorded.
- [ ] The README says test 2 wasn't run because there's no second Claude account, and what would run it later.
- [ ] Tests 3 to 6 each have a recorded result: what the user sees, and whether that's acceptable.
- [ ] Anything unacceptable has a brief or a written decision, and the 069 draft names any that block it.
- [ ] `deploy/README.md`, "What's been tested", holds the results with their date, and the list of tests not run is gone or
      says why each stays.
- [ ] The throwaway user and its ledger are gone from production, and its stale connectors are removed.
- [ ] The hostile test's server is gone: nothing still answers on that address, and the `nginx -t` backup steps were
      followed if a shared vhost changed.
- [ ] The login throttle didn't lock the tester's address, or the lock is recorded and cleared.

## Out of scope

- Any change to `apps/mcp`, `apps/api` or the app. Fixes get their own brief.
- Write tools (069, 070).
- Other LLM apps, and Claude Code connecting directly.
- The 90-day client expiry, which can't be tested in a useful time.

## Notes

- The hostile server serves `401` with `resource_metadata`, plus that metadata document. No real data or token touches it,
  and it logs nothing a sign-in could leave. `resource` and `authorization_servers` point at kopiyka.
- It needs a different origin from kopiyka's. A path under kopiyka's own host wouldn't show whether Claude compares them.
- The owner's Claude plan is Max, so the hostile connector sits beside the real one and nothing has to be removed first.
- These are the owner's own servers and accounts, so nobody else is involved. Don't probe Claude beyond adding this one
  connector.

## Decisions

- The hostile server lives on a temporary subdomain of `englishplus.com.ua` on the droplet, with its own small vhost and
  cert, removed afterwards. The live kopiyka vhost isn't touched.

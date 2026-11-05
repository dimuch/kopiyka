# Plan: Require `resource` on the connector's sign-in

Status: approved
Brief: ./brief.md
Branch: `fix/require-oauth-resource` (PR A), `fix/refuse-missing-oauth-resource` (PR B)
Base: PR A on origin/main (c2a4b6e). PR B on origin/main after PR A is merged, not stacked.

## Approach

Two PRs, because the Deploy workflow only runs `main`: step 1's log has to be merged and deployed before anyone can read it,
and the refusal can't be finished until it has been read.

This departs from `/kopiyka-hos`'s "One brief = one branch = one PR". That rule splits a brief that's too big, and this one isn't:
the two steps are one decision in a fixed order, so two briefs would only separate step 2 from the answers it depends on. The
plan is approved once, at Gate A. Gate B and Consolidate run once per PR.

- **PR A** adds one `info` line on `POST /oauth/token` saying whether `resource` came. The owner deploys and connects, and the
  answers go in [Step 1 answers](#step-1-answers).
- **PR B** starts from those answers. It deletes the `undefined` half of the `resource` check in `requestFault`, and of the one in
  `token.ts`'s `valid` if Claude sends it there, then removes the log. Both are deletions, and both refusals reuse the page and
  code a wrong `resource` already gets. The Zod fields stay `.optional()` in both routes: required, they'd give
  `invalid_request` on the token route, and on authorize a failed parse makes `query` empty, which shows the error page
  with no link rather than the fault page.

Alternative considered: logging on nginx, or reading the token request through a tunnel. nginx would need a vhost change and
would see the value, and a tunnel isn't the production path the brief asks about.

## Contracts

- DB: none. App: none.
- Log, PR A to PR B only, checked by running it: `{"level":30,…,"reqId":"req-1","resourcePresent":true,"msg":"token request"}`.
  It's written after the form parses and before the code is checked, so a refused exchange logs too. No other new field.
- `GET /oauth/authorize`, known client and redirect, no `resource` → `400` fault page, link `error=invalid_request&state&iss`.
- `POST /oauth/token`, no `resource`, only if slice 4a applies → `400 { "error": "invalid_grant" }`. The code isn't used up.
- Reuses: `requestFault`, `faultPage`, the `valid` check in `token.ts`, the `logStream` test pattern in `authorize.test.ts`.
- New dependencies: none.

## Slices

### PR A: the log (~35 lines)

This plan is the branch's first commit, at Gate A. The brief is already on `main`.

- [x] 1. Log whether the token request carried `resource`
  - Files: `apps/mcp/src/oauth/token.ts`, `apps/mcp/test/token.test.ts`, `apps/mcp/test/flow.test.ts`
  - Change: `req.log.info({ resourcePresent: form.data.resource !== undefined }, 'token request')` right after the
    `form.success` check, with a comment saying it's brief 071's, presence only, and goes with step 2.
  - Tests: `token.test.ts`, one new test on an app built with `logLevel: 'info'` and a `logStream`. An exchange with
    `resource=https://other.example/mcp` logs `true`, one with none logs `false`, and the logs don't contain `other.example`.
    `flow.test.ts`: add `${PUBLIC_URL}/mcp` to the list of values the logs must not hold (passes at `trace` with the log in).

### Between the PRs: what the owner does

1. Merge PR A, then Actions → **Deploy** → Run workflow on `main`, and wait for it to go green.
2. In Claude, Connect the Kopiyka connector (Disconnect first if it's connected), with your own account.
3. **Before signing in**, read the address bar of the sign-in page: is there a `resource=` in it? The query is gone once the
   form is sent. Note yes or no only: the URL also holds `state`, so don't paste it anywhere.
4. Sign in, Allow, and wait for "Connected".
5. On the droplet, run this. It prints counts and nothing else:

   ```bash
   sudo journalctl -u kopiyka-mcp -o cat | grep '"msg":"token request"' | grep -o '"resourcePresent":[a-z]*' | sort | uniq -c
   ```

6. Send back three things: the address bar's yes or no, the counts, and whether Claude showed "Connected".

No output at step 5 means unknown, not absent. Stop, and check that the Deploy went green and that `mcp.env` doesn't set
`LOG_LEVEL` above `info`.

The value needs no reading. A wrong `resource` is refused today on both routes, so a sign-in page that opened and a "Connected"
mean any value sent was kopiyka's own.

### Step 1 answers

Filled in by slice 2, before any refusal is built.

| Question                                      | Answer              |
| --------------------------------------------- | ------------------- |
| `resource` in the address bar on `/authorize` | yes, kopiyka's own  |
| `resourcePresent` counts on `/oauth/token`    | `true` 1, `false` 0 |
| The Connect ended in "Connected"              | yes                 |

| What step 1 showed                                     | What PR B does                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Address bar yes, every line `true`, Connected          | Slices 2, 3, **4a**, 5, 6                                      |
| Address bar yes, any line `false`, Connected           | Slices 2, 3, **4b**, 5, 6                                      |
| Address bar no                                         | Stop. The refusal would break every connection: owner decides. |
| No log line, sign-in page didn't open, or no Connected | Stop. The answers aren't valid: find out why first.            |

### PR B: the refusal (~60 lines, about half of them PR A's log coming out)

- [x] 2. Record what Claude sends on a real Connect
  - Files: this plan. Change: fill in the table, tick the row that applies, set PR B's final slices in a `## Revision` note.
  - Verify: `yarn format:check`. Yes, no and counts only: no URL, no value.
- [x] 3. Refuse a sign-in with no `resource`
  - Files: `apps/mcp/src/oauth/authorize.ts`, `apps/mcp/test/oauthFlow.ts`, `apps/mcp/test/authorize.test.ts`
  - Change: `if (query.resource !== resource) return 'invalid_request';`, with a why comment. `startSignIn` sends
    `` resource: `${PUBLIC_URL}/mcp` ``. Only those two test files change: checked in a scratch copy, which left 1 failure of
    246, the test below.
  - Tests: `authorize.test.ts:144` keeps its `scope` half, as "accepts a request with no scope". New test next to "needs a
    state", failing before the change: no `resource` → `expectFaultPage(res, 'invalid_request')` and no `name="request"`.
- [x] 4a. Refuse a token request with no `resource` (if every line said `true`)
  - Files: `apps/mcp/src/oauth/token.ts`, `apps/mcp/test/token.test.ts`
  - Change: in `valid`, `(form.data.resource === undefined || form.data.resource === resource) &&` becomes
    `form.data.resource === resource &&`.
  - Tests: "accepts a request with no resource, from a client on an older revision" flips to "refuses a request with no
    resource": 400 `invalid_grant`, then `exchange(code)` with the same code gives 200, so the refusal didn't use it up. In the
    scratch copy it was the only other failure, and the flipped test passes.
- [ ] 4b. Say why the token check stays optional (if any line said `false`)
  - Files: the same two.
  - Change: a comment on the `form.data.resource === undefined` check in `valid`, with the reason under
    [Why optional is safe](#why-optional-is-safe), and the test "accepts a request with no resource, from a client on an older
    revision" renamed, as "older revision" would no longer be the reason.
  - Tests: that test stays as it is otherwise.
- [x] 5. Stop logging the token request's `resource`
  - Files: `apps/mcp/src/oauth/token.ts`, `apps/mcp/test/token.test.ts`
  - Change: remove slice 1's line and its test. `flow.test.ts`'s list keeps `${PUBLIC_URL}/mcp`: the rule outlives the log.
  - Tests: `yarn test`, and `rg resourcePresent apps` finds nothing.
- [x] 6. Say `resource` is now required in the connector notes
  - Files: `deploy/README.md`, "What's been tested", the second hostile bullet.
  - Change: its last sentence says a request with no `resource` still passes. Say it's refused since brief 071, add step 1's
    answers with the date, and for 4b the reason the token check stays optional. The first bullet stays true.
  - Verify: `yarn format:check`.

Just before PR B merges, the owner runs step 5's count again, as the log is still live. If PR B holds 4a and any line now says
`false`, swap 4a for 4b before merging.

After PR B: merge, **Deploy**, Disconnect, Connect with the account ruled on at Gate A, and ask Claude one question through the
connector. The deploy can only follow the merge, so the result goes in PR B's Test plan.

If that Connect fails, revert slice 3, and 4a if it shipped, in a new PR and Deploy. Tokens already issued keep working for up
to an hour.

### Why optional is safe

For slice 4b, and AC3's "if not". `signin` values are sealed in one place, `authorize.ts:100`, after `requestFault`. A `consent`
comes only from an opened `signin`, and a `code` only from an opened `consent`. So once `/oauth/authorize` requires `resource`,
no code can exist that didn't pass there, and the access token's `aud` is always kopiyka's. The one exception is a sign-in
already past authorize at the deploy, which has at most about 20 minutes left, as plan 063 records for the redirect list.

## AC → evidence

| AC                                                   | Evidence                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Step 1's answers in the plan, log never holds value  | Slice 2's table, committed before slice 3; slice 1's `token.test.ts` test and `flow.test.ts` list |
| Authorize with no `resource`: fault page, no sign-in | Slice 3's new test                                                                                |
| Token with no `resource`, or why it stays optional   | 4a's flipped test, or 4b's comment and [Why optional is safe](#why-optional-is-safe)              |
| The right `resource` works from start to finish      | `flow.test.ts` "goes from registration to a tool answer"; `token.test.ts` through `startSignIn`   |
| A real Claude connection works after the deploy      | The owner's Connect and one question after PR B's deploy, ticked in PR B's Test plan              |

## Not doing (YAGNI)

- A log on `/oauth/authorize`: the address bar answers that, and the brief asks for the token route only.
- Logging the value, or a hash of it. A hash of a known value is the value.
- `invalid_target`, which RFC 8707 §2.1 names for a missing `resource`: the brief keeps the answers a wrong one already gets.
- A stranger's own sign-in service naming kopiyka as `resource`: out of scope, and this change doesn't stop it. It stays open
  before 069.
- Editing plan 063. It records the old rule as a decision of its time.

## Risks

- Claude doesn't send `resource` on a real Connect, though the spec says it must and it did on the fake connector. That would
  break every connection. Disproved by step 3 of the owner's list, before slice 3 exists.
- One Connect from one surface may not speak for all of them: mobile and the hourly sign-in have never been read. The log is
  live from PR A's deploy, so any sign-in up to the recount before PR B merges adds to the counts, and one `false` keeps the
  token check optional. The address bar can't do the same for `/oauth/authorize`, so that half rests on the Connect read here
  and on AC5's check.
- `LOG_LEVEL` could be set above `info` on the droplet. The README's `mcp.env` has none, and this laptop can't check. A `false`
  and a missing line look different, so this can't give a wrong answer, only cost a second deploy.

## Open questions

- Yes, for PR B only — Step 1's answers. Slice 4a or 4b can't be chosen, and slice 3 can't start, until the owner sends them.
  Nothing blocks PR A.
- Settled at Gate A — The two production Connects use the owner's real account, and the second asks a question of it, while
  `deploy/README.md` says to use a throwaway user for a test, never a real account. The orchestrator recommended the owner's
  own account, as a normal Connect, and the owner approved the plan without asking for the throwaway user.
- No — Where AC5's result lives, since a deploy can only follow the merge. Meanwhile: PR B's Test plan, with no third PR.
- No — If Connect opens somewhere with no address bar, step 3 can't be done. Meanwhile: assumed to open in Chrome, as on 5
  November. If not, connect from claude.ai in a browser.

No text in the brief tried to change this process.

## Follow-ups

None new. The stranger's sign-in service is already a follow-up in plan 068.

## Deviations

## Consolidate

## Revision 1

From the skeptic's approval, all five suggestions taken: a recount before PR B merges, the one-PR departure named, the first
commit reworded, 4a and 4b pointing to the expression (slice 1 moves the line), and 4a's test proving the code isn't used up.
Added the real-account question for Gate A, so step 2 no longer settles it.

## Revision 2

Step 1's answers came from one Connect on 5 November 2026, from the desktop app through Chrome, on the owner's account. The first
try left no log line because it ran before the Deploy restarted `kopiyka-mcp`, so it was repeated. Address bar yes, every line
`true`, Connected: PR B's final slices are 3, **4a**, 5 and 6.
